# T5AI 按钮切换电机启停实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 `lvgl_camera` 临时固件中，让屏幕开机自动显示摄像头，并让板载 USER KEY 单击切换 TB6612FNG A 通道电机的正转与停止。

**架构：** 保持官方示例单文件结构，不新增电机抽象层。项目仓保存一份 `example_lvgl_camera.c` 覆盖文件和一个同步脚本；构建前同步到 `D:\TuyaOpen`，GPIO P6/P7 直接驱动 TB6612 的 AIN1/AIN2。本次不实现反转和 PWM 调速。

**技术栈：** TuyaOpen v1.9.0、T5AI TKL GPIO、TDL Button、PowerShell、`tos.py`

---

## 文件结构

- 创建：`firmware/tuya-t5ai/tests/validate-button-motor.ps1`
  - 静态验证覆盖源码包含 P6/P7、失效安全、按钮启停和自动摄像头预览。
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/example_lvgl_camera.c`
  - 项目保存的可复现 `lvgl_camera` 临时应用源码。
- 创建：`firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1`
  - 把覆盖源码和板级配置同步到本机 `D:\TuyaOpen` 构建工作副本。
- 修改：`D:\TuyaOpen\examples\graphics\lvgl_camera\src\example_lvgl_camera.c`
  - 由同步脚本生成，不作为唯一保存位置。
- 复用：`firmware/tuya-t5ai/config/TUYA_T5AI_BOARD_LCD_3.5.config`
  - 保持正确的 `TUYA_T5AI_BOARD`、35565 LCD 和摄像头选择。

### 任务 1：为临时电机行为建立失败测试

**文件：**

- 创建：`firmware/tuya-t5ai/tests/validate-button-motor.ps1`
- 测试：`firmware/tuya-t5ai/tests/validate-button-motor.ps1`

- [ ] **步骤 1：编写失败的结构验证**

使用 `apply_patch` 创建脚本。脚本读取：

```powershell
$sourcePath = Join-Path $PSScriptRoot '..\overlays\lvgl_camera\src\example_lvgl_camera.c'
```

若覆盖源码不存在，抛出：

```text
缺少按钮电机覆盖源码
```

源码必须包含：

```text
#define EXAMPLE_MOTOR_IN1_PIN TUYA_GPIO_NUM_6
#define EXAMPLE_MOTOR_IN2_PIN TUYA_GPIO_NUM_7
static bool sg_motor_running = false;
static bool sg_motor_ready = false;
__example_motor_init
__example_motor_start
__example_motor_stop
[motor] started
[motor] stopped
disp_disable_update(NULL);
sg_is_display_camera = true;
```

脚本还必须拒绝原来的摄像头按钮切换片段：

```text
if (false == sg_is_display_camera)
```

- [ ] **步骤 2：运行测试并确认红灯**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
```

预期：退出码非 0，失败原因是：

```text
缺少按钮电机覆盖源码
```

而不是 PowerShell 语法或路径拼写错误。

- [ ] **步骤 3：提交红灯测试**

```powershell
git add -- firmware/tuya-t5ai/tests/validate-button-motor.ps1
git commit -m "test(firmware): define T5AI button motor behavior"
```

### 任务 2：实现最小按钮电机逻辑

**文件：**

- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/example_lvgl_camera.c`
- 创建：`firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1`
- 测试：`firmware/tuya-t5ai/tests/validate-button-motor.ps1`

- [ ] **步骤 1：以当前官方示例为基线创建覆盖源码**

覆盖源码保留 `D:\TuyaOpen\examples\graphics\lvgl_camera\src\example_lvgl_camera.c` 的摄像头、LVGL 和帧缓冲逻辑，只做本计划列出的最小修改。

在 include 区增加：

```c
#include "tkl_gpio.h"
```

在宏区增加：

```c
#define EXAMPLE_MOTOR_IN1_PIN TUYA_GPIO_NUM_6
#define EXAMPLE_MOTOR_IN2_PIN TUYA_GPIO_NUM_7
```

在全局状态区增加：

```c
static bool sg_motor_running = false;
static bool sg_motor_ready   = false;
```

- [ ] **步骤 2：增加失效安全的 GPIO 操作**

初始化使用：

```c
TUYA_GPIO_BASE_CFG_T motor_gpio_cfg = {
    .mode   = TUYA_GPIO_PUSH_PULL,
    .direct = TUYA_GPIO_OUTPUT,
    .level  = TUYA_GPIO_LEVEL_LOW,
};
```

增加以下三个函数，且 `sg_motor_ready` 只在两个 GPIO 初始化并成功停止后设为 `true`；初始化失败时保持 `false`，按钮不得启动电机：

```c
static OPERATE_RET __example_motor_stop(void)
{
    OPERATE_RET in1_rt = tkl_gpio_write(EXAMPLE_MOTOR_IN1_PIN, TUYA_GPIO_LEVEL_LOW);
    OPERATE_RET in2_rt = tkl_gpio_write(EXAMPLE_MOTOR_IN2_PIN, TUYA_GPIO_LEVEL_LOW);

    return (OPRT_OK != in1_rt) ? in1_rt : in2_rt;
}

static OPERATE_RET __example_motor_start(void)
{
    OPERATE_RET rt = tkl_gpio_write(EXAMPLE_MOTOR_IN2_PIN, TUYA_GPIO_LEVEL_LOW);
    TUYA_CHECK_ERROR_RETURN(rt);

    return tkl_gpio_write(EXAMPLE_MOTOR_IN1_PIN, TUYA_GPIO_LEVEL_HIGH);
}

