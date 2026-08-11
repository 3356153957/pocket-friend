import assert from "node:assert/strict";
import test from "node:test";

import { isPublicDemoMode } from "../src/app/publicDemoMode.ts";

test("only public-demo enables the sanitized build", () => {
  assert.equal(isPublicDemoMode({ MODE: "public-demo" }), true);
  assert.equal(isPublicDemoMode({ MODE: "production" }), false);
  assert.equal(isPublicDemoMode(undefined), false);
});
