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
    'PF_WIFI_SSID'
    'PF_WIFI_PASSWORD'
    'pf_demo_runtime_config.h'
    "Join-Path `$overlayRoot 'src'"
    "Join-Path `$overlayRoot 'include'"
    'Copy-Item'
    '-Recurse'
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
    'PF_INPUT_CLOSE_CAMERA'
    'PF_INPUT_RETRY'
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
    'PF_UI_TOUCH_TARGET'
    'lv_canvas_set_buffer'
    'tal_image_convert_yuv422_to_rgb565'
    'tal_image_jpeg_decode_rgb565'
    'pf_input_post_from_ui'
    'pf_ui_camera_frame_cb'
    'pf_camera_set_frame_cb(pf_ui_camera_frame_cb)'
)

foreach ($symbol in $uiRequired) {
    if (-not $ui.Contains($symbol)) {
        throw "Missing UI contract: $symbol"
    }
}

if ($ui -notmatch '#define\s+PF_UI_TOUCH_TARGET\s+64') {
    throw 'UI touch target must be at least the planned 64 pixels'
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
    'tal_wifi_init'
    'tal_wifi_set_work_mode'
    'tal_wifi_station_connect'
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
    'PF_WIFI_SSID'
    'PF_WIFI_PASSWORD'
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

Write-Host 'PASS: dual-demo source contract.'
