import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs}=await import('../e2e/support/appActions.js');
const directory=process.env.PORTFOLIO_QA_DIRECTORY||'qa/portfolio-card-labels',baseURL=process.env.PORTFOLIO_QA_BASE_URL||'http://127.0.0.1:4180';
const l1Fixture=process.argv.includes('--l1')?JSON.parse(await readFile('qa/portfolio-rooms-layout/l1-property-fixture.json','utf8')):null;
await mkdir(directory,{recursive:true});const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const [device,width,height] of [['desktop',1280,1000],['phone',390,844]]){
  const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='phone',hasTouch:device==='phone'});
  const backend=await setupMockSupabase(context,{baseline:true,propertyOverrides:{address:l1Fixture?.address||'QA portfolio property',description:l1Fixture?.description||'QA description',price:90000,rehab:35000,cap_rate:null,beds:3,baths:2,sqft:1760,lot:5000,zip:'72204',hide_street_address_on_card:false,lat:35.92113,lng:-78.58355,geocode_status:'resolved',geocode_source:'explicit-qa-fixture',geocoded_at:'2026-10-13T00:00:00Z'}});
  // The exact owner notes reproduce the L1 continuation, without any real
  // session or production backend writes. Zero nuggets also selects FREE.
  if(l1Fixture){backend.users.investor.nuggets=0;backend.state.profileBioByUserId[backend.users.provider.id]=l1Fixture.description;}
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
  // On mobile the active sheet is rendered after the underlying portfolio.
  const facts=page.locator('.portfolio-property-facts').filter({visible:true}).last();
  await expect(facts).toBeVisible({timeout:60000});
  for(const id of ['price','capRate','rehab','type','strategy','beds','baths','buildingArea','zip','lot']){
    const fact=facts.locator(`[data-fact="${id}"]`);await expect(fact).toHaveCount(1);
    expect((await fact.locator('.portfolio-property-label').innerText()).trim().length).toBeGreaterThan(0);
  }
  await expect(facts.getByText('$35K',{exact:true})).toHaveCount(1);
  await expect(facts.locator('[data-fact="buildingArea"]')).toContainText('sqft');
  await expect(facts.locator('[data-fact="lot"]')).toContainText('sqft');
  await expect(facts.locator('[data-fact="zip"]')).toContainText('72204');
  await expect(facts.locator('[data-fact-group="rooms"]')).toHaveCount(1);
  const beds=await facts.locator('[data-fact="beds"]').boundingBox(),baths=await facts.locator('[data-fact="baths"]').boundingBox();
  expect(Math.abs(beds.y-baths.y)).toBeLessThan(2);
  let l1Downloaded=false;
  if(l1Fixture){
    const detail=page.locator('[data-guide="matches-property-detail"]').filter({visible:true}).last();
    await detail.getByRole('button',{name:'Export',exact:true}).click();
    await page.getByRole('button',{name:/Download to device \(PDF\)/i}).click();
    const pendingDownload=page.waitForEvent('download',{timeout:90000});
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    const downloaded=await pendingDownload;
    const file=`${directory}/${baseURL.startsWith('https:')?'production':'local'}-app-l1-${device}.pdf`;
    await downloaded.saveAs(file);expect((await readFile(file)).subarray(0,5).toString()).toBe('%PDF-');
    l1Downloaded=true;
  }
  expect(errors).toEqual([]);const production=baseURL.startsWith('https:');
  await page.screenshot({path:`${directory}/${production?'production':'local'}-app-${device}.png`,fullPage:true});
  results.push({device,errors,roomGroups:1,roomsOnSameLine:true,blankLabels:0,duplicatedRehab:0,completeUnits:true,l1Downloaded,simulatedFreeAccount:Boolean(l1Fixture)});await context.close();
 }
 await writeFile(`${directory}/${baseURL.startsWith('https:')?'production':'local'}-app.json`,JSON.stringify({mode:'REAL_APP_FRONTEND_WITH_SYNTHETIC_AUTH_BACKEND',frontend:baseURL,realBackendWrites:0,realUserSession:false,results},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await browser.close();}
