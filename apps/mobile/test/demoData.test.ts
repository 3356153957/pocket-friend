import assert from "node:assert/strict";
import { test } from "node:test";

import { DEMO_CURRENT_PLAYER, DEMO_PRESENCES } from "../src/app/demoData.ts";
import { createNearbyGameState } from "../src/nearbyGame.ts";

test("every demo presence is a nearby explainable match", () => {
  const state = createNearbyGameState({
    currentPlayer: DEMO_CURRENT_PLAYER,
    currentLocation: {
      latitude: 30.293312,
      longitude: 120.007986,
      accuracyMeters: 16,
      capturedAt: "2026-07-24T10:00:00.000+08:00",
      coordinateSystem: "gcj02",
      source: "simulated",
    },
    presences: DEMO_PRESENCES,
    now: new Date("2026-07-24T10:00:30.000+08:00"),
  });

  assert.deepEqual(
    state.nearbyMatches.map((match) => match.player.id).sort(),
    DEMO_PRESENCES.map((presence) => presence.profile.id).sort(),
  );
  assert.equal(state.nearbyMatches.every((match) => match.reason.length > 0), true);
});
