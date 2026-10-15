$ErrorActionPreference='Stop'
# Reuse the existing operator-only credential reader and read-only API wrapper.
# No session, credential, body archive or real property data is emitted or persisted.
$reviewAuditHelper=Get-Content -LiteralPath scripts/smart-property-production-database.ps1 -Raw
$reviewAuditStart=$reviewAuditHelper.IndexOf('# Uses the configured operator credential;')
$reviewAuditEnd=$reviewAuditHelper.IndexOf('$factAuditSql=')
if($reviewAuditStart-lt 0-or $reviewAuditEnd-le $reviewAuditStart){throw 'EXISTING_SCOPED_OPERATOR_HELPER_NOT_RECOGNIZED'}
Invoke-Expression $reviewAuditHelper.Substring($reviewAuditStart,$reviewAuditEnd-$reviewAuditStart)
$reviewAuditResponse=Invoke-WebRequest -Uri 'https://api.supabase.com/v1/projects/cyeipfskwwisbbayyaca/functions/property-fact-review/body' -Headers @{Authorization=('Bearer '+$factToken)} -UseBasicParsing -TimeoutSec 40
$reviewAuditBytes=$reviewAuditResponse.RawContentStream.ToArray()
$reviewAuditText=[System.Text.Encoding]::UTF8.GetString($reviewAuditBytes)
$reviewAuditMarkers=[ordered]@{
 materialCandidateIdentity=$reviewAuditText.Contains('reviewCandidateIdentity')
 sharedActionableProjection=$reviewAuditText.Contains('actionableReview')
 reviewedSnapshotRebinding=($reviewAuditText-match 'previous\.state\.rows\[field\]')
 cacheOnlyIdentityFastPath=($reviewAuditText-match 'body\.cacheOnly\s*===\s*true\s*&&\s*sameIdentity')
 atomicStoreRpc=$reviewAuditText.Contains('ds_store_property_fact_review')
 ownerGuard=$reviewAuditText.Contains('PROPERTY_OWNER_REQUIRED')
}
if(@($reviewAuditMarkers.Values|Where-Object{$_-ne $true}).Count){$reviewAuditMarkers|ConvertTo-Json;throw 'PUBLISHED_REVIEW_SOURCE_MARKERS_NOT_CONFIRMED'}
$reviewAuditHasher=[System.Security.Cryptography.SHA256]::Create()
try{$reviewAuditDigest=([BitConverter]::ToString($reviewAuditHasher.ComputeHash($reviewAuditBytes))).Replace('-','').ToLowerInvariant()}finally{$reviewAuditHasher.Dispose()}
$reviewAuditReceipt=[ordered]@{pass=$true;observedAt=(Get-Date).ToUniversalTime().ToString('o');function='property-fact-review';httpStatus=$reviewAuditResponse.StatusCode;archiveSha256=$reviewAuditDigest;markers=$reviewAuditMarkers;productionUserSessionUsed=$false;propertyWrites=0}
$reviewAuditReceipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath qa/smart-property-enrichment/ux-stabilization/backend-source-verification.json -Encoding utf8
$reviewAuditReceipt|ConvertTo-Json -Depth 5
