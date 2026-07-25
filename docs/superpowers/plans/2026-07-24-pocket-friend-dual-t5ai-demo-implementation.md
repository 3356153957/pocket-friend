# Pocket Friend 双 T5AI 硬件 Demo 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在两台 T5AI-Board 上实现同一热点内的自动发现、触摸/按钮双向确认、电机震动、同步倒计时拍照和本机结果显示。

**架构：** 两台设备运行同一套分模块固件，通过生成的运行时配置区分 A/B。所有驱动回调只向单一应用事件队列投递事件，`pf_app` 串行驱动状态机；LVGL 始终拥有显示硬件，摄像头预览通过 LVGL canvas 显示，杜绝摄像头与 UI 直接争抢屏幕。局域网 UDP 负责心跳、确认、准备、捕捉和结果消息，关键消息使用重发与去重。

**技术栈：** TuyaOpen T5AI、C99、LVGL v9、TAL Wi-Fi/Network/Thread/Queue/Timer API、TDL Camera/Button/Touch、TB6612FNG、PowerShell 验证与构建脚本。

---

## 参考实现

实现前完整阅读下列 TuyaOpen 文件，不复制相册存储等范围外代码：

- `D:\TuyaOpen\examples\graphics\lvgl_photo_album\src\example_camera.c`：JPEG 抓拍、YUV 回调、信号量和缓冲区所有权。
- `D:\TuyaOpen\examples\graphics\lvgl_photo_album\src\example_ui.c`：LVGL v9 初始化、触摸输入、camera canvas、JPEG 解码和静态图片显示。
- `D:\TuyaOpen\examples\wifi\sta\src\example_wifi_sta.c`：Wi-Fi STA 初始化与事件回调。
- `D:\TuyaOpen\src\tuya_cloud_service\netcfg\ap_netcfg.c`：TAL UDP broadcast socket 创建与发送方式。
- `D:\TuyaOpen\src\tuya_cloud_service\lan\tuya_lan.c`：`tal_net_recvfrom`、单播回复与 socket 清理。

## 文件结构

### 新建

- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_demo_config.h`：无敏感信息的端口、超时、设备 ID 类型和编译期常量。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_protocol.h`：UDP 消息类型、线格式和编解码接口。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_protocol.c`：固定长度 UDP 包编解码、版本检查和去重键生成。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_state_machine.h`：应用状态、事件、效果位和状态机接口。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_state_machine.c`：纯业务状态转换，不直接调用硬件。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_motor.h`：震动模式接口。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_motor.c`：P6/P7 安全初始化、队列化震动节奏和强制停止。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_input.h`：统一输入动作与回调。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_input.c`：物理按钮事件转换和 UI 输入转发。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_camera.h`：预览、抓拍和 JPEG 生命周期接口。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_camera.c`：基于官方 photo album 示例的摄像头封装。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_ui.h`：六个页面、预览画布和结果图片接口。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c`：320x480 LVGL 竖屏 UI 与触摸事件。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_transport.h`：Wi-Fi/UDP 事件和发送接口。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_transport.c`：热点连接、心跳、收发、重发、去重和掉线检测。
- `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_app.h`：应用事件队列和组合根接口。
- `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_app.c`：状态效果执行、A 机协调、倒计时和拍照结果汇合。
- `firmware/tuya-t5ai/tests/validate-dual-demo.ps1`：源代码契约、秘密扫描、状态/协议/UI/集成静态验证。
- `firmware/tuya-t5ai/scripts/build-dual-demo.ps1`：分别生成 A/B 运行时配置并构建两个固件。

### 修改

- `firmware/tuya-t5ai/overlays/lvgl_camera/src/example_lvgl_camera.c`：缩减为初始化日志、板级注册和 `pf_app_start()` 组合入口。
- `firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1`：递归同步 `src/` 与 `include/`，生成不入库的运行时配置头。
- `firmware/tuya-t5ai/tests/validate-button-motor.ps1`：改为验证 `pf_motor`，不再要求电机逻辑位于入口文件。
- `firmware/tuya-t5ai/config/TUYA_T5AI_BOARD_LCD_3.5.config`：确认 LVGL v9、触摸、摄像头、Wi-Fi 和图像转换依赖均启用。

## 任务 1：扩展 overlay 同步和无凭据运行时配置

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_demo_config.h`
- 创建：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`
- 修改：`firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1`

- [ ] **步骤 1：编写失败的同步契约测试**

在 `validate-dual-demo.ps1` 中读取同步脚本并断言它包含 `DeviceId` 参数、递归复制 `src`/`include`、读取 `PF_WIFI_SSID`/`PF_WIFI_PASSWORD` 环境变量并生成 `pf_demo_runtime_config.h`：

```powershell
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sync = Get-Content -Raw (Join-Path $root 'scripts\sync-lvgl-camera.ps1')

