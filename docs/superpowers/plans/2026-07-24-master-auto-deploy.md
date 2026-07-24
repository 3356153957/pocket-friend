# Master 自动部署实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 配置一条由 `master` 推送触发、可验证且可回滚的服务器自动部署流水线。

**架构：** GitHub Actions 自托管 Runner 在专用用户下构建精确提交，Node 部署脚本校验产物后原子更新 `/srv/pocket-friend/current`。systemd 继续提供 80 端口服务，失败时恢复上一 release。

**技术栈：** GitHub Actions、自托管 Runner、Node.js 22、systemd、flock、npm/Expo。

---

## 文件结构

- 创建 `scripts/deploy-production-lib.mjs`：环境文件解析、资源路径校验和构建产物校验。
- 创建 `scripts/deploy-production.mjs`：构建、发布、重启、健康检查和回滚编排。
- 创建 `scripts/test/deploy-production.test.mjs`：部署纯函数和安全边界测试。
- 创建 `.github/workflows/deploy-production.yml`：生产部署触发器、权限、并发和 Runner 标签。
- 创建 `ops/pocket-friend.service`：生产静态服务的 systemd 单元。
- 创建 `ops/pocket-friend-deploy.sudoers`：Runner 仅可重启生产静态服务的 sudoers 规则。
- 创建 `ops/static-server.mjs`：带 realpath 根目录防护的非 root 静态服务器。
- 修改 `package.json`：增加部署测试入口。
- 创建本设计与计划文档：记录服务器约束和可复现操作。

### 任务 1：部署校验库

**文件：**
- 创建：`scripts/test/deploy-production.test.mjs`
- 创建：`scripts/deploy-production-lib.mjs`
- 修改：`package.json`

- [ ] **步骤 1：编写失败的测试**

测试必须覆盖：

```js
test("parseEnvFile 读取两个生产变量且不泄漏其他内容", () => {});
test("resolveAssetPath 拒绝越出构建目录的资源", () => {});
test("validateBuild 要求首页、脚本和两个变量均存在", () => {});
test("validateDeployIdentity 只接受完整 Git SHA 和数字运行编号", () => {});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test scripts/test/deploy-production.test.mjs`

预期：FAIL，原因是 `deploy-production-lib.mjs` 尚不存在。

- [ ] **步骤 3：实现最小校验库**

实现并导出：

```js
parseEnvFile(source)
resolveAssetPath(buildRoot, publicPath)
validateBuild({ buildRoot, publicEnv })
validateDeployIdentity({ sha, runId, attempt })
```

路径检查必须使用 `path.relative`，拒绝绝对路径、`..` 和构建目录本身。

- [ ] **步骤 4：运行测试验证通过**

运行：`node --test scripts/test/deploy-production.test.mjs`

预期：全部通过。

### 任务 2：生产部署脚本

**文件：**
- 创建：`scripts/deploy-production.mjs`
- 修改：`scripts/test/deploy-production.test.mjs`

- [ ] **步骤 1：增加失败测试**

增加发布目录命名和健康检查资源解析测试，确保 release 名称为：

```text
<40位sha>-<runId>-<attempt>
```

- [ ] **步骤 2：运行测试验证失败**

运行：`node --test scripts/test/deploy-production.test.mjs`

预期：FAIL，原因是新增导出尚不存在。

- [ ] **步骤 3：实现部署编排**

脚本必须：

```text
读取 PF_DEPLOY_ROOT / PF_DEPLOY_ENV_FILE / PF_DEPLOY_SERVICE / PF_DEPLOY_HEALTH_URL
执行 npm ci、npm test、npm run typecheck、npm run build:sites
验证 dist/client
复制到唯一 incoming 目录并原子重命名为 release
原子切换 current 符号链接
sudo -n systemctl restart 指定服务
轮询首页和 JavaScript 资源
失败时恢复上一符号链接
```

- [ ] **步骤 4：运行部署测试和项目测试**

运行：

```powershell
npm run test:deploy
npm test
npm run typecheck
```

预期：全部成功。

### 任务 3：GitHub Actions 工作流

**文件：**
- 创建：`.github/workflows/deploy-production.yml`
- 修改：`scripts/test/deploy-production.test.mjs`

- [ ] **步骤 1：增加工作流契约测试**

断言工作流只包含 `push.master` 和 `workflow_dispatch`，Runner 标签包含 `pocket-friend-prod`，权限为 `contents: read`，并使用 `flock` 调用部署脚本。

- [ ] **步骤 2：运行测试验证失败**

运行：`npm run test:deploy`

预期：FAIL，原因是工作流尚不存在。

- [ ] **步骤 3：创建最小工作流**

工作流环境固定为：

```yaml
PF_DEPLOY_ROOT: /srv/pocket-friend
PF_DEPLOY_ENV_FILE: /etc/pocket-friend/mobile.env
PF_DEPLOY_SERVICE: pocket-friend.service
PF_DEPLOY_HEALTH_URL: http://127.0.0.1/
```

- [ ] **步骤 4：运行全部验证**

运行：

```powershell
npm run test:deploy
npm test
npm run typecheck
```

预期：全部成功。

### 任务 4：服务器和 Runner 配置

**服务器文件：**
- 创建：`ops/pocket-friend.service`
- 创建：`ops/pocket-friend-deploy.sudoers`
- 创建：`ops/static-server.mjs`
- 创建：`/etc/pocket-friend/mobile.env`
- 创建：`/etc/sudoers.d/pocket-friend-deploy`
- 创建：`/srv/pocket-friend/releases/<seed>`
- 修改：`/etc/systemd/system/pocket-friend.service`
- 安装：`/opt/actions-runner`

- [ ] **步骤 1：创建 `pf-deploy` 系统用户和目录**

验证 `/srv/pocket-friend` 与 `/opt/actions-runner` 的解析后绝对路径，再创建并设置为 `pf-deploy` 所有。

- [ ] **步骤 2：迁移环境文件**

从现有 `/root/pocket-friend/apps/mobile/.env.local` 原子复制到 `/etc/pocket-friend/mobile.env`，设置 `root:pf-deploy` 和 `0640`，只检查大小和权限。

- [ ] **步骤 3：种子发布并迁移 systemd**

将当前已验证的 `dist/client` 复制到 seed release，创建 `current` 符号链接，将静态根目录改为 `/srv/pocket-friend/current`，daemon-reload、重启并验证 HTTP 200。

- [ ] **步骤 4：安装并注册 Runner**

从 GitHub 官方 release 下载 Linux x64 Runner，校验 GitHub API 返回的 SHA-256 digest，以 `pf-deploy` 注册标签 `pocket-friend-prod`，安装为 systemd 服务并确认 GitHub API 显示 online。

### 任务 5：发布和端到端验证

- [ ] **步骤 1：提交并推送功能分支**

运行：

```powershell
git add .github scripts package.json docs
git commit -m "ci: add master production auto deploy"
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push -u origin codex/auto-deploy
```

- [ ] **步骤 2：同步最新 master 并推送**

先 fetch/rebase；无冲突后将已验证提交快进推送到 `origin/master`，严禁 force push。

- [ ] **步骤 3：等待真实工作流结束**

使用 `gh run watch --exit-status` 等待 `Deploy production`，预期 conclusion 为 `success`。

- [ ] **步骤 4：核对服务器与公网**

检查 Runner active/online、`current` release 包含触发 SHA、systemd active、本机与公网首页/JavaScript HTTP 200、线上构建包含两个环境变量。
