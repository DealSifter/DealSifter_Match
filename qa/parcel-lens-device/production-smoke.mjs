import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { argv } from 'node:process';
const app='https://dealsiftermatch.vercel.app';
const qaDirectory=argv.includes('--unlocked')?'qa/parcel-lens-unlocked':'qa/parcel-lens-device';
const deployment=JSON.parse((await readFile(`${qaDirectory}/production-deployment.json`,'utf8')).replace(/^\uFEFF/,''));
if(deployment.state!=='READY'||!deployment.sourceShaVerified||!deployment.aliasVerified)throw new Error('VERIFIED_READY_PRODUCTION_DEPLOYMENT_REQUIRED');
const get=async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`READ_ONLY_ASSET_${response.status}`);return response.text();};
const asset=(body,name,type)=>body.match(new RegExp(`(?:\\./|assets/)(`+name+`-(?!legacy)[A-Za-z0-9_-]+\\.`+type+`)`))?.[1];
const html=await get(app);const entry=[...html.matchAll(/type="module"[^>]*src="([^"]+)"/g)].map(match=>match[1]).find(path=>!path.includes('polyfills-'));
if(!entry)throw new Error('PRODUCTION_MODULE_ENTRY_NOT_FOUND');
const main=await get(new URL(entry,app));const mapName=asset(main,'MapView','js');const cssName=asset(main,'MapView','css');
if(!mapName||!cssName)throw new Error('PRODUCTION_MAP_DEPENDENCY_NOT_FOUND');
const mapCode=await get(`${app}/assets/${mapName}`);const css=await get(`${app}/assets/${cssName}`);
const layerName=asset(mapCode,'ParcelLensLayer','js');if(!layerName)throw new Error('PRODUCTION_LENS_DEPENDENCY_NOT_FOUND');
const layerCode=await get(`${app}/assets/${layerName}`);
const denied=await fetch('https://cyeipfskwwisbbayyaca.supabase.co/functions/v1/public-parcel',{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'query-point',point:{lat:35.921,lng:-78.584}}),signal:AbortSignal.timeout(15000)});
const browser=await chromium.launch({headless:true});let parcelRequests=0;let frontendStatus;const errors=[];
try{const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/functions/v1/public-parcel'))parcelRequests++;});
 const frontend=await page.goto(app,{waitUntil:'networkidle',timeout:60000});frontendStatus=frontend.status();}finally{await browser.close();}
const receipt={observedAt:new Date().toISOString(),codeCommit:deployment.sourceSha,deploymentId:deployment.id,
  deploymentState:deployment.state,aliasVerified:deployment.aliasVerified,frontendStatus,mapChunk:mapName,layerChunk:layerName,
  mapSha256:createHash('sha256').update(mapCode).digest('hex'),compiledDeviceCamera:mapCode.includes('--map-selection-popup-height'),
  compiledScrollingFrame:css.includes('.ds-property-pin-pages'),compiledPhoneStatus:css.includes('.ds-parcel-lens-status.is-phone'),
  compiledTopStatus:/\.ds-parcel-lens-status\{[^}]*top:12px/.test(css),compiledNeighborFrame:layerCode.includes('ds-parcel-neighbor-frame'),
  compiledUnlockedMagnifier:mapCode.includes('ds-property-pin-lens-feedback')&&mapCode.includes('PARCEL_NOT_FOUND'),
  anonymousParcelStatus:denied.status,anonymousStartupParcelRequests:parcelRequests,browserErrors:errors,
  backendDeploy:'NONE_FRONTEND_ONLY',migration:'NONE',featureFlagsChanged:false,paidProviderCalls:0,
  realUserAuthenticatedAcceptance:'NOT_PERFORMED_NO_USER_SESSION'};
receipt.pass=frontendStatus===200&&denied.status===401&&parcelRequests===0&&errors.length===0&&receipt.compiledDeviceCamera&&receipt.compiledScrollingFrame&&receipt.compiledPhoneStatus&&receipt.compiledTopStatus&&receipt.compiledNeighborFrame&&(!argv.includes('--unlocked')||receipt.compiledUnlockedMagnifier);
await writeFile(`${qaDirectory}/production-smoke.json`,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));if(!receipt.pass)throw new Error('PRODUCTION_SMOKE_FAILED');
