$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$syncPath = Join-Path $root 'scripts\sync-lvgl-camera.ps1'

if (-not (Test-Path -LiteralPath $syncPath)) {
    throw "Missing dual-demo sync script: $syncPath"
}

$sync = Get-Content -LiteralPath $syncPath -Raw
$requiredSyncContract = @(
    '[ValidateSet(''A'', ''B'')]'
    '$DeviceId'
    'pf_demo_runtime_config.h'
    "Join-Path `$overlayRoot 'src'"
    "Join-Path `$overlayRoot 'include'"
    'Copy-Item'
    '-Recurse'
    'PF_ADMIN_HOST'
    'PF_ADMIN_PORT'
    'PF_DEVICE_HEARTBEAT_TOKEN'
    'PF_DEFAULT_WIFI_SSID'
    'PF_DEFAULT_WIFI_PASSWORD'
    'PF_DEFAULT_WIFI_ENABLED'
    'PF_CAMERA_ROTATION_180'
)

foreach ($item in $requiredSyncContract) {
    if (-not $sync.Contains($item)) {
        throw "Missing dual-demo sync contract: $item"
    }
}

$trackedText = Get-ChildItem -LiteralPath $root -Recurse -File |
    ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }
$trackedText = $trackedText -join "`n"

if ($trackedText -match '#define\s+PF_WIFI_PASSWORD\s+"(?![<$])[^"]+"') {
    throw 'A plaintext Wi-Fi password is tracked in firmware files'
}
if ($trackedText -match '#define\s+PF_DEFAULT_WIFI_PASSWORD\s+"(?![<$])') {
    throw 'A plaintext default Wi-Fi password is tracked in firmware files'
}
if ($trackedText -match '#define\s+PF_DEVICE_HEARTBEAT_TOKEN\s+"(?![<$])[^"]+"') {
    throw 'A plaintext server heartbeat token is tracked in firmware files'
}

$wifiHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_wifi_config.h'
$wifiSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_wifi_config.c'

foreach ($path in @($wifiHeaderPath, $wifiSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing Wi-Fi provisioning source file: $path"
    }
}

$wifi = @(
    Get-Content -LiteralPath $wifiHeaderPath -Raw
    Get-Content -LiteralPath $wifiSourcePath -Raw
) -join "`n"

$wifiRequired = @(
    'PF_WIFI_MAX_APS 20'
    'PF_WIFI_SSID_MAX 32'
    'PF_WIFI_PASSWORD_MAX 64'
    'PF_WIFI_EVENT_UNCONFIGURED'
    'PF_WIFI_EVENT_SCAN_COMPLETE'
    'PF_WIFI_EVENT_CONNECTED'
    'PF_WIFI_EVENT_CONNECT_FAILED'
    'pf_wifi_init'
    'pf_wifi_start'
    'pf_wifi_scan_async'
    'pf_wifi_connect_async'
    'tal_wifi_all_ap_scan'
    'tal_wifi_release_ap'
    'tal_wifi_station_connect'
    'tal_kv_get'
    'tal_kv_free'
    'tal_kv_set'
    'tal_kv_del'
)

foreach ($symbol in $wifiRequired) {
    if (-not $wifi.Contains($symbol)) {
        throw "Missing Wi-Fi provisioning contract: $symbol"
    }
}

$wifiStartIndex = $wifi.IndexOf('case PF_WIFI_COMMAND_START:')
$wifiScanIndex = $wifi.IndexOf('case PF_WIFI_COMMAND_SCAN:', $wifiStartIndex)
if ($wifiStartIndex -lt 0 -or $wifiScanIndex -lt 0) {
    throw 'Missing Wi-Fi startup command block'
}
$wifiStartBlock = $wifi.Substring($wifiStartIndex,
                                  $wifiScanIndex - $wifiStartIndex)
$savedWifiIndex = $wifiStartBlock.IndexOf(
    'pf_wifi_load_credentials(ssid, password)')
$defaultWifiIndex = $wifiStartBlock.IndexOf('PF_DEFAULT_WIFI_ENABLED')
if ($savedWifiIndex -lt 0 -or $defaultWifiIndex -lt 0 -or
    $savedWifiIndex -gt $defaultWifiIndex) {
    throw 'Saved Wi-Fi credentials must take priority over the build default'
}
if ($wifiStartBlock -notmatch 'pf_wifi_begin_connect\(PF_DEFAULT_WIFI_SSID,\s*PF_DEFAULT_WIFI_PASSWORD,\s*false,\s*true\)') {
    throw 'Default Wi-Fi must auto-connect without being saved to KV'
}

$protocolHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_protocol.h'
$protocolSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_protocol.c'
$stateHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_state_machine.h'
$stateSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_state_machine.c'

foreach ($path in @($protocolHeaderPath, $protocolSourcePath, $stateHeaderPath, $stateSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing dual-demo source file: $path"
    }
}

$protocolAndState = @(
    Get-Content -LiteralPath $protocolHeaderPath -Raw
    Get-Content -LiteralPath $protocolSourcePath -Raw
    Get-Content -LiteralPath $stateHeaderPath -Raw
    Get-Content -LiteralPath $stateSourcePath -Raw
) -join "`n"

$requiredSymbols = @(
    'PF_MSG_HELLO'
    'PF_MSG_CONFIRM'
    'PF_MSG_CANCEL'
    'PF_MSG_CAPTURE_PREPARE'
    'PF_MSG_PREPARE_ACK'
    'PF_MSG_CAPTURE'
    'PF_MSG_CAPTURED'
    'PF_MSG_SUCCESS'
    'PF_MSG_RESET'
    'PF_WIRE_PACKET_SIZE'
    'pf_protocol_encode'
    'pf_protocol_decode'
    'PF_STATE_ONLINE_IDLE'
    'PF_STATE_PEER_FOUND'
    'PF_STATE_WAITING_CONFIRM'
    'PF_STATE_COUNTDOWN'
    'PF_STATE_CAPTURING'
    'PF_STATE_SUCCESS'
    'PF_EVENT_OPEN_CAMERA'
    'PF_EVENT_CLOSE_CAMERA'
    'PF_EVENT_PEER_CAPTURE_FAILED'
    'PF_EVENT_RESET'
    'PF_EFFECT_SEND_PREPARE'
    'PF_EFFECT_SAFE_RESET'
    'pf_state_dispatch'
)

foreach ($symbol in $requiredSymbols) {
    if (-not $protocolAndState.Contains($symbol)) {
        throw "Missing protocol/state symbol: $symbol"
    }
}

$stateSource = Get-Content -LiteralPath $stateSourcePath -Raw
if ($stateSource -match '\b(?:tal|tdl|lv|tkl)_') {
    throw 'State machine must not call hardware, network, or UI APIs'
}

