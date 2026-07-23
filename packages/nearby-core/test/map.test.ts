import assert from "node:assert/strict";
import test from "node:test";

import { HUPAN_PIXEL_MAP, projectToPixelMap } from "../src/map.ts";

test("contains the verified Hupan demo landmarks", () => {
  const names = HUPAN_PIXEL_MAP.landmarks.map((landmark) => landmark.name);

  assert.deepEqual(names, [
    "湖畔创研中心",
    "梦想小镇互联网村",
    "仓南广场 T1",
    "启行科创中心",
    "杭师大仓前校区",
  ]);
});

test("projects map bounds to the pixel canvas", () => {
  const northwest = projectToPixelMap(
    { latitude: HUPAN_PIXEL_MAP.bounds.north, longitude: HUPAN_PIXEL_MAP.bounds.west },
    HUPAN_PIXEL_MAP,
  );
  const southeast = projectToPixelMap(
    { latitude: HUPAN_PIXEL_MAP.bounds.south, longitude: HUPAN_PIXEL_MAP.bounds.east },
    HUPAN_PIXEL_MAP,
  );

  assert.deepEqual(northwest, { x: 0, y: 0, isOutOfBounds: false });
  assert.deepEqual(southeast, {
    x: HUPAN_PIXEL_MAP.width,
    y: HUPAN_PIXEL_MAP.height,
    isOutOfBounds: false,
  });
});

test("clamps out-of-bounds players to a visible map edge", () => {
  const projected = projectToPixelMap(
    { latitude: 30.31, longitude: 119.99 },
    HUPAN_PIXEL_MAP,
  );

  assert.deepEqual(projected, { x: 0, y: 0, isOutOfBounds: true });
});
