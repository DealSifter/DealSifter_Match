param([ValidateSet('Audit','Definition','ValidateMigration','Apply','Verify')][string]$Mode = 'Audit')
$ErrorActionPreference = 'Stop'
# Read only the already configured Supabase CLI application credential. Never emit it.
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class ScopedGeocodeCredential {
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
$geocodeToken = [ScopedGeocodeCredential]::Token()
if ($geocodeToken -notmatch '^sbp_(oauth_)?[a-f0-9]{40}$') { throw 'INVALID_CONFIGURED_CLI_CREDENTIAL' }
$query = @'
select geocode_status, geocode_source, count(*) as records,
count(*) filter (where lat is null or lng is null or lat=0 or lng=0) as missing_point,
count(*) filter (where geocoded_at is null) as missing_timestamp,
count(*) filter (where geocode_input is null) as missing_input,
count(*) filter (where hide_street_address_on_card) as private_records
from public.properties where publish_to_showcase and is_active group by geocode_status,geocode_source order by records desc;
'@
if ($Mode -eq 'Definition') { $query = "select pg_get_functiondef('public.ds_get_global_feed_inventory()'::regprocedure) as definition" }
if ($Mode -eq 'Verify') { $query = "select count(*) filter (where publish_to_showcase and not public.ds_property_geocode_valid(lat,lng,geocode_status,geocode_source,geocoded_at)) as invalid_published, count(*) filter (where not publish_to_showcase and not public.ds_property_geocode_valid(lat,lng,geocode_status,geocode_source,geocoded_at)) as draft_invalid from public.properties" }
if ($Mode -in @('Apply','ValidateMigration')) {
 $migration = 'supabase/migrations/20261013000001_property_geocode_publication_guard.sql'
 if (!(Test-Path -LiteralPath $migration)) { throw 'EXPECTED_MIGRATION_MISSING' }
 $query = Get-Content -LiteralPath $migration -Raw
 # Apply just this migration, atomically recording it. Never push unrelated pending migrations.
 $ledger = "insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261013000001','property_geocode_publication_guard',array['Targeted geocode publication guard']) on conflict (version) do nothing;"
 $query = $query.Replace('commit;', ($ledger + [Environment]::NewLine + 'commit;'))
 if ($Mode -eq 'ValidateMigration') {
  $testSql = Get-Content -LiteralPath 'qa/geocode-wood-spring/database-contract-test.sql' -Raw
  $query = $query.Replace('commit;', ($testSql + [Environment]::NewLine + 'rollback;'))
 }
}
$body = @{query=$query;read_only=($Mode -notin @('Apply','ValidateMigration'))} | ConvertTo-Json -Compress
$result = Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects/cyeipfskwwisbbayyaca/database/query' -Headers @{Authorization=('Bearer '+$geocodeToken)} -ContentType 'application/json' -Body $body
if ($Mode -eq 'Definition') {
 $result.definition | Set-Content -LiteralPath 'qa/geocode-wood-spring/production-inventory-definition.sql' -Encoding utf8
 Write-Output 'PRODUCTION_DEFINITION_CAPTURED_NO_USER_DATA'
} else { $result | ConvertTo-Json -Depth 8 }
