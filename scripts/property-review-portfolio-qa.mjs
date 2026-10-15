import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {reconcilePropertyFacts,publicEffectiveFacts} from '../supabase/functions/_shared/property-fact-reconciliation/model.ts';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs}=await import('../e2e/support/appActions.js');
const directory='qa/property-review-portfolio-fix',baseURL=process.env.REVIEW_QA_BASE_URL||'http://127.0.0.1:4180',expectCrash=process.env.REVIEW_EXPECT_CRASH==='1';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 const cases=[['desktop',1280,900],['mobile',390,844]].flatMap(device=>['pt-BR','en-US'].map(language=>[...device,language]));
 for(const [device,width,height,language] of expectCrash?cases.slice(0,1):cases){
  const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile'});
  await context.addInitScript(language=>{localStorage.setItem('lang',language);localStorage.removeItem('ds_last_error_boundary');},language);
  const backend=await setupMockSupabase(context,{baseline:true});
  const actor=backend.users.provider.id,id=backend.ids.property;
  const property={id,owner_id:actor,address:'100 Synthetic QA Street',city:'QA City',state:'NC',zip:'27614',type:'SFR',lot:5000,beds:3,baths:2,rehab:null};
  // Same persisted v1 contract as production. No external evidence is required to reproduce the empty-field focus failure.
  const snapshot=await reconcilePropertyFacts(property,[]),actions=[];
  await context.route('**/rest/v1/property_fact_reviews*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{property_id:id,state:snapshot,revision:2}])}));
  await context.route('**/rest/v1/rpc/ds_public_effective_property_facts',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{property_id:id,facts:publicEffectiveFacts(snapshot)}])}));
  await context.route('**/functions/v1/property-fact-review',route=>{const body=route.request().postDataJSON();actions.push(body.action);expect(body.action).toBe('READ');return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:{propertyId:id,snapshot,revision:2}})});});
  await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());
  await context.route('**/*sentry.io/**',route=>route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await loginAs(page,backend.users.provider);
  const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
  if(device==='mobile')await page.getByTestId('mobile-nav-onboarding').click();
  else await page.getByTestId('dashboard-root').getByRole('button',{name:/ profile$/}).first().click();
  const portfolio=page.getByTestId('onboarding-root');await expect(portfolio).toBeVisible({timeout:60000});
  const button=portfolio.locator('.property-fact-review-link').first();await expect(button).toBeVisible({timeout:60000});
  if(!expectCrash)await expect(button).toHaveText(language==='pt-BR'?'Revisar dados':'Review facts');
  await button.click();
  if(expectCrash){
   await expect.poll(()=>page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))).toBeTruthy();
   const boundary=JSON.parse(await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary')));
   expect(boundary.message).toMatch(/focus.*not a function/);
   results.push({device,language,reproduced:true,error:boundary.message});
  }else{
   const dialog=page.getByRole('dialog',{name:language==='pt-BR'?'Revisar dados do imóvel':'Review property facts'});
   await expect(dialog).toBeVisible();await expect(dialog).toBeFocused();
   await expect(dialog).toContainText(language==='pt-BR'?'Sem novos dados para revisar.':'No new facts to review.');
   const geometry=await dialog.boundingBox();expect(geometry.height).toBe(height);expect(geometry.width).toBe(device==='mobile'?width:520);
   await page.screenshot({path:`${directory}/${baseURL.startsWith('https:')?'production':'local'}-${device}-${language}.png`});
   await expect(dialog.locator('header button')).toBeEnabled();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();
   await button.click();await expect(dialog).toBeVisible();await dialog.locator('header button').click();await expect(dialog).toHaveCount(0);
   expect(await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))).toBeNull();expect(errors).toEqual([]);expect(actions).toEqual(['READ','READ']);
   results.push({device,language,portfolioButton:true,emptyField:true,persistedSnapshot:true,localized:true,closeReopen:true,focusRestored:true,actions,errors,geometry});
  }
  console.log(JSON.stringify({device,language,passed:true,reproduced:expectCrash}));await context.close();
 }
 await writeFile(`${directory}/${expectCrash?'reproduced':baseURL.startsWith('https:')?'production':'local'}.json`,JSON.stringify({frontend:baseURL,mode:'REAL_APP_EXPLICIT_MOCK_AUTH_AND_BACKEND',realUserSession:false,realBackendWrites:0,results},null,2)+'\n');
 console.log(JSON.stringify({pass:true,expectCrash,cases:results.length}));
}finally{await browser.close();}
