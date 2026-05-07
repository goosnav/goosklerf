# Play-Goosklerf.ps1 — Windows PowerShell launcher.
#
# Use this if you prefer PowerShell to cmd.exe. Right-click the file and
# choose "Run with PowerShell", or run from a PowerShell prompt:
#
#     .\Play-Goosklerf.ps1
#
# If PowerShell rejects the script with an execution-policy error, run this
# once in an admin PowerShell:
#
#     Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

#Requires -Version 5

$ErrorActionPreference = 'Stop'

function Pause-AndExit {
    param([int]$Code = 0, [string]$Message = '')
    if ($Message) { Write-Host $Message -ForegroundColor Red }
    Read-Host 'Press Enter to close this window'
    exit $Code
}

# cd to script directory.
Set-Location -LiteralPath $PSScriptRoot

Write-Host '----------------------------------------------'
Write-Host '  Goosklerf launcher  (Windows / PowerShell)'
Write-Host '----------------------------------------------'
Write-Host ''

# Confirm pnpm is on PATH.
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host 'ERROR: pnpm not found on your PATH.' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Install Node.js from https://nodejs.org first, then run:'
    Write-Host '    npm install -g pnpm'
    Pause-AndExit 1
}

# Hop into the active code directory.
if (-not (Test-Path -LiteralPath 'gk_videogame_v2')) {
    Pause-AndExit 1 'Cannot find gk_videogame_v2/ — has the folder been moved?'
}
Set-Location -LiteralPath 'gk_videogame_v2'

# First-run setup: install deps.
if (-not (Test-Path -LiteralPath 'node_modules')) {
    Write-Host 'First run — installing dependencies (this takes ~30 seconds)...'
    pnpm install
    if ($LASTEXITCODE -ne 0) { Pause-AndExit $LASTEXITCODE 'pnpm install failed.' }
    Write-Host ''
}

# First-run setup: build cards.
if (-not (Test-Path -LiteralPath 'packages/cards/data/cards.generated.json')) {
    Write-Host 'First run — building card database...'
    pnpm cards:build
    if ($LASTEXITCODE -ne 0) { Pause-AndExit $LASTEXITCODE 'pnpm cards:build failed.' }
    Write-Host ''
}

# Launch.
Write-Host 'Launching Goosklerf...'
Write-Host ''
pnpm play -- @args
$code = $LASTEXITCODE

Write-Host ''
if ($code -eq 0) {
    Write-Host 'Game ended cleanly.'
} else {
    Write-Host "Game exited with code $code."
}
Pause-AndExit $code
