import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {reconcilePropertyFacts,publicEffectiveFacts} from '../supabase/functions/_shared/property-fact-reconciliation/model.ts';
import {runPropertyFactReview} from '../supabase/functions/_shared/property-fact-reconciliation/runtime.ts';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs,logout}=await import('../e2e/support/appActions.js');
const directory='qa/smart-property-enrichment/final-integration',baseURL=process.env.ENRICHMENT_QA_BASE_URL||'http://127.0.0.1:4180';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const [device,width,height] of [['desktop',1280,1000],['mobile',390,844]]){
  const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile'});
  const backend=await setupMockSupabase(context,{baseline:true});
  const actor=backend.users.provider.id,id=backend.ids.property;
  const property={id,owner_id:actor,address:'100 Synthetic QA Street',city:'QA City',state:'NC',zip:'27614',type:'SFR',lot:5000,beds:3,baths:2,rehab:null};
  const external=[{field:'lotArea',originalValue:7000,value:7000,unit:'SQFT',sourceType:'PUBLIC_PARCEL_GIS',sourceId:'synthetic',sourceFamily:'COUNTY_GIS:00000',evidenceStatus:'PUBLIC_RECORD',freshness:'FRESH'}];
  let stored={state:await reconcilePropertyFacts(property,external),revision:1},checks=0,writes=0,readAt=null;
  const requests=[],ownersRead=[];
  context.on('request',request=>{if(request.url().includes('/rest/v1/property_fact_reviews'))ownersRead.push(new URL(request.url()).searchParams.get('owner_id'));});
  await context.route('**/rest/v1/property_fact_reviews*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{property_id:id,state:stored.state,revision:stored.revision}])}));
  await context.route('**/rest/v1/rpc/ds_public_effective_property_facts',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{property_id:id,facts:publicEffectiveFacts(stored.state)}])}));
  await context.route('**/rest/v1/notifications*',route=>{if(route.request().method()==='PATCH')readAt=route.request().postDataJSON()?.read_at;return route.fulfill({contentType:'application/json',body:JSON.stringify(route.request().method()==='GET'?[{id:'55555555-5555-4555-8555-555555555555',user_id:actor,type:'property_data',payload:{property_id:id,field:'lotArea',complements:0,conflicts:1,evidence_hash:stored.state.evidenceHash},created_at:new Date().toISOString(),read_at:readAt}]:[])});});
  await context.route('**/functions/v1/property-fact-review',async route=>{
   const body=route.request().postDataJSON();requests.push(body.action);
   try{const result=await runPropertyFactReview(body,{userId:actor,loadOwnedProperty:async wanted=>wanted===id?property:null,loadReview:async()=>stored,acquire:async()=>{checks++;return external;},store:async(_id,_actor,revision,state)=>{expect(revision).toBe(stored.revision);stored={state,revision:revision+1};writes++;return stored.revision;}});
    await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:result})});
   }catch(error){await route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,error:error.message})});}
  });
  await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());
  await context.route('**/*sentry.io/**',route=>route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await loginAs(page,backend.users.provider);
  expect(backend.state.currentUserId).toBe(actor);
  const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
  if(device==='desktop'){
   await page.getByTitle('Notifications',{exact:true}).click();
   await page.getByRole('button',{name:/System Msgs/}).click();
   const notice=page.locator('[role="button"]').filter({hasText:'Review property facts'}).last();await expect(notice).toBeVisible({timeout:30000});await notice.click();
  }else await page.evaluate(({actor,id})=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'lotArea'}})),{actor,id});
  const dialog=page.getByRole('dialog',{name:'Review property facts'});try{await expect(dialog).toBeVisible({timeout:30000});}catch(error){console.log(JSON.stringify({syntheticDiagnostic:true,device,expectedActor:actor,actualActor:backend.state.currentUserId,ownersRead,requests,errors}));throw error;}await expect(dialog.locator('[data-field="lotArea"]')).toBeFocused();
  await dialog.locator('[data-field="lotArea"]').getByRole('radio',{name:/Keep my value/}).check();await dialog.getByRole('button',{name:'Apply and return'}).click();await expect(dialog).toHaveCount(0);expect(stored.state.rows.lotArea.decision.action).toBe('KEEP_MY_VALUE');expect(checks).toBe(0);
  const beforeRefresh=ownersRead.length;await page.reload();await page.getByTestId(device==='mobile'?'mobile-nav-dashboard':'nav-dashboard').waitFor({timeout:60000});await expect.poll(()=>ownersRead.length,{timeout:60000}).toBeGreaterThan(beforeRefresh);
  await page.evaluate(({actor,id})=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'lotArea'}})),{actor,id});
  await expect(dialog).toBeVisible({timeout:60000});await expect(dialog.locator('[data-field="lotArea"]')).toContainText('Choice saved');
  await dialog.locator('header button').click();const beforeLogin=ownersRead.length;await logout(page);await page.goto('/');await loginAs(page,backend.users.provider);await expect.poll(()=>ownersRead.length,{timeout:60000}).toBeGreaterThan(beforeLogin);
  await page.evaluate(({actor,id})=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'lotArea'}})),{actor,id});
  await expect(dialog).toBeVisible({timeout:60000});await expect(dialog.locator('[data-field="lotArea"]')).toContainText('Choice saved');expect(checks).toBe(0);
  expect(errors).toEqual([]);results.push({device,requests,checks,writes,notificationClick:device==='desktop',exactFieldDeepLink:true,persistedAfterRefresh:true,persistedAfterLogoutLogin:true,backend:'SYNTHETIC_OWNER_SCOPED_RUNTIME',realUserSession:false,realBackendWrites:0,errors});await context.close();
 }
 await writeFile(`${directory}/${baseURL.startsWith('https:')?'production-':'local-'}app-review.json`,JSON.stringify({frontend:baseURL,mode:'REAL_APP_MOCK_AUTH_BACKEND_REAL_RECONCILIATION_RUNTIME',results},null,2)+'\n');console.log(JSON.stringify({pass:true,cases:results.length}));
}finally{await browser.close();}
