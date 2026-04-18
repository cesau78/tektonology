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
    $hasUlS  = ($null -ne $seg.underline_scale) -and ($seg.underline_scale -ne 1)
    $hasUlO  = ($null -ne $seg.underline_x_offset) -and ($seg.underline_x_offset -ne 0)
    $hasUlYO = ($null -ne $seg.underline_y_offset) -and ($seg.underline_y_offset -ne 0)
    $anyUlExt = $hasUlS -or $hasUlO -or $hasUlYO

    if ($hasFont -or $hasSc -or $hasSp -or $hasUl -or $anyUlExt) {
        $font = if ($hasFont) { $seg.font } else { "" }
        $parts += """$(Escape-ScadString $font)"""
    }
    if ($hasSc -or $hasSp -or $hasUl -or $anyUlExt) {
        $sc = if ($hasSc) { $seg.sc } else { 0 }
        $parts += "$sc"
    }
    if ($hasSp -or $hasUl -or $anyUlExt) {
        $sp = if ($hasSp) { $seg.spacing } else { 1 }
        $parts += "$sp"
    }
    if ($hasUl -or $anyUlExt) {
        $parts += "true"
    }
    if ($anyUlExt) {
        $uls = if ($hasUlS) { $seg.underline_scale } else { 1 }
        $parts += "$uls"
    }
    if ($hasUlO -or $hasUlYO) {
        $ulo = if ($hasUlO) { $seg.underline_x_offset } else { 0 }
        $parts += "$ulo"
    }
    if ($hasUlYO) {
        $parts += "$($seg.underline_y_offset)"
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
        $hasXO = ($null -ne $row.x_offset) -and ($row.x_offset -ne 0)
        $hasYO = ($null -ne $row.y_offset) -and ($row.y_offset -ne 0)
        [void]$sb.Append("    [""$halign"", ""$valign"", [")
        $segs = @($row.segments)
        foreach ($seg in $segs) {
            $scVal = if ($null -ne $seg.sc) { [double]$seg.sc } else { 0 }
            $szVal = [double]$seg.size
            if ($scVal -gt 0 -and $scVal -lt 3.5 -and $seg.text.Trim() -ne "") {
                Write-Host ("  WARNING: '{0}' sc={1} (row {2}) -- sc under 3.5 may not print cleanly with TPU inlays" -f $seg.text, $scVal, $ri) -ForegroundColor Yellow
            }
            if ($szVal -gt 0 -and $szVal -lt 3.5 -and $scVal -eq 0 -and $seg.text.Trim() -ne "") {
                Write-Host ("  WARNING: '{0}' size={1} (row {2}) -- size under 3.5 may not print cleanly with TPU inlays" -f $seg.text, $szVal, $ri) -ForegroundColor Yellow
            }
        }
        if ($segs.Count -eq 1) {
            [void]$sb.AppendLine("")
            [void]$sb.AppendLine("        $(Format-Segment $segs[0]),")
        } else {
            [void]$sb.AppendLine("")
            for ($si = 0; $si -lt $segs.Count; $si++) {
                [void]$sb.AppendLine("        $(Format-Segment $segs[$si]),")
            }
        }
        $rowTrail = "]"
        if ($hasXO -or $hasYO) {
            $xo = if ($hasXO) { $row.x_offset } else { 0 }
            $rowTrail += ", $xo"
        }
        if ($hasYO) {
            $rowTrail += ", $($row.y_offset)"
        }
        [void]$sb.AppendLine("    $rowTrail],")
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
