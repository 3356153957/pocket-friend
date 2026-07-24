import { createHash, timingSafeEqual } from "node:crypto";

import { adminCss, adminHtml, adminJavaScript } from "./assets.ts";
import {
  DeviceStatusRegistry,
  type DeviceId,
  type Heartbeat,
} from "./status.ts";

export type AdminEnvironment = Record<string, string | undefined>;
export type AdminRouter = (request: Request) => Promise<Response>;

export interface AdminRouterOptions {
  env: AdminEnvironment;
  registry: DeviceStatusRegistry;
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
  return async (request) => {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "pocket-friend-admin" });
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
      } else {
        const expected = options.env.PF_DEVICE_HEARTBEAT_TOKEN;
        const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/u, "") ?? "";
        if (!expected || !supplied || !constantTimeEqual(supplied, expected)) return unauthorized();
      }

      options.registry.record(heartbeat, now());
      const result = response(null, 204, "text/plain; charset=utf-8");
      if (origin) {
        result.headers.set("Access-Control-Allow-Origin", origin);
        result.headers.set("Vary", "Origin");
      }
      return result;
    }

    if (!isAdminAuthorized(request, options.env)) return unauthorized();

    if (request.method !== "GET" && request.method !== "HEAD") {
      const result = json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } }, 405);
      result.headers.set("Allow", "GET, HEAD");
      return result;
    }

    if (url.pathname === "/api/status") {
      return json(options.registry.snapshot(now()));
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return response(request.method === "HEAD" ? null : adminHtml, 200, "text/html; charset=utf-8");
    }
    if (url.pathname === "/assets/admin.css") {
      return response(request.method === "HEAD" ? null : adminCss, 200, "text/css; charset=utf-8");
    }
    if (url.pathname === "/assets/admin.js") {
      return response(request.method === "HEAD" ? null : adminJavaScript, 200, "text/javascript; charset=utf-8");
    }
    return json({ error: { code: "NOT_FOUND", message: "Route not found." } }, 404);
  };
}
