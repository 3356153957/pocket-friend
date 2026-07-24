import { createServer, type IncomingMessage, type Server } from "node:http";
import { pathToFileURL } from "node:url";
import { realpathSync } from "node:fs";

import {
  createAdminRouter,
  type AdminEnvironment,
  type AdminRouterOptions,
} from "./router.ts";
import { DeviceStatusRegistry } from "./status.ts";
import { LatestPhotoStore, MAX_PHOTO_BYTES } from "./photos.ts";
import { PhotoDownloadTokenStore } from "./photoDownloadTokens.ts";

const maxBodyBytes = MAX_PHOTO_BYTES;

export interface AdminServerOptions extends Partial<Omit<AdminRouterOptions, "env" | "registry">> {
  env?: AdminEnvironment;
  registry?: DeviceStatusRegistry;
  photos?: LatestPhotoStore;
}

async function readBody(request: IncomingMessage): Promise<Uint8Array | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function clientIp(incoming: IncomingMessage): string {
  const forwarded = incoming.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const first = forwarded[0];
    if (typeof first === "string") {
      const ip = first.split(",")[0];
      if (ip) return ip.trim();
    }
  }
  return incoming.socket.remoteAddress ?? "Unknown";
}

export function createAdminServer(options: AdminServerOptions = {}): Server {
  const env = options.env ?? process.env;
  const route = createAdminRouter({
    env,
    registry: options.registry ?? new DeviceStatusRegistry(),
    photos: options.photos ?? new LatestPhotoStore({
      directory: env.PF_PHOTO_UPLOAD_DIR ?? "/var/lib/pocket-friend-admin/photos",
    }),
    photoDownloadTokens: options.photoDownloadTokens ?? new PhotoDownloadTokenStore({
      file: env.PF_PHOTO_DOWNLOAD_TOKEN_FILE ?? "/srv/pocket-friend-admin/photo-download-token.json",
    }),
    ...(options.now ? { now: options.now } : {}),
  });

  return createServer(async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      headers.set("x-real-ip", clientIp(incoming));
      const host = incoming.headers.host ?? "127.0.0.1";
      const body = await readBody(incoming);
      const routed = await route(new Request(`http://${host}${incoming.url ?? "/"}`, {
        method: incoming.method ?? "GET",
        headers,
        ...(body ? { body } : {}),
      }));

      outgoing.statusCode = routed.status;
      routed.headers.forEach((value, name) => outgoing.setHeader(name, value));
      outgoing.end(Buffer.from(await routed.arrayBuffer()));
    } catch (error) {
      outgoing.statusCode = error instanceof Error && error.message === "REQUEST_TOO_LARGE" ? 413 : 500;
      outgoing.setHeader("Content-Type", "application/json; charset=utf-8");
      outgoing.end(JSON.stringify({ error: { code: "ADMIN_ERROR", message: "Admin request failed." } }));
    }
  });
}

export async function startAdminServer(options: AdminServerOptions = {}): Promise<Server> {
  const env = options.env ?? process.env;
  if (!env.PF_ADMIN_USERNAME || !env.PF_ADMIN_PASSWORD || !env.PF_DEVICE_HEARTBEAT_TOKEN) {
    throw new Error("PF_ADMIN_USERNAME, PF_ADMIN_PASSWORD and PF_DEVICE_HEARTBEAT_TOKEN are required.");
  }
  const configuredPort = Number.parseInt(env.ADMIN_PORT ?? "4311", 10);
  const port = Number.isFinite(configuredPort) ? configuredPort : 4311;
  const server = createAdminServer({ ...options, env });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, env.ADMIN_HOST ?? "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
  console.log(`Pocket Friend Admin listening on port ${port}.`);
  return server;
}

const entryPath = process.argv[1]
  ? pathToFileURL(realpathSync(process.argv[1])).href
  : "";
if (import.meta.url === entryPath) await startAdminServer();
