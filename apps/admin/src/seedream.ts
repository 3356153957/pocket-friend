import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const DEFAULT_MODEL = "doubao-seedream-5-0-260128";
const ARK_HOSTNAME = "ark.cn-beijing.volces.com";
const SEEDREAM_TIMEOUT_MS = 60_000;
const MAX_SEEDREAM_JSON_BYTES = 1024 * 1024;
const MAX_GENERATED_IMAGE_BYTES = 10 * 1024 * 1024;

export const SEEDREAM_MAPLESTORY_PROMPT =
  "A MapleStory-style 2D pixel art game character sprite, 2.0-2.3 head-to-body ratio, 35-45 degree quarter view, big wide-set eyes with large pupils and highlight, no nose, very small mouth, soft blush, oversized hairstyle with highlight on top, no neck, head connects directly to torso, very small torso with short cylindrical arms and legs, 32-64px retro game sprite scaled up, chunky visible pixels, clean 1px outline, flat cel-shaded colors, solid color pixel blocks, minimal shading, no dithering, no smooth gradients, no airbrush, no anti-aliasing, pure white background, single character only, full body, centered, 1080x1080 canvas. Character should look exactly like a real MapleStory player character sprite, not regular pixel art. Preserve hair color, skin tone, and facial features from the reference photo.";

export type SeedreamErrorCode =
  | "SEEDREAM_MISSING_CONFIG"
  | "SEEDREAM_INVALID_CONFIG"
  | "SEEDREAM_UPSTREAM_ERROR"
  | "SEEDREAM_INVALID_RESPONSE";

export class SeedreamAdminError extends Error {
  readonly code: SeedreamErrorCode;
  readonly status: number;

  constructor(code: SeedreamErrorCode, message: string, status: number) {
    super(message);
    this.name = "SeedreamAdminError";
    this.code = code;
    this.status = status;
  }
}

export interface SeedreamGenerationOptions {
  apiKey: string;
  image: string;
  model?: string;
  endpoint?: string;
  fetcher?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

export interface SeedreamGenerationResult {
  data: Array<{ b64_json: string }>;
  model: string;
}

interface SeedreamUpstreamResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

export async function generateSeedreamAvatar(
  options: SeedreamGenerationOptions,
): Promise<SeedreamGenerationResult> {
  if (!options.apiKey.trim()) {
    throw new SeedreamAdminError(
      "SEEDREAM_MISSING_CONFIG",
      "Seedream generation is not configured.",
      503,
    );
  }

  const endpoint = parseEndpoint(options.endpoint ?? DEFAULT_ENDPOINT);
  const model = options.model?.trim() || DEFAULT_MODEL;
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: SEEDREAM_MAPLESTORY_PROMPT,
      image: options.image,
      sequential_image_generation: "disabled",
      size: "2K",
      response_format: "url",
      stream: false,
      watermark: false,
    }),
    redirect: "error",
    signal: AbortSignal.timeout(SEEDREAM_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new SeedreamAdminError(
      "SEEDREAM_UPSTREAM_ERROR",
      `Seedream upstream returned HTTP ${response.status}.`,
      502,
    );
  }

  const payload = await readJsonResponse<SeedreamUpstreamResponse>(
    response,
    MAX_SEEDREAM_JSON_BYTES,
  );
  const generated = payload?.data?.[0];
  if (generated?.b64_json) return { data: [{ b64_json: generated.b64_json }], model };

  if (!generated?.url) {
    throw new SeedreamAdminError(
      "SEEDREAM_INVALID_RESPONSE",
      "Seedream returned no generated image.",
      502,
    );
  }

  const imageUrl = await parseGeneratedImageUrl(generated.url, options.fetcher === undefined);
  const imageResponse = await fetcher(imageUrl, {
    headers: { Accept: "image/png, image/jpeg, image/webp" },
    redirect: "error",
    signal: AbortSignal.timeout(SEEDREAM_TIMEOUT_MS),
  });
  if (!imageResponse.ok) {
    throw new SeedreamAdminError(
      "SEEDREAM_UPSTREAM_ERROR",
      `Seedream image download returned HTTP ${imageResponse.status}.`,
      502,
    );
  }

  const contentType = imageResponse.headers.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (!contentType || !["image/png", "image/jpeg", "image/webp"].includes(contentType)) {
    throw new SeedreamAdminError(
      "SEEDREAM_INVALID_RESPONSE",
      "Seedream returned an unsupported image type.",
      502,
    );
  }

  const b64Json = Buffer.from(await readLimitedBytes(imageResponse, MAX_GENERATED_IMAGE_BYTES)).toString("base64");
  return { data: [{ b64_json: b64Json }], model };
}

function parseEndpoint(value: string): URL {
  try {
    const endpoint = new URL(value);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.hostname !== ARK_HOSTNAME ||
      (endpoint.port && endpoint.port !== "443") ||
      endpoint.username ||
      endpoint.password
    ) {
      throw new Error("Trusted Ark HTTPS endpoint required");
    }
    return endpoint;
  } catch {
    throw new SeedreamAdminError(
      "SEEDREAM_INVALID_CONFIG",
      "Seedream endpoint must use the trusted Volcengine Ark host.",
      503,
    );
  }
}

async function parseGeneratedImageUrl(value: string, resolveHostname: boolean): Promise<URL> {
  try {
    const imageUrl = new URL(value);
    if (
      imageUrl.protocol !== "https:" ||
      imageUrl.username ||
      imageUrl.password ||
      isPrivateHostname(imageUrl.hostname)
    ) {
      throw new Error("Public HTTPS URL required");
    }
    if (resolveHostname && isIP(normalizeHostname(imageUrl.hostname)) === 0) {
      const addresses = await lookup(imageUrl.hostname, { all: true, verbatim: true });
      if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
        throw new Error("Public address required");
      }
    }
    return imageUrl;
  } catch {
    throw new SeedreamAdminError(
      "SEEDREAM_INVALID_RESPONSE",
      "Seedream returned an invalid image URL.",
      502,
    );
  }
}

async function readJsonResponse<T>(response: Response, limit: number): Promise<T | null> {
  try {
    const bytes = await readLimitedBytes(response, limit);
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as T;
  } catch (error) {
    if (error instanceof SeedreamAdminError) throw error;
    return null;
  }
}

async function readLimitedBytes(response: Response, limit: number): Promise<Uint8Array> {
  const declaredLength = Number.parseInt(response.headers.get("Content-Length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > limit) throw invalidResponseSize();

  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw invalidResponseSize();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function invalidResponseSize(): SeedreamAdminError {
  return new SeedreamAdminError(
    "SEEDREAM_INVALID_RESPONSE",
    "Seedream response exceeds the allowed size.",
    502,
  );
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/gu, "").toLowerCase();
}

function isPrivateHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized === "localhost" || normalized.endsWith(".localhost") || isPrivateAddress(normalized);
}

function isPrivateAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  if (isIP(normalized) === 4) {
    const octets = normalized.split(".").map(Number);
    const first = octets[0] ?? 0;
    const second = octets[1] ?? 0;
    return first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19));
  }

  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1") return true;
    if (/^(fc|fd)/u.test(normalized) || /^fe[89ab]/u.test(normalized)) return true;
    const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
    return mappedIpv4 ? isPrivateAddress(mappedIpv4) : false;
  }

  return false;
}