foreach ($offlineCameraContract in @(
    'PF_STATE_E camera_return_state;'
    'next.camera_return_state = next.state;'
    'next.state = next.camera_return_state;'
    'next.camera_return_state = PF_STATE_ONLINE_IDLE;'
)) {
    if (-not $protocolAndState.Contains($offlineCameraContract)) {
        throw "Camera preview must preserve network state: $offlineCameraContract"
    }
}

if ($stateSource -notmatch 'case PF_EVENT_OPEN_CAMERA:[\s\S]*PF_STATE_CONNECTING[\s\S]*PF_STATE_RECONNECTING[\s\S]*next\.camera_return_state = next\.state;') {
    throw 'Camera preview must open while Wi-Fi is unconfigured or reconnecting'
}
if ($stateSource -notmatch 'case PF_EVENT_WIFI_LOST:[\s\S]*next\.state == PF_STATE_DND[\s\S]*break;') {
    throw 'A Wi-Fi interruption must not wake a sleeping device'
}
if (-not $protocolAndState.Contains('PF_EVENT_COUNT')) {
    throw 'State events must expose PF_EVENT_COUNT so later events such as reset are accepted'
}
if ($stateSource -notmatch 'event\s*>=\s*PF_EVENT_COUNT') {
    throw 'State dispatch must validate events against PF_EVENT_COUNT, not a mid-enum event'
}

$clearSessionBlock = [regex]::Match(
    $stateSource,
    'static void pf_state_clear_session[\s\S]*?\n}'
)
$confirmedBlock = [regex]::Match(
    $stateSource,
    'static void pf_state_check_confirmed[\s\S]*?\n}'
)
$peerFoundBlock = [regex]::Match(
    $stateSource,
    'case PF_EVENT_PEER_FOUND:[\s\S]*?(?=case PF_EVENT_OPEN_CAMERA:)'
)
if (-not $protocolAndState.Contains('bool pairing_completed;') -or
    -not $confirmedBlock.Success -or
    $confirmedBlock.Value -notmatch 'ctx->pairing_completed\s*=\s*true;' -or
    -not $peerFoundBlock.Success -or
    $peerFoundBlock.Value -notmatch 'next\.pairing_completed[\s\S]*break;' -or
    -not $clearSessionBlock.Success -or
    $clearSessionBlock.Value -match 'pairing_completed') {
    throw 'Completed pairing must stay latched until pf_state_init runs after reboot'
}

$motorHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_motor.h'
$motorSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_motor.c'
$inputHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_input.h'
$inputSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_input.c'

foreach ($path in @($motorHeaderPath, $motorSourcePath, $inputHeaderPath, $inputSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing motor/input source file: $path"
    }
}

$motorAndInput = @(
    Get-Content -LiteralPath $motorHeaderPath -Raw
    Get-Content -LiteralPath $motorSourcePath -Raw
    Get-Content -LiteralPath $inputHeaderPath -Raw
    Get-Content -LiteralPath $inputSourcePath -Raw
) -join "`n"

$motorInputSymbols = @(
    'pf_motor_init'
    'pf_motor_play'
    'pf_motor_stop'
    'PF_INPUT_CONFIRM'
    'PF_INPUT_CANCEL'
    'PF_INPUT_COMPLETE'
    'PF_INPUT_TOGGLE_DND'
    'PF_INPUT_OPEN_CAMERA'
    'PF_INPUT_PHOTO_NAME_SUBMIT'
    'PF_INPUT_PHOTO_NAME_BACK'
    'PF_INPUT_CLOSE_CAMERA'
    'PF_INPUT_RETRY'
    'PF_INPUT_OPEN_WIFI'
    'PF_INPUT_WIFI_SCAN'
    'PF_INPUT_WIFI_SELECT'
    'PF_INPUT_WIFI_CONNECT'
    'PF_INPUT_WIFI_RETRY'
    'PF_INPUT_EVENT_T'
    'pf_input_post_text_from_ui'
    'pf_input_post_wifi_from_ui'
    'pf_input_init'
    'pf_input_post_from_ui'
    'pf_input_set_mode'
)

foreach ($symbol in $motorInputSymbols) {
    if (-not $motorAndInput.Contains($symbol)) {
        throw "Missing motor/input symbol: $symbol"
    }
}

$cameraHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_camera.h'
$cameraSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_camera.c'

foreach ($path in @($cameraHeaderPath, $cameraSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing camera source file: $path"
    }
}

$camera = @(
    Get-Content -LiteralPath $cameraHeaderPath -Raw
    Get-Content -LiteralPath $cameraSourcePath -Raw
) -join "`n"

$cameraRequired = @(
    'TDL_CAMERA_FMT_JPEG_YUV422_BOTH'
    'pf_camera_preview_enable'
    'pf_camera_set_frame_cb'
    'pf_camera_capture_jpeg'
    'pf_camera_release_jpeg'
    'PF_CAPTURE_TIMEOUT_MS'
    'tal_semaphore_wait'
    'tal_mutex_lock'
    'tal_psram_malloc'
    'tal_psram_free'
)

foreach ($symbol in $cameraRequired) {
    if (-not $camera.Contains($symbol)) {
        throw "Missing camera lifecycle contract: $symbol"
    }
}
foreach ($captureStreamContract in @(
    'pf_camera_prepare_capture_stream',
    'PF_CAPTURE_STREAM_WARMUP_MS',
    'sg_capture_stream_until',
    'pf_camera_capture_stream_ready'
)) {
    if (-not $camera.Contains($captureStreamContract)) {
        throw "Camera must keep the encoded stream warm before synchronized capture: $captureStreamContract"
    }
}

$uiHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_ui.h'
$uiSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_ui.c'
$pinyinDictHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_pinyin_dict.h'
$pinyinDictSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_pinyin_dict.c'
$nameFontPath = Join-Path $root 'overlays\lvgl_camera\src\pf_font_names_16.c'
$pinyinGeneratorPath = Join-Path $root 'scripts\generate-pinyin-name-dict.ps1'
$namePriorityPath = Join-Path $root 'resources\pinyin\name-priority.json'

foreach ($path in @(
    $uiHeaderPath
    $uiSourcePath
    $pinyinDictHeaderPath
    $pinyinDictSourcePath
    $pinyinGeneratorPath
    $namePriorityPath
)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing UI source file: $path"
    }
}
if (-not (Test-Path -LiteralPath $nameFontPath)) {
    throw "Missing generated pinyin name font: $nameFontPath"
}

$uiSource = Get-Content -LiteralPath $uiSourcePath -Raw -Encoding utf8
$ui = @(
    Get-Content -LiteralPath $uiHeaderPath -Raw -Encoding utf8
    $uiSource
) -join "`n"
$pinyinDict = @(
    Get-Content -LiteralPath $pinyinDictHeaderPath -Raw -Encoding utf8
    Get-Content -LiteralPath $pinyinDictSourcePath -Raw -Encoding utf8
) -join "`n"
$nameFont = Get-Content -LiteralPath $nameFontPath -Raw -Encoding utf8
$namePriority = Get-Content -LiteralPath $namePriorityPath -Raw -Encoding utf8 |
    ConvertFrom-Json

