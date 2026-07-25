# Pocket Friend 交接说明

更新时间：2026-07-25  
当前本地项目：`E:\Advx_Ball\pocket-friend-latest-preview`  
当前分支：`feature/encounter-profile-arrival-flow`  
当前状态：本地已完成一版可跑通链路，尚未提交、尚未推送。

## 1. 队友需要先知道的结论

这版重点不是单纯前端演示，而是把“问卷 -> 画像/磁场 -> 硬件照片 -> Seedream 像素小人 -> 入岛 -> PALS/SET 数据展示”的链路打通。

当前已完成：

- 登录入口修复：欢迎页可滚动，START 按钮不会被手机框裁掉。
- 演示级账号入口：账号/密码/昵称/角色/简介会保存到本地产品后端 profile。
- 五题问卷：按 PRD 生成 `magnetType`、`quizAnswers`、`tags`。
- Pendant 设置：保留原有交互风格，不大改整体 UI。
- Arrival 入岛：读取真实硬件照片接口最新照片。
- Seedream：用硬件照片调用豆包 Seedream 生成像素小人。
- 名字来源：居民名字来自硬件照片文件名/接口 name，不再用登录昵称覆盖。
- 岛屿交互：PALS 页点击四个建筑进入场景，场景内像素小人会动，真人照片作为头顶 badge。
- 返回路径：进入场景后有 BACK，可回到总岛。
- SET：能看到账号资料、后端状态、真实居民数据。
- Demo fallback：如果硬件/Seedream 失败，只作为兜底提示，不保存成真实居民。

## 2. 本地启动方式

在项目根目录运行两个服务：

```bash
npm run dev:gateway
```

如果默认端口不是 4312，可以指定：

```bash
$env:PORT="4312"; npm run dev:gateway
```

前端：

```bash
cd apps/mobile
npx vite --host 0.0.0.0 --port 5175 --strictPort
```

访问：

```text
http://127.0.0.1:5175/
```

后端健康检查：

```text
http://127.0.0.1:4312/health
```

产品数据接口：

```text
http://127.0.0.1:5175/product-api/residents
http://127.0.0.1:5175/product-api/scenes
```

## 3. 环境变量

项目根目录需要 `.env`，本机已经配置过。不要把真实 key 写进公开文档或提交到仓库。

需要的变量：

```env
VITE_DOUBAO_API_KEY=...
VITE_DOUBAO_RESOURCE_ID=...
VITE_DOUBAO_MODEL=doubao-seedream-5-0-260128
VITE_PF_PHOTO_TOKEN=...
PF_PHOTO_TOKEN=...
```

Seedream endpoint 在前端 Vite 代理里走：

```text
/seedream-api -> https://ark.cn-beijing.volces.com
```

硬件照片接口在前端 Vite 代理里走：

```text
/photo-api -> http://117.72.82.29:4311
```

产品本地后端在前端 Vite 代理里走：

```text
/product-api -> http://127.0.0.1:4312/api/product
```

## 4. 真实体验测试流程

1. 让硬件同学重新拍一张照片。
2. 确认照片接口最新一条变成新照片：

```text
http://127.0.0.1:5175/photo-api/api/photos/board-a/history
```

3. 刷新 `http://127.0.0.1:5175/`。
4. 在登录页填写演示账号资料，点击 START。
5. 完成五题问卷。
6. 完成 Pendant 设置。
7. 到 Arrival 页面等待：

```text
FETCHING PHOTO...
GENERATING SEEDREAM SPRITE...
PIXEL SPRITE READY...
ENTERING ISLAND...
```

8. 进入 PALS 后检查：

- 居民名字应来自照片文件名前缀，例如 `伽_41157...` -> `伽`。
- 小人下方应是 Seedream 生成的像素小人。
- 小人头顶应是真人照片 badge。
- 点击四个建筑可以进入对应场景。
- 场景内 BACK 能回到总岛。
- SET 里能看到真实 resident 数据。

## 5. 关键文件

问卷和画像：

