$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

function Invoke-Npm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$NpmArgs)
  npm @NpmArgs
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Write-Host "== DealSifter: promoting DEV to PRODUCTION ==" -ForegroundColor Cyan
Write-Host "This merges origin/dev into safe-push and pushes safe-push to origin/main." -ForegroundColor Yellow

Invoke-Git fetch origin
Invoke-Git switch safe-push
Invoke-Git pull --ff-only origin main
Invoke-Git merge --no-ff origin/dev -m "Promote dev to production"
Invoke-Npm run build
Invoke-Git push origin safe-push:main

Write-Host "Promotion complete." -ForegroundColor Green
