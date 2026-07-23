import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createSatelliteTiles } from "../src/satelliteTiles.ts";

describe("createSatelliteTiles", () => {
  test("creates a 3 by 3 satellite tile grid around Hupan without API keys", () => {
    const tiles = createSatelliteTiles({
      center: { latitude: 30.293312, longitude: 120.007986 },
      zoom: 17,
      tileSize: 256,
      gridSize: 3,
    });

    assert.equal(tiles.length, 9);
    assert.equal(tiles[4]?.left, 256);
    assert.equal(tiles[4]?.top, 256);
    assert.match(tiles[4]?.url ?? "", /^https:\/\/webst0[1-4]\.is\.autonavi\.com\/appmaptile\?/u);
    assert.match(tiles[4]?.url ?? "", /style=6/u);
    assert.doesNotMatch(tiles[4]?.url ?? "", /key=/u);
  });
});
