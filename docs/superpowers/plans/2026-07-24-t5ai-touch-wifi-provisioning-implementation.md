# T5AI 触摸屏 Wi-Fi 配网实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 Pocket Friend 的 T5AI 固件中加入 320x480 竖屏触摸 Wi-Fi 配网，并用设备 KV 替代编译期热点凭据。

**架构：** 新增 `pf_wifi_config` 作为 `tal_wifi`、扫描、连接、重试和 KV 的唯一所有者；`pf_app` 继续使用单队列串行处理 UI、Wi-Fi 和 UDP 事件；`pf_transport` 降为纯 UDP 层。UI 使用 LVGL 9 的 `lv_list`、`lv_textarea` 和 `lv_keyboard`，不复制官方 384x168 横屏页面。

**技术栈：** TuyaOpen T5AI、C、LVGL 9、Tuya TAL Wi-Fi/KV/线程队列、PowerShell 合同测试、TuyaOpen `tos.py` 构建。

---

## 文件结构

- 创建 `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_wifi_config.h`：公开 AP、状态、事件和异步命令接口。
- 创建 `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_wifi_config.c`：Wi-Fi 工作线程、扫描去重排序、连接回调、重试和 KV。
- 修改 `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_input.h`：让输入事件携带 Wi-Fi 列表索引和密码文本。
- 修改 `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_input.c`：统一投递普通动作和带载荷的 Wi-Fi 动作。
- 修改 `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_ui.h`：增加 Wi-Fi 页面和状态更新接口。
- 修改 `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c`：创建扫描页、密码页、连接页和待机页入口。
- 修改 `firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_transport.h`：增加网络已连接/断开接口。
- 修改 `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_transport.c`：移除 Wi-Fi 初始化与编译期凭据，只管理 UDP 生命周期。
- 修改 `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_app.c`：接入 Wi-Fi 事件和触摸配网动作。
- 修改 `firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1`：只生成 A/B 设备配置，不生成热点凭据。
- 修改 `firmware/tuya-t5ai/scripts/build-dual-demo.ps1`：取消热点环境变量前置检查。
- 修改 `firmware/tuya-t5ai/tests/validate-dual-demo.ps1`：增加 Wi-Fi 配网合同和敏感信息检查。

## 任务 1：用合同测试锁定配网边界

**文件：**
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：编写失败的 Wi-Fi 模块测试**

在验证脚本中读取 `pf_wifi_config.h/.c`，要求以下符号存在：

```powershell
$wifiHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_wifi_config.h'
$wifiSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_wifi_config.c'

foreach ($path in @($wifiHeaderPath, $wifiSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing Wi-Fi provisioning source file: $path"
    }
}

$wifi = (Get-Content $wifiHeaderPath -Raw),
        (Get-Content $wifiSourcePath -Raw) -join "`n"
$wifiRequired = @(
    'PF_WIFI_MAX_APS 20', 'PF_WIFI_SSID_MAX 32',
    'PF_WIFI_PASSWORD_MAX 64', 'PF_WIFI_EVENT_UNCONFIGURED',
    'PF_WIFI_EVENT_SCAN_COMPLETE', 'PF_WIFI_EVENT_CONNECTED',
    'PF_WIFI_EVENT_CONNECT_FAILED', 'pf_wifi_init', 'pf_wifi_start',
    'pf_wifi_scan_async', 'pf_wifi_connect_async',
    'tal_wifi_all_ap_scan', 'tal_wifi_release_ap',
    'tal_wifi_station_connect', 'tal_kv_get', 'tal_kv_free',
    'tal_kv_set', 'tal_kv_del'
)
foreach ($symbol in $wifiRequired) {
    if (-not $wifi.Contains($symbol)) {
        throw "Missing Wi-Fi provisioning contract: $symbol"
    }
}
```

- [ ] **步骤 2：锁定传输层和构建脚本禁用项**

```powershell
foreach ($forbidden in @('tal_wifi_init', 'tal_wifi_station_connect',
                          'PF_WIFI_SSID', 'PF_WIFI_PASSWORD')) {
    if ($transport.Contains($forbidden)) {
        throw "Transport must not own Wi-Fi: $forbidden"
    }
}

