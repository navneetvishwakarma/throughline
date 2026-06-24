#!/usr/bin/env pwsh
# install.ps1 — Install throughline as a local Claude Code plugin (Windows)
#
# Copies this repo into the Claude plugin cache. Edits to source are not live
# until you re-run this script.
#
# Usage:
#   ./install.ps1            # install / reinstall
#   ./install.ps1 -Uninstall # remove

param([switch]$Uninstall)

$ErrorActionPreference = "Stop"

$source       = $PSScriptRoot
$name         = "throughline"
$marketplace  = "local"
$version      = (Get-Content "$source\package.json" -Raw | ConvertFrom-Json).version
$gitSha       = (git -C $source rev-parse HEAD 2>$null)
$cacheDir     = "$env:USERPROFILE\.claude\plugins\cache\$marketplace\$name\$version"
$registryPath = "$env:USERPROFILE\.claude\plugins\installed_plugins.json"
$key          = "$name@$marketplace"

if ($Uninstall) {
    if (Test-Path $cacheDir) { Remove-Item $cacheDir -Recurse -Force }
    if (Test-Path $registryPath) {
        $reg = Get-Content $registryPath -Raw | ConvertFrom-Json
        if ($reg.plugins.PSObject.Properties[$key]) {
            $reg.plugins.PSObject.Properties.Remove($key)
            $reg | ConvertTo-Json -Depth 10 | Set-Content $registryPath -Encoding UTF8
        }
    }
    Write-Host "throughline uninstalled. Restart Claude Code."
    return
}

# Create parent directory
New-Item -ItemType Directory -Force -Path (Split-Path $cacheDir) | Out-Null

# Remove stale junction or directory
if (Test-Path $cacheDir) { Remove-Item $cacheDir -Recurse -Force }

# Copy source into cache then strip .git
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
Copy-Item -Path "$source\*" -Destination $cacheDir -Recurse
if (Test-Path "$cacheDir\.git") { Remove-Item "$cacheDir\.git" -Recurse -Force }
if (-not (Test-Path "$cacheDir\.claude-plugin\plugin.json")) {
    Write-Error "Copy failed — plugin manifest not found in cache."
    exit 1
}

# Update installed_plugins.json
if (Test-Path $registryPath) {
    $reg = Get-Content $registryPath -Raw | ConvertFrom-Json
    if (-not $reg.plugins) {
        $reg | Add-Member -NotePropertyName plugins -NotePropertyValue ([pscustomobject]@{})
    }
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $registryPath) | Out-Null
    $reg = [pscustomobject]@{ plugins = [pscustomobject]@{} }
}
$entry = [pscustomobject]@{
    scope        = "user"
    installPath  = $cacheDir
    version      = $version
    installedAt  = (Get-Date -Format "o")
    lastUpdated  = (Get-Date -Format "o")
    gitCommitSha = $gitSha
}
if ($reg.plugins.PSObject.Properties[$key]) {
    $reg.plugins.$key = @($entry)
} else {
    $reg.plugins | Add-Member -NotePropertyName $key -NotePropertyValue @($entry)
}
$reg | ConvertTo-Json -Depth 10 | Set-Content $registryPath -Encoding UTF8

Write-Host ""
Write-Host "throughline $version installed."
Write-Host "  Source : $source"
Write-Host "  Cache  : $cacheDir"
Write-Host "  Mode   : copy (re-run to pick up source changes)"
Write-Host ""
Write-Host "Restart Claude Code to activate the plugin."
