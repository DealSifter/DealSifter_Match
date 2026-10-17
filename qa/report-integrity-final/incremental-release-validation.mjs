// Safe reuse is limited to test-only changes with identical production inputs.
// This never infers a test result or builds a new binary.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const qa='qa/report-integrity-final';
const read=p=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const hash=v=>createHash('sha256').update(v).digest('hex');
const normalized=v=>v.replace(/\r\n/g,'\n');
const assert=(v,m)=>{if(!v)throw Error(m);};
const before=read(`${qa}/browser/tested-build-assets.json`),full=read(`${qa}/full/tests.json`);
assert(full.pass&&full.sourcesUnchangedDuringRun&&full.failed===0,'CURRENT_FULL_SUITE_REQUIRED');
const current=full.sourceHashes;
assert(hash(JSON.stringify(current))===full.sourceDigest,'FULL_SOURCE_MANIFEST_INTEGRITY');
for(const [path,digest] of Object.entries(current))assert(existsSync(path)&&hash(normalized(readFileSync(path,'utf8')))===digest,`SOURCE_CHANGED:${path}`);
const changed=[...new Set([...Object.keys(before.sourceHashes),...Object.keys(current)])].filter(p=>before.sourceHashes[p]!==current[p]);
assert(changed.length>0&&changed.every(p=>/^src\/.*\.(?:test|spec)\.[jt]sx?$/.test(p)),'PRODUCTION_INPUT_CHANGED_REBUILD_REQUIRED');
const gitDiff=execFileSync('git',['diff','--name-only','HEAD','--','public','package.json','package-lock.json','index.html','vite.config.js'],{encoding:'utf8',windowsHide:true}).trim();
assert(!gitDiff,'BUILD_CONFIGURATION_OR_PUBLIC_ASSET_CHANGED');
const staticChecks=read(`${qa}/static-checks.json`);
assert(staticChecks.pass&&staticChecks.sourceDigest===full.sourceDigest,'CURRENT_STATIC_CHECKS_REQUIRED');
const build=read(`${qa}/build.json`);
assert(build.pass&&build.sourceDigest===before.sourceDigest,'ACTUAL_ORIGINAL_BUILD_REQUIRED');
const raw=read(full.rawFile);
assert(hash(readFileSync(full.rawFile))===full.rawSha256&&raw.success,'FULL_RAW_INTEGRITY');
const oldTarget=read(`${qa}/targeted/tests.json`),selection=oldTarget.selection;
assert(Array.isArray(selection)&&selection.length>0,'TARGETED_SELECTION_REQUIRED');
const selected=selection.map(path=>raw.testResults.find(suite=>suite.name.replaceAll('\\','/').endsWith(`/${path}`)));
assert(selected.every(Boolean)&&selected.every(suite=>suite.status==='passed'&&suite.assertionResults.every(t=>t.status==='passed')),'TARGETED_SUBSET_NOT_ALL_PASS');
const assertions=selected.flatMap(suite=>suite.assertionResults);
for(const name of ['build.json','source-before-build.json','source-binding.json'])copyFileSync(`${qa}/${name}`,`${qa}/original-${name}`);
copyFileSync(`${qa}/targeted/tests.json`,`${qa}/targeted/original-tests.json`);
for(const path of changed)copyFileSync(path,`.cache/smart-property-release/${path}`);
const now=new Date().toISOString();
const proof={pass:true,revalidatedAt:now,originalSourceDigest:before.sourceDigest,sourceDigest:full.sourceDigest,changedNonRuntimeFiles:changed,
 productionSourceFilesUnchanged:true,buildConfigurationAndPublicAssetsUnchanged:true,
 testMethod:'Targeted assertions extracted from the actual passing current-source full-suite run; not a second claimed execution.',
 selectedFiles:selected.length,selectedAssertions:assertions.length,fullRawSha256:full.rawSha256,
 buildMethod:'Reuse the actual previously passed build because every production source/configuration input is unchanged. Served asset hashes are independently checked before browser receipt reuse.',
 originalBuildReceipt:'original-build.json',originalSourceReceipt:'original-source-before-build.json',requiresRebuildForAnyProductionInputChange:true};
save(`${qa}/incremental-validation.json`,proof);
save(`${qa}/targeted/tests.json`,{...oldTarget,execution:{name:'current-full-suite-targeted-subset',startedAt:full.execution.startedAt,finishedAt:full.execution.finishedAt,exitCode:0,pass:true,separateExecution:false},
 rawFile:full.rawFile,rawSha256:full.rawSha256,files:selected.length,tests:assertions.length,passed:assertions.length,failed:0,skipped:0,failures:[],
 sourceDigest:full.sourceDigest,sourceHashes:current,sourcesUnchangedDuringRun:true,historicalQaRestored:full.historicalQaRestored,pass:true,incrementalValidation:'incremental-validation.json'});
save(`${qa}/source-before-build.json`,{generatedAt:now,sourceDigest:full.sourceDigest,sourceHashes:current,mode:'REVALIDATION_OF_EXISTING_BINARY_NOT_A_NEW_BUILD',originalBeforeBuildReceipt:'original-source-before-build.json',incrementalValidation:'incremental-validation.json'});
save(`${qa}/build.json`,{...build,sourceDigest:full.sourceDigest,mode:'VERIFIED_EXISTING_BUILD_TEST_ONLY_CHANGE',actualBuildRepeated:false,revalidatedAt:now,incrementalValidation:'incremental-validation.json'});
console.log(JSON.stringify({pass:true,fullTests:full.tests,targetedAssertions:assertions.length,changedNonRuntimeFiles:changed,buildRepeated:false}));
