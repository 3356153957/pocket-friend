param(
    [string]$TuyaOpenRoot = 'D:\TuyaOpen'
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$overlaySource = Join-Path $projectRoot 'firmware\tuya-t5ai\overlays\lvgl_camera\src\example_lvgl_camera.c'
$boardConfig = Join-Path $projectRoot 'firmware\tuya-t5ai\config\TUYA_T5AI_BOARD_LCD_3.5.config'
$exampleRoot = Join-Path $TuyaOpenRoot 'examples\graphics\lvgl_camera'
$targetSource = Join-Path $exampleRoot 'src\example_lvgl_camera.c'
$targetConfig = Join-Path $exampleRoot 'config\TUYA_T5AI_BOARD_LCD_3.5.config'
$targetDefaultConfig = Join-Path $exampleRoot 'app_default.config'

foreach ($path in @($overlaySource, $boardConfig, $exampleRoot)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required path does not exist: $path"
    }
}

Copy-Item -LiteralPath $overlaySource -Destination $targetSource -Force
Copy-Item -LiteralPath $boardConfig -Destination $targetConfig -Force
Copy-Item -LiteralPath $boardConfig -Destination $targetDefaultConfig -Force

Write-Host 'PASS: lvgl_camera motor overlay synced.'
