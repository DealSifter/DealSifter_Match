$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Write-Host "== DealSifter: starting PRODUCTION HOTFIX workspace ==" -ForegroundColor Cyan

Invoke-Git fetch origin

$hasSafePush = git branch --list safe-push
if (-not $hasSafePush) {
  Invoke-Git switch -c safe-push origin/main
} else {
  Invoke-Git switch safe-push
}

Invoke-Git pull --ff-only origin main

Write-Host "Now on branch:" -ForegroundColor Green
Invoke-Git branch --show-current
Write-Host "Use: npm run build, git add, git commit, git push origin safe-push:main" -ForegroundColor Yellow
