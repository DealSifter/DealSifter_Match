import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
const run=promisify(execFile); const workspace=process.cwd();
const stage=resolve(workspace,'.cache/map-navigation-release');
await mkdir(stage,{recursive:true});
const {stdout:baseline}=await run('git',['rev-parse','HEAD'],{cwd:workspace});
const archive=resolve(workspace,'.cache/map-navigation-release.tar');
await run('git',['archive','--format=tar',`--output=${archive}`,'HEAD','src','public','supabase/functions/_shared','index.html','vite.config.js','package.json','scripts/check-build-env.mjs','tsconfig.contracts.json'],{cwd:workspace});
await run('tar',['-xf',archive,'-C',stage],{cwd:workspace});
const delta=['src/features/parcel/mapSelectionCamera.js','src/features/parcel/mapSelectionCamera.test.js','src/components/map/MapSelectionCamera.jsx','src/features/parcel/mapLifetime.js','src/features/parcel/mapLifetime.test.js','src/pages/MapView.jsx'];
for(const file of delta)await copyFile(resolve(workspace,file),resolve(stage,file));
const env={...process.env,...loadEnv('production',workspace,'VITE_'),VITE_APP_RELEASE:'local'};
const startedAt=new Date().toISOString();
try {
  await run(process.execPath,[resolve(stage,'scripts/check-build-env.mjs')],{cwd:stage,env,maxBuffer:1024*1024});
  const result=await run(process.execPath,[resolve(workspace,'node_modules/vite/bin/vite.js'),'build','--config',resolve(stage,'vite.config.js')],{cwd:stage,env,maxBuffer:8*1024*1024});
  await writeFile(resolve(workspace,'qa/map-navigation-cleanup/build.log'),result.stdout+'\n'+result.stderr);
  await writeFile(resolve(workspace,'qa/map-navigation-cleanup/build.json'),JSON.stringify({pass:true,startedAt,finishedAt:new Date().toISOString(),baseline:baseline.trim(),delta,mode:'ISOLATED_BASELINE_PLUS_MAP_FIX_ONLY',modernAndLegacy:true,sentryUpload:false},null,2)+'\n');
  console.log('ISOLATED_MAP_RELEASE_BUILD_PASS');
}catch(error){
  await writeFile(resolve(workspace,'qa/map-navigation-cleanup/build.log'),String(error.stdout||'')+'\n'+String(error.stderr||error.message));
  throw new Error('ISOLATED_MAP_RELEASE_BUILD_FAILED',{cause:error});
}
