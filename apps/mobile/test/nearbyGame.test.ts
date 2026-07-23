import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createNearbyGameState } from "../src/nearbyGame.ts";

const now = new Date("2026-07-23T10:00:00.000+08:00");

describe("createNearbyGameState", () => {
  test("projects local and remote players onto the Hupan pixel map with distance labels", () => {
    const state = createNearbyGameState({
      now,
      currentPlayer: {
        id: "me",
        displayName: "我",
        avatar: "mint",
        interests: ["8bit", "coffee"],
        discoverable: true,
        discoveryRadiusMeters: 800,
        distancePrecision: "100m",
      },
      currentLocation: {
        latitude: 30.293312,
        longitude: 120.007986,
        accuracyMeters: 18,
        capturedAt: "2026-07-23T09:59:30.000+08:00",
        coordinateSystem: "gcj02",
        source: "native",
      },
      presences: [
        {
          profile: {
            id: "ada",
            displayName: "Ada",
            avatar: "coral",
            interests: ["8bit", "music"],
            discoverable: true,
            discoveryRadiusMeters: 800,
            distancePrecision: "100m",
          },
          location: {
            latitude: 30.292227,
            longitude: 120.00487,
            accuracyMeters: 30,
            capturedAt: "2026-07-23T09:59:40.000+08:00",
            coordinateSystem: "gcj02",
            source: "simulated",
          },
        },
      ],
    });

    assert.equal(state.self.id, "me");
    assert.equal(state.visiblePlayers.length, 2);
    assert.equal(state.nearbyMatches[0]?.player.id, "ada");
    assert.equal(state.nearbyMatches[0]?.displayDistance, "约 500 米内");
    assert.equal(state.statusText, "最近: Ada, 约 500 米内");
    assert.equal(state.visiblePlayers.every((player) => player.pixel.x >= 0 && player.pixel.y >= 0), true);
  });

  test("normalizes WGS84 JACOO locations before map projection", () => {
    const state = createNearbyGameState({
      now,
      currentPlayer: {
        id: "me",
        displayName: "我",
        avatar: "mint",
        interests: ["hardware"],
        discoverable: true,
        discoveryRadiusMeters: 500,
        distancePrecision: "100m",
      },
      currentLocation: {
        latitude: 30.293312,
        longitude: 120.007986,
        accuracyMeters: 18,
        capturedAt: "2026-07-23T09:59:30.000+08:00",
        coordinateSystem: "gcj02",
        source: "native",
      },
      presences: [
        {
          profile: {
            id: "jacoo",
            displayName: "iPhone",
            avatar: "sky",
            interests: ["hardware"],
            discoverable: true,
            discoveryRadiusMeters: 500,
            distancePrecision: "100m",
          },
          location: {
            latitude: 30.289153,
            longitude: 120.008285,
            accuracyMeters: 68,
            capturedAt: "2026-07-23T09:59:30.000+08:00",
            coordinateSystem: "wgs84",
            source: "jacoo",
          },
        },
      ],
    });

    const jacoo = state.visiblePlayers.find((player) => player.id === "jacoo");

    assert.equal(jacoo?.location.coordinateSystem, "gcj02");
    assert.equal(jacoo?.sourceLabel, "JACOO");
  });
});