@(
    '[ValidateSet(''A'', ''B'')]'
    '$DeviceId'
    'PF_WIFI_SSID'
    'PF_WIFI_PASSWORD'
    'pf_demo_runtime_config.h'
    'Copy-Item'
) | ForEach-Object {
    if (-not $sync.Contains($_)) { throw "Missing dual-demo sync contract: $_" }
}

$tracked = Get-ChildItem $root -Recurse -File | Get-Content -Raw
if ($tracked -match '#define\s+PF_WIFI_PASSWORD\s+"(?!<)[^"]+"') {
    throw 'A plaintext Wi-Fi password is tracked in firmware files'
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
```

预期：FAIL，提示缺少 `DeviceId` 或 `pf_demo_runtime_config.h`。

- [ ] **步骤 3：定义公共配置并升级同步脚本**

`pf_demo_config.h` 提供以下固定常量，真实热点配置只存在于生成文件：

```c
#ifndef PF_DEMO_CONFIG_H
#define PF_DEMO_CONFIG_H

#include "pf_demo_runtime_config.h"

#define PF_PROTOCOL_VERSION        1U
#define PF_UDP_PORT                37800U
#define PF_HEARTBEAT_MS            1000U
#define PF_PEER_TIMEOUT_MS         3000U
#define PF_CONFIRM_TIMEOUT_MS      10000U
#define PF_CAPTURE_DELAY_MS        3000U
#define PF_CAPTURE_TIMEOUT_MS      3000U
#define PF_CRITICAL_RETRY_COUNT    3U
#define PF_CRITICAL_RETRY_GAP_MS   100U

#endif
```

同步脚本签名必须是：

```powershell
param(
    [string]$TuyaOpenRoot = 'D:\TuyaOpen',
    [Parameter(Mandatory)]
    [ValidateSet('A', 'B')]
    [string]$DeviceId
)
```

脚本从 `$env:PF_WIFI_SSID` 和 `$env:PF_WIFI_PASSWORD` 读取热点信息；任一为空立即失败。它将 overlay 的 `src` 和 `include` 目录递归复制到 `D:\TuyaOpen\examples\graphics\lvgl_camera`，并在目标 `include` 目录生成：

```c
#define PF_DEVICE_ID 'A'
#define PF_PEER_ID 'B'
#define PF_WIFI_SSID "runtime-value"
#define PF_WIFI_PASSWORD "runtime-value"
```

生成文件不得写回项目仓。

- [ ] **步骤 4：运行测试和脚本解析验证**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
[scriptblock]::Create((Get-Content -Raw .\firmware\tuya-t5ai\scripts\sync-lvgl-camera.ps1)) | Out-Null
```

预期：两条命令均成功；第一条输出 `PASS: dual-demo source contract.`。

- [ ] **步骤 5：提交**

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_demo_config.h firmware/tuya-t5ai/tests/validate-dual-demo.ps1 firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1
git commit -m "build(firmware): prepare dual-device demo overlay"
```

## 任务 2：实现协议编解码和纯状态机

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_protocol.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_protocol.c`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_state_machine.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_state_machine.c`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：扩展失败测试，声明协议与状态契约**

向验证脚本加入路径检查，并断言以下名称存在：

```powershell
$requiredSymbols = @(
    'PF_MSG_HELLO', 'PF_MSG_CONFIRM', 'PF_MSG_CANCEL',
    'PF_MSG_CAPTURE_PREPARE', 'PF_MSG_PREPARE_ACK',
    'PF_MSG_CAPTURE', 'PF_MSG_CAPTURED', 'PF_MSG_SUCCESS', 'PF_MSG_RESET',
    'pf_protocol_encode', 'pf_protocol_decode',
    'PF_STATE_ONLINE_IDLE', 'PF_STATE_PEER_FOUND', 'PF_STATE_WAITING_CONFIRM',
    'PF_STATE_COUNTDOWN', 'PF_STATE_CAPTURING', 'PF_STATE_SUCCESS',
    'pf_state_dispatch'
)
```

测试还必须拒绝在 `pf_state_machine.c` 中出现 `tal_`、`tdl_`、`lv_` 或 `tkl_` 调用，确保状态机不依赖硬件。

- [ ] **步骤 2：运行测试验证失败**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
```

预期：FAIL，提示缺少 `pf_protocol.h`。

- [ ] **步骤 3：实现固定线格式**

在 `pf_protocol.h` 定义：

```c
typedef enum {
    PF_MSG_HELLO = 1,
    PF_MSG_CONFIRM,
    PF_MSG_CANCEL,
    PF_MSG_CAPTURE_PREPARE,
    PF_MSG_PREPARE_ACK,
    PF_MSG_CAPTURE,
    PF_MSG_CAPTURED,
    PF_MSG_SUCCESS,
    PF_MSG_RESET,
} PF_MESSAGE_TYPE_E;

typedef struct {
    uint8_t  version;
    uint8_t  type;
    char     device_id;
    uint8_t  state;
    uint32_t session_id;
    uint32_t message_id;
    uint32_t sequence;
    uint32_t timestamp_ms;
    int32_t  result;
} PF_MESSAGE_T;

#define PF_WIRE_PACKET_SIZE 32U

OPERATE_RET pf_protocol_encode(const PF_MESSAGE_T *message,
                               uint8_t out[PF_WIRE_PACKET_SIZE]);
OPERATE_RET pf_protocol_decode(const uint8_t *data, uint32_t len,
                               PF_MESSAGE_T *message);
```

`pf_protocol.c` 使用固定 magic `0x5046444D`（`PFDM`）、网络字节序和严格长度检查。解码必须拒绝错误 magic、错误版本、未知消息类型和非 `PF_WIRE_PACKET_SIZE` 长度。

- [ ] **步骤 4：实现纯状态机与效果位**

在 `pf_state_machine.h` 定义：

```c
typedef enum {
    PF_STATE_BOOT,
    PF_STATE_CONNECTING,
    PF_STATE_ONLINE_IDLE,
    PF_STATE_CAMERA_PREVIEW,
    PF_STATE_PEER_FOUND,
    PF_STATE_WAITING_CONFIRM,
    PF_STATE_CAPTURE_PREPARE,
    PF_STATE_COUNTDOWN,
    PF_STATE_CAPTURING,
    PF_STATE_WAITING_RESULT,
    PF_STATE_SUCCESS,
    PF_STATE_DND,
    PF_STATE_RECONNECTING,
    PF_STATE_ERROR,
} PF_STATE_E;

typedef enum {
    PF_EVENT_STARTED,
    PF_EVENT_WIFI_CONNECTED,
    PF_EVENT_WIFI_LOST,
    PF_EVENT_PEER_FOUND,
    PF_EVENT_LOCAL_CONFIRM,
    PF_EVENT_PEER_CONFIRM,
    PF_EVENT_LOCAL_CANCEL,
    PF_EVENT_PREPARE_REQUEST,
    PF_EVENT_PREPARE_ACK,
    PF_EVENT_CAPTURE_COMMAND,
    PF_EVENT_CAPTURE_OK,
    PF_EVENT_CAPTURE_FAILED,
    PF_EVENT_PEER_CAPTURED,
    PF_EVENT_SUCCESS,
    PF_EVENT_TIMEOUT,
    PF_EVENT_ENTER_DND,
    PF_EVENT_EXIT_DND,
} PF_EVENT_E;

typedef uint32_t PF_EFFECTS_T;

typedef struct {
    PF_STATE_E state;
    bool local_confirmed;
    bool peer_confirmed;
    bool local_captured;
    bool peer_captured;
    uint32_t session_id;
} PF_STATE_CONTEXT_T;

void pf_state_init(PF_STATE_CONTEXT_T *ctx);
OPERATE_RET pf_state_dispatch(PF_STATE_CONTEXT_T *ctx,
                              PF_EVENT_E event,
                              PF_EFFECTS_T *effects);
```

效果位至少包含 UI 刷新、电机反馈、发送确认、发送取消、发送准备、发送 ACK、发送捕捉、执行拍照、发送拍照结果、发送成功和安全复位。非法状态/事件组合返回 `OPRT_INVALID_PARM`，且不得改变上下文。

- [ ] **步骤 5：验证通过并编译完整工程**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
$env:PF_WIFI_SSID = Read-Host 'Hotspot SSID'
$wifiSecret = Read-Host 'Hotspot password' -AsSecureString
$env:PF_WIFI_PASSWORD = [Net.NetworkCredential]::new('', $wifiSecret).Password
& .\firmware\tuya-t5ai\scripts\sync-lvgl-camera.ps1 -DeviceId A
Set-Location D:\TuyaOpen\examples\graphics\lvgl_camera
. D:\TuyaOpen\export.ps1
tos.py build
```

预期：契约测试 PASS；构建输出 `BUILD SUCCESS` 和 `Board : TUYA_T5AI_BOARD`。

- [ ] **步骤 6：提交**

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_protocol.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_protocol.c firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_state_machine.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_state_machine.c firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "feat(firmware): define dual-demo protocol and state machine"
```

## 任务 3：实现安全电机反馈和统一输入

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_motor.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_motor.c`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_input.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_input.c`
- 修改：`firmware/tuya-t5ai/tests/validate-button-motor.ps1`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：先把现有电机测试改为模块契约并确认失败**

测试改为读取 `pf_motor.c`，要求 P6/P7、启动默认低电平、`pf_motor_stop()` 和全部震动模式；读取 `pf_input.c`，要求单击、长按、50ms 消抖和统一回调。

```powershell
$motorRequired = @(
    'TUYA_GPIO_NUM_6', 'TUYA_GPIO_NUM_7',
    'PF_MOTOR_PATTERN_PEER_FOUND', 'PF_MOTOR_PATTERN_LOCAL_CONFIRMED',
    'PF_MOTOR_PATTERN_WAITING', 'PF_MOTOR_PATTERN_BOTH_CONFIRMED',
    'PF_MOTOR_PATTERN_SUCCESS', 'PF_MOTOR_PATTERN_ERROR',
    'pf_motor_stop'
)
```

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
```

预期：FAIL，提示缺少 `pf_motor.c`。

- [ ] **步骤 2：实现非阻塞电机模式任务**

`pf_motor.h` 暴露：

```c
typedef enum {
    PF_MOTOR_PATTERN_PEER_FOUND,
    PF_MOTOR_PATTERN_LOCAL_CONFIRMED,
    PF_MOTOR_PATTERN_WAITING,
    PF_MOTOR_PATTERN_BOTH_CONFIRMED,
    PF_MOTOR_PATTERN_SUCCESS,
    PF_MOTOR_PATTERN_ERROR,
} PF_MOTOR_PATTERN_E;

OPERATE_RET pf_motor_init(void);
OPERATE_RET pf_motor_play(PF_MOTOR_PATTERN_E pattern);
OPERATE_RET pf_motor_stop(void);
```

实现使用一个长度为 4 的队列和专用低优先级任务执行节奏；`pf_motor_play` 只入队，不在状态机线程中 sleep。`pf_motor_stop` 必须立即将 P6/P7 写低并清除等待模式。初始化顺序为配置 P6/P7 推挽输出低电平，再创建队列与任务。

- [ ] **步骤 3：实现统一输入动作**

`pf_input.h` 暴露：

```c
typedef enum {
    PF_INPUT_CONFIRM,
    PF_INPUT_CANCEL,
    PF_INPUT_COMPLETE,
    PF_INPUT_TOGGLE_DND,
    PF_INPUT_OPEN_CAMERA,
    PF_INPUT_CLOSE_CAMERA,
    PF_INPUT_RETRY,
} PF_INPUT_ACTION_E;

typedef void (*PF_INPUT_CB)(PF_INPUT_ACTION_E action, void *ctx);

OPERATE_RET pf_input_init(PF_INPUT_CB cb, void *ctx);
void pf_input_post_from_ui(PF_INPUT_ACTION_E action);
```

同时定义输入模式和设置接口：

```c
typedef enum {
    PF_INPUT_MODE_IDLE,
    PF_INPUT_MODE_PREVIEW,
    PF_INPUT_MODE_MATCH,
    PF_INPUT_MODE_WAITING,
    PF_INPUT_MODE_RESULT,
    PF_INPUT_MODE_LOCKED,
} PF_INPUT_MODE_E;

void pf_input_set_mode(PF_INPUT_MODE_E mode);
```

物理按钮单击根据当前由 App 设置的输入模式映射为确认、取消、完成或关闭相机；长按 1.5 秒统一映射为 `PF_INPUT_TOGGLE_DND`。按钮回调只投递动作，不控制电机或相机。App 每次进入新状态时必须调用 `pf_input_set_mode`，倒计时和拍照阶段使用 `PF_INPUT_MODE_LOCKED`。

- [ ] **步骤 4：运行测试和完整构建**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
Set-Location D:\TuyaOpen\examples\graphics\lvgl_camera
tos.py build
```

预期：两项测试 PASS，构建成功，无 `unused-function` 或 `unused-variable`。

- [ ] **步骤 5：提交**

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_motor.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_motor.c firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_input.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_input.c firmware/tuya-t5ai/tests/validate-button-motor.ps1 firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "feat(firmware): add safe motor and input modules"
```

## 任务 4：实现 PSRAM JPEG 抓拍和预览帧回调

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_camera.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_camera.c`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：添加失败的摄像头生命周期测试**

验证脚本要求以下接口和保护：

```powershell
$cameraRequired = @(
    'TDL_CAMERA_FMT_JPEG_YUV422_BOTH',
    'pf_camera_preview_enable',
    'pf_camera_set_frame_cb',
    'pf_camera_capture_jpeg',
    'pf_camera_release_jpeg',
    'PF_CAPTURE_TIMEOUT_MS',
    'tal_semaphore_wait',
    'tal_mutex_lock'
)
```

运行测试，预期 FAIL，提示缺少 `pf_camera.c`。

- [ ] **步骤 2：基于官方 photo album 摄像头模块实现最小接口**

`pf_camera.h` 定义：

```c
#define PF_CAMERA_WIDTH  480U
#define PF_CAMERA_HEIGHT 480U

typedef void (*PF_CAMERA_FRAME_CB)(uint8_t *yuv_data,
                                   uint16_t width,
                                   uint16_t height);

OPERATE_RET pf_camera_init(void);
void pf_camera_preview_enable(bool enable);
void pf_camera_set_frame_cb(PF_CAMERA_FRAME_CB cb);
OPERATE_RET pf_camera_capture_jpeg(uint8_t **data, uint32_t *len);
void pf_camera_release_jpeg(uint8_t *data);
```

实现要求：

- YUV 回调仅在 preview enable 时转交最新帧。
- JPEG 回调仅在 `capture_requested` 为 true 时复制下一帧。
- 抓拍使用互斥锁保护请求与缓冲区，用信号量等待，超时为 3000ms。
- 新照片替换旧照片前先释放旧缓冲区。
- `pf_camera_capture_jpeg` 将缓冲区所有权转给调用方；调用方必须用 `pf_camera_release_jpeg` 释放。

- [ ] **步骤 3：验证并提交**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
Set-Location D:\TuyaOpen\examples\graphics\lvgl_camera
tos.py build
```

预期：测试 PASS，完整构建成功。

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_camera.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_camera.c firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "feat(firmware): add camera preview and JPEG capture"
```

## 任务 5：实现 320x480 触摸 UI 和单显示所有权

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_ui.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：编写失败的 UI 契约测试**

要求六个核心流程页面以及 DND/错误页接口、64px 触摸目标、LVGL v9 同步初始化、camera canvas 和 JPEG 解码；明确拒绝 `Hello World`、`tdl_disp_dev_flush` 和 `disp_disable_update`：

```powershell
$uiRequired = @(
    'lv_vendor_init(DISPLAY_NAME)',
    'lv_vendor_start',
    'PF_UI_PAGE_IDLE', 'PF_UI_PAGE_PREVIEW', 'PF_UI_PAGE_MATCH',
    'PF_UI_PAGE_WAITING', 'PF_UI_PAGE_COUNTDOWN', 'PF_UI_PAGE_RESULT',
    'lv_canvas_set_buffer',
    'tal_image_convert_yuv422_to_rgb565',
    'tal_image_jpeg_decode_rgb565',
    'pf_input_post_from_ui'
)
```

运行测试，预期 FAIL，提示缺少 `pf_ui.c`。

- [ ] **步骤 2：定义 UI 接口并创建六个屏幕**

`pf_ui.h` 暴露：

```c
typedef enum {
    PF_UI_PAGE_IDLE,
    PF_UI_PAGE_PREVIEW,
    PF_UI_PAGE_MATCH,
    PF_UI_PAGE_WAITING,
    PF_UI_PAGE_COUNTDOWN,
    PF_UI_PAGE_RESULT,
    PF_UI_PAGE_DND,
    PF_UI_PAGE_ERROR,
} PF_UI_PAGE_E;

OPERATE_RET pf_ui_init(void);
void pf_ui_show_page(PF_UI_PAGE_E page);
void pf_ui_set_peer(char peer_id, bool online);
void pf_ui_set_confirmed(bool local, bool peer);
void pf_ui_set_countdown(uint8_t seconds);
OPERATE_RET pf_ui_preview_start(uint16_t width, uint16_t height);
void pf_ui_preview_flush(uint16_t width, uint16_t height, uint8_t *yuv);
void pf_ui_preview_stop(void);
OPERATE_RET pf_ui_show_photo(uint16_t width, uint16_t height,
                             uint8_t *jpeg, uint32_t len);
void pf_ui_show_error(const char *message);
```

`pf_ui_init` 在同一调用中顺序执行 `lv_vendor_init`、`lv_vendor_start`、加锁、创建所有页面、加载待机页、解锁。所有按钮尺寸不小于 64x64；按钮回调只调用 `pf_input_post_from_ui`。

- [ ] **步骤 3：基于官方 canvas 路径实现预览与结果页**

- 预览开始时分配 `width * height * 2` 的 RGB565 canvas 缓冲。
- YUV 回调使用 `tal_image_convert_yuv422_to_rgb565` 写入 canvas，并在 LVGL 锁内 invalidate。
- 预览结束时先禁用 camera frame callback，再在 LVGL 锁内隐藏 canvas，最后释放缓冲。
- 结果页使用 `tal_image_jpeg_decode_rgb565` 解码到独立 RGB565 缓冲，替换旧结果前释放旧缓冲。
- 摄像头不再调用 `tdl_disp_dev_flush`；LVGL 是唯一显示硬件所有者。

- [ ] **步骤 4：验证并提交**

运行静态测试和完整构建，预期全部 PASS，且源码中不存在 `Hello World`。

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_ui.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "feat(firmware): add touch UI and camera canvas"
```

## 任务 6：实现 Wi-Fi STA 与 UDP 可靠传输

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_transport.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_transport.c`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：添加失败的传输契约测试**

验证脚本要求：

```powershell
$transportRequired = @(
    'tal_wifi_init', 'tal_wifi_set_work_mode', 'tal_wifi_station_connect',
    'tal_net_socket_create(PROTOCOL_UDP)', 'tal_net_set_broadcast',
    'tal_net_set_reuse', 'tal_net_bind', 'tal_net_set_block',
    'tal_net_send_to', 'tal_net_recvfrom', 'tal_net_close',
    'PF_HEARTBEAT_MS', 'PF_PEER_TIMEOUT_MS',
    'PF_CRITICAL_RETRY_COUNT', 'pf_protocol_decode'
)
```

运行测试，预期 FAIL，提示缺少 `pf_transport.c`。

- [ ] **步骤 2：定义传输事件和接口**

`pf_transport.h` 暴露：

```c
typedef enum {
    PF_TRANSPORT_WIFI_CONNECTED,
    PF_TRANSPORT_WIFI_LOST,
    PF_TRANSPORT_PEER_FOUND,
    PF_TRANSPORT_PEER_LOST,
    PF_TRANSPORT_MESSAGE,
} PF_TRANSPORT_EVENT_E;

typedef void (*PF_TRANSPORT_CB)(PF_TRANSPORT_EVENT_E event,
                                const PF_MESSAGE_T *message,
                                void *ctx);

OPERATE_RET pf_transport_init(PF_TRANSPORT_CB cb, void *ctx);
OPERATE_RET pf_transport_start(void);
OPERATE_RET pf_transport_send(PF_MESSAGE_TYPE_E type,
                              uint32_t session_id,
                              int32_t result,
                              bool critical);
void pf_transport_stop(void);
```

- [ ] **步骤 3：实现 Wi-Fi 和 socket 生命周期**

- 使用 `tal_wifi_init` 注册事件回调，设置 `WWM_STATION`，从生成配置读取热点名称和密码。
- `WFE_CONNECTED` 后读取本机 IP，再创建 UDP socket。
- socket 设置 reuse、broadcast 和 non-blocking，绑定 `TY_IPADDR_ANY:37800`。
- 一个接收任务轮询 `tal_net_recvfrom`；无数据时 sleep 10ms，不忙等。
- 一个 1 秒周期 timer 广播 `HELLO`。
- 收到自己 device ID、错误 peer ID、错误版本或旧 sequence 的包时丢弃。
- 连续 3 秒没有有效 peer `HELLO` 时生成 `PF_TRANSPORT_PEER_LOST`。
- 停止或 Wi-Fi 断开时关闭 socket、停止 timer 并清除 peer 地址。

- [ ] **步骤 4：实现关键消息重发与幂等接收**

`critical=true` 时立即发送一次，再由 transport 任务以 100ms 间隔补发两次。接收端保存最近 16 个 `message_id`；重复包可刷新 peer 在线时间，但不得再次投递业务消息。

- [ ] **步骤 5：验证并提交**

运行静态测试与完整构建，预期全部通过。

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_transport.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_transport.c firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "feat(firmware): add hotspot UDP transport"
```

## 任务 7：组合应用事件队列和双机捕捉流程

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_app.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_app.c`
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/src/example_lvgl_camera.c`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：添加失败的集成契约测试**

测试要求入口文件只保留日志、`board_register_hardware()` 和 `pf_app_start()`；要求 `pf_app.c` 存在单一事件队列、状态机 dispatch、所有模块初始化和以下协调顺序：

```text
both confirmed
-> CAPTURE_PREPARE
-> PREPARE_ACK
-> CAPTURE(delay=3000ms)
-> local CAPTURED + peer CAPTURED
-> SUCCESS
```

测试还要拒绝入口文件出现 GPIO、LVGL、UDP socket 或 camera frame buffer 逻辑。

运行测试，预期 FAIL，提示缺少 `pf_app.c` 或旧入口仍含硬件逻辑。

- [ ] **步骤 2：定义应用事件并创建单一队列**

`pf_app.h` 暴露：

```c
OPERATE_RET pf_app_start(void);
```

`pf_app.c` 内部定义：

```c
typedef enum {
    PF_APP_EVENT_INPUT,
    PF_APP_EVENT_TRANSPORT,
    PF_APP_EVENT_TIMER,
    PF_APP_EVENT_CAPTURE_DONE,
} PF_APP_EVENT_TYPE_E;

typedef struct {
    PF_APP_EVENT_TYPE_E type;
    union {
        PF_INPUT_ACTION_E input;
        struct {
            PF_TRANSPORT_EVENT_E event;
            PF_MESSAGE_T message;
        } transport;
        PF_EVENT_E timer_event;
        OPERATE_RET capture_result;
    } data;
} PF_APP_EVENT_T;
```

所有 UI、按钮、transport 和 camera worker 回调只复制数据并投递到长度 16 的队列。只有 app task 可以调用 `pf_state_dispatch` 和执行效果位。

- [ ] **步骤 3：实现状态进入/退出效果**

- `ONLINE_IDLE`：显示待机页、禁用预览、停止电机。
- `CAMERA_PREVIEW`：启动 UI canvas，再启用 camera preview。
- 退出 preview：先禁用 camera preview，再释放 UI canvas。
- `PEER_FOUND`：显示匹配页并播放 `PEER_FOUND` 震动。
- `WAITING_CONFIRM`：更新双方确认状态；本机确认时发送 `CONFIRM`。
- A 机双方确认后发送 `CAPTURE_PREPARE`；B 机准备 camera 后回复 `PREPARE_ACK`。
- A 机收到 ACK 后发送关键 `CAPTURE`；两机启动 3 秒倒计时。
- 倒计时剩余 1 秒时完成最后一次短震，确保拍照前 300ms 已停止电机。
- 到时由独立 capture worker 调用阻塞的 `pf_camera_capture_jpeg`，app task 不阻塞。
- 两机发送 `CAPTURED`；A 收齐成功结果后发送 `SUCCESS`。
- `SUCCESS`：显示本机 JPEG、播放 600ms 震动，5 秒后 reset。
- 取消、超时、掉线、拍照失败：发送 `CANCEL` 或失败结果，停止电机、释放 JPEG、回到待机或错误页。

- [ ] **步骤 4：缩减入口文件**

`example_lvgl_camera.c` 最终只执行：

```c
void user_main(void)
{
    tal_log_init(TAL_LOG_LEVEL_DEBUG, 1024,
                 (TAL_LOG_OUTPUT_CB)tkl_log_output);
    tal_sw_timer_init();
    tal_workq_init();

    PR_NOTICE("Pocket Friend dual-device demo: %c", PF_DEVICE_ID);
    PR_NOTICE("Platform board: %s", PLATFORM_BOARD);

    board_register_hardware();
    TUYA_CALL_ERR_LOG(pf_app_start());
}
```

- [ ] **步骤 5：运行全部自动化验证和完整构建**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-camera-config.ps1
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
git diff --check
Set-Location D:\TuyaOpen\examples\graphics\lvgl_camera
tos.py clean -f
tos.py build
```

预期：三项测试 PASS；`git diff --check` 无输出；构建输出 `BUILD SUCCESS`。

- [ ] **步骤 6：提交**

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_app.h firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_app.c firmware/tuya-t5ai/overlays/lvgl_camera/src/example_lvgl_camera.c firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "feat(firmware): integrate dual-device capture flow"
```

## 任务 8：生成 A/B 固件并提供可重复烧录流程

**文件：**

- 创建：`firmware/tuya-t5ai/scripts/build-dual-demo.ps1`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：添加失败的构建脚本契约**

验证脚本要求 `build-dual-demo.ps1`：

- 检查 `PF_WIFI_SSID` 和 `PF_WIFI_PASSWORD`。
- 依次调用 sync 脚本生成 A/B 配置。
- 每次执行 `tos.py clean -f` 和 `tos.py build`。
- 将 QIO 固件复制到 `D:\TuyaOpen\artifacts\pocket-friend-demo\device-a.bin` 和 `device-b.bin`。
- 不把二进制复制进 Git 仓。

运行测试，预期 FAIL，提示构建脚本不存在。

- [ ] **步骤 2：实现双固件构建脚本**

脚本参数仅包含：

```powershell
param([string]$TuyaOpenRoot = 'D:\TuyaOpen')
```

脚本对 A/B 各执行一次同步、全量清理和构建，并检查源 QIO 文件存在且长度大于 1MB，再复制到 artifacts 目录。任何一次构建失败时立即停止，不保留同名旧产物作为成功结果。

- [ ] **步骤 3：运行全部测试并实际构建 A/B**

运行：

```powershell
$env:PF_WIFI_SSID = Read-Host 'Hotspot SSID'
$wifiSecret = Read-Host 'Hotspot password' -AsSecureString
$env:PF_WIFI_PASSWORD = [Net.NetworkCredential]::new('', $wifiSecret).Password
& .\firmware\tuya-t5ai\tests\validate-camera-config.ps1
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
& .\firmware\tuya-t5ai\scripts\build-dual-demo.ps1
Get-ChildItem D:\TuyaOpen\artifacts\pocket-friend-demo\device-*.bin |
    Select-Object Name, Length, LastWriteTime
```

预期：三项测试 PASS；两个固件均为本次生成，长度大于 1MB。

- [ ] **步骤 4：提交**

```powershell
git add firmware/tuya-t5ai/scripts/build-dual-demo.ps1 firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "build(firmware): generate A and B demo images"
```

## 任务 9：双机烧录、日志验证和 20 轮验收

**文件：**

- 修改：`docs/superpowers/specs/2026-07-24-pocket-friend-dual-t5ai-demo-design.md`（仅在实测结果改变设计事实时）
- 创建：`docs/superpowers/verification/2026-07-24-pocket-friend-dual-t5ai-demo-results.md`（仅在完成实测后创建）

- [ ] **步骤 1：枚举并记录四个串口**

两块 CH342 通常各提供烧录口和日志口。运行：

```powershell
Get-PnpDevice -PresentOnly |
    Where-Object { $_.FriendlyName -match 'CH342.*\(COM\d+\)' } |
    Select-Object FriendlyName, InstanceId
```

通过逐块插拔确定 A/B 的烧录口与日志口，不凭 COM 编号大小猜测。

- [ ] **步骤 2：烧录 A/B 固件**

关闭占用串口的 monitor 后运行：

```powershell
$aFlashPort = Read-Host 'Device A flash COM port'
$bFlashPort = Read-Host 'Device B flash COM port'
& D:\TuyaOpen\tools\tyutool\tyutool_cli.exe write -d t5 -f D:\TuyaOpen\artifacts\pocket-friend-demo\device-a.bin -p $aFlashPort
& D:\TuyaOpen\tools\tyutool\tyutool_cli.exe write -d t5 -f D:\TuyaOpen\artifacts\pocket-friend-demo\device-b.bin -p $bFlashPort
```

预期：两次均显示 `Flash OK`。COM 口只保存在当前 PowerShell 变量中，不写入脚本或仓库。

- [ ] **步骤 3：同时采集两台日志并验证启动**

分别以 460800 baud 打开两个日志口。必须看到：

```text
Pocket Friend dual-device demo: A
Pocket Friend dual-device demo: B
Platform board: TUYA_T5AI_BOARD
[motor] ready, stopped
[ui] ready 320x480
[wifi] connected
[peer] found
```

启动阶段不得出现 Hello World、重复重启、`lv display dev not found` 或电机持续运行。

- [ ] **步骤 4：验证触摸、按钮和同步拍照**

至少各执行一次：

- A 触摸确认、B 触摸确认。
- A 物理按钮确认、B 物理按钮确认。
- 一边触摸、一边物理按钮。
- 一方确认后取消。
- 一方确认后断电。
- 相机预览打开后发现 peer，确认能自动返回匹配页。

每次成功流程记录两台形如 `[capture] trigger ms=123456` 的日志，时间差必须不超过 100ms。拍照前的最后一条 `[motor] stopped` 与拍照触发至少相隔 300ms。

- [ ] **步骤 5：完成 20 轮稳定性循环**

连续完成 20 轮：发现、双方确认、倒计时、拍照、结果显示、5 秒返回。记录：

- 成功轮数。
- 最大拍照触发差值。
- UDP 重发次数。
- 摄像头失败次数。
- 掉线恢复耗时。
- 是否出现花屏、Hello World、死机、持续电机或内存持续下降。

任何一项不满足规格时，不写“通过”；回到对应模块增加失败测试并修复。

- [ ] **步骤 6：写入实测报告并提交**

报告必须包含固件提交、TuyaOpen 提交、两块板的设备 ID、实际 COM 口、热点类型、20 轮统计和所有未通过项。不得记录热点密码。

```powershell
git add docs/superpowers/verification/2026-07-24-pocket-friend-dual-t5ai-demo-results.md
git commit -m "test(firmware): verify dual-device demo on hardware"
```

## 最终验证

全部任务完成后重新运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-camera-config.ps1
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
& .\firmware\tuya-t5ai\tests\validate-dual-demo.ps1
git diff --check
git status --short --branch
```

确认三项测试 PASS、无格式错误、无未提交目标文件，并检查实测报告确实包含 20 轮统计后，才可将 Demo 标记为完成。
