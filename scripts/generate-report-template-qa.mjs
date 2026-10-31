import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { sampleReportMap } from './sample-report-maps.mjs';

// Isolated fictional fixture: never imported by the app, stored, or sent to a provider.
const property = Object.freeze({
  id:'PREVIEW-ONLY', title:'DEMONSTRATION ONLY · Sample property', address:'1200 Sample Avenue', city:'Example City', state:'FL', zip:'00000',
  type:'SFR', objective:'Buy and Hold', price:425000, beds:4, baths:2, sqft:1780,
  lot:9583, lotSizeSqft:9583, lotSizeAcres:9583/43560, rehab:48000, capRate:5.36, noi:22768,
  acquisitionCosts:5000, holdingCosts:6000, financingCosts:4000, sellingCosts:20000,
  published:true, source:'FICTIONAL_DEMONSTRATION', latitude:27.95, longitude:-82.45,
  description:'Four-bedroom sample home for a long-term hold strategy.',
  improvement:'Single-family residence', dealTag:'Portfolio', portfolio:true,
  labels:['Demonstration','Buy and Hold','Portfolio'], markets:['Example City, FL'],
  yearBuilt:2004, county:'Example County', assessedValue:398500, assessmentYear:2026, annualPropertyTax:5120, propertyTaxYear:2026,
  assessorId:'SAMPLE-000-1200', legalDescription:'Illustrative Lot 12, Block A, Sample Subdivision', subdivision:'Sample Subdivision', zoning:'RS-60',
  ownerOccupied:false, ownershipRecordPresent:true, latestSalePrice:315000, latestSaleDate:'2021-06-18',
  notes:'DEMONSTRATION ONLY. Fictional data; not a listing or provider result. Gallery images are illustrative, not one actual property. OSM basemap with sample markers.',
  fieldProvenance:{capRate:{source:'USER_PROVIDED',status:'CONFIRMED'}},
  owner:{name:'Sample Publisher · Fictional',type:'Individual',status:'Published',allowedContacts:[
    {type:'phone',label:'Phone',value:'(555) 010-0120'},{type:'email',label:'Email',value:'sample@example.invalid'}]},
});
const profileAlignment = {
  score:86, profileSource:'AUTHENTICATED_CURRENT_PROFILE',
  sourceProfile:{targetMarkets:['Example City, FL'],priceRange:'400_800k',propertyTypes:['SFR'],strategies:['Buy and Hold']},
  criteria:[['market',90,'Illustrative target market alignment.'],['price',80,'Inside the illustrated budget.'],['property_type',95,'Single-family profile preference.'],['strategy',79,'Long-term hold strategy.']]
    .map(([key,score,explanation])=>({key,score,explanation,status:'matched'})),
};
const sold = [
  ['Sample Sold A',535000,1820,.25,27.951,-82.453,96],
  ['Sample Sold B',550000,1750,.34,27.953,-82.448,94],
  ['Sample Sold C',560000,1800,.42,27.947,-82.452,92],
  ['Sample Sold D',545000,1795,.47,27.946,-82.447,91],
  ['Sample Sold E',565000,1840,.51,27.954,-82.454,90],
].map(([address,salePrice,sqft,distanceMiles,latitude,longitude,similarity],i)=>({
  compIdentifier:'sample-sold-'+i,address,salePrice,sqft,distanceMiles,latitude,longitude,similarity,
  saleDate:'2026-09-'+String(10+i).padStart(2,'0'),propertyType:'SFR',beds:4,baths:2,yearBuilt:2004,lotSizeSqft:9583,
  role:'PRIMARY',conditionStatus:'COMPATIBLE',candidateCondition:'RENOVATED',conditionEvidenceSource:'FICTIONAL_SAMPLE',
  transactionQuality:'ARMS_LENGTH',hardGatesPass:true,dataCompletenessScore:100,providerCorrelation:.95,
  inclusionReason:'Fictional demonstration of a structurally and condition-compatible recorded sale.'
}));
const rentEvidence = {
  provider:'rentcast',evidenceType:'rent_estimate',status:'AVAILABLE',rent:3200,rangeLow:3000,rangeHigh:3400,
  retrievedAt:'2026-09-21T22:00:00Z',freshness:'FRESH',queryFingerprint:'FICTIONAL-DEMONSTRATION-ONLY',
  subjectProperty:{propertyType:'SFR',bedrooms:4,bathrooms:2,livingAreaSqft:1780,latitude:27.95,longitude:-82.45},
  comparables:sold.map((comp,i)=>({listingId:'sample-rent-'+i,address:'Sample Rental '+String.fromCharCode(65+i),
    price:3000+i*100,bedrooms:4,bathrooms:2,livingAreaSqft:comp.sqft,latitude:comp.latitude,longitude:comp.longitude,
    distanceMiles:comp.distanceMiles,daysOld:12+i,providerCorrelation:.96-i*.01,propertyType:'SFR'})),
};
const financialInput = (value,cadence='ANNUAL',unit='USD') => ({value,cadence,unit,sourceClass:'USER_PROVIDED_ACTUAL',analyticalUsability:'USABLE',
  source:{sourceType:'USER_PROVIDED',userConfirmed:true,periodYear:2026,label:'Fictional demonstration input'}});
