import {readFile,writeFile,readdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,relative,dirname} from 'node:path';
const directory='qa/smart-property-enrichment/ux-stabilization',baseline='8c5e57aa652c90084a937aa7044df29833112c6c';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const shared=['supabase/functions/_shared/property-fact-reconciliation/model.ts','supabase/functions/_shared/property-fact-reconciliation/runtime.ts','supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js'];
const changedFunctionModules=['supabase/functions/property-fact-review/index.ts'],changed=new Set([...shared,...changedFunctionModules].map(path=>resolve(path)));
const edges=new Map();
async function dependencies(file,seen=new Set()){
 if(seen.has(file))return seen;seen.add(file);
 let imports=edges.get(file);if(!imports){let text='';try{text=await readFile(file,'utf8');}catch{return seen;}
  imports=[...text.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)].map(match=>match[1]).filter(path=>path.startsWith('.')).map(path=>resolve(dirname(file),path));edges.set(file,imports);
 }
 for(const next of imports)await dependencies(next,seen);return seen;
}
const functions=[];
for(const entry of await readdir('supabase/functions',{withFileTypes:true})){
 if(!entry.isDirectory()||entry.name.startsWith('_'))continue;const file=resolve(`supabase/functions/${entry.name}/index.ts`);if(!existsSync(file))continue;
 const deps=await dependencies(file),hits=[...changed].filter(path=>deps.has(path));if(hits.length)functions.push({function:entry.name,reasons:hits.map(path=>relative(process.cwd(),path).replaceAll('\\','/'))});
}
await writeFile(`${directory}/backend-dependency-closure.json`,JSON.stringify({baseline,changedSharedModules:shared,changedFunctionModules,affectedFunctions:functions,includesTypeOnlyEdges:true},null,2)+'\n');
const mapFiles=['src/features/parcel/mapLifetime.js','src/features/parcel/mapSelectionCamera.js','src/components/map/MapSelectionCamera.jsx','src/pages/MapView.jsx'];
const preserved=[];for(const path of mapFiles){const current=(await readFile(path,'utf8')).replaceAll('\r\n','\n').trim();preserved.push({path,unchanged:current===git('show',`${baseline}:${path}`)});}
if(preserved.some(row=>!row.unchanged))throw new Error('MAP_HOTFIX_DRIFT');
await writeFile(`${directory}/map-hotfix-source-preservation.json`,JSON.stringify({baseline,files:preserved,pass:true},null,2)+'\n');console.log(JSON.stringify({functions:functions.map(row=>row.function),mapHotfixPreserved:true}));
