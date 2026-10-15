param([ValidateSet('Audit','Apply','Verify')][string]$Mode='Audit',
 [string]$ReceiptPath='qa/smart-property-enrichment/final-integration/migration-production-audit.json')
$ErrorActionPreference='Stop'
# Uses the configured operator credential; never persists or prints it or user rows.
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public static class SmartFactCredential{
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct C{public UInt32 Flags;public UInt32 Type;public IntPtr TargetName;public IntPtr Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public UInt32 Size;public IntPtr Blob;public UInt32 Persist;public UInt32 Count;public IntPtr Attributes;public IntPtr Alias;public IntPtr User;}
 [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)]public static extern bool Read(string target,uint type,int flags,out IntPtr result);
 [DllImport("advapi32.dll")]public static extern void CredFree(IntPtr p);
 public static string Token(){IntPtr p;if(!Read("Supabase CLI:access-token",1,0,out p))throw new Exception("OPERATOR_AUTH_UNAVAILABLE");try{var c=(C)Marshal.PtrToStructure(p,typeof(C));var b=new byte[c.Size];Marshal.Copy(c.Blob,b,0,b.Length);return System.Text.Encoding.UTF8.GetString(b);}finally{CredFree(p);}}
}
'@
$factToken=[SmartFactCredential]::Token()
if($factToken -notmatch '^sbp_(oauth_)?[a-f0-9]{40}$'){throw 'INVALID_OPERATOR_CREDENTIAL'}
function Invoke-FactQuery([string]$Query,[bool]$ReadOnly=$true){
 try{return Invoke-RestMethod -Method Post -Uri 'https://api.supabase.com/v1/projects/cyeipfskwwisbbayyaca/database/query' -Headers @{Authorization=('Bearer '+$factToken)} -ContentType 'application/json' -Body (@{query=$Query;read_only=$ReadOnly}|ConvertTo-Json -Compress) -TimeoutSec 40}
 catch{throw 'SCOPED_FACT_DATABASE_REQUEST_FAILED_NO_PRIVATE_OUTPUT'}
}
$factAuditSql=@'
select jsonb_build_object(
 'latestMigration',(select max(version) from supabase_migrations.schema_migrations),
 'targetMigrationPresent',exists(select 1 from supabase_migrations.schema_migrations where version='20261014213000'),
 'reviewTableExists',to_regclass('public.property_fact_reviews') is not null,
 'historyTableExists',to_regclass('public.property_fact_review_history') is not null,
 'optionalColumns',(select jsonb_agg(jsonb_build_object('column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default) order by column_name) from information_schema.columns where table_schema='public' and table_name='properties' and column_name in ('rehab','beds','baths')),
 'notificationConstraint',(select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.notifications'::regclass and conname='notifications_type_check'),
 'security',(select jsonb_agg(jsonb_build_object('table',c.relname,'rls',c.relrowsecurity,
  'clientDirectWriteDenied',case when c.relname in ('property_fact_reviews','property_fact_review_history') then not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') else null end,
  'anonDirectReadDenied',case when c.relname in ('property_fact_reviews','property_fact_review_history') then not has_table_privilege('anon',c.oid,'SELECT') else null end,
  'policies',(select jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'roles',roles,'qual',qual)) from pg_policies where schemaname='public' and tablename=c.relname)) order by c.relname)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('property_fact_reviews','property_fact_review_history','notifications')),
 'clientStoreRpcExecuteDenied',case when to_regprocedure('public.ds_store_property_fact_review(uuid,uuid,bigint,jsonb,jsonb,boolean)') is not null then not has_function_privilege('authenticated','public.ds_store_property_fact_review(uuid,uuid,bigint,jsonb,jsonb,boolean)','EXECUTE') else null end,
 'migrationHistory',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations where version>='20261012000000')
) as audit;
'@
$factBefore=@(Invoke-FactQuery $factAuditSql)[0].audit
if($factBefore -is [string]){$factBefore=$factBefore|ConvertFrom-Json}
if($Mode -eq 'Apply'){
 if($factBefore.targetMigrationPresent -or $factBefore.reviewTableExists -or $factBefore.historyTableExists){throw 'TARGET_ALREADY_EXISTS_RECONCILE_BEFORE_WRITE'}
 if([string]$factBefore.latestMigration -ge '20261014213000'){throw 'MIGRATION_ORDER_REQUIRES_RECONCILIATION'}
 if(@($factBefore.optionalColumns).Count-ne 3){throw 'EXPECTED_OPTIONAL_COLUMNS_MISSING'}
 $factMigration=Get-Content -LiteralPath 'supabase/migrations/20261014213000_smart_property_fact_review.sql' -Raw
 $factOrderGuard=@'
lock table supabase_migrations.schema_migrations in share row exclusive mode;
do $$begin if exists(select 1 from supabase_migrations.schema_migrations where version>='20261014213000') then raise exception 'MIGRATION_ORDER_CHANGED';end if;end$$;
'@
 $factMigration=$factMigration.Replace('begin;',("begin;`nset local lock_timeout='3s';`nset local statement_timeout='20s';`n"+$factOrderGuard))
 $factLedger="insert into supabase_migrations.schema_migrations(version,name,statements) values ('20261014213000','smart_property_fact_review',array['Scoped additive property fact review migration']);"
 $factMigration=$factMigration.Replace('commit;',($factLedger+"`ncommit;"))
 $null=Invoke-FactQuery $factMigration $false
}
$factAfter=@(Invoke-FactQuery $factAuditSql)[0].audit
if($factAfter -is [string]){$factAfter=$factAfter|ConvertFrom-Json}
$factReceipt=[ordered]@{mode=$Mode;at=(Get-Date).ToUniversalTime().ToString('o');productionWrites=($Mode-eq 'Apply');before=$factBefore;after=$factAfter}
$factReceipt|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $ReceiptPath -Encoding utf8
Write-Output ($factReceipt|ConvertTo-Json -Depth 12)
