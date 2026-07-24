import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { GatewayEnvironment } from "./router.ts";

export interface StorePhotoOptions {
  env: GatewayEnvironment;
  now?: () => Date;
}

const defaultUploadDir = "/opt/pocket-friend/uploads/photos";
const deviceIdPattern = /^board-[a-z0-9-]{1,32}$/u;

function jsonError(code: string, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function shanghaiTimestamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${value("year")}${value("month")}${value("day")}-${value("hour")}${value("minute")}${value("second")}`;
}

function authorized(request: Request, token: string): boolean {
  return request.headers.get("Authorization") === `Bearer ${token}`;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
}

export async function storePhotoUpload(
  request: Request,
  options: StorePhotoOptions,
): Promise<Response> {
  const token = options.env.PF_DEVICE_HEARTBEAT_TOKEN ?? "";
  if (!token || !authorized(request, token)) {
    return jsonError("UNAUTHORIZED", "Photo upload is not authorized.", 401);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().startsWith("image/jpeg")) {
    return jsonError("UNSUPPORTED_MEDIA_TYPE", "Photo upload must be image/jpeg.", 415);
  }

  const url = new URL(request.url);
  const deviceId = url.searchParams.get("deviceId") ?? "";
  if (!deviceIdPattern.test(deviceId)) {
    return jsonError("BAD_DEVICE_ID", "Photo upload deviceId is invalid.", 400);
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!isJpeg(bytes)) {
    return jsonError("BAD_JPEG", "Photo upload body is not a JPEG image.", 400);
  }

  const uploadDir = options.env.PF_PHOTO_UPLOAD_DIR ?? defaultUploadDir;
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, `${deviceId}-${shanghaiTimestamp(options.now?.() ?? new Date())}.jpg`), bytes);

  return new Response(null, { status: 204 });
}
