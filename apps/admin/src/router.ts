import { createHash, timingSafeEqual } from "node:crypto";

import { adminCss, adminHtml, adminJavaScript } from "./assets.ts";
import {
  DeviceStatusRegistry,
  type DeviceId,
  type Heartbeat
} from "./status.ts";
import {
  LatestPhotoStore,
  MAX_PHOTO_BYTES,
  type BoardDeviceId,
} from "./photos.ts";
import { PhotoDownloadTokenStore } from "./photoDownloadTokens.ts";
import { AuthThrottle } from "./authThrottle.ts";
import {
  generateSeedreamAvatar,
  SeedreamAdminError,
} from "./seedream.ts";

export type AdminEnvironment = Record<string, string | undefined>;
export type AdminRouter = (request: Request) => Promise<Response>;

export interface AdminRouterOptions {
  env: AdminEnvironment;
  registry: DeviceStatusRegistry;
  photos?: LatestPhotoStore;
  photoDownloadTokens?: PhotoDownloadTokenStore;
  authThrottle?: AuthThrottle;
  seedreamFetch?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  now?: () => number;
}

function secureHeaders(contentType: string): Headers {
  return new Headers({
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
}

function response(body: BodyInit | null, status: number, contentType: string): Response {
  return new Response(body, { status, headers: secureHeaders(contentType) });
}

function json(body: unknown, status = 200): Response {
  return response(JSON.stringify(body), status, "application/json; charset=utf-8");
}

function withIslandCors(result: Response, origin: string): Response {
  result.headers.set("Access-Control-Allow-Origin", origin);
  result.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  result.headers.set("Access-Control-Allow-Headers", "Content-Type");
  result.headers.set("Vary", "Origin");
  return result;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function isAdminAuthorized(request: Request, env: AdminEnvironment): boolean {
  const expectedUser = env.PF_ADMIN_USERNAME;
  const expectedPassword = env.PF_ADMIN_PASSWORD;
  const header = request.headers.get("authorization");
  if (!expectedUser || !expectedPassword || !header?.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    return constantTimeEqual(decoded, `${expectedUser}:${expectedPassword}`);
  } catch {
    return false;
  }
}

function unauthorized(): Response {
  const result = json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } }, 401);
  result.headers.set("WWW-Authenticate", 'Basic realm="Pocket Friend Admin", charset="UTF-8"');
  return result;
}

function isDeviceAuthorized(request: Request, env: AdminEnvironment): boolean {
  const expected = env.PF_DEVICE_HEARTBEAT_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/u, "") ?? "";
  return Boolean(expected && supplied && constantTimeEqual(supplied, expected));
}

async function isPhotoDownloadAuthorized(
  request: Request,
  env: AdminEnvironment,
  tokenStore: PhotoDownloadTokenStore,
): Promise<boolean> {
  const expected = env.PF_PHOTO_DOWNLOAD_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/u, "") ?? "";
  if (!supplied) return false;
  if (expected && constantTimeEqual(supplied, expected)) return true;
  return tokenStore.verify(supplied);
}

async function isPhotoReaderAuthorized(
  request: Request,
  env: AdminEnvironment,
  tokenStore: PhotoDownloadTokenStore,
): Promise<boolean> {
  return isAdminAuthorized(request, env) || await isPhotoDownloadAuthorized(request, env, tokenStore);
}

function allowedWebOrigin(request: Request, env: AdminEnvironment): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const configured = env.PF_WEB_ORIGIN?.split(",").map((value) => value.trim()).filter(Boolean);
    if (configured?.length) {
      return configured.includes(origin) ? origin : null;
    }
    return new URL(origin).hostname === new URL(request.url).hostname ? origin : null;
  } catch {
    return null;
  }
}

function isDeviceId(value: unknown): value is DeviceId {
  return value === "web" || value === "board-a" || value === "board-b";
}

