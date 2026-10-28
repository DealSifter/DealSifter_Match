import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createCanvas, Image, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { reportIntegrityFixtures } from './report-integrity-fixtures.mjs';

const directory='qa/analytical-delivery-recovery';
await mkdir(directory,{recursive:true});
let networkCalls=0;
globalThis.fetch=async()=>{networkCalls++;throw Error('LIVE_NETWORK_FORBIDDEN');};
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D,Image,document:{createElement(tag){if(tag==='canvas')return createCanvas(1,1);if(tag==='img')return new Image();throw Error('UNSUPPORTED_QA_ELEMENT');}}});
const server=await createServer({configFile:false,server:{middlewareMode:true,watch:null},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});
const receipt={baseline:'6cefdb1ac4b54b6b4734bbd401667043e226acf1',mode:'DETERMINISTIC_OFFLINE_CONTROLS_NOT_AUTHENTICATED_SMOKE',liveProviderCalls:0,liveBackendCalls:0,cases:[]};
try{
 const load=path=>server.ssrLoadModule(path);
 const {orchestrateDealInsightContext}=await load('/supabase/functions/_shared/maxxis/dealInsightContext.ts');
 const {calculatePropertyMatch}=await load('/supabase/functions/_shared/maxxis/calculatePropertyMatch.ts');
 const {calculateDealMetrics}=await load('/supabase/functions/_shared/maxxis/dealMetrics.ts');
 const {projectMaxxisDealIntelligenceResponse}=await load('/src/features/maxxis/intelligence/maxxisDealIntelligenceReport.js');
 const {projectMaxxisAnalysisResponse}=await load('/src/features/maxxis/intelligence/maxxisAnalysisReport.js');
 const {renderMaxxisReportPdf}=await load('/src/features/maxxis/export/maxxisReportPdf.js');
 const {resolveReportExportEntitlement}=await load('/src/features/maxxis/export/reportExportEntitlement.js');
 const {buildStrictReportViewModel}=await load('/src/features/maxxis/export/reportIntegrityViewModel.ts');
 const {MarketRentService}=await load('/supabase/functions/_shared/property-data/marketRentService.ts');
 const {InMemorySupplementalEvidenceCache}=await load('/supabase/functions/_shared/property-data/supplementalEvidenceCache.ts');
 const {resolveRentAvmSubjectAttributes}=await load('/supabase/functions/_shared/property-data/rentAvmSubject.ts');
 const {buildFinancialEvidenceFromAuthorizedContext}=await load('/supabase/functions/_shared/maxxis/financialEvidenceContext.ts');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const controls=reportIntegrityFixtures();
 const low=controls.find(c=>c.id==='LOW_EVIDENCE_SELL').input.property;
 const property={...low,baths:1,sqft:806,lot:7013,owner:{name:'Carlos Canto'},propertyUserNotes:'Controle reconstruído dos PDFs fornecidos. A execução histórica das consultas não foi registrada; não é uma nova análise autenticada.',localizedPropertyUserNotes:null};
 const profile={status:'complete',targetMarkets:['AR'],priceRange:'lt_100k',propertyTypes:['Single Family'],strategies:['Fix & Flip']};
 async function raw(p,basis=null,extra={}){
  const result=await orchestrateDealInsightContext({propertyId:p.id,loadPropertyDetails:async()=>({found:true,property:p,missingFields:[],metrics:calculateDealMetrics(p),analysis:{positiveSignals:[],attentionPoints:[],missingInformation:[],limitations:[]}}),
   loadInvestmentProfile:async()=>({profile:basis,exists:!!basis,complete:!!basis}),calculateMatch:calculatePropertyMatch,
   loadPropertyEvidence:async()=>({state:'not_loaded',propertyId:p.id,entitlementState:'authorized',cacheState:'miss'})});
  return {data:{...result,intelligenceSnapshot:{propertyFacts:p,investmentProfile:result.investmentProfile,matchScore:result.match,...extra}}};
 }
 const source4724=await raw(property,null,{marketRent:{propertyId:property.id,state:'SUBJECT_UNAVAILABLE',reason:'HISTORICAL_CAUSE_NOT_RECORDED'}});
 const rental=controls.find(c=>c.id==='RENTAL_MARKET_RICH').input;
 const rentEvidence={...rental.dealIntelligence.valuationIntelligence.rentalEvidence.rentEstimate,retrievedAt:'2026-10-18T00:00:00Z'};
 const now=()=>new Date('2026-10-18T00:00:00Z');
 let mockProviderCalls=0;
 const rentService=new MarketRentService({cache:new InMemorySupplementalEvidenceCache(now),now,enabled:true,
  provider:{getRentEstimate:async input=>{mockProviderCalls++;return {...rentEvidence,queryFingerprint:input.queryFingerprint};}},hasEntitlement:async()=>true,
  resolveSubject:async()=>resolveRentAvmSubjectAttributes({property:rental.property})});
 const acquired=await rentService.get({propertyId:rental.property.id,userId:'SYNTHETIC_ACTOR',acquire:true});
 const cached=await rentService.get({propertyId:rental.property.id,userId:'SYNTHETIC_ACTOR',acquire:true});
 assert.equal(acquired.state,'AVAILABLE');assert.equal(cached.cacheHit,true);assert.equal(mockProviderCalls,1);
 const financialEvidence=buildFinancialEvidenceFromAuthorizedContext({propertyId:rental.property.id,cachedRent:{evidence:acquired.evidence,freshness:acquired.freshness}});
 const rentalRaw=await raw({...rental.property,propertyUserNotes:'Fixture Honolulu validada, não representa consulta atual ao provedor.'},null,{marketRent:cached,financialEvidence});
 const valid=await raw(property,profile);
 const noProfile=await raw(property,null);
 const cases=[['A-4724-L3-blocker',projectMaxxisDealIntelligenceResponse(source4724),'historical-reconstruction'],
  ['B-Honolulu-L3-rent-fixture',projectMaxxisDealIntelligenceResponse(rentalRaw),'mock-provider-cache-pipeline'],
  ['C-profile-L2',projectMaxxisAnalysisResponse(valid),'mock-current-profile'],['C-profile-L3',projectMaxxisDealIntelligenceResponse(valid),'mock-current-profile'],
  ['C-no-profile-L2',projectMaxxisAnalysisResponse(noProfile),'mock-absent-profile'],['C-no-profile-L3',projectMaxxisDealIntelligenceResponse(noProfile),'mock-absent-profile']];
 for(const[name,projected,mode]of cases){
  const schema=projected.data.maxxisReport,vm=buildStrictReportViewModel({schema,language:'pt'});
  const result=await renderMaxxisReportPdf({schema,language:'pt',generatedAt:'2026-10-18T00:00:00Z',exportEntitlement:resolveReportExportEntitlement({plan:'enterprise',reportType:schema.reportType,channel:'PDF'})});
  assert.equal(result.state,'RENDERED',JSON.stringify(result.validation));
  await writeFile(`${directory}/${name}.pdf`,result.document.binary);
  const pdf=await getDocument({data:result.document.binary.slice(),useSystemFonts:true}).promise;
  const pages=[];let allText='';
  for(let n=1;n<=pdf.numPages;n++){
   const page=await pdf.getPage(n),text=(await page.getTextContent()).items.map(i=>i.str).join(' ');allText+=' '+text;
   pages.push({page:n,text});
   if(/Investment Fit|Comparative Market|Valuation Intelligence|Busca SOLD|aluguel de mercado/i.test(text)){
    const viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
    await writeFile(`${directory}/${name}-page-${n}.png`,await canvas.encode('png'));
   }
  }
  if(name.startsWith('A-')){assert.match(allText,/não registrada|não registrado/);assert.doesNotMatch(allText, /29%/);}
  if(name.startsWith('B-')){
   const rent=vm.sections.find(s=>s.id==='market-rent');assert.ok(rent.range);assert.equal(rent.table.rows.length,5);
   assert.equal(rent.map.points.filter(p=>p.id!=='subject').length,5);assert.match(allText,/7\.820/);assert.match(allText,/5\.230/);assert.match(allText,/10\.410/);
   for(const row of rent.table.rows)assert.ok(allText.includes(row[1]),`Rental not in PDF: ${row[1]}`);
   assert.match(allText,/Imóvel analisado · Banheiros/);assert.match(allText,/2\.333/);
  }
  if(name.startsWith('C-profile')){assert.match(allText,/Mercados alvo/);assert.match(allText,/Single Family/);assert.ok(vm.sections.find(s=>s.id==='profile-fit'));}
  if(name.startsWith('C-no-profile')){assert.match(allText,/Perfil de investimento não configurado/);assert.ok(!vm.sections.find(s=>s.id==='profile-fit'));assert.ok(!vm.sections.find(s=>s.id==='profile-criteria'));}
  await writeFile(`${directory}/${name}-text.json`,JSON.stringify(pages,null,2));
  receipt.cases.push({name,mode,pdf:`${directory}/${name}.pdf`,pages:pdf.numPages,contractChecks:'PASS_OFFLINE_ONLY',profileScore:vm.sections.find(s=>s.id==='profile-fit')?.gauge?.value??null});
  pdf.cleanup();
 }
 receipt.mockProviderCalls=mockProviderCalls;receipt.cacheReused=cached.cacheHit;receipt.networkAttempts=networkCalls;assert.equal(networkCalls,0);
 await writeFile(`${directory}/verification.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await server.close();}
