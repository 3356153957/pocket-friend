# T5AI 摄像头预览编译、烧录与使用实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 Windows 电脑上完成 TuyaOpen 环境搭建，编译并烧录官方 `lvgl_camera` 示例，使 T5AI-Board 的 3.5 英寸屏幕稳定显示摄像头实时画面。

**架构：** 首轮不修改 TuyaOpen 上游驱动，直接复用官方 TDL 摄像头、TDL 显示、DMA2D 格式转换和双帧缓冲实现。开发板通过 CH343 暴露的双串口完成固件下载和日志监视；通过串口日志与 10 分钟画面运行验证硬件链路。

**技术栈：** Windows 10/11、PowerShell、Python 3.12、Git、CMake、Ninja、GNU Make、TuyaOpen、`tos.py`、WCH CH343、T5AI-Board、DVP 摄像头、RGB565 LCD。

---

## 文件与目录职责

- `D:\TuyaOpen\`：从官方仓库克隆的 TuyaOpen SDK；不嵌入 Pocket Friend 仓库。
- `D:\TuyaOpen\.agents\skills\tuyaopen\`：官方 TuyaOpen AI 开发 Skill，供环境检查、构建、烧录和日志分析使用。
- `D:\TuyaOpen\examples\graphics\lvgl_camera\app_default.config`：官方示例的板型、LCD、摄像头和 LVGL 配置。
- `D:\TuyaOpen\examples\graphics\lvgl_camera\src\example_lvgl_camera.c`：官方摄像头预览入口；首轮只读取，不修改。
- `D:\TuyaOpen\examples\graphics\lvgl_camera\dist\`：`tos.py build` 生成的发布固件目录。
- `D:\TuyaOpen\examples\graphics\lvgl_camera\.target_logging\`：串口监视日志目录。
- `docs/superpowers/specs/2026-07-23-tuya-t5ai-camera-preview-design.md`：本计划对应的已确认规格。
- `docs/superpowers/plans/2026-07-23-tuya-t5ai-camera-preview-bringup.md`：本执行计划。

当前本机基线：Python 3.12 和 Git 已安装；CMake、Ninja、GNU Make、`tos.py`、TuyaOpen SDK 均未安装；当前没有连接中的串口；未检测到明确的 CH343 串口驱动。

### 任务 1：安装 Windows 构建工具

**文件：**
- 外部安装：`C:\Program Files\CMake\`
- 外部安装：由 Winget 管理的 Ninja 与 GNU Make

- [ ] **步骤 1：确认已有 Python 和 Git**

运行：

```powershell
python --version
git --version
```

预期：Python 输出 `3.12.x`；Git 输出 `2.x`。

- [ ] **步骤 2：安装 CMake**

运行：

```powershell
winget install --id Kitware.CMake --exact --accept-source-agreements --accept-package-agreements
```

预期：安装成功，或提示已安装同版本/更高版本。

- [ ] **步骤 3：安装 Ninja**

运行：

```powershell
winget install --id Ninja-build.Ninja --exact --accept-source-agreements --accept-package-agreements
```

预期：安装成功，或提示已安装同版本/更高版本。

- [ ] **步骤 4：安装 GNU Make**

运行：

```powershell
winget install --id GnuWin32.Make --exact --accept-source-agreements --accept-package-agreements
```

预期：安装成功，或提示已安装同版本/更高版本。

- [ ] **步骤 5：重新打开 PowerShell 并验证工具**

运行：

```powershell
cmake --version
ninja --version
make --version
```

预期：CMake 不低于 `3.28`，Ninja 不低于 `1.6`，Make 不低于 `3.0`。

### 任务 2：安装 CH343 驱动并识别开发板

**文件：**
- 外部安装：WCH `CH343SER` Windows 驱动包

- [ ] **步骤 1：从 WCH 官方页面下载并安装驱动**

下载地址：

```text
https://www.wch-ic.com/downloads/CH343SER_ZIP.html
```

人工操作：解压驱动包，以管理员身份运行其中的安装程序，完成后重新插拔 T5AI-Board。

- [ ] **步骤 2：使用可传输数据的 USB-C 线连接开发板**

人工检查：开发板正常供电；Windows 没有显示“未知 USB 设备”。

- [ ] **步骤 3：验证 CH343 双串口**

运行：

```powershell
$t5Ports = @(Get-CimInstance Win32_SerialPort |
    Where-Object { $_.PNPDeviceID -match 'VID_1A86&PID_55D2' } |
    Sort-Object DeviceID)
