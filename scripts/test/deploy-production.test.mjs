import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildReleaseName,
  parseEnvFile,
  resolveAssetPath,
  validateBuild,
  validateDeployConfig,
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

test("buildReleaseName 使用不可注入路径的部署身份", () => {
  assert.equal(
    buildReleaseName({
      sha: "0123456789abcdef0123456789abcdef01234567",
      runId: "123456",
      attempt: "2",
    }),
    "0123456789abcdef0123456789abcdef01234567-123456-2",
  );
});

test("validateDeployConfig 只接受服务器内的绝对路径和本机健康地址", () => {
  assert.deepEqual(validateDeployConfig({
    deployRoot: "/srv/pocket-friend",
    envFile: "/etc/pocket-friend/mobile.env",
    service: "pocket-friend.service",
    healthUrl: "http://127.0.0.1/",
    workspace: "/opt/actions-runner/_work/pocket-friend/pocket-friend",
  }), {
    deployRoot: path.resolve("/srv/pocket-friend"),
    envFile: path.resolve("/etc/pocket-friend/mobile.env"),
    service: "pocket-friend.service",
    healthUrl: "http://127.0.0.1/",
    workspace: path.resolve("/opt/actions-runner/_work/pocket-friend/pocket-friend"),
  });

  assert.throws(
    () => validateDeployConfig({
      deployRoot: "/",
      envFile: "/etc/pocket-friend/mobile.env",
      service: "pocket-friend.service",
      healthUrl: "http://127.0.0.1/",
      workspace: "/tmp/workspace",
    }),
    /deploy root/,
  );
  assert.throws(
    () => validateDeployConfig({
      deployRoot: "/srv/pocket-friend",
      envFile: "/etc/pocket-friend/mobile.env",
      service: "other.service; reboot",
      healthUrl: "https://example.com/",
      workspace: "/tmp/workspace",
    }),
    /service/,
  );
  assert.throws(
    () => validateDeployConfig({
      deployRoot: "/srv/pocket-friend",
      envFile: "/etc/pocket-friend/mobile.env",
      service: "pocket-friend.service",
      healthUrl: "https://example.com/",
      workspace: "/tmp/workspace",
    }),
    /loopback/,
  );
});

test("生产工作流只允许 master 和人工触发并使用受限 Runner", async () => {
  const workflow = await readFile(
    path.resolve(".github/workflows/deploy-production.yml"),
    "utf8",
  );

  assert.match(workflow, /^name:\s*Deploy production$/mu);
  assert.match(workflow, /\bpush:\s*\n\s+branches:\s*\[master\]/u);
  assert.match(workflow, /\bworkflow_dispatch:\s*$/mu);
  assert.doesNotMatch(workflow, /\bpull_request(?:_target)?:/u);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/u);
  assert.match(
    workflow,
    /runs-on:\s*\[self-hosted,\s*linux,\s*x64,\s*pocket-friend-prod\]/u,
  );
  assert.match(workflow, /if:\s*github\.ref == 'refs\/heads\/master'/u);
  assert.match(
    workflow,
    /flock[\s\S]*?deploy\.lock[\s\S]*?node scripts\/deploy-production\.mjs/u,
  );
  assert.match(workflow, /PF_DEPLOY_ROOT:\s*\/srv\/pocket-friend/u);
  assert.match(
    workflow,
    /PF_DEPLOY_ENV_FILE:\s*\/etc\/pocket-friend\/mobile\.env/u,
  );
});

test("服务器配置固定静态 release 根目录并只授权重启指定服务", async () => {
  const [serviceUnit, sudoers] = await Promise.all([
    readFile(path.resolve("ops/pocket-friend.service"), "utf8"),
    readFile(path.resolve("ops/pocket-friend-deploy.sudoers"), "utf8"),
  ]);

  assert.match(
    serviceUnit,
    /^Environment=POCKET_FRIEND_STATIC_ROOT=\/srv\/pocket-friend\/current$/mu,
  );
  assert.match(serviceUnit, /^Environment=PORT=80$/mu);
  assert.match(
    serviceUnit,
    /^ExecStart=\/usr\/bin\/node \/root\/pocket-friend-static-server\.mjs$/mu,
  );

  const rules = sudoers
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  assert.deepEqual(rules, [
    "pf-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart pocket-friend.service",
  ]);
});