foreach ($script in @($sync, $buildScript)) {
    if ($script.Contains('PF_WIFI_SSID') -or
        $script.Contains('PF_WIFI_PASSWORD')) {
        throw 'Build scripts must not require Wi-Fi credentials'
    }
}
```

- [ ] **步骤 3：运行测试确认红灯**

运行：

```powershell
pwsh -NoProfile -File firmware/tuya-t5ai/tests/validate-dual-demo.ps1
```

预期：FAIL，首先报告缺少 `pf_wifi_config.h` 或 `pf_wifi_config.c`。

- [ ] **步骤 4：提交红灯测试**

```powershell
git add firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "test(firmware): specify touch Wi-Fi provisioning"
git push origin codex/tuya-t5ai-firmware
```

## 任务 2：实现独立 Wi-Fi 配置模块

**文件：**
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_wifi_config.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_wifi_config.c`
- 测试：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：定义公开数据契约**

头文件提供固定容量数据和异步接口：

```c
#define PF_WIFI_MAX_APS 20U
#define PF_WIFI_SSID_MAX 32U
#define PF_WIFI_PASSWORD_MAX 64U

typedef struct {
    char ssid[PF_WIFI_SSID_MAX + 1U];
    int8_t rssi;
    uint8_t security;
} PF_WIFI_AP_T;

typedef enum {
    PF_WIFI_EVENT_UNCONFIGURED,
    PF_WIFI_EVENT_SCAN_STARTED,
    PF_WIFI_EVENT_SCAN_COMPLETE,
    PF_WIFI_EVENT_SCAN_FAILED,
    PF_WIFI_EVENT_CONNECTING,
    PF_WIFI_EVENT_CONNECTED,
    PF_WIFI_EVENT_CONNECT_FAILED,
    PF_WIFI_EVENT_DISCONNECTED,
    PF_WIFI_EVENT_SAVE_FAILED,
} PF_WIFI_EVENT_E;

typedef void (*PF_WIFI_CB)(PF_WIFI_EVENT_E event, void *ctx);

OPERATE_RET pf_wifi_init(PF_WIFI_CB cb, void *ctx);
OPERATE_RET pf_wifi_start(void);
OPERATE_RET pf_wifi_scan_async(void);
OPERATE_RET pf_wifi_connect_async(uint8_t ap_index, const char *password);
uint8_t pf_wifi_get_scan_results(PF_WIFI_AP_T *out, uint8_t capacity);
const char *pf_wifi_get_ip(void);
bool pf_wifi_is_connected(void);
```

- [ ] **步骤 2：实现扫描结果纯逻辑**

在工作线程中复制 AP 数据，跳过空 SSID；相同 SSID 只保留更强 RSSI；插入后按 RSSI 降序排序；达到 20 项后只替换比当前最弱项更强的结果。无论扫描成功、失败或结果为空，只要 `ap_list != NULL` 都调用：

```c
(void)tal_wifi_release_ap(ap_list);
ap_list = NULL;
```

- [ ] **步骤 3：实现 KV 读取与原子保存标志**

使用键 `pf_wifi_password` 和 `pf_wifi_ssid`。读取后始终 `tal_kv_free()`；长度非法或缺少结尾空字符时删除两个键。连接成功并取得 IP 后先保存密码，再保存 SSID；SSID 写入失败时删除 SSID 键。

```c
rt = tal_kv_set(PF_WIFI_PASSWORD_KEY, (const uint8_t *)password,
                strlen(password) + 1U);
if (rt == OPRT_OK) {
    rt = tal_kv_set(PF_WIFI_SSID_KEY, (const uint8_t *)ssid,
                    strlen(ssid) + 1U);
}
if (rt != OPRT_OK) {
    (void)tal_kv_del(PF_WIFI_SSID_KEY);
}
```

