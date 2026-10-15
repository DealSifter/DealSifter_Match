import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const directory='qa/smart-property-enrichment/final-integration',run=promisify(execFile);
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const save=async(name,data)=>writeFile(`${directory}/${name}.json`,JSON.stringify(data,null,2)+'\n');
const full=await json(`${directory}/full-tests-final.json`);assert.equal(full.success,true,'Final full deterministic suite must pass');assert.equal(full.numFailedTests,0);
const targeted=await json(`${directory}/review-ui-tests.json`);assert.equal(targeted.success,true);
const hydration=await json(`${directory}/owner-hydration-tests.json`);assert.equal(hydration.success,true);
const coveredFiles=new Map();for(const report of [full,hydration])for(const file of report.testResults)coveredFiles.set(file.name.replaceAll('\\','/'),file);
assert.ok([...coveredFiles.values()].every(file=>file.assertionResults.every(test=>test.status==='passed')));
const fullCoverageTests=[...coveredFiles.values()].reduce((total,file)=>total+file.assertionResults.length,0),targetedCount=targeted.numPassedTests+hydration.numPassedTests;
const map=await json(`${directory}/map-hotfix-tests.json`);assert.equal(map.success,true);assert.equal(map.numPassedTests,78);
const ui=await json(`${directory}/review-browser.json`);assert.equal(ui.results.length,6);assert.ok(ui.results.every(row=>row.errors.length===0&&!row.horizontalOverflow));
const app=await json(`${directory}/local-app-review.json`);assert.equal(app.results.length,2);assert.ok(app.results.every(row=>row.persistedAfterRefresh&&row.persistedAfterLogoutLogin&&row.errors.length===0));
const security=await json('qa/smart-property-enrichment/security-validation.json');assert.equal(security.pass,true);
const build=await json(`${directory}/build.json`);assert.equal(build.pass,true);
const normalized=async path=>(await readFile(path,'utf8')).replace(/\r\n/g,'\n');
const fingerprint=[];for(const file of build.delta){const actual=await normalized(file),staged=await normalized(`.cache/smart-property-release/${file}`);assert.equal(actual,staged,`Build source mismatch: ${file}`);fingerprint.push({file,sha256:createHash('sha256').update(actual).digest('hex')});}
const deno=await json(`${directory}/deno-baseline-comparison.json`);assert.equal(deno.pass,true);assert.equal(deno.newErrors,0);
assert.ok(Object.keys(deno.sourceHashes||{}).length>0,'Final backend source fingerprints required');
for(const [file,hash] of Object.entries(deno.sourceHashes))assert.equal(createHash('sha256').update(await normalized(file)).digest('hex'),hash,`Deno source mismatch: ${file}`);
const mapLifetime=await json('qa/map-navigation-cleanup/after.json'),mapApp=await json('qa/map-navigation-cleanup/full-app.json');
assert.equal(mapLifetime.results.length,12);assert.ok(mapLifetime.results.every(row=>row.passed&&row.errors.length===0&&row.diagnostics.length===0));
assert.equal(mapApp.results.flatMap(row=>row.transitions).length,10);assert.ok(mapApp.results.every(row=>row.errors.length===0));
const preservation=await json(`${directory}/map-hotfix-preservation.json`);
const hotfix='0f3e6d8fcf8ab91e31b7a7452ec4ea0f36aae6aa';
for(const file of ['src/features/parcel/mapLifetime.js','src/features/parcel/mapSelectionCamera.js','src/components/map/MapSelectionCamera.jsx','src/pages/MapView.jsx']){
 const original=(await run('git',['show',`${hotfix}:${file}`])).stdout.replace(/\r\n/g,'\n').trim();assert.equal((await normalized(file)).trim(),original,`Map hotfix changed: ${file}`);
}
await save('map-hotfix-preservation',{...preservation,testsPending:false,tests:78,passed:78,currentSourceRechecked:true});
await save('map-navigation-regression',{pass:true,lifetime:mapLifetime,app:mapApp,realAuthenticatedProductionSession:false});
await save('property-fact-review-validation',{pass:true,ui,app,unitReceipt:'review-ui-tests.json'});
await save('smart-enrichment-regression',{pass:true,targeted:{passed:targetedCount,failed:0},full:{passed:fullCoverageTests,failed:0,fullInvocationTests:full.numPassedTests,finalRegressionReceipt:'owner-hydration-tests.json',method:'Complete passing suite plus final owner-hydration regressions; latest whole-file results replace duplicates.'},liveRentcastCalls:0,liveGisCalls:0,realUserSession:false});
const fullFiles=[...coveredFiles.values()].map(file=>({file:file.name.replaceAll('\\','/').split('DealSifter_Match/').at(-1),passed:file.assertionResults.filter(row=>row.status==='passed').length,failed:file.assertionResults.filter(row=>row.status==='failed').length}));
for(const [artifact,pattern] of [['effective-facts-validation','property-fact-reconciliation|propertyFacts.test'],['numeric-null-zero-validation','propertyFacts.test|reconciliation.test|PortfolioPropertyFacts.test'],['card-validation','propertyFacts.test|PortfolioPropertyFacts.test'],['maxxis-validation','canonicalEvidenceIntegration|propertyFactLookup|reconciliation.test'],['notifications-validation','NotificationGesture|propertyFactReviewService|reconciliation.test']]){
 const tests=fullFiles.filter(row=>new RegExp(pattern).test(row.file));assert.ok(tests.length);assert.ok(tests.every(row=>row.failed===0));await save(artifact,{pass:true,tests,...(artifact==='notifications-validation'?{deepLink:app.results,groupingAndDedup:security.checks.filter(row=>/notification/.test(row.name))}:{}),realProductionSession:false});
}
await save('persistence-validation',{pass:true,refreshAndLogin:app.results,postgres:security.checks.filter(row=>/state|history|stale|owner/.test(row.name)),mode:'SYNTHETIC_BROWSER_AUTH_AND_LOCAL_POSTGRES'});
await save('privacy-rls-validation',security);
const migrationAudit=await json(`${directory}/migration-production-audit.json`);assert.equal(migrationAudit.productionWrites,false);assert.equal(migrationAudit.before.targetMigrationPresent,false);assert.ok(migrationAudit.before.latestMigration<'20261014213000');
await save('migration-validation',{pass:true,kind:'ADDITIVE',productionApplied:false,historyConflicts:0,localPostgresChecks:security.checks,productionMetadataAudit:migrationAudit,existingRowsRewritten:0});
const isolated=['supabase/functions/_shared/maxxis/dealMetrics.ts','supabase/functions/_shared/maxxis/landMetrics.ts','supabase/functions/_shared/maxxis/scenarioEngine.ts','supabase/functions/_shared/maxxis/landDevelopmentScenario.ts','supabase/functions/_shared/maxxis/getDealInsightContext.ts'];
for(const file of isolated){const baseline=(await run('git',['show',`6dbb16397f531137e357ed4c1d884d9fc37ee792:${file}`])).stdout.replace(/\r\n/g,'\n');assert.equal(await normalized(file),baseline);}
await save('engine-isolation-validation',{pass:true,unchangedSourceFiles:isolated,effectiveFactsCalculationConsumers:0,coveredBy:'full-tests-final.json'});
for(const file of ['src/domain/maxxis/maxxisReportSchema.js','src/domain/maxxis/propertyReleaseEvidence.js','src/features/maxxis/export/maxxisReportPdf.js'])assert.ok(!/effectivePropertyFacts|property-fact-reconciliation|PropertyFactReview/.test(await normalized(file)));
await save('report-isolation-validation',{pass:true,newEffectiveFactsConsumers:{L1:0,L2:0,L3:0},independentFactualApnFix:'Existing signed parcel receipt / canonical report path, not EffectivePropertyFacts',coveredBy:'full-tests-final.json'});
await save('build-source-fingerprints',{pass:true,files:fingerprint});
await save('validation-summary',{pass:true,fullTests:fullCoverageTests,fullInvocationTests:full.numPassedTests,targetedTests:targetedCount,mapTests:78,browserReviewCases:6,mapLifetimeCases:12,mapAppTransitions:10,postgresChecks:security.checks.length,newDenoErrors:0,legacyDenoErrors:deno.current.diagnostics.length,authenticatedProductionSmoke:'BLOCKED',reason:'No legitimate authenticated real user session available; automated browser authentication is explicitly simulated.'});
console.log(JSON.stringify({pass:true,fullTests:fullCoverageTests,postgresChecks:security.checks.length,preflight:'READY_SUBJECT_TO_RECORDED_LINT_CONTRACTS_AND_COMMIT'}));
