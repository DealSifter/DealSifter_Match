import {execFileSync} from 'node:child_process';
import {writeFileSync,readFileSync} from 'node:fs';
const args=['--yes','--package=deno','deno','check','--no-lock','supabase/functions/maxxis-chat/index.ts'];
function check(cwd){
 let output='',exitCode=0;
 try{output=execFileSync('npx.cmd',args,{cwd,shell:true,windowsHide:true,encoding:'utf8',stdio:'pipe',maxBuffer:2_000_000});}
 catch(error){output=String(error.stdout??'')+'\n'+String(error.stderr??'');exitCode=error.status;}
 const diagnostics=[...output.matchAll(/(TS\d+) \[ERROR\]: ([\s\S]*?)(?=\nTS\d+ \[ERROR\]:|\nFound \d+ errors|$)/g)].map(match=>{
   const location=match[2].match(/at file:\/\/\/[^\n]*?(supabase\/functions\/[^:\n]+):(\d+):\d+/),path=location?.[1]??'UNKNOWN';
   const sourceLine=location?readFileSync(`${cwd}/${path}`,'utf8').split(/\r?\n/)[Number(location[2])-1].trim():'UNKNOWN';
   return {code:match[1],path,sourceLine,message:match[2].split('\n')[0]};
 });
 return {exitCode,diagnostics};
}
const baseline=check(`${process.cwd()}/.cache/phase3-deno-baseline`),current=check(process.cwd());
const identity=item=>JSON.stringify([item.code,item.path,item.sourceLine]);
const bag=new Map();for(const item of baseline.diagnostics){const key=identity(item);bag.set(key,(bag.get(key)??0)+1);}
const introduced=[];for(const item of current.diagnostics){const key=identity(item),count=bag.get(key)??0;if(count)bag.set(key,count-1);else introduced.push(item);}
const receipt={baselineSha:'14377d3247be0a57dcb42238b9ef9a85cce58fff',baseline,current,newErrors:introduced.length,introduced,
 pass:baseline.diagnostics.length>0&&introduced.length===0,note:'Broad legacy check is not clean; this receipt tests zero NEW Deno errors without suppressing them.'};
writeFileSync('qa/canonical-evidence-maxxis/deno-baseline-comparison.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({baselineErrors:baseline.diagnostics.length,currentErrors:current.diagnostics.length,newErrors:introduced.length,pass:receipt.pass}));
if(!receipt.pass)process.exitCode=1;
