# 入岛流程合并实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将队友的问卷画像、硬件照片、Seedream 像素居民、入岛动画和产品数据接口接入当前主线，同时保留现有照片上传与 JACOO 能力。

**架构：** 使用 Git 三方合并引入移动端和产品存储实现，手工合并 Gateway 路由与服务器入口。浏览器只调用 Gateway 的头像生成端点，Gateway 使用服务端密钥访问 Seedream；产品状态继续通过 `ProductStore` 抽象持久化。

**技术栈：** TypeScript、React 19、Vite 8、Node.js 22 Web API、`node:test`

---

### 任务 1：合并队友分支并锁定组合行为

**文件：**
- 修改：`apps/gateway/test/router.test.ts`
- 修改：`apps/gateway/test/server.test.ts`
- 修改：`apps/gateway/src/router.ts`
- 修改：`apps/gateway/src/server.ts`
- 创建：`apps/gateway/src/productStore.ts`

- [ ] **步骤 1：执行三方合并并保留冲突现场**

运行：`git merge --no-commit --no-ff refs/remotes/teammate/encounter-profile-arrival-flow`

预期：仅 `apps/gateway/src/router.ts` 和 `apps/gateway/src/server.ts` 发生内容冲突。

- [ ] **步骤 2：先补组合行为测试**

在 Gateway 路由测试中断言同一个路由实例既能接受带 Bearer Token 的 `POST /api/photos`，也能提供 `GET /api/product/scenes`；在预检请求中断言允许 `Authorization, Content-Type` 以及 `GET, POST, PUT, PATCH, OPTIONS`。

- [ ] **步骤 3：运行 Gateway 测试确认红灯**

运行：`node --experimental-strip-types --test apps/gateway/test/*.test.ts`

预期：冲突尚未解决或组合 CORS 行为不完整，测试失败。

- [ ] **步骤 4：最小化解决路由与服务器冲突**

`router.ts` 同时保留照片上传、健康检查、JACOO 和 `/api/product/*`；`server.ts` 同时保留请求体读取与默认 `FileProductStore` 注入。

- [ ] **步骤 5：运行 Gateway 测试确认绿灯**

运行：`node --experimental-strip-types --test apps/gateway/test/*.test.ts`

预期：Gateway 测试全部通过。

### 任务 2：把 Seedream 密钥移到 Gateway

**文件：**
- 创建：`apps/gateway/src/seedream.ts`
- 修改：`apps/gateway/src/router.ts`
- 修改：`apps/gateway/test/router.test.ts`
- 修改：`apps/mobile/src/app/seedreamAvatar.ts`
- 修改：`apps/mobile/vite.config.ts`

- [ ] **步骤 1：编写失败的 Seedream 代理测试**

测试 `POST /api/avatar/generate` 在缺少服务端配置时返回 `503`，配置完整时由 Gateway 添加 `Authorization: Bearer ...`、固定可信上游地址并返回生成结果，响应中不包含密钥。

- [ ] **步骤 2：运行定向测试验证失败原因**

运行：`node --experimental-strip-types --test apps/gateway/test/router.test.ts`

预期：路由不存在或返回 `404`。

- [ ] **步骤 3：实现最小 Gateway 代理并切换移动端调用**

Gateway 从 `DOUBAO_API_KEY`、`DOUBAO_MODEL` 和可选 `DOUBAO_ENDPOINT` 读取服务端配置；移动端只向 `/avatar-api/generate` 发送照片和生成参数，不再读取 `VITE_DOUBAO_API_KEY`。

- [ ] **步骤 4：重新运行定向测试和类型检查**

运行：`node --experimental-strip-types --test apps/gateway/test/router.test.ts` 以及 `npm run typecheck`

预期：测试与类型检查均退出 `0`。

### 任务 3：补齐可部署配置

**文件：**
- 修改：`.env.example`
- 修改：`.gitignore`

- [ ] **步骤 1：补齐非敏感示例变量**

加入 `DOUBAO_API_KEY=`、`DOUBAO_MODEL=doubao-seedream-5-0-260128`、`PF_PHOTO_TOKEN=`、`PF_PRODUCT_STORE_FILE=./data/product-state.json`；不写入任何真实凭据。

- [ ] **步骤 2：确认运行数据不会入库**

运行：`git check-ignore apps/gateway/data/product-state.json`

预期：路径被 `.gitignore` 忽略。

### 任务 4：全量验证并交付分支

**文件：**
- 验证：全部受影响文件

- [ ] **步骤 1：运行全部自动化检查**

运行：`npm test`、`npm run typecheck`、`npm run build:web`

预期：三个命令均退出 `0`。

- [ ] **步骤 2：检查仓库与敏感信息边界**

运行：`git diff --check`、`git status --short`，并确认没有 `.env`、密钥、日志或运行数据进入变更。

- [ ] **步骤 3：提交并推送功能分支**

运行：`git commit -m "feat: merge hardware photo island flow"`，随后通过 Clash 代理推送 `codex/merge-arrival-flow`。