$t5Ports | Select-Object DeviceID,Name,PNPDeviceID | Format-Table -AutoSize
if ($t5Ports.Count -ne 2) { throw "预期 2 个 T5AI 串口，实际为 $($t5Ports.Count) 个" }
```

预期：输出两个 COM 口，且脚本不抛出异常。

- [ ] **步骤 4：记录第一次尝试使用的端口**

运行：

```powershell
$flashPort = $t5Ports[0].DeviceID
$logPort = $t5Ports[1].DeviceID
"FLASH=$flashPort LOG=$logPort"
```

预期：输出两个不同的 COM 号。低编号先作为烧录口，高编号先作为日志口；若后续失败则交换。

### 任务 3：下载 TuyaOpen 和官方开发 Skill

**文件：**
- 创建：`D:\TuyaOpen\`
- 创建：`D:\TuyaOpen\.agents\skills\tuyaopen\`
- 临时创建：`D:\TuyaOpen-dev-skills\`

- [ ] **步骤 1：克隆 TuyaOpen SDK**

运行：

```powershell
git -c http.proxy=http://127.0.0.1:7897 `
    -c https.proxy=http://127.0.0.1:7897 `
    clone https://github.com/tuya/TuyaOpen.git D:\TuyaOpen
```

预期：`D:\TuyaOpen\tos.py` 和 `D:\TuyaOpen\export.ps1` 存在。

- [ ] **步骤 2：克隆涂鸦官方 Skill 仓库**

运行：

```powershell
git -c http.proxy=http://127.0.0.1:7897 `
    -c https.proxy=http://127.0.0.1:7897 `
    clone https://github.com/tuya/TuyaOpen-dev-skills.git D:\TuyaOpen-dev-skills
```

预期：`D:\TuyaOpen-dev-skills\skills\tuyaopen\env-setup\SKILL.md` 存在。

- [ ] **步骤 3：复制 Skill 到 TuyaOpen SDK**

运行：

```powershell
New-Item -ItemType Directory -Force -Path D:\TuyaOpen\.agents\skills | Out-Null
Copy-Item -Recurse -Force `
    D:\TuyaOpen-dev-skills\skills\tuyaopen `
    D:\TuyaOpen\.agents\skills\tuyaopen
Test-Path D:\TuyaOpen\.agents\skills\tuyaopen\dev-loop\SKILL.md
```

预期：最后输出 `True`。

- [ ] **步骤 4：让 SDK 工作树忽略本地 Skill 目录**

在 `D:\TuyaOpen\.git\info\exclude` 末尾加入一行：

```text
.agents/
```

运行：

```powershell
git -C D:\TuyaOpen status --short
```

预期：没有因 `.agents` 产生未跟踪文件。

### 任务 4：激活并验证 TuyaOpen 环境

**文件：**
- 生成：`D:\TuyaOpen\.venv\`
- 更新：TuyaOpen 子模块工作目录

- [ ] **步骤 1：进入 SDK 并激活 PowerShell 环境**

运行：

```powershell
Set-Location D:\TuyaOpen
. .\export.ps1
```

预期：当前终端出现 TuyaOpen 虚拟环境，`$env:OPEN_SDK_ROOT` 等于 `D:\TuyaOpen`。

若 PowerShell 拒绝执行脚本，运行一次：

```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

关闭并重新打开 PowerShell，再次执行激活命令。

- [ ] **步骤 2：验证 `tos.py` 版本**

运行：

```powershell
tos.py version
```

预期：输出 TuyaOpen `tos.py` 版本，且没有“command not found”。

- [ ] **步骤 3：执行完整环境检查**

运行：

```powershell
tos.py check
```

预期：Git、CMake、Make、Ninja 检查均为 `is ok`，子模块初始化成功。

### 任务 5：配置和编译官方摄像头预览示例

**文件：**
- 读取：`D:\TuyaOpen\examples\graphics\lvgl_camera\src\example_lvgl_camera.c`
- 选择：`D:\TuyaOpen\examples\graphics\lvgl_camera\config\TUYA_T5AI_BOARD_LCD_3.5.config`
- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\app_default.config`
- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\.build\`
- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\dist\`

- [ ] **步骤 1：进入官方示例目录**

运行：

```powershell
Set-Location D:\TuyaOpen\examples\graphics\lvgl_camera
```

预期：当前目录包含 `CMakeLists.txt`、`app_default.config`、`config` 和 `src`。

- [ ] **步骤 2：选择 T5AI 3.5 英寸 LCD 配置**

运行：

```powershell
tos.py config choice -c TUYA_T5AI_BOARD_LCD_3.5.config
```

预期：配置选择成功，`app_default.config` 包含：

```text
CONFIG_BOARD_CHOICE_T5AI=y
CONFIG_TUYA_T5AI_BOARD_EX_MODULE_35565LCD=y
CONFIG_ENABLE_EX_MODULE_CAMERA=y
CONFIG_ENABLE_LIBLVGL=y
```

- [ ] **步骤 3：清理旧构建产物**

运行：

```powershell
tos.py clean -f
```

预期：旧 `.build` 缓存被清理，无错误退出。

- [ ] **步骤 4：编译固件**

运行：

```powershell
tos.py build
```

预期：命令以退出码 `0` 完成，并在结尾打印固件输出路径。

- [ ] **步骤 5：验证本次构建产生了固件**

运行：

```powershell
$firmware = Get-ChildItem -Path .\dist -Recurse -File |
    Where-Object { $_.Extension -in '.bin','.ua','.ug','.qio' } |
    Sort-Object LastWriteTime -Descending