$uiRequired = @(
    'lv_vendor_init(DISPLAY_NAME)'
    'lv_vendor_start'
    'PF_UI_PAGE_IDLE'
    'PF_UI_PAGE_PREVIEW'
    'PF_UI_PAGE_MATCH'
    'PF_UI_PAGE_WAITING'
    'PF_UI_PAGE_COUNTDOWN'
    'PF_UI_PAGE_RESULT'
    'PF_UI_PAGE_DND'
    'PF_UI_PAGE_ERROR'
    'PF_UI_PAGE_PHOTO_NAME_INPUT'
    'PF_UI_PAGE_PINYIN_INPUT'
    'PF_UI_PAGE_WIFI_SCAN'
    'PF_UI_PAGE_WIFI_PASSWORD'
    'PF_UI_PAGE_WIFI_CONNECT'
    'PF_UI_TOUCH_TARGET'
    'lv_canvas_set_buffer'
    'tal_image_convert_yuv422_to_rgb565'
    'tal_image_jpeg_decode_rgb565'
    'pf_input_post_from_ui'
    'pf_ui_camera_frame_cb'
    'pf_camera_set_frame_cb(pf_ui_camera_frame_cb)'
    'pf_ui_create_photo_name_input_page'
    'pf_ui_show_photo_name_input'
    'lv_textarea_set_password_mode'
    'lv_textarea_set_max_length'
    'lv_keyboard_create'
    'lv_keyboard_set_textarea'
    'lv_ime_pinyin_create'
    'lv_ime_pinyin_set_keyboard'
    'lv_ime_pinyin_get_cand_panel'
    'LV_FONT_DECLARE(pf_font_names_16)'
    '&pf_font_names_16'
    '#include "pf_pinyin_dict.h"'
    'pf_ui_show_preview_countdown'
    'pf_ui_create_pinyin_input_page'
    'pf_ui_wifi_set_results'
    'pf_ui_wifi_show_connecting'
    'PF_CAMERA_ROTATION_180'
    'pf_ui_rotate_rgb565_180'
)

foreach ($symbol in $uiRequired) {
    if (-not $ui.Contains($symbol)) {
        throw "Missing UI contract: $symbol"
    }
}

$rotationUseCount = ([regex]::Matches(
    $ui, 'pf_ui_rotate_rgb565_180\('
)).Count
if ($rotationUseCount -lt 3) {
    throw 'A-board rotation must cover both preview and decoded photo output'
}
if ($ui -notmatch 'pf_camera_set_frame_cb\(pf_ui_camera_frame_cb\);[\s\S]*pf_camera_preview_enable\(true\);') {
    throw 'Live preview start must enable camera frame delivery after installing the frame callback'
}

if ($ui -notmatch '#define\s+PF_UI_TOUCH_TARGET\s+64') {
    throw 'UI touch target must be at least the planned 64 pixels'
}

if ($ui -match 'lv_ime_pinyin_set_keyboard\([^,]+,\s*sg_ui\.wifi_keyboard\)') {
    throw 'Pinyin IME must not attach to the Wi-Fi password keyboard'
}

$customPinyinDictUseCount = ([regex]::Matches(
    $ui,
    'lv_ime_pinyin_set_dict\([^,]+,\s*pf_pinyin_name_dict\s*\)'
)).Count
if ($customPinyinDictUseCount -ne 2) {
    throw 'Both pinyin IMEs must use the expanded name dictionary'
}

if ($ui -match 'static\s+lv_pinyin_dict_t\s+sg_pinyin_name_dict') {
    throw 'Generated pinyin dictionary must not remain embedded in pf_ui.c'
}

if ($pinyinDict -notmatch '\{\s*"shi",\s*"[^"]{18,}"\s*\}') {
    throw 'Expanded pinyin name dictionary must keep high-frequency syllables beyond two candidate pages'
}

if ($pinyinDict -notmatch '100askTeam/lv_lib_100ask' -or
    $pinyinDict -notmatch '\{\s*NULL,\s*NULL\s*\}') {
    throw 'Generated pinyin dictionary must record its 100ask source and terminator'
}

$dictEntries = [regex]::Matches(
    $pinyinDict,
    '\{\s*"([a-z]+)",\s*"([^"]*)"\s*\}'
)
if ($dictEntries.Count -lt 402) {
    throw "Generated pinyin dictionary is incomplete: $($dictEntries.Count) entries"
}

$commonSurnameCodepoints = @(
    0x8D75, 0x94B1, 0x5B59, 0x674E, 0x5468, 0x5434, 0x90D1, 0x738B,
    0x51AF, 0x9648, 0x891A, 0x536B, 0x848B, 0x6C88, 0x97E9, 0x6768,
    0x6731, 0x79E6, 0x5C24, 0x8BB8, 0x4F55, 0x5415, 0x65BD, 0x5F20,
    0x5B54, 0x66F9, 0x4E25, 0x534E, 0x91D1, 0x9B4F, 0x9676, 0x59DC,
    0x621A, 0x8C22, 0x90B9, 0x55BB, 0x67CF, 0x6C34, 0x7AA6, 0x7AE0,
    0x4E91, 0x82CF, 0x6F58, 0x845B, 0x595A, 0x8303, 0x5F6D, 0x90CE,
    0x9C81, 0x97E6, 0x660C, 0x9A6C, 0x82D7, 0x51E4, 0x82B1, 0x65B9,
    0x4FDE, 0x4EFB, 0x8881, 0x67F3, 0x9146, 0x9C8D, 0x53F2, 0x5510,
    0x8D39, 0x5EC9, 0x5C91, 0x859B, 0x96F7, 0x8D3A, 0x502A, 0x6C64,
    0x6ED5, 0x6BB7, 0x7F57, 0x6BD5, 0x90DD, 0x90AC, 0x5B89, 0x5E38,
    0x4E50, 0x4E8E, 0x65F6, 0x5085, 0x76AE, 0x535E, 0x9F50, 0x5EB7,
    0x4F0D, 0x4F59, 0x5143, 0x535C, 0x987E, 0x5B5F, 0x5E73, 0x9EC4,
    0x548C, 0x7A46, 0x8427, 0x5C39
)
$commonSurnames = -join ($commonSurnameCodepoints | ForEach-Object { [char]$_ })
if ($namePriority.commonSurnames -ne $commonSurnames) {
    throw 'Name priority data must keep the agreed common-surname set'
}

foreach ($surname in $commonSurnames.ToCharArray()) {
    if (-not $pinyinDict.Contains([string]$surname)) {
        throw "Generated pinyin dictionary is missing common surname: $surname"
    }
}

