import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guardedFiles = [
  "src/App.tsx",
  "src/components/Arrival.tsx",
  "src/components/HomeWorld.tsx",
  "src/components/Settings.tsx",
  "src/map/AmapNearbyMap.tsx",
];

test("every browser remote entry imports the public demo guard", async () => {
  for (const path of guardedFiles) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /PUBLIC_DEMO_MODE/, `${path} must use the public demo guard`);
  }
});

test("public demo map copy never exposes environment variable names", async () => {
  const source = await readFile(new URL("../src/map/AmapNearbyMap.tsx", import.meta.url), "utf8");
  assert.match(source, /公开演示版未连接在线地图/);
});