- [ ] **步骤 4：实现异步命令和连接事件**

创建一个 Wi-Fi 命令队列和工作线程。`pf_wifi_scan_async()`、`pf_wifi_connect_async()` 只复制参数并投递命令；`tal_wifi_all_ap_scan()` 不在 LVGL 或应用队列回调中执行。`tal_wifi_init()` 只在本模块调用一次。自动连接最多重试 3 次，延时 1、2、4 秒；用户主动连接失败不无限重试。

- [ ] **步骤 5：运行合同测试确认绿灯到达下一缺口**

运行相同验证命令。预期：Wi-Fi 模块合同通过，测试继续失败在尚未完成的 transport/UI/app 合同处，而不是缺少 Wi-Fi 模块。

- [ ] **步骤 6：提交模块**

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_wifi_config.h `
        firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_wifi_config.c
git commit -m "feat(firmware): add runtime Wi-Fi manager"
git push origin codex/tuya-t5ai-firmware
```

## 任务 3：将 UDP 与 Wi-Fi 生命周期解耦

**文件：**
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_transport.h`
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_transport.c`
- 测试：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：增加失败合同**

要求 transport 提供以下符号，并禁止直接引用 Wi-Fi API：

```powershell
foreach ($symbol in @('pf_transport_network_up',
                      'pf_transport_network_down')) {
    if (-not $transport.Contains($symbol)) {
        throw "Missing network lifecycle contract: $symbol"
    }
}
```

运行测试，预期 FAIL：缺少 `pf_transport_network_up`。

- [ ] **步骤 2：实现最小网络生命周期接口**

`pf_transport_start()` 只启动 UDP 工作线程；`pf_transport_network_up()` 关闭旧 socket、打开新 socket、启动心跳并发送 HELLO；`pf_transport_network_down()` 停止心跳、关闭 socket、清除 peer，并按需通知 peer 丢失。

```c
OPERATE_RET pf_transport_network_up(void);
void pf_transport_network_down(void);
```

删除 `pf_wifi_event_cb`、`tal_wifi_init`、`tal_wifi_set_work_mode`、`tal_wifi_station_connect` 和 `PF_WIFI_*` 引用。

- [ ] **步骤 3：运行测试确认通过**

运行合同测试。预期：transport 合同通过且敏感凭据引用检查通过。

- [ ] **步骤 4：提交解耦**

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_transport.h `
        firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_transport.c
git commit -m "refactor(firmware): separate Wi-Fi from UDP transport"
git push origin codex/tuya-t5ai-firmware
```

## 任务 4：实现带载荷的触摸输入与竖屏配网页

**文件：**
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_input.h`
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_input.c`
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_ui.h`
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c`
- 测试：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：增加 UI 红灯合同**

要求 `PF_UI_PAGE_WIFI_SCAN`、`PF_UI_PAGE_WIFI_PASSWORD`、`PF_UI_PAGE_WIFI_CONNECT`、`PF_INPUT_OPEN_WIFI`、`PF_INPUT_WIFI_SCAN`、`PF_INPUT_WIFI_SELECT`、`PF_INPUT_WIFI_CONNECT`、`lv_textarea_set_password_mode`、`lv_textarea_set_max_length`、`lv_keyboard_create`、`lv_keyboard_set_textarea` 存在。运行验证并确认因第一个缺失符号失败。

- [ ] **步骤 2：让输入事件携带索引和密码**

```c
typedef struct {
    PF_INPUT_ACTION_E action;
    uint8_t index;
    char text[PF_WIFI_PASSWORD_MAX + 1U];
} PF_INPUT_EVENT_T;

typedef void (*PF_INPUT_CB)(const PF_INPUT_EVENT_T *event, void *ctx);

void pf_input_post_from_ui(PF_INPUT_ACTION_E action);
void pf_input_post_wifi_from_ui(PF_INPUT_ACTION_E action,
                                uint8_t index, const char *text);
```

