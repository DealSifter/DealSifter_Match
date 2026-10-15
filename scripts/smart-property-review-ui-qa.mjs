import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
const directory='qa/smart-property-enrichment/final-integration';
await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const language of ['pt','en','es'])for(const [device,width,height] of [['desktop',1280,900],['mobile',390,844]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:device==='mobile',hasTouch:device==='mobile'});
  await context.route('**/*.supabase.co/**',route=>route.abort());
  await context.route('**/__property_review_qa',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><button id="origin">Review</button><div id="root"></div>'}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4180/__property_review_qa');
  await page.evaluate(async language=>{
   window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
   await import('/src/index.css');
   const React=(await import('/node_modules/.vite/deps/react.js')).default;
   const reactDom=await import('/node_modules/.vite/deps/react-dom_client.js');const createRoot=reactDom.createRoot||reactDom.default.createRoot;
   const {PropertyFactReview}=await import('/src/features/propertyFacts/PropertyFactReview.jsx');
   const {reconcilePropertyFacts,applyFactDecisions}=await import('/supabase/functions/_shared/property-fact-reconciliation/model.ts');
   const root=createRoot(document.getElementById('root'));
   const property={id:'33333333-3333-4333-8333-333333333333',owner_id:'synthetic-owner',address:'100 Synthetic QA Street',city:'QA City',state:'NC',zip:'27614',type:'SFR',lot:5000,beds:3,baths:2,rehab:null};
   const candidate=(field,value,unit=null)=>({field,originalValue:value,value,unit,sourceType:'PUBLIC_PARCEL_GIS',sourceId:'synthetic-county',sourceFamily:'COUNTY_GIS:00000',sourceAuthority:'Synthetic county — not live GIS',evidenceStatus:'PUBLIC_RECORD',freshness:'FRESH'});
   let snapshot=await reconcilePropertyFacts(property,[candidate('lotArea',7000,'SQFT'),candidate('apn','000-TEST-001'),candidate('legalDescription','Synthetic public legal description '.repeat(20))]),revision=1;
   window.__reviewActions=[];window.__rawProperty=property;window.__getSnapshot=()=>snapshot;
   document.getElementById('origin').focus();
   const render=()=>root.render(React.createElement(PropertyFactReview,{request:{propertyId:property.id,field:'lotArea'},property,record:{snapshot,revision},language,onClose:()=>root.render(null),onCheck:async()=>{},onSubmit:async(action,values={})=>{
    window.__reviewActions.push({action,...values});
    const actions=action==='DECIDE'?values.decisions:action==='ACCEPT_ALL'?Object.values(snapshot.rows).filter(row=>row.pending&&row.bulkCandidateId).map(row=>({field:row.field,action:'ACCEPT_EXTERNAL_VALUE',candidateId:row.bulkCandidateId})):Object.values(snapshot.rows).filter(row=>row.pending).map(row=>({field:row.field,action:'REVIEW_LATER'}));
    snapshot=applyFactDecisions(snapshot,actions,'synthetic-owner');revision++;render();
   }}));window.__reopenReview=render;render();
  },language);
  const copy={pt:{title:'Revisar dados do imóvel',bulk:'Aceitar todos os dados sem conflito',keep:'Manter meu valor',apply:'Aplicar e voltar',later:'Revisar depois'},en:{title:'Review property facts',bulk:'Accept all non-conflicting additions',keep:'Keep my value',apply:'Apply and return',later:'Review later'},es:{title:'Revisar datos de la propiedad',bulk:'Aceptar todos los datos sin conflicto',keep:'Mantener mi valor',apply:'Aplicar y volver',later:'Revisar después'}}[language];
  const dialog=page.getByRole('dialog',{name:copy.title});await expect(dialog).toBeVisible();
  const geometry=await dialog.boundingBox();expect(geometry.height).toBe(height);
  expect(geometry.width).toBe(device==='mobile'?width:520);expect(geometry.x).toBe(device==='mobile'?0:width-520);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await expect(dialog.locator('[data-field="lotArea"]')).toBeFocused();
  await dialog.getByRole('button',{name:copy.bulk}).click();
  expect(await page.evaluate(()=>window.__getSnapshot().rows.apn.effective.value)).toBe('000-TEST-001');
  expect(await page.evaluate(()=>window.__getSnapshot().rows.lotArea.effective.state)).toBe('CONFLICTED');
  const article=dialog.locator('[data-field="lotArea"]');await article.getByRole('radio',{name:new RegExp(copy.keep)}).check();
  await dialog.getByRole('button',{name:copy.apply}).click();await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>window.__getSnapshot().rows.lotArea.effective.value)).toBe(5000);
  expect(await page.evaluate(()=>window.__rawProperty.lot)).toBe(5000);
  await expect(page.locator('#origin')).toBeFocused();await page.evaluate(()=>window.__reopenReview());
  await expect(dialog).toBeVisible();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);expect(errors).toEqual([]);
  results.push({language,device,geometry,layout:device==='mobile'?'FULL_SCREEN_SHEET':'RIGHT_DRAWER',bulkLeavesConflictUnresolved:true,explicitKeep:true,originalPreserved:true,focusRestored:true,escape:true,horizontalOverflow:false,errors});await context.close();
 }
 await writeFile(`${directory}/review-browser.json`,JSON.stringify({mode:'REAL_REACT_COMPONENT_SYNTHETIC_EVIDENCE',liveGisCalls:0,liveRentcastCalls:0,realUserSession:false,productionWrites:0,results},null,2)+'\n');console.log(JSON.stringify({pass:true,cases:results.length}));
}finally{await browser.close();}
