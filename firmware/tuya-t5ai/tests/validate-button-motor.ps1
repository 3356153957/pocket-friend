$ErrorActionPreference = 'Stop'

$firmwareRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$motorPath = Join-Path $firmwareRoot 'overlays\lvgl_camera\src\pf_motor.c'
$inputPath = Join-Path $firmwareRoot 'overlays\lvgl_camera\src\pf_input.c'

foreach ($path in @($motorPath, $inputPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing motor/input module: $path"
    }
}

$motor = Get-Content -LiteralPath $motorPath -Raw
$motorRequired = @(
    'TUYA_GPIO_NUM_6'
    'TUYA_GPIO_NUM_7'
    'TUYA_GPIO_PUSH_PULL'
    'TUYA_GPIO_LEVEL_LOW'
    'PF_MOTOR_PATTERN_PEER_FOUND'
    'PF_MOTOR_PATTERN_LOCAL_CONFIRMED'
    'PF_MOTOR_PATTERN_WAITING'
    'PF_MOTOR_PATTERN_BOTH_CONFIRMED'
    'PF_MOTOR_PATTERN_SUCCESS'
    'PF_MOTOR_PATTERN_ERROR'
    'tal_queue_create_init'
    'tal_thread_create_and_start'
    'pf_motor_stop'
)

foreach ($item in $motorRequired) {
    if (-not $motor.Contains($item)) {
        throw "Motor module is missing: $item"
    }
}

$peerFoundPattern = [regex]::Match(
    $motor,
    'case PF_MOTOR_PATTERN_PEER_FOUND:[\s\S]*?break;'
)
if (-not $peerFoundPattern.Success -or
    ([regex]::Matches($peerFoundPattern.Value,
        'pf_motor_pulse\(120U,\s*(?:180U|0U),\s*generation\);')).Count -ne 3 -or
    $peerFoundPattern.Value -match '\bwhile\s*\(') {
    throw 'Peer-found feedback must be three finite, spaced vibration pulses'
}

$input = Get-Content -LiteralPath $inputPath -Raw
$inputRequired = @(
    'TDL_BUTTON_PRESS_SINGLE_CLICK'
    'TDL_BUTTON_LONG_PRESS_START'
    'long_start_valid_time = 1500'
    'button_debounce_time = 50'
    'PF_INPUT_MODE_LOCKED'
    'PF_INPUT_TOGGLE_DND'
    'pf_input_post_from_ui'
    'pf_input_set_mode'
)

foreach ($item in $inputRequired) {
    if (-not $input.Contains($item)) {
        throw "Input module is missing: $item"
    }
}

if ($input -match '\b(?:pf_motor|pf_camera)_') {
    throw 'Input callback must not control the motor or camera directly'
}

Write-Host 'PASS: safe motor patterns and unified button input are modular.'
