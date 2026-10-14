import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { setupMockSupabase } from '../e2e/support/mockSupabase.js';
import { loginAs } from '../e2e/support/appActions.js';
const directory='qa/navigation-reliability';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
  for(const mode of ['network-recovery','server-denied']){
    const context=await browser.newContext({baseURL:'http://127.0.0.1:4180',viewport:{width:1280,height:900}});
    const backend=await setupMockSupabase(context,{propertyOverrides:{hide_street_address_on_card:false,
      lat:35.921133041392,lng:-78.583547577238,geocode_status:'resolved',geocode_source:'manual',geocoded_at:new Date().toISOString(),geocode_input:'EXPLICIT_QA_FIXTURE',geocode_confidence:1}});
    let flagCalls=0;let authorized=false;let gisCalls=0;let prematureGis=0;let selectedPoint;
    await context.addInitScript(()=>sessionStorage.setItem('ds_mapview_ui_state_v1',JSON.stringify({showPeople:false,showProperties:true,panelCollapsed:true,viewport:{center:[35.921133041392,-78.583547577238],zoom:15}})));
    await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith('https://cyeipfskwwisbbayyaca.supabase.co')?route.fallback():route.abort());
    await context.route('**/*sentry.io/**',route=>route.abort());
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/functions/v1/feature-flags',route=>{
      flagCalls++;
      if(mode==='network-recovery'&&flagCalls<=3)return route.abort('failed');
      authorized=mode==='network-recovery';
      return route.fulfill({contentType:'application/json',body:JSON.stringify({source:'server',environment:'production',flags:{public_parcel_intelligence:authorized,public_parcel_qa_grid:false}})});
    });
    await page.route('**/functions/v1/public-parcel',route=>{
      gisCalls++;if(!authorized)prematureGis++;
      const query=route.request().postDataJSON();if(query.point)selectedPoint=query.point;
      const {lat,lng}=selectedPoint;const d=.0001;
      const parcel={source:'explicit-qa-not-live-gis',parcelId:'MAIN',apn:'MAIN',sourceAuthority:'Synthetic public GIS fixture',retrievedAt:new Date().toISOString(),geometry:{type:'Polygon',coordinates:[[[lng-d,lat-d],[lng+d,lat-d],[lng+d,lat+d],[lng-d,lat+d],[lng-d,lat-d]]]}};
      return route.fulfill({contentType:'application/json',body:JSON.stringify({status:'COVERAGE_AVAILABLE',parcels:[parcel],expiresAt:new Date(Date.now()+300000).toISOString()})});
    });
    await loginAs(page,backend.users.investor);
    const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
    await page.getByTestId('nav-mapview').click();await expect(page.locator('.leaflet-container')).toBeVisible({timeout:60000});
    await expect(page.locator('.leaflet-marker-icon.map-pin-wrapper').first()).toBeVisible({timeout:60000});
    await page.locator('.leaflet-marker-icon.map-pin-wrapper').first().click();
    if(mode==='network-recovery'){
      await expect(page.locator('.ds-property-pin-lens')).toBeVisible({timeout:60000});await page.locator('.ds-property-pin-lens').click();
      await expect(page.getByTestId('map-zoom-level')).toHaveText('Z16',{timeout:60000});await expect(page.locator('.ds-parcel-lens-circle')).toHaveCount(1,{timeout:60000});
      expect(flagCalls).toBeGreaterThanOrEqual(4);expect(gisCalls).toBeGreaterThanOrEqual(2);
    }else{
      await expect(page.getByText('Parcel preview is not enabled for this account.')).toBeVisible();expect(await page.locator('.ds-property-pin-lens').count()).toBe(0);expect(gisCalls).toBe(0);
    }
    expect(prematureGis).toBe(0);expect(errors).toEqual([]);
    await page.screenshot({path:`${directory}/parcel-${mode}.png`});results.push({mode,flagCalls,gisCalls,prematureGis,errors});await context.close();console.log(`${mode}: PASS`);
  }
  await writeFile(`${directory}/parcel-access-runtime.json`,JSON.stringify({mode:'LOCAL_FULL_APP_MOCKED_AUTH_FLAG_NETWORK_AND_GIS',productionUserSession:false,configurationChanged:false,paidProviderCalls:0,results},null,2)+'\n');
}finally{await browser.close();}
