# T5AI 100ask 姓名拼音词库实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 100ask/LVGL 全量拼音词库与常见姓氏、常用姓名字合并，为拍照姓名输入提供覆盖更完整且姓名候选优先的自定义词库。

**架构：** 用 PowerShell 生成器读取固定版本的 100ask 默认词库，再将仓库内姓名优先表前置并去重，输出独立的 `pf_pinyin_dict.c/.h`。同一生成器收集全部候选汉字并调用 `lv_font_conv` 生成配套字体，确保新增候选不会显示方框；固件关闭 LVGL 内置默认词库以避免重复占用 Flash。

**技术栈：** LVGL 9 `lv_ime_pinyin`、C、PowerShell、`lv_font_conv`、TuyaOpen/T5AI。

---

### 任务 1：锁定词库契约

**文件：**
- 修改：`firmware/tuya-t5ai/tests/validate-dual-demo.ps1`

- [ ] 增加生成器、姓名优先数据、独立 C 词库文件存在性检查。
- [ ] 验证词库至少包含 400 个拼音音节、以 `{NULL, NULL}` 结束并注明 100ask 来源。
- [ ] 验证常见姓氏和常用姓名字被覆盖，两个 IME 都使用独立词库。
- [ ] 验证配套字体覆盖词库中的每个汉字，并要求关闭重复的 LVGL 默认词库。
- [ ] 运行验证脚本，确认因独立词库尚未实现而失败。

### 任务 2：实现可复现的词库和字体生成

**文件：**
- 创建：`firmware/tuya-t5ai/resources/pinyin/name-priority.json`
- 创建：`firmware/tuya-t5ai/scripts/generate-pinyin-name-dict.ps1`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/include/pf_pinyin_dict.h`
- 创建：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_pinyin_dict.c`
- 生成：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_font_names_16.c`

- [ ] 从现有姓名词库生成姓名优先数据，并加入百家姓常见姓氏。
- [ ] 下载固定提交的 100ask 词库，按拼音合并、前置、去重候选字。
- [ ] 输出 402 个基础音节及新增音节、来源元数据和终止项。
- [ ] 用合并后的所有汉字重新生成 16px、2bpp LVGL 字体。
- [ ] 运行验证脚本，确认词库和字体契约通过。

### 任务 3：接入固件并消除重复资源

**文件：**
- 修改：`firmware/tuya-t5ai/overlays/lvgl_camera/src/pf_ui.c`
- 修改：`firmware/tuya-t5ai/config/TUYA_T5AI_BOARD_LCD_3.5.config`

- [ ] 从 `pf_ui.c` 删除内联词库并包含 `pf_pinyin_dict.h`。
- [ ] 保持姓名输入页和拼音测试页都调用 `lv_ime_pinyin_set_dict(..., pf_pinyin_name_dict)`。
- [ ] 将 `CONFIG_LV_IME_PINYIN_USE_DEFAULT_DICT` 设为 `n`，避免同时链接内置全量词库。
- [ ] 运行三套固件验证脚本。

### 任务 4：构建、提交和推送

**文件：**
- 同步目录：`D:\TuyaOpen\examples\graphics\lvgl_camera`

- [ ] 从本地 `.env` 注入 A 板运行配置并执行 `sync-lvgl-camera.ps1 -DeviceId A`。
- [ ] 在 `D:\TuyaOpen\examples\graphics\lvgl_camera` 执行完整 `tos.py build`。
- [ ] 检查固件 Flash 用量，确认全量字体未超出分区。
- [ ] 检查 `git diff` 和工作树状态，提交并通过代理推送当前分支。
