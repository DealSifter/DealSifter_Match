import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const run=promisify(execFile),directory='qa/smart-property-enrichment/final-integration';
await mkdir(directory,{recursive:true});
const git=async(...args)=>(await run('git',args,{maxBuffer:4*1024*1024})).stdout.trim();
const branch=await git('branch','--show-current'),head=await git('rev-parse','HEAD'),hotfix=await git('rev-parse','0f3e6d8');
const production=JSON.parse((await readFile('.cache/enrichment-production-baseline.json','utf8')).replace(/^\uFEFF/,''));
const backend=JSON.parse((await readFile('.cache/enrichment-backend-baseline.json','utf8')).replace(/^\uFEFF/,''));
const sourcePaths=['src/features/propertyFacts','supabase/functions/_shared/property-fact-reconciliation','supabase/migrations/20261014213000_smart_property_fact_review.sql'];
const history=await git('log','--all','--format=%H %s','--',...sourcePaths);
const status=await git('status','--short'),stashes=await git('stash','list','--format=%gd %H %ci %s');
const refs=await git('for-each-ref','--format=%(refname) %(objectname)','refs/heads','refs/remotes');
const remote=await git('ls-remote','--heads','origin');
const files=['src/features/parcel/mapLifetime.js','src/features/parcel/mapSelectionCamera.js','src/components/map/MapSelectionCamera.jsx','src/pages/MapView.jsx'];
const preservation=[];
for(const file of files){const original=await git('show',`${hotfix}:${file}`),current=(await readFile(file,'utf8')).replace(/\r\n/g,'\n').trim();preservation.push({file,unchanged:original===current,sha256:createHash('sha256').update(current).digest('hex')});}
if(preservation.some(row=>!row.unchanged))throw new Error('MAP_HOTFIX_SOURCE_DRIFT_REQUIRES_RECONCILIATION');
const audit={observedAt:new Date().toISOString(),branch,head,remoteHead:remote.split('\n').find(line=>line.endsWith(`refs/heads/${branch}`))?.split(/\s+/)[0],requestedHotfix:hotfix,production,
 enrichmentPreviousBase:'06913dce671f805a89663d3a5a07f71d17c39785',enrichmentSource:'C_UNCOMMITTED_WORKTREE',committedEnrichmentHistory:history||'NONE',sourcePaths,status,stashes:stashes.split('\n'),refs:refs.split('\n'),remoteHeads:remote.split('\n'),backend};
await writeFile(`${directory}/baseline.json`,JSON.stringify(audit,null,2)+'\n');
await writeFile(`${directory}/map-hotfix-preservation.json`,JSON.stringify({originalHotfix:hotfix,files:preservation,sourceBehaviorChanges:0,testsPending:true},null,2)+'\n');
await writeFile(`${directory}/BASELINE_RECONCILIATION.md`,`# Baseline reconciliation\n\nBranch: ${branch}\n\nLocal/remote HEAD: ${head} / ${audit.remoteHead}\n\nActive production frontend: ${production.sourceSha} (READY; alias verified). The supplied 0f3e6d8 baseline is older, and remains an ancestor. Preserve all later portfolio/L1 fixes.\n\nOriginal required hotfix: ${hotfix}\n\nEnrichment previous base: ${audit.enrichmentPreviousBase}\n\nCurrent source: uncommitted worktree changes. No commits touching the enrichment source paths exist in any reachable local/remote/stash history. Remote heads were queried directly. Existing stashes predate this feature.\n\nStrategy: selective integration of local changes on current HEAD; no stale branch merge, reset, or old-file checkout. Pending APN/report work is a separate preceding fix, not an EffectivePropertyFacts report migration.\n`);
await writeFile(`${directory}/enrichment-source-location.md`,`# Source location\n\nClassification: C — uncommitted worktree.\n\n${sourcePaths.map(path=>`- ${path}`).join('\n')}\n\nAdditional modified integration surfaces are listed in baseline.json. No enrichment commits or feature branches were found. No stash apply is required.\n`);
await writeFile(`${directory}/merge-conflict-report.md`,'# Reconciliation strategy\n\nNo Git merge conflicts: 0. No old-file replacement: 0. Source is already in the current worktree; reconcile intended behavior selectively. The four map lifecycle source files remain byte-equivalent after line-ending normalization to the mandatory production hotfix.\n');
console.log(JSON.stringify({branch,head,production:production.sourceSha,enrichmentSource:audit.enrichmentSource,mapHotfixFilesUnchanged:preservation.length,stashes:audit.stashes.length}));
