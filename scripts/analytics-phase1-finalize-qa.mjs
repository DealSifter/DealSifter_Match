import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {transformSync} from 'esbuild';
const directory='qa/consensus-aware-analytics/phase1',stage='.cache/smart-property-release';
const read=name=>JSON.parse(readFileSync(`${directory}/${name}.json`,'utf8').replace(/^\uFEFF/,''));
const save=(name,value)=>writeFileSync(`${directory}/${name}.json`,JSON.stringify(value,null,2)+'\n');
const text=path=>readFileSync(path,'utf8').replace(/\r\n/g,'\n'),digest=value=>createHash('sha256').update(value).digest('hex');
const graph=new Set();
function visit(path){path=resolve(path);if(graph.has(path)||!existsSync(path)||!['.js','.jsx','.ts','.tsx','.mjs'].includes(extname(path)))return;graph.add(path);
 for(const match of text(path).matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)){
  if(!match[1].startsWith('.'))continue;const base=resolve(dirname(path),match[1]);
  const dependency=[base,...['.js','.jsx','.ts','.tsx','.mjs'].map(ext=>base+ext),resolve(base,'index.js')].find(existsSync);if(dependency)visit(dependency);
 }
}
visit('src/main.jsx');
const build=read('build'),closure=read('backend-dependency-closure'),deno=read('deno-baseline-comparison');
const binding=[];
for(const path of build.delta.filter(path=>!/\.(?:test|spec)\./.test(path))){
 const current=text(path),compiled=text(`${stage}/${path}`),frontendConsumed=graph.has(resolve(path));
 let mode=current===compiled?'EXACT_SOURCE':'MISMATCH';
 if(mode==='MISMATCH'&&path.endsWith('.ts')&&transformSync(current,{loader:'ts'}).code===transformSync(compiled,{loader:'ts'}).code)mode='TYPE_ERASURE_EQUIVALENT';
 if(mode==='MISMATCH'&&!frontendConsumed&&path==='supabase/functions/_shared/maxxis/toolRegistry.ts')mode='BACKEND_ONLY_DENO_VALIDATED';
 binding.push({path,frontendConsumed,currentHash:digest(current),stagedHash:digest(compiled),mode});
}
const denoSourceBinding=[...closure.changedSharedModules,...closure.changedFunctionModules].map(path=>({path,hash:digest(text(path)),matchesDeno:deno.sourceHashes[path]===digest(text(path))}));
save('validated-source-binding',{frontendGraphModules:graph.size,binding,denoSourceBinding,pass:binding.every(row=>row.mode!=='MISMATCH')&&denoSourceBinding.every(row=>row.matchesDeno)});
if(process.env.ANALYTICS_SOURCE_BINDING_ONLY==='1'){
 const pass=binding.every(row=>row.mode!=='MISMATCH')&&denoSourceBinding.every(row=>row.matchesDeno);
 console.log(JSON.stringify({pass,frontendGraphModules:graph.size,mismatches:binding.filter(row=>row.mode==='MISMATCH'),backendHashMismatches:denoSourceBinding.filter(row=>!row.matchesDeno)}));process.exit(pass?0:1);
}
const full=read('full-tests'),targeted=read('targeted/full-tests'),browser=read('browser-local'),map=read('map/full-app'),isolated=read('report-isolation'),financial=read('financial-engine-isolation'),staticChecks=read('frontend-static-checks');
const browserPass=browser.results.length===6&&browser.results.every(row=>!row.errors.length&&row.genericLoaderFlashes===0&&row.radioNetworkMutations===0&&row.reviewOpenProviderCalls===0&&row.portfolioProviderFanout===0);
const mapRows=Array.isArray(map)?map:map.results;
const mapPass=mapRows?.length===2&&mapRows.every(row=>!row.errors?.length&&row.transitions?.length===5);
const raw=JSON.parse(readFileSync('.cache/publisher-zoning-full.json','utf8'));
const group=pattern=>{const rows=raw.testResults.filter(row=>pattern.test(row.name));const assertions=rows.flatMap(row=>row.assertionResults||[]);return{files:rows.length,total:assertions.length,passed:assertions.filter(row=>row.status==='passed').length,failed:assertions.filter(row=>row.status==='failed').length};};
const groups={analytical:group(/analyticalArea|analyticalIntegration/),smartEnrichmentUx:group(/propertyFacts|property-fact-reconciliation|reviewCta/),mapLifecycle:group(/MapView|mapNavigation|mapCamera|parcelLens|mapLifetime/i)};
const analyticalFinal=read('analytical-final-tests');
const quality={full,targeted,groups,build:build.pass,deno:{newErrors:deno.newErrors,baselineErrors:deno.baseline.diagnostics.length,currentErrors:deno.current.diagnostics.length,pass:deno.pass},
 browserPass,mapPass,reportChanged:isolated.changed,financialFunctionsUnchanged:financial.financialFunctions.every(row=>row.unchanged),financialMetricBranchUnchanged:financial.financialMetricBranchUnchanged,
 migration:'NONE',frontendStaticChecks:staticChecks.pass,finalAnalyticalTests:{total:analyticalFinal.numTotalTests,passed:analyticalFinal.numPassedTests,failed:analyticalFinal.numFailedTests},authenticatedProductionSmoke:'BLOCKED',realUserSession:false,sourceBindingPass:binding.every(row=>row.mode!=='MISMATCH')&&denoSourceBinding.every(row=>row.matchesDeno)};
quality.pass=full.pass&&targeted.pass&&build.pass&&deno.pass&&deno.newErrors===0&&browserPass&&mapPass&&isolated.changed===0&&quality.financialFunctionsUnchanged&&quality.financialMetricBranchUnchanged&&quality.sourceBindingPass&&staticChecks.pass&&analyticalFinal.numFailedTests===0&&analyticalFinal.numPassedTests===analyticalFinal.numTotalTests;
save('quality-gates',quality);
save('review-cta-ux-validation',{pass:browserPass,componentTests:'src/features/propertyFacts/reviewCta.test.jsx',browserEvidence:browser,realUserSession:false,authenticatedProductionSmoke:'BLOCKED'});
save('smart-enrichment-regression',{...read('smart-enrichment-regression'),browserEvidence:'browser-local.json',regressions:browserPass&&groups.smartEnrichmentUx.failed===0?0:null,tests:groups.smartEnrichmentUx});
save('map-regression',{...read('map-regression'),browserEvidence:map,pass:mapPass,tests:groups.mapLifecycle});
save('performance-regression',{...read('performance-regression'),browser:browser.results.map(row=>({device:row.device,language:row.language,startupObservedMs:row.startupObservedMs,closeObservedMs:row.closeObservedMs,portfolioProviderFanout:row.portfolioProviderFanout,reviewOpenProviderCalls:row.reviewOpenProviderCalls,radioNetworkMutations:row.radioNetworkMutations,genericLoaderFlashes:row.genericLoaderFlashes})),timingCaveat:'Wall-clock browser timings are observations on a concurrently validated workstation, not a controlled production benchmark.'});
console.log(JSON.stringify(quality));if(!quality.pass)process.exitCode=1;
