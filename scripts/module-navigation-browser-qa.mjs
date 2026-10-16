import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs}=await import('../e2e/support/appActions.js');
const baseURL=process.env.NAV_QA_BASE_URL||'https://dealsiftermatch.vercel.app';
const output='qa/publisher-zoning-match/navigation';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{for(const cold of [false]){
 const context=await browser.newContext({baseURL,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{sessionStorage.setItem('ds_mapview_ui_state_v1',JSON.stringify({showPeople:true,showProperties:false,panelCollapsed:true,viewport:{center:[32.7767,-96.797],zoom:10}}));localStorage.removeItem('ds_last_error_boundary');});
 const backend=await setupMockSupabase(context,{baseline:true});
 await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());
 await context.route('**/*sentry.io/**',route=>route.abort());
 const page=await context.newPage(),errors=[],failedAssets=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',request=>{if(['script','stylesheet'].includes(request.resourceType()))failedAssets.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText});});
 try{
  await loginAs(page,backend.users.investor);
  const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
  await page.getByTestId('mobile-nav-mapview').click();await expect(page.locator('.leaflet-container')).toBeVisible({timeout:60000});
  if(cold){await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByTestId('dashboard-root')).toBeVisible({timeout:60000});await page.getByTestId('mobile-nav-mapview').click();await expect(page.locator('.leaflet-container')).toBeVisible({timeout:60000});}
  await page.locator('.leaflet-marker-icon.map-pin-wrapper').first().click({timeout:60000});
  await expect(page.locator('.ds-map-person-popup')).toBeVisible();
  const target=(await page.locator('.ds-map-popup-title').innerText()).trim();
  await page.locator('.ds-map-popup-cta').click();await expect(page.getByTestId('dashboard-root')).toBeVisible({timeout:60000});
  await expect(page.getByTestId('dashboard-root')).toContainText(target,{timeout:30000});await page.waitForTimeout(2000);
  expect(await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))).toBeNull();expect(errors).toEqual([]);
  // Return from the map's Spotlight Cards tab, using the actual mobile Feed control.
  await page.getByTestId('mobile-nav-mapview').click();
  const toggle=page.locator('.map-panel-toggle-tab');if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await page.getByRole('tab',{name:/Spotlight Cards/}).click();
  await page.getByTestId('mobile-nav-dashboard').click();await expect(page.getByTestId('dashboard-root')).toBeVisible();await page.waitForTimeout(2000);
  expect(await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))).toBeNull();expect(errors).toEqual([]);
  results.push({freshDocument:cold,target,personViewInFeed:true,spotlightTabReturn:true,errors,failedAssets});
 }catch(error){await page.screenshot({path:`${output}/${baseURL.startsWith('https:')?'production':'local'}-${cold?'cold':'warm'}-failure.png`});
  await writeFile(`${output}/failure.json`,JSON.stringify({baseURL,cold,message:error.message,errors,failedAssets,boundary:await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))},null,2)+'\n');throw error;
 }finally{await context.close();}
}
await writeFile(`${output}/${baseURL.startsWith('https:')?'production':'local'}.json`,JSON.stringify({baseURL,pass:true,productionUserSession:false,realBackendWrites:0,mode:'REAL_FRONTEND_SYNTHETIC_AUTH_BACKEND',results},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
