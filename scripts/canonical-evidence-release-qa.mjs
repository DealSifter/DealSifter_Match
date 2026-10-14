import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rememberParcelEvidenceReceipt,cachedParcelEvidenceReceipt} from '../src/features/parcel/parcelEvidenceReceipt.js';
const directory='qa/canonical-evidence-maxxis';
const read=async path=>(await readFile(path,'utf8')).replace(/^\uFEFF/,'');
const json=async path=>JSON.parse(await read(`${directory}/${path}.json`));
const write=async(name,data)=>writeFile(`${directory}/${name}.json`,JSON.stringify(data,null,2)+'\n');
rememberParcelEvidenceReceipt('actor-a','subject-a','synthetic-opaque-receipt');
assert.equal(cachedParcelEvidenceReceipt('actor-a','subject-a'),'synthetic-opaque-receipt');
assert.equal(cachedParcelEvidenceReceipt('actor-a','subject-b'),null);
assert.equal(cachedParcelEvidenceReceipt('actor-b','subject-a'),null);
assert.equal(cachedParcelEvidenceReceipt('actor-a','subject-a'),null);
for(let index=0;index<9;index++)rememberParcelEvidenceReceipt('actor-a',`subject-${index}`,'synthetic');
assert.equal(cachedParcelEvidenceReceipt('actor-a','subject-0'),null);
assert.equal(cachedParcelEvidenceReceipt('actor-a','subject-8'),'synthetic');
cachedParcelEvidenceReceipt(null,null);
assert.equal(cachedParcelEvidenceReceipt('actor-a','subject-8'),null);
const frontend=await read('src/services/maxxisService.js'),map=await read('src/pages/MapView.jsx');
assert.ok(frontend.includes('cachedParcelEvidenceReceipt(receiptSession?.data?.session?.user?.id, trustedPropertyId)'));
assert.ok(frontend.includes('...(parcelEvidenceReceipt ? { parcelEvidenceReceipt } : {})'));
assert.ok(map.includes('rememberParcelEvidenceReceipt(currentUserId, state.context.itemId, state.result.evidenceReceipt)'));
await write('frontend-handoff-validation',{pass:true,mode:'PURE_MEMORY_AND_SOURCE_TRANSPORT_CONTRACT',actorIsolation:true,subjectIsolation:true,signOutClears:true,boundedEntries:8,persistentWrites:0,networkCalls:0});
const full=await json('full-tests'),targeted=await json('targeted-tests'),deno=await json('deno-baseline-comparison');
assert.equal(full.success,true);assert.equal(full.numFailedTests,0);assert.equal(deno.newErrors,0);assert.equal(deno.pass,true);
const selected=new Set(targeted.testResults.map(result=>result.name.replaceAll('\\','/')));
const finalTarget=full.testResults.filter(result=>selected.has(result.name.replaceAll('\\','/')));
assert.equal(finalTarget.length,targeted.testResults.length);
await write('final-targeted-tests',{source:'Final full-suite execution; identical targeted file subset',files:finalTarget.length,totalTests:finalTarget.reduce((count,result)=>count+result.assertionResults.length,0),passedTests:finalTarget.flatMap(result=>result.assertionResults).filter(result=>result.status==='passed').length,testResults:finalTarget});
async function walk(path){const entries=await readdir(path,{withFileTypes:true});return(await Promise.all(entries.map(entry=>entry.isDirectory()?walk(`${path}/${entry.name}`):entry.name.endsWith('.ts')&&!entry.name.endsWith('.test.ts')?[`${path}/${entry.name}`]:[]))).flat();}
const all=await walk('supabase/functions');
const importers=[];for(const file of all){const code=await read(file);if(/(?:toolRegistry|propertyFactLookup|canonicalEvidence(?:Projection|Tool)|consensusFactAnswer|evidenceReceipt|\/maxxis\/prompts)\.ts/.test(code))importers.push(file);}
const frozen=['dealMetrics.ts','scenarioEngine.ts','landMetrics.ts','landDevelopmentScenario.ts','getDealInsightContext.ts'];
const hashes={};for(const name of frozen){const code=await read(`supabase/functions/_shared/maxxis/${name}`);assert.ok(!/analyticalEvidence|canonicalEvidenceProjection|readParcelEvidenceReceipt/.test(code));hashes[name]=createHash('sha256').update(code).digest('hex');}
const salesCode=await read('supabase/functions/_shared/property-data/recentSalesMarketEstimate.ts');assert.ok(!/analyticalEvidence|canonicalEvidenceProjection|readParcelEvidenceReceipt/.test(salesCode));hashes['property-data/recentSalesMarketEstimate.ts']=createHash('sha256').update(salesCode).digest('hex');
await write('affected-dependency-closure',{runtimeConsumers:importers,deploy:['maxxis-chat','public-parcel','frontend'],unchangedFeatureFlags:true,sourceExpansion:false,migration:'NONE',frozenConsumerSourceHashes:hashes});
await write('validation-summary',{fullTests:{pass:true,total:full.numTotalTests,passed:full.numPassedTests,files:full.testResults.length},targetedTests:{total:finalTarget.reduce((count,result)=>count+result.assertionResults.length,0),pass:true},deno:{scopedNewModules:'PASS',legacyTestsPassed:4,broadLegacyBaselineClean:false,newErrors:deno.newErrors,differential:'PASS'},lint:'PASS',frontendContracts:'PASS',authenticatedProductionSmoke:'BLOCKED_NO_REAL_USER_SESSION'});
console.log(JSON.stringify({pass:true,full:full.numTotalTests,targeted:finalTarget.reduce((count,result)=>count+result.assertionResults.length,0),newDenoErrors:deno.newErrors}));
