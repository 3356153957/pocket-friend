# T5AI 默认 Wi-Fi 与 A 板相机方向实现计划

> 规格：`docs/superpowers/specs/2026-07-24-t5ai-default-wifi-and-device-a-camera-orientation-design.md`

## 任务 1：建立失败的固件合同

**修改：** `firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

1. 增加运行时配置合同：同步脚本必须支持默认 SSID/密码的环境注入、生成启用宏，并为 A/B 生成不同的相机旋转宏。
2. 增加 Wi-Fi 启动合同：KV 成功时先连接 KV；KV 缺失时才使用默认网络；默认网络连接不写 KV。
3. 增加图像合同：预览转换和 JPEG 解码后都调用同一个 RGB565 180° 变换函数。
4. 运行 `validate-dual-demo.ps1`，确认因功能缺失而失败，不是脚本语法错误。

## 任务 2：实现本机运行时配置注入

**修改：** `firmware/tuya-t5ai/scripts/sync-lvgl-camera.ps1`

1. 从 `PF_DEFAULT_WIFI_SSID` 和 `PF_DEFAULT_WIFI_PASSWORD` 读取本机参数。
2. 两项必须同时为空或同时提供；提供时检查 SSID 最长 32 字节、WPA2 密码 8-63 字节，并转义 C 字符串。
3. 生成 `PF_DEFAULT_WIFI_ENABLED`、`PF_DEFAULT_WIFI_SSID`、`PF_DEFAULT_WIFI_PASSWORD`。
4. 根据 `DeviceId` 生成 A=`PF_CAMERA_ROTATION_180 1`、B=`0`。
5. 不在输出中打印密码。

## 任务 3：实现默认 Wi-Fi 兜底

**修改：** `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_wifi_config.c`

1. 引入生成的 `pf_demo_runtime_config.h`。
2. 在 `PF_WIFI_COMMAND_START` 中保持 KV 读取为第一优先级。
3. KV 不存在且默认网络启用时，调用现有 `pf_wifi_begin_connect()`，设置 `save_on_success=false`、`auto_connect=true`。
4. 无默认网络时保留 `PF_WIFI_EVENT_UNCONFIGURED`。
5. 清零局部密码缓冲，日志不包含凭据。

## 任务 4：实现 A 板 RGB565 180° 旋转

**修改：** `firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c`

1. 增加原地交换 RGB565 首尾像素的静态函数；空指针和不足两个像素时直接返回。
2. 在 YUV422 转 RGB565 成功后、LVGL 刷新前调用。
3. 在 JPEG 解码成功后、设置结果图片前调用。
4. 用 `PF_CAMERA_ROTATION_180` 编译期分支保证 B 板无变换成本。
5. 运行 `validate-dual-demo.ps1`，确认红灯转绿。

## 任务 5：回归、同步与构建

1. 运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File firmware/tuya-t5ai/tests/validate-dual-demo.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File firmware/tuya-t5ai/tests/validate-camera-config.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File firmware/tuya-t5ai/tests/validate-button-motor.ps1
```

2. 用本机环境参数同步 A，检查生成头文件包含默认网络启用、A 旋转开启，且不打印密码。
3. 同步 B 到临时 TuyaOpen 副本或检查生成头，确认 B 旋转关闭。
4. 恢复 A 配置并在 `D:\TuyaOpen\examples\graphics\lvgl_camera` 执行 `tos.py clean -f` 与 `tos.py build`。
5. 检查 `lvgl_camera_QIO_1.0.0.bin` 存在且大小合理。
6. 只暂存本任务的提交内容，保留其他窗口的心跳改动；提交并正常推送 `codex/tuya-t5ai-firmware`。

## 任务 6：烧录 A 板实机验收

1. 检查 COM4/COM5 仍对应 A 板下载口和日志口。
2. 烧录新 A 固件到 COM4，确认擦除、写入、CRC 和重启成功。
3. 监听 COM5，确认启动后发起默认 Wi-Fi 连接且日志不含密码。
4. 用户打开 Camera，确认预览和拍照结果方向正确，触摸坐标与其他页面不变。
