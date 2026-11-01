param([string]$OutputPath='.tmp-codex/schema-compat-catalog.json')
$ErrorActionPreference='Stop'
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class R2ReadCredential {
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public struct C { public UInt32 Flags;public UInt32 Type;public IntPtr TargetName;public IntPtr Comment;public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;public UInt32 Size;public IntPtr Blob;public UInt32 Persist;public UInt32 Count;public IntPtr Attributes;public IntPtr Alias;public IntPtr User; }
 [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool Read(string target,uint type,int flags,out IntPtr result);
 [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr p);
 public static string Token(){IntPtr p;if(!Read("Supabase CLI:access-token",1,0,out p))throw new Exception("CLI_AUTH_UNAVAILABLE");try{var c=(C)Marshal.PtrToStructure(p,typeof(C));var b=new byte[c.Size];Marshal.Copy(c.Blob,b,0,b.Length);return System.Text.Encoding.UTF8.GetString(b);}finally{CredFree(p);}}
}
'@
$r2Ref='cyeipfskwwisbbayyaca'
$v4Token=$null
$v4Stage='target'
try {
 $v4Ref='cyeipfskwwisbbayyaca'
 if((Get-Content supabase/.temp/project-ref -Raw).Trim() -ne $v4Ref){throw 'LOCAL_TARGET_MISMATCH'}
 $v4Stage='credential';$v4Token=[R2ReadCredential]::Token();$v4Headers=@{Authorization=('Bearer '+$v4Token)}
 $v4Stage='project'
 $v4Project=Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$v4Ref" -Headers $v4Headers -TimeoutSec 25
 if($v4Project.id -ne $v4Ref -or $v4Project.status -ne 'ACTIVE_HEALTHY'){throw 'REMOTE_TARGET_MISMATCH'}
 $v4Stage='catalog';$v4Sql=[IO.File]::ReadAllText((Resolve-Path scripts/schema-compat-catalog.sql).Path)
 $v4Rows=Invoke-RestMethod -Method Post -Uri "https://api.supabase.com/v1/projects/$v4Ref/database/query" -Headers $v4Headers -ContentType 'application/json' -Body (@{query=$v4Sql;read_only=$true}|ConvertTo-Json -Compress) -TimeoutSec 30
 $v4Stage='save';$v4Catalog=@($v4Rows)[0].catalog
 $v4Catalog|ConvertTo-Json -Depth 30|Set-Content -LiteralPath $OutputPath -Encoding UTF8
 Write-Output ('TARGET VERIFIED cyeipfskwwisbbayyaca; catalog functions='+$v4Catalog.functions.Count+' tables='+$v4Catalog.tables.Count+'; metadata only')
}catch{ $v4Http=if($_.Exception.Response){[int]$_.Exception.Response.StatusCode}else{0}; Write-Output ('SCHEMA_COMPAT_CATALOG_FAILED stage='+$v4Stage+' http='+$v4Http);if($v4Stage -eq 'catalog'){ $v4ErrorText=$_.ErrorDetails.Message; if($v4ErrorText -match 'ERROR:.*'){Write-Output ($Matches[0] -replace '\\n.*','')} };exit 1}finally{$v4Token=$null;$v4Headers=$null}
