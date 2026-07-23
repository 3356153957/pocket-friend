import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { fetchJacooLatestLocation, JacooGatewayError } from "../src/jacoo.ts";

const apiResponse = {
  sample: {
    latitude: 30.289153,
    longitude: 120.008285,
    altitude_m: 10,
    horizontal_accuracy_m: 68,
    vertical_accuracy_m: 12,
    timestamp: "2026-07-23T10:00:00",
    source: "iPhone",
  },
};

describe("fetchJacooLatestLocation", () => {
  test("is disabled for production builds even when configured", async () => {
    await assert.rejects(
      () => fetchJacooLatestLocation({
        enabled: true,
        environment: "production",
        baseUrl: "https://117.72.82.29",
        apiKey: "secret-key",
        now: () => new Date("2026-07-23T10:01:00.000+08:00"),
      }),
      (error) => error instanceof JacooGatewayError && error.code === "JACOO_DISABLED",
    );
  });

  test("requires base URL and API key when enabled", async () => {
    await assert.rejects(
      () => fetchJacooLatestLocation({
        enabled: true,
        environment: "development",
        baseUrl: "",
        apiKey: "",
        now: () => new Date("2026-07-23T10:01:00.000+08:00"),
      }),
      (error) => error instanceof JacooGatewayError && error.code === "JACOO_MISSING_CONFIG",
    );
  });

  test("fetches JACOO latest location with runtime credentials and normalizes freshness", async () => {
    const calls: Array<{ input: string; headers?: HeadersInit }> = [];
    const fetcher = async (input: string | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ input: String(input), headers: init?.headers });
      return new Response(JSON.stringify(apiResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await fetchJacooLatestLocation({
      enabled: true,
      environment: "development",
      baseUrl: "https://117.72.82.29/",
      apiKey: "secret-key",
      now: () => new Date("2026-07-23T10:01:30.000+08:00"),
      fetcher,
    });

    assert.equal(calls[0].input, "https://117.72.82.29/api/jacoo/location/latest");
    assert.equal((calls[0].headers as Record<string, string>)["X-API-Key"], "secret-key");
    assert.deepEqual(result.location, {
      latitude: 30.289153,
      longitude: 120.008285,
      accuracyMeters: 68,
      capturedAt: "2026-07-23T10:00:00.000+08:00",
      coordinateSystem: "wgs84",
      source: "jacoo",
    });
    assert.equal(result.freshness, "live");
    assert.equal(result.ageMs, 90_000);
  });

  test("marks JACOO locations older than two minutes as last seen", async () => {
    const result = await fetchJacooLatestLocation({
      enabled: true,
      environment: "development",
      baseUrl: "https://117.72.82.29",
      apiKey: "secret-key",
      now: () => new Date("2026-07-23T10:03:01.000+08:00"),
      fetcher: async () => new Response(JSON.stringify(apiResponse), { status: 200 }),
    });

    assert.equal(result.freshness, "last_seen");
    assert.equal(result.ageMs, 181_000);
  });
});
