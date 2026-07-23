$ErrorActionPreference = 'Stop'

$configPath = Join-Path $PSScriptRoot '..\config\TUYA_T5AI_BOARD_LCD_3.5.config'

if (-not (Test-Path -LiteralPath $configPath)) {
    throw "缺少 T5AI 摄像头预览配置：$configPath"
}

$configLines = Get-Content -LiteralPath $configPath
$requiredLines = @(
    'CONFIG_BOARD_CHOICE_T5AI=y'
    'CONFIG_BOARD_CHOICE_TUYA_T5AI_BOARD=y'
    'CONFIG_TUYA_T5AI_BOARD_LCD_35565=y'
    'CONFIG_TUYA_T5AI_BOARD_CAMERA=y'
    'CONFIG_ENABLE_LIBLVGL=y'
)

foreach ($line in $requiredLines) {
    if ($configLines -notcontains $line) {
        throw "配置缺少必要选项：$line"
    }
}

$unexpectedBoards = $configLines | Where-Object {
    $_ -match '^CONFIG_BOARD_CHOICE_.+=y$' -and
    $_ -notin @(
        'CONFIG_BOARD_CHOICE_T5AI=y'
        'CONFIG_BOARD_CHOICE_TUYA_T5AI_BOARD=y'
    )
}

if ($unexpectedBoards) {
    throw "配置包含冲突的开发板选项：$($unexpectedBoards -join ', ')"
}

Write-Host 'PASS: T5AI V102 + 35565 LCD + GC2145 camera config is explicit.'
