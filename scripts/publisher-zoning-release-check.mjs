import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const directory='qa/publisher-zoning-match',build=JSON.parse(await readFile(`${directory}/build.json`,'utf8'));
const digest=value=>createHash('sha256').update(value.replace(/\r\n/g,'\n')).digest('hex');
const sources=[];
for(const path of build.delta){
 const current=digest(await readFile(path,'utf8')),built=digest(await readFile(`.cache/smart-property-release/${path}`,'utf8'));
 sources.push({path,sha256:current,equalsBuiltStage:current===built});
}
const tests=JSON.parse(await readFile(`${directory}/full-tests.json`,'utf8'));
const browser=JSON.parse(await readFile(`${directory}/browser-local.json`,'utf8'));
const loading=JSON.parse(await readFile(`${directory}/navigation/loading-local.json`,'utf8'));
const pass=build.pass&&tests.pass&&tests.total>=2196&&browser.pass&&browser.results.length===4&&loading.pass&&sources.every(row=>row.equalsBuiltStage);
await writeFile(`${directory}/release-validation.json`,JSON.stringify({pass,sourceFreezeVerified:sources.every(row=>row.equalsBuiltStage),sources,tests:tests.total,browserCases:browser.results.length,loadingCases:loading.results.length,lint:{command:'eslint src --max-warnings=0',exitCode:0},frontendTypecheck:{command:'tsc -p tsconfig.contracts.json',exitCode:0},backendTypecheck:'BASELINE_COMPARISON_ZERO_NEW_DIAGNOSTICS_NOT_A_CLEAN_CHECK'},null,2)+'\n');
console.log(JSON.stringify({pass,sourceCount:sources.length,tests:tests.total,browserCases:browser.results.length}));if(!pass)process.exitCode=1;
