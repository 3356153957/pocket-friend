# Master 自动部署设计

## 目标

当 `3356153957/pocket-friend` 的 `master` 分支收到新提交时，由部署服务器上的 GitHub Actions 自托管 Runner 自动完成安装依赖、测试、类型检查、Web 构建、原子发布、服务重启和健康检查。

## 约束

- 仓库是公开仓库，自托管 Runner 不执行 `pull_request` 事件。
- 只有 `push` 到 `master` 和仓库维护者手动触发 `workflow_dispatch` 才能部署。
- Runner 使用专用 Linux 用户 `pf-deploy`，不以 root 身份运行。
- 高德公开 Web 凭据仍不提交到 Git；生产副本保存在 `/etc/pocket-friend/mobile.env`。
- GitHub Actions 仅获得 `contents: read` 权限。
- 现有 `pocket-friend.service` 继续监听 80 端口。

## 架构

Runner 安装到 `/opt/actions-runner`，并带有专用标签 `pocket-friend-prod`。工作流检出触发部署的精确提交，在 Runner 工作目录中执行 `scripts/deploy-production.mjs`。

部署脚本从 `/etc/pocket-friend/mobile.env` 读取两个 `EXPO_PUBLIC_AMAP_*` 变量，依次执行：

1. `npm ci`
2. `npm test`
3. `npm run typecheck`
4. `npm run build:sites`
5. 校验 `dist/client/index.html`、JavaScript 资源和环境变量嵌入结果

通过校验后，产物复制到 `/srv/pocket-friend/releases/<sha>-<run-id>-<attempt>`。脚本使用临时符号链接加原子重命名更新 `/srv/pocket-friend/current`，然后仅通过受限 sudo 规则重启 `pocket-friend.service`。

## 回滚和并发

- GitHub Actions 使用固定的 production concurrency group，同一时间只运行一个生产部署。
- 服务器端使用 `flock` 锁防止工作流和人工触发重叠。
- 切换前记录当前 release。
- 重启后最多等待 10 秒，要求首页和首页引用的 JavaScript 均返回 HTTP 200。
- 健康检查失败时恢复旧符号链接并再次重启服务。
- 发布目录暂不自动清理，避免错误删除；后续可单独增加保留策略。

## 服务器权限

- `/srv/pocket-friend` 归 `pf-deploy:pf-deploy` 所有。
- `/etc/pocket-friend/mobile.env` 归 `root:pf-deploy` 所有，权限 `0640`。
- `/etc/sudoers.d/pocket-friend-deploy` 只允许 `pf-deploy` 无密码执行：
  - `systemctl restart pocket-friend.service`
  - `systemctl is-active --quiet pocket-friend.service`
- systemd 服务以 root 运行现有静态服务器，但静态根目录改为 `/srv/pocket-friend/current`。

## 验证标准

- 本地部署单元测试、项目 52 项测试、类型检查均通过。
- Runner 服务在线，并在 GitHub API 中显示为 online。
- 自动部署工作流由一次真实的 `master` 推送触发并成功结束。
- `/srv/pocket-friend/current` 指向该工作流的提交 release。
- 服务器本机与公网首页、JavaScript 资源均返回 HTTP 200。
- 线上 JavaScript 确认包含生产高德变量，但日志不输出变量值。
