param(
    [string]$ProjectRoot = '',
    [switch]$SeedPriorityFromUi,
    [switch]$SkipFont
)

$ErrorActionPreference = 'Stop'

if (-not $ProjectRoot) {
    $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
}

$firmwareRoot = Join-Path $ProjectRoot 'firmware\tuya-t5ai'
$uiSourcePath = Join-Path $firmwareRoot 'overlays\lvgl_camera\src\pf_ui.c'
$priorityPath = Join-Path $firmwareRoot 'resources\pinyin\name-priority.json'
$dictHeaderPath = Join-Path $firmwareRoot 'overlays\lvgl_camera\include\pf_pinyin_dict.h'
$dictSourcePath = Join-Path $firmwareRoot 'overlays\lvgl_camera\src\pf_pinyin_dict.c'
$fontOutputPath = Join-Path $firmwareRoot 'overlays\lvgl_camera\src\pf_font_names_16.c'
$fontPath = 'C:\Windows\Fonts\simhei.ttf'

$upstreamCommit = '423bac9e5d40365b594b84a0d660a2c22466932a'
$upstreamUrl = "https://raw.githubusercontent.com/100askTeam/lv_lib_100ask/$upstreamCommit/src/lv_100ask_pinyin_ime/lv_100ask_pinyin_ime.c"

$commonSurnameCodepoints = @(
    0x8D75, 0x94B1, 0x5B59, 0x674E, 0x5468, 0x5434, 0x90D1, 0x738B,
    0x51AF, 0x9648, 0x891A, 0x536B, 0x848B, 0x6C88, 0x97E9, 0x6768,
    0x6731, 0x79E6, 0x5C24, 0x8BB8, 0x4F55, 0x5415, 0x65BD, 0x5F20,
    0x5B54, 0x66F9, 0x4E25, 0x534E, 0x91D1, 0x9B4F, 0x9676, 0x59DC,
    0x621A, 0x8C22, 0x90B9, 0x55BB, 0x67CF, 0x6C34, 0x7AA6, 0x7AE0,
    0x4E91, 0x82CF, 0x6F58, 0x845B, 0x595A, 0x8303, 0x5F6D, 0x90CE,
    0x9C81, 0x97E6, 0x660C, 0x9A6C, 0x82D7, 0x51E4, 0x82B1, 0x65B9,
    0x4FDE, 0x4EFB, 0x8881, 0x67F3, 0x9146, 0x9C8D, 0x53F2, 0x5510,
    0x8D39, 0x5EC9, 0x5C91, 0x859B, 0x96F7, 0x8D3A, 0x502A, 0x6C64,
    0x6ED5, 0x6BB7, 0x7F57, 0x6BD5, 0x90DD, 0x90AC, 0x5B89, 0x5E38,
    0x4E50, 0x4E8E, 0x65F6, 0x5085, 0x76AE, 0x535E, 0x9F50, 0x5EB7,
    0x4F0D, 0x4F59, 0x5143, 0x535C, 0x987E, 0x5B5F, 0x5E73, 0x9EC4,
    0x548C, 0x7A46, 0x8427, 0x5C39
)
$commonSurnames = -join ($commonSurnameCodepoints | ForEach-Object { [char]$_ })
$surnameFallbacks = [ordered]@{
    chu = [string][char]0x891A
    xi = [string][char]0x595A
    feng = [string][char]0x9146
    wu = [string][char]0x90AC
}

function Get-PinyinEntries([string]$Source) {
    $matches = [regex]::Matches(
        $Source,
        '\{\s*"([a-z]+)"\s*,\s*"([^"]*)"\s*\}'
    )
    return @($matches | ForEach-Object {
        [pscustomobject]@{
            Pinyin = $_.Groups[1].Value
            Candidates = $_.Groups[2].Value
        }
    })
}

function Merge-UniqueCharacters([string[]]$Values) {
    $seen = @{}
    $result = New-Object System.Collections.Generic.List[char]
    foreach ($value in $Values) {
        foreach ($character in $value.ToCharArray()) {
            $key = [int][char]$character
            if (-not $seen.ContainsKey($key)) {
                $seen[$key] = $true
                $result.Add($character)
            }
        }
    }
    return -join $result
}

function Convert-EntriesToMap($Entries) {
    $result = [ordered]@{}
    foreach ($entry in $Entries) {
        $result[$entry.Pinyin] = $entry.Candidates
    }
    return $result
}

if ($SeedPriorityFromUi) {
    $uiSource = Get-Content -LiteralPath $uiSourcePath -Raw -Encoding utf8
    $dictBlock = [regex]::Match(
        $uiSource,
        'static\s+lv_pinyin_dict_t\s+sg_pinyin_name_dict\[\]\s*=\s*\{(?<body>[\s\S]*?)\n\};'
    )
    if (-not $dictBlock.Success) {
        throw 'Could not find the legacy sg_pinyin_name_dict in pf_ui.c'
    }

    $priorityEntries = Get-PinyinEntries $dictBlock.Groups['body'].Value
    if ($priorityEntries.Count -lt 300) {
        throw "Legacy name dictionary is unexpectedly small: $($priorityEntries.Count)"
    }

    $priorityDocument = [ordered]@{
        schemaVersion = 1
        upstreamCommit = $upstreamCommit
        commonSurnames = $commonSurnames
        syllables = Convert-EntriesToMap $priorityEntries
    }
    $priorityDirectory = Split-Path -Parent $priorityPath
    New-Item -ItemType Directory -Path $priorityDirectory -Force | Out-Null
    $priorityDocument | ConvertTo-Json -Depth 5 |
        Set-Content -LiteralPath $priorityPath -Encoding utf8
}

