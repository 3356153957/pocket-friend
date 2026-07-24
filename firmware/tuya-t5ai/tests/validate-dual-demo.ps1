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
    'PF_INPUT_CAPTURE_PHOTO'
    'PF_INPUT_CLOSE_CAMERA'
    'PF_INPUT_RETRY'
    'PF_INPUT_OPEN_WIFI'
    'PF_INPUT_WIFI_SCAN'
    'PF_INPUT_WIFI_SELECT'
    'PF_INPUT_WIFI_CONNECT'
    'PF_INPUT_WIFI_RETRY'
    'PF_INPUT_EVENT_T'
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

$uiHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_ui.h'
$uiSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_ui.c'

foreach ($path in @($uiHeaderPath, $uiSourcePath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing UI source file: $path"
    }
}

$ui = @(
    Get-Content -LiteralPath $uiHeaderPath -Raw
    Get-Content -LiteralPath $uiSourcePath -Raw
) -join "`n"

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
    'LV_SYMBOL_IMAGE, PF_INPUT_CAPTURE_PHOTO'
    'lv_textarea_set_password_mode'
    'lv_textarea_set_max_length'
    'lv_keyboard_create'
    'lv_keyboard_set_textarea'
    'lv_ime_pinyin_create'
    'lv_ime_pinyin_set_keyboard'
    'lv_ime_pinyin_get_cand_panel'
    'lv_font_simsun_16_cjk'
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

if ($ui -notmatch '#define\s+PF_UI_TOUCH_TARGET\s+64') {
    throw 'UI touch target must be at least the planned 64 pixels'
}

if ($ui -match 'lv_ime_pinyin_set_keyboard\([^,]+,\s*sg_ui\.wifi_keyboard\)') {
    throw 'Pinyin IME must not attach to the Wi-Fi password keyboard'
}

if ($ui -notmatch 'lv_obj_set_parent\(\s*cand_panel,\s*sg_ui\.pages\[PF_UI_PAGE_PINYIN_INPUT\]\s*\)') {
    throw 'Pinyin candidate panel must be reparented to the pinyin page'
}

if ($ui -notmatch 'lv_obj_set_style_text_color\(\s*cand_panel,\s*lv_color_hex\(PF_UI_COLOR_TEXT\),\s*0\s*\)') {
    throw 'Pinyin candidate panel must use visible text on the dark page'
}

if ($ui -notmatch 'lv_obj_set_style_bg_opa\(\s*cand_panel,\s*LV_OPA_COVER,\s*0\s*\)') {
    throw 'Pinyin candidate panel must have an opaque background'
}

$configPath = Join-Path $root 'config\TUYA_T5AI_BOARD_LCD_3.5.config'
if (-not (Test-Path -LiteralPath $configPath)) {
    throw "Missing T5AI LCD config: $configPath"
}
$lcdConfig = Get-Content -LiteralPath $configPath -Raw
foreach ($symbol in @(
    'CONFIG_LV_USE_IME_PINYIN=y'
    'CONFIG_LV_IME_PINYIN_USE_DEFAULT_DICT=y'
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
)) {
    if (-not $serverHeartbeat.Contains($symbol)) {
        throw "Missing server heartbeat contract: $symbol"
    }
}

$appHeaderPath = Join-Path $root 'overlays\lvgl_camera\include\pf_app.h'
$appSourcePath = Join-Path $root 'overlays\lvgl_camera\src\pf_app.c'
$entryPath = Join-Path $root 'overlays\lvgl_camera\src\example_lvgl_camera.c'

foreach ($path in @($appHeaderPath, $appSourcePath, $entryPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing integrated app source file: $path"
    }
}

$app = @(
    Get-Content -LiteralPath $appHeaderPath -Raw
    Get-Content -LiteralPath $appSourcePath -Raw
) -join "`n"
$entry = Get-Content -LiteralPath $entryPath -Raw

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
    'PF_INPUT_CAPTURE_PHOTO'
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

if (-not $app.Contains('sg_wifi_selected >= sg_wifi_ap_count')) {
    throw 'Wi-Fi connect and retry must reject a stale AP selection'
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
