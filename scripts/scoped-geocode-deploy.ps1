param([ValidateSet('Create','Status')][string]$Mode, [string]$CodeSha, [string]$DeploymentId)
$ErrorActionPreference = 'Stop'
if ($CodeSha -notmatch '^[a-f0-9]{40}$') { throw 'EXACT_CODE_COMMIT_REQUIRED' }
$team = 'team_O4RRFlfO8m7MEZI0xY5BVVYi'
function Invoke-ScopedVercel([string]$Endpoint, [object]$Body = $null) {
 if ($null -eq $Body) { $raw = & npx --no-install vercel api $Endpoint --raw }
 else { $raw = ($Body | ConvertTo-Json -Depth 10 -Compress) | & npx --no-install vercel api $Endpoint --method POST --input - --raw }
 if ($LASTEXITCODE -ne 0) { throw 'SCOPED_VERCEL_API_FAILED' }
 # Never expose the full API response: it can contain deployment environment secrets.
 return (($raw -join "`n") | ConvertFrom-Json)
}
if ($Mode -eq 'Create') {
 $remote = & git ls-remote origin refs/heads/fix/production-real-defects
 if ($LASTEXITCODE -ne 0 -or ($remote -split '\s+')[0] -ne $CodeSha) { throw 'COMMIT_NOT_PUSHED_TO_EXPECTED_BRANCH' }
 $result = Invoke-ScopedVercel "/v13/deployments?teamId=$team" @{
  name='dealsifter_match';project='prj_QPyhaESQ9dpLfgSfwzm4wxirLbs5';target='production';
  gitSource=@{type='github';repoId='1245036806';ref='fix/production-real-defects';sha=$CodeSha}
 }
} else {
 if ($DeploymentId -notmatch '^dpl_[a-zA-Z0-9]+$') { throw 'EXPECTED_DEPLOYMENT_ID_REQUIRED' }
 $result = Invoke-ScopedVercel "/v13/deployments/${DeploymentId}?teamId=$team"
}
$source = $result.gitSource.sha
if (!$source) { $source = $result.meta.githubCommitSha }
$receipt = [ordered]@{ observedAt=(Get-Date).ToUniversalTime().ToString('o'); id=$result.id;
 state=$result.readyState; target=$result.target; url=('https://'+$result.url);
 sourceSha=$source; sourceShaVerified=($source -eq $CodeSha); aliasVerified=$false }
if ($Mode -eq 'Status' -and $result.readyState -eq 'READY') {
 $alias = Invoke-ScopedVercel "/v4/aliases/dealsiftermatch.vercel.app?teamId=$team"
 $receipt.aliasVerified = ($alias.deployment.id -eq $DeploymentId)
 if (!$receipt.sourceShaVerified -or !$receipt.aliasVerified) { throw 'PRODUCTION_SOURCE_OR_ALIAS_MISMATCH' }
}
$receipt | ConvertTo-Json | Set-Content -LiteralPath 'qa/geocode-wood-spring/production-deployment.json' -Encoding utf8
$receipt | ConvertTo-Json
