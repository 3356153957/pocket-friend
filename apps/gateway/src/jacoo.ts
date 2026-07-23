import type { GeoPoint } from "../../../packages/nearby-core/src/index.ts";

export type JacooFreshness = "live" | "last_seen";
export type JacooEnvironment = "development" | "test" | "production";

export interface JacooGatewayConfig {
  enabled: boolean;
  environment: JacooEnvironment;
  baseUrl: string;
  apiKey: string;
  now?: () => Date;
  fetcher?: (input: string | URL, init?: RequestInit) => Promise<Response>;
}

export interface JacooLatestLocation {
  location: GeoPoint;
  freshness: JacooFreshness;
  ageMs: number;
}

export class JacooGatewayError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "JacooGatewayError";
    this.code = code;
  }
}

interface JacooLatestResponse {
  sample?: {
    latitude?: unknown;
    longitude?: unknown;
    horizontal_accuracy_m?: unknown;
    timestamp?: unknown;
  } | null;
}

const liveWindowMs = 2 * 60 * 1000;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function parseLocalShanghaiTimestamp(value: string): Date {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value);
  return new Date(hasTimezone ? value : `${value}+08:00`);
}

function normalizeCapturedAt(value: string): string {
  if (/\.\d{3}(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    return value.replace("Z", "+00:00");
  }

  if (/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) {
    return value.replace(/(Z|[+-]\d{2}:\d{2})$/u, ".000$1").replace("Z", "+00:00");
  }

  return `${value}.000+08:00`;
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new JacooGatewayError("JACOO_BAD_RESPONSE", `JACOO response field ${field} is invalid.`);
  }

  return value;
}

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new JacooGatewayError("JACOO_BAD_RESPONSE", `JACOO response field ${field} is invalid.`);
  }

  return value;
}

export async function fetchJacooLatestLocation(config: JacooGatewayConfig): Promise<JacooLatestLocation> {
  if (!config.enabled || config.environment === "production") {
    throw new JacooGatewayError("JACOO_DISABLED", "JACOO location bridge is disabled.");
  }

  if (!config.baseUrl || !config.apiKey) {
    throw new JacooGatewayError("JACOO_MISSING_CONFIG", "JACOO base URL and API key must be provided at runtime.");
  }

  const fetcher = config.fetcher ?? globalThis.fetch;
  if (!fetcher) {
    throw new JacooGatewayError("JACOO_FETCH_UNAVAILABLE", "Fetch is unavailable in this runtime.");
  }

  const response = await fetcher(`${normalizeBaseUrl(config.baseUrl)}/api/jacoo/location/latest`, {
    headers: {
      Accept: "application/json",
      "X-API-Key": config.apiKey,
    },
  });

  if (!response.ok) {
    throw new JacooGatewayError("JACOO_UPSTREAM_ERROR", `JACOO upstream returned HTTP ${response.status}.`);
  }

  const body = await response.json() as JacooLatestResponse;
  if (!body.sample) {
    throw new JacooGatewayError("JACOO_BAD_RESPONSE", "JACOO response is missing a latest sample.");
  }

  const rawCapturedAt = assertString(body.sample.timestamp, "sample.timestamp");
  const capturedAt = parseLocalShanghaiTimestamp(rawCapturedAt);
  if (Number.isNaN(capturedAt.valueOf())) {
    throw new JacooGatewayError("JACOO_BAD_RESPONSE", "JACOO response timestamp is invalid.");
  }

  const now = config.now?.() ?? new Date();
  const ageMs = Math.max(0, now.valueOf() - capturedAt.valueOf());

  return {
    location: {
      latitude: assertNumber(body.sample.latitude, "sample.latitude"),
      longitude: assertNumber(body.sample.longitude, "sample.longitude"),
      accuracyMeters: assertNumber(body.sample.horizontal_accuracy_m, "sample.horizontal_accuracy_m"),
      capturedAt: normalizeCapturedAt(rawCapturedAt),
      coordinateSystem: "wgs84",
      source: "jacoo",
    },
    freshness: ageMs <= liveWindowMs ? "live" : "last_seen",
    ageMs,
  };
}
