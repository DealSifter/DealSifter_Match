import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium,expect } from '@playwright/test';
import { loginAs } from '../e2e/support/appActions.js';
// Configure the existing interceptor before its module captures the URL. This
// is process-only: the local app keeps its env; production requests are mocked.
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const directory='qa/public-parcel-intelligence/general-availability';await mkdir(`${directory}/screenshots`,{recursive:true});
const loader=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
const {resolveFeatureFlags}=await loader.ssrLoadModule('/supabase/functions/_shared/featureFlags.ts');await loader.close();
const cases=[['desktop-free','investor','FREE','supported','pt',1280,900],['mobile-pro','investor','PRO','supported','es',390,844],['desktop-enterprise','investor','ENTERPRISE','supported','en',1280,900],['desktop-unsupported','investor','PRO','unsupported','en',1280,900],['mobile-unsupported','investor','FREE','unsupported','pt',390,844],['privacy','investor','PRO','privacy','es',1280,900]];
const scope=process.argv.find(argument=>argument.startsWith('--cases='))?.slice(8).split(',');
if(scope&&scope.some(id=>!cases.some(row=>row[0]===id)))throw new Error('UNKNOWN_UI_CASE');
const point={lat:35.921133041392,lng:-78.583547577238};const browser=await chromium.launch({headless:true});
const results=scope?await readFile(`${directory}/ui-validation.json`,'utf8').then(JSON.parse).then(report=>report.results,()=>[]):[];
try{for(const [id,actor,tier,mode,language,width,height]of cases.filter(([id])=>!scope||scope.includes(id))){
 const phone=width<500;const context=await browser.newContext({baseURL:'http://127.0.0.1:4180',viewport:{width,height},isMobile:phone,hasTouch:phone});
 const backend=await setupMockSupabase(context,{propertyOverrides:{hide_street_address_on_card:mode==='privacy',lat:point.lat,lng:point.lng,city:'Raleigh',state:'NC',zip:'27614',address:'EXPLICIT QA property',geocode_status:'resolved',geocode_source:'manual',geocoded_at:new Date().toISOString(),geocode_input:'EXPLICIT_QA_FIXTURE',geocode_confidence:1}});
 const user=backend.users[actor];if(tier==='FREE')user.nuggets=0;let flagCalls=0;let gisCalls=0;let neighbors=0;let billingCalls=0;let authorized=false;
 await context.addInitScript(({point,language})=>{localStorage.setItem('lang',language);sessionStorage.setItem('ds_mapview_ui_state_v1',JSON.stringify({showPeople:false,showProperties:true,panelCollapsed:true,viewport:{center:[point.lat,point.lng],zoom:15}}));},{point,language});
 await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith('https://cyeipfskwwisbbayyaca.supabase.co')?route.fallback():route.abort());
 await context.route('**/*sentry.io/**',route=>route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/auth/v1/token**',route=>{const body=route.request().postDataJSON();console.log(JSON.stringify({id,authFixtureEmailMatches:body.email===user.email,authFixturePasswordMatches:body.password===user.password}));return route.fallback();});
 page.on('request',request=>{if(/(?:consume_nuggets|create-unlock|checkout-session|spotlight_activate)/.test(request.url()))billingCalls++;});
 await page.route('**/functions/v1/feature-flags',route=>{
   flagCalls++;const flags=resolveFeatureFlags({userId:user.id,environment:'production',remoteConfig:{public_parcel_intelligence:{enabled:true,environments:['production'],percentage:100},maxxis_proactive_insights:{enabled:false,environments:[],percentage:0}}});
   authorized=flags.public_parcel_intelligence;expect(authorized).toBe(true);expect(flags.public_parcel_qa_grid).toBe(false);
   return route.fulfill({contentType:'application/json',body:JSON.stringify({source:'server',environment:'production',flags})});
 });
 await page.route('**/rpc/ds_get_plan_usage_snapshot',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({plan:{id:tier.toLowerCase(),planId:tier.toLowerCase(),name:tier,planName:tier,status:'active',price:0,source:'explicit_ga_fixture'},nuggets:user.nuggets,limits:{},usage:{}})}));
 await page.route('**/functions/v1/public-parcel',route=>{
   gisCalls++;expect(authorized).toBe(true);const query=route.request().postDataJSON();expect(query).not.toHaveProperty('propertyId');expect(query).not.toHaveProperty('userId');
   if(query.operation==='query-lens'){neighbors++;expect(query).toEqual({operation:'query-lens',point});}
   const d=.0001;const parcel={source:'explicit-qa-not-live-gis',parcelId:'MAIN',apn:'MAIN',sourceAuthority:'Synthetic public GIS fixture',retrievedAt:new Date().toISOString(),geometry:{type:'Polygon',coordinates:[[[point.lng-d,point.lat-d],[point.lng+d,point.lat-d],[point.lng+d,point.lat+d],[point.lng-d,point.lat+d],[point.lng-d,point.lat-d]]]}};
   return route.fulfill({contentType:'application/json',body:JSON.stringify({status:mode==='unsupported'?'NO_ACTIVE_PUBLIC_SOURCE':'COVERAGE_AVAILABLE',parcels:mode==='unsupported'?[]:[parcel],expiresAt:new Date(Date.now()+300000).toISOString()})});
 });
 await loginAs(page,user);const guide=page.getByRole('dialog',{name:/DealSifter Guide|Guia do DealSifter|Guía de DealSifter/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide|Fechar guia|Cerrar guía/i}).click();
 await page.getByTestId(phone?'mobile-nav-mapview':'nav-mapview').click();await expect(page.locator('.leaflet-container')).toBeVisible({timeout:60000});
 await page.waitForTimeout(600);expect(gisCalls).toBe(0);expect(await page.locator('.map-parcel-toggle').count()).toBe(0);
 if(mode==='privacy'){expect(await page.locator('.leaflet-marker-icon.map-pin-wrapper').count()).toBe(0);expect(gisCalls).toBe(0);}
 else{await expect(page.locator('.leaflet-marker-icon.map-pin-wrapper').first()).toBeVisible({timeout:60000});await page.locator('.leaflet-marker-icon.map-pin-wrapper').first().click();await expect(page.locator('.ds-property-pin-popup')).toBeVisible({timeout:60000});
   if(mode==='unsupported'){await expect.poll(()=>gisCalls).toBe(1);await page.waitForTimeout(600);expect(await page.locator('.ds-property-pin-lens').count()).toBe(0);expect(await page.locator('.ds-property-pin-lens-feedback').count()).toBe(0);expect(neighbors).toBe(0);}
   else{await expect(page.locator('.ds-property-pin-lens')).toBeVisible({timeout:60000});expect(neighbors).toBe(0);expect(gisCalls).toBe(1);await page.locator('.ds-property-pin-lens').click();await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(1,{timeout:60000});await expect(page.getByTestId('map-zoom-level')).toHaveText(phone?'Z17':'Z16',{timeout:60000});expect(gisCalls).toBe(2);expect(neighbors).toBe(1);}
 }
 expect(billingCalls).toBe(0);expect(errors).toEqual([]);await page.screenshot({path:`${directory}/screenshots/${id}.png`});const row={id,tier,mode,language,phone,flagCalls,gisCalls,neighbors,billingCalls,errors,pass:true};const prior=results.findIndex(result=>result.id===id);if(prior>=0)results[prior]=row;else results.push(row);await context.close();
 await writeFile(`${directory}/ui-validation.json`,JSON.stringify({mode:'LOCAL_FULL_APP_REAL_LEAFLET_MOCKED_AUTH_AND_PUBLIC_GIS',productionUserSession:false,personalAllowlistUsed:false,planSnapshots:'EXPLICIT_QA_FIXTURES',proactiveMaxxis:'DISABLED_ONLY_IN_QA_FIXTURE',results},null,2)+'\n');console.log(`${id}: PASS`);
}}finally{await browser.close();}
