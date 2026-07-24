import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  readAmapConfig,
  readAmapConfigFromViteEnv,
} from "../src/map/mapConfig.ts";

describe("readAmapConfig", () => {
  test("returns a ready config when both public values are present", () => {
    assert.deepEqual(readAmapConfig({
      EXPO_PUBLIC_AMAP_KEY: "web-key",
      EXPO_PUBLIC_AMAP_SECURITY_JS_CODE: "security-code",
    }), {
      status: "ready",
      key: "web-key",
      securityJsCode: "security-code",
    });
  });

  test("reports every missing or blank public value", () => {
    assert.deepEqual(readAmapConfig({
      EXPO_PUBLIC_AMAP_KEY: " ",
    }), {
      status: "missing",
      missing: [
        "EXPO_PUBLIC_AMAP_KEY",
        "EXPO_PUBLIC_AMAP_SECURITY_JS_CODE",
      ],
    });
  });

  test("reads the existing public names from Vite environment values", () => {
    assert.deepEqual(readAmapConfigFromViteEnv({
      EXPO_PUBLIC_AMAP_KEY: "vite-key",
      EXPO_PUBLIC_AMAP_SECURITY_JS_CODE: "vite-security-code",
      DEV: true,
    }), {
      status: "ready",
      key: "vite-key",
      securityJsCode: "vite-security-code",
    });
  });
});
