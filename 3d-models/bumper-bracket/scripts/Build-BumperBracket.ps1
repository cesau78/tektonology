<#
.SYNOPSIS
    Exports bumper-bracket STL files for a given version label.

.DESCRIPTION
    Renders bumper-bracket-left.stl, bumper-bracket-right.stl, and cap.stl
    via OpenSCAD and writes them to:
        <repo>/3d-models/bumper-bracket/latest-build/v<Version>/

    If -GitRef is provided the named commit/tag/branch is checked out into a
    temporary git worktree, built from there, then the worktree is cleaned up.
    Without -GitRef the current working-tree files are used.

.PARAMETER BuildVersion
    Version label written into the output directory name, e.g. "1.1".

.PARAMETER GitRef
    Optional git commit SHA, tag, or branch name.  When set, the build is
    performed from a read-only snapshot of that ref.

.PARAMETER Preview
    Pass $true to render with preview=true ($fn=32) for a faster test build.
    Defaults to $false (full quality, $fn=64).

.EXAMPLE
    # Current working tree → latest-build/v1.1/
    .\Build-BumperBracket.ps1 -BuildVersion 1.1

.EXAMPLE
    # Legacy commit → latest-build/v1.0/
    .\Build-BumperBracket.ps1 -BuildVersion 1.0 -GitRef 525c7e4c0f6c7ee6cab9011a29b5b4d237111025
#>
param(
    [Parameter(Mandatory)]
    [string]$BuildVersion,

    [string]$GitRef = "",

    [bool]$Preview = $false
)

$ErrorActionPreference = "Stop"

# ── Paths ──────────────────────────────────────────────────────────────────
$ScriptDir = $PSScriptRoot                                    # .../scripts/
$ModelDir  = Split-Path -Parent $ScriptDir                    # .../bumper-bracket/
$RepoRoot  = Split-Path -Parent (Split-Path -Parent $ModelDir) # repo root
$OutDir    = Join-Path (Join-Path $ModelDir "latest-build") "v$BuildVersion"

# Relative path from repo root to the SCAD directory (used inside a worktree)
$ScadRelDir = "3d-models\bumper-bracket"

# ── Locate OpenSCAD ────────────────────────────────────────────────────────
function Find-OpenScad {
    $pf86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
    foreach ($c in @(
        $env:OPENSCAD_PATH,
        "${env:ProgramFiles}\OpenSCAD\openscad.com",
        "${env:ProgramFiles}\OpenSCAD\openscad.exe",
        $(if ($pf86) { Join-Path $pf86 "OpenSCAD\openscad.com" })
    )) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    $cmd = Get-Command openscad -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Path }
    return $null
}

$OpenScad = Find-OpenScad
if (-not $OpenScad) {
    throw "OpenSCAD not found. Install OpenSCAD or set the OPENSCAD_PATH environment variable."
}

# ── Exports: [ scad-filename, stl-filename ] ───────────────────────────────
$Exports = @(
    @{ Scad = "bumper-bracket.scad";       Stl = "bumper-bracket-left.stl"  },
    @{ Scad = "bumper-bracket-right.scad"; Stl = "bumper-bracket-right.stl" },
    @{ Scad = "cap.scad";                  Stl = "cap.stl"                  }
)

# ── Worktree setup ─────────────────────────────────────────────────────────
$TempWtRoot = $null

try {
    if ($GitRef) {
        $TempWtRoot = Join-Path ([IO.Path]::GetTempPath()) `
            "bumper-bracket-$($GitRef.Substring(0, [Math]::Min(8,$GitRef.Length)))-$(Get-Random)"
        Write-Host "Creating worktree for $GitRef at $TempWtRoot ..."
        git -C $RepoRoot worktree add $TempWtRoot $GitRef
        $BuildScadDir = Join-Path $TempWtRoot $ScadRelDir
    } else {
        $BuildScadDir = $ModelDir
    }

    # ── Output directory ───────────────────────────────────────────────────
    if (-not (Test-Path -LiteralPath $OutDir)) {
        New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    }

    $previewVal = if ($Preview) { "true" } else { "false" }
    $Defines = @("-D", "preview=$previewVal")

    # ── Render each part ───────────────────────────────────────────────────
    foreach ($exp in $Exports) {
        $InPath  = Join-Path $BuildScadDir $exp.Scad
        $OutPath = Join-Path $OutDir       $exp.Stl
        Write-Host "  Rendering $($exp.Scad) -> latest-build\v$BuildVersion\$($exp.Stl) ..."
        & $OpenScad @Defines -o $OutPath $InPath
        if ($LASTEXITCODE -ne 0) {
            throw "OpenSCAD failed for $($exp.Scad) (exit code $LASTEXITCODE)"
        }
    }

    Write-Host ""
    Write-Host "Build v$BuildVersion complete.  Output: $OutDir"
}
finally {
    if ($TempWtRoot -and (Test-Path -LiteralPath $TempWtRoot)) {
        Write-Host "Removing worktree $TempWtRoot ..."
        git -C $RepoRoot worktree remove --force $TempWtRoot
    }
}
