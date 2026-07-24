param(
    [string]$TuyaOpenRoot = 'D:\TuyaOpen',
    [Parameter(Mandatory)]
    [ValidateSet('A', 'B')]
    [string]$DeviceId
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$overlayRoot = Join-Path $projectRoot 'firmware\tuya-t5ai\overlays\lvgl_camera'
$overlaySource = Join-Path $overlayRoot 'src'
$overlayInclude = Join-Path $overlayRoot 'include'
$boardConfig = Join-Path $projectRoot 'firmware\tuya-t5ai\config\TUYA_T5AI_BOARD_LCD_3.5.config'
$exampleRoot = Join-Path $TuyaOpenRoot 'examples\graphics\lvgl_camera'
$targetSource = Join-Path $exampleRoot 'src'
$targetInclude = Join-Path $exampleRoot 'include'
$targetConfig = Join-Path $exampleRoot 'config\TUYA_T5AI_BOARD_LCD_3.5.config'
$targetDefaultConfig = Join-Path $exampleRoot 'app_default.config'
$runtimeConfig = Join-Path $targetInclude 'pf_demo_runtime_config.h'

foreach ($path in @($overlaySource, $overlayInclude, $boardConfig, $exampleRoot)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required path does not exist: $path"
    }
}

if ([string]::IsNullOrWhiteSpace($env:PF_WIFI_SSID)) {
    throw 'PF_WIFI_SSID must be set before syncing the dual-device demo'
}

if ([string]::IsNullOrWhiteSpace($env:PF_WIFI_PASSWORD)) {
    throw 'PF_WIFI_PASSWORD must be set before syncing the dual-device demo'
}

function ConvertTo-CStringLiteral {
    param([Parameter(Mandatory)][string]$Value)

    return $Value.Replace('\', '\\').Replace('"', '\"').Replace("`r", '\r').Replace("`n", '\n')
}

$peerId = if ($DeviceId -eq 'A') { 'B' } else { 'A' }
$wifiSsid = ConvertTo-CStringLiteral $env:PF_WIFI_SSID
$wifiPassword = ConvertTo-CStringLiteral $env:PF_WIFI_PASSWORD

New-Item -ItemType Directory -Path $targetSource, $targetInclude -Force | Out-Null
Copy-Item -Path (Join-Path $overlaySource '*') -Destination $targetSource -Recurse -Force
Copy-Item -Path (Join-Path $overlayInclude '*') -Destination $targetInclude -Recurse -Force
Copy-Item -LiteralPath $boardConfig -Destination $targetConfig -Force
Copy-Item -LiteralPath $boardConfig -Destination $targetDefaultConfig -Force

$runtimeHeader = @"
#ifndef PF_DEMO_RUNTIME_CONFIG_H
#define PF_DEMO_RUNTIME_CONFIG_H

#define PF_DEVICE_ID '$DeviceId'
#define PF_PEER_ID '$peerId'
#define PF_WIFI_SSID "$wifiSsid"
#define PF_WIFI_PASSWORD "$wifiPassword"

#endif
"@

Set-Content -LiteralPath $runtimeConfig -Value $runtimeHeader -Encoding ascii

Write-Host "PASS: lvgl_camera dual-demo overlay synced for device $DeviceId."
