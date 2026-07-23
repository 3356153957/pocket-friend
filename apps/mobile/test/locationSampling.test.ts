import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { GeoPoint } from "../../../packages/nearby-core/src/index.ts";
import {
  LOCATION_EMPTY_TIMEOUT_MESSAGE,
  LOCATION_SAMPLE_TIMEOUT_MS,
  LOCATION_TARGET_ACCURACY_METERS,
  formatLocationAccuracy,
  hasReachedTargetAccuracy,
  selectBestLocationSample,
  toNativeGeoPoint,
} from "../src/location/locationSampling.ts";

const point = (accuracyMeters: number): GeoPoint => ({
  latitude: 30.293312,
  longitude: 120.007986,
  accuracyMeters,
  capturedAt: "2026-07-23T10:00:00.000Z",
  coordinateSystem: "wgs84",
  source: "native",
});

describe("browser location sampling", () => {
  test("uses the first sample and only replaces it with a more accurate sample", () => {
    const first = point(120);
    const better = point(24);
    const worse = point(80);

    assert.equal(selectBestLocationSample(null, first), first);
    assert.equal(selectBestLocationSample(first, better), better);
    assert.equal(selectBestLocationSample(better, worse), better);
  });

  test("finishes early at the target accuracy", () => {
    assert.equal(LOCATION_TARGET_ACCURACY_METERS, 30);
    assert.equal(LOCATION_SAMPLE_TIMEOUT_MS, 15_000);
    assert.equal(hasReachedTargetAccuracy(point(30)), true);
    assert.equal(hasReachedTargetAccuracy(point(31)), false);
  });

  test("normalizes a browser sample as native WGS84 data", () => {
    assert.deepEqual(toNativeGeoPoint({
      coords: {
        latitude: 30.293312,
        longitude: 120.007986,
        accuracy: 42.4,
      },
      timestamp: Date.parse("2026-07-23T10:00:00.000Z"),
    }), point(42.4));
  });

  test("reports the real accuracy and warns for a coarse sample", () => {
    assert.equal(
      formatLocationAccuracy(point(42.4), "complete"),
      "网页定位完成 · 定位精度 ±42 米",
    );
    assert.equal(
      formatLocationAccuracy(point(680), "complete"),
      "网页定位完成 · 定位精度 ±680 米 · 当前浏览器仅提供粗略位置",
    );
    assert.equal(
      formatLocationAccuracy(point(80), "sampling"),
      "正在提高定位精度 · 当前 ±80 米",
    );
  });

  test("defines a clear timeout message when no sample arrives", () => {
    assert.equal(
      LOCATION_EMPTY_TIMEOUT_MESSAGE,
      "暂时无法获取位置，请检查浏览器定位权限",
    );
  });
});
