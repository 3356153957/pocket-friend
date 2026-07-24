param([string]$TuyaOpenRoot = 'D:\TuyaOpen')

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$syncPath = Join-Path $PSScriptRoot 'sync-lvgl-camera.ps1'
$exampleRoot = Join-Path $TuyaOpenRoot 'examples\graphics\lvgl_camera'
$tosPath = Join-Path $TuyaOpenRoot 'tos.py'
$python = Join-Path $TuyaOpenRoot '.venv\Scripts\python.exe'
$venvScripts = Join-Path $TuyaOpenRoot '.venv\Scripts'
$makeBin = Join-Path $TuyaOpenRoot '.tools\make\4.4.1'
$sourceImage = Join-Path $exampleRoot 'dist\lvgl_camera_1.0.0\lvgl_camera_QIO_1.0.0.bin'
$artifactRoot = Join-Path $TuyaOpenRoot 'artifacts\pocket-friend-demo'

foreach ($path in @($projectRoot, $syncPath, $exampleRoot, $tosPath,
                     $python, (Join-Path $makeBin 'make.exe'))) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Required build path does not exist: $path"
    }
}

$env:OPEN_SDK_ROOT = $TuyaOpenRoot
$env:OPEN_SDK_PYTHON = $python
$env:OPEN_SDK_MAKE_BIN = $makeBin
$env:OPEN_SDK_MAKE = Join-Path $makeBin 'make.exe'
$env:VIRTUAL_ENV = Join-Path $TuyaOpenRoot '.venv'
$env:PATH = "$venvScripts;$makeBin;$TuyaOpenRoot;$env:PATH"

function tos.py {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$TosArgs)

    & $python $tosPath @TosArgs
    if ($LASTEXITCODE -ne 0) {
        throw "tos.py $($TosArgs -join ' ') failed with exit code $LASTEXITCODE"
    }
}

$targets = @(
    [pscustomobject]@{ DeviceId = 'A'; FileName = 'device-a.bin' }
    [pscustomobject]@{ DeviceId = 'B'; FileName = 'device-b.bin' }
)

New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null
foreach ($target in $targets) {
    $destination = Join-Path $artifactRoot $target.FileName
    if (Test-Path -LiteralPath $destination) {
        Remove-Item -LiteralPath $destination -Force
    }
}

Push-Location $exampleRoot
try {
    foreach ($target in $targets) {
        $deviceId = $target.DeviceId
        $destination = Join-Path $artifactRoot $target.FileName

        & $syncPath -TuyaOpenRoot $TuyaOpenRoot -DeviceId $deviceId
        tos.py clean -f
        tos.py build

        if (-not (Test-Path -LiteralPath $sourceImage)) {
            throw "Build did not produce QIO image for device ${deviceId}: $sourceImage"
        }
        $image = Get-Item -LiteralPath $sourceImage
        if ($image.Length -le 1048576) {
            throw "QIO image for device ${deviceId} is unexpectedly small: $($image.Length) bytes"
        }

        Copy-Item -LiteralPath $sourceImage -Destination $destination -Force
        Write-Host "PASS: device $deviceId image -> $destination ($($image.Length) bytes)"
    }
} finally {
    Pop-Location
}
