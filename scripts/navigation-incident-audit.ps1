$ErrorActionPreference = 'Stop'
# Only the configured application's Sentry credentials, never echoed or persisted.
$navigationSentryConfig = @{}
foreach ($navigationEnvFile in @('.env', '.env.local')) {
  if (Test-Path -LiteralPath $navigationEnvFile) {
    foreach ($navigationEnvLine in Get-Content -LiteralPath $navigationEnvFile) {
      if ($navigationEnvLine -match '^\s*(SENTRY_AUTH_TOKEN|SENTRY_ORG|SENTRY_PROJECT)\s*=\s*(.*?)\s*$') {
        $navigationSentryConfig[$matches[1]] = $matches[2].Trim('"', "'")
      }
    }
  }
}
function Protect-NavigationDiagnostic([string]$Value) {
  $safe = $Value -replace '\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b', '[Redacted]'
  $safe = $safe -replace '(?i)bearer\s+[a-z0-9._~-]+', '[Redacted]'
  $safe = $safe -replace '(?i)[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}', '[Redacted]'
  $safe = $safe -replace '(?i)\b(?:sbp_|sb_secret_|sntrys_)[a-z0-9_-]+', '[Redacted]'
  $safe = $safe -replace '(https?://[^\s?]+)\?[^\s]+', '$1?[Redacted]'
  return $safe.Substring(0, [Math]::Min(240, $safe.Length))
}
$navigationAudit = [ordered]@{ observedAt=(Get-Date).ToUniversalTime().ToString('o'); mode='READ_ONLY_CONFIGURED_APP_SENTRY'; status='NOT_AVAILABLE'; issues=@() }
if ($navigationSentryConfig.SENTRY_AUTH_TOKEN -and $navigationSentryConfig.SENTRY_ORG -and $navigationSentryConfig.SENTRY_PROJECT) {
  $navigationOrg = [Uri]::EscapeDataString($navigationSentryConfig.SENTRY_ORG)
  $navigationProject = [Uri]::EscapeDataString($navigationSentryConfig.SENTRY_PROJECT)
  try {
    $navigationIssues = Invoke-RestMethod -Uri "https://sentry.io/api/0/projects/$navigationOrg/$navigationProject/issues/?query=environment%3Aproduction%20level%3Aerror&statsPeriod=24h&limit=25" -Headers @{Authorization=('Bearer '+$navigationSentryConfig.SENTRY_AUTH_TOKEN)} -TimeoutSec 25
    $navigationAudit.status = 'PASS'
    $navigationAudit.issues = @($navigationIssues | ForEach-Object { [ordered]@{
      id=$_.id; shortId=$_.shortId; title=(Protect-NavigationDiagnostic $_.title);
      culprit=(Protect-NavigationDiagnostic $_.culprit); type=$_.metadata.type;
      lifetimeCount=$_.count; firstSeen=$_.firstSeen; lastSeen=$_.lastSeen
    } })
  } catch {
    $navigationAudit.status = 'UNAVAILABLE'
    if ($_.Exception.Response) { $navigationAudit.httpStatus = [int]$_.Exception.Response.StatusCode }
  }
}
# No event payloads, users, sessions, headers, cookies, frame locals or tokens.
$navigationAudit | ConvertTo-Json -Depth 5
