$ErrorActionPreference = 'Stop'

$sourcePath = Join-Path $PSScriptRoot '..\overlays\lvgl_camera\src\example_lvgl_camera.c'

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing button motor overlay source: $sourcePath"
}

$source = Get-Content -LiteralPath $sourcePath -Raw
$required = @(
    '#define EXAMPLE_MOTOR_IN1_PIN TUYA_GPIO_NUM_6'
    '#define EXAMPLE_MOTOR_IN2_PIN TUYA_GPIO_NUM_7'
    'static bool sg_motor_running = false;'
    'static bool sg_motor_ready'
    '__example_motor_init'
    '__example_motor_start'
    '__example_motor_stop'
    '[motor] started'
    '[motor] stopped'
    'sg_is_display_camera = true;'
)

foreach ($item in $required) {
    if (-not $source.Contains($item)) {
        throw "Button motor overlay source is missing: $item"
    }
}

if ($source -notmatch 'static OPERATE_RET __example_motor_init\(void\)\s*\{\s*OPERATE_RET rt = OPRT_OK;') {
    throw 'Motor init must declare rt for TUYA_CALL_ERR_RETURN'
}

if ($source.Contains('disp_enable_update(NULL);')) {
    throw 'Button callback still contains the old camera toggle'
}

if ($source.Contains('TUYA_CALL_ERR_LOG(__example_lvgl_init());')) {
    throw 'Hello World LVGL task must not start in camera-only motor test firmware'
}

if ($source.Contains('disp_disable_update(NULL);')) {
    throw 'Camera-only firmware must not toggle an uninitialized LVGL display'
}

if ($source.Contains('Hello World') -or $source.Contains('sg_lvgl_thrd')) {
    throw 'Camera-only firmware must not retain the competing Hello World task'
}

Write-Host 'PASS: button toggles motor and camera preview starts automatically.'
