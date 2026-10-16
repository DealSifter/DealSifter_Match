import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const root=process.cwd(),baselineSha=process.env.SMART_PROPERTY_BASELINE||'6dbb16397f531137e357ed4c1d884d9fc37ee792',stage=resolve(process.env.SMART_PROPERTY_BASELINE?'.cache/smart-property-deno-ux-baseline':'.cache/smart-property-deno-baseline'),directory=process.env.SMART_PROPERTY_QA_DIRECTORY||'qa/smart-property-enrichment/final-integration';
mkdirSync(stage,{recursive:true});
execFileSync('git',['archive','--format=tar',`--output=${resolve('.cache/smart-property-deno-baseline.tar')}`,baselineSha,'supabase'],{windowsHide:true});
execFileSync('tar',['-xf',resolve('.cache/smart-property-deno-baseline.tar'),'-C',stage],{windowsHide:true});
function check(cwd,newFunction){
 const args=['--yes','--package=deno','deno','check','--no-lock',...(process.env.SMART_PROPERTY_CHECK_CLOSURE?JSON.parse(readFileSync(`${directory}/backend-dependency-closure.json`,'utf8')).affectedFunctions.map(item=>`supabase/functions/${item.function}/index.ts`):['supabase/functions/public-parcel/index.ts','supabase/functions/maxxis-chat/index.ts','supabase/functions/maxxis-deal-workflow/index.ts','supabase/functions/maxxis-provider-message-draft/index.ts',...(newFunction?['supabase/functions/property-fact-review/index.ts']:[])])];
 let output='',exitCode=0;
 try{output=execFileSync('npx.cmd',args,{cwd,shell:true,windowsHide:true,encoding:'utf8',stdio:'pipe',maxBuffer:4000000});}catch(error){output=String(error.stdout??'')+'\n'+String(error.stderr??'');exitCode=error.status;}
 const diagnostics=[...output.matchAll(/(TS\d+) \[ERROR\]: ([\s\S]*?)(?=\nTS\d+ \[ERROR\]:|\nFound \d+ errors|$)/g)].map(match=>{
  const location=match[2].match(/at file:\/\/\/[^\n]*?(supabase\/functions\/[^:\n]+):(\d+):\d+/),path=location?.[1]??'UNKNOWN';
  const sourceLine=location?readFileSync(`${cwd}/${path}`,'utf8').split(/\r?\n/)[Number(location[2])-1].trim():'UNKNOWN';
  return {code:match[1],path,sourceLine,message:match[2].split('\n')[0]};
 });
 return {exitCode,diagnostics};
}
const baseline=process.argv.includes('--refresh-current')?JSON.parse(readFileSync(`${directory}/deno-baseline-comparison.json`,'utf8')).baseline:check(stage,Boolean(process.env.SMART_PROPERTY_BASELINE)),current=check(root,true),identity=item=>JSON.stringify([item.code,item.path,item.sourceLine]);
const bag=new Map();for(const item of baseline.diagnostics){const key=identity(item);bag.set(key,(bag.get(key)??0)+1);}
const introduced=[];for(const item of current.diagnostics){const key=identity(item),count=bag.get(key)??0;if(count)bag.set(key,count-1);else introduced.push(item);}
const closure=JSON.parse(readFileSync(`${directory}/backend-dependency-closure.json`,'utf8'));
const sourceHashes=Object.fromEntries([...closure.changedSharedModules,...closure.changedFunctionModules].map(file=>[file,createHash('sha256').update(readFileSync(file,'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
const receipt={baselineSha,baseline,current,newErrors:introduced.length,introduced,sourceHashes,pass:baseline.diagnostics.length>0&&introduced.length===0,note:'Legacy shared Maxxis diagnostics remain visible; comparison is by code/path/source expression, not count alone.'};
writeFileSync(`${directory}/deno-baseline-comparison.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({baselineErrors:baseline.diagnostics.length,currentErrors:current.diagnostics.length,newErrors:introduced.length,pass:receipt.pass}));if(!receipt.pass)process.exitCode=1;
