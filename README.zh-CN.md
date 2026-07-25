# Pocket Friend

[English README](README.md)

Pocket Friend 是一个面向“附近陪伴匹配”的 Web 演示项目。它把产品做成手机应用的形态：用户完成简短引导，选择自己的气质和兴趣，在地图上看到附近匹配对象，同时通过轻量心跳让管理后台了解设备在线状态。

标签：`#adventurex2026`

## 适合谁

- 想探索实体挂件、陪伴设备和轻社交匹配体验的团队。
- 希望快速运行项目、理解结构和演示路径的 Hackathon 评审。
- 想参考一个小型 TypeScript monorepo 的开发者：包含 Web 应用、服务端接口、管理后台和可测试的共享业务逻辑。

## 主要功能

- 手机风格 Pocket Friend 原型，包含新手引导、偏好问卷、匹配地图、首页和设置。
- 附近匹配模型，支持距离隐私、共同兴趣解释和模拟玩家数据。
- 浏览器定位采样，按定位精度选择最佳位置并提供降级提示。
- 基于高德地图的地图展示，支持卫星/标准图层切换和可访问的标记选择。
- 设备状态管理后台，包含基础认证、心跳上报、板端照片上传、照片历史和独立照片读取令牌。
- 轻量级网关服务，用于后端位置与服务集成。
- 面向生产站点和独立管理后台的构建、部署脚本。

## 快速开始

先安装 Node.js `>=22.18`，然后安装依赖：

```bash
npm install
```

创建本地环境变量文件：

```bash
cp .env.example .env
```

启动移动端 Web 应用：

```bash
npm run dev:mobile
```

需要后端服务时再启动：

```bash
npm run dev:gateway
npm run dev:admin
```

## 目录结构

```text
apps/mobile/          Vite + React Pocket Friend Web 应用
apps/gateway/         Node.js 网关服务
apps/admin/           设备状态与照片管理后台
packages/nearby-core/ 位置、匹配、距离和在线状态共享逻辑
scripts/              构建与部署辅助脚本
ops/                  生产服务与静态站点配置
docs/                 项目说明和实现计划
```

## 服务说明

| 服务 | 路径 | 用途 | 默认命令 |
| --- | --- | --- | --- |
| 移动端 Web 应用 | `apps/mobile` | 面向用户的 Pocket Friend 原型 | `npm run dev:mobile` |
| 网关服务 | `apps/gateway` | 后端集成网关和健康检查 | `npm run dev:gateway` |
| 管理后台 | `apps/admin` | 设备心跳、板端照片上传、状态面板 | `npm run dev:admin` |
| 共享核心 | `packages/nearby-core` | 供应用和测试复用的纯业务逻辑 | 由 `npm test` 覆盖 |

## 环境变量

公开的浏览器变量：

- `EXPO_PUBLIC_AMAP_KEY`
- `EXPO_PUBLIC_AMAP_SECURITY_JS_CODE`
- `VITE_ADMIN_URL`

仅网关服务使用的变量：

- `PF_ALLOWED_ORIGIN`
- `PORT`

仅管理后台使用的变量：

- `ADMIN_HOST`
- `ADMIN_PORT`
- `PF_ADMIN_USERNAME`
- `PF_ADMIN_PASSWORD`
- `PF_DEVICE_HEARTBEAT_TOKEN`
- `PF_WEB_ORIGIN`

真实密钥不要提交到 Git。`.env` 已被忽略，`.env.example` 只应保留占位值。

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
- `lucide-react`：界面使用的图标库。
- `vite`：本地开发服务器和生产构建工具。
- `@vitejs/plugin-react`：Vite 的 React 支持插件。
- `tailwindcss`：原子化 CSS 样式框架。
- `@tailwindcss/vite`：Tailwind 与 Vite 的集成插件。
- `@amap/amap-jsapi-types`：高德地图 JavaScript API 的 TypeScript 类型定义。
- `@types/react-dom`：React DOM 类型定义。

`@pf/gateway`、`@pf/admin` 和 `@pf/nearby-core`：

- 无外部运行时库。它们使用 Node.js 内置模块、内置 Web API，以及 `node --experimental-strip-types` 直接运行 TypeScript。

## 常用命令

```bash
# 运行全部单元测试和契约测试
npm test

# 运行部署脚本测试
npm run test:deploy

# 检查 TypeScript 项目引用
npm run typecheck

# 构建移动端 Web 应用
npm run build:web

# 构建并准备静态站点包
npm run build:sites
```

## 公共仓库边界

这个仓库用于公开展示和复用代码。不要提交：

- 真实 `.env` 文件或本地凭据。
- API key、密码、Token、私钥或证书。
- 个人位置数据、上传照片、日志或生产数据库文件。
- 会暴露主机名、IP 或密钥的私人部署笔记。

## 部署

仓库包含用于生产移动站点和管理后台服务的 GitHub Actions 与 Node.js 部署脚本：

- `.github/workflows/deploy-production.yml`
- `scripts/deploy-production.mjs`
- `scripts/deploy-admin.mjs`
- `ops/`

