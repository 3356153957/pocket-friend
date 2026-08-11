import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const guardedFiles = [
  "src/App.tsx",
  "src/app/useNearbyDemo.ts",
  "src/components/Arrival.tsx",
  "src/components/HomeWorld.tsx",
  "src/components/Settings.tsx",
  "src/map/AmapNearbyMap.tsx",
];

test("every browser remote entry imports the public demo guard", async () => {
  for (const path of guardedFiles) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.match(source, /PUBLIC_DEMO_MODE/, `${path} must use the public demo guard`);
    assert.match(source, /publicDemoRuntime\.ts/, `${path} must import the compile-time runtime guard`);
  }
});

test("runtime guard compares Vite mode directly so Rollup can remove dead branches", async () => {
  const source = await readFile(new URL("../src/app/publicDemoRuntime.ts", import.meta.url), "utf8");
  assert.match(source, /import\.meta\.env\.MODE\s*===\s*["']public-demo["']/);
  assert.doesNotMatch(source, /isPublicDemoMode/);
});

test("Vite public-demo build aliases every credential-aware browser module", async () => {
  const config = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(config, /public-demo\/productApi\.ts/);
  assert.match(config, /public-demo\/photoPipeline\.ts/);

  for (const path of [
    "src/public-demo/productApi.ts",
    "src/public-demo/photoPipeline.ts",
  ]) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /fetch\s*\(|:431[01]|\/product-api|\/photo-api|\/avatar-api/);
  }
});

test("public demo map copy never exposes environment variable names", async () => {
  const source = await readFile(new URL("../src/map/AmapNearbyMap.tsx", import.meta.url), "utf8");
  assert.match(source, /公开演示版未连接在线地图/);
});

test("public demo location starts and retries with simulated data", async () => {
  const source = await readFile(new URL("../src/app/useNearbyDemo.ts", import.meta.url), "utf8");
  assert.match(source, /PUBLIC_DEMO_MODE[\s\S]+void useDemoLocation\(\)/);
  assert.match(source, /retryGps:\s*PUBLIC_DEMO_MODE\s*\?\s*useDemoLocation\s*:\s*retryGps/);
});
