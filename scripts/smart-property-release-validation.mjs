import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,copyFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {loadEnv} from 'vite';
const run=promisify(execFile),workspace=process.cwd(),stage=resolve('.cache/smart-property-release'),directory=process.env.SMART_PROPERTY_QA_DIRECTORY||'qa/smart-property-enrichment/final-integration';
await mkdir(stage,{recursive:true});await mkdir(directory,{recursive:true});
const git=async(...args)=>(await run('git',args,{maxBuffer:4*1024*1024})).stdout.trim();
const baseline=await git('rev-parse','HEAD'),archive=resolve('.cache/smart-property-release.tar');
await run('git',['archive','--format=tar',`--output=${archive}`,'HEAD','src','public','supabase/functions/_shared','index.html','vite.config.js','package.json','scripts/check-build-env.mjs']);
await run('tar',['-xf',archive,'-C',stage]);
const scope=['src','supabase/functions/_shared'];
const delta=[...new Set([...(await git('diff','--name-only','--',...scope)).split('\n'),...(await git('ls-files','--others','--exclude-standard','--',...scope)).split('\n')])].filter(Boolean);
for(const file of delta){await mkdir(dirname(resolve(stage,file)),{recursive:true});await copyFile(resolve(workspace,file),resolve(stage,file));}
const env={...process.env,...loadEnv('production',workspace,'VITE_'),VITE_APP_RELEASE:'local'},startedAt=new Date().toISOString();
try{
 await run(process.execPath,[resolve(stage,'scripts/check-build-env.mjs')],{cwd:stage,env});
 const build=await run(process.execPath,[resolve(workspace,'node_modules/vite/bin/vite.js'),'build'],{cwd:stage,env,maxBuffer:8*1024*1024});
 await writeFile(`${directory}/build.log`,build.stdout+'\n'+build.stderr);
 await writeFile(`${directory}/build.json`,JSON.stringify({pass:true,baseline,delta,startedAt,finishedAt:new Date().toISOString(),modernAndLegacy:true,sentryUpload:false,mode:'COMPLETE_CURRENT_INTEGRATION_ISOLATED_BUILD'},null,2)+'\n');console.log('SMART_PROPERTY_INTEGRATION_BUILD_PASS');
}catch(error){await writeFile(`${directory}/build.log`,String(error.stdout||'')+'\n'+String(error.stderr||error.message));throw error;}
