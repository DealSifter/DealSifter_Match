param([Parameter(Mandatory=$true)][ValidateSet('Audit','Disable','Enable')][string]$Mode,
 [ValidatePattern('^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$')][string]$OriginalAccountEmail)
$ErrorActionPreference='Stop'
# Operator-only, scoped to the existing project/flag. No tokens, identities,
# secret values, sessions or raw API responses are printed or persisted.
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class ParcelGaCredential{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct C{public UInt32 Flags;public UInt32 Type;public IntPtr TargetName;public IntPtr Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public UInt32 Size;public IntPtr Blob;public UInt32 Persist;public UInt32 Count;public IntPtr Attributes;public IntPtr Alias;public IntPtr User;}
 [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)]public static extern bool Read(string target,uint type,int flags,out IntPtr result);
 [DllImport("advapi32.dll")]public static extern void CredFree(IntPtr p);
 public static string Token(){IntPtr p;if(!Read("Supabase CLI:access-token",1,0,out p))throw new Exception("OPERATOR_AUTH_UNAVAILABLE");try{var c=(C)Marshal.PtrToStructure(p,typeof(C));var b=new byte[c.Size];Marshal.Copy(c.Blob,b,0,b.Length);return System.Text.Encoding.UTF8.GetString(b);}finally{CredFree(p);}}
}
'@
$parcelGaToken=[ParcelGaCredential]::Token()
if($parcelGaToken -notmatch '^sbp_(oauth_)?[a-f0-9]{40}$'){throw 'INVALID_OPERATOR_CREDENTIAL'}
$parcelGaHeaders=@{Authorization=('Bearer '+$parcelGaToken)}
$parcelGaBase='https://api.supabase.com/v1/projects/cyeipfskwwisbbayyaca'
function Invoke-ParcelGaApi([string]$Path,[string]$Method='GET',[object]$Body=$null){
 try{if($null-eq $Body){$parcelGaResponse=Invoke-RestMethod -Uri ($parcelGaBase+$Path) -Headers $parcelGaHeaders -Method $Method -TimeoutSec 30}
 else{$parcelGaResponse=Invoke-RestMethod -Uri ($parcelGaBase+$Path) -Headers $parcelGaHeaders -Method $Method -ContentType 'application/json' -Body (ConvertTo-Json -InputObject $Body -Depth 10 -Compress) -TimeoutSec 30}
 return $parcelGaResponse
 }catch{throw 'SCOPED_PARCEL_GA_OPERATOR_REQUEST_FAILED_NO_PRIVATE_OUTPUT'}
}
function Get-ParcelGaDigest([string]$Value){$hash=[System.Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($hash.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}}
function Get-ParcelGaConfig([bool]$Enabled){return ([ordered]@{public_parcel_intelligence=[ordered]@{enabled=$Enabled;environments=@('production');percentage=100};public_parcel_qa_grid=[ordered]@{enabled=$false;environments=@();percentage=0}}|ConvertTo-Json -Depth 8 -Compress)}
$parcelGaBefore=@(Invoke-ParcelGaApi '/secrets');$parcelGaFlag=@($parcelGaBefore|Where-Object name -eq 'FEATURE_FLAGS_JSON')
if($parcelGaFlag.Count-ne 1){throw 'EXACT_EXISTING_FLAG_SECRET_REQUIRED'}
$parcelGaEnabled=Get-ParcelGaConfig $true;$parcelGaDisabled=Get-ParcelGaConfig $false
$parcelGaEnabledDigest=Get-ParcelGaDigest $parcelGaEnabled;$parcelGaDisabledDigest=Get-ParcelGaDigest $parcelGaDisabled
$parcelGaOriginalMatches=$false
if($OriginalAccountEmail){
 $parcelGaEmail=$OriginalAccountEmail.ToLowerInvariant()
 $parcelGaAccount=@(Invoke-ParcelGaApi '/database/query' 'POST' @{query="select id::text as account_id from auth.users where lower(email)='$parcelGaEmail' and email_confirmed_at is not null";read_only=$true})
 if($parcelGaAccount.Count-ne 1){throw 'EXACT_PREVIOUSLY_APPROVED_ACCOUNT_NOT_RESOLVED'}
 $parcelGaOriginal=[ordered]@{public_parcel_intelligence=[ordered]@{enabled=$true;environments=@('production');percentage=100;internalUserIds=@($parcelGaAccount[0].account_id)}}|ConvertTo-Json -Depth 8 -Compress
 $parcelGaOriginalMatches=$parcelGaFlag[0].value-eq (Get-ParcelGaDigest $parcelGaOriginal)
}
$parcelGaCurrent=if($parcelGaFlag[0].value-eq $parcelGaEnabledDigest){'GENERAL_AUTHENTICATED_ON'}elseif($parcelGaFlag[0].value-eq $parcelGaDisabledDigest){'OFF'}elseif($parcelGaOriginalMatches){'ORIGINAL_PREVIEW'}else{'UNRECOGNIZED_PRIVATE_MERGE_REQUIRED'}
$parcelGaChanged=$false
if($Mode-ne 'Audit'){
 if($parcelGaCurrent-eq 'UNRECOGNIZED_PRIVATE_MERGE_REQUIRED'){throw 'UNKNOWN_EXISTING_CONFIGURATION_NO_OVERWRITE'}
 if($Mode-eq 'Enable'-and $parcelGaCurrent-eq 'ORIGINAL_PREVIEW'){throw 'FAIL_CLOSED_DEPLOYMENT_SEQUENCE_REQUIRED_DISABLE_FIRST'}
 $parcelGaDesired=if($Mode-eq 'Enable'){$parcelGaEnabled}else{$parcelGaDisabled}
 $parcelGaDesiredDigest=Get-ParcelGaDigest $parcelGaDesired
 # Recheck every digest before the sole flag write; preserve unrelated settings.
 $parcelGaRecheck=@(Invoke-ParcelGaApi '/secrets')
 if($parcelGaRecheck.Count-ne $parcelGaBefore.Count-or @($parcelGaBefore|Where-Object{$prior=$_;$match=@($parcelGaRecheck|Where-Object name -eq $prior.name);$match.Count-ne 1-or $match[0].value-ne $prior.value}).Count){throw 'SECRET_INVENTORY_CHANGED_NO_WRITE'}
 if($parcelGaFlag[0].value-ne $parcelGaDesiredDigest){$null=Invoke-ParcelGaApi '/secrets' 'POST' @(@{name='FEATURE_FLAGS_JSON';value=$parcelGaDesired});$parcelGaChanged=$true}
 $parcelGaAfter=@(Invoke-ParcelGaApi '/secrets')
 if($parcelGaAfter.Count-ne $parcelGaBefore.Count-or @($parcelGaBefore|Where-Object name -ne 'FEATURE_FLAGS_JSON'|Where-Object{$prior=$_;$match=@($parcelGaAfter|Where-Object name -eq $prior.name);$match.Count-ne 1-or $match[0].value-ne $prior.value}).Count){throw 'UNRELATED_SECRET_INTEGRITY_NOT_CONFIRMED'}
 if(@($parcelGaAfter|Where-Object name -eq 'FEATURE_FLAGS_JSON')[0].value-ne $parcelGaDesiredDigest){throw 'EXACT_FLAG_WRITE_NOT_CONFIRMED'}
 $parcelGaCurrent=if($Mode-eq 'Enable'){'GENERAL_AUTHENTICATED_ON'}else{'OFF'}
}
$parcelGaFunctions=@(Invoke-ParcelGaApi '/functions'|Where-Object slug -in @('feature-flags','public-parcel')|Select-Object slug,version,status,updated_at)
$parcelGaChangedSecretNames=@();if($parcelGaChanged){$parcelGaChangedSecretNames=@('FEATURE_FLAGS_JSON')}
$parcelGaReceipt=[ordered]@{observedAt=(Get-Date).ToUniversalTime().ToString('o');mode=$Mode;effectiveConfiguration=$parcelGaCurrent;originalPreviewDigestVerified=$parcelGaOriginalMatches;configurationChanged=$parcelGaChanged;changedSecrets=$parcelGaChangedSecretNames;unchangedOtherSecretCount=$parcelGaBefore.Count-1;previewAllowlist=if($parcelGaCurrent-eq 'ORIGINAL_PREVIEW'){'PRESENT'}elseif($parcelGaCurrent-eq 'UNRECOGNIZED_PRIVATE_MERGE_REQUIRED'){'UNKNOWN'}else{'REMOVED'};globalGridGeneralAccess='OFF';productionUserSessionUsed=$false;functions=$parcelGaFunctions}
$parcelGaReceipt|ConvertTo-Json -Depth 7|Set-Content -LiteralPath ('qa/public-parcel-intelligence/general-availability/flag-'+$Mode.ToLowerInvariant()+'.json') -Encoding utf8
$parcelGaReceipt|ConvertTo-Json -Depth 7
