$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
  git @GitArgs
  if ($LASTEXITCODE -ne 0) {
    throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE"
  }
}

Write-Host "== DealSifter: starting DEV workspace ==" -ForegroundColor Cyan

Invoke-Git fetch origin

$hasDev = git branch --list dev
if (-not $hasDev) {
  Invoke-Git switch -c dev origin/main
} else {
  Invoke-Git switch dev
}

Invoke-Git pull --ff-only origin dev

Write-Host "Now on branch:" -ForegroundColor Green
Invoke-Git branch --show-current
Write-Host "Use: npm run build, git add, git commit, git push origin dev" -ForegroundColor Yellow