foreach ($entry in @(
    @{ Pinyin = 'chu'; Character = [char]0x891A }
    @{ Pinyin = 'xi'; Character = [char]0x595A }
    @{ Pinyin = 'feng'; Character = [char]0x9146 }
    @{ Pinyin = 'wu'; Character = [char]0x90AC }
)) {
    if ($pinyinDict -notmatch ('\{{\s*"{0}",\s*"[^"]*{1}' -f
            $entry.Pinyin, $entry.Character)) {
        throw "Generated pinyin dictionary is missing surname reading: $($entry.Character) $($entry.Pinyin)"
    }
}

if ($ui -notmatch 'lv_obj_set_parent\(\s*cand_panel,\s*sg_ui\.pages\[PF_UI_PAGE_PINYIN_INPUT\]\s*\)') {
    throw 'Pinyin candidate panel must be reparented to the pinyin page'
}

if ($ui -notmatch 'lv_obj_set_style_bg_color\(\s*cand_panel,\s*lv_color_white\(\),\s*0\s*\)') {
    throw 'Pinyin candidate panel must use a white background'
}

if ($ui -notmatch 'lv_obj_set_style_text_color\(\s*cand_panel,\s*lv_color_black\(\),\s*0\s*\)') {
    throw 'Pinyin candidate panel must use black text on the white candidate panel'
}

if ($ui -notmatch 'lv_obj_set_style_bg_opa\(\s*cand_panel,\s*LV_OPA_COVER,\s*0\s*\)') {
    throw 'Pinyin candidate panel must have an opaque background'
}

if ($ui -notmatch '#define\s+PF_UI_PINYIN_CAND_WIDTH\s+304' -or
    $ui -notmatch '#define\s+PF_UI_PINYIN_CAND_HEIGHT\s+52') {
    throw 'Pinyin candidate panel must be tall enough to avoid cramped candidate columns'
}

$candPanelSizeUseCount = ([regex]::Matches(
    $ui,
    'lv_obj_set_size\(\s*cand_panel,\s*PF_UI_PINYIN_CAND_WIDTH,\s*PF_UI_PINYIN_CAND_HEIGHT\s*\)'
)).Count
if ($candPanelSizeUseCount -ne 2) {
    throw 'Both pinyin candidate panels must use the shared candidate size'
}

if ($ui -notmatch 'lv_obj_set_style_pad_all\(\s*cand_panel,\s*4,\s*0\s*\)') {
    throw 'Pinyin candidate panel must use compact padding so more candidates fit'
}

$dictMatches = [regex]::Matches(
    $pinyinDict,
    '\{\s*"[^"]+",\s*"([^"]*)"\s*\}'
)
$dictChars = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($match in $dictMatches) {
    foreach ($ch in $match.Groups[1].Value.ToCharArray()) {
        if ([int][char]$ch -ge 0x4E00) {
            [void]$dictChars.Add([string]$ch)
        }
    }
}
foreach ($ch in $dictChars) {
    $code = 'U+{0:X4}' -f [int][char]$ch
    if (-not $nameFont.Contains($code)) {
        throw "Pinyin name font is missing glyph $code $ch"
    }
}

$configPath = Join-Path $root 'config\TUYA_T5AI_BOARD_LCD_3.5.config'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Missing T5AI LCD config: $configPath"
}
$lcdConfig = Get-Content -LiteralPath $configPath -Raw
foreach ($symbol in @(
    'CONFIG_LV_USE_IME_PINYIN=y'
    'CONFIG_LV_IME_PINYIN_USE_DEFAULT_DICT=n'
    'CONFIG_LV_IME_PINYIN_CAND_TEXT_NUM=8'
    'CONFIG_LV_FONT_SIMSUN_16_CJK=y'
)) {
    if (-not $lcdConfig.Contains($symbol)) {
        throw "Missing pinyin input config: $symbol"
    }
}

foreach ($forbidden in @('Hello World', 'tdl_disp_dev_flush', 'disp_disable_update')) {
    if ($ui.Contains($forbidden)) {
        throw "UI module must not own the display outside LVGL: $forbidden"
    }
}

$transportHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_transport.h'
$transportSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_transport.c'

foreach ($path in @($transportHeaderPath, $transportSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing transport source file: $path"
    }
}

$transport = @(
    Get-Content -LiteralPath $transportHeaderPath -Raw
    Get-Content -LiteralPath $transportSourcePath -Raw
) -join "`n"

$transportRequired = @(
    'pf_transport_network_up'
    'pf_transport_network_down'
    'pf_transport_set_discoverable'
    'tal_net_socket_create(PROTOCOL_UDP)'
    'tal_net_set_broadcast'
    'tal_net_set_reuse'
    'tal_net_bind'
    'tal_net_set_block'
    'tal_net_send_to'
    'tal_net_recvfrom'
    'tal_net_close'
    'PF_HEARTBEAT_MS'
    'PF_PEER_TIMEOUT_MS'
    'PF_CRITICAL_RETRY_COUNT'
    'pf_protocol_decode'
)

foreach ($symbol in $transportRequired) {
    if (-not $transport.Contains($symbol)) {
        throw "Missing transport contract: $symbol"
    }
}

foreach ($forbidden in @('tal_wifi_init', 'tal_wifi_set_work_mode',
                          'tal_wifi_station_connect', 'PF_WIFI_SSID',
                          'PF_WIFI_PASSWORD')) {
    if ($transport.Contains($forbidden)) {
        throw "Transport must not own Wi-Fi: $forbidden"
    }
}

$serverHeartbeatHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_server_heartbeat.h'
$serverHeartbeatSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_server_heartbeat.c'
foreach ($path in @($serverHeartbeatHeaderPath, $serverHeartbeatSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing server heartbeat source file: $path"
    }
}
$serverHeartbeat = @(
    Get-Content -LiteralPath $serverHeartbeatHeaderPath -Raw
    Get-Content -LiteralPath $serverHeartbeatSourcePath -Raw
) -join "`n"
foreach ($symbol in @(
    'http_client_request'
    'PF_ADMIN_HOST'
    'PF_ADMIN_PORT'
    'PF_DEVICE_HEARTBEAT_TOKEN'
    'PF_SERVER_HEARTBEAT_MS'
    'pf_server_heartbeat_init'
    'pf_server_heartbeat_network_up'
    'pf_server_heartbeat_network_down'
    'pf_server_photo_upload'
    'image/jpeg'
    '/api/photos?deviceId=board-'
    '&filename='
    'pf_server_url_encode'
)) {
    if (-not $serverHeartbeat.Contains($symbol)) {
        throw "Missing server heartbeat contract: $symbol"
    }
}

$appHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_app.h'
$appSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_app.c'
$configHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_demo_config.h'
$entryPath = Join-Path $root 'overlays\lvgl_camera\src\example_lvgl_camera.c'

foreach ($path in @($appHeaderPath, $appSourcePath, $configHeaderPath, $entryPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing integrated app source file: $path"
    }
}

$app = @(
    Get-Content -LiteralPath $appHeaderPath -Raw
    Get-Content -LiteralPath $appSourcePath -Raw
) -join "`n"
$entry = Get-Content -LiteralPath $entryPath -Raw
$config = Get-Content -LiteralPath $configHeaderPath -Raw

