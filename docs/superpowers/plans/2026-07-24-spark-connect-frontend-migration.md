# Spark Connect 前端迁移实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `spark-connect` 的完整演示流程迁入 Pocket Friend，并用现有高德地图、浏览器定位和附近的人能力替换其模拟地图。

**架构：** `apps/mobile` 从 Expo Web 改为 Vite 静态 SPA，继续消费 `packages/nearby-core`。页面流程使用 React 本地状态；定位和地图保留独立适配层，构建仍输出 `dist/web` 以兼容现有自动部署。

**技术栈：** React 19、Vite 8、Tailwind CSS 4、高德 JS API、Node test runner、TypeScript 5.8

---

## 文件结构

- `apps/mobile/src/app/appFlow.ts`：流程类型、初始偏好和问卷校验。
- `apps/mobile/src/app/demoData.ts`：当前用户、演示位置、附近人物和小家园数据。
- `apps/mobile/src/app/useNearbyDemo.ts`：定位采样、演示位置和附近状态编排。
- `apps/mobile/src/components/*.tsx`：从 `spark-connect` 迁入的顶部导航、欢迎、问卷、挂坠、匹配和小家园页面。
- `apps/mobile/src/map/AmapNearbyMap.tsx`：高德地图生命周期、标记、图层与地图控件。
- `apps/mobile/src/map/*.ts`：保留纯地图模型和图层逻辑。
- `apps/mobile/src/App.tsx`：五阶段流程编排。
- `apps/mobile/src/main.tsx`、`index.html`、`vite.config.ts`、`src/styles.css`：Vite 入口、构建与设计令牌。
- `apps/mobile/test/*.test.ts`：纯逻辑回归测试。

### 任务 1：建立 Vite SPA 工具链

**文件：**
- 修改：`apps/mobile/package.json`
- 修改：`apps/mobile/tsconfig.json`
- 创建：`apps/mobile/index.html`
- 创建：`apps/mobile/vite.config.ts`
- 创建：`apps/mobile/src/main.tsx`
- 修改：`package.json`

- [ ] **步骤 1：修改构建配置**

将 `@pf/mobile` 的脚本改为 `vite --host 0.0.0.0`、`vite build` 和 `tsc --noEmit`，加入 React、Vite、Tailwind、高德与 Lucide 依赖；Vite 设置 `outDir: "../../dist/web"`、`envPrefix: ["VITE_", "EXPO_PUBLIC_"]`。

- [ ] **步骤 2：安装锁文件依赖**

运行：`npm install`

预期：退出码 0，`package-lock.json` 更新且不包含 Expo 运行时依赖。

- [ ] **步骤 3：验证空入口可被工具链识别**

运行：`npm run typecheck`

预期：入口尚未创建完整 App 时失败，错误指向缺失的 `App` 或样式模块。

