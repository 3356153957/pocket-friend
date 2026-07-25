import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getLocationBadge } from "../src/location/locationBadge.ts";

const point = {
  latitude: 30.28,
  longitude: 120.13,
  accuracyMeters: 20,
  capturedAt: "2026-07-24T00:00:00.000Z",
  source: "native" as const,
  coordinateSystem: "wgs84" as const,
};

describe("location badge", () => {
  test("does not claim GPS before a native location succeeds", () => {
    assert.equal(getLocationBadge({ loading: true, location: null, mode: "native" }), "定位中");
    assert.equal(getLocationBadge({ loading: false, location: null, mode: "native" }), "未定位");
  });

  test("labels successful native and simulated locations accurately", () => {
    assert.equal(getLocationBadge({ loading: false, location: point, mode: "native" }), "真实定位");
    assert.equal(getLocationBadge({ loading: false, location: point, mode: "simulated" }), "演示定位");
  });
});