$appRequired = @(
    'PF_APP_EVENT_INPUT'
    'PF_APP_EVENT_TRANSPORT'
    'PF_APP_EVENT_TIMER'
    'PF_APP_EVENT_CAPTURE_DONE'
    'PF_APP_EVENT_WIFI'
    'PF_APP_QUEUE_LENGTH 16'
    'tal_queue_create_init'
    'tal_queue_post'
    'tal_queue_fetch'
    'pf_state_dispatch'
    'pf_motor_init'
    'pf_input_init'
    'pf_camera_init'
    'pf_ui_init'
    'pf_transport_init'
    'pf_transport_start'
    'pf_wifi_init'
    'pf_wifi_start'
    'pf_handle_wifi'
    'pf_transport_network_up'
    'pf_transport_network_down'
    'pf_server_heartbeat_init'
    'pf_server_heartbeat_network_up'
    'pf_server_heartbeat_network_down'
    'PF_INPUT_PHOTO_NAME_SUBMIT'
    'pf_ui_show_photo_name_input'
    'sg_photo_filename'
    'pf_app_build_photo_filename'
    'sg_manual_capture_requested'
    'pf_server_photo_upload'
    'PF_MSG_CAPTURE_PREPARE'
    'PF_MSG_PREPARE_ACK'
    'PF_MSG_CAPTURE'
    'PF_CAPTURE_DELAY_MS'
    'pf_camera_capture_jpeg'
    'PF_MSG_CAPTURED'
    'PF_MSG_SUCCESS'
    'sg_state.state != PF_STATE_DND'
)

foreach ($symbol in $appRequired) {
    if (-not $app.Contains($symbol)) {
        throw "Missing integrated app contract: $symbol"
    }
}

$connectingRoute = [regex]::Match(
    $app,
    'case PF_STATE_CONNECTING:[\s\S]*?case PF_STATE_RECONNECTING:[\s\S]*?break;'
)
if (-not $connectingRoute.Success -or
    $connectingRoute.Value -notmatch 'pf_ui_is_started\(\)' -or
    $connectingRoute.Value -notmatch 'PF_UI_PAGE_START' -or
    $connectingRoute.Value -notmatch 'PF_UI_PAGE_IDLE') {
    throw 'Connecting state must preserve the START page until the user begins'
}

$petDeviceMatch = [regex]::Match(
    $ui,
    'static lv_obj_t \*pf_ui_draw_pet_device\([\s\S]*?(?=static (?:lv_obj_t \*pf_ui_create_brand_page|void pf_ui_create_start_page))'
)
if (-not $petDeviceMatch.Success) {
    throw 'Missing pet device drawing function'
}
foreach ($decorativeObject in @('body', 'screen', 'btn')) {
    if ($petDeviceMatch.Value -notmatch (
        'lv_obj_clear_flag\(' + $decorativeObject +
        ',\s*LV_OBJ_FLAG_SCROLLABLE\s*\|\s*LV_OBJ_FLAG_CLICKABLE\);'
    )) {
        throw "Sleep-page decoration must not intercept wake taps: $decorativeObject"
    }
}

if (-not $app.Contains('sg_wifi_selected >= sg_wifi_ap_count')) {
    throw 'Wi-Fi connect and retry must reject a stale AP selection'
}
if ($app -match 'case PF_INPUT_WIFI_SELECT:[\s\S]*pf_wifi_connect_async\(sg_wifi_selected,\s*""\)') {
    throw 'Wi-Fi AP selection must not auto-connect with an empty password'
}
if ($app -notmatch 'case PF_INPUT_WIFI_SELECT:[\s\S]*pf_ui_wifi_show_password\(sg_wifi_aps\[sg_wifi_selected\]\.ssid\);[\s\S]*break;') {
    throw 'Wi-Fi AP selection must open the password page'
}
if ($app -notmatch 'case PF_WIFI_EVENT_CONNECT_FAILED:[\s\S]*if \(sg_wifi_manual_connecting\) \{[\s\S]*pf_ui_wifi_show_failed\("Password wrong or network unavailable"\);[\s\S]*\}[\s\S]*break;') {
    throw 'Auto-connect failures must not replace the Wi-Fi scan page with a password error'
}
if ($app -notmatch 'case PF_STATE_COUNTDOWN:[\s\S]*pf_camera_prepare_capture_stream\(\)') {
    throw 'Synchronized capture must warm the camera stream during the countdown'
}