- [ ] **步骤 4：创建最小入口并重新验证**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
```

运行：`npm run typecheck`

预期：退出码 0。

- [ ] **步骤 5：提交工具链迁移**

```powershell
git add package.json package-lock.json apps/mobile/package.json apps/mobile/tsconfig.json apps/mobile/index.html apps/mobile/vite.config.ts apps/mobile/src/main.tsx
git commit -m "build: migrate mobile web app to Vite"
```

### 任务 2：用 TDD 建立流程与演示数据模型

**文件：**
- 创建：`apps/mobile/test/appFlow.test.ts`
- 创建：`apps/mobile/src/app/appFlow.ts`
- 创建：`apps/mobile/src/app/demoData.ts`
- 修改：`apps/mobile/src/nearbyGame.ts`

- [ ] **步骤 1：编写失败的流程测试**

```ts
test("requires a vibe, three interests, and a meeting style", () => {
  assert.equal(canContinueQuiz(createInitialPrefs()), false);
  assert.equal(canContinueQuiz({
    ...createInitialPrefs(), vibe: "quiet",
    interests: ["咖啡", "散步", "电影"], meetStyle: "chat",
  }), true);
});
```

- [ ] **步骤 2：运行测试验证红灯**

运行：`node --experimental-strip-types --test apps/mobile/test/appFlow.test.ts`

预期：FAIL，模块 `src/app/appFlow.ts` 不存在。

- [ ] **步骤 3：实现最小流程模型和完整演示数据**

实现 `Step`、`Prefs`、`createInitialPrefs()`、`canContinueQuiz()`，并把现有当前用户、演示定位和人物 presence 数据移入 `demoData.ts`。

- [ ] **步骤 4：运行测试验证绿灯**

运行：`node --experimental-strip-types --test apps/mobile/test/appFlow.test.ts apps/mobile/test/nearbyGame.test.ts`

预期：全部 PASS。

- [ ] **步骤 5：提交数据模型**

```powershell
git add apps/mobile/src/app apps/mobile/src/nearbyGame.ts apps/mobile/test/appFlow.test.ts
git commit -m "feat: add Pocket Friend demo flow model"
```

### 任务 3：迁移 Pocket Friend 页面流程

**文件：**
- 创建：`apps/mobile/src/components/TopBar.tsx`
- 创建：`apps/mobile/src/components/Welcome.tsx`
- 创建：`apps/mobile/src/components/Quiz.tsx`
- 创建：`apps/mobile/src/components/PendantSetup.tsx`
- 创建：`apps/mobile/src/components/HomeWorld.tsx`
- 修改：`apps/mobile/src/App.tsx`
- 创建：`apps/mobile/src/styles.css`

- [ ] **步骤 1：编写页面静态契约测试**

在 `apps/mobile/test/frontendContract.test.ts` 读取源码并断言 `Pocket Friend`、五个步骤标识、`prefers-reduced-motion` 和移动断点存在，同时断言不再包含品牌词 `Orbit`。

- [ ] **步骤 2：运行契约测试验证红灯**

运行：`node --test apps/mobile/test/frontendContract.test.ts`

预期：FAIL，迁移后的组件和样式尚不存在。

- [ ] **步骤 3：迁移页面并统一品牌**

从 `spark-connect@22a3668` 迁入欢迎、问卷、挂坠和小家园交互，所有可见品牌改为 `Pocket Friend`；保持原设计令牌，增加可见焦点、44px 触控目标和 reduced-motion 覆盖。

- [ ] **步骤 4：运行契约与流程测试**

运行：`node --experimental-strip-types --test apps/mobile/test/appFlow.test.ts apps/mobile/test/frontendContract.test.ts`

预期：全部 PASS。

- [ ] **步骤 5：提交页面流程**

```powershell
git add apps/mobile/src/App.tsx apps/mobile/src/components apps/mobile/src/styles.css apps/mobile/test/frontendContract.test.ts
git commit -m "feat: adopt Spark Connect Pocket Friend experience"
```

### 任务 4：接入浏览器定位和真实附近数据

**文件：**
- 创建：`apps/mobile/test/locationController.test.ts`
- 创建：`apps/mobile/src/location/locationController.ts`
- 创建：`apps/mobile/src/app/useNearbyDemo.ts`
- 保留：`apps/mobile/src/location/browserGeolocation.ts`
- 保留：`apps/mobile/src/location/locationSampling.ts`

- [ ] **步骤 1：编写失败的定位控制器测试**

测试控制器在 30 米样本时完成、超时返回最佳样本、无样本时报 `LOCATION_EMPTY_TIMEOUT_MESSAGE`，并确保取消时清理 watch 与 timer。

- [ ] **步骤 2：运行测试验证红灯**

运行：`node --experimental-strip-types --test apps/mobile/test/locationController.test.ts`

预期：FAIL，`createLocationSampler` 尚不存在。

- [ ] **步骤 3：实现定位控制器与 React hook**

控制器依赖注入 `watchBrowserPosition`、计时器和状态回调；hook 自动开始 GPS 采样，并公开 `retryGps()`、`useDemoLocation()`、`message`、`loading` 和 `NearbyGameState`。

- [ ] **步骤 4：运行定位与附近数据测试**

运行：`node --experimental-strip-types --test apps/mobile/test/browserGeolocation.test.ts apps/mobile/test/locationSampling.test.ts apps/mobile/test/locationController.test.ts apps/mobile/test/nearbyGame.test.ts`

预期：全部 PASS。

- [ ] **步骤 5：提交定位编排**

```powershell
git add apps/mobile/src/location apps/mobile/src/app/useNearbyDemo.ts apps/mobile/test/locationController.test.ts
git commit -m "feat: integrate browser location sampling"
```

### 任务 5：用高德地图替换模拟地图

**文件：**
- 创建：`apps/mobile/src/components/MatchingMap.tsx`
- 创建：`apps/mobile/src/map/AmapNearbyMap.tsx`
- 修改：`apps/mobile/src/map/mapConfig.ts`
- 保留：`apps/mobile/src/map/mapInteraction.ts`
- 保留：`apps/mobile/src/map/mapLayers.ts`
- 保留：`apps/mobile/src/map/mapModel.ts`

- [ ] **步骤 1：扩展失败的地图配置测试**

```ts
test("reads AMap values from Vite-compatible public environment", () => {
  assert.equal(AMAP_PUBLIC_ENV_NAMES[0], "EXPO_PUBLIC_AMAP_KEY");
  assert.equal(AMAP_PUBLIC_ENV_NAMES[1], "EXPO_PUBLIC_AMAP_SECURITY_JS_CODE");
});
```

同时保留地图标记、图层回退与键盘选择测试。

- [ ] **步骤 2：运行地图测试验证红灯或回归基线**

运行：`node --experimental-strip-types --test apps/mobile/test/map*.test.ts`

预期：新增契约先 FAIL；现有地图逻辑测试保持 PASS。

- [ ] **步骤 3：实现 DOM 高德地图组件和匹配侧栏**

从现有 `DynamicVectorMap.web.tsx` 迁移 SDK 加载、标记差分、聚焦和图层控制，改为 React DOM。`MatchingMap` 使用真实 `NearbyGameState`，点击标记联动资料卡，保留“模拟挂坠碰撞”。

- [ ] **步骤 4：运行全部 mobile 测试和类型检查**

运行：`node --experimental-strip-types --test apps/mobile/test/*.test.ts`

运行：`npm run typecheck`

预期：全部 PASS，类型检查退出码 0。

- [ ] **步骤 5：提交地图集成**

```powershell
git add apps/mobile/src/components/MatchingMap.tsx apps/mobile/src/map apps/mobile/test
git commit -m "feat: connect AMap to the matching experience"
```

### 任务 6：构建、浏览器验收与推送

**文件：**
- 删除：`apps/mobile/App.tsx`
- 删除：`apps/mobile/index.ts`
- 删除：`apps/mobile/app.json`
- 删除：`apps/mobile/src/map/DynamicVectorMap.tsx`
- 删除：`apps/mobile/src/map/DynamicVectorMap.web.tsx`
- 删除：`apps/mobile/src/prototype/PocketFriendPrototype.tsx`
- 修改：`README.md`（仅当启动命令或环境变量说明过期）

- [ ] **步骤 1：删除不再使用的 Expo 文件并扫描品牌**

运行：`rg -n "Orbit|expo|react-native" apps/mobile package.json`

预期：业务源码中无 `Orbit`，应用运行依赖中无 Expo/React Native。

- [ ] **步骤 2：运行完整自动化验证**

运行：`npm test`

运行：`npm run typecheck`

运行：`npm run build:sites`

预期：三个命令均退出码 0，`dist/client/index.html` 存在。

- [ ] **步骤 3：启动预览并执行浏览器验收**

运行：`npm run start --workspace @pf/mobile -- --port 4173`

检查 1440x900 和 375x812：完整五步流程、卫星地图非空、缩放拖动、定位错误回退、人物联动、无横向溢出和控制台错误。

- [ ] **步骤 4：执行代码图影响分析**

使用 `codebase_memory.detect_changes` 对比 `origin/master`，确认影响限于前端、锁文件、文档和构建入口。

- [ ] **步骤 5：提交清理并安全推送当前分支**

```powershell
git add -A
git commit -m "refactor: remove replaced Expo frontend"
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 fetch origin
git rebase origin/master
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin codex/dynamic-vector-map
```

预期：推送成功；不更新 `master`，不触发生产自动部署。
