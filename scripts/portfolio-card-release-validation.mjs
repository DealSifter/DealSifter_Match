import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
const run=promisify(execFile),workspace=process.cwd(),stage=resolve(workspace,'.cache/portfolio-card-release');
const directory=process.env.PORTFOLIO_QA_DIRECTORY||'qa/portfolio-card-labels';
await mkdir(stage,{recursive:true});await mkdir(directory,{recursive:true});
const {stdout:baseline}=await run('git',['rev-parse','HEAD']);
const archive=resolve(workspace,'.cache/portfolio-card-release.tar');
await run('git',['archive','--format=tar',`--output=${archive}`,'HEAD','src','public','supabase/functions/_shared','index.html','vite.config.js','package.json','scripts/check-build-env.mjs']);
await run('tar',['-xf',archive,'-C',stage]);
const delta=['src/components/matches/MatchesPortfolio.jsx','src/components/matches/PortfolioPropertyFacts.jsx','src/components/matches/PortfolioPropertyFacts.css','src/components/matches/portfolioPropertyFactsModel.js','src/components/matches/PortfolioPropertyFacts.test.jsx','src/components/matches/propertyReleaseExport.test.js','src/i18n/translations.js'];
for(const file of delta)await copyFile(resolve(workspace,file),resolve(stage,file));
const env={...process.env,...loadEnv('production',workspace,'VITE_'),VITE_APP_RELEASE:'local'},startedAt=new Date().toISOString();
try{
  await run(process.execPath,[resolve(stage,'scripts/check-build-env.mjs')],{cwd:stage,env});
  const build=await run(process.execPath,[resolve(workspace,'node_modules/vite/bin/vite.js'),'build'],{cwd:stage,env,maxBuffer:8*1024*1024});
  await writeFile(`${directory}/build.log`,build.stdout+'\n'+build.stderr);
  await writeFile(`${directory}/build.json`,JSON.stringify({pass:true,baseline:baseline.trim(),delta,startedAt,finishedAt:new Date().toISOString(),modernAndLegacy:true,sentryUpload:false,unrelatedEnrichmentChangesExcluded:true},null,2)+'\n');console.log('ISOLATED_PORTFOLIO_RELEASE_BUILD_PASS');
}catch(error){await writeFile(`${directory}/build.log`,String(error.stdout||'')+'\n'+String(error.stderr||error.message));throw error;}
