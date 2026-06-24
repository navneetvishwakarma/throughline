#!/usr/bin/env pwsh
# Install throughline for a supported AI platform.
#
# Usage:
#   ./install.ps1                         # Claude Code
#   ./install.ps1 -Platform codex         # Codex
#   ./install.ps1 -Platform antigravity   # Antigravity skills folder
#   ./install.ps1 -Platform codex -Uninstall

param(
    [ValidateSet("claude", "codex", "antigravity")]
    [string]$Platform = "claude",
    [switch]$Uninstall,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$argsList = @()
$argsList += (Join-Path $PSScriptRoot "scripts\install.mjs")
$argsList += $Platform
if ($Uninstall) { $argsList += "--uninstall" }
if ($DryRun) { $argsList += "--dry-run" }

& node @argsList
exit $LASTEXITCODE
