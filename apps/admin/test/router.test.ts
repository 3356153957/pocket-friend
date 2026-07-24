import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createAdminRouter } from "../src/router.ts";
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
    assert.match(await page.text(), /设备在线状态/);

    const script = await route(new Request("http://localhost/assets/admin.js", { headers: authorized }));
    assert.equal(script.status, 200);
    assert.match(await script.text(), /api\/status/);
  });
});
