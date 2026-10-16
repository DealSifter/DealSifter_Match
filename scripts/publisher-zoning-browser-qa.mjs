import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {runPropertyFactReview} from '../supabase/functions/_shared/property-fact-reconciliation/runtime.ts';
import {publicEffectiveFacts} from '../supabase/functions/_shared/property-fact-reconciliation/model.ts';
import {buildPropertyFactLookupAnswer} from '../supabase/functions/_shared/maxxis/propertyFactLookup.ts';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js'),{loginAs}=await import('../e2e/support/appActions.js');
const directory='qa/publisher-zoning-match',baseURL=process.env.PUBLISHER_QA_BASE_URL||'http://127.0.0.1:4182';await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
const reply=(route,data,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*'},contentType:'application/json',body:JSON.stringify(data)});
const cases=[['desktop',1280,900,'light'],['desktop',1280,900,'dark'],['mobile',390,844,'light'],['mobile',390,844,'dark']];
try{for(const[device,width,height,theme]of cases){
 let record=null,published=0;const privateAssumptions={},calls=[];
 async function account(role){
  const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile'});
  await context.addInitScript(theme=>{localStorage.setItem('theme',theme);localStorage.setItem('lang','pt');const viewport={center:[33.651,-86.681],zoom:15};sessionStorage.setItem('mapViewport',JSON.stringify(viewport));sessionStorage.setItem('ds_mapview_ui_state_v1',JSON.stringify({showPeople:false,showProperties:true,panelCollapsed:true,viewport}));},theme);
  const fixtureOptions={baseline:true};const backend=await setupMockSupabase(context,fixtureOptions),actor=backend.users[role].id;
  const property={id:backend.ids.property,owner_id:backend.users.provider.id,card_kind:'property',address:'100 Synthetic Land Dr',city:'QA City',state:'AL',zip:'35126',type:'Land',price:15000,lot:5000,beds:null,baths:null,rehab:null,objective:'Sell',primary_profile:'personal',description:'Synthetic land QA',publish_to_showcase:true,is_active:true,lat:33.651,lng:-86.681,geocode_status:'resolved',geocode_source:'explicit-qa-fixture',geocoded_at:'2026-10-15T00:00:00Z',images:[]};
  property.hide_street_address_on_card=false;fixtureOptions.propertyOverrides=property;
  await context.route('**/rest/v1/properties*',route=>route.request().method()==='GET'?reply(route,[property]):route.fallback());
  await context.route('**/rest/v1/property_fact_reviews*',route=>reply(route,actor===property.owner_id&&record?[{property_id:property.id,state:record.state,revision:record.revision}]:[]));
  await context.route('**/rest/v1/rpc/ds_public_effective_property_facts',route=>reply(route,record?[{property_id:property.id,facts:publicEffectiveFacts(record.state)}]:[]));
  await context.route('**/functions/v1/maxxis-analysis-inputs',route=>{const body=route.request().postDataJSON();if(body.action==='UPSERT')privateAssumptions[actor]={...privateAssumptions[actor],...body.dealAssumptions};return reply(route,{success:true,data:{deal_assumptions:privateAssumptions[actor]||{}}});});
  await context.route('**/functions/v1/property-fact-review',async route=>{const body=route.request().postDataJSON();calls.push({actor,action:body.action});try{
   const result=await runPropertyFactReview(body,{userId:actor,loadOwnedProperty:async()=>property,loadReview:async()=>record,acquire:async()=>{throw Error('UNEXPECTED_PROVIDER_ACQUISITION');},store:async(_id,_owner,revision,state)=>{expect(revision).toBe(record?.revision??0);record={state:JSON.parse(JSON.stringify(state)),revision:revision+1};published++;return record.revision;}});await reply(route,{success:true,data:result});
  }catch(error){await reply(route,{success:false,error:error.message},400);}});
  await context.route('**/functions/v1/maxxis-chat',route=>{const answer=buildPropertyFactLookupAnswer(route.request().postDataJSON().message,'pt',{effectivePropertyFacts:record?publicEffectiveFacts(record.state):{}});return reply(route,{message:answer?.text||'Synthetic QA',answer:answer?.text||'Synthetic QA',type:'text',data:null,actions:[]});});
  await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());await context.route('**/*sentry.io/**',route=>route.abort());
  const page=await context.newPage(),errors=[],consoleErrors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});await loginAs(page,backend.users[role]);
  const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
  if(role==='provider')return {context,page,errors,property,backend,actor};
  const nav=device==='mobile'?'mobile-nav-mapview':'nav-mapview';await page.getByTestId(nav).click();
  try{await expect(page.locator('.leaflet-container')).toBeVisible({timeout:60000});await page.locator('.leaflet-marker-icon.map-pin-wrapper').first().click({timeout:15000});await expect(page.locator('.ds-property-leaflet-popup')).toBeVisible();}
  catch(error){await page.screenshot({path:`${directory}/fixture-failure.png`});await writeFile(`${directory}/fixture-failure.json`,JSON.stringify({role,errors,consoleErrors,body:await page.locator('body').innerText()},null,2));throw error;}
  return {context,page,errors,property,backend,actor};
 }
 const owner=await account('provider');await owner.page.getByTestId('maxxis-fab').click();await owner.page.getByTestId('maxxis-input').fill('100 Synthetic Land Dr; zoneamento R2');await owner.page.getByTestId('maxxis-send').click();
 const share=owner.page.getByRole('button',{name:'Compartilhar zoneamento R2 no imóvel'});await expect(share).toBeVisible({timeout:60000});expect(published).toBe(0);await share.click();await expect(owner.page.getByRole('button',{name:'Zoneamento R2 compartilhado'})).toBeDisabled();expect(published).toBe(1);expect(record.state.publisherDeclarations.zoning.by).toBe(owner.actor);await owner.context.close();
 const viewer=await account('investor'),match=viewer.page.getByRole('button',{name:'Match',exact:true});await expect(match).toBeEnabled();
 if(await match.getAttribute('aria-pressed')==='true'){await match.click();await expect(match).toHaveAttribute('aria-pressed','false');}
 const unselected=await match.evaluate(el=>{const s=getComputedStyle(el),icon=getComputedStyle(el.querySelector('.ds-property-pin-check'));const reference=document.createElement('button');reference.className='ds-property-pin-lens';el.parentElement.append(reference);const r=getComputedStyle(reference);const result={color:s.color,border:s.borderColor,background:s.backgroundColor,iconOpacity:icon.opacity,lensColor:r.color,lensBorder:r.borderColor,lensBackground:r.backgroundColor};reference.remove();return result;});
 expect(unselected.color).toBe(unselected.lensColor);expect(unselected.border).toBe(unselected.lensBorder);expect(unselected.background).toBe(unselected.lensBackground);expect(unselected.iconOpacity).toBe('1');
 await match.click();await expect(match).toHaveAttribute('aria-pressed','true');const selected=await match.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));expect(selected.background).toBe('rgb(117, 186, 117)');expect(selected.color).toBe('rgb(7, 28, 35)');
 await viewer.page.screenshot({path:`${directory}/${baseURL.startsWith('https:')?'production':'local'}-${device}-${theme}-match.png`});
 await viewer.page.getByTestId('maxxis-fab').click();await viewer.page.getByTestId('maxxis-input').fill('Qual o zoneamento?');await viewer.page.getByTestId('maxxis-send').click();await expect(viewer.page.getByTestId('maxxis-messages')).toContainText('Informado pelo publicador');await expect(viewer.page.getByTestId('maxxis-messages')).toContainText('R2');expect(await viewer.page.getByRole('button',{name:/Compartilhar zoneamento/}).count()).toBe(0);
 expect(privateAssumptions[viewer.actor]).toBeUndefined();expect(published).toBe(1);expect(owner.errors).toEqual([]);expect(viewer.errors).toEqual([]);
 results.push({device,theme,explicitOwnerPublication:true,otherAccountReadsDeclaredR2:true,nonownerCannotPublish:true,privateAssumptionsIsolated:true,publicationWrites:published,unselected,selected,errors:[]});await viewer.context.close();console.log(JSON.stringify({device,theme,pass:true}));
}
await writeFile(`${directory}/${baseURL.startsWith('https:')?'browser-production':'browser-local'}.json`,JSON.stringify({pass:true,baseURL,realAuthenticatedSession:false,realBackendWrites:0,mode:'REAL_APP_TWO_SYNTHETIC_ACCOUNTS_REAL_RECONCILIATION_RUNTIME',results},null,2)+'\n');}finally{await browser.close();}
