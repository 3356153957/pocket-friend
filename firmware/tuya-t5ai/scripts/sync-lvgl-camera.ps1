param(
    [string]$TuyaOpenRoot = 'D:\TuyaOpen',
    [Parameter(Mandatory)]
    [ValidateSet('A', 'B')]
    [string]$DeviceId,
    [string]$AdminHost = $env:PF_ADMIN_HOST,
    [int]$AdminPort = $(if ($env:PF_ADMIN_PORT) { [int]$env:PF_ADMIN_PORT } else { 4311 }),
    [string]$HeartbeatToken = $env:PF_DEVICE_HEARTBEAT_TOKEN,
    [string]$DefaultWifiSsid = $env:PF_DEFAULT_WIFI_SSID,
    [string]$DefaultWifiPassword = $env:PF_DEFAULT_WIFI_PASSWORD
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

$peerId = if ($DeviceId -eq 'A') { 'B' } else { 'A' }
$cameraRotation180 = if ($DeviceId -eq 'A') { 1 } else { 0 }

function ConvertTo-CStringLiteral {
    param([Parameter(Mandatory)][string]$Value)

    return $Value.Replace('\', '\\').Replace('"', '\"')
}

$hasDefaultWifiSsid = -not [string]::IsNullOrEmpty($DefaultWifiSsid)
$hasDefaultWifiPassword = -not [string]::IsNullOrEmpty($DefaultWifiPassword)
if ($hasDefaultWifiSsid -ne $hasDefaultWifiPassword) {
    throw 'PF_DEFAULT_WIFI_SSID and PF_DEFAULT_WIFI_PASSWORD must be set together.'
}
$defaultWifiEnabled = $hasDefaultWifiSsid -and $hasDefaultWifiPassword
if ($defaultWifiEnabled) {
    if ($DefaultWifiSsid -notmatch '^[\x20-\x7E]{1,32}$') {
        throw 'PF_DEFAULT_WIFI_SSID must contain 1-32 printable ASCII characters.'
    }
    if ($DefaultWifiPassword -notmatch '^[\x20-\x7E]{8,63}$') {
        throw 'PF_DEFAULT_WIFI_PASSWORD must contain 8-63 printable ASCII characters.'
    }
    $defaultWifiSsidLiteral = ConvertTo-CStringLiteral $DefaultWifiSsid
    $defaultWifiPasswordLiteral = ConvertTo-CStringLiteral $DefaultWifiPassword
} else {
    $defaultWifiSsidLiteral = ''
    $defaultWifiPasswordLiteral = ''
}
$defaultWifiFlag = if ($defaultWifiEnabled) { 1 } else { 0 }

$serverHeartbeatEnabled = -not [string]::IsNullOrWhiteSpace($AdminHost) -and
                          -not [string]::IsNullOrWhiteSpace($HeartbeatToken)
if ($serverHeartbeatEnabled) {
    if ($AdminHost -notmatch '^[A-Za-z0-9.-]+$') {
        throw 'PF_ADMIN_HOST must be a hostname or IPv4 address without a scheme or path.'
    }
    if ($AdminPort -lt 1 -or $AdminPort -gt 65535) {
        throw 'PF_ADMIN_PORT must be between 1 and 65535.'
    }
    if ($HeartbeatToken -notmatch '^[A-Za-z0-9_-]{16,128}$') {
        throw 'PF_DEVICE_HEARTBEAT_TOKEN must contain 16-128 URL-safe characters.'
    }
} else {
    $AdminHost = '127.0.0.1'
    $HeartbeatToken = ''
    Write-Warning 'Server heartbeat disabled: set PF_ADMIN_HOST and PF_DEVICE_HEARTBEAT_TOKEN before building.'
}
$serverHeartbeatFlag = if ($serverHeartbeatEnabled) { 1 } else { 0 }

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
#define PF_CAMERA_ROTATION_180 $cameraRotation180
#define PF_DEFAULT_WIFI_ENABLED $defaultWifiFlag
#define PF_DEFAULT_WIFI_SSID "$defaultWifiSsidLiteral"
#define PF_DEFAULT_WIFI_PASSWORD "$defaultWifiPasswordLiteral"
#define PF_SERVER_HEARTBEAT_ENABLED $serverHeartbeatFlag
#define PF_ADMIN_HOST "$AdminHost"
#define PF_ADMIN_PORT ${AdminPort}U
#define PF_DEVICE_HEARTBEAT_TOKEN "$HeartbeatToken"

#endif
"@

Set-Content -LiteralPath $runtimeConfig -Value $runtimeHeader -Encoding ascii

Write-Host "PASS: lvgl_camera dual-demo overlay synced for device $DeviceId (default Wi-Fi: $defaultWifiEnabled; server heartbeat: $serverHeartbeatEnabled)."