$heartbeatBlock = [regex]::Match(
    $transport,
    'static void pf_heartbeat_cb\(TIMER_ID timer_id, void \*arg\)[\s\S]*?\n}'
)
$receiveBlock = [regex]::Match(
    $transport,
    'static void pf_receive_once\(void\)[\s\S]*?(?=static void pf_process_retries)'
)
$discoverableBlock = [regex]::Match(
    $transport,
    'void pf_transport_set_discoverable\(bool discoverable\)\s*\{[\s\S]*?\n}'
)
if (-not $heartbeatBlock.Success -or
    $heartbeatBlock.Value -notmatch 'sg_discoverable' -or
    -not $receiveBlock.Success -or
    $receiveBlock.Value -notmatch '!sg_discoverable' -or
    -not $discoverableBlock.Success -or
    -not $discoverableBlock.Value.Contains('pf_transport_send(PF_MSG_HELLO') -or
    $transport -notmatch 'pf_transport_network_up\(void\)\s*\{[\s\S]*sg_discoverable[\s\S]*pf_transport_send\(PF_MSG_HELLO') {
    throw 'Sleep must stop LAN discovery; wake must immediately advertise again'
}
if ($ui -notmatch 'pf_ui_create_brand_page\(PF_UI_PAGE_START,\s*"START",\s*PF_INPUT_START' -or
    $ui -notmatch 'pf_ui_create_brand_page\(PF_UI_PAGE_IDLE,\s*"CAMERA",\s*PF_INPUT_OPEN_CAMERA' -or
    $ui -match 'pf_ui_create_page\("Pocket Friend"\)' -or
    $ui -match 'LV_SYMBOL_IMAGE,\s*PF_INPUT_CAPTURE_PHOTO') {
    throw 'START and CAMERA pages must share the teammate brand layout'
}
$idlePage = [regex]::Match(
    $ui,
    'static void pf_ui_create_idle_page\(void\)[\s\S]*?(?=static void pf_ui_create_photo_name_input_page)'
)
if (-not $idlePage.Success -or
    $idlePage.Value -notmatch '"SLEEP",\s*PF_INPUT_TOGGLE_DND' -or
    $idlePage.Value -match 'PF_INPUT_OPEN_PINYIN') {
    throw 'Brand home must expose SLEEP without the pinyin test shortcut'
}
$brandPage = [regex]::Match(
    $uiSource,
    'static lv_obj_t \*pf_ui_create_brand_page[\s\S]*?(?=static void pf_ui_create_start_page)'
)
if (-not $brandPage.Success -or
    $brandPage.Value -notmatch 'lv_obj_align\(device,\s*LV_ALIGN_TOP_MID,\s*0,\s*104\)' -or
    $idlePage.Value -notmatch 'lv_obj_t \*shadow;' -or
    $idlePage.Value -notmatch 'lv_obj_set_size\(shadow,\s*PF_UI_PRIMARY_WIDTH,\s*PF_UI_PRIMARY_HEIGHT\)' -or
    $idlePage.Value -notmatch '"SLEEP",\s*PF_INPUT_TOGGLE_DND,\s*PF_UI_COLOR_PINK,\s*false' -or
    $idlePage.Value -notmatch 'lv_obj_set_style_border_width\(button,\s*4,\s*0\)' -or
    $idlePage.Value -notmatch 'lv_font_montserrat_24' -or
    $idlePage.Value -notmatch 'lv_obj_align\(button,\s*LV_ALIGN_BOTTOM_MID,\s*0,\s*-136\)' -or
    $idlePage.Value -match 'lv_obj_set_size\(button,\s*112,\s*48\)') {
    throw 'SLEEP must match the full primary CAMERA button style without overlap'
}
$wifiStatusUpdate = [regex]::Match(
    $uiSource,
    'void pf_ui_set_wifi_status\(bool connected, bool busy\)[\s\S]*?(?=void pf_ui_wifi_show_scan)'
)
if ($uiSource -match 'wifi_status_label' -or
    $idlePage.Value -notmatch 'sg_ui\.wifi_button\s*=\s*pf_ui_create_button\([\s\S]*PF_UI_COLOR_MUTED' -or
    -not $wifiStatusUpdate.Success -or
    $wifiStatusUpdate.Value -notmatch 'sg_ui\.wifi_button' -or
    $wifiStatusUpdate.Value -notmatch 'connected\s*\?\s*PF_UI_COLOR_SUCCESS\s*:\s*PF_UI_COLOR_MUTED') {
    throw 'Wi-Fi connectivity must be shown by a gray/green Wi-Fi button without a separate status label'
}
$matchPage = [regex]::Match(
    $ui,
    'static void pf_ui_create_match_page\(void\)[\s\S]*?(?=static void pf_ui_create_waiting_page)'
)
if (-not $matchPage.Success -or
    $matchPage.Value -notmatch 'pf_ui_create_blank_page\(PF_UI_COLOR_SKY\)' -or
    $matchPage.Value -notmatch '"FRIEND"' -or
    $matchPage.Value -notmatch '"FOUND!"' -or
    $matchPage.Value -notmatch 'PF_INPUT_CONFIRM,\s*PF_UI_COLOR_PINK' -or
    $matchPage.Value -match 'pf_ui_create_page\("Friend found"\)') {
    throw 'Friend match page must use the teammate brand layout'
}
$waitingUiPage = [regex]::Match(
    $ui,
    'static void pf_ui_create_waiting_page\(void\)[\s\S]*?(?=static void pf_ui_create_countdown_page)'
)
if (-not $waitingUiPage.Success -or
    $waitingUiPage.Value -notmatch 'pf_ui_create_blank_page\(PF_UI_COLOR_SKY\)' -or
    $waitingUiPage.Value -notmatch '"ALMOST"' -or
    $waitingUiPage.Value -notmatch '"READY!"' -or
    $waitingUiPage.Value -notmatch 'PF_INPUT_CONFIRM,\s*PF_UI_COLOR_PINK' -or
    $waitingUiPage.Value -notmatch 'PF_INPUT_CANCEL,\s*PF_UI_COLOR_LIME' -or
    $waitingUiPage.Value -match 'pf_ui_create_page\("Almost ready"\)') {
    throw 'Waiting-confirm page must use the same branded layout as friend matching'
}
$confirmedUiUpdate = [regex]::Match(
    $ui,
    'void pf_ui_set_confirmed\(bool local, bool peer\)\s*\{[\s\S]*?(?=void pf_ui_set_countdown)'
)
if (-not $confirmedUiUpdate.Success -or
    $confirmedUiUpdate.Value -notmatch 'sg_ui\.waiting_confirm_button' -or
    $confirmedUiUpdate.Value -notmatch 'sg_ui\.waiting_confirm_shadow' -or
    $confirmedUiUpdate.Value -notmatch 'local[\s\S]*LV_OBJ_FLAG_HIDDEN') {
    throw 'Waiting-confirm page must hide both confirm and its shadow after local confirmation'
}
$pairSuccessPage = [regex]::Match(
    $ui,
    'static void pf_ui_create_pair_success_page\(void\)[\s\S]*?(?=static void pf_ui_create_countdown_page)'
)
if (-not $protocolAndState.Contains('PF_STATE_PAIRED') -or
    -not $ui.Contains('PF_UI_PAGE_PAIR_SUCCESS') -or
    -not $pairSuccessPage.Success -or
    $pairSuccessPage.Value -notmatch '"SUCCESS"' -or
    $pairSuccessPage.Value -match 'pf_ui_create_button') {
    throw 'Completed pairing must use a dedicated button-free SUCCESS page'
}
$happyPetCount = ([regex]::Matches(
    $pairSuccessPage.Value,
    'pf_ui_draw_pet_device\(page,\s*false,\s*true\)'
)).Count
if ($happyPetCount -ne 2 -or
    $uiSource -notmatch 'pf_ui_draw_pet_device\(lv_obj_t \*parent,\s*bool asleep,\s*bool happy\)' -or
    $uiSource -notmatch 'happy\s*\?\s*"\(\^_\^\)"\s*:\s*"\(o_o\)"') {
    throw 'Both devices on the pairing SUCCESS page must show happy faces'
}
$pairedRefresh = [regex]::Match(
    $app,
    'case PF_STATE_PAIRED:[\s\S]*?break;'
)
$pairedTimeout = [regex]::Match(
    $stateSource,
    'case PF_EVENT_TIMEOUT:[\s\S]*?(?=case PF_EVENT_ENTER_DND:)'
)
if (-not $pairedRefresh.Success -or
    $pairedRefresh.Value -notmatch 'PF_UI_PAGE_PAIR_SUCCESS' -or
    $pairedRefresh.Value -notmatch 'PF_PAIR_SUCCESS_DISPLAY_MS' -or
    $app -notmatch '#define PF_PAIR_SUCCESS_DISPLAY_MS\s+3000U' -or
    -not $pairedTimeout.Success -or
    $pairedTimeout.Value -notmatch 'PF_STATE_PAIRED[\s\S]*pf_state_enter_idle' -or
    $app -notmatch 'sg_state\.state == PF_STATE_PAIRED[\s\S]*pf_ui_mark_started\(false\)') {
    throw 'Pair SUCCESS must stay for three seconds and then return to START'
}
if ($stateSource -notmatch 'ctx->pairing_completed\s*=\s*true;[\s\S]*ctx->state\s*=\s*PF_STATE_PAIRED;' -or
    $stateSource -match 'ctx->state\s*=\s*PF_STATE_PAIRED;[\s\S]{0,120}PF_EFFECT_SEND_PREPARE') {
    throw 'Confirming both devices must finish pairing without starting photo capture'
}
$showPageBlock = [regex]::Match(
    $uiSource,
    'void pf_ui_show_page\(PF_UI_PAGE_E page\)[\s\S]*?(?=void pf_ui_mark_started)'
)
if (-not $showPageBlock.Success -or
    $showPageBlock.Value -notmatch 'lv_screen_active\(\)\s*!=\s*sg_ui\.pages\[page\]') {
    throw 'Loading an already active page must be skipped to prevent display flicker'
}
$peerFoundPage = [regex]::Match(
    $app,
    'case PF_STATE_PEER_FOUND:[\s\S]*?break;'
)
$waitingPage = [regex]::Match(
    $app,
    'case PF_STATE_WAITING_CONFIRM:[\s\S]*?break;'
)
if (-not $peerFoundPage.Success -or
    $peerFoundPage.Value -notmatch 'tal_sw_timer_stop\(sg_flow_timer\)' -or
    $peerFoundPage.Value -match 'tal_sw_timer_start' -or
    -not $waitingPage.Success -or
    $waitingPage.Value -notmatch 'tal_sw_timer_stop\(sg_flow_timer\)' -or
    $waitingPage.Value -match 'tal_sw_timer_start') {
    throw 'Friend match and waiting-confirm pages must stay visible without a flow timeout'
}
$transportPeerFound = [regex]::Match(
    $app,
    'case PF_TRANSPORT_PEER_FOUND:[\s\S]*?(?=case PF_TRANSPORT_PEER_LOST:)'
)
$transportPeerLost = [regex]::Match(
    $app,
    'case PF_TRANSPORT_PEER_LOST:[\s\S]*?(?=case PF_TRANSPORT_MESSAGE:)'
)
if (-not $transportPeerFound.Success -or
    $transportPeerFound.Value -notmatch 'sg_state\.state == PF_STATE_PEER_FOUND[\s\S]*pf_ui_set_peer\(PF_PEER_ID,\s*true\)' -or
    $transportPeerFound.Value -notmatch 'sg_state\.state == PF_STATE_WAITING_CONFIRM[\s\S]*pf_ui_set_peer\(PF_PEER_ID,\s*true\)[\s\S]*PF_MSG_CONFIRM' -or
    -not $transportPeerLost.Success -or
    $transportPeerLost.Value -notmatch 'PF_STATE_PEER_FOUND[\s\S]*PF_STATE_WAITING_CONFIRM[\s\S]*pf_ui_set_peer\(PF_PEER_ID,\s*false\)') {
    throw 'Transient peer loss must keep matching and waiting-confirm pages stable'
}
$timerHandler = [regex]::Match(
    $app,
    'static void pf_handle_timer\(PF_EVENT_E timer_event\)[\s\S]*?(?=static void pf_app_task)'
)
if (-not $timerHandler.Success -or
    $timerHandler.Value -notmatch 'PF_STATE_PEER_FOUND[\s\S]*PF_STATE_WAITING_CONFIRM[\s\S]*return;' -or
    $timerHandler.Value -match 'PF_STATE_WAITING_CONFIRM[\s\S]*pf_dispatch\(PF_EVENT_RESET\)') {
    throw 'Friend-found and waiting-confirm pages must ignore stale flow-timer events'
}
if ($config -notmatch '#define PF_PEER_TIMEOUT_MS\s+8000U') {
    throw 'Peer heartbeat timeout must tolerate short Wi-Fi broadcast gaps'
}
if ($config -notmatch '#define PF_PAIRING_COOLDOWN_MS\s+10000U' -or
    $app -notmatch 'case PF_INPUT_CANCEL:[\s\S]*PF_STATE_CAPTURE_PREPARE[\s\S]*pf_start_pairing_cooldown\(\)' -or
    $app -notmatch 'sg_pairing_cooldown_active[\s\S]*PF_TRANSPORT_PEER_FOUND' -or
    $app -notmatch 'PF_APP_EVENT_PAIRING_COOLDOWN[\s\S]*pf_finish_pairing_cooldown\(\)') {
    throw 'Cancel must suppress automatic friend matching for ten seconds'
}
if ($stateSource -notmatch 'case PF_EVENT_PEER_FOUND:[\s\S]*PF_STATE_PEER_FOUND;[\s\S]*PF_EFFECT_UI_REFRESH\s*\|\s*PF_EFFECT_MOTOR_FEEDBACK' -or
    $app -notmatch 'sg_state\.state == PF_STATE_PEER_FOUND[\s\S]*PF_MOTOR_PATTERN_PEER_FOUND') {
    throw 'Entering friend match must trigger the peer-found vibration pattern'
}
$peerFoundStateBlock = [regex]::Match(
    $stateSource,
    'case PF_EVENT_PEER_FOUND:[\s\S]*?(?=case PF_EVENT_OPEN_CAMERA:)'
)
if (-not $peerFoundStateBlock.Success -or
    $peerFoundStateBlock.Value -notmatch 'next\.state != PF_STATE_ONLINE_IDLE\s*&&\s*next\.state != PF_STATE_CAMERA_PREVIEW') {
    throw 'DND must ignore peer discovery without UI or motor effects'
}
if ($app -notmatch 'previous_state != PF_STATE_DND[\s\S]*sg_state\.state == PF_STATE_DND[\s\S]*pf_transport_set_discoverable\(false\)' -or
    $app -notmatch 'previous_state == PF_STATE_DND[\s\S]*sg_state\.state != PF_STATE_DND[\s\S]*pf_transport_set_discoverable\(true\)') {
    throw 'Entering and leaving sleep must update peer discoverability on both boards'
}
if ($app -notmatch 'case PF_STATE_CAMERA_PREVIEW:[\s\S]*pf_ui_show_photo_name_input\(\);[\s\S]*break;') {
    throw 'Manual capture flow must open the photographer name page before taking the photo'
}
$photoNameSubmitIndex = $app.IndexOf('case PF_INPUT_PHOTO_NAME_SUBMIT:')
$photoFilenameIndex = $app.IndexOf(
    'pf_app_build_photo_filename(input->text, sg_photo_filename',
    $photoNameSubmitIndex)
