import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs}=await import('../e2e/support/appActions.js');
const directory='qa/portfolio-card-labels',baseURL=process.env.PORTFOLIO_QA_BASE_URL||'http://127.0.0.1:4180';
await mkdir(directory,{recursive:true});const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const [device,width,height] of [['desktop',1280,1000],['phone',390,844]]){
  const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='phone',hasTouch:device==='phone'});
  const backend=await setupMockSupabase(context,{baseline:true,propertyOverrides:{address:'QA portfolio property',price:90000,rehab:35000,cap_rate:null,beds:3,baths:2,sqft:1760,lot:5000,zip:'72204',hide_street_address_on_card:false,lat:35.92113,lng:-78.58355,geocode_status:'resolved',geocode_source:'explicit-qa-fixture',geocoded_at:'2026-10-13T00:00:00Z'}});
  await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());
  await context.route('**/*sentry.io/**',route=>route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await loginAs(page,backend.users.investor);
  const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
  await page.getByTestId(device==='phone'?'mobile-nav-matches':'nav-matches').click();
  await expect(page.getByTestId('matches-root')).toBeVisible({timeout:60000});
  const owner=page.locator('[data-guide="matches-people"]').getByText(backend.users.provider.fullName,{exact:true}).first();
  await expect(owner).toBeVisible({timeout:60000});await owner.click();
  // The existing guide action opens the same portfolio detail on both devices.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ds-guidetip-step',{detail:{target:'matches-property-detail'}})));
  const facts=page.locator('.portfolio-property-facts').filter({visible:true}).first();
  await expect(facts).toBeVisible({timeout:60000});
  for(const id of ['price','capRate','rehab','type','strategy','beds','baths','buildingArea','zip','lot']){
    const fact=facts.locator(`[data-fact="${id}"]`);await expect(fact).toHaveCount(1);
    expect((await fact.locator('.portfolio-property-label').innerText()).trim().length).toBeGreaterThan(0);
  }
  await expect(facts.getByText('$35K',{exact:true})).toHaveCount(1);
  await expect(facts.locator('[data-fact="buildingArea"]')).toContainText('sqft');
  await expect(facts.locator('[data-fact="lot"]')).toContainText('sqft');
  await expect(facts.locator('[data-fact="zip"]')).toContainText('72204');
  expect(errors).toEqual([]);const production=baseURL.startsWith('https:');
  await page.screenshot({path:`${directory}/${production?'production':'local'}-app-${device}.png`,fullPage:true});
  results.push({device,errors,blankLabels:0,duplicatedRehab:0,completeUnits:true});await context.close();
 }
 await writeFile(`${directory}/${baseURL.startsWith('https:')?'production':'local'}-app.json`,JSON.stringify({mode:'REAL_APP_FRONTEND_WITH_SYNTHETIC_AUTH_BACKEND',frontend:baseURL,realBackendWrites:0,realUserSession:false,results},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
