import {readFileSync,writeFileSync} from 'node:fs';
const directory='qa/financial-evidence-stack/phase1';
const read=name=>JSON.parse(readFileSync(`${directory}/${name}.json`,'utf8').replace(/^\uFEFF/,''));
const before=read('backend-production-before'),after=read('backend-production-after'),closure=read('backend-dependency-closure'),deploy=read('backend-deploy'),frontend=read('production-deployment'),quality=read('quality-gates');
const functions=closure.affectedFunctions.map(({function:slug})=>{const old=before.functions.find(r=>r.slug===slug),current=after.functions.find(r=>r.slug===slug);return{slug,before:old?.version,after:current?.version,active:current?.status==='ACTIVE',jwt:current?.verify_jwt===true,incremented:current?.version===old?.version+1};});
const untouched=['public-parcel','feature-flags','arv-visual-comp-review','property-intelligence'].map(slug=>({slug,unchanged:before.functions.find(r=>r.slug===slug)?.version===after.functions.find(r=>r.slug===slug)?.version}));
const databaseUnchanged=JSON.stringify(read('migration-production-audit').after)===JSON.stringify(read('migration-production-after').after);
const browser=read('browser-production'),map=read('map/production-synthetic'),photo=read('map/photo/production-synthetic');
const browserPass=browser.results.length===6&&browser.results.every(r=>!r.errors.length&&r.genericLoaderFlashes===0&&r.reviewOpenProviderCalls===0&&r.radioNetworkMutations===0&&r.portfolioProviderFanout===0);
const navigationPass=map.results.length===2&&map.results.every(r=>!r.errors.length&&r.transitions.length===5);
const photoPass=photo.results.length===2&&photo.results.every(r=>!r.errors.length&&r.transitions.length===1);
const exactFrontend=frontend.state==='READY'&&frontend.sourceSha===deploy.codeSha&&frontend.sourceShaVerified===true&&frontend.aliasVerified===true;
const exactBackend=deploy.immutableGitStage&&deploy.steps.length===functions.length&&deploy.steps.every(r=>r.exitCode===0)&&functions.every(r=>r.active&&r.jwt&&r.incremented);
const flagsUnchanged=after.effectiveConfiguration===before.effectiveConfiguration&&after.globalGridGeneralAccess===before.globalGridGeneralAccess&&!after.configurationChanged&&!after.changedSecrets.length;
const result={codeSha:deploy.codeSha,deploymentId:frontend.id,productionUrl:'https://dealsiftermatch.vercel.app',exactFrontend,exactBackend,functions,untouched,databaseUnchanged,flagsUnchanged,browserPass,navigationPass,photoPass,
  browserMode:'ACTUAL_PRODUCTION_ASSETS_WITH_EXPLICIT_SYNTHETIC_AUTH_AND_BACKEND',realBackendWrites:browser.realBackendWrites+map.realBackendWrites+photo.realBackendWrites,authenticatedProductionSmoke:'BLOCKED',realUserSession:false};
result.pass=quality.pass&&exactFrontend&&exactBackend&&untouched.every(r=>r.unchanged)&&databaseUnchanged&&flagsUnchanged&&browserPass&&navigationPass&&photoPass&&result.realBackendWrites===0;
writeFileSync(`${directory}/production-validation.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
