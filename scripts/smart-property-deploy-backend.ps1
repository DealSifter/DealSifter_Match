param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$CodeSha,
 [ValidateSet('maxxis-chat','maxxis-deal-workflow','maxxis-provider-message-draft','property-fact-review','public-parcel','property-intelligence','arv-visual-comp-review','presentation-translate')][string]$OnlyFunction,
 [string]$QaDirectory='qa/smart-property-enrichment/final-integration',
 [ValidateSet('maxxis-chat','maxxis-deal-workflow','maxxis-provider-message-draft','property-fact-review','public-parcel','property-intelligence','arv-visual-comp-review','presentation-translate')][string[]]$ExpectedFunctions=@())
$ErrorActionPreference='Stop'
$integrationRemote=& git ls-remote origin refs/heads/fix/production-real-defects
if($LASTEXITCODE-ne 0 -or ($integrationRemote-split '\s+')[0]-ne $CodeSha){throw 'EXPECTED_PUSHED_CODE_SHA_REQUIRED'}
$integrationClosure=Get-Content -LiteralPath (Join-Path $QaDirectory 'backend-dependency-closure.json') -Raw|ConvertFrom-Json
$integrationSlugs=@($integrationClosure.affectedFunctions|ForEach-Object {$_.function}|Sort-Object)
$integrationExpected=@('maxxis-chat','maxxis-deal-workflow','maxxis-provider-message-draft','property-fact-review','public-parcel')
if($QaDirectory-ne 'qa/smart-property-enrichment/final-integration'){
 if($ExpectedFunctions.Count){if($OnlyFunction){throw 'AMBIGUOUS_DEPLOY_SCOPE'};$integrationExpected=@($ExpectedFunctions|Sort-Object -Unique)}
 elseif($OnlyFunction){$integrationExpected=@($OnlyFunction)}else{throw 'EXPLICIT_FUNCTION_SCOPE_REQUIRED'}
}
if(($integrationSlugs-join ',')-ne ($integrationExpected-join ',')){throw 'UNEXPECTED_BACKEND_CLOSURE'}
$integrationStage=Join-Path (Get-Location).Path '.cache/smart-property-backend'
$null=New-Item -ItemType Directory -Path $integrationStage -Force
$integrationArchive=Join-Path (Get-Location).Path '.cache/smart-property-backend.tar'
& git archive --format=tar "--output=$integrationArchive" $CodeSha supabase
if($LASTEXITCODE-ne 0){throw 'IMMUTABLE_BACKEND_ARCHIVE_FAILED'}
& tar -xf $integrationArchive -C $integrationStage
if($LASTEXITCODE-ne 0){throw 'IMMUTABLE_BACKEND_STAGE_FAILED'}
$integrationReceiptPath=Join-Path $QaDirectory 'backend-deploy.json'
$integrationSteps=@()
foreach($integrationSlug in $integrationSlugs){
 if($OnlyFunction-and $integrationSlug-ne $OnlyFunction){continue}
 & supabase functions deploy $integrationSlug --project-ref cyeipfskwwisbbayyaca --workdir $integrationStage --use-api
 $integrationExit=$LASTEXITCODE
 $integrationSteps+=@([ordered]@{function=$integrationSlug;exitCode=$integrationExit;at=(Get-Date).ToUniversalTime().ToString('o')})
 [ordered]@{codeSha=$CodeSha;immutableGitStage=$true;project='cyeipfskwwisbbayyaca';requestedJwtVerification=$true;steps=$integrationSteps}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $integrationReceiptPath -Encoding utf8
 if($integrationExit-ne 0){throw "SCOPED_BACKEND_DEPLOY_FAILED:$integrationSlug"}
}
Write-Output 'SCOPED_BACKEND_DEPLOY_COMPLETED_CHECK_REMOTE_VERSIONS_NEXT'
