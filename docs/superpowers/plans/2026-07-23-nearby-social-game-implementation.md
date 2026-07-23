# Pocket Friend 附近交友 Demo 实现计划

> 依据：`docs/superpowers/specs/2026-07-23-nearby-social-game-design.md`

## 技术栈

- npm workspaces + TypeScript
- Expo + React Native + Expo Web
- Vitest：领域逻辑与适配器测试
- Express：本地 JACOO Gateway
- Supabase JS：可选 Realtime Presence 适配器
- React Native SVG：固定像素地图绘制

## 任务 1：工作区与测试基线

文件：根目录 `package.json`、`tsconfig.base.json`、各 workspace 配置。

1. 建立 `packages/nearby-core`、`apps/mobile`、`apps/gateway`。
2. 配置统一 `typecheck`、`test`、`build:web` 命令。
3. 加入 `.env.example`，只写变量名和安全说明，不写任何凭据。
4. 运行空测试基线与类型检查。

## 任务 2：坐标与固定地图核心（TDD）

文件：`packages/nearby-core/src/geo.ts`、`map.ts` 及对应测试。

1. 先写 WGS84→GCJ-02、Haversine 距离、地图投影、越界钳制的失败测试。
2. 实现最小纯函数并通过测试。
3. 新增湖畔创研中心地图定义和真实地标数据。
4. 验证中心、四角、越界和杭州坐标转换误差范围。

## 任务 3：隐私、匹配与提醒状态机（TDD）

文件：`packages/nearby-core/src/privacy.ts`、`matching.ts`、`proximity.ts` 及对应测试。

1. 先写双方展示精度取更保守值的测试。
2. 先写过期、精度不足、关闭发现、超出范围的排除测试。
3. 实现附近候选计算、共同兴趣和可解释分数。
4. 先写进入只提醒一次、离开后可再次提醒的状态机测试，再实现。

## 任务 4：定位与在线状态接口（TDD）

文件：`packages/nearby-core/src/contracts.ts`、`apps/mobile/src/services/*`。

1. 定义 `LocationProvider` 与 `PresenceRepository`。
2. 实现确定性模拟定位和内存 Presence，先写契约测试。
3. 实现 Expo Location 适配器，覆盖权限拒绝和异常映射。
4. 实现 Supabase Presence 适配器；缺失配置时由组合层降级为内存实现。

## 任务 5：JACOO Gateway（TDD）

文件：`apps/gateway/src/*`。

1. 先写禁用开关、缺少凭据、上游错误、响应净化和过期标记测试。
2. 实现 `GET /api/location/jacoo/latest` 只读路由。
3. 凭据仅从 Gateway 环境变量读取，日志不得包含请求头或密钥。
4. 生产环境即使误配凭据也强制禁用 JACOO。

## 任务 6：8-bit 手机 Demo

文件：`apps/mobile/App.tsx`、`src/components/*`、`src/theme/*`。

1. 构建像素地图、玩家标记、定位状态栏和附近玩家列表。
2. 增加真实/模拟/JACOO 定位切换；JACOO 仅在开发配置开启时出现。
3. 增加可发现开关、范围滑块与距离精度分段控件。
4. 选中玩家时显示共同兴趣、匹配理由和允许公开的距离。
5. 进入范围时触发 Expo Haptics；Web 显示非阻塞提示。
6. 处理加载、拒绝权限、过期、离线和无候选状态。

## 任务 7：验收与交付

1. 运行 `npm test`、`npm run typecheck`、`npm run build:web`。
2. 启动 Expo Web，使用真实浏览器验证 375×812 与 1440×900。
3. 检查横向溢出、文字遮挡、触控尺寸、键盘焦点和 reduced-motion。
4. 用 `codebase_memory` 重新索引并执行变更影响检查。
5. 每完成一批可独立使用的改动立即 commit + push，不重写已发布历史。

