import assert from "node:assert/strict";
import test from "node:test";

import { haversineMeters, wgs84ToGcj02 } from "../src/geo.ts";

test("converts a Hangzhou WGS84 point to GCJ-02", () => {
  const converted = wgs84ToGcj02({ latitude: 30.293312, longitude: 120.007986 });

  assert.equal(converted.coordinateSystem, "gcj02");
  assert.ok(converted.latitude > 30.290 && converted.latitude < 30.2925);
  assert.ok(converted.longitude > 120.012 && converted.longitude < 120.0135);
});

test("does not offset points outside China", () => {
  const converted = wgs84ToGcj02({ latitude: 51.5074, longitude: -0.1278 });

  assert.equal(converted.latitude, 51.5074);
  assert.equal(converted.longitude, -0.1278);
});

test("calculates great-circle distance in meters", () => {
  assert.equal(haversineMeters(
    { latitude: 30.293312, longitude: 120.007986 },
    { latitude: 30.293312, longitude: 120.007986 },
  ), 0);

  const distance = haversineMeters(
    { latitude: 30, longitude: 120 },
    { latitude: 31, longitude: 120 },
  );
  assert.ok(distance > 111_000 && distance < 111_300);
});
