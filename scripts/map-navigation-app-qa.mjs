import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs}=await import('../e2e/support/appActions.js');
const output='qa/map-navigation-cleanup'; await mkdir(output,{recursive:true});
const baseURL=process.env.MAP_QA_BASE_URL||'http://127.0.0.1:4180';
const productionAssets=baseURL==='https://dealsiftermatch.vercel.app';
const suffix=productionAssets?'production-synthetic':'full-app';
const browser=await chromium.launch({headless:true}); const results=[];
async function navigate(page,module) {
  const desktop=page.getByTestId(`nav-${module}`),mobile=page.getByTestId(`mobile-nav-${module}`);
  const back=page.getByRole('button',{name:'Back to app'});
  if(!await desktop.isVisible()&&!await mobile.isVisible()&&module!=='pricing'&&await back.isVisible())await back.click();
  if(await desktop.isVisible())await desktop.click();
  else if(await mobile.isVisible())await mobile.click();
  else if(module==='pricing') { await page.getByTestId('nav-app-menu').click();await page.getByRole('button',{name:/^(Pricing|Plans|Planos|Planes)$/i}).click(); }
  else throw new Error(`NAVIGATION_NOT_FOUND:${module}`);
  const target={mapview:'.leaflet-container',dashboard:'[data-testid="dashboard-root"]',matches:'[data-testid="matches-root"]',pricing:'[data-testid="pricing-plan-free"]'}[module];
  await expect(page.locator(target).first()).toBeVisible({timeout:60000});
}
try {
  for(const [device,width,height] of [['desktop',1280,900],['phone',390,844]]) {
    const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='phone',hasTouch:device==='phone'});
    await context.addInitScript(()=>{
      sessionStorage.setItem('ds_mapview_ui_state_v1',JSON.stringify({showPeople:false,showProperties:true,panelCollapsed:true,viewport:{center:[35.92113,-78.58355],zoom:15}}));
      localStorage.removeItem('ds_last_error_boundary');
    });
    const backend=await setupMockSupabase(context,{propertyOverrides:{hide_street_address_on_card:false,address:'QA map property',lat:35.92113,lng:-78.58355,geocode_status:'resolved',geocode_source:'explicit-qa-fixture',geocoded_at:'2026-10-13T00:00:00Z'}});
    // A production frontend can be tested without a real session or DB write.
    // The known backend is fully mocked; all other Supabase projects are denied.
    await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());
    await context.route('**/*sentry.io/**',route=>route.abort());
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await loginAs(page,backend.users.investor);
    const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
    const transitions=[];
    for(const module of ['dashboard','matches','pricing','dashboard','matches']) {
      await navigate(page,'mapview');
      const pin=page.locator('.leaflet-marker-icon.map-pin-wrapper').first();await expect(pin).toBeVisible({timeout:60000});
      await pin.click(); await expect(page.locator('.ds-property-leaflet-popup')).toBeVisible();
      // Alternate leaving during and after the camera animation.
      if(transitions.length%2===0)await page.waitForTimeout(700);
      await navigate(page,module);
      expect(await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))).toBeNull();
      transitions.push({from:'mapview',to:module,pinSelected:true});
    }
    expect(errors).toEqual([]);await page.screenshot({path:`${output}/${device}-${suffix}.png`});
    results.push({device,transitions,errors});await context.close();
  }
  await writeFile(`${output}/${suffix}.json`,JSON.stringify({mode:productionAssets?'PRODUCTION_FRONTEND_WITH_EXPLICIT_MOCK_AUTH_BACKEND':baseURL.endsWith('4180')?'LOCAL_FULL_APP_MOCK_AUTH':'ISOLATED_PRODUCTION_BUILD_FULL_APP_MOCK_AUTH',productionUserSession:false,realBackendWrites:0,results},null,2)+'\n');
  console.log(JSON.stringify(results));
}finally{await browser.close();}
