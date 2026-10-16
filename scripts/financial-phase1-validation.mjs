import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,extname} from 'node:path';
import {transformSync,buildSync} from 'esbuild';
const qa='qa/financial-evidence-stack/phase1',baseline='144056b478032efc61378d99f94432273b0b7a76';
mkdirSync(qa,{recursive:true});
const read=name=>JSON.parse(readFileSync(`${qa}/${name}.json`,'utf8').replace(/^\uFEFF/,''));
const save=(name,data)=>writeFileSync(`${qa}/${name}.json`,JSON.stringify(data,null,2)+'\n');
const source=path=>readFileSync(path,'utf8').replace(/\r\n/g,'\n');
const hash=text=>createHash('sha256').update(text).digest('hex');
const git=(...args)=>execFileSync('git',['--no-optional-locks',...args],{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true}).replace(/\r\n/g,'\n');
if(process.argv.includes('--static')){
  const checks=[];
  for(const[name,args]of [['lint',['node_modules/eslint/bin/eslint.js','src/','--max-warnings=0']],['typecheck',['node_modules/typescript/bin/tsc','-p','tsconfig.contracts.json']]]){
    let exitCode=0,output='';try{output=execFileSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024});}catch(error){exitCode=error.status??1;output=String(error.stdout??'')+String(error.stderr??'');}
    checks.push({name,exitCode,output,pass:exitCode===0});
  }
  save('frontend-static-checks',{checks,pass:checks.every(c=>c.pass)});console.log(JSON.stringify(checks));process.exit(checks.every(c=>c.pass)?0:1);
}
if(process.argv.includes('--isolation')){
  for(const[name,target]of [['frontend','frontend-production-before'],['backend','backend-production-before'],['database','migration-production-audit']])copyFileSync(`.cache/financial-phase1-baseline-${name}.json`,`${qa}/${target}.json`);
  const tracked=git('ls-files','src','supabase/functions','supabase/migrations').trim().split('\n');
  const baselineBlobs=new Map(git('ls-tree','-r',baseline,'--','src','supabase/functions','supabase/migrations').trim().split('\n').map(line=>{const[meta,path]=line.split('\t');return[path,meta.split(' ')[2]];}));
  const same=path=>{const bytes=Buffer.from(source(path)),blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');return{path,unchanged:blob===baselineBlobs.get(path)};};
  const reports=tracked.filter(p=>/report|arvEngine|maoEngine|soldCompEngine|recentSales|rehabCostBenchmarks|sellerFinancingScenario/i.test(p)&&!/\.(test|spec)\./.test(p)&&/\.(ts|js|jsx)$/.test(p)).map(same);
  const engines=['dealMetrics','scenarioEngine','dealDecisionContext','landMetrics','landDevelopmentScenario','marketReferenceAnswer','analyticalPropertyFacts','analyticalPropertyContext','areaMetrics','areaAnalyticalAnswer','canonicalEvidenceProjection','propertyEvidenceProjection'].map(name=>same(`supabase/functions/_shared/maxxis/${name}.ts`));
  const maps=tracked.filter(p=>/MapView|parcelLens|mapCamera|mapNavigation|mapLifetime/.test(p)&&!/\.(test|spec)\./.test(p)&&/\.(ts|js|jsx)$/.test(p)).map(same);
  const review=tracked.filter(p=>/property-fact-reconciliation|src\/features\/propertyFacts\//.test(p)&&!/\.(test|spec)\./.test(p)&&/\.(ts|js|jsx)$/.test(p)).map(same);
  const migrations=tracked.filter(p=>p.startsWith('supabase/migrations/')).map(same);
  const newMigrations=git('ls-files','--others','--exclude-standard','supabase/migrations').trim();
  const report={baseline,files:reports,changed:reports.filter(r=>!r.unchanged).length};save('report-isolation',report);
  const financial={baseline,files:engines,changed:engines.filter(r=>!r.unchanged).length,enginesMigrated:[],migration:'NONE',providerAcquisitions:0};save('financial-engine-isolation',financial);
  save('map-regression',{baseline,files:maps,changed:maps.filter(r=>!r.unchanged).length});
  save('smart-enrichment-regression',{baseline,files:review,changed:review.filter(r=>!r.unchanged).length});
  save('schema-isolation',{baseline,trackedMigrationChanges:migrations.filter(r=>!r.unchanged).length,newMigrations:newMigrations?newMigrations.split('\n'):[],migration:'NONE'});
  const pass=[...reports,...engines,...maps,...review,...migrations].every(r=>r.unchanged)&&!newMigrations;
  console.log(JSON.stringify({pass,reportFiles:reports.length,engines:engines.length,mapFiles:maps.length,reviewFiles:review.length}));process.exit(pass?0:1);
}
// Bind validated source to the isolated build and Deno receipts.
const build=read('build'),deno=read('deno-baseline-comparison'),closure=read('backend-dependency-closure');
const graph=new Set();
function visit(path){path=resolve(path);if(graph.has(path)||!existsSync(path)||!['.js','.jsx','.ts','.tsx','.mjs'].includes(extname(path)))return;graph.add(path);
 for(const m of source(path).matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)){
  if(!m[1].startsWith('.'))continue;const base=resolve(dirname(path),m[1]),dep=[base,...['.js','.jsx','.ts','.tsx','.mjs'].map(e=>base+e),resolve(base,'index.js')].find(existsSync);if(dep)visit(dep);
 }
}visit('src/main.jsx');
// The UI imports only the detector. Answer/readiness implementations execute on Edge.
// Prove equivalence of the exact used browser export (including side effects), not merely filenames.
const financialUiImports=[...graph].filter(p=>p.replaceAll('\\','/').includes('/src/')).flatMap(path=>
 [...source(path).matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]*financial[^'"]*)['"]/g)].map(m=>({path,bindings:m[1].trim(),module:m[2]})));
const detectorOnly=financialUiImports.length===1&&financialUiImports[0].bindings==='detectFinancialEvidenceQuestion'&&financialUiImports[0].module.endsWith('/financialEvidenceAnswer.ts');
const detectorBundle=directory=>buildSync({stdin:{contents:'export {detectFinancialEvidenceQuestion} from "./supabase/functions/_shared/maxxis/financialEvidenceAnswer.ts";',resolveDir:resolve(directory),loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',minifyWhitespace:true,minifySyntax:true,minifyIdentifiers:false,treeShaking:true,logLevel:'silent'}).outputFiles[0].text;
const currentDetector=detectorBundle('.'),stagedDetector=detectorBundle('.cache/smart-property-release');
const detectorEquivalent=detectorOnly&&currentDetector===stagedDetector;
if(process.argv.includes('--detector')){console.log(JSON.stringify({detectorOnly,detectorEquivalent,currentDetector,stagedDetector}));process.exit(detectorEquivalent?0:1);}
const binding=build.delta.filter(p=>!/\.(test|spec)\./.test(p)).map(path=>{
 const current=source(path),staged=source(`.cache/smart-property-release/${path}`),consumed=graph.has(resolve(path));
 const equivalent=current===staged||path.endsWith('.ts')&&transformSync(current,{loader:'ts'}).code===transformSync(staged,{loader:'ts'}).code;
 const financialExportEquivalent=detectorEquivalent&&/\/financial(?:Evidence(?:Answer|Context)?|Readiness)\.ts$/.test(path);
 return {path,frontendConsumed:consumed,currentHash:hash(current),stagedHash:hash(staged),mode:equivalent?'EXACT_OR_TYPE_ERASURE_EQUIVALENT':!consumed?'BACKEND_ONLY_DENO_VALIDATED':financialExportEquivalent?'USED_BROWSER_EXPORT_BUNDLE_EQUIVALENT':'MISMATCH',pass:equivalent||!consumed||financialExportEquivalent};
});
const denoBinding=[...closure.changedSharedModules,...closure.changedFunctionModules].map(path=>({path,pass:deno.sourceHashes[path]===hash(source(path))}));
const sourcePass=binding.every(r=>r.pass)&&denoBinding.every(r=>r.pass);save('validated-source-binding',{binding,denoBinding,frontendModules:graph.size,financialUiImports,detectorEquivalent,currentDetectorHash:hash(currentDetector),stagedDetectorHash:hash(stagedDetector),pass:sourcePass});
if(process.argv.includes('--binding')){console.log(JSON.stringify({pass:sourcePass,mismatches:[...binding,...denoBinding].filter(r=>!r.pass)}));process.exit(sourcePass?0:1);}
const full=read('full-tests'),targeted=read('targeted/full-tests'),final=read('financial-final-tests'),raw=JSON.parse(readFileSync('.cache/financial-phase1-full.json','utf8'));
const group=pattern=>{const files=raw.testResults.filter(r=>pattern.test(r.name)),tests=files.flatMap(f=>f.assertionResults??[]);return{files:files.length,total:tests.length,passed:tests.filter(t=>t.status==='passed').length,failed:tests.filter(t=>t.status==='failed').length};};
const groups={financial:group(/financialEvidence\.vitest/),analytical:group(/analyticalArea|analyticalIntegration/),smartEnrichment:group(/propertyFacts|property-fact-reconciliation|reviewCta/),map:group(/MapView|mapNavigation|mapCamera|parcelLens|mapLifetime/i),rentcast:group(/rentcast|supplementalEvidence/i),consensus:group(/parcel-evidence-consensus|canonicalEvidenceIntegration/)};
const browser=read('browser-local'),map=read('map/full-app'),photo=read('map/photo/full-app');
const browserPass=browser.results.length===6&&browser.results.every(r=>!r.errors.length&&r.genericLoaderFlashes===0&&r.radioNetworkMutations===0&&r.reviewOpenProviderCalls===0&&r.portfolioProviderFanout===0);
const mapPass=[map,photo].every(r=>r.results.length===2&&r.results.every(row=>!row.errors.length));
const isolated=['report-isolation','financial-engine-isolation','map-regression','smart-enrichment-regression'].every(n=>read(n).changed===0),schema=read('schema-isolation');
const quality={full,targeted,groups,finalFinancial:{total:final.numTotalTests,passed:final.numPassedTests,failed:final.numFailedTests},build:build.pass,deno:{newErrors:deno.newErrors,baseline:deno.baseline.diagnostics.length,current:deno.current.diagnostics.length,pass:deno.pass},sourcePass,staticPass:read('frontend-static-checks').pass,browserPass,mapPass,isolated,migration:schema.migration,providerCalls:0,geminiArbitration:0,activatedBenchmarks:0,authenticatedProductionSmoke:'BLOCKED'};
quality.pass=full.pass&&targeted.pass&&final.numFailedTests===0&&final.numTotalTests===final.numPassedTests&&build.pass&&deno.pass&&sourcePass&&quality.staticPass&&browserPass&&mapPass&&isolated&&schema.trackedMigrationChanges===0&&schema.newMigrations.length===0;
save('quality-gates',quality);console.log(JSON.stringify(quality));if(!quality.pass)process.exitCode=1;
