import assert from "node:assert/strict";
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
