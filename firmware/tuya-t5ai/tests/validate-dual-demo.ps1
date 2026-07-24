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

Write-Host 'PASS: dual-demo source contract.'
