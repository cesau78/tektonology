<#
.SYNOPSIS
  Watches sole-prayers/ for JSON changes and auto-regenerates .gen.scad files.
.DESCRIPTION
  Uses FileSystemWatcher to monitor *.json files under sole-prayers/.
  On any save, runs Convert-StampProfile.ps1 for the changed file.
  Press Ctrl+C to stop.
.EXAMPLE
  .\Watch-StampProfiles.ps1
#>

$ErrorActionPreference = "Stop"
$ModelDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$WatchDir = Join-Path $ModelDir "sole-prayers"
$ConvertScript = Join-Path $PSScriptRoot "Convert-StampProfile.ps1"

if (-not (Test-Path -LiteralPath $WatchDir)) {
    throw "Directory not found: $WatchDir"
}

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $WatchDir
$watcher.Filter = "*.json"
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite

# Debounce: track last-processed path+time to ignore duplicate events.
$script:lastPath = ""
$script:lastTime = [datetime]::MinValue

$action = {
    $convertScript = $Event.MessageData
    $path = $Event.SourceEventArgs.FullPath
    $now = [datetime]::UtcNow
    if ($path -eq $script:lastPath -and ($now - $script:lastTime).TotalMilliseconds -lt 500) {
        return
    }
    $script:lastPath = $path
    $script:lastTime = $now

    $name = [IO.Path]::GetFileName($path)
    if ($name -eq "_stamp-profile-template.json") { return }

    Write-Host ""
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Changed: $name" -ForegroundColor Cyan
    try {
        & $convertScript -JsonPath $path
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
    }
}

Register-ObjectEvent $watcher "Changed" -Action $action -MessageData $ConvertScript | Out-Null

Write-Host "Watching $WatchDir for *.json changes..."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

# Do an initial conversion of all files so everything is up to date.
& $ConvertScript

try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    $watcher.EnableRaisingEvents = $false
    Get-EventSubscriber | Unregister-Event
    $watcher.Dispose()
    Write-Host "Watcher stopped."
}