if (-not (Test-Path -LiteralPath $priorityPath)) {
    throw "Missing name priority data: $priorityPath"
}

$priorityDocument = Get-Content -LiteralPath $priorityPath -Raw -Encoding utf8 |
    ConvertFrom-Json
if ($priorityDocument.upstreamCommit -ne $upstreamCommit) {
    throw 'Name priority data and generator use different upstream commits'
}
if ($priorityDocument.commonSurnames -ne $commonSurnames) {
    throw 'Name priority data contains an unexpected common-surname set'
}

$upstreamSource = (Invoke-WebRequest -UseBasicParsing -Uri $upstreamUrl).Content
$upstreamEntries = Get-PinyinEntries $upstreamSource
if ($upstreamEntries.Count -ne 402) {
    throw "Expected 402 entries from 100ask, received $($upstreamEntries.Count)"
}

$upstreamMap = Convert-EntriesToMap $upstreamEntries
$priorityMap = [ordered]@{}
foreach ($property in $priorityDocument.syllables.psobject.Properties) {
    $priorityMap[$property.Name] = [string]$property.Value
}

$surnamePriorityMap = @{}
foreach ($pinyin in @($upstreamMap.Keys + $priorityMap.Keys | Sort-Object -Unique)) {
    $surnamePriorityMap[$pinyin] = ''
}

foreach ($surname in $commonSurnames.ToCharArray()) {
    $mapped = $false
    foreach ($pinyin in @($surnamePriorityMap.Keys | Sort-Object)) {
        $candidateSources = @(
            if ($priorityMap.Contains($pinyin)) { $priorityMap[$pinyin] }
            if ($upstreamMap.Contains($pinyin)) { $upstreamMap[$pinyin] }
        ) -join ''
        if ($candidateSources.Contains([string]$surname)) {
            $surnamePriorityMap[$pinyin] += $surname
            $mapped = $true
        }
    }
    if (-not $mapped) {
        $fallback = $surnameFallbacks.GetEnumerator() |
            Where-Object { $_.Value -eq [string]$surname } |
            Select-Object -First 1
        if (-not $fallback) {
            throw "No pinyin reading found for common surname U+$('{0:X4}' -f [int][char]$surname)"
        }
        if (-not $surnamePriorityMap.ContainsKey($fallback.Key)) {
            $surnamePriorityMap[$fallback.Key] = ''
        }
        $surnamePriorityMap[$fallback.Key] += $surname
    }
}

$allPinyin = @($upstreamMap.Keys + $priorityMap.Keys + $surnamePriorityMap.Keys |
    Sort-Object -Unique)
$mergedMap = [ordered]@{}
foreach ($pinyin in $allPinyin) {
    $mergedMap[$pinyin] = Merge-UniqueCharacters @(
        [string]$surnamePriorityMap[$pinyin]
        $(if ($priorityMap.Contains($pinyin)) { [string]$priorityMap[$pinyin] } else { '' })
        $(if ($upstreamMap.Contains($pinyin)) { [string]$upstreamMap[$pinyin] } else { '' })
    )
}

$header = @'
#ifndef PF_PINYIN_DICT_H
#define PF_PINYIN_DICT_H

#include "lvgl.h"

extern lv_pinyin_dict_t pf_pinyin_name_dict[];

#endif
'@
Set-Content -LiteralPath $dictHeaderPath -Value $header -Encoding utf8

$sourceLines = New-Object System.Collections.Generic.List[string]
$sourceLines.Add('#include "pf_pinyin_dict.h"')
$sourceLines.Add('')
$sourceLines.Add('/* Generated by generate-pinyin-name-dict.ps1.')
$sourceLines.Add(" * Base dictionary: $upstreamUrl")
$sourceLines.Add(' * Common surnames and name characters are placed before general candidates.')
$sourceLines.Add(' */')
$sourceLines.Add('lv_pinyin_dict_t pf_pinyin_name_dict[] = {')
foreach ($pinyin in $mergedMap.Keys) {
    $sourceLines.Add(('    {{"{0}", "{1}"}},' -f $pinyin, $mergedMap[$pinyin]))
}
$sourceLines.Add('    {NULL, NULL},')
$sourceLines.Add('};')
Set-Content -LiteralPath $dictSourcePath -Value $sourceLines -Encoding utf8

$glyphs = Merge-UniqueCharacters @($mergedMap.Values)
if (-not $SkipFont) {
    if (-not (Test-Path -LiteralPath $fontPath)) {
        throw "Missing font source: $fontPath"
    }
    $fontArgs = @(
        '--yes'
        'lv_font_conv@1.5.3'
        '--size', '16'
        '--bpp', '2'
        '--format', 'lvgl'
        '--font', $fontPath
        '--range', '0x20-0x7F'
        '--symbols', $glyphs
        '--no-compress'
        '--no-prefilter'
        '--lv-font-name', 'pf_font_names_16'
        '-o', $fontOutputPath
    )
    & npx.cmd @fontArgs
    if ($LASTEXITCODE -ne 0) {
        throw "lv_font_conv failed with exit code $LASTEXITCODE"
    }
}

Write-Host ("PASS: generated {0} pinyin entries and {1} glyphs." -f
    $mergedMap.Count, $glyphs.Length)
