import assert from "node:assert/strict";
import { test } from "node:test";

import { residentsForScene } from "../src/app/sceneResidents.ts";
import type { ScreenResident } from "../src/app/screenResident.ts";

function resident(id: string, activeSceneId: string): ScreenResident {
  return {
    id,
    name: id,
    magnetType: "好奇选手",
    tags: [],
    pixelPortraitUrl: "data:image/png;base64,cGl4ZWw=",
    createdAt: "2026-07-25T00:00:00.000Z",
    source: "hardware",
    spriteSource: "seedream",
    activeSceneId,
  };
}

test("residentsForScene only returns residents assigned to the active scene", () => {
  const residents = [
    resident("venture", "venture-center"),
    resident("academic", "academic-center"),
  ];

  assert.deepEqual(
    residentsForScene("academic-center", residents).map((item) => item.id),
    ["academic"],
  );
  assert.deepEqual(residentsForScene("pitch-stage", residents), []);
});