普通按钮和物理按键投递零初始化事件；Wi-Fi 连接按钮复制密码到事件后立即清空 textarea。

- [ ] **步骤 3：创建待机入口和扫描页**

待机页右上角使用 `LV_SYMBOL_WIFI` 的 64x64 图标按钮。扫描页包含返回、标题、刷新和可滚动 AP 列表；每个列表按钮的 user data 保存稳定的结果索引，点击后投递 `PF_INPUT_WIFI_SELECT`。

- [ ] **步骤 4：创建密码页和连接页**

```c
sg_ui.wifi_password = lv_textarea_create(password_page);
lv_textarea_set_password_mode(sg_ui.wifi_password, true);
lv_textarea_set_max_length(sg_ui.wifi_password, 63U);
sg_ui.wifi_keyboard = lv_keyboard_create(password_page);
lv_keyboard_set_textarea(sg_ui.wifi_keyboard, sg_ui.wifi_password);
```

眼睛图标切换 password mode；连接页复用一个状态标签和重试/重新选网按钮。开放网络由 app 直接连接，不打开密码页。

- [ ] **步骤 5：公开最小 UI 更新接口**

```c
void pf_ui_set_wifi_status(bool connected, bool busy);
void pf_ui_wifi_show_scan(void);
void pf_ui_wifi_set_results(const PF_WIFI_AP_T *aps, uint8_t count);
void pf_ui_wifi_show_password(const char *ssid);
void pf_ui_wifi_show_connecting(const char *ssid);
void pf_ui_wifi_show_connected(const char *ip);
void pf_ui_wifi_show_failed(const char *message);
```

- [ ] **步骤 6：运行验证并提交**

预期：UI/input 合同通过，密码 API 存在且没有日志输出密码。

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_input.h `
        firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_input.c `
        firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_ui.h `
        firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c
git commit -m "feat(firmware): add touch Wi-Fi setup screens"
git push origin codex/tuya-t5ai-firmware
```

## 任务 5：在应用单队列中集成配网流程

