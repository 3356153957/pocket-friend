import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { PlayerProfile } from "../../../packages/nearby-core/src/index.ts";
import {
  createDemoProfile,
  getLocationModes,
  type DemoDiscoverySettings,
} from "../src/demoSettings.ts";

const baseProfile: PlayerProfile = {
  id: "me",
  displayName: "你",
  avatar: "mint",
  interests: ["8bit", "coffee"],
  discoverable: true,
  discoveryRadiusMeters: 800,
  distancePrecision: "100m",
};

describe("demo discovery settings", () => {
  test("applies discovery, radius, and precision without mutating identity fields", () => {
    const settings: DemoDiscoverySettings = {
      discoverable: false,
      discoveryRadiusMeters: 1_500,
      distancePrecision: "region",
    };

    assert.deepEqual(createDemoProfile(baseProfile, settings), {
      ...baseProfile,
      ...settings,
    });
    assert.equal(baseProfile.discoverable, true);
  });

  test("only exposes JACOO in explicitly enabled non-production builds", () => {
    assert.deepEqual(getLocationModes({ jacooEnabled: false, production: false }), [
      "simulated",
      "native",
    ]);
    assert.deepEqual(getLocationModes({ jacooEnabled: true, production: true }), [
      "simulated",
      "native",
    ]);
    assert.deepEqual(getLocationModes({ jacooEnabled: true, production: false }), [
      "simulated",
      "native",
      "jacoo",
    ]);
  });
});
