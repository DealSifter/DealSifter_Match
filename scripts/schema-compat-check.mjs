import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {parse} from '@babel/parser';
const base='supabase/functions/_shared/property-data/';
const verifiedReceipts=new WeakSet();
export const SCHEMA_COMPAT_SOURCES=['usageGuard.ts','providerBudget.ts','providerTrace.ts','cache.ts','valuationCache.ts','soldCache.ts','supplementalEvidenceCache.ts','singleFlight.ts','backendFactory.ts','types.ts'];
const visit=(node,callback)=>{if(!node||typeof node!=='object')return;callback(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(child=>visit(child,callback));else if(value&&typeof value==='object')visit(value,callback);};
const literals=node=>{const found=[];visit(node,n=>{if(n.type==='StringLiteral')found.push(n.value);});return [...new Set(found)];};
export async function codeSchemaContract(root=process.cwd()){
 const sources={},parsed={},hash=createHash('sha256');
 for(const name of SCHEMA_COMPAT_SOURCES){const path=base+name,source=(await readFile(root+'/'+path,'utf8')).replaceAll('\r\n','\n');sources[name]=source;parsed[name]=parse(source,{sourceType:'module',plugins:['typescript']});hash.update(path).update(source);}
 const values=(file,name)=>{let result=[];visit(parsed[file],n=>{if(['VariableDeclarator','TSTypeAliasDeclaration'].includes(n.type)&&n.id?.name===name)result=literals(n.init||n.typeAnnotation);});if(!result.length)throw Error('SCHEMA_CONTRACT_SYMBOL_MISSING:'+name);return result;};
 const operations=values('usageGuard.ts','PropertyDataUsageOperation'),origins=values('providerTrace.ts','ProviderOrigin'),outcomes=values('providerTrace.ts','EvidenceOutcome');
 const dataTypes=[...values('cache.ts','PROPERTY_RECORD_CACHE_DATA_TYPE'),...values('valuationCache.ts','VALUATION_CACHE_DATA_TYPE'),...values('soldCache.ts','SOLD_POOL_CACHE_DATA_TYPE'),...values('supplementalEvidenceCache.ts','SUPPLEMENTAL_CACHE_DATA_TYPES'),...['sfr','townhouse','condo'].map(t=>'property_sold_record_pool_exit_'+t)];
 const calls=[];
 for(const[file,tree]of Object.entries(parsed))visit(tree,n=>{if(n.type==='CallExpression'&&n.callee?.type==='MemberExpression'&&n.callee.property?.name==='rpc'&&n.arguments[1]?.type==='ObjectExpression'){
  const names=literals(n.arguments[0]).filter(n=>n.startsWith('ds_')),args=n.arguments[1].properties.filter(p=>p.type==='ObjectProperty').map(p=>p.key.name||p.key.value);for(const name of names)calls.push({name,args,sender:base+file});
 }});
 return {sourceFingerprint:hash.digest('hex'),operations,origins,outcomes,errorCodes:values('types.ts','PropertyDataErrorCode'),dataTypes:[...new Set(dataTypes)],calls,
  leaseMapper:sources['singleFlight.ts'].includes('p_key: leaseKey')&&sources['singleFlight.ts'].includes('propertyEvidenceLeaseKey(key)'),
  hardLimit:/DEFAULT_RENTCAST_MONTHLY_HARD_LIMIT\s*=\s*45/.test(sources['usageGuard.ts']),
  freeBlocked:/input\.plan\s*===\s*'FREE'/.test(sources['providerBudget.ts'])};
}
const quoted=text=>[...text.matchAll(/'((?:[^']|'')*)'/g)].map(m=>m[1].replaceAll("''","'"));
export function rejectionLists(definition,parameter){
 const result=[],pattern=new RegExp('\\b'+parameter+'\\s+not\\s+in\\s*\\(([^)]*)\\)','gi');
 for(const match of definition.matchAll(pattern))result.push(quoted(match[1]));
 const equality=new RegExp('\\b'+parameter+"\\s*<>\\s*('(?:[^']|'')*')",'gi');
 for(const match of definition.matchAll(equality))result.push(quoted(match[1]));
 return result;
}
export function compareSchema(contract,catalog){
 const rows=[],incompatibilities=[];
 const add=(value,sender,accepted,location)=>{const row={value,sender,accepted,location};rows.push(row);if(!accepted)incompatibilities.push(row);};
 const checkTable=(table,column,values,sender)=>{
  const relation=catalog.tables.find(t=>t.name===table),field=relation?.columns.find(c=>c.name===column);
  for(const value of values){if(!field){add(value,sender,false,table+'.'+column+':MISSING');continue;}
   const checks=(relation.constraints||[]).filter(c=>c.kind==='c'&&new RegExp('\\b'+column+'\\b').test(c.definition));
   const lists=checks.map(c=>({c,values:quoted(c.definition)})).filter(c=>c.values.length&& !/~/.test(c.c.definition));
   const rejected=lists.find(c=>!c.values.includes(value));add(value,sender,!rejected,rejected?table+'.'+rejected.c.name:table+'.'+column);
  }
 };
 checkTable('external_provider_usage','provider',['rentcast'],'UsageGuard');checkTable('external_provider_usage','operation',contract.operations,'UsageGuard.reserve');
 checkTable('property_intelligence_cache','provider',['rentcast'],'Evidence caches');checkTable('property_intelligence_cache','data_type',contract.dataTypes,'Record/AVM/sold/supplemental caches');
 for(const table of ['external_provider_usage','maxxis_provider_budget_usage']){checkTable(table,'status',['reserved','succeeded','failed'],'Reservation/finalization RPCs');checkTable(table,'origin',contract.origins,'providerTrace');checkTable(table,'evidence_outcome',contract.outcomes,'providerTrace');}
 checkTable('maxxis_provider_budget_usage','plan',['PRO','ENTERPRISE'],'ProviderBudget (FREE blocked in app)');checkTable('maxxis_provider_budget_usage','bucket',['chat','report'],'ProviderBudget');
 for(const [name,param,values,sender] of [
  ['ds_reserve_external_provider_usage','p_provider',['rentcast'],'UsageGuard'],['ds_reserve_external_provider_usage','p_operation',contract.operations,'UsageGuard.reserve'],
  ['ds_upsert_property_intelligence_cache','p_provider',['rentcast'],'Evidence caches'],['ds_upsert_property_intelligence_cache','p_data_type',contract.dataTypes,'Evidence caches (including delegate overload)'],
  ['ds_annotate_provider_attempt','p_origin',contract.origins,'providerTrace'],['ds_annotate_provider_attempt','p_evidence_outcome',contract.outcomes,'providerTrace'],
  ['ds_reserve_maxxis_provider_budget','v_plan',['PRO','ENTERPRISE'],'ProviderBudget'],['ds_reserve_maxxis_provider_budget','v_bucket',['chat','report'],'ProviderBudget']]){
   const functions=catalog.functions.filter(f=>f.name===name),lists=functions.flatMap(f=>rejectionLists(f.definition,param).map(values=>({values,signature:f.signature})));
   for(const value of values){const rejection=lists.find(list=>!list.values.includes(value));add(value,sender,!!functions.length&&!rejection,rejection?.signature||name);}
 }
 for(const call of contract.calls){const matches=catalog.functions.filter(f=>f.name===call.name).filter(f=>{const args=(f.args||[]).slice(0,f.argTypes.split(',').length),required=args.slice(0,args.length-f.defaultCount);return call.args.every(a=>args.includes(a))&&required.every(a=>call.args.includes(a));});add(call.args.join(', '),call.sender,matches.length>0,call.name+':ARGUMENTS');}
 const lease=catalog.tables.find(t=>t.name==='property_evidence_leases');
 add('UUID v5 / original property UUID','SupabasePropertySingleFlight',contract.leaseMapper&&!!lease?.constraints.some(c=>c.definition.includes('36')&&c.definition.includes('0-9a-f')), 'property_evidence_leases.key');
 add('SHA-256: 64 lowercase hex','Evidence cache identities',!!catalog.tables.find(t=>t.name==='property_intelligence_cache')?.constraints.some(c=>c.definition.includes('64')&&c.definition.includes('0-9a-f')),'property_intelligence_cache.address_fingerprint');
 add('1..45; effective guard unchanged','UsageGuard',contract.hardLimit&&catalog.functions.some(f=>f.name==='ds_reserve_external_provider_usage'&&/p_hard_limit\s*>\s*45/.test(f.definition)),'ds_reserve_external_provider_usage:HARD_LIMIT');
 add('FREE blocked before reservation','ProviderBudget',contract.freeBlocked,'Application plan gate');
 const codeConstraint=catalog.tables.find(t=>t.name==='external_provider_usage')?.constraints.find(c=>c.name==='external_provider_usage_error_code_check');
 for(const code of contract.errorCodes)add(code,'PropertyDataErrorCode',!!codeConstraint&&/^[A-Z][A-Z0-9_]{1,63}$/.test(code),'external_provider_usage.error_code');
 add('positive schema version 1','Evidence caches',catalog.tables.find(t=>t.name==='property_intelligence_cache')?.columns.some(c=>c.name==='schema_version'&&c.type==='smallint')===true,'property_intelligence_cache.schema_version');
 add('HTTP status NULL or 100..599','UsageGuard finalization',catalog.tables.find(t=>t.name==='external_provider_usage')?.constraints.some(c=>c.name==='external_provider_usage_http_status_check'&&c.definition.includes('100')&&c.definition.includes('599'))===true,'external_provider_usage.http_status');
 return {target:catalog.projectRef,observedUtc:catalog.observedUtc,sourceFingerprint:contract.sourceFingerprint,checked:rows.length,incompatibilities,rows};
}
export async function readCatalog({output='.tmp-codex/schema-compat-catalog.json'}={}){
 execFileSync('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File','scripts/schema-compat-catalog.ps1','-OutputPath',output],{stdio:['ignore','pipe','pipe']});
 return JSON.parse((await readFile(output,'utf8')).replace(/^\uFEFF/,''));
}
export async function schemaCompatCheck({catalog,root=process.cwd()}={}){
 const contract=await codeSchemaContract(root);const current=catalog||await readCatalog();if(current.projectRef!=='cyeipfskwwisbbayyaca')throw Error('SCHEMA_TARGET_MISMATCH');const report=compareSchema(contract,current);if(report.observedUtc&&!/Z$|[+-]\d\d:\d\d$/.test(report.observedUtc))report.observedUtc+='Z';verifiedReceipts.add(report);return report;
}
export function assertSchemaCompatible(report,now=Date.now()){
 const age=now-Date.parse(report?.observedUtc||'');
 if(!report||!verifiedReceipts.has(report)||report.target!=='cyeipfskwwisbbayyaca'||report.incompatibilities.length||!Number.isFinite(age)||age< -60000||age>600000)throw Error('R2_SCHEMA_COMPAT_PREFLIGHT_REQUIRED');
}
export function compareCatalogPrivileges(before,after){
 const functions=c=>c.functions.map(({name,signature,grants,owner,securityDefiner,settings})=>({name,signature,grants,owner,securityDefiner,settings}));
 const tables=c=>c.tables.map(({name,rls,forceRls,grants,owner,policies,columns})=>({name,rls,forceRls,grants,owner,policies,columns}));
 return {functionPrivilegesUnchanged:JSON.stringify(functions(before))===JSON.stringify(functions(after)),tablePrivilegesRlsAndDefaultsUnchanged:JSON.stringify(tables(before))===JSON.stringify(tables(after))};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const option=process.argv.find(a=>a.startsWith('--catalog='));
 try{const report=await schemaCompatCheck({catalog:option?JSON.parse((await readFile(option.slice(10),'utf8')).replace(/^\uFEFF/,'')):undefined});await mkdir('.tmp-codex',{recursive:true});await writeFile('.tmp-codex/schema-compat-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({target:report.target,checked:report.checked,incompatibilities:report.incompatibilities},null,2));process.exitCode=report.incompatibilities.length?2:0;}catch{console.error('SCHEMA_COMPAT_CHECK_FAILED: private details suppressed');process.exitCode=1;}
}
