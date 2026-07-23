import assert from "node:assert/strict";
import test from "node:test";

import { ProximityTracker } from "../src/proximity.ts";

test("emits one entered event until the player exits", () => {
  const tracker = new ProximityTracker(200);

  assert.equal(tracker.update("p1", 150, true)?.type, "entered");
  assert.equal(tracker.update("p1", 120, true), undefined);
  assert.equal(tracker.update("p1", 250, true)?.type, "exited");
  assert.equal(tracker.update("p1", 180, true)?.type, "entered");
});

test("does not enter when location quality is insufficient", () => {
  const tracker = new ProximityTracker(200);

  assert.equal(tracker.update("p1", 150, false), undefined);
  assert.equal(tracker.update("p1", 150, true)?.type, "entered");
});
