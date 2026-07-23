import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createMarkerSelectionHandlers } from "../src/map/mapInteraction.ts";

describe("createMarkerSelectionHandlers", () => {
  test("routes pointer selection through AMap and keyboard selection through the DOM", () => {
    const selectedPlayerIds: string[] = [];
    let stoppedEvents = 0;
    const handlers = createMarkerSelectionHandlers(
      "ada",
      (playerId) => selectedPlayerIds.push(playerId),
    );

    handlers.onDomClick({
      detail: 1,
      stopPropagation: () => {
        stoppedEvents += 1;
      },
    });
    assert.deepEqual(selectedPlayerIds, []);

    handlers.onMarkerClick();
    assert.deepEqual(selectedPlayerIds, ["ada"]);

    handlers.onDomClick({
      detail: 0,
      stopPropagation: () => {
        stoppedEvents += 1;
      },
    });
    assert.deepEqual(selectedPlayerIds, ["ada", "ada"]);
    assert.equal(stoppedEvents, 1);
  });
});