- `apps/mobile/src/app/encounterProfile.ts`
- `apps/mobile/src/components/Quiz.tsx`

硬件照片与 Seedream：

- `apps/mobile/src/app/photoPipeline.ts`
- `apps/mobile/src/app/seedreamAvatar.ts`
- `apps/mobile/src/components/Arrival.tsx`
- `apps/mobile/src/app/screenResident.ts`

产品后端与数据：

- `apps/gateway/src/productStore.ts`
- `apps/gateway/src/router.ts`
- `apps/mobile/src/app/productApi.ts`

岛屿与居民展示：

- `apps/mobile/src/components/HomeWorld.tsx`
- `apps/mobile/src/components/InteractiveIsland.tsx`
- `apps/mobile/src/components/Settings.tsx`

登录入口和整体壳：

- `apps/mobile/src/components/Welcome.tsx`
- `apps/mobile/src/App.tsx`
- `apps/mobile/src/styles.css`

## 6. 重要逻辑边界

### 居民名字

居民名字必须来自硬件照片接口的 `name` 或 `id`，不能来自登录页昵称。

原因：登录页昵称是账号 profile，硬件照片文件名才代表被识别/采集的人。

### Demo fallback

如果照片接口失败、Seedream 超时或用户手动点击 demo fallback：

- 可以继续让前端看到兜底动画。
- 不能保存为真实 resident。
- 需要在 UI 中提示这是 fallback。

### MAP 页

MAP 页保留当前高德地图视觉，不要改成像素岛。像素岛交互在 PALS 页。

### PALS 页

总岛是四个建筑热点：

- 湖畔创业中心
- 通宵实验室
- 路演舞台
- 杭州未来科技城学术交流中心

点击建筑进入对应场景，场景里显示居民像素小人和真人照片 badge。

## 7. 本地持久化数据

本地产品后端数据在：

```text
apps/gateway/data/product-state.json
```

这个目录被 `.gitignore` 忽略，不会提交。

如果出现旧居民名，比如 `Luna`、错误中文名、旧硬件测试名，通常是本地持久化数据或旧网关进程残留。处理方式：

1. 停掉旧 gateway / Vite 进程。
2. 清空 `apps/gateway/data/product-state.json` 里的 `residents`。
3. 重启 gateway 和 Vite。
4. 重新检查 `/product-api/residents`。

当前我已清空旧居民数据，接口返回：

```json
{"residents":[]}
```

## 8. 已验证

已通过：

```bash
npm run typecheck
npm test
npm run build:web
```

测试结果：

- TypeScript 检查通过。
- 自动测试 93 个通过。
- Web 生产构建通过。
- Seedream 直连测试通过，最新硬件照片能返回生成图 URL。
- `/product-api/scenes` 返回四个正常中文场景。
- `/product-api/residents` 当前为空，等待下一次真实照片流程写入。

## 9. 提交建议

如果确认本地效果没问题，建议提交：

```bash
git add .
git commit -m "feat: finalize hardware photo to pixel island flow"
```

然后推到功能分支开 PR，不要直接推 master/main：

```bash
git push origin feature/encounter-profile-arrival-flow
```

## 10. 队友接手 TODO

优先级从高到低：

1. 用硬件新拍照片完整跑一遍，确认名字、真人 badge、Seedream 小人都正确。
2. 检查 PALS 四个场景热点位置是否贴合最终 UI 设计稿。
3. 检查 SET 里的账号资料和居民数据是否满足演示讲述。
4. 和大屏同学确认 `ScreenResident` 数据结构是否够用。
5. 合并前检查 `.env`、本地 data、log 文件没有被误提交。
6. 如果要部署，需要把 gateway 的产品数据存储从本地 JSON 换成可部署环境可写的存储。

## 11. 给队友的一句话

这版的核心链路已经通了：硬件照片进来，Seedream 生成像素小人，像素小人带着真人照片 badge 入岛并成为真实 resident。接手时重点别把“登录账号昵称”和“硬件照片识别出来的人名”混在一起，也别让 demo fallback 被保存成真实居民。
