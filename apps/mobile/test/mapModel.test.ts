import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { VisiblePlayer } from "../src/nearbyGame.ts";
import {
  buildMapMarkers,
  createMapFocusTarget,
  diffMapMarkers,
} from "../src/map/mapModel.ts";

const player = (
  id: string,
  longitude: number,
  latitude: number,
  isSelf = false,
): VisiblePlayer => ({
  id,
  displayName: id === "me" ? "你" : "Ada",
  avatar: isSelf ? "mint" : "coral",
  pixel: { x: 0, y: 0, isOutOfBounds: false },
  location: {
    longitude,
    latitude,
    accuracyMeters: 18,
    capturedAt: "2026-07-23T10:00:00.000+08:00",
    coordinateSystem: "gcj02",
    source: "simulated",
  },
  sourceLabel: "SIM",
  isSelf,
});

describe("dynamic map model", () => {
  test("builds accessible markers and filters invalid coordinates", () => {
    const markers = buildMapMarkers([
      player("me", 120.007986, 30.293312, true),
      player("ada", 120.00487, 30.292227),
      player("broken", Number.NaN, 30.2),
    ], "ada");

    assert.deepEqual(markers.map((marker) => ({
      id: marker.id,
      position: marker.position,
      selected: marker.selected,
      accessibilityLabel: marker.accessibilityLabel,
    })), [
      {
        id: "me",
        position: [120.007986, 30.293312],
        selected: false,
        accessibilityLabel: "你，当前位置",
      },
      {
        id: "ada",
        position: [120.00487, 30.292227],
        selected: true,
        accessibilityLabel: "Ada，附近的人，已选中",
      },
    ]);
  });

  test("creates focus targets for Hupan, self, and a selected player", () => {
    const markers = buildMapMarkers([
      player("me", 120.007986, 30.293312, true),
      player("ada", 120.00487, 30.292227),
    ], null);

    assert.deepEqual(createMapFocusTarget({ kind: "hupan" }, markers), {
      center: [120.007986, 30.293312],
      zoom: 16,
    });
    assert.deepEqual(createMapFocusTarget({ kind: "self" }, markers), {
      center: [120.007986, 30.293312],
      zoom: 17,
    });
    assert.deepEqual(
      createMapFocusTarget({ kind: "player", playerId: "ada" }, markers),
      { center: [120.00487, 30.292227] },
    );
  });

  test("diffs marker additions, updates, and removals by id", () => {
    const before = buildMapMarkers([
      player("me", 120.007986, 30.293312, true),
      player("ada", 120.00487, 30.292227),
    ], null);
    const after = buildMapMarkers([
      player("me", 120.008, 30.2934, true),
      player("lin", 120.005427, 30.293364),
    ], "lin");

    const diff = diffMapMarkers(before, after);

    assert.deepEqual(diff.removeIds, ["ada"]);
    assert.deepEqual(diff.add.map((marker) => marker.id), ["lin"]);
    assert.deepEqual(diff.update.map((marker) => marker.id), ["me"]);
  });

  test("separates markers that share the same coordinates", () => {
    const markers = buildMapMarkers([
      player("me", 120.00487, 30.292227, true),
      player("ada", 120.00487, 30.292227),
    ], null);

    assert.deepEqual(
      markers.map((marker) => marker.visualOffset),
      [[0, -48], [0, 48]],
    );
  });
});
