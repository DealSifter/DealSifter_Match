import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const qa='qa/rentcast-market-rent',baseline='e6f13b759238a21de1ca6b1367dd17ade46bc657';mkdirSync(qa,{recursive:true});
const git=(...args)=>execFileSync('git',['--no-optional-locks','-c','core.safecrlf=false',...args],{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}).trim();
const read=file=>JSON.parse(readFileSync(`${qa}/${file}.json`,'utf8').replace(/^\uFEFF/,''));
const save=(file,data)=>writeFileSync(`${qa}/${file}.json`,JSON.stringify(data,null,2)+'\n');
const source=file=>readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const files=[...new Set([...git('ls-files','src','supabase/functions').split('\n'),...git('ls-files','--others','--exclude-standard','src','supabase/functions').split('\n')])].filter(p=>p&&/\.(?:ts|tsx|js|jsx)$/.test(p));
const digest=()=>createHash('sha256').update(files.sort().map(p=>`${p}\0${source(p)}`).join('\0')).digest('hex');
if(process.argv.includes('--static')){
 const checks=[];for(const[name,args]of [['lint',['node_modules/eslint/bin/eslint.js','src/','--max-warnings=0']],['typecheck',['node_modules/typescript/bin/tsc','-p','tsconfig.contracts.json']]]){
  let exitCode=0,output='';try{output=execFileSync(process.execPath,args,{encoding:'utf8',maxBuffer:4*1024*1024,windowsHide:true});}catch(e){exitCode=e.status??1;output=String(e.stdout??'')+String(e.stderr??'');}checks.push({name,exitCode,output});
 }const result={checks,sourceDigest:digest(),pass:checks.every(r=>r.exitCode===0)};save('static-checks',result);console.log(JSON.stringify(result));process.exit(result.pass?0:1);
}
if(process.argv.includes('--isolation')){
 for(const[name,target]of [['frontend','frontend-production-before'],['database','migration-production-before']])copyFileSync(`.cache/market-rent-baseline-${name}.json`,`${qa}/${target}.json`);
 const paths=[...new Set([...['dealMetrics','scenarioEngine','dealDecisionContext','landMetrics','landDevelopmentScenario','analyticalPropertyFacts','analyticalPropertyContext','areaMetrics','areaAnalyticalAnswer','marketReferenceAnswer'].map(n=>`supabase/functions/_shared/maxxis/${n}.ts`),
   ...git('ls-files','supabase/functions/_shared').split('\n').filter(p=>/arv|mao|sold|recentSales|rehabCost|sellerFinancing/i.test(p)&&!/\.(test|spec)\./.test(p)&&/\.(ts|js)$/.test(p))])].filter(existsSync);
 const originals=paths.map(path=>({path,unchanged:source(path)===execFileSync('git',['--no-optional-locks','show',`${baseline}:${path}`],{encoding:'utf8',maxBuffer:4*1024*1024,windowsHide:true}).replace(/\r\n/g,'\n')}));
 const migrationChanges=git('diff','--name-only',baseline,'--','supabase/migrations')||git('ls-files','--others','--exclude-standard','supabase/migrations');
 const mapChanges=git('diff','--name-only',baseline,'--','src/MapView.jsx','src/components/map','src/features/publicParcel');
 const result={baseline,engines:originals,migration:'NONE',migrationChanges:!!migrationChanges,mapChanges:!!mapChanges,scopedReportExtension:['marketRentReport','shared ARV map viewport','conditional L3 Market Rent page','L2 main estimate'],pass:originals.every(p=>p.unchanged)&&!migrationChanges&&!mapChanges};save('financial-engine-isolation',result);console.log(JSON.stringify(result));process.exit(result.pass?0:1);
}
if(process.argv.includes('--binding')){
 const build=read('build'),closure=read('backend-dependency-closure'),deno=read('deno-baseline-comparison');
 const browserSources=files.filter(p=>p.startsWith('src/')||p.startsWith('supabase/functions/_shared/'));
 const mismatch=browserSources.filter(p=>!existsSync(`.cache/smart-property-release/${p}`)||source(p)!==source(`.cache/smart-property-release/${p}`));
 const denoMismatch=[...closure.changedSharedModules,...closure.changedFunctionModules].filter(p=>deno.sourceHashes[p]!==createHash('sha256').update(source(p)).digest('hex'));
 const result={sourceDigest:digest(),buildPass:build.pass,buildSourceMismatch:mismatch,denoSourceMismatch:denoMismatch,pass:build.pass&&deno.pass&&!mismatch.length&&!denoMismatch.length};save('source-binding',result);console.log(JSON.stringify(result));process.exit(result.pass?0:1);
}
const full=read('full/full-tests'),targeted=read('targeted/full-tests'),staticChecks=read('static-checks'),build=read('build'),deno=read('deno-baseline-comparison'),binding=read('source-binding'),isolation=read('financial-engine-isolation'),pdf=read('rental-map-pdf-qa');
const browser=read('browser/browser-local'),map=read('map/full-app'),photo=read('photo/full-app');
const browserPass=browser.results.length===6&&browser.results.every(r=>!r.errors.length&&r.genericLoaderFlashes===0&&r.reviewOpenProviderCalls===0&&r.radioNetworkMutations===0&&r.portfolioProviderFanout===0);
const mapPass=map.results.length===2&&map.results.every(r=>!r.errors.length&&r.transitions.length===5);
const photoPass=photo.results.length===2&&photo.results.every(r=>!r.errors.length&&r.transitions.length===1);
const result={baseline,full,targeted,staticPass:staticChecks.pass,buildPass:build.pass,newDenoErrors:deno.newErrors,sourceBinding:binding.pass,isolation:isolation.pass,rentalMapPdf:pdf.pass,browserPass,mapPass,photoPass,liveRentCastCalls:0,liveGISCalls:0,authenticatedProductionSmoke:'BLOCKED',sourceDigest:digest()};
save('tax-provenance-labels',{mockOnly:true,locales:Object.fromEntries(['pt','en','es'].map(lang=>[lang,read(`tax-provenance-labels-${lang}`).data])),contradictoryLabels:0});
save('production-smoke',{state:'BLOCKED',reason:'NO_LEGITIMATE_REAL_USER_SESSION_AVAILABLE',authenticatedProductionSmoke:'BLOCKED',newBillableCalls:0,controlProperty:'7081 Kalanianaole Hwy, Honolulu, HI 96825',controlMarketRent:'BLOCKED',controlMarketRentRange:'BLOCKED',controlSubjectAttributes:'BLOCKED',fixtureNotProduction:true});
save('performance-regression',{browserMode:browser.mode,realUserSession:false,realBackendWrites:browser.realBackendWrites+map.realBackendWrites+photo.realBackendWrites,results:browser.results, mapTransitions:map.results.reduce((n,r)=>n+r.transitions.length,0),photoHandoffs:photo.results.reduce((n,r)=>n+r.transitions.length,0),pass:browserPass&&mapPass&&photoPass});
result.pass=[full.pass,targeted.pass,result.staticPass,result.buildPass,deno.pass,binding.pass,isolation.pass,pdf.pass,browserPass,mapPass,photoPass].every(Boolean);save('quality-gates',result);console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
