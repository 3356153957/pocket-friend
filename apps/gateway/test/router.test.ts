import assert from "node:assert/strict";
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
