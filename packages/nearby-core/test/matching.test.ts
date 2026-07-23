import assert from "node:assert/strict";
import test from "node:test";

import { findNearbyMatches } from "../src/matching.ts";
import type { PlayerProfile, PresenceSnapshot } from "../src/types.ts";

const now = new Date("2026-07-23T08:00:00.000Z");
const me: PlayerProfile = {
  id: "me",
  displayName: "小友",
  avatar: "mint",
  interests: ["独立游戏", "摄影", "咖啡"],
  discoverable: true,
  discoveryRadiusMeters: 1_000,
  distancePrecision: "100m",
};

function presence(overrides: Partial<PresenceSnapshot> = {}): PresenceSnapshot {
  return {
    profile: {
      id: "player-1",
      displayName: "阿禾",
      avatar: "coral",
      interests: ["独立游戏", "骑行"],
      discoverable: true,
      discoveryRadiusMeters: 1_000,
      distancePrecision: "500m",
    },
    location: {
      latitude: 30.293312,
      longitude: 120.008986,
      accuracyMeters: 30,
      capturedAt: now.toISOString(),
      coordinateSystem: "gcj02",
      source: "simulated",
    },
    ...overrides,
  };
}

test("returns an explainable match with shared interests and protected distance", () => {
  const matches = findNearbyMatches({
    me,
    myLocation: {
      latitude: 30.293312,
      longitude: 120.007986,
      accuracyMeters: 20,
      capturedAt: now.toISOString(),
      coordinateSystem: "gcj02",
      source: "simulated",
    },
    candidates: [presence()],
    now,
  });

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0]?.sharedInterests, ["独立游戏"]);
  assert.equal(matches[0]?.displayDistance, "约 500 米内");
  assert.match(matches[0]?.reason ?? "", /独立游戏/);
  assert.ok((matches[0]?.score ?? 0) >= 0 && (matches[0]?.score ?? 0) <= 100);
});

test("excludes hidden, stale, unrelated and out-of-range candidates", () => {
  const candidates = [
    presence({ profile: { ...presence().profile, id: "hidden", discoverable: false } }),
    presence({
      profile: { ...presence().profile, id: "stale" },
      location: { ...presence().location, capturedAt: "2026-07-23T07:55:00.000Z" },
    }),
    presence({
      profile: { ...presence().profile, id: "unrelated", interests: ["围棋"] },
    }),
    presence({
      profile: { ...presence().profile, id: "far" },
      location: { ...presence().location, latitude: 30.272409, longitude: 120.005407 },
    }),
  ];

  assert.deepEqual(findNearbyMatches({
    me,
    myLocation: presence().location,
    candidates,
    now,
  }), []);
});
