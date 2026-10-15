import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {copyFile,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const run=promisify(execFile),directory='qa/smart-property-enrichment/ux-stabilization';
// This QA output was already dirty before the task; preserve its exact bytes across the full suite.
const existing=resolve('qa/runtime-orchestration-hardening/land-state-persistence.json'),backup=resolve('.cache/ux-land-state-before.json');
await copyFile(existing,backup);const originalHash=createHash('sha256').update(await readFile(existing)).digest('hex');
let exitCode=0;const startedAt=new Date().toISOString();
try{await run(process.execPath,['node_modules/vitest/vitest.mjs','run','--config','vitest.p0.config.mjs','--pool=threads','--maxWorkers=2','--reporter=json','--outputFile=.cache/ux-full-tests.json'],{maxBuffer:32*1024*1024});}
catch(error){exitCode=error.code||1;await writeFile('.cache/ux-full-test-infrastructure.log',String(error.stdout||'')+'\n'+String(error.stderr||'')+'\n'+String(error.message||''));}
finally{await copyFile(backup,existing);}
const result=JSON.parse(await readFile('.cache/ux-full-tests.json','utf8'));
const groups={};for(const [name,pattern] of Object.entries({targeted:/propertyFacts|propertyFactReviewService|Onboarding.geocode/,reconciliation:/property-fact-reconciliation/,map:/mapLifetime|mapSelectionCamera|MapSelectionCamera|MapView/})){
 const tests=result.testResults.filter(file=>pattern.test(file.name)).flatMap(file=>file.assertionResults);groups[name]={total:tests.length,passed:tests.filter(test=>test.status==='passed').length};
}
const preserved=createHash('sha256').update(await readFile(existing)).digest('hex')===originalHash;
const summary={baseline:'8c5e57aa652c90084a937aa7044df29833112c6c',startedAt,finishedAt:new Date().toISOString(),exitCode,total:result.numTotalTests,passed:result.numPassedTests,failed:result.numFailedTests,files:result.testResults.length,suites:result.numTotalTestSuites,groups,userDirtyQaPreserved:preserved,failures:result.testResults.flatMap(file=>file.assertionResults.filter(test=>test.status==='failed').map(test=>({file:file.name.split('DealSifter_Match').at(-1),name:test.fullName}))),pass:exitCode===0&&result.numFailedTests===0&&preserved};
await writeFile(`${directory}/full-test-summary.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));if(!summary.pass)process.exitCode=1;
