import {readFileSync,writeFileSync} from 'node:fs';
const directory='qa/consensus-aware-analytics/phase1',codeSha='144056b478032efc61378d99f94432273b0b7a76';
const read=name=>JSON.parse(readFileSync(`${directory}/${name}.json`,'utf8').replace(/^\uFEFF/,''));
const before=read('backend-production-before'),after=read('backend-production-after'),closure=read('backend-dependency-closure'),deployment=read('production-deployment');
const steps=read('backend-deploy'),quality=read('quality-gates'),browser=read('browser-production'),map=read('map/production-synthetic'),photo=read('map/photo/production-synthetic');
const affected=closure.affectedFunctions.map(row=>row.function);
const functions=affected.map(slug=>{const old=before.functions.find(row=>row.slug===slug),current=after.functions.find(row=>row.slug===slug);return{slug,before:old?.version,after:current?.version,active:current?.status==='ACTIVE',jwt:current?.verify_jwt===true,incremented:current?.version===old?.version+1};});
const untouched=['public-parcel','feature-flags'].map(slug=>({slug,unchanged:after.functions.find(row=>row.slug===slug)?.version===before.functions.find(row=>row.slug===slug)?.version}));
const databaseBefore=read('migration-production-audit'),databaseAfter=read('migration-production-after');
const databaseUnchanged=JSON.stringify(databaseBefore.after)===JSON.stringify(databaseAfter.after);
const safeRows=rows=>rows.every(row=>Array.isArray(row.errors)&&row.errors.length===0);
const productionBrowserPass=browser.results.length===6&&safeRows(browser.results)&&browser.results.every(row=>row.genericLoaderFlashes===0&&row.reviewOpenProviderCalls===0&&row.portfolioProviderFanout===0&&row.radioNetworkMutations===0);
const navigationPass=map.results.length===2&&safeRows(map.results)&&map.results.every(row=>row.transitions.length===5);
const photoPass=photo.results.length===2&&safeRows(photo.results)&&photo.results.every(row=>row.transitions.length===1);
const flagsUnchanged=after.effectiveConfiguration===before.effectiveConfiguration&&after.globalGridGeneralAccess===before.globalGridGeneralAccess&&!after.configurationChanged&&!after.changedSecrets.length;
const exactFrontend=deployment.state==='READY'&&deployment.sourceSha===codeSha&&deployment.sourceShaVerified===true&&deployment.aliasVerified===true;
const exactBackend=steps.codeSha===codeSha&&steps.immutableGitStage&&steps.steps.length===affected.length&&steps.steps.every(row=>row.exitCode===0)&&functions.every(row=>row.active&&row.jwt&&row.incremented);
const noRealBackendWrites=browser.realBackendWrites===0&&map.realBackendWrites===0&&photo.realBackendWrites===0;
const result={codeSha,deploymentId:deployment.id,productionUrl:'https://dealsiftermatch.vercel.app',exactFrontend,exactBackend,functions,untouched,flagsUnchanged,databaseUnchanged,
 productionBrowserPass,navigationPass,photoPass,deviceLocaleCases:browser.results.length,mapModuleTransitions:map.results.reduce((sum,row)=>sum+row.transitions.length,0),photoToFeedHandoffs:photo.results.reduce((sum,row)=>sum+row.transitions.length,0),
 noRealBackendWrites,authenticatedProductionSmoke:'BLOCKED',realUserSession:false,mode:'PRODUCTION_ASSETS_EXPLICIT_SYNTHETIC_AUTH_AND_BACKEND_PLUS_OPERATOR_METADATA_AUDITS'};
result.pass=quality.pass&&exactFrontend&&exactBackend&&untouched.every(row=>row.unchanged)&&flagsUnchanged&&databaseUnchanged&&productionBrowserPass&&navigationPass&&photoPass&&noRealBackendWrites;
writeFileSync(`${directory}/production-validation.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;
