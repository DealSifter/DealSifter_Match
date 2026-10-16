import {readFile,writeFile} from 'node:fs/promises';
const root='qa/publisher-zoning-match';
const read=async name=>JSON.parse((await readFile(`${root}/${name}`,'utf8')).replace(/^\uFEFF/,''));
const deployment=await read('production-deployment.json'),before=await read('backend-before.json'),after=await read('backend-after.json');
const browser=await read('browser-production.json'),navigation=await read('navigation/production.json'),loading=await read('navigation/loading-production.json'),general=await read('navigation-general/production-synthetic.json');
const initialNavigationAttempt=await read('navigation/failure.json').catch(()=>null);
const checks={
 frontendExactRelease:deployment.state==='READY'&&deployment.sourceShaVerified&&deployment.aliasVerified,
 backendVersionsAndJwt:['maxxis-chat','property-fact-review'].every(slug=>{const previous=before.functions.find(row=>row.slug===slug),current=after.functions.find(row=>row.slug===slug);return current?.version===previous?.version+1&&current.status==='ACTIVE'&&current.verify_jwt===true;}),
 flagsUnchanged:before.effectiveConfiguration===after.effectiveConfiguration&&!after.configurationChanged&&after.globalGridGeneralAccess===before.globalGridGeneralAccess,
 fourPublisherAndMatchCases:browser.pass&&browser.results.length===4,
 mobilePersonAndSpotlightReturn:navigation.pass&&navigation.results.every(row=>row.personViewInFeed&&row.spotlightTabReturn&&row.errors.length===0),
 tenModuleTransitions:general.results.length===2&&general.results.every(row=>row.transitions.length===5&&row.errors.length===0),
 slowAndStuckDownloadRecovery:loading.pass&&loading.results.length===2&&loading.results.every(row=>row.oneAnimatedPageLoader&&row.auxiliaryDoesNotCompete&&row.chunkNetworkRequests===1),
};
const pass=Object.values(checks).every(Boolean);
await writeFile(`${root}/production-verification.json`,JSON.stringify({pass,observedAt:new Date().toISOString(),codeSha:deployment.sourceSha,checks,productionUserSession:false,realDatabaseWrites:0,browserMode:'PRODUCTION_FRONTEND_SYNTHETIC_AUTH_AND_BACKEND',backendVerification:'DEPLOY_METADATA_PLUS_LOCAL_POSTGRES_CONTRACT_TESTS',navigationSetupRetry:initialNavigationAttempt?{initialStage:'PLAYWRIGHT_LOGIN_CLICK_NAVIGATION_WAIT_TIMEOUT',appExceptions:initialNavigationAttempt.errors.length,boundary:initialNavigationAttempt.boundary,retryPassed:navigation.pass}:null,reportedDashboardCrash:{reproduced:false,resolutionConfirmed:false},migrationsApplied:0,flagsChanged:0},null,2)+'\n');
console.log(JSON.stringify({pass,codeSha:deployment.sourceSha,checks}));if(!pass)process.exitCode=1;
