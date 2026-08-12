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

function Assert-CleanWorktree {
  $changes = git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "git status failed with exit code $LASTEXITCODE"
  }
  if ($changes) {
    throw "Promotion requires a clean worktree. Commit or stash all changes first."
  }
}

Write-Host "== DealSifter: promoting DEV to PRODUCTION ==" -ForegroundColor Cyan
Write-Host "This merges origin/dev into safe-push and pushes safe-push to origin/main." -ForegroundColor Yellow

Assert-CleanWorktree
Invoke-Git fetch origin
Invoke-Git switch safe-push
Invoke-Git pull --ff-only origin main
Assert-CleanWorktree
Invoke-Git merge --no-ff origin/dev -m "Promote dev to production"
Invoke-Npm ci
Invoke-Npm run quality
Invoke-Git push origin safe-push:main

Write-Host "Promotion complete." -ForegroundColor Green
