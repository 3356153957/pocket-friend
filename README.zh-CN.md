# Pocket Friend

[English README](README.md)

[![CI](https://img.shields.io/badge/CI-no_status-6b7280?style=flat&logo=github&logoColor=white)](https://github.com/3356153957/pocket-friend/actions)
[![node](https://img.shields.io/badge/node-%3E%3D22.18-339933?style=flat&logo=nodedotjs&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=flat&logo=typescript&logoColor=white)](package.json)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?style=flat&logo=react&logoColor=white)](apps/mobile/package.json)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat&logo=vite&logoColor=white)](apps/mobile/package.json)
[![AMap](https://img.shields.io/badge/AMap-Web-00A1E9?style=flat)](apps/mobile/src/map)
[![npm](https://img.shields.io/badge/npm-workspaces-CB3837?style=flat&logo=npm&logoColor=white)](package.json)
[![tag](https://img.shields.io/badge/tag-%23adventurex2026-8A2BE2?style=flat&logo=github&logoColor=white)](https://github.com/3356153957/pocket-friend/releases/tag/%23adventurex2026)

Pocket Friend 是一个复古掌机风格的现场体验端 Web 项目。参与者先完成 3 题磁场问卷，再选择兴趣标签、录入信息并生成像素头像，最后进入 PALS 档案页；手机端的 MAP 保持为像素小岛静态预览，小人移动和更复杂的交互由现场大屏承担。

标签：`#adventurex2026`

## 适合谁

- 现场参与者：用一个轻量、有趣的流程快速生成自己的 Pocket Friend 档案。
- Demo 运营者：需要稳定的手机体验端，并把用户资料同步给现场大屏。
- Hackathon 评审：希望快速理解产品体验、功能边界和代码结构。
- 开发者：想参考一个小型 TypeScript monorepo，包含 Web 应用、服务端接口、管理后台和可测试的共享业务逻辑。

## 主要功能

- 3 题磁场问卷，自动推导四类特质之一：安静观察者、话痨点火机、好奇选手、松弛派。
- 问卷后进入兴趣标签选择，保留“至少 3 项”的轻量偏好表达。
- 信息录入与拍照流程，用于生成紧凑的 `72px / 28c` 像素头像。
- PALS 档案页展示用户卡片、磁场类型、兴趣标签和像素头像。
- 手机端 MAP 作为像素小岛静态预览，与现场大屏保持视觉统一，但不做小人交互。
- 保留原有底部导航结构：`MAP`、`PALS`、`SET`。
- 保留假匹配 / Demo 匹配逻辑，保证现场 walkthrough 稳定。
- 设备状态管理后台，包含基础认证、心跳上报、板端照片上传、照片历史和独立照片读取令牌。
- 面向静态体验端和独立管理后台的构建、部署脚本。

## 体验流程

```text
打开 Pocket Friend
  -> 完成 3 题磁场问卷
  -> 得到一个磁场类型
  -> 至少选择 3 个兴趣标签
  -> 录入姓名并上传/拍摄照片
  -> 生成像素头像
  -> 查看 PALS 个人档案卡
  -> 保留 Demo 匹配逻辑
  -> 打开 MAP 查看像素小岛预览
  -> 将用户资料同步到现场大屏通道
```

## 产品边界

- 复古掌机像素 UI、底部导航、PALS 卡片结构、SET 页面、拍照流程和 Demo 匹配逻辑保持稳定。
- 手机端 MAP 只做预览，不实现小人漫游、hover 或 click 交互。
- 大屏的小人移动和更丰富的场景交互不属于手机体验端范围。
- 公共仓库只描述可复用的软件体验，不暴露真实凭据、生产数据或现场私密配置。

## 隐私说明

- Demo 现场拍摄的访客照片只保存在自托管的 admin 服务上，不会提交到本仓库，除配置的像素化服务外也不会发给任何第三方。
- 照片会在 `PF_PHOTO_RETENTION_DAYS` 天后自动删除（默认部署为 7 天）；运维也可以直接从上传目录手动删除。
- 心跳仅记录粗粒度客户端信息（浏览器、系统、IP），只用于在管理面板展示设备在线状态，不用于任何追踪或画像。
- 手机端 Demo 的位置共享只存在于浏览器会话内，仅用于现场的邻近匹配演示。

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
| 移动端 Web 应用 | `apps/mobile` | 面向现场参与者的 Pocket Friend 体验端 | `npm run dev:mobile` |
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