function isBoardDeviceId(value: unknown): value is BoardDeviceId {
  return value === "board-a";
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

function normalizePhotoName(value: string | null): string | undefined {
  const normalized = value
    ?.trim()
    .replace(/[\x00-\x1F<>:"/\\|?*]+/gu, " ")
    .replace(/\s+/gu, " ")
    .slice(0, 80)
    .trim();
  return normalized || undefined;
}

function photoNameFromFilename(value: string | null): string | undefined {
  if (!value) return undefined;
  const file = value.split(/[\\/]/u).at(-1) ?? "";
  const base = file.replace(/\.[^.]*$/u, "");
  if (!base || base === "photo") return undefined;
  if (
    /^\d{8}[_-]\d{6}$/u.test(base) ||
    /^\d{10,}$/u.test(base) ||
    /^\d{4}-\d{2}-\d{2}T/u.test(base)
  ) {
    return undefined;
  }
  return normalizePhotoName(
    base
      .replace(/[_-]\d{8}[_-]\d{6}(?:[_-]\d+)?$/u, "")
      .replace(/[_-]\d{10,}$/u, ""),
  );
}

function photoNameFromRequest(request: Request, url: URL): string | undefined {
  return normalizePhotoName(
    url.searchParams.get("name") ??
    url.searchParams.get("nickname") ??
    url.searchParams.get("personName") ??
    request.headers.get("x-photo-name"),
  ) ?? photoNameFromFilename(url.searchParams.get("filename"));
}

async function latestAvailablePhoto(photos: LatestPhotoStore, deviceId: BoardDeviceId) {
  const current = await photos.get(deviceId);
  if (current) return current;
  const newest = (await photos.listHistory(deviceId))[0];
  return newest ? await photos.getHistoryPhoto(deviceId, newest.id) : undefined;
}

function parseHeartbeat(value: unknown): Heartbeat | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!isDeviceId(input.deviceId)) return null;
  if (input.deviceId === "web" && (typeof input.clientId !== "string" || input.clientId.length > 100)) {
    return null;
  }
  if (input.deviceId !== "web" && input.clientId !== undefined) return null;
  if (input.firmwareVersion !== undefined && (typeof input.firmwareVersion !== "string" || input.firmwareVersion.length > 40)) {
    return null;
  }
  if (input.batteryPercent !== undefined && (
    typeof input.batteryPercent !== "number" ||
    !Number.isInteger(input.batteryPercent) ||
    input.batteryPercent < 0 ||
    input.batteryPercent > 100
  )) return null;

  return {
    deviceId: input.deviceId,
    ...(typeof input.clientId === "string" ? { clientId: input.clientId } : {}),
    ...(typeof input.firmwareVersion === "string" ? { firmwareVersion: input.firmwareVersion } : {}),
    ...(typeof input.batteryPercent === "number" ? { batteryPercent: input.batteryPercent } : {}),
  };
}


export function createAdminRouter(options: AdminRouterOptions): AdminRouter {
  const now = options.now ?? Date.now;
  const photos = options.photos ?? new LatestPhotoStore();
  const photoDownloadTokens = options.photoDownloadTokens ?? new PhotoDownloadTokenStore();
  const authThrottle = options.authThrottle ?? new AuthThrottle();

  const tooManyAttempts = (retryAfterSeconds: number): Response => {
    const result = json({ error: { code: "TOO_MANY_ATTEMPTS", message: "Too many failed attempts. Try again later." } }, 429);
    result.headers.set("Retry-After", String(retryAfterSeconds));
    return result;
  };

  // Locks an auth scope per client after repeated bad credentials; requests
  // without an Authorization header only prompt and are never penalized.
  const requireAuth = async (
    scope: string,
    request: Request,
    verify: () => boolean | Promise<boolean>,
  ): Promise<Response | null> => {
    const key = `${scope}:${request.headers.get("x-real-ip") ?? "unknown"}`;
    const retryAfter = authThrottle.retryAfterSeconds(key, now());
    if (retryAfter > 0) return tooManyAttempts(retryAfter);
    if (await verify()) {
      authThrottle.recordSuccess(key);
      return null;
    }
    if (request.headers.has("authorization")) authThrottle.recordFailure(key, now());
    return unauthorized();
  };
  const requireAdmin = (request: Request) =>
    requireAuth("admin", request, () => isAdminAuthorized(request, options.env));
  const requireDevice = (request: Request) =>
    requireAuth("device", request, () => isDeviceAuthorized(request, options.env));
  const requirePhotoReader = (request: Request) =>
    requireAuth("photo", request, () => isPhotoReaderAuthorized(request, options.env, photoDownloadTokens));

  return async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "pocket-friend-admin" });
    }

    if (url.pathname === "/island-avatar-api/generate") {
      const origin = allowedWebOrigin(request, options.env);
      if (!origin) return json({ error: { code: "ORIGIN_DENIED", message: "Origin not allowed." } }, 403);
      if (request.method === "OPTIONS") {
        return withIslandCors(response(null, 204, "text/plain; charset=utf-8"), origin);
      }
      if (request.method !== "POST") {
        return withIslandCors(json({ error: { code: "METHOD_NOT_ALLOWED", message: "Only POST requests are supported." } }, 405), origin);
      }

      try {
        const body = await request.json() as { image?: unknown };
        if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
          return withIslandCors(json({ error: { code: "SEEDREAM_IMAGE_REQUIRED", message: "A data URL image is required." } }, 400), origin);
        }
        const result = await generateSeedreamAvatar({
          apiKey: options.env.DOUBAO_API_KEY ?? "",
          image: body.image,
          ...(options.env.DOUBAO_MODEL ? { model: options.env.DOUBAO_MODEL } : {}),
          ...(options.env.DOUBAO_ENDPOINT ? { endpoint: options.env.DOUBAO_ENDPOINT } : {}),
          ...(options.seedreamFetch ? { fetcher: options.seedreamFetch } : {}),
        });
        return withIslandCors(json(result), origin);
      } catch (error) {
        if (error instanceof SeedreamAdminError) {
          return withIslandCors(json({ error: { code: error.code, message: error.message } }, error.status), origin);
        }
        return withIslandCors(json({ error: { code: "SEEDREAM_ADMIN_ERROR", message: "Seedream generation failed." } }, 502), origin);
      }
    }

    if (url.pathname.startsWith("/island-photo-api/")) {
      const origin = allowedWebOrigin(request, options.env);
      if (!origin) return json({ error: { code: "ORIGIN_DENIED", message: "Origin not allowed." } }, 403);
      if (request.method === "OPTIONS") {
        return withIslandCors(response(null, 204, "text/plain; charset=utf-8"), origin);
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        return withIslandCors(json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405), origin);
      }

      const islandPath = url.pathname.slice("/island-photo-api".length);
      const historyMatch = /^\/api\/photos\/(board-a)\/history$/u.exec(islandPath);
      if (historyMatch) {
        const deviceId = historyMatch[1] as BoardDeviceId;
        return withIslandCors(json({
          photos: (await photos.listHistory(deviceId)).map((photo) => ({
            ...photo,
            url: `/api/photos/${deviceId}/history/${encodeURIComponent(photo.id)}`,
          })),
        }), origin);
      }

      const archivedMatch = /^\/api\/photos\/(board-a)\/history\/([^/]+)$/u.exec(islandPath);
      if (archivedMatch) {
        const photo = await photos.getHistoryPhoto(
          archivedMatch[1] as BoardDeviceId,
          decodeURIComponent(archivedMatch[2] ?? ""),
        );
        if (!photo) return withIslandCors(json({ error: { code: "PHOTO_NOT_FOUND", message: "No photo has been uploaded." } }, 404), origin);
        const result = response(request.method === "HEAD" ? null : photo.bytes, 200, "image/jpeg");
        result.headers.set("X-Captured-At", photo.capturedAt);
        if (photo.name) result.headers.set("X-Photo-Name", encodeURIComponent(photo.name));
        return withIslandCors(result, origin);
      }

      const latestMatch = /^\/api\/photos\/(board-a)\/latest$/u.exec(islandPath);
      if (latestMatch) {
        const photo = await latestAvailablePhoto(photos, latestMatch[1] as BoardDeviceId);
        if (!photo) return withIslandCors(json({ error: { code: "PHOTO_NOT_FOUND", message: "No photo has been uploaded." } }, 404), origin);
        const result = response(request.method === "HEAD" ? null : photo.bytes, 200, "image/jpeg");
        result.headers.set("X-Captured-At", photo.capturedAt);
        if (photo.name) result.headers.set("X-Photo-Name", encodeURIComponent(photo.name));
        return withIslandCors(result, origin);
      }

      return withIslandCors(json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404), origin);
    }

    if (url.pathname === "/api/heartbeat" && request.method === "OPTIONS") {
      const origin = allowedWebOrigin(request, options.env);
      if (!origin) return json({ error: { code: "ORIGIN_DENIED", message: "Origin not allowed." } }, 403);
      const result = response(null, 204, "text/plain; charset=utf-8");
      result.headers.set("Access-Control-Allow-Origin", origin);
      result.headers.set("Access-Control-Allow-Headers", "Content-Type");
      result.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      result.headers.set("Vary", "Origin");
      return result;
    }

    if (url.pathname === "/api/heartbeat" && request.method === "POST") {
      let heartbeat: Heartbeat | null;
      try {
        heartbeat = parseHeartbeat(await request.json());
      } catch {
        heartbeat = null;
      }
      if (!heartbeat) return json({ error: { code: "INVALID_HEARTBEAT", message: "Heartbeat is invalid." } }, 400);

      let origin: string | null = null;
      if (heartbeat.deviceId === "web") {
        origin = allowedWebOrigin(request, options.env);
        if (!origin) return json({ error: { code: "ORIGIN_DENIED", message: "Origin not allowed." } }, 403);
        const userAgent = request.headers.get("user-agent");
        const ip = request.headers.get("x-real-ip");
        if (userAgent) heartbeat.userAgent = userAgent;
        if (ip) heartbeat.ip = ip;
        options.registry.record(heartbeat, now());
      } else {
        const denied = await requireDevice(request);
        if (denied) return denied;
        options.registry.record(heartbeat, now());
      }

      const result = response(null, 204, "text/plain; charset=utf-8");
      if (origin) {
        result.headers.set("Access-Control-Allow-Origin", origin);
        result.headers.set("Vary", "Origin");
      }
      return result;
    }

    if (url.pathname === "/api/photos" && request.method === "POST") {
      const denied = await requireDevice(request);
      if (denied) return denied;
      const deviceId = url.searchParams.get("deviceId");
      if (!isBoardDeviceId(deviceId)) {
        return json({ error: { code: "INVALID_DEVICE", message: "Board device is invalid." } }, 400);
      }
      if (request.headers.get("content-type")?.toLowerCase() !== "image/jpeg") {
        return json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "A JPEG photo is required." } }, 415);
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length > MAX_PHOTO_BYTES) {
        return json({ error: { code: "PHOTO_TOO_LARGE", message: "Photo exceeds 512 KiB." } }, 413);
      }
      if (!isJpeg(bytes)) {
        return json({ error: { code: "INVALID_JPEG", message: "Photo is not a valid JPEG." } }, 400);
      }
      const photoName = photoNameFromRequest(request, url);
      await photos.put(deviceId, bytes, now(), photoName ? { name: photoName } : {});
      return response(null, 204, "text/plain; charset=utf-8");
    }

    if (url.pathname === "/api/photo-download-token" && request.method === "POST") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      return json(await photoDownloadTokens.generate(now()), 201);
    }

    const archivedPhotoMutationMatch = /^\/api\/photos\/(board-a)\/history\/([^/]+)$/u.exec(url.pathname);
    if (archivedPhotoMutationMatch && request.method === "DELETE") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      const deleted = await photos.deleteHistoryPhoto(
        archivedPhotoMutationMatch[1] as BoardDeviceId,
        decodeURIComponent(archivedPhotoMutationMatch[2] ?? ""),
      );
      if (!deleted) return json({ error: { code: "PHOTO_NOT_FOUND", message: "No photo has been uploaded." } }, 404);
      return response(null, 204, "text/plain; charset=utf-8");
    }
    if (archivedPhotoMutationMatch && request.method === "PATCH") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: { code: "INVALID_JSON", message: "A JSON body is required." } }, 400);
      }
      const rawName = typeof body === "object" && body ? (body as { name?: unknown }).name : undefined;
      const name = normalizePhotoName(typeof rawName === "string" ? rawName : null);
      if (!name) return json({ error: { code: "INVALID_PHOTO_NAME", message: "Photo name is required." } }, 400);
      const renamed = await photos.renameHistoryPhoto(
        archivedPhotoMutationMatch[1] as BoardDeviceId,
        decodeURIComponent(archivedPhotoMutationMatch[2] ?? ""),
        name,
      );
      if (!renamed) return json({ error: { code: "PHOTO_NOT_FOUND", message: "No photo has been uploaded." } }, 404);
      const deviceId = archivedPhotoMutationMatch[1] as BoardDeviceId;
      return json({
        ...renamed,
        url: `/api/photos/${deviceId}/history/${encodeURIComponent(renamed.id)}`,
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const result = json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405);
      result.headers.set("Allow", "GET, HEAD");
      return result;
    }

    if (url.pathname === "/api/status") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      return json(options.registry.snapshot(now()));
    }
    const photoHistoryMatch = /^\/api\/photos\/(board-a)\/history$/u.exec(url.pathname);
    if (photoHistoryMatch) {
      const denied = await requirePhotoReader(request);
      if (denied) return denied;
      const deviceId = photoHistoryMatch[1] as BoardDeviceId;
      return json({
        photos: (await photos.listHistory(deviceId)).map((photo) => ({
          ...photo,
          url: `/api/photos/${deviceId}/history/${encodeURIComponent(photo.id)}`,
        })),
      });
    }

    const archivedPhotoMatch = /^\/api\/photos\/(board-a)\/history\/([^/]+)$/u.exec(url.pathname);
    if (archivedPhotoMatch) {
      const denied = await requirePhotoReader(request);
      if (denied) return denied;
      const photo = await photos.getHistoryPhoto(
        archivedPhotoMatch[1] as BoardDeviceId,
        decodeURIComponent(archivedPhotoMatch[2] ?? ""),
      );
      if (!photo) return json({ error: { code: "PHOTO_NOT_FOUND", message: "No photo has been uploaded." } }, 404);
      const result = response(photo.bytes, 200, "image/jpeg");
      result.headers.set("X-Captured-At", photo.capturedAt);
      if (photo.name) result.headers.set("X-Photo-Name", encodeURIComponent(photo.name));
      return result;
    }

    const photoMatch = /^\/api\/photos\/(board-a)\/latest$/u.exec(url.pathname);
    if (photoMatch) {
      const denied = await requirePhotoReader(request);
      if (denied) return denied;
      const photo = await latestAvailablePhoto(photos, photoMatch[1] as BoardDeviceId);
      if (!photo) return json({ error: { code: "PHOTO_NOT_FOUND", message: "No photo has been uploaded." } }, 404);
      const result = response(photo.bytes, 200, "image/jpeg");
      result.headers.set("X-Captured-At", photo.capturedAt);
      if (photo.name) result.headers.set("X-Photo-Name", encodeURIComponent(photo.name));
      return result;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      return response(request.method === "HEAD" ? null : adminHtml, 200, "text/html; charset=utf-8");
    }
    if (url.pathname === "/assets/admin.css") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      return response(request.method === "HEAD" ? null : adminCss, 200, "text/css; charset=utf-8");
    }
    if (url.pathname === "/assets/admin.js") {
      const denied = await requireAdmin(request);
      if (denied) return denied;
      return response(request.method === "HEAD" ? null : adminJavaScript, 200, "text/javascript; charset=utf-8");
    }
    return json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404);
  };
}
