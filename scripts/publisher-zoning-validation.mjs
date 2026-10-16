import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const run=promisify(execFile),directory='qa/publisher-zoning-match';await mkdir(directory,{recursive:true});
// Preserve historical tracked QA outputs (including the user's six pre-existing changes).
const paths=(await run('git',['ls-files','qa'],{maxBuffer:4*1024*1024})).stdout.trim().split(/\r?\n/).filter(path=>/\.(json|csv|md)$/.test(path));
const saved=await Promise.all(paths.map(async path=>[path,await readFile(path)]));
const startedAt=new Date().toISOString();let exitCode=0;
try{await run(process.execPath,['node_modules/vitest/vitest.mjs','run','--config','vitest.p0.config.mjs','--pool=threads','--maxWorkers=2','--reporter=json','--outputFile=.cache/publisher-zoning-full.json'],{maxBuffer:32*1024*1024});}
catch(error){exitCode=error.code||1;await writeFile('.cache/publisher-zoning-full.log',String(error.stdout||'')+'\n'+String(error.stderr||error.message));}
finally{for(const[path,buffer]of saved)await writeFile(path,buffer);}
const result=JSON.parse(await readFile('.cache/publisher-zoning-full.json','utf8'));
const summary={startedAt,finishedAt:new Date().toISOString(),exitCode,total:result.numTotalTests,passed:result.numPassedTests,failed:result.numFailedTests,files:result.testResults.length,historicalQaPreserved:true,pass:exitCode===0&&result.numFailedTests===0};
await writeFile(`${directory}/full-tests.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));if(!summary.pass)process.exitCode=1;
