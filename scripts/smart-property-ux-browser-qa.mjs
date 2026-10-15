import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {reconcilePropertyFacts} from '../supabase/functions/_shared/property-fact-reconciliation/model.ts';
import {runPropertyFactReview} from '../supabase/functions/_shared/property-fact-reconciliation/runtime.ts';
import {publicEffectiveFacts} from '../supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js';
process.env.E2E_SUPABASE_URL='https://cyeipfskwwisbbayyaca.supabase.co';
const {setupMockSupabase}=await import('../e2e/support/mockSupabase.js');
const {loginAs}=await import('../e2e/support/appActions.js');
const directory='qa/smart-property-enrichment/ux-stabilization',baseURL=process.env.REVIEW_QA_BASE_URL||'http://127.0.0.1:4180',baseline=process.env.REVIEW_QA_BASELINE==='1';
await mkdir(directory,{recursive:true});const browser=await chromium.launch({headless:true}),results=[];
const jsonb=value=>Array.isArray(value)?value.map(jsonb):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,jsonb(item)])):value;
const fulfilled=(route,value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
try{
 const cases=(baseline?[['desktop',1280,900,'en-US']]:[['desktop',1280,900],['mobile',390,844]].flatMap(device=>['pt-BR','en-US','es-ES'].map(language=>[...device,language]))).filter(([device,,,language])=>!process.env.REVIEW_QA_CASE||`${device}-${language}`===process.env.REVIEW_QA_CASE);
 for(const [device,width,height,language] of cases){
  const context=await browser.newContext({baseURL,viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile',reducedMotion:'reduce'});
  await context.addInitScript(language=>{
   localStorage.setItem('lang',language);localStorage.removeItem('ds_last_error_boundary');window.__ux={genericLoaderFlashes:0,suppressedBackgroundPollTicks:0};
   // Isolate modal-triggered requests from the existing 30s inventory/auth polling clocks.
   // Identical controlled clocks are used for pre-fix and post-fix frontend measurements.
   const nativeInterval=window.setInterval.bind(window);window.setInterval=(fn,delay,...args)=>nativeInterval(delay===30000?()=>{window.__ux.suppressedBackgroundPollTicks++;}:fn,delay,...args);
   const seen=new WeakSet();new MutationObserver(()=>{for(const node of document.querySelectorAll('.ds-app-boot-screen'))if(!seen.has(node)&&node.textContent.includes('Loading your DealSifter data')){seen.add(node);window.__ux.genericLoaderFlashes++;}}).observe(document,{subtree:true,childList:true});
  },language);
  const backend=await setupMockSupabase(context,{baseline:true}),actor=backend.users.provider.id;
  const ids=[backend.ids.property,'77777777-7777-4777-8777-777777777777','88888888-8888-4888-8888-888888888888'];
  const properties=ids.map((id,index)=>({id,owner_id:actor,card_kind:'property',address:`${100+index} Synthetic QA Street`,city:'QA City',state:'NC',zip:'27614',type:'SFR',price:250000,sqft:1760,beds:4,baths:3,bedrooms:4,bathrooms:3,lot:5000,rehab:null,estimated_rehab:null,objective:'Sell',description:'Synthetic review QA description',primary_profile:'personal',publish_to_showcase:true,is_active:true,deal_closed:false,hide_street_address_on_card:false,lat:35.92113,lng:-78.58355,geocode_status:'resolved',geocode_source:'qa-explicit',geocoded_at:'2026-10-15T00:00:00Z',images:[],created_at:'2026-01-01T00:00:00Z'}));
  const ev=(field,value,unit=null,sourceType='PUBLIC_PARCEL_GIS')=>({field,originalValue:value,value,unit,sourceType,sourceId:'qa-county',sourceFamily:sourceType==='RENTCAST'?'RENTCAST':'COUNTY_GIS:00000',evidenceStatus:'PUBLIC_RECORD',freshness:'FRESH'});
  const additions=[ev('apn','000-TEST'),ev('owner','QA OWNER'),ev('assessedValue',120000,'USD'),ev('propertyTax',2000,'USD'),ev('zoning','R1'),ev('yearBuilt',1980),ev('subdivision','QA SUBDIVISION'),ev('legalDescription','QA LEGAL')];
  const evidence=[[ev('lotArea',7000,'SQFT','RENTCAST')],additions,[]],stored={};
  for(let i=0;i<ids.length;i++)stored[ids[i]]={state:jsonb(await reconcilePropertyFacts(properties[i],evidence[i])),revision:1};
  stored[ids[2]].state.summary={complements:0,conflicts:1,pending:1};for(const row of Object.values(stored[ids[2]].state.rows))if(row.currentValue!=null)row.effective.adopted=true;
  const actions=[],ownerQueries=[],publicQueries=[],writes=[];let refreshDelay=0,acquisitions=0;
  await context.route('**/rest/v1/properties*',route=>route.request().method()==='GET'?fulfilled(route,properties):route.fallback());
  await context.route('**/rest/v1/property_fact_reviews*',route=>{ownerQueries.push(new URL(route.request().url()).searchParams.get('owner_id'));return fulfilled(route,ids.map(id=>({property_id:id,state:stored[id].state,revision:stored[id].revision})));});
  await context.route('**/rest/v1/rpc/ds_public_effective_property_facts',route=>{publicQueries.push(route.request().postDataJSON());return fulfilled(route,ids.map(id=>({property_id:id,facts:publicEffectiveFacts(stored[id].state)})));});
  await context.route('**/rest/v1/notifications*',route=>fulfilled(route,route.request().method()==='GET'?[{id:'99999999-9999-4999-8999-999999999999',user_id:actor,type:'property_data',payload:{property_id:ids[1],field:'apn',complements:8,conflicts:99,evidence_hash:stored[ids[1]].state.evidenceHash},created_at:new Date().toISOString(),read_at:null}]:[]));
  await context.route('**/functions/v1/property-fact-review',async route=>{
   const body=route.request().postDataJSON();actions.push({action:body.action,propertyId:body.propertyId,decisions:body.decisions?.length||0});
   if(body.action==='CHECK'&&refreshDelay)await new Promise(resolve=>setTimeout(resolve,refreshDelay));
   try{const result=await runPropertyFactReview(body,{userId:actor,loadOwnedProperty:async id=>properties.find(p=>p.id===id)||null,loadReview:async id=>stored[id]||null,acquire:async property=>{acquisitions++;return evidence[ids.indexOf(property.id)];},store:async(id,_owner,revision,state)=>{expect(revision).toBe(stored[id].revision);stored[id]={state:jsonb(state),revision:revision+1};writes.push(id);return revision+1;}});await fulfilled(route,{success:true,data:result});}
   catch(error){await fulfilled(route,{success:false,error:error.message},/STALE|FACTS_CHANGED/.test(error.message)?409:400);}
  });
  await context.route('**/*.supabase.co/**',route=>route.request().url().startsWith(process.env.E2E_SUPABASE_URL)?route.fallback():route.abort());await context.route('**/*sentry.io/**',route=>route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));const start=Date.now();await loginAs(page,backend.users.provider);const startupObservedMs=Date.now()-start;
  const guide=page.getByRole('dialog',{name:/DealSifter Guide/i});if(await guide.isVisible())await guide.getByRole('button',{name:/Close guide/i}).click();
  if(device==='mobile')await page.getByTestId('mobile-nav-onboarding').click();else await page.getByTestId('dashboard-root').getByRole('button',{name:/ profile$/}).first().click();
  const portfolio=page.getByTestId('onboarding-root');await expect(portfolio).toBeVisible({timeout:60000});await expect(portfolio.locator('[data-guide="onboarding-records"]')).toContainText('Synthetic QA Street');
  if(baseline){
   const controls=portfolio.locator('.property-fact-review-link');await expect(controls).toHaveCount(3);const before=publicQueries.length;await controls.first().click();await expect(page.locator('.property-fact-review')).toBeVisible();
   await expect.poll(()=>actions.some(action=>action.action==='READ')).toBe(true);await expect.poll(()=>publicQueries.length).toBeGreaterThan(before);
   results.push({device,language,standaloneButtons:await controls.count(),reviewOpenRequests:actions,publicQueriesBeforeOpen:before,publicQueriesAfterOpen:publicQueries.length,genericLoaderFlashes:await page.evaluate(()=>window.__ux.genericLoaderFlashes),startupObservedMs,mode:'PRE_FIX_PUBLISHED_FRONTEND'});
  }else{
   const copy={pt:{edit:'Editar Imóvel',warning:'Há dados divergentes para revisar',keep:'Manter meu valor',bulk:'Selecionar complementos',apply:'Aplicar e voltar',back:'Voltar à edição',check:'Consultar dados disponíveis',quiet:'Sem novos dados para revisar.'},en:{edit:'Edit Property',warning:'Conflicting facts need review',keep:'Keep my value',bulk:'Select additions',apply:'Apply and return',back:'Back to editing',check:'Check available facts',quiet:'No new facts to review.'},es:{edit:'Editar Propiedad',warning:'Hay datos divergentes para revisar',keep:'Mantener mi valor',bulk:'Seleccionar datos nuevos',apply:'Aplicar y volver',back:'Volver a la edición',check:'Consultar datos disponibles',quiet:'No hay nuevos datos para revisar.'}}[language.slice(0,2)];
   expect(await portfolio.locator('.property-fact-review-link,.portfolio-fact-review-action').count()).toBe(0);await expect(portfolio.locator('.property-fact-warning')).toHaveCount(1);expect(actions).toEqual([]);
   const ownerBatches=ownerQueries.length,publicBefore=publicQueries.length;
   await portfolio.getByTestId(`property-edit-${ids[0]}`).click();const modal=page.locator('.ds-modal-content').filter({has:page.getByTestId('property-edit-page1')});await expect(modal).toBeVisible();expect(await page.getByRole('dialog').count()).toBe(1);await modal.evaluate(el=>{el.dataset.qaShell='same-edit-shell';});
   await expect(modal.locator('[data-testid="property-edit-page1"]')).toBeVisible();await modal.locator('textarea').fill('Synthetic unsaved edit retained');
   const warning=modal.getByRole('button',{name:copy.warning});await expect(warning).toBeVisible();await page.emulateMedia({reducedMotion:'no-preference'});expect(await warning.evaluate(el=>getComputedStyle(el).animationName)).toBe('ds-fact-attention');await page.emulateMedia({reducedMotion:'reduce'});expect(await warning.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');await warning.click();
   const review=modal.getByTestId('property-review-page2');await expect(review).toBeVisible();expect(await modal.getAttribute('data-qa-shell')).toBe('same-edit-shell');expect(actions).toEqual([]);await expect(review.locator('article')).toHaveCount(1);await expect(review).toContainText('RentCast');
   await review.getByRole('radio',{name:copy.keep,exact:true}).check();expect(actions).toEqual([]);await review.getByRole('button',{name:copy.apply,exact:true}).click();await expect(modal.getByTestId('property-edit-page1')).toBeVisible();
   await expect(modal.locator('textarea')).toHaveValue('Synthetic unsaved edit retained');await expect(modal.locator('.property-fact-warning')).toHaveCount(0);expect(actions.map(action=>action.action)).toEqual(['DECIDE']);expect(publicQueries.length).toBe(publicBefore);expect(stored[ids[0]].state.rows.lotArea.decision.action).toBe('KEEP_MY_VALUE');await modal.getByRole('button',{name:'Close dialog',exact:true}).click();
   // Actual notification click in English desktop; controlled owner deep links in other locales/devices.
   if(device==='desktop'&&language==='en-US'){
    await page.getByTitle('Notifications',{exact:true}).click();await page.getByRole('button',{name:/System Msgs/}).click();
    await page.locator('[role="button"]').filter({hasText:'New facts available'}).last().click();
   }else await page.evaluate(({actor,id})=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'apn'}})),{actor,id:ids[1]});
   await expect(modal).toBeVisible();await expect(review).toBeVisible();await expect(review.locator('article')).toHaveCount(8);await expect(modal.locator('.property-fact-warning')).toHaveCount(0);
   await review.getByRole('button',{name:copy.bulk,exact:true}).click();expect(await review.locator('input:checked').count()).toBe(8);expect(actions).toHaveLength(1);
   await page.screenshot({path:`${directory}/${baseURL.startsWith('https:')?'production':'local'}-${device}-${language}-review.png`});
   await review.getByRole('button',{name:copy.apply,exact:true}).click();await expect(modal.getByTestId('property-edit-page1')).toBeVisible();expect(stored[ids[1]].state.summary.pending).toBe(0);expect(Object.values(stored[ids[1]].state.rows).filter(row=>row.decision?.action==='ACCEPT_EXTERNAL_VALUE')).toHaveLength(8);expect(actions).toHaveLength(2);expect(actions[1].decisions).toBe(8);expect(acquisitions).toBe(0);await modal.getByRole('button',{name:'Close dialog',exact:true}).click();
   // A stale summary alone cannot create warning or fictitious comparison rows.
   await page.evaluate(({actor,id})=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'beds'}})),{actor,id:ids[2]});await expect(review).toBeVisible();await expect(review.locator('article')).toHaveCount(0);await expect(review).toContainText(copy.quiet);
   refreshDelay=1200;await review.getByRole('button',{name:copy.check,exact:true}).click();const closeStart=Date.now();await modal.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(modal).toHaveCount(0);const closeObservedMs=Date.now()-closeStart;
   await page.waitForTimeout(1400);expect(await page.evaluate(()=>localStorage.getItem('ds_last_error_boundary'))).toBeNull();expect(errors).toEqual([]);expect(ownerQueries.length).toBe(ownerBatches);expect(await page.locator('.property-fact-review-backdrop').count()).toBe(0);
   const flashes=await page.evaluate(()=>window.__ux.genericLoaderFlashes);expect(flashes).toBe(0);
   // Recreate the whole app/provider from persisted JSONB, rather than relying on local React state.
   const actionsBeforeReload=actions.length;await page.reload({waitUntil:'domcontentloaded'});
   await expect(page.getByTestId('dashboard-root')).toBeVisible({timeout:60000});
   await page.evaluate(({actor,id})=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'apn'}})),{actor,id:ids[1]});
   await expect(review).toBeVisible({timeout:60000});await expect(review.locator('article')).toHaveCount(0);await expect(review).toContainText(copy.quiet);await expect(modal.locator('.property-fact-warning')).toHaveCount(0);expect(actions.length).toBe(actionsBeforeReload);
   await modal.getByRole('button',{name:'Close dialog',exact:true}).click();expect(errors).toEqual([]);
   results.push({device,language,startupObservedMs,closeObservedMs,closeNetworkDependencies:0,ownerQueries:ownerBatches,publicQueries:publicBefore,actions,writes:writes.length,providerAcquisitionsFromApply:0,portfolioProviderFanout:0,reviewOpenProviderCalls:0,radioNetworkMutations:0,modalShellPreserved:true,standaloneButtons:0,independentDrawers:0,conflictOnlyWarning:true,staleSummarySuppressed:true,eightComplementApply:true,fullReloadPersistence:true,genericLoaderFlashes:flashes,errors});
  }
  console.log(JSON.stringify({device,language,baseline,passed:true}));await context.close();
 }
 await writeFile(`${directory}/${process.env.REVIEW_QA_RESULT_NAME||(baseline?'browser-before':baseURL.startsWith('https:')?'browser-production':'browser-local')}.json`,JSON.stringify({frontend:baseURL,mode:'REAL_APP_EXPLICIT_MOCK_AUTH_BACKEND_JSONB_KEY_ORDER',background30sPollClock:'CONTROLLED_TO_ISOLATE_REVIEW_REQUESTS',realUserSession:false,realBackendWrites:0,results},null,2)+'\n');console.log(JSON.stringify({pass:true,cases:results.length,baseline}));
}finally{await browser.close();}
