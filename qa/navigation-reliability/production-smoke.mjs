import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const app='https://dealsiftermatch.vercel.app';const consensus=process.argv.includes('--parcel-consensus');const canonical=process.argv.includes('--canonical-evidence');
const cleanup=process.argv.includes('--map-cleanup');
const portfolio=process.argv.includes('--portfolio-cards');
const rooms=process.argv.includes('--portfolio-rooms');
const directory=rooms?'qa/portfolio-rooms-layout':portfolio?'qa/portfolio-card-labels':cleanup?'qa/map-navigation-cleanup':canonical?'qa/canonical-evidence-maxxis':consensus?'qa/parcel-evidence-consensus':process.argv.includes('--parcel-ga')?'qa/public-parcel-intelligence/general-availability':'qa/navigation-reliability';
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
let canonicalHandoff=null;
if(canonical){
 const receiptName=names(map).find(name=>/^parcelEvidenceReceipt-(?!legacy).*\.js$/.test(name));
 const assistantName=names(main).find(name=>/^MaxxisAssistant-(?!legacy).*\.js$/.test(name));
 if(!receiptName||!assistantName)throw new Error('CANONICAL_HANDOFF_DEPENDENCY_REQUIRED');
 const receiptResponse=await request(`${app}/assets/${receiptName}`),assistantResponse=await request(`${app}/assets/${assistantName}`);
 const receiptCode=await receiptResponse.text(),assistantCode=await assistantResponse.text();
 canonicalHandoff={receiptChunk:receiptName,receiptStatus:receiptResponse.status,receiptSha256:createHash('sha256').update(receiptCode).digest('hex'),
  assistantChunk:assistantName,assistantStatus:assistantResponse.status,assistantTransportPresent:assistantCode.includes('parcelEvidenceReceipt'),
  boundedReceiptGuard:receiptCode.includes('20100'),immutableCache:/immutable/.test(receiptResponse.headers.get('cache-control')||'')&&/immutable/.test(assistantResponse.headers.get('cache-control')||'')};
}
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
const deniedMaxxis=canonical?await request(`${edge}/maxxis-chat`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'What is the lot size?'})}):null;
const browser=await chromium.launch({headless:true});const errors=[];let gisRequests=0;let browserStatus;
try{const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',req=>{if(req.url().includes('/functions/v1/public-parcel'))gisRequests++;});const response=await page.goto(app,{waitUntil:'networkidle',timeout:60000});browserStatus=response.status();}finally{await browser.close();}
const receipt={observedAt:new Date().toISOString(),codeCommit:deployment.sourceSha,deploymentId:deployment.id,aliasVerified:deployment.aliasVerified,
  frontendStatus:htmlResponse.status,htmlCacheControl:htmlResponse.headers.get('cache-control'),deepLinkStatus:deepLink.status,deepLinkCacheControl:deepLink.headers.get('cache-control'),
  mainAssetStatus:mainResponse.status,mainAssetCacheControl:mainResponse.headers.get('cache-control'),mapAssetStatus:mapResponse.status,mapAssetCacheControl:mapResponse.headers.get('cache-control'),mapChunk:mapName,mapSha256:createHash('sha256').update(map).digest('hex'),
  securityHeaders:['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','referrer-policy','permissions-policy','cross-origin-opener-policy'].every(name=>htmlResponse.headers.has(name)&&mapResponse.headers.has(name)),
  compiledModuleRecovery:code.includes('MODULE_DEFAULT_EXPORT_MISSING')&&code.includes('module_loading'),compiledParcelAccessDiagnostics:map.includes('parcelAccessStatus')&&map.includes('ds-property-pin-lens-feedback'),
  obsoleteAssets,featureFlagsCorsStatus:cors.status,featureFlagsCorsHeaders:cors.headers.get('access-control-allow-headers'),anonymousParcelStatus:denied.status,
  browserStatus,browserErrors:errors,anonymousStartupGisRequests:gisRequests,backendDeploy:canonical?'maxxis-chat,public-parcel (signed existing-evidence handoff)':consensus?'public-parcel (shared area policy only)':process.argv.includes('--parcel-ga')?'feature-flags,public-parcel (separate receipts)':'NONE',migrations:'NONE',configurationChanged:process.argv.includes('--parcel-ga'),paidProviderCalls:0,
  canonicalHandoff,anonymousMaxxisStatus:deniedMaxxis?.status??null,authenticatedUserAcceptance:canonical?'BLOCKED_NO_REAL_USER_SESSION':'NOT_PERFORMED_NO_USER_SESSION'};
receipt.pass=htmlResponse.status===200&&deepLink.status===200&&mainResponse.status===200&&mapResponse.status===200&&/no-store/.test(receipt.htmlCacheControl)&&/no-store/.test(receipt.deepLinkCacheControl)&&/immutable/.test(receipt.mainAssetCacheControl)&&/immutable/.test(receipt.mapAssetCacheControl)&&receipt.securityHeaders&&receipt.compiledModuleRecovery&&receipt.compiledParcelAccessDiagnostics&&obsoleteAssets.every(asset=>asset.status===404&&/no-store/.test(asset.cacheControl||'')&&!/immutable|max-age=31536000/.test(asset.cacheControl||''))&&cors.status===200&&denied.status===401&&browserStatus===200&&errors.length===0&&gisRequests===0;
if(canonical)receipt.pass=receipt.pass&&deniedMaxxis.status===401&&canonicalHandoff.receiptStatus===200&&canonicalHandoff.assistantStatus===200&&canonicalHandoff.assistantTransportPresent&&canonicalHandoff.boundedReceiptGuard&&canonicalHandoff.immutableCache;
if(cleanup){
 receipt.compiledMapUnloadGuard=map.includes('.removed')&&map.includes('.disposed')&&map.includes('.on("unload"')&&map.includes('.off("unload"');
 receipt.compiledNativeZoomGuard=map.includes('._animatingZoom=!1');
 receipt.pass=receipt.pass&&receipt.compiledMapUnloadGuard&&receipt.compiledNativeZoomGuard;
}
if(portfolio||rooms){
 const pageName=names(main).find(name=>/^MatchesPage-(?!legacy).*\.js$/.test(name));
 if(!pageName)throw new Error('MATCHES_DEPENDENCY_REQUIRED');
 const response=await request(`${app}/assets/${pageName}`),body=await response.text();
 receipt.portfolioFacts={status:response.status,chunk:pageName,semanticFactIds:body.includes('data-fact'),singleFactPresentation:body.includes('portfolio-property-facts'),completeAreaField:body.includes('buildingArea')};
 receipt.pass=receipt.pass&&response.status===200&&receipt.portfolioFacts.semanticFactIds&&receipt.portfolioFacts.singleFactPresentation&&receipt.portfolioFacts.completeAreaField;
 if(rooms){receipt.portfolioFacts.sharedRooms=body.includes('data-fact-group')&&body.includes('portfolio-property-rooms');receipt.portfolioFacts.l1Continuations=body.includes('PROPERTY_RELEASE_RENDER_FAILED')&&!/pageCount\s*!==?\s*1/.test(body);receipt.pass=receipt.pass&&receipt.portfolioFacts.sharedRooms&&receipt.portfolioFacts.l1Continuations;}
}
await writeFile(`${directory}/production-smoke.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));if(!receipt.pass)throw new Error('PRODUCTION_SMOKE_FAILED');
