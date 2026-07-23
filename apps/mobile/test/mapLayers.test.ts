import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  DEFAULT_MAP_LAYER_MODE,
  MAP_LAYER_FALLBACK_MESSAGE,
  applyMapLayerMode,
  createMapLayerRegistry,
  getMapLayerKeys,
  getMapLayerToggleLabel,
  toggleMapLayerMode,
} from "../src/map/mapLayers.ts";

describe("map layer mode", () => {
  test("defaults to satellite with road labels", () => {
    assert.equal(DEFAULT_MAP_LAYER_MODE, "satellite");
    assert.deepEqual(
      getMapLayerKeys(DEFAULT_MAP_LAYER_MODE),
      ["satellite", "roadnet"],
    );
  });

  test("uses only the standard layer in standard mode", () => {
    assert.deepEqual(getMapLayerKeys("standard"), ["standard"]);
  });

  test("toggles between satellite and standard modes", () => {
    assert.equal(toggleMapLayerMode("satellite"), "standard");
    assert.equal(toggleMapLayerMode("standard"), "satellite");
  });

  test("labels the button with the target layer mode", () => {
    assert.equal(getMapLayerToggleLabel("satellite"), "切换到标准地图");
    assert.equal(getMapLayerToggleLabel("standard"), "切换到卫星地图");
  });

  test("keeps the standard layer when satellite layer creation fails", () => {
    const registry = createMapLayerRegistry({
      createStandard: () => "standard",
      createSatellite: () => {
        throw new Error("satellite unavailable");
      },
      createRoadnet: () => "roadnet",
    });

    assert.deepEqual(registry, { standard: "standard" });
  });

  test("falls back to the standard layer when satellite switching fails", () => {
    const layerCalls: string[][] = [];
    const map = {
      setLayers(layers: string[]) {
        layerCalls.push(layers);
        if (layers.includes("satellite")) {
          throw new Error("satellite unavailable");
        }
      },
    };

    const result = applyMapLayerMode(map, {
      standard: "standard",
      satellite: "satellite",
      roadnet: "roadnet",
    }, "satellite");

    assert.deepEqual(layerCalls, [
      ["satellite", "roadnet"],
      ["standard"],
    ]);
    assert.deepEqual(result, {
      mode: "standard",
      errorMessage: MAP_LAYER_FALLBACK_MESSAGE,
    });
  });
});
