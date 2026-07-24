import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseEnvFile,
  resolveAssetPath,
  validateBuild,
  validateDeployIdentity,
} from "../deploy-production-lib.mjs";

const PUBLIC_ENV = {
  EXPO_PUBLIC_AMAP_KEY: "amap-test-key",
  EXPO_PUBLIC_AMAP_SECURITY_JS_CODE: "amap-test-security-code",
};

test("parseEnvFile 只读取部署所需的两个公开变量", () => {
  const parsed = parseEnvFile(`
# production map configuration
EXPO_PUBLIC_AMAP_KEY="amap-test-key"
IGNORED_SECRET=must-not-be-returned
EXPO_PUBLIC_AMAP_SECURITY_JS_CODE='amap-test-security-code'
`);

  assert.deepEqual(parsed, PUBLIC_ENV);
  assert.equal("IGNORED_SECRET" in parsed, false);
});

test("parseEnvFile 拒绝缺少或为空的部署变量", () => {
  assert.throws(
    () => parseEnvFile("EXPO_PUBLIC_AMAP_KEY=only-one-value\n"),
    /EXPO_PUBLIC_AMAP_SECURITY_JS_CODE/,
  );
  assert.throws(
    () => parseEnvFile(
      "EXPO_PUBLIC_AMAP_KEY= \nEXPO_PUBLIC_AMAP_SECURITY_JS_CODE=value\n",
    ),
    /EXPO_PUBLIC_AMAP_KEY/,
  );
});

test("resolveAssetPath 接受站点绝对路径并拒绝目录穿越", () => {
  const buildRoot = path.resolve("dist/client");

  assert.equal(
    resolveAssetPath(buildRoot, "/_expo/static/js/web/index.js"),
    path.join(buildRoot, "_expo/static/js/web/index.js"),
  );
  assert.throws(
    () => resolveAssetPath(buildRoot, "/../../etc/passwd.js"),
    /outside build root/,
  );
  assert.throws(
    () => resolveAssetPath(buildRoot, "https://example.com/app.js"),
    /local JavaScript asset/,
  );
});

test("validateBuild 要求首页、脚本和两个环境变量均存在", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "pf-deploy-build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const assetDirectory = path.join(root, "_expo/static/js/web");
  const assetPublicPath = "/_expo/static/js/web/index-test.js";
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(
    path.join(root, "index.html"),
    `<html><script src="${assetPublicPath}"></script></html>`,
  );
  await writeFile(
    path.join(assetDirectory, "index-test.js"),
    `const key="${PUBLIC_ENV.EXPO_PUBLIC_AMAP_KEY}";` +
      `const security="${PUBLIC_ENV.EXPO_PUBLIC_AMAP_SECURITY_JS_CODE}";`,
  );

  assert.deepEqual(await validateBuild({
    buildRoot: root,
    publicEnv: PUBLIC_ENV,
  }), {
    assetPublicPath,
    assetFile: path.join(assetDirectory, "index-test.js"),
  });

  await writeFile(path.join(assetDirectory, "index-test.js"), "missing values");
  await assert.rejects(
    validateBuild({ buildRoot: root, publicEnv: PUBLIC_ENV }),
    /does not contain EXPO_PUBLIC_AMAP_KEY/,
  );
});

test("validateDeployIdentity 只接受完整 Git SHA 和数字运行编号", () => {
  assert.deepEqual(validateDeployIdentity({
    sha: "0123456789abcdef0123456789abcdef01234567",
    runId: "123456",
    attempt: "2",
  }), {
    sha: "0123456789abcdef0123456789abcdef01234567",
    runId: "123456",
    attempt: "2",
  });

  assert.throws(
    () => validateDeployIdentity({
      sha: "../../main",
      runId: "123456",
      attempt: "2",
    }),
    /GITHUB_SHA/,
  );
  assert.throws(
    () => validateDeployIdentity({
      sha: "0123456789abcdef0123456789abcdef01234567",
      runId: "12/34",
      attempt: "2",
    }),
    /GITHUB_RUN_ID/,
  );
});
