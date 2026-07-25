import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, test } from "node:test";

import { InMemoryProductStore } from "../src/productStore.ts";
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
  test("allows product writes and authenticated photo uploads through CORS", async () => {
    const route = createGatewayRouter({ env: {} });
    const response = await route(new Request("http://localhost/api/product/profiles", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:8081",
        "Access-Control-Request-Headers": "authorization, content-type",
        "Access-Control-Request-Method": "POST",
      },
    }));

    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("Access-Control-Allow-Methods"),
      "GET, POST, PUT, PATCH, OPTIONS",
    );
    assert.equal(
      response.headers.get("Access-Control-Allow-Headers"),
      "Authorization, Content-Type",
    );
  });

  test("adds CORS headers to actual photo upload responses", async () => {
    const route = createGatewayRouter({
      env: {
        PF_ALLOWED_ORIGIN: "https://app.example",
        PF_DEVICE_HEARTBEAT_TOKEN: "device-secret",
      },
    });
    const response = await route(new Request("http://localhost/api/photos?deviceId=board-a", {
      method: "POST",
      headers: {
        Origin: "https://app.example",
        "Content-Type": "image/jpeg",
      },
      body: new Uint8Array([0xff, 0xd8, 0xff]),
    }));

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://app.example");
  });

  test("requires a server-side product token in production", async () => {
    const missingConfigRoute = createGatewayRouter({ env: { NODE_ENV: "production" } });
    const missingConfig = await missingConfigRoute(new Request("http://localhost/api/product/scenes"));
    assert.equal(missingConfig.status, 503);

    const route = createGatewayRouter({
      env: {
        NODE_ENV: "production",
        PF_PRODUCT_API_TOKEN: "product-secret",
      },
    });
    const unauthorized = await route(new Request("http://localhost/api/product/scenes"));
    const authorized = await route(new Request("http://localhost/api/product/scenes", {
      headers: { Authorization: "Bearer product-secret" },
    }));

    assert.equal(unauthorized.status, 401);
    assert.equal(authorized.status, 200);
  });

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

  test("serves product scenes from the product store", async () => {
    const route = createGatewayRouter({
      env: {},
      productStore: new InMemoryProductStore(),
    });
    const response = await route(new Request("http://localhost/api/product/scenes"));
    const payload = await response.json() as { scenes: Array<{ id: string; assetUrl: string }> };

    assert.equal(response.status, 200);
    assert.equal(payload.scenes.length, 4);
    assert.equal(payload.scenes.every((scene) => scene.assetUrl.startsWith("/assets/scenes/")), true);
  });

  test("rejects avatar generation when Seedream server credentials are missing", async () => {
    const route = createGatewayRouter({ env: {} });
    const response = await route(new Request("http://localhost/api/avatar/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/jpeg;base64,cGhvdG8=" }),
    }));

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: {
        code: "SEEDREAM_MISSING_CONFIG",
        message: "Seedream generation is not configured.",
      },
    });
  });

  test("keeps the Seedream API key server-side and returns an embeddable image", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const route = createGatewayRouter({
      env: {
        DOUBAO_API_KEY: "server-only-seedream-secret",
        DOUBAO_MODEL: "seedream-test-model",
      },
      fetcher: async (input, init) => {
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
    const response = await route(new Request("http://localhost/api/avatar/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/jpeg;base64,cGhvdG8=" }),
    }));
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.equal(text.includes("server-only-seedream-secret"), false);
    assert.deepEqual(JSON.parse(text), {
      data: [{ b64_json: "iVBORw==" }],
      model: "seedream-test-model",
    });
    assert.equal(calls.length, 2);
    assert.equal(
      calls[0]?.input,
      "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    );
    assert.equal(new Headers(calls[0]?.init?.headers).get("Authorization"), "Bearer server-only-seedream-secret");
    const upstreamRequest = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    assert.equal(upstreamRequest.model, "seedream-test-model");
    assert.match(String(upstreamRequest.prompt), /MapleStory-style 2D pixel art/);
    assert.deepEqual({ ...upstreamRequest, model: undefined, prompt: undefined }, {
      model: undefined,
      prompt: undefined,
      image: "data:image/jpeg;base64,cGhvdG8=",
      sequential_image_generation: "disabled",
      size: "2K",
      response_format: "url",
      stream: false,
      watermark: false,
    });
    assert.equal(calls[1]?.input, "https://images.example/avatar.png");
  });

  test("accepts legacy Vite Seedream env names for avatar generation", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const route = createGatewayRouter({
      env: {
        VITE_DOUBAO_API_KEY: "legacy-vite-seedream-secret",
        VITE_DOUBAO_MODEL: "legacy-vite-seedream-model",
      },
      fetcher: async (input, init) => {
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
    const response = await route(new Request("http://localhost/api/avatar/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  test("rejects untrusted Seedream endpoints and private generated image URLs", async () => {
    const untrustedEndpointRoute = createGatewayRouter({
      env: {
        DOUBAO_API_KEY: "server-only-secret",
        DOUBAO_ENDPOINT: "https://evil.example/images/generations",
      },
    });
    const untrustedEndpoint = await untrustedEndpointRoute(new Request("http://localhost/api/avatar/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/jpeg;base64,cGhvdG8=" }),
    }));

    let calls = 0;
    const privateImageRoute = createGatewayRouter({
      env: { DOUBAO_API_KEY: "server-only-secret" },
      fetcher: async () => {
        calls += 1;
        return new Response(JSON.stringify({ data: [{ url: "https://127.0.0.1/private.png" }] }));
      },
    });
    const privateImage = await privateImageRoute(new Request("http://localhost/api/avatar/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: "data:image/jpeg;base64,cGhvdG8=" }),
    }));

    assert.equal(untrustedEndpoint.status, 503);
    assert.equal(privateImage.status, 502);
    assert.equal(calls, 1);
  });

  test("persists product profiles and residents", async () => {
    const productStore = new InMemoryProductStore();
    const route = createGatewayRouter({ env: {}, productStore });
    const profileResponse = await route(new Request("http://localhost/api/product/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Luna",
        role: "designer",
        bio: "pixel resident",
      }),
    }));
    const profilePayload = await profileResponse.json() as { profile: { id: string; name: string } };

    assert.equal(profileResponse.status, 200);
    assert.equal(profilePayload.profile.name, "Luna");

    const residentResponse = await route(new Request("http://localhost/api/product/residents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "resident-luna",
        profileId: profilePayload.profile.id,
        name: "Luna",
        magnetType: "好奇选手",
        tags: ["项目共创", "demo"],
        portraitUrl: "data:image/png;base64,real",
        pixelPortraitUrl: "data:image/png;base64,pixel",
        activeSceneId: "venture-center",
      }),
    }));
    const residentPayload = await residentResponse.json() as { resident: { id: string; activeSceneId: string } };

    assert.equal(residentResponse.status, 200);
    assert.equal(residentPayload.resident.id, "resident-luna");
    assert.equal(residentPayload.resident.activeSceneId, "venture-center");

    const listResponse = await route(new Request("http://localhost/api/product/residents?sceneId=venture-center"));
    const listPayload = await listResponse.json() as { residents: Array<{ id: string; name: string }> };

    assert.equal(listResponse.status, 200);
    assert.deepEqual(listPayload.residents.map((resident) => resident.id), ["resident-luna"]);
  });
});
