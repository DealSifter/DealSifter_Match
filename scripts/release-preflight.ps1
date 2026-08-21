$ErrorActionPreference = "Stop"

function Invoke-Npm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArgs)
  npm @NpmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Write-Host "== DealSifter release preflight (no deploy) ==" -ForegroundColor Cyan

$changes = git status --porcelain
if ($LASTEXITCODE -ne 0) { throw "git status failed" }
if ($changes) { throw "Release preflight requires a clean worktree." }

Invoke-Npm ci
Invoke-Npm run quality
Invoke-Npm run audit:functions:remote
Invoke-Npm run audit:secrets:remote

Write-Host "Release preflight passed. No deployment was performed." -ForegroundColor Green
