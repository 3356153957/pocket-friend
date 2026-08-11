# Cloudflare 脱敏部署实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 构建一个不会发起业务后端请求、不会携带凭据的 Pocket Friend 公开演示包，并部署到 Cloudflare Pages。

**架构：** Vite 的 `public-demo` mode 是唯一的公开构建入口。应用通过一个纯函数和编译期常量关闭 presence、地图 SDK、照片、头像、产品与后台访问；独立脚本复制静态产物、写入 Pages 路由/安全头并扫描发布目录。Wrangler 只上传扫描通过的 `dist/cloudflare`。

**技术栈：** React 19、TypeScript 5.8、Vite、Node.js test runner、Cloudflare Pages、Wrangler

---

## 文件结构

- 创建 `apps/mobile/src/app/publicDemoMode.ts`：公开演示模式判定，不读取任何秘密值。
- 创建 `apps/mobile/test/publicDemoMode.test.ts`：模式判定单元测试。
- 修改 `apps/mobile/src/App.tsx`：公开模式阻断 presence、照片轮询和产品写入。
- 修改 `apps/mobile/src/components/Arrival.tsx`：公开模式直接生成本地演示居民。
- 修改 `apps/mobile/src/components/HomeWorld.tsx`：公开模式只使用内置场景和居民。
- 修改 `apps/mobile/src/components/Settings.tsx`：公开模式资料仅保存在 React 状态中。
- 修改 `apps/mobile/src/map/AmapNearbyMap.tsx`：公开模式渲染无网络的地图占位层。
- 创建 `apps/mobile/test/publicDemoContract.test.ts`：静态契约检查所有远程入口均受公开模式保护。
- 创建 `scripts/prepare-cloudflare-static.mjs`：生成 `dist/cloudflare`、`_headers` 和 `_redirects`。
- 创建 `scripts/scan-public-build.mjs`：扫描发布目录中的凭据模式和私有地址。
- 创建 `scripts/test/cloudflare-static.test.mjs`：测试 Pages 产物和扫描器。
- 修改 `package.json`：增加公开构建、扫描与 Cloudflare 发布脚本。
- 修改 `.gitignore`：忽略 Wrangler 本地状态。
- 删除 `.openai/hosting.json`：解除旧 GPT Sites 本地项目绑定。
- 修改 `README.md`：记录无 Token 构建、登录、发布和域名绑定命令。

### 任务 1：公开演示模式开关

**文件：**
- 创建：`apps/mobile/src/app/publicDemoMode.ts`
- 创建：`apps/mobile/test/publicDemoMode.test.ts`

- [ ] **步骤 1：编写失败的模式测试**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { isPublicDemoMode } from "../src/app/publicDemoMode.ts";

test("only public-demo enables the sanitized build", () => {
  assert.equal(isPublicDemoMode({ MODE: "public-demo" }), true);
  assert.equal(isPublicDemoMode({ MODE: "production" }), false);
  assert.equal(isPublicDemoMode(undefined), false);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --experimental-strip-types --test apps/mobile/test/publicDemoMode.test.ts`

预期：FAIL，提示找不到 `publicDemoMode.ts`。

- [ ] **步骤 3：实现模式模块**

```ts
interface PublicDemoEnvironment { MODE?: string }

export function isPublicDemoMode(environment?: PublicDemoEnvironment): boolean {
  return environment?.MODE === "public-demo";
}

const viteEnvironment = typeof import.meta.env === "object" ? import.meta.env : undefined;
export const PUBLIC_DEMO_MODE = isPublicDemoMode(viteEnvironment);
```

- [ ] **步骤 4：运行测试验证通过并提交**

运行：`node --experimental-strip-types --test apps/mobile/test/publicDemoMode.test.ts`

预期：PASS。

提交：`git commit -m "feat(web): add sanitized public demo mode"`

### 任务 2：阻断浏览器远程入口

**文件：**
- 修改：`apps/mobile/src/App.tsx`
- 修改：`apps/mobile/src/components/Arrival.tsx`
- 修改：`apps/mobile/src/components/HomeWorld.tsx`
- 修改：`apps/mobile/src/components/Settings.tsx`
- 修改：`apps/mobile/src/map/AmapNearbyMap.tsx`
- 创建：`apps/mobile/test/publicDemoContract.test.ts`

- [ ] **步骤 1：编写失败的静态契约测试**

```ts
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
    assert.match(source, /PUBLIC_DEMO_MODE/);
  }
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --experimental-strip-types --test apps/mobile/test/publicDemoContract.test.ts`

预期：FAIL，首个文件缺少 `PUBLIC_DEMO_MODE`。

- [ ] **步骤 3：增加最小保护逻辑**

实现要求：

- `App` 的 presence 和照片轮询 effect 在公开模式立即返回；建档与居民保存只更新本地状态。
- `Arrival` 在公开模式只调用 `createDemoDownloadedPhoto()`，不调用照片或 Seedream 接口。
- `HomeWorld` 在公开模式只设置 `fallbackProductScenes`，不启动三秒轮询。
- `Settings` 在公开模式不读取居民 API，保存按钮只更新本地 `ProductProfile`。
- `AmapNearbyMap` 将实时地图实现拆为内部组件，公开模式返回“公开演示版未连接在线地图”的静态层。

- [ ] **步骤 4：运行移动端测试与类型检查**

运行：`npm run test:ui && npm run typecheck`

预期：全部通过。

- [ ] **步骤 5：提交**

提交：`git commit -m "feat(web): disable remote services in public demo"`

### 任务 3：生成并扫描 Cloudflare 静态包

**文件：**
- 创建：`scripts/prepare-cloudflare-static.mjs`
- 创建：`scripts/scan-public-build.mjs`
- 创建：`scripts/test/cloudflare-static.test.mjs`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的打包与扫描测试**

```js
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findSensitiveMatches } from "../scan-public-build.mjs";