static OPERATE_RET __example_motor_init(void)
{
    TUYA_GPIO_BASE_CFG_T motor_gpio_cfg = {
        .mode   = TUYA_GPIO_PUSH_PULL,
        .direct = TUYA_GPIO_OUTPUT,
        .level  = TUYA_GPIO_LEVEL_LOW,
    };

    TUYA_CALL_ERR_RETURN(tkl_gpio_init(EXAMPLE_MOTOR_IN1_PIN, &motor_gpio_cfg));
    TUYA_CALL_ERR_RETURN(tkl_gpio_init(EXAMPLE_MOTOR_IN2_PIN, &motor_gpio_cfg));
    TUYA_CALL_ERR_RETURN(__example_motor_stop());

    sg_motor_running = false;
    sg_motor_ready   = true;
    PR_NOTICE("[motor] ready, stopped");
    return OPRT_OK;
}
```

如果当前 SDK 没有 `TUYA_CHECK_ERROR_RETURN`，改用显式判断：

```c
if (OPRT_OK != rt) {
    return rt;
}
```

- [ ] **步骤 3：把单击按钮改为启停切换**

用下面逻辑替换 `TDL_BUTTON_PRESS_SINGLE_CLICK` 原有摄像头切换：

```c
case TDL_BUTTON_PRESS_SINGLE_CLICK: {
    OPERATE_RET rt = OPRT_OK;

    if (false == sg_motor_ready) {
        PR_ERR("[motor] ignored: gpio not ready");
        break;
    }

    if (sg_motor_running) {
        rt = __example_motor_stop();
        if (OPRT_OK == rt) {
            sg_motor_running = false;
            PR_NOTICE("[motor] stopped");
        }
    } else {
        rt = __example_motor_start();
        if (OPRT_OK == rt) {
            sg_motor_running = true;
            PR_NOTICE("[motor] started");
        }
    }

    if (OPRT_OK != rt) {
        PR_ERR("[motor] gpio operation failed: %d", rt);
    }
} break;
```

- [ ] **步骤 4：修改启动顺序并自动启用摄像头预览**

在 `board_register_hardware()` 后、按钮初始化前调用：

```c
TUYA_CALL_ERR_LOG(__example_motor_init());
```

在 `__example_camera_display_init()` 成功调用后增加：

```c
disp_disable_update(NULL);
sg_is_display_camera = true;
PR_NOTICE("camera preview enabled");
```

- [ ] **步骤 5：创建同步脚本**

`sync-lvgl-camera.ps1` 接受可选参数：

```powershell
param(
    [string]$TuyaOpenRoot = 'D:\TuyaOpen'
)
```

脚本必须：

1. 验证覆盖源码、项目配置和 TuyaOpen 目标目录存在；
2. 把覆盖源码复制到 `examples\graphics\lvgl_camera\src\example_lvgl_camera.c`；
3. 把项目配置复制到示例的 `config\TUYA_T5AI_BOARD_LCD_3.5.config`；
4. 把同一配置复制到示例的 `app_default.config`；
5. 输出 `PASS: lvgl_camera motor overlay synced.`

- [ ] **步骤 6：运行测试并确认绿灯**

运行：

```powershell
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
& .\firmware\tuya-t5ai\tests\validate-camera-config.ps1
```

预期两个脚本均输出 `PASS`，退出码为 0。

- [ ] **步骤 7：提交最小实现**

```powershell
git add -- firmware/tuya-t5ai/overlays firmware/tuya-t5ai/scripts firmware/tuya-t5ai/tests
git commit -m "feat(firmware): toggle motor with T5AI user button"
```

### 任务 3：同步并完整构建固件

**文件：**

- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\src\example_lvgl_camera.c`
- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\app_default.config`
- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\dist\`

- [ ] **步骤 1：同步项目覆盖文件**

```powershell
& .\firmware\tuya-t5ai\scripts\sync-lvgl-camera.ps1 -TuyaOpenRoot D:\TuyaOpen
```

预期：

```text
PASS: lvgl_camera motor overlay synced.
```

- [ ] **步骤 2：激活 TuyaOpen 环境**

```powershell
Set-Location D:\TuyaOpen
.\export.ps1
tos.py check
```

预期：工具链检查通过。

- [ ] **步骤 3：全量清理并构建**

```powershell
Set-Location D:\TuyaOpen\examples\graphics\lvgl_camera
tos.py config choice -c TUYA_T5AI_BOARD_LCD_3.5.config
tos.py clean -f
tos.py build
```

预期：

- 构建退出码为 0；
- 日志显示 `Board: TUYA_T5AI_BOARD`；
- `dist\lvgl_camera_1.0.0\` 生成新的 QIO、UA 和 UG 固件。

### 任务 4：烧录与实机验收

**文件：**

- 生成：`D:\TuyaOpen\examples\graphics\lvgl_camera\.target_logging\`

- [ ] **步骤 1：确认串口**

```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

本机已验证组合为：

```text
COM4：烧录
COM5：日志
```

若端口变化，以设备管理器和实际日志为准。

- [ ] **步骤 2：烧录**

确保串口监控已关闭，然后运行：

```powershell
Set-Location D:\TuyaOpen\examples\graphics\lvgl_camera
tos.py flash -p COM4
```

预期：握手、擦除、写入、保护和重启全部成功。

- [ ] **步骤 3：监视日志**

```powershell
tos.py monitor -p COM5
```

预期启动日志包含：

```text
Platform board:      TUYA_T5AI_BOARD
[motor] ready, stopped
camera preview enabled
```

- [ ] **步骤 4：实机按键验收**

1. 开机后电机不转，屏幕自动显示摄像头。
2. 第一次单击 USER KEY，电机正转并输出 `[motor] started`。
3. 第二次单击，电机停止并输出 `[motor] stopped`。
4. 重复三次；若屏幕闪烁、花屏、摄像头停止或开发板重启，立即断电并停止使用内部 5V 电机供电。

- [ ] **步骤 5：完成前验证并推送**

```powershell
Set-Location D:\Users\17\Documents\friend\.worktrees\tuya-t5ai-firmware
& .\firmware\tuya-t5ai\tests\validate-button-motor.ps1
& .\firmware\tuya-t5ai\tests\validate-camera-config.ps1
git diff --check
git status --short --branch
```

确认测试和构建证据完整后，按代理协作规则 fetch/rebase，再正常推送 `codex/tuya-t5ai-firmware`，禁止强推。