$manualCountdownIndex = $app.IndexOf(
    'pf_start_countdown();',
    $photoFilenameIndex)
if ($photoNameSubmitIndex -lt 0 -or $photoFilenameIndex -lt 0 -or
    $manualCountdownIndex -lt 0) {
    throw 'Photo name submit must build the filename and start a countdown before capture'
}
$uploadIndex = $app.IndexOf(
    'pf_server_photo_upload(jpeg, len, sg_photo_filename)')
if ($uploadIndex -lt 0) {
    throw 'Manual photo upload filename must come from the submitted photographer name'
}
if ($app -notmatch 'case PF_INPUT_PHOTO_NAME_SUBMIT:[\s\S]*pf_ui_preview_start\(PF_CAMERA_WIDTH,\s*PF_CAMERA_HEIGHT\)[\s\S]*pf_start_countdown\(\);') {
    throw 'Manual name capture must start the live preview before the visible countdown'
}
if ($app -match 'case PF_INPUT_PHOTO_NAME_SUBMIT:[\s\S]*pf_ui_show_page\(PF_UI_PAGE_COUNTDOWN\);[\s\S]*pf_camera_prepare_capture_stream\(\);') {
    throw 'Manual name capture countdown must keep the live preview visible'
}
if ($app -notmatch 'case PF_INPUT_PHOTO_NAME_SUBMIT:[\s\S]*pf_ui_show_preview_countdown\(sg_countdown_remaining\);') {
    throw 'Manual name capture must show countdown over the live preview'
}
$manualCountdownBlock = [regex]::Match(
    $app,
    'if \(sg_manual_capture_requested &&[\s\S]*?(?=if \(sg_state\.state == PF_STATE_PEER_FOUND)'
)
if (-not $manualCountdownBlock.Success -or
    $manualCountdownBlock.Value -notmatch 'pf_camera_preview_enable\(false\)' -or
    $manualCountdownBlock.Value -notmatch 'pf_ui_show_preview_status\("CAPTURING"\)' -or
    $manualCountdownBlock.Value.IndexOf('pf_ui_show_preview_status("CAPTURING")') -gt
        $manualCountdownBlock.Value.IndexOf('tal_semaphore_post(sg_capture_request)')) {
    throw 'Manual countdown must leave the 1-second overlay and stop preview work before capture'
}
$captureTask = [regex]::Match(
    $app,
    'static void pf_capture_task\(void \*arg\)[\s\S]*?(?=static void pf_release_photo)'
)
if (-not $captureTask.Success -or
    $captureTask.Value -notmatch 'PF_APP_EVENT_CAPTURE_READY' -or
    $captureTask.Value.IndexOf('PF_APP_EVENT_CAPTURE_READY') -gt
        $captureTask.Value.IndexOf('pf_server_photo_upload')) {
    throw 'Manual JPEG readiness must reach the UI before the blocking photo upload'
}
if ($app -notmatch 'case PF_APP_EVENT_CAPTURE_READY:[\s\S]*pf_ui_show_photo\(PF_CAMERA_WIDTH,\s*PF_CAMERA_HEIGHT,[\s\S]*sg_photo_jpeg[\s\S]*sg_photo_len') {
    throw 'Manual photo must be displayed as soon as JPEG capture finishes'
}
if ($ui -notmatch 'void pf_ui_show_preview_status\(const char \*status\)[\s\S]*lv_label_set_text\(sg_ui\.preview_countdown_label, status\)') {
    throw 'Preview overlay must support a non-countdown capture status'
}
if ($app -notmatch 'sg_manual_capture_requested &&[\s\S]*sg_state\.state == PF_STATE_CAMERA_PREVIEW[\s\S]*tal_semaphore_post\(sg_capture_request\);') {
    throw 'Manual capture must be triggered only after the countdown reaches zero'
}
if ($app -notmatch 'sg_state\.state == PF_STATE_PEER_FOUND[\s\S]*sg_state\.state == PF_STATE_WAITING_CONFIRM[\s\S]*pf_dispatch\(PF_EVENT_RESET\);[\s\S]*return;') {
    throw 'Peer discovery or confirmation timeout must reset to idle instead of showing capture failed'
}