test("scanner rejects credentials but allows ordinary static text", () => {
  assert.deepEqual(findSensitiveMatches("Pocket Friend public demo"), []);
  assert.ok(findSensitiveMatches("Authorization: Bearer abcdefghijklmnopqrstuvwxyz").length > 0);
  assert.ok(findSensitiveMatches("-----BEGIN PRIVATE KEY-----").length > 0);
});

test("Pages metadata contains SPA fallback and security headers", async () => {
  const root = await mkdtemp(join(tmpdir(), "pf-cloudflare-"));
  await writeFile(join(root, "index.html"), "<main>Pocket Friend</main>");
  assert.match(await readFile(new URL("../../scripts/prepare-cloudflare-static.mjs", import.meta.url), "utf8"), /_headers/);
  assert.match(await readFile(new URL("../../scripts/prepare-cloudflare-static.mjs", import.meta.url), "utf8"), /_redirects/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test scripts/test/cloudflare-static.test.mjs`

预期：FAIL，提示找不到扫描模块。

- [ ] **步骤 3：实现打包、扫描与 npm scripts**

`package.json` 增加：

```json
{
  "build:cloudflare": "npm run build:web --workspace @pf/mobile -- --mode public-demo && node scripts/prepare-cloudflare-static.mjs && node scripts/scan-public-build.mjs dist/cloudflare",
  "scan:cloudflare": "node scripts/scan-public-build.mjs dist/cloudflare",
  "deploy:cloudflare": "npm run build:cloudflare && npx wrangler pages deploy dist/cloudflare --project-name pocket-friend"
}
```

`_headers` 至少设置 `X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy` 和限制业务连接目标的 `Content-Security-Policy`。`_redirects` 使用 `/* /index.html 200`。

扫描器递归读取 `dist/cloudflare` 文本文件并拒绝：Bearer/JWT、私钥头、常见密钥赋值、历史服务器端口以及 `chatgpt.site` 地址；输出只包含文件名和规则名，不打印匹配值。

- [ ] **步骤 4：运行脚本测试与真实构建**

运行：`node --test scripts/test/cloudflare-static.test.mjs && npm run build:cloudflare`

预期：测试 PASS，构建结束显示敏感匹配数为 0。

- [ ] **步骤 5：提交**

提交：`git commit -m "build: add sanitized Cloudflare Pages bundle"`

### 任务 4：解除旧 Sites 绑定并补充文档

**文件：**
- 删除：`.openai/hosting.json`
- 修改：`.gitignore`
- 修改：`README.md`

- [ ] **步骤 1：增加仓库卫生断言**

在 `scripts/test/cloudflare-static.test.mjs` 增加：

```js
test("legacy Sites binding is absent and Wrangler state is ignored", async () => {
  const ignore = await readFile(new URL("../../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /^\.wrangler\/$/m);
  await assert.rejects(readFile(new URL("../../.openai/hosting.json", import.meta.url), "utf8"));
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test scripts/test/cloudflare-static.test.mjs`

预期：FAIL，因为旧绑定仍存在且 `.wrangler/` 尚未忽略。

- [ ] **步骤 3：删除旧绑定并写部署文档**

README 记录：`npm run build:cloudflare`、`npx wrangler login`、`npm run deploy:cloudflare`，并明确禁止在命令行、仓库或 Pages 变量中加入业务 Token。

- [ ] **步骤 4：运行测试并提交**

运行：`node --test scripts/test/cloudflare-static.test.mjs && git diff --check`

预期：PASS，无空白错误。

提交：`git commit -m "docs: switch hosting from Sites to Cloudflare"`

### 任务 5：发布与线上验证

**文件：**
- 不修改应用代码；只产生本地忽略的 Wrangler 状态。

- [ ] **步骤 1：运行完整本地门禁**

运行：`npm test && npm run typecheck && npm run build:cloudflare && git status --short`

预期：测试、类型检查、构建、扫描全部通过；工作树只保留用户原有 `.qoder/`。

- [ ] **步骤 2：检查 Cloudflare 登录态**

运行：`npx wrangler whoami`

预期：显示账号，不要求粘贴 API Token；若未登录则运行 `npx wrangler login` 完成浏览器 OAuth。

- [ ] **步骤 3：发布扫描后的目录**

运行：`npx wrangler pages deploy dist/cloudflare --project-name pocket-friend`

预期：返回 `https://<deployment>.pocket-friend.pages.dev`，项目生产地址为 `https://pocket-friend.pages.dev` 或 Cloudflare 分配的可用项目名。

- [ ] **步骤 4：执行线上冒烟测试**

检查：根路径与深链接返回 200；CSP 等响应头存在；加载首页、完成问卷并进入小岛；浏览器网络日志无 `/product-api`、`/photo-api`、`/avatar-api`、presence、高德或 AI 请求。

- [ ] **步骤 5：复核旧站并推送最终提交**

运行：`curl.exe -I https://pocket-friend-map.h1879202922.chatgpt.site/`

预期：404。随后执行 `git push origin master`；若被拒，按仓库规则 fetch、rebase 后重试，禁止强推。
