import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, test } from "node:test";

import { createGatewayRouter } from "../src/router.ts";

const upstreamBody = {
  sample: {
    latitude: 30.289153,
    longitude: 120.008285,
    horizontal_accuracy_m: 68,
    timestamp: "2026-07-23T10:00:00",
  },
};

describe("Pocket Friend Gateway router", () => {
  test("stores an authenticated JPEG photo upload", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "pf-photo-upload-"));
    try {
      const route = createGatewayRouter({
        env: {
          PF_PHOTO_UPLOAD_DIR: uploadDir,
          PF_DEVICE_HEARTBEAT_TOKEN: "device-secret",
        },
        now: () => new Date("2026-07-24T21:30:12.000+08:00"),
      });
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02]);
      const response = await route(new Request("http://localhost/api/photos?deviceId=board-a", {
        method: "POST",
        headers: {
          Authorization: "Bearer device-secret",
          "Content-Type": "image/jpeg",
        },
        body: jpeg,
      }));

      assert.equal(response.status, 204);
      const storedPath = join(uploadDir, "board-a-20260724-213012.jpg");
      assert.equal((await stat(storedPath)).size, jpeg.byteLength);
      assert.deepEqual(new Uint8Array(await readFile(storedPath)), jpeg);
    } finally {
      await rm(uploadDir, { recursive: true, force: true });
    }
  });

  test("rejects unauthenticated photo uploads", async () => {
    const route = createGatewayRouter({
      env: {
        PF_DEVICE_HEARTBEAT_TOKEN: "device-secret",
      },
    });
    const response = await route(new Request("http://localhost/api/photos?deviceId=board-a", {
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg",
      },
      body: new Uint8Array([0xff, 0xd8, 0xff]),
    }));

    assert.equal(response.status, 401);
  });

  test("rejects photo uploads that are not JPEG", async () => {
    const route = createGatewayRouter({
      env: {
        PF_DEVICE_HEARTBEAT_TOKEN: "device-secret",
      },
    });
    const response = await route(new Request("http://localhost/api/photos?deviceId=board-a", {
      method: "POST",
      headers: {
        Authorization: "Bearer device-secret",
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array([0x01, 0x02]),
    }));

    assert.equal(response.status, 415);
  });

  test("serves a health check without external configuration", async () => {
    const route = createGatewayRouter({ env: {} });
    const response = await route(new Request("http://localhost/health"));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      service: "pocket-friend-gateway",
    });
  });

  test("does not expose JACOO when the feature is disabled", async () => {
    const route = createGatewayRouter({
      env: {
        PF_ENABLE_JACOO: "false",
        JACOO_BASE_URL: "https://jacoo.example",
        JACOO_API_KEY: "server-only-secret",
      },
    });
    const response = await route(
      new Request("http://localhost/api/location/jacoo/latest"),
    );

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: {
        code: "JACOO_DISABLED",
        message: "JACOO location bridge is disabled.",
      },
    });
  });

  test("returns a sanitized latest location and never returns credentials", async () => {
    const route = createGatewayRouter({
      env: {
        NODE_ENV: "development",
        PF_ENABLE_JACOO: "true",
        JACOO_BASE_URL: "https://jacoo.example",
        JACOO_API_KEY: "server-only-secret",
      },
      now: () => new Date("2026-07-23T10:01:30.000+08:00"),
      fetcher: async () => new Response(JSON.stringify(upstreamBody), { status: 200 }),
    });
    const response = await route(
      new Request("http://localhost/api/location/jacoo/latest"),
    );
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.equal(text.includes("server-only-secret"), false);
    assert.deepEqual(JSON.parse(text), {
      location: {
        latitude: 30.289153,
        longitude: 120.008285,
        accuracyMeters: 68,
        capturedAt: "2026-07-23T10:00:00.000+08:00",
        coordinateSystem: "wgs84",
        source: "jacoo",
      },
      freshness: "live",
      ageMs: 90_000,
    });
  });

  test("maps upstream failures to a sanitized gateway response", async () => {
    const route = createGatewayRouter({
      env: {
        NODE_ENV: "development",
        PF_ENABLE_JACOO: "true",
        JACOO_BASE_URL: "https://jacoo.example",
        JACOO_API_KEY: "server-only-secret",
      },
      fetcher: async () => new Response("upstream secret detail", { status: 500 }),
    });
    const response = await route(
      new Request("http://localhost/api/location/jacoo/latest"),
    );
    const text = await response.text();

    assert.equal(response.status, 502);
    assert.equal(text.includes("server-only-secret"), false);
    assert.equal(text.includes("upstream secret detail"), false);
    assert.deepEqual(JSON.parse(text), {
      error: {
        code: "JACOO_UPSTREAM_ERROR",
        message: "JACOO upstream returned HTTP 500.",
      },
    });
  });

  test("returns 404 for unknown routes", async () => {
    const route = createGatewayRouter({ env: {} });
    const response = await route(new Request("http://localhost/unknown"));

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    });
  });
});