if ($app -notmatch 'pf_ui_set_wifi_status\(true, false\);\s*if \(sg_state\.state != PF_STATE_CAMERA_PREVIEW\) \{\s*pf_ui_wifi_show_connected\(pf_wifi_get_ip\(\)\);\s*\}') {
    throw 'Wi-Fi connect success must not replace an active camera preview page'
}

$passwordClearCount = ([regex]::Matches(
    $app, 'memset\(event\.data\.input\.text, 0, sizeof\(event\.data\.input\.text\)\)'
)).Count
if ($passwordClearCount -lt 2) {
    throw 'App must clear input password copies after posting and handling'
}

$wifiCallbackIndex = $wifi.IndexOf('sg_wifi_cb = cb')
$wifiKvInitIndex = $wifi.IndexOf('tal_kv_init')
$wifiThreadIndex = $wifi.IndexOf('tal_thread_create_and_start')
if ($wifiCallbackIndex -lt 0 -or $wifiThreadIndex -lt 0 -or
    $wifiCallbackIndex -gt $wifiThreadIndex) {
    throw 'Wi-Fi callback must be installed before the worker thread starts'
}
if ($wifiKvInitIndex -lt 0 -or $wifiThreadIndex -lt 0 -or
    $wifiKvInitIndex -gt $wifiThreadIndex) {
    throw 'KV storage must be initialized before the Wi-Fi worker thread starts'
}

foreach ($symbol in @('OPERATE_RET rt', 'board_register_hardware()',
                      'pf_app_start()')) {
    if (-not $entry.Contains($symbol)) {
        throw "Entry point is missing: $symbol"
    }
}

foreach ($forbidden in @('tkl_gpio_', 'tdl_camera_', 'tdl_disp_',
                         'tal_net_', 'lv_canvas_', 'sg_motor_',
                         'sg_camera_', 'sg_display_')) {
    if ($entry.Contains($forbidden)) {
        throw "Entry point still owns module logic: $forbidden"
    }
}

$buildScriptPath = Join-Path $root 'scripts\build-dual-demo.ps1'
if (-not (Test-Path -LiteralPath $buildScriptPath)) {
    throw "Missing dual-demo build script: $buildScriptPath"
}

$buildScript = Get-Content -LiteralPath $buildScriptPath -Raw
$buildRequired = @(
    "param([string]`$TuyaOpenRoot = 'D:\TuyaOpen')"
    "-DeviceId `$deviceId"
    'tos.py clean -f'
    'tos.py build'
    'lvgl_camera_QIO_1.0.0.bin'
    'pocket-friend-demo'
    'device-a.bin'
    'device-b.bin'
    '1048576'
    'Remove-Item -LiteralPath $destination'
)

foreach ($symbol in $buildRequired) {
    if (-not $buildScript.Contains($symbol)) {
        throw "Missing dual build contract: $symbol"
    }
}

foreach ($script in @($sync, $buildScript)) {
    foreach ($forbidden in @('PF_WIFI_SSID', 'PF_WIFI_PASSWORD')) {
        if ($script.Contains($forbidden)) {
            throw "Build scripts must not require Wi-Fi credentials: $forbidden"
        }
    }
}

Write-Host 'PASS: dual-demo source contract.'