const financialEvidence = {inputs:{currentContractRent:financialInput(3200,'MONTHLY'),
  propertyTax:financialInput(5120),insurance:financialInput(1800),hoa:financialInput(900),maintenance:financialInput(1920),
  vacancy:financialInput(5,'ANNUAL','PERCENT'),propertyManagement:financialInput(8,'ANNUAL','PERCENT'),
  utilities:financialInput(600),otherOperatingExpenses:financialInput(300)}};
const analysis = Object.freeze({
  executiveSummary:'Fictional demonstration with a complete property record, configured investor profile, documented operating inputs and a market-rent scenario. All illustrated amounts and results are sample data.',
  keyObservations:{positives:['Four-bedroom single-family layout.','Configured long-term hold strategy.','Complete illustrated income and expense basis.'],attention:['Confirm every assumption against real records before making an investment decision.']},
  profileAlignment,marketRent:{state:'AVAILABLE',evidence:rentEvidence},financialEvidence,
  financialReadiness:{readinessLevel:'READY_ACTUAL',metrics:{NOI:{readinessLevel:'READY_ACTUAL'}}},
  riskAwareness:[{category:'MARKET',explanation:'Future rent and resale prices may change.'},{category:'EXECUTION',explanation:'Inspect the actual property and validate contractor scope before reliance.'}],
  limitations:['Fictional demonstration, not an appraisal or a real provider response.','A complete data set does not guarantee investment performance.'],
  nextSteps:['Verify title and inspection.','Review the lease and operating statements.','Confirm contractor bids and exit assumptions.'],
  provenance:{property:'FICTIONAL_SAMPLE'},
});
const deal = Object.freeze({
  evidenceReasons:{propertyRecord:null,valuation:null,recordedSales:null},
  executiveDealOverview:analysis.executiveSummary,whyThisPropertyStandsOut:analysis.keyObservations.positives,
  investmentFit:profileAlignment,
  propertyEvidence:{verifiedRecords:[],userProvided:[{field:'price',value:425000},{field:'capRate',value:5.36,source:'USER_PROVIDED',status:'CONFIRMED'}],unknown:[],conflicts:[]},
  comparableEvidence:{used:sold,supporting:[],excluded:[]},
  valuationIntelligence:{status:'ARV_AVAILABLE',range:{low:535000,high:575000},centralReference:555000,confidence:'HIGH',compsUsed:5,
    methodology:'Fictional demonstration of the existing deterministic methodology.',warnings:['Scenario illustration; not an appraisal or confirmed resale value.'],
    providerEstimate:{value:515000,status:'AVAILABLE'},
    providerListingReferences:sold.slice(0,3).map((comp,i)=>({...comp,address:'Sample Listing '+String.fromCharCode(65+i),price:550000+i*5000,priceSemantic:'PROVIDER_LISTING_PRICE',lastSeenDate:'2026-09-21',listingStatus:'ACTIVE'}))},
  marketRent:analysis.marketRent,financialEvidence,financialReadiness:analysis.financialReadiness,
  soldDelivery:{status:'ELIGIBLE_FOR_ARV',queryExecuted:true,cacheHit:false,reason:'SAMPLE_ONLY',returned:5,normalized:5,hardGatePass:5,structural:5,eligible:5,supporting:0,excluded:0,arvStatus:'ARV_AVAILABLE',blockers:[]},
  riskAnalysis:analysis.riskAwareness,analysisConfidence:{score:92,classification:'HIGH',semantics:'ANALYSIS_COMPLETENESS_AND_RELIABILITY_ONLY',notPropertyScore:true,contributors:['Complete illustrative inputs.'],limitations:['Fictional sample only.']},
  executiveSummaryIntelligence:{lines:[analysis.executiveSummary]},limitations:analysis.limitations,nextVerificationSteps:analysis.nextSteps,
  provenance:{propertyEvidence:'FICTIONAL_SAMPLE'},
});
const sampleMetrics = Object.freeze({metrics:{pricePerSqft:{calculable:true,value:425000/1780,source:'FICTIONAL_SAMPLE'},acquisitionPlusRehab:{calculable:true,value:473000,source:'FICTIONAL_SAMPLE'},capRate:{calculable:true,value:5.1,source:'FICTIONAL_SAMPLE'}}});
const structuredAnalysis = Object.freeze({type:'maxxis_structured_analysis',version:'MAXXIS_STRUCTURED_ANALYSIS_V1',executiveSummary:analysis.executiveSummary,
  positiveSignals:analysis.keyObservations.positives,concerns:analysis.keyObservations.attention,recommendedVerificationSteps:analysis.nextSteps,
  userFacingDisclaimers:['Fictional demonstration only. Not an appraisal or return guarantee.']});

