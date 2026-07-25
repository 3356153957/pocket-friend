# Pocket Friend

Pocket Friend 是一个面向附近陪伴匹配体验的 Web 演示项目。它包含一个 Vite/React 移动端风格客户端、轻量级位置网关、独立设备状态管理后台，以及可测试的共享匹配逻辑。

标签：`#adventurex2026`

## 项目内容

- `apps/mobile`：面向用户的 Pocket Friend 原型，以手机界面形式展示新手引导、偏好问卷、地图匹配、设置和在线心跳上报。
- `apps/gateway`：轻量级 Node.js HTTP 网关，用于可选的 Jacoo 最新位置接入。
- `apps/admin`：带认证保护的设备状态和照片管理服务，供 Web 客户端和板端设备使用。
- `packages/nearby-core`：附近匹配相关的共享领域逻辑和基础工具。
- `scripts`：生产站点和管理后台部署脚本，以及部署流程测试。
- `docs`：项目说明、实现计划和照片像素化自动化文档。

## 技术栈

- Node.js `>=22.18`
- npm workspaces
- TypeScript
- Vite
- React
- Tailwind CSS
- 高德地图 JavaScript API

## 引用的库

根工作区：

- `typescript`：TypeScript 编译器和项目引用支持。
- `@types/node`：Node.js 类型定义。
- `@types/react`：工作区共享的 React 类型定义。

`@pf/mobile`：

- `react`：UI 组件模型。
- `react-dom`：React 浏览器端渲染。
- `@amap/amap-jsapi-loader`：在浏览器中加载高德地图 JavaScript API。
- `lucide-react`：Web 界面使用的图标库。
- `vite`：本地开发服务器和 Web 构建工具。
- `@vitejs/plugin-react`：Vite 的 React 支持插件。
- `tailwindcss`：原子化 CSS 样式框架。
- `@tailwindcss/vite`：Tailwind 与 Vite 的集成插件。
- `@amap/amap-jsapi-types`：高德地图 JavaScript API 的 TypeScript 类型定义。
- `@types/react-dom`：React DOM 类型定义。

`@pf/gateway`：

- 无外部运行时库。它使用 Node.js 内置 Web API 和 `node --experimental-strip-types` 直接运行 TypeScript。

`@pf/admin`：

- 无外部运行时库。它使用 Node.js 内置模块，包括 `node:crypto`，以及内置 Web API。

`@pf/nearby-core`：

- 无外部运行时库。

## 快速开始

安装依赖：

```bash
npm install
```

复制环境变量示例并填写本地配置：

```bash
cp .env.example .env
```

启动移动端 Web 应用：

```bash
npm run dev:mobile
```

启动可选位置网关：

```bash
npm run dev:gateway
```

启动管理后台服务：

```bash
npm run dev:admin
```

## 环境变量

公开的移动端/浏览器变量：

- `EXPO_PUBLIC_AMAP_KEY`
- `EXPO_PUBLIC_AMAP_SECURITY_JS_CODE`
- `VITE_ADMIN_URL`

仅网关服务使用的变量：

- `PF_ENABLE_JACOO`
- `JACOO_BASE_URL`
- `JACOO_API_KEY`
- `PF_ALLOWED_ORIGIN`
- `PORT`

仅管理后台使用的变量：

- `ADMIN_HOST`
- `ADMIN_PORT`
- `PF_ADMIN_USERNAME`
- `PF_ADMIN_PASSWORD`
- `PF_DEVICE_HEARTBEAT_TOKEN`
- `PF_WEB_ORIGIN`

不要提交真实密钥或密码。`.env` 已被故意加入忽略列表。

## 常用命令

```bash
npm test
npm run test:deploy
npm run typecheck
npm run build:web
npm run build:sites
```

## 部署

仓库包含用于生产移动站点和管理后台服务的 GitHub Actions 与 Node.js 部署脚本。相关文件：

- `.github/workflows/deploy-production.yml`
- `scripts/deploy-production.mjs`
- `scripts/deploy-admin.mjs`
- `ops/`

