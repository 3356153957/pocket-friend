# T5AI 屏幕摄像头预览点亮规格

- 日期：2026-07-23
- 状态：待书面规格审查
- 硬件：Tuya T5AI-Board、3.5 英寸 LCD、兼容 DVP 摄像头模块
- 目标：在屏幕上稳定显示摄像头实时画面，为 Pocket Friend 后续拍照与交互功能验证硬件链路

## 1. 范围

本阶段只完成开发环境、固件编译、串口烧录和摄像头实时预览，不接入手机 App、云端、人物卡、蓝牙传图或量产电源管理。

首轮直接复用 TuyaOpen 官方 `examples/graphics/lvgl_camera` 示例，不从零实现 LCD、摄像头、像素格式转换或帧缓冲驱动。

## 2. 工具选择

- SDK 与构建系统：官方 TuyaOpen。
- 配置、编译、烧录和日志：官方 `tos.py`。
- Windows 串口驱动：WCH CH343 驱动。
- AI 开发辅助：官方 `tuya/TuyaOpen-dev-skills`，安装到 TuyaOpen SDK 的 `.agents/skills/tuyaopen`。
- 编辑器：任意；VS Code 社区 TuyaOpen Helper 暂不作为首轮依赖。

Windows 终端使用 PowerShell 或 CMD，不使用 Git Bash、MSYS2。TuyaOpen SDK 放在非 C 盘且不含中文、空格的路径，默认采用 `D:\TuyaOpen`。

## 3. 官方示例能力

`examples/graphics/lvgl_camera` 已包含：

- T5AI-Board 和 3.5 英寸 LCD 板级配置；
- DVP 摄像头初始化与帧回调；
- YUV422 到 RGB565 转换；
- DMA2D 硬件加速；
- 双帧缓冲与 LCD 刷新；
- LVGL 页面和摄像头预览的按键切换；
- PSRAM 帧缓冲支持。

当前上游源码使用 `480x480`、`15 FPS`。README 中的 `20 FPS` 与源码不同，首轮验收以实际源码和设备日志为准。

示例启用以下配置：

```text
CONFIG_BOARD_CHOICE_T5AI=y
CONFIG_TUYA_T5AI_BOARD_EX_MODULE_35565LCD=y
CONFIG_ENABLE_EX_MODULE_CAMERA=y
CONFIG_ENABLE_LIBLVGL=y
```

## 4. 数据流

```text
DVP 摄像头
  -> YUV422 原始帧
  -> TDL 摄像头帧回调
  -> DMA2D 转换为 RGB565
  -> 双帧缓冲
  -> LCD 刷新
```

首轮不保存图像。摄像头帧只用于实时预览，避免在尚未验证硬件链路时引入文件系统、网络传输和隐私数据生命周期。

## 5. 环境与驱动

Windows 需要：

- Windows 10 或 Windows 11；
- Python 3.8 或更高版本；
- Git 2.0 或更高版本；
- Make 3.0 或更高版本；
- CMake 3.28 或更高版本；
- Ninja 1.6 或更高版本；
- WCH CH343 Windows 串口驱动；
- 可传输数据的 USB-C 线。

安装 CH343 驱动并连接开发板后，设备管理器应出现两个串口。通常低编号 COM 用于烧录、高编号 COM 用于日志，但必须通过实际烧录和日志输出确认，不把编号顺序当作固定保证。

## 6. 构建与烧录流程

从 TuyaOpen SDK 根目录激活环境：

```powershell
cd D:\TuyaOpen
.\export.ps1
tos.py version
tos.py check
```

进入官方示例并构建：

```powershell
cd D:\TuyaOpen\examples\graphics\lvgl_camera
tos.py config choice -c TUYA_T5AI_BOARD_LCD_3.5.config
tos.py clean
tos.py build
```

列出 Windows 串口：

```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
```

烧录并监视日志：

```powershell
tos.py flash -p COMx
tos.py monitor -p COMy
```

T5AI 日志默认按 `460800` 波特率检查。若烧录口或日志口选择错误，交换两个 COM 口重试；烧录时不得让其他程序占用目标串口。

## 7. 首轮验收标准

全部满足才视为硬件点亮成功：

1. `tos.py check` 通过，工具链和子模块完整。
2. `lvgl_camera` 构建成功并生成可烧录固件。
3. 固件通过 CH343 串口成功写入 T5AI-Board。
4. 串口日志包含正常启动、板级硬件注册、LCD 和摄像头初始化信息，且无持续重复的错误或重启。
5. 屏幕能够显示 LVGL 初始页面。
6. 按键切换后能够连续显示摄像头实时画面。
7. 预览至少持续运行 10 分钟，无黑屏、花屏、明显撕裂、内存耗尽或看门狗重启。
8. 再次按键能够返回 LVGL 页面。

## 8. 失败处理顺序

- 未出现 COM 口：检查 USB 数据线、CH343 驱动、USB 端口和设备供电。
- 出现两个 COM 口但烧录失败：关闭串口监视程序并交换烧录口。
- 能烧录但无日志：尝试另一个 COM 口，确认 `460800` 波特率并手动复位开发板。
- LCD 无显示：先确认使用 `TUYA_T5AI_BOARD_LCD_3.5` 配置，再检查屏幕排线、背光和供电。
- 摄像头无画面：检查摄像头排线方向、DVP 连接和摄像头模块兼容性，查看设备查找和打开阶段的错误日志。
- 花屏或颜色异常：核对 YUV422 输入、RGB565 输出、字节交换和屏幕旋转配置。
- 内存不足：确认 PSRAM 已启用，保留官方双缓冲配置，不在首轮叠加 JPEG 保存或网络传输。

## 9. 后续产品化边界

硬件预览通过后，再在独立规格中增加 Pocket Friend 功能：拍照按键、不可关闭的拍照提示灯、单帧 JPEG 捕获、传输后清除、BLE 或 Wi-Fi 传输、手机端确认与隐私状态显示。实时预览示例不会直接演变为量产固件，产品功能需要建立明确的状态机和数据生命周期。