**文件：**
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_app.c`
- 测试：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：增加 app 红灯合同**

要求 `PF_APP_EVENT_WIFI`、`pf_wifi_init`、`pf_wifi_start`、`pf_handle_wifi`、`pf_transport_network_up`、`pf_transport_network_down` 存在。运行验证并确认失败。

- [ ] **步骤 2：把输入队列载荷改为结构体**

`PF_APP_EVENT_T.data.input` 改为 `PF_INPUT_EVENT_T`；回调按值复制整个事件，保证 LVGL 回调返回后密码和索引仍有效。处理结束后用 `memset` 清零队列事件中的密码字段。

- [ ] **步骤 3：处理配网动作**

- `PF_INPUT_OPEN_WIFI` / `PF_INPUT_WIFI_SCAN`：显示扫描页并调用 `pf_wifi_scan_async()`。
- `PF_INPUT_WIFI_SELECT`：保存索引；开放网络直接调用 connect，加密网络显示密码页。
- `PF_INPUT_WIFI_CONNECT`：显示连接中并调用 `pf_wifi_connect_async()`。
- `PF_INPUT_WIFI_RETRY`：使用当前临时选择和密码重试。
- 返回：清零临时密码并回待机页。

- [ ] **步骤 4：处理 Wi-Fi 事件**

- `UNCONFIGURED`：待机图标显示离线，不强制跳页。
- `SCAN_COMPLETE`：复制最多 20 个结果给 UI。
- `CONNECTED`：调用 `pf_transport_network_up()`、派发 `PF_EVENT_WIFI_CONNECTED`，更新待机图标和连接成功页。
- `CONNECT_FAILED` / `SAVE_FAILED`：显示对应错误；保存失败时网络仍保持连接。
- `DISCONNECTED`：调用 `pf_transport_network_down()` 并向业务状态机派发 `PF_EVENT_WIFI_LOST`。

- [ ] **步骤 5：调整启动顺序**

初始化顺序为 queue -> hardware -> UI -> transport -> Wi-Fi -> app threads；`pf_transport_start()` 启动 UDP worker，`pf_wifi_start()` 读取 KV 并异步自动连接。无凭据时 `pf_app_start()` 仍返回成功。

- [ ] **步骤 6：运行验证并提交**

```powershell
git add firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_app.c
git commit -m "feat(firmware): integrate runtime Wi-Fi provisioning"
git push origin codex/tuya-t5ai-firmware
```

## 任务 6：移除构建期热点凭据

**文件：**
- 修改：`firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1`
- 修改：`firmware/tuya-t5ai/scripts/build-dual-demo.ps1`
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] **步骤 1：运行现有新合同确认红灯**

预期：FAIL，报告脚本仍包含 `PF_WIFI_SSID` 或 `PF_WIFI_PASSWORD`。

- [ ] **步骤 2：删除凭据检查与转义代码**

`sync-lvgl-camera.ps1` 生成的运行时头文件只保留：

```c
#define PF_DEVICE_ID 'A'
#define PF_PEER_ID 'B'
```

`build-dual-demo.ps1` 不检查 Wi-Fi 环境变量。测试的同步和构建合同同步删除旧的必需凭据符号。

- [ ] **步骤 3：运行全部 PowerShell 验证**

```powershell
pwsh -NoProfile -File firmware/tuya-t5ai/tests/validate-button-motor.ps1
pwsh -NoProfile -File firmware/tuya-t5ai/tests/validate-camera-config.ps1
pwsh -NoProfile -File firmware/tuya-t5ai/tests/validate-dual-demo.ps1
```

预期：三项均输出 `PASS`，受跟踪文件不包含明文密码。

- [ ] **步骤 4：提交脚本调整**

```powershell
git add firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1 `
        firmware/tuya-t5ai/scripts/build-dual-demo.ps1 `
        firmware/tuya-t5ai/tests/validate-dual-demo.ps1
git commit -m "build(firmware): remove compile-time Wi-Fi secrets"
git push origin codex/tuya-t5ai-firmware
```

## 任务 7：完整构建与影响检查

**文件：**
- 验证：全部固件 overlay、脚本和测试

- [ ] **步骤 1：同步 A 机 overlay**

```powershell
pwsh -NoProfile -File firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1 `
    -TuyaOpenRoot D:\TuyaOpen -DeviceId A
```

预期：输出 `PASS`，生成头文件不含 Wi-Fi 凭据。

- [ ] **步骤 2：执行 T5AI clean build**

在 `D:\TuyaOpen\examples\graphics\lvgl_camera` 中配置 TuyaOpen 环境后运行：

```powershell
tos.py clean -f
tos.py build
```

预期：exit 0，生成 `lvgl_camera_QIO_1.0.0.bin`。

- [ ] **步骤 3：执行 A/B 双固件构建**

```powershell
pwsh -NoProfile -File firmware/tuya-t5ai/scripts/build-dual-demo.ps1 `
    -TuyaOpenRoot D:\TuyaOpen
```

预期：`device-a.bin`、`device-b.bin` 均大于 1 MiB，哈希不同。

- [ ] **步骤 4：使用 codebase_memory 检查影响面**

运行 `detect_changes(project, since='3f8345c')`，确认改动只影响 T5AI firmware overlay、测试和构建脚本，未意外影响移动端、网关或 nearby-core。

- [ ] **步骤 5：检查仓库与远端状态**

```powershell
git diff --check
git status --short --branch
git log -7 --oneline
```

预期：工作树干净，本地分支与 `origin/codex/tuya-t5ai-firmware` 一致。