const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../qa/report-template/', import.meta.url));
await mkdir(out, { recursive: true });
const samplePhoto = `data:image/jpeg;base64,${(await readFile(`${root}src/assets/maxxis/report-previews/sample-property-photo.jpg`)).toString('base64')}`;
const samplePhotos = [samplePhoto, ...await Promise.all([1, 2, 3, 4].map(async number => `data:image/jpeg;base64,${(await readFile(`${out}sample-photos/gallery-${number}.jpg`)).toString('base64')}`))];
// Bundle the production renderer without starting the app/dev-server lifecycle.
const runtime = new URL('../.tmp-codex/report-template-qa/runtime.mjs', import.meta.url);
await mkdir(new URL('.', runtime), { recursive:true });
await build({
  stdin:{contents:[
    "export { calculateScenario } from './supabase/functions/_shared/maxxis/scenarioEngine.ts';",
    "export { buildStrictReportViewModel } from './src/features/maxxis/export/reportIntegrityViewModel.ts';",
    "export { buildMaxxisReportSchema } from './src/domain/maxxis/maxxisReportSchema.js';",
    "export { renderMaxxisReportPdf } from './src/features/maxxis/export/maxxisReportPdf.js';",
    "export { resolveReportExportEntitlement } from './src/features/maxxis/export/reportExportEntitlement.js';",
  ].join('\n'),resolveDir:root,loader:'js'},
  outfile:fileURLToPath(runtime),bundle:true,platform:'node',format:'esm',packages:'external',
  define:{'import.meta.env':'{}'},loader:{'.png':'dataurl','.ttf':'dataurl'},
});
const {calculateScenario,buildStrictReportViewModel,buildMaxxisReportSchema,renderMaxxisReportPdf,resolveReportExportEntitlement}=await import(runtime.href);
const assumptions={purchasePrice:425000,rent:3200,vacancyRate:5,propertyTax:5120,insurance:1800,HOA:75,managementPercent:8,maintenancePercent:5,otherOperatingExpenses:900,monthlyPI:1450,cashInvested:125000};
const calculatedOutputs=calculateScenario('BUY_AND_HOLD',assumptions);
const activeScenario={id:'SAMPLE-SCENARIO-ONLY',propertyId:property.id,confirmed:true,strategy:'BUY_AND_HOLD',status:'COMPLETE',assumptions,calculatedOutputs,unresolvedInputs:[],source:Object.fromEntries([...Object.keys(assumptions).map(key=>[key,'USER_PROVIDED']),...Object.keys(calculatedOutputs).map(key=>[key,'CALCULATED'])])};
const sampleCoverage={};
for (const [reportType, plan, file] of [
  ['PROPERTY_RELEASE', 'free', 'property-release.pdf'],
  ['MAXXIS_ANALYSIS', 'pro', 'maxxis-analysis.pdf'],
  ['DEAL_INTELLIGENCE', 'enterprise', 'deal-intelligence.pdf'],
]) {
  const schema = buildMaxxisReportSchema({ reportType, property: { ...property, images: samplePhotos }, maxxisAnalysis: {...analysis,activeScenario}, dealIntelligence: {...deal,activeScenario}, dealMetrics: sampleMetrics, structuredAnalysis });
  const viewModel=buildStrictReportViewModel({schema,language:'en'});
  const sampleMap=await sampleReportMap([{...property,marker:'S'}]);
  const mapImages=Object.fromEntries(await Promise.all(viewModel.sections.filter(section=>section.map?.points.length).map(async section=>[section.id,await sampleReportMap(section.map.points)])));
  const exportEntitlement = resolveReportExportEntitlement({ plan, reportType, channel: 'PDF' });
  const result = await renderMaxxisReportPdf({ schema, exportEntitlement, generatedAt: '2026-09-21T22:45:00.000Z', language: 'en', mapImageData: sampleMap, mapImages });
  if (result.state !== 'RENDERED') throw new Error(`${reportType}: ${result.state} ${JSON.stringify(result.validation || {})}`);
  const text=result.document.layoutAudit.lines.map(line=>line.text).join('\n');
  if (/\bUnavailable\b|not configured|not yet been queried|Coordinate diagram/i.test(text)) throw new Error(reportType+': incomplete demonstration content: '+JSON.stringify(result.document.layoutAudit.lines.filter(line=>/\bUnavailable\b|not configured|not yet been queried|Coordinate diagram/i.test(line.text))));
  sampleCoverage[reportType]={pageCount:result.document.pageCount,photos:viewModel.property.photos.length,maps:result.document.layoutAudit.maps.length,profileGauge:result.document.layoutAudit.sections.some(section=>section.sectionId==='profile-fit-score'),criteriaTable:result.document.layoutAudit.sections.some(section=>section.sectionId==='profile-criteria-facts'),valuationRange:!!viewModel.sections.find(section=>section.id==='arv-market')?.range,rentRange:!!viewModel.sections.find(section=>section.id==='market-rent')?.range,scenario:!!viewModel.sections.find(section=>section.id==='saved-scenario-results'),text};
  await writeFile(`${out}${file}`, result.document.binary);
  process.stdout.write(`${file}: ${result.document.pageCount} A4 pages\n`);
}
await writeFile(`${out}sample-coverage.json`,JSON.stringify(sampleCoverage,null,2)+'\n');
