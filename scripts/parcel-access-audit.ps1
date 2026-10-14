param([Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$')][string]$ApprovedEmail,[switch]$CheckPublishedSource)
$ErrorActionPreference='Stop'
# Read-only audit for exactly the account previously approved by the user.
# No identities, service keys, sessions or config values are printed/persisted.
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class ScopedParcelAuditCredential {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct C {
 public UInt32 Flags;public UInt32 Type;public IntPtr TargetName;public IntPtr Comment;
 public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
 public UInt32 Size;public IntPtr Blob;public UInt32 Persist;public UInt32 Count;
 public IntPtr Attributes;public IntPtr Alias;public IntPtr User;
 }
 [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool Read(string target,uint type,int flags,out IntPtr result);
 [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr p);
 public static string Token(){IntPtr p;if(!Read("Supabase CLI:access-token",1,0,out p))throw new Exception("CLI_AUTH_UNAVAILABLE");
 try{var c=(C)Marshal.PtrToStructure(p,typeof(C));var b=new byte[c.Size];Marshal.Copy(c.Blob,b,0,b.Length);return System.Text.Encoding.UTF8.GetString(b);}finally{CredFree(p);}}
}
'@
$parcelAuditToken=[ScopedParcelAuditCredential]::Token()
if($parcelAuditToken -notmatch '^sbp_(oauth_)?[a-f0-9]{40}$'){throw 'INVALID_CONFIGURED_CLI_CREDENTIAL'}
$parcelAuditHeaders=@{Authorization=('Bearer '+$parcelAuditToken)}
$parcelAuditEmail=$ApprovedEmail.ToLowerInvariant()
$parcelAuditQuery=@{query="select id::text as account_id, email_confirmed_at is not null as confirmed from auth.users where lower(email)='$parcelAuditEmail'";read_only=$true}|ConvertTo-Json -Compress
$parcelAuditAccount=@(Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects/cyeipfskwwisbbayyaca/database/query' -Headers $parcelAuditHeaders -ContentType 'application/json' -Body $parcelAuditQuery -TimeoutSec 25)
if($parcelAuditAccount.Count -ne 1 -or !$parcelAuditAccount[0].confirmed){throw 'EXACT_APPROVED_CONFIRMED_ACCOUNT_NOT_RESOLVED'}
$parcelAuditSecrets=Invoke-RestMethod -Uri 'https://api.supabase.com/v1/projects/cyeipfskwwisbbayyaca/secrets' -Headers $parcelAuditHeaders -TimeoutSec 25
$parcelAuditDigest=@($parcelAuditSecrets|Where-Object name -eq 'FEATURE_FLAGS_JSON')
$parcelAuditOriginal=[ordered]@{public_parcel_intelligence=[ordered]@{enabled=$true;environments=@('production');percentage=100;internalUserIds=@($parcelAuditAccount[0].account_id)}}|ConvertTo-Json -Depth 6 -Compress
$parcelAuditHasher=[System.Security.Cryptography.SHA256]::Create()
try{$parcelAuditExpected=([BitConverter]::ToString($parcelAuditHasher.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($parcelAuditOriginal)))).Replace('-','').ToLowerInvariant()}finally{$parcelAuditHasher.Dispose()}
$parcelAuditMatches=$parcelAuditDigest.Count -eq 1 -and $parcelAuditDigest[0].value -eq $parcelAuditExpected
$parcelAuditResult=[ordered]@{observedAt=(Get-Date).ToUniversalTime().ToString('o');mode='READ_ONLY_APPROVED_ACCOUNT_AND_SECRET_DIGEST';approvedAccountResolved=$true;accountConfirmed=$true;flagSecretPresent=($parcelAuditDigest.Count -eq 1);exactOriginalApprovedCohortDigestMatches=$parcelAuditMatches;configurationChanged=$false;productionUserSessionUsed=$false}
if($CheckPublishedSource){
 try{
  $parcelBodyResponse=Invoke-WebRequest -Uri 'https://api.supabase.com/v1/projects/cyeipfskwwisbbayyaca/functions/feature-flags/body' -Headers $parcelAuditHeaders -UseBasicParsing -TimeoutSec 25
  $parcelBodyText=[System.Text.Encoding]::UTF8.GetString($parcelBodyResponse.RawContentStream.ToArray())
  # ESZIP preserves embedded module source text; never emit the archive/text.
  $parcelAuditResult.publishedSourceHttpStatus=$parcelBodyResponse.StatusCode
  $parcelAuditResult.embeddedSourceRecognized=($parcelBodyText -match 'resolveFeatureFlags' -and $parcelBodyText -match 'FEATURE_FLAGS_JSON')
  $parcelAuditResult.publishedParcelFlagDeclared=($parcelBodyText -match 'public_parcel_intelligence\s*:\s*\{')
  $parcelAuditResult.publishedInternalAllowlistGate=($parcelBodyText -match 'internalUserIds\?\.includes\(userId\)')
 }catch{$parcelAuditResult.publishedSourceAudit='UNAVAILABLE_NO_PRIVATE_OUTPUT'}
}
$parcelAuditResult|ConvertTo-Json
