<#
.SYNOPSIS
  Converts stamp-profile JSON files to positional-array OpenSCAD (.gen.scad).
.DESCRIPTION
  Reads one JSON file (via -JsonPath) or discovers all *.json files under
  foot-notes/ and writes a *-profile.gen.scad next to each source.
  The generated file uses the segmented-profile format that stamp-common.scad
  already parses, so no changes to the rendering pipeline are needed.

  Template variables:
    {version}  - replaced with product_version from stamp-config.json
.EXAMPLE
  .\Convert-StampProfile.ps1
  .\Convert-StampProfile.ps1 -JsonPath ..\foot-notes\praise-the-lord\praise-the-lord.json
#>
param(
    [string]$JsonPath = ""
)

$ErrorActionPreference = "Stop"
$ModelDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

# Load stamp-config.json for template variable resolution.
$stampConfigPath = Join-Path $ModelDir "stamp-config.json"
$templateVars = @{}
if (Test-Path -LiteralPath $stampConfigPath) {
    $stampCfg = Get-Content -LiteralPath $stampConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($null -ne $stampCfg.product_version) {
        $templateVars["{version}"] = [string]$stampCfg.product_version
    }
}

function Escape-ScadString([string]$s) {
    if ($null -eq $s) { return "" }
    $s = $s.Replace('\', '\\')
    return $s.Replace('"', '\"')
}

function Resolve-TemplateVars([string]$s) {
    foreach ($key in $templateVars.Keys) {
        $s = $s.Replace($key, $templateVars[$key])
    }
    return $s
}

function Format-Segment($seg) {
    $text = Escape-ScadString (Resolve-TemplateVars $seg.text)
    $size = $seg.size
    $parts = @("""$text""", "$size")

    $hasFont = ($null -ne $seg.font) -and ($seg.font -ne "")
    $hasSc   = ($null -ne $seg.sc) -and ($seg.sc -ne 0)
    $hasSp   = ($null -ne $seg.spacing) -and ($seg.spacing -ne 1)
    $hasUl   = ($null -ne $seg.underline) -and ($seg.underline -eq $true)

    if ($hasFont -or $hasSc -or $hasSp -or $hasUl) {
        $font = if ($hasFont) { $seg.font } else { "" }
        $parts += """$(Escape-ScadString $font)"""
    }
    if ($hasSc -or $hasSp -or $hasUl) {
        $sc = if ($hasSc) { $seg.sc } else { 0 }
        $parts += "$sc"
    }
    if ($hasSp -or $hasUl) {
        $sp = if ($hasSp) { $seg.spacing } else { 1 }
        $parts += "$sp"
    }
    if ($hasUl) {
        $parts += "true"
    }

    return "[" + ($parts -join ", ") + "]"
}

function Convert-OneProfile([string]$jsonFile) {
    $cfg = Get-Content -LiteralPath $jsonFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $jsonName = [IO.Path]::GetFileName($jsonFile)
    $stem = [IO.Path]::GetFileNameWithoutExtension($jsonFile)
    $outPath = Join-Path (Split-Path -Parent $jsonFile) "$stem-profile.gen.scad"

    $sb = New-Object System.Text.StringBuilder
    [void]$sb.AppendLine("// AUTO-GENERATED from $jsonName - do not edit by hand")
    [void]$sb.AppendLine("// Regenerate: scripts/Convert-StampProfile.ps1")
    [void]$sb.AppendLine("")

    # --- info_stamp_profile ---
    [void]$sb.AppendLine("info_stamp_profile = [")
    $rows = @($cfg.rows)
    for ($ri = 0; $ri -lt $rows.Count; $ri++) {
        $row = $rows[$ri]
        $halign = if ($null -ne $row.halign) { $row.halign } else { "center" }
        $valign = if ($null -ne $row.valign) { $row.valign } else { "middle" }
        [void]$sb.Append("    [""$halign"", ""$valign"", [")
        $segs = @($row.segments)
        if ($segs.Count -eq 1) {
            [void]$sb.AppendLine("")
            [void]$sb.AppendLine("        $(Format-Segment $segs[0]),")
            [void]$sb.AppendLine("    ]],")
        } else {
            [void]$sb.AppendLine("")
            for ($si = 0; $si -lt $segs.Count; $si++) {
                [void]$sb.AppendLine("        $(Format-Segment $segs[$si]),")
            }
            [void]$sb.AppendLine("    ]],")
        }
    }
    [void]$sb.AppendLine("];")

    # --- info_stamp_gaps (base line spacing + per-row margins) ---
    # Base gap matches kbc_mark_gap_2_3 in stamp-common.scad; margins are additive.
    $baseGap = 4.375
    $hasAnyMargin = $false
    foreach ($r in $rows) {
        if (($null -ne $r.margin_top -and $r.margin_top -ne 0) -or
            ($null -ne $r.margin_bottom -and $r.margin_bottom -ne 0)) {
            $hasAnyMargin = $true; break
        }
    }
    if ($rows.Count -gt 1 -and $hasAnyMargin) {
        $gaps = @()
        for ($gi = 0; $gi -lt $rows.Count - 1; $gi++) {
            $mb = if ($null -ne $rows[$gi].margin_bottom) { [double]$rows[$gi].margin_bottom } else { 0 }
            $mt = if ($null -ne $rows[$gi + 1].margin_top) { [double]$rows[$gi + 1].margin_top } else { 0 }
            $gaps += ($baseGap + $mb + $mt)
        }
        $gapVals = $gaps -join ", "
        [void]$sb.AppendLine("info_stamp_gaps = [$gapVals];")
    }

    # --- kbc_info_stamp_depth ---
    if ($null -ne $cfg.depth) {
        [void]$sb.AppendLine("kbc_info_stamp_depth = $($cfg.depth);")
    }

    [System.IO.File]::WriteAllText($outPath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))
    Write-Host "Wrote $outPath"
}

# --- Main ---
if (-not [string]::IsNullOrWhiteSpace($JsonPath)) {
    $resolved = (Resolve-Path -LiteralPath $JsonPath).Path
    Convert-OneProfile $resolved
} else {
    $customDir = Join-Path $ModelDir "foot-notes"
    if (-not (Test-Path -LiteralPath $customDir)) {
        Write-Host "No foot-notes/ directory found; nothing to do."
        return
    }
    $jsonFiles = Get-ChildItem -LiteralPath $customDir -Recurse -Filter "*.json" |
        Where-Object { $_.Name -ne "_stamp-profile-template.json" }
    if ($jsonFiles.Count -eq 0) {
        Write-Host "No JSON profile files found under foot-notes/."
        return
    }
    foreach ($f in $jsonFiles) {
        Convert-OneProfile $f.FullName
    }
}
