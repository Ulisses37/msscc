# Cline PreToolUse hook (Windows). Delegates to the shared Node guard.
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$guard = Join-Path $PSScriptRoot '..\..\.cline\guards\secret-guard.mjs'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Output '{"cancel": true, "errorMessage": "Secret guard needs Node.js on PATH. Install Node 22 or fix PATH, then retry."}'
    exit 0
}

$payload = [Console]::In.ReadToEnd()
$payload | & node $guard
exit 0
