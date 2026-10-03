# install-hooks.ps1
# Installs the shared MSSCC git hooks into the local repository.
# Run from anywhere inside the repo. Requires PowerShell and git.
# This copies ONLY the post-merge hook. The pre-commit hook is owned by
# the pre-commit framework (see .pre-commit-config.yaml), not by this script.
#
# First-time setup runs inside the backend venv (see backend/venv), e.g.:
#   cd backend
#   .\venv\Scripts\python -m pip install -r requirements-dev.txt
#   .\venv\Scripts\pre-commit install
# Run this script from the repo root, then install the post-merge hook:
#   docs\dev\githooks\install-hooks.ps1
# The pre-commit binary, ruff, and pytest all live in the venv.

$repoRoot = git rev-parse --show-toplevel
if (-not $? -or -not (Test-Path (Join-Path $repoRoot '.git'))) {
    Write-Error "Not inside a git repository. Run this script from the msscc repo."
    exit 1
}

$hooksDir = Join-Path $repoRoot '.git\hooks'
$sourceDir = Join-Path $repoRoot 'docs\dev\githooks'

if (-not (Test-Path $hooksDir)) {
    Write-Error "No .git/hooks directory found under $repoRoot."
    exit 1
}

$src = Join-Path $sourceDir 'post-merge'
$dst = Join-Path $hooksDir 'post-merge'

if (-not (Test-Path $src)) {
    Write-Error "Source hook missing: $src"
    exit 1
}

$text = (Get-Content -Raw $src) -replace "`r`n", "`n"
[IO.File]::WriteAllText($dst, $text, (New-Object Text.UTF8Encoding $false))
Write-Host "Installed post-merge -> $dst"

Write-Host ""
Write-Host "Post-merge hook installed from docs/dev/githooks."
Write-Host "The pre-commit hook is managed by the pre-commit framework."
Write-Host "First install: pre-commit install."
Write-Host "If you installed the old hand-rolled hook, run: pre-commit install --overwrite."
Write-Host "Otherwise pre-commit moves the old script to pre-commit.legacy and runs both, so Ruff runs twice."
