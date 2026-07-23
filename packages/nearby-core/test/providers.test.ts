import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  HUPAN_PIXEL_MAP,
  InMemoryPresenceRepository,
  SimulatedLocationProvider,
  type PresenceSnapshot,
} from "../src/index.ts";

function snapshot(id: string, capturedAt = "2026-07-23T10:00:00.000+08:00"): PresenceSnapshot {
  return {
    profile: {
      id,
      displayName: id === "me" ? "我" : `玩家 ${id}`,
      avatar: "mint",
      interests: ["8bit", "coffee"],
      discoverable: true,
      discoveryRadiusMeters: 500,
      distancePrecision: "100m",
    },
    location: {
      latitude: 30.293312,
      longitude: 120.007986,
      accuracyMeters: 12,
      capturedAt,
      coordinateSystem: "gcj02",
      source: "simulated",
    },
  };
}

describe("SimulatedLocationProvider", () => {
  test("starts at the first path point and advances deterministically", async () => {
    const provider = new SimulatedLocationProvider({
      path: [
        { latitude: 30.293312, longitude: 120.007986 },
        { latitude: 30.292227, longitude: 120.00487 },
      ],
      capturedAt: () => "2026-07-23T10:00:00.000+08:00",
      accuracyMeters: 15,
    });

    assert.equal(provider.source, "simulated");
    assert.deepEqual(await provider.getCurrentLocation(), {
      latitude: 30.293312,
      longitude: 120.007986,
      accuracyMeters: 15,
      capturedAt: "2026-07-23T10:00:00.000+08:00",
      coordinateSystem: "gcj02",
      source: "simulated",
    });

    const seen: string[] = [];
    const unsubscribe = await provider.watchLocation((location) => {
      seen.push(`${location.latitude},${location.longitude}`);
    });

    provider.advance();
    unsubscribe();
    provider.advance();

    assert.deepEqual(seen, ["30.292227,120.00487"]);
    assert.equal((await provider.getCurrentLocation()).latitude, 30.293312);
  });

  test("uses the Hupan map landmarks as the default demo path", async () => {
    const provider = SimulatedLocationProvider.fromMap(HUPAN_PIXEL_MAP, {
      capturedAt: () => "2026-07-23T10:01:00.000+08:00",
    });

    const first = await provider.getCurrentLocation();
    provider.advance();
    const second = await provider.getCurrentLocation();

    assert.equal(first.longitude, HUPAN_PIXEL_MAP.landmarks[0].longitude);
    assert.equal(second.longitude, HUPAN_PIXEL_MAP.landmarks[1].longitude);
  });
});

describe("InMemoryPresenceRepository", () => {
  test("publishes, lists, notifies, and removes presence snapshots", async () => {
    const repo = new InMemoryPresenceRepository();
    const events: string[][] = [];
    const unsubscribe = repo.subscribe((snapshots) => {
      events.push(snapshots.map((item) => item.profile.id));
    });

    await repo.publish(snapshot("me"));
    await repo.publish(snapshot("ada"));
    await repo.remove("me");
    unsubscribe();
    await repo.publish(snapshot("lin"));

    assert.deepEqual((await repo.list()).map((item) => item.profile.id), ["ada", "lin"]);
    assert.deepEqual(events, [["me"], ["me", "ada"], ["ada"]]);
  });
});
