import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const app='https://dealsiftermatch.vercel.app';const directory='qa/navigation-reliability';
const deployment=JSON.parse((await readFile(`${directory}/production-deployment.json`,'utf8')).replace(/^\uFEFF/,''));
if(deployment.state!=='READY'||!deployment.sourceShaVerified||!deployment.aliasVerified)throw new Error('EXACT_READY_PRODUCTION_RELEASE_REQUIRED');
const request=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(20000)});
const htmlResponse=await request(app);const html=await htmlResponse.text();
const entry=[...html.matchAll(/type="module"[^>]*src="([^"]+)"/g)].map(match=>match[1]).find(path=>!path.includes('polyfills-'));
if(!entry)throw new Error('MODULE_ENTRY_REQUIRED');
const mainResponse=await request(new URL(entry,app));const main=await mainResponse.text();
const names=body=>[...new Set(body.match(/[A-Za-z0-9_-]+\.(?:js|css)/g)||[])];
const mapName=names(main).find(name=>/^MapView-(?!legacy).*\.js$/.test(name));
if(!mapName)throw new Error('MAP_DEPENDENCY_REQUIRED');
const mapResponse=await request(`${app}/assets/${mapName}`);const map=await mapResponse.text();
let code=main+'\n'+map;
for(const name of [...new Set([...names(main),...names(map)])].filter(name=>/^(lazyWithRetry|ModuleLoadingState|ErrorBoundary|propertyAddressPrivacy)-(?!legacy).*\.js$/.test(name)).slice(0,6)){
  const response=await request(`${app}/assets/${name}`);if(!response.ok)throw new Error('SHARED_DEPENDENCY_UNAVAILABLE');code+='\n'+await response.text();
}
const obsoleteAssets=[];
for(const name of ['MapView-CYCaaVUC.js','ParcelLensLayer-XRoS49Vs.js']){
  const response=await request(`${app}/assets/${name}`);
  obsoleteAssets.push({name,status:response.status,contentType:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control')});
}
const deepLink=await request(`${app}/map`);
const edge='https://cyeipfskwwisbbayyaca.supabase.co/functions/v1';
const cors=await request(`${edge}/feature-flags`,{method:'OPTIONS',headers:{Origin:app,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type,baggage,sentry-trace'}});
const denied=await request(`${edge}/public-parcel`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'query-point',point:{lat:35.921,lng:-78.584}})});
const browser=await chromium.launch({headless:true});const errors=[];let gisRequests=0;let browserStatus;
try{const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.url().includes('/functions/v1/public-parcel'))gisRequests++;});const response=await page.goto(app,{waitUntil:'networkidle',timeout:60000});browserStatus=response.status();}finally{await browser.close();}
const receipt={observedAt:new Date().toISOString(),codeCommit:deployment.sourceSha,deploymentId:deployment.id,aliasVerified:deployment.aliasVerified,
  frontendStatus:htmlResponse.status,htmlCacheControl:htmlResponse.headers.get('cache-control'),deepLinkStatus:deepLink.status,deepLinkCacheControl:deepLink.headers.get('cache-control'),
  mainAssetStatus:mainResponse.status,mapAssetStatus:mapResponse.status,mapChunk:mapName,mapSha256:createHash('sha256').update(map).digest('hex'),
  compiledModuleRecovery:code.includes('MODULE_DEFAULT_EXPORT_MISSING')&&code.includes('module_loading'),compiledParcelAccessDiagnostics:map.includes('parcelAccessStatus')&&map.includes('ds-property-pin-lens-feedback'),
  obsoleteAssets,featureFlagsCorsStatus:cors.status,featureFlagsCorsHeaders:cors.headers.get('access-control-allow-headers'),anonymousParcelStatus:denied.status,
  browserStatus,browserErrors:errors,anonymousStartupGisRequests:gisRequests,backendDeploy:'NONE',migrations:'NONE',configurationChanged:false,paidProviderCalls:0,
  authenticatedUserAcceptance:'NOT_PERFORMED_NO_USER_SESSION'};
receipt.pass=htmlResponse.status===200&&deepLink.status===200&&mainResponse.status===200&&mapResponse.status===200&&/no-store/.test(receipt.htmlCacheControl)&&/no-store/.test(receipt.deepLinkCacheControl)&&receipt.compiledModuleRecovery&&receipt.compiledParcelAccessDiagnostics&&obsoleteAssets.every(asset=>asset.status===404&&!/immutable|max-age=31536000/.test(asset.cacheControl||''))&&cors.status===200&&denied.status===401&&browserStatus===200&&errors.length===0&&gisRequests===0;
await writeFile(`${directory}/production-smoke.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));if(!receipt.pass)throw new Error('PRODUCTION_SMOKE_FAILED');
