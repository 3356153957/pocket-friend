import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createAdminRouter } from "../src/router.ts";
import type { LatestPhotoStore } from "../src/photos.ts";
import { DeviceStatusRegistry } from "../src/status.ts";

const credentials = Buffer.from("operator:correct-horse").toString("base64");
const env = {
  PF_ADMIN_USERNAME: "operator",
  PF_ADMIN_PASSWORD: "correct-horse",
  PF_DEVICE_HEARTBEAT_TOKEN: "board-secret",
};

describe("admin router", () => {
  test("keeps health public but protects the page and status API", async () => {
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry() });

    assert.equal((await route(new Request("http://localhost/health"))).status, 200);
    const page = await route(new Request("http://localhost/"));
    assert.equal(page.status, 401);
    assert.match(page.headers.get("www-authenticate") ?? "", /Basic/);

    const status = await route(new Request("http://localhost/api/status", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    assert.equal(status.status, 200);
    assert.equal((await status.json()).devices.length, 3);
  });

  test("accepts authenticated board heartbeats and rejects a bad token", async () => {
    let now = 10_000;
    const registry = new DeviceStatusRegistry();
    const route = createAdminRouter({ env, registry, now: () => now });
    const request = (token: string) => new Request("http://localhost/api/heartbeat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId: "board-b",
        firmwareVersion: "0.4.0",
        batteryPercent: 78,
      }),
    });

    assert.equal((await route(request("wrong"))).status, 401);
    assert.equal((await route(request("board-secret"))).status, 204);
    now = 20_000;
    const board = registry.snapshot(now).devices[2];
    assert.equal(board?.online, true);
    assert.equal(board?.batteryPercent, 78);
  });

  test("stores an authenticated board JPEG and serves the latest photo to admins", async () => {
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry(), now: () => 10_000 });
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);

    const upload = await route(new Request("http://localhost/api/photos?deviceId=board-a", {
      method: "POST",
      headers: {
        Authorization: "Bearer board-secret",
        "Content-Type": "image/jpeg",
      },
      body: jpeg,
    }));
    assert.equal(upload.status, 204);

    const photo = await route(new Request("http://localhost/api/photos/board-a/latest", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get("content-type"), "image/jpeg");
    assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), jpeg);
  });

  test("lists archived board A photos for the admin history view", async () => {
    let now = 10_000;
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry(), now: () => now });
    const uploadPhoto = (marker: number, name?: string) => route(new Request(
      `http://localhost/api/photos?deviceId=board-a${name ? `&name=${encodeURIComponent(name)}` : ""}`,
      {
      method: "POST",
      headers: {
        Authorization: "Bearer board-secret",
        "Content-Type": "image/jpeg",
      },
      body: Uint8Array.from([0xff, 0xd8, marker, 0xff, 0xd9]),
      },
    ));

    assert.equal((await uploadPhoto(0x01)).status, 204);
    now = 20_000;
    assert.equal((await uploadPhoto(0x02, "阿狸")).status, 204);

    const history = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    assert.equal(history.status, 200);
    const body = await history.json() as { photos: Array<{ id: string; capturedAt: string; bytes: number; url: string; name?: string }> };
    assert.deepEqual(body.photos.map(({ bytes }) => bytes), [5, 5]);
    assert.deepEqual(body.photos.map(({ capturedAt }) => capturedAt), [
      new Date(20_000).toISOString(),
      new Date(10_000).toISOString(),
    ]);
    assert.equal(body.photos[0]?.name, "阿狸");
    assert.match(body.photos[0]?.url ?? "", /^\/api\/photos\/board-a\/history\//);

    const archived = await route(new Request(`http://localhost${body.photos[0]?.url}`, {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    assert.equal(archived.status, 200);
    assert.deepEqual(new Uint8Array(await archived.arrayBuffer()), Uint8Array.from([0xff, 0xd8, 0x02, 0xff, 0xd9]));
  });

  test("serves current and historical photos to the island through the 4311 read-only API", async () => {
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry(), now: () => 10_000 });
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x04, 0xff, 0xd9]);
    await route(new Request("http://localhost/api/photos?deviceId=board-a&name=%E5%B0%8F%E6%98%8E_2", {
      method: "POST",
      headers: {
        Authorization: "Bearer board-secret",
        "Content-Type": "image/jpeg",
      },
      body: jpeg,
    }));

    const origin = "http://localhost:4320";
    const history = await route(new Request("http://localhost:4311/island-photo-api/api/photos/board-a/history", {
      headers: { Origin: origin },
    }));
    assert.equal(history.status, 200);
    assert.equal(history.headers.get("access-control-allow-origin"), origin);
    const body = await history.json() as { photos: Array<{ url: string; name?: string }> };
    assert.equal(body.photos[0]?.name, "小明_2");

    const archived = await route(new Request(`http://localhost:4311/island-photo-api${body.photos[0]?.url}`, {
      headers: { Origin: origin },
    }));
    assert.equal(archived.status, 200);
    assert.deepEqual(new Uint8Array(await archived.arrayBuffer()), jpeg);

    const latest = await route(new Request("http://localhost:4311/island-photo-api/api/photos/board-a/latest", {
      headers: { Origin: origin },
    }));
    assert.equal(latest.status, 200);
    assert.deepEqual(new Uint8Array(await latest.arrayBuffer()), jpeg);
  });

  test("serves Seedream pixel avatar generation through the 4311 island API", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const route = createAdminRouter({
      env: {
        ...env,
        DOUBAO_API_KEY: "server-only-seedream-secret",
        DOUBAO_MODEL: "seedream-test-model",
      },
      registry: new DeviceStatusRegistry(),
      seedreamFetch: async (input, init) => {
        calls.push({ input: input.toString(), ...(init ? { init } : {}) });
        if (calls.length === 1) {
          return new Response(JSON.stringify({
            data: [{ url: "https://images.example/avatar.png" }],
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      },
    });

    const response = await route(new Request("http://localhost:4311/island-avatar-api/generate", {
      method: "POST",
      headers: {
        Origin: "http://localhost:4320",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: "data:image/jpeg;base64,cGhvdG8=" }),
    }));
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:4320");
    assert.equal(text.includes("server-only-seedream-secret"), false);
    assert.deepEqual(JSON.parse(text), {
      data: [{ b64_json: "iVBORw==" }],
      model: "seedream-test-model",
    });
    assert.equal(new Headers(calls[0]?.init?.headers).get("Authorization"), "Bearer server-only-seedream-secret");
  });

  test("accepts legacy Vite Seedream env names through the 4311 island API", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const route = createAdminRouter({
      env: {
        ...env,
        VITE_DOUBAO_API_KEY: "legacy-vite-seedream-secret",
        VITE_DOUBAO_MODEL: "legacy-vite-seedream-model",
      },
      registry: new DeviceStatusRegistry(),
      seedreamFetch: async (input, init) => {
        calls.push({ input: input.toString(), ...(init ? { init } : {}) });
        if (calls.length === 1) {
          return new Response(JSON.stringify({
            data: [{ url: "https://images.example/avatar.png" }],
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        });
      },
    });

    const response = await route(new Request("http://localhost:4311/island-avatar-api/generate", {
      method: "POST",
      headers: {
        Origin: "http://localhost:4320",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image: "data:image/jpeg;base64,cGhvdG8=" }),
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: [{ b64_json: "iVBORw==" }],
      model: "legacy-vite-seedream-model",
    });
    assert.equal(new Headers(calls[0]?.init?.headers).get("Authorization"), "Bearer legacy-vite-seedream-secret");
    const upstreamRequest = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    assert.equal(upstreamRequest.model, "legacy-vite-seedream-model");
  });

  test("uses the newest historical photo when the separate current file is missing", async () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x05, 0xff, 0xd9]);
    const archived = {
      id: "latest-history.jpg",
      capturedAt: new Date(10_000).toISOString(),
      bytes: jpeg,
      name: "当前照片",
    };
    const photos = {
      get: async () => undefined,
      listHistory: async () => [{
        id: archived.id,
        capturedAt: archived.capturedAt,
        bytes: archived.bytes.byteLength,
        name: archived.name,
      }],
      getHistoryPhoto: async () => archived,
    } as unknown as LatestPhotoStore;
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry(), photos });

    const latest = await route(new Request("http://localhost:4311/island-photo-api/api/photos/board-a/latest", {
      headers: { Origin: "http://localhost:4320" },
    }));
    assert.equal(latest.status, 200);
    assert.deepEqual(new Uint8Array(await latest.arrayBuffer()), jpeg);
  });

  test("extracts uploaded photo names from firmware filename query parameters", async () => {
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry(), now: () => 10_000 });
    const upload = await route(new Request(
      "http://localhost/api/photos?deviceId=board-a&filename=%E9%98%BF%E7%8B%B8_20260725_035451.jpg",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer board-secret",
          "Content-Type": "image/jpeg",
        },
        body: Uint8Array.from([0xff, 0xd8, 0x01, 0xff, 0xd9]),
      },
    ));
    assert.equal(upload.status, 204);

    const history = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    assert.equal(history.status, 200);
    const body = await history.json() as { photos: Array<{ name?: string }> };
    assert.equal(body.photos[0]?.name, "阿狸");
  });

  test("allows a dedicated photo download token to read photos only", async () => {
    let now = 10_000;
    const route = createAdminRouter({
      env: {
        ...env,
        PF_PHOTO_DOWNLOAD_TOKEN: "photo-read-secret",
      },
      registry: new DeviceStatusRegistry(),
      now: () => now,
    });
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x03, 0xff, 0xd9]);

    assert.equal((await route(new Request("http://localhost/api/photos?deviceId=board-a", {
      method: "POST",
      headers: {
        Authorization: "Bearer board-secret",
        "Content-Type": "image/jpeg",
      },
      body: jpeg,
    }))).status, 204);

    const history = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: "Bearer photo-read-secret" },
    }));
    assert.equal(history.status, 200);
    const body = await history.json() as { photos: Array<{ url: string }> };

    const downloaded = await route(new Request(`http://localhost${body.photos[0]?.url}`, {
      headers: { Authorization: "Bearer photo-read-secret" },
    }));
    assert.equal(downloaded.status, 200);
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), jpeg);

    const status = await route(new Request("http://localhost/api/status", {
      headers: { Authorization: "Bearer photo-read-secret" },
    }));
    assert.equal(status.status, 401);

    const deviceTokenDownload = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: "Bearer board-secret" },
    }));
    assert.equal(deviceTokenDownload.status, 401);
  });

  test("accepts the legacy photo token env name for read-only photo access", async () => {
    const route = createAdminRouter({
      env: {
        ...env,
        PF_PHOTO_TOKEN: "legacy-photo-read-secret",
      },
      registry: new DeviceStatusRegistry(),
      now: () => 10_000,
    });
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x03, 0xff, 0xd9]);

    assert.equal((await route(new Request("http://localhost/api/photos?deviceId=board-a", {
      method: "POST",
      headers: {
        Authorization: "Bearer board-secret",
        "Content-Type": "image/jpeg",
      },
      body: jpeg,
    }))).status, 204);

    const history = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: "Bearer legacy-photo-read-secret" },
    }));
    assert.equal(history.status, 200);
    const body = await history.json() as { photos: Array<{ url: string }> };

    const downloaded = await route(new Request(`http://localhost${body.photos[0]?.url}`, {
      headers: { Authorization: "Bearer legacy-photo-read-secret" },
    }));
    assert.equal(downloaded.status, 200);
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), jpeg);
  });

  test("lets admins delete archived photos without granting deletion to download tokens", async () => {
    const route = createAdminRouter({
      env: {
        ...env,
        PF_PHOTO_DOWNLOAD_TOKEN: "photo-read-secret",
      },
      registry: new DeviceStatusRegistry(),
      now: () => 10_000,
    });
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x04, 0xff, 0xd9]);

    assert.equal((await route(new Request("http://localhost/api/photos?deviceId=board-a&name=达海", {
      method: "POST",
      headers: {
        Authorization: "Bearer board-secret",
        "Content-Type": "image/jpeg",
      },
      body: jpeg,
    }))).status, 204);

    const history = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    const body = await history.json() as { photos: Array<{ url: string }> };
    const url = body.photos[0]?.url ?? "";

    assert.equal((await route(new Request(`http://localhost${url}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer photo-read-secret" },
    }))).status, 401);

    const downloaded = await route(new Request(`http://localhost${url}`, {
      headers: { Authorization: "Bearer photo-read-secret" },
    }));
    assert.equal(downloaded.status, 200);
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), jpeg);

    const deleted = await route(new Request(`http://localhost${url}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${credentials}` },
    }));
    assert.equal(deleted.status, 204);
    assert.equal((await route(new Request(`http://localhost${url}`, {
      headers: { Authorization: `Basic ${credentials}` },
    }))).status, 404);

    const latest = await route(new Request("http://localhost/api/photos/board-a/latest", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    assert.equal(latest.status, 404);
  });

  test("lets admins rename archived photos without granting mutation to download tokens", async () => {
    const route = createAdminRouter({
      env: {
        ...env,
        PF_PHOTO_DOWNLOAD_TOKEN: "photo-read-secret",
      },
      registry: new DeviceStatusRegistry(),
      now: () => 10_000,
    });
    const jpeg = Uint8Array.from([0xff, 0xd8, 0x05, 0xff, 0xd9]);

    assert.equal((await route(new Request("http://localhost/api/photos?deviceId=board-a&name=达海", {
      method: "POST",
      headers: {
        Authorization: "Bearer board-secret",
        "Content-Type": "image/jpeg",
      },
      body: jpeg,
    }))).status, 204);

    const history = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    const body = await history.json() as { photos: Array<{ url: string }> };
    const url = body.photos[0]?.url ?? "";

    assert.equal((await route(new Request(`http://localhost${url}`, {
      method: "PATCH",
      headers: {
        Authorization: "Bearer photo-read-secret",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "阿狸" }),
    }))).status, 401);

    const renamed = await route(new Request(`http://localhost${url}`, {
      method: "PATCH",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: " 阿狸 " }),
    }));
    assert.equal(renamed.status, 200);
    const renamedBody = await renamed.json() as { id: string; name: string; url: string };
    assert.equal(renamedBody.name, "阿狸");
    assert.match(renamedBody.id, /^阿狸-/u);
    assert.notEqual(renamedBody.url, url);

    const listed = await route(new Request("http://localhost/api/photos/board-a/history", {
      headers: { Authorization: `Basic ${credentials}` },
    }));
    const listedBody = await listed.json() as { photos: Array<{ name?: string; url: string }> };
    assert.equal(listedBody.photos[0]?.name, "阿狸");
    assert.equal(listedBody.photos[0]?.url, renamedBody.url);

    const downloaded = await route(new Request(`http://localhost${renamedBody.url}`, {
      headers: { Authorization: "Bearer photo-read-secret" },
    }));
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("x-photo-name"), encodeURIComponent("阿狸"));
    assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), jpeg);
  });

  test("lets an admin generate a persisted photo download token", async () => {
    const route = createAdminRouter({
      env,
      registry: new DeviceStatusRegistry(),
      now: () => 10_000,
    });
    const generated = await route(new Request("http://localhost/api/photo-download-token", {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    }));

    assert.equal(generated.status, 201);
    const body = await generated.json() as { token: string; createdAt: string };
    assert.equal(body.token.length, 64);
    assert.equal(body.createdAt, new Date(10_000).toISOString());

    const unauthorized = await route(new Request("http://localhost/api/photo-download-token", {
      method: "POST",
      headers: { Authorization: "Bearer board-secret" },
    }));
    assert.equal(unauthorized.status, 401);
  });

  test("rejects unauthenticated, invalid, and non-JPEG photo uploads", async () => {
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry() });
    const upload = (url: string, token: string, contentType: string, body: Uint8Array) =>
      route(new Request(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body,
      }));

    assert.equal((await upload(
      "http://localhost/api/photos?deviceId=board-a",
      "wrong",
      "image/jpeg",
      Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
    )).status, 401);
    assert.equal((await upload(
      "http://localhost/api/photos?deviceId=web",
      "board-secret",
      "image/jpeg",
      Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
    )).status, 400);
    assert.equal((await upload(
      "http://localhost/api/photos?deviceId=board-a",
      "board-secret",
      "application/octet-stream",
      Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
    )).status, 415);
    assert.equal((await upload(
      "http://localhost/api/photos?deviceId=board-a",
      "board-secret",
      "image/jpeg",
      Uint8Array.from([0x00, 0x01]),
    )).status, 400);
  });

  test("accepts web heartbeats only from the same public hostname", async () => {
    const registry = new DeviceStatusRegistry();
    const route = createAdminRouter({ env, registry, now: () => 10_000 });
    const heartbeat = (origin: string) => new Request("http://status.example:4311/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ deviceId: "web", clientId: "browser-one" }),
    });

    assert.equal((await route(heartbeat("https://evil.example"))).status, 403);
    const accepted = await route(heartbeat("http://status.example"));
    assert.equal(accepted.status, 204);
    assert.equal(accepted.headers.get("access-control-allow-origin"), "http://status.example");
    assert.equal(registry.snapshot(10_001).devices[0]?.sessions.length, 1);
  });

  test("serves self-contained admin assets after authentication", async () => {
    const route = createAdminRouter({ env, registry: new DeviceStatusRegistry() });
    const authorized = { Authorization: `Basic ${credentials}` };

    const page = await route(new Request("http://localhost/", { headers: authorized }));
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /设备在线状态/);
    assert.match(html, /最新拍照/);
    assert.doesNotMatch(html, /开发板 B/);

    const script = await route(new Request("http://localhost/assets/admin.js", { headers: authorized }));
    assert.equal(script.status, 200);
    const javascript = await script.text();
    assert.match(javascript, /api\/status/);
    assert.match(javascript, /api\/photos\/board-a\/latest/);
    assert.match(javascript, /api\/photos\/board-a\/history/);
    assert.doesNotMatch(javascript, /api\/photos\/board-b\/latest/);
    assert.match(javascript, /rotate-180/);
    assert.match(javascript, /photo-name/);
    assert.match(javascript, /上传于/);
    assert.match(javascript, /DELETE/);
    assert.match(javascript, /删除照片/);
    assert.match(javascript, /PATCH/);
    assert.match(javascript, /重命名/);
  });
});