$firmware | Select-Object -First 10 FullName,Length,LastWriteTime | Format-Table -AutoSize
if (-not $firmware) { throw 'dist 目录中没有找到固件文件' }
```

预期：至少列出一个本次构建生成且长度大于 0 的固件文件。

- [ ] **步骤 6：提交点检查**

本任务只构建上游官方示例，不修改 Pocket Friend 或 TuyaOpen 源码，因此不创建代码提交。保存完整构建输出作为验证证据。

### 任务 6：烧录固件到 T5AI-Board

**文件：**
- 使用：任务 5 生成的 `dist` 固件

- [ ] **步骤 1：在同一 PowerShell 会话重新读取串口**

运行：

```powershell
$t5Ports = @(Get-CimInstance Win32_SerialPort |
    Where-Object { $_.PNPDeviceID -match 'VID_1A86&PID_55D2' } |
    Sort-Object DeviceID)
if ($t5Ports.Count -ne 2) { throw "预期 2 个 T5AI 串口，实际为 $($t5Ports.Count) 个" }
$flashPort = $t5Ports[0].DeviceID
$logPort = $t5Ports[1].DeviceID
```

预期：变量 `$flashPort` 和 `$logPort` 分别保存两个 COM 号。

- [ ] **步骤 2：第一次烧录**

运行：

```powershell
tos.py flash -p $flashPort
```

预期：擦除、写入和校验完成，命令以退出码 `0` 结束。

- [ ] **步骤 3：仅在第一次烧录失败时交换端口**

运行：

```powershell
$swap = $flashPort
$flashPort = $logPort
$logPort = $swap
tos.py flash -p $flashPort -d
```

预期：交换后烧录成功；若仍失败，停止执行并检查驱动、USB 数据线、端口占用和开发板复位状态。

### 任务 7：启动日志并使用摄像头预览

**文件：**
- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\.target_logging\camera-preview.log`

- [ ] **步骤 1：启动串口监视并保存日志**

运行：

```powershell
New-Item -ItemType Directory -Force -Path .\.target_logging | Out-Null
tos.py monitor -p $logPort -l .\.target_logging\camera-preview.log
```

预期：以 T5AI 默认 `460800` 波特率看到启动日志，且没有持续刷新的错误或重启信息。

- [ ] **步骤 2：确认初始 LVGL 页面**

人工检查：屏幕显示 `Hello World` 和递增计数器，背光稳定，无黑屏或花屏。

- [ ] **步骤 3：切换到摄像头预览**

人工操作：短按开发板示例绑定的功能按键一次。

预期：屏幕切换为摄像头实时画面；当前上游源码目标为 `480x480`、`15 FPS`。

- [ ] **步骤 4：切回 LVGL 页面**

人工操作：再次短按同一功能按键。

预期：屏幕恢复 `Hello World` 页面，计数继续更新。

- [ ] **步骤 5：退出串口监视**

人工操作：在 PowerShell 中按 `Ctrl+C`。

预期：串口被释放，日志保存在 `.target_logging\camera-preview.log`。

### 任务 8：完成 10 分钟稳定性验证

**文件：**
- 读取：`D:\TuyaOpen\examples\graphics\lvgl_camera\.target_logging\camera-preview.log`

- [ ] **步骤 1：重新进入摄像头预览并连续运行 10 分钟**

人工检查：画面连续刷新，无持续黑屏、花屏、明显撕裂或冻结。

- [ ] **步骤 2：扫描错误和重启迹象**

运行：

```powershell
$patterns = 'ty E\]','OPRT_','watchdog reset','malloc failed','reboot','exception'
$hits = Select-String -Path .\.target_logging\camera-preview.log -Pattern $patterns
if ($hits) { $hits; throw '日志中发现错误或重启迹象' }
'CAMERA_PREVIEW_LOG_OK'
```

预期：输出 `CAMERA_PREVIEW_LOG_OK`。

- [ ] **步骤 3：确认 Pocket Friend 固件分支保持干净**

运行：

```powershell
git -C D:\Users\17\Documents\friend\.worktrees\tuya-t5ai-firmware status --short
```

预期：没有未提交修改。首轮只验证官方示例，不把 TuyaOpen 构建产物提交到 Pocket Friend 仓库。

- [ ] **步骤 4：记录验证结果**

验证通过后，在固件分支新增一份带日期的点亮记录，至少写明：工具版本、两个 COM 口的实际分工、构建结果、烧录结果、LCD 结果、摄像头结果、10 分钟日志扫描结果和遇到的问题。该记录单独提交并推送，不与后续产品固件代码混合。

## 完成定义

- `tos.py check` 所有依赖检查通过；
- `lvgl_camera` 官方示例构建和烧录成功；
- LVGL 页面与摄像头预览可通过按键双向切换；
- 摄像头预览连续运行 10 分钟；
- 日志中没有错误、内存耗尽、异常或反复重启；
- 实际工具版本、COM 口分工和验证结果已经记录到固件分支。
