import assert from "node:assert/strict";
import test from "node:test";

import { formatSharedDistance, negotiateDistancePrecision } from "../src/privacy.ts";

test("uses the more private distance precision", () => {
  assert.equal(negotiateDistancePrecision("100m", "500m"), "500m");
  assert.equal(negotiateDistancePrecision("1km", "region"), "region");
});

test("limits unmatched players to 500 meter precision", () => {
  assert.equal(negotiateDistancePrecision("100m", "100m", false), "500m");
});

test("formats distance without leaking raw coordinates", () => {
  assert.equal(formatSharedDistance(342, "100m"), "约 300 米");
  assert.equal(formatSharedDistance(342, "500m"), "约 500 米内");
  assert.equal(formatSharedDistance(1_320, "1km"), "约 2 公里内");
  assert.equal(formatSharedDistance(1_320, "region"), "同一区域");
});
