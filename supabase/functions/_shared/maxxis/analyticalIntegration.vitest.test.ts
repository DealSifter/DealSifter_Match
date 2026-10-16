import {describe,it,expect,vi} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {reconcilePropertyFacts,applyFactDecisions,publicEffectiveFacts} from '../property-fact-reconciliation/model.ts';
import {buildAnalyticalPropertyInputs,publicAnalyticalDecisionProofs} from './analyticalPropertyContext.ts';
import {buildAreaAnalyticalAnswer,detectAreaAnalyticalQuestion} from './areaAnalyticalAnswer.ts';
import {calculateAreaMetrics} from './areaMetrics.ts';
import {calculateDealMetrics} from './dealMetrics.ts';
import {calculateLandUnitMetrics,resolveLotDimensions} from './landMetrics.ts';
import {calculateLandScenario} from './scenarioEngine.ts';
import {buildMarketReferenceAnswer} from './marketReferenceAnswer.ts';
import {getCanonicalPropertyEvidenceWithDependencies} from './canonicalEvidenceTool.ts';
import {resolveLocalLandDevelopment,landScenarioForPersistence} from '../../../../src/features/maxxis/intelligence/maxxisLandDevelopment.js';
import type {CandidateInput} from '../parcel-evidence-consensus/types.ts';

const property={id:'33333333-3333-4333-8333-333333333333',type:'Land',price:19000,lot:'1.14 ac',state:'AL',is_active:true,publish_to_showcase:true};
const evidence=(value:number,sourceType:'RENTCAST'|'PUBLIC_PARCEL_GIS'='RENTCAST'):CandidateInput=>({field:'lotArea',value,originalValue:value,unit:'ACRES',sourceType,sourceId:sourceType,sourceFamily:sourceType,evidenceStatus:'VERIFIED_RECORD',freshness:'FRESH'});
const context=(snapshot:any,p=property)=>buildAnalyticalPropertyInputs({property:p,reviewSnapshot:snapshot});
const artifact=(name:string,data:unknown)=>{mkdirSync('qa/consensus-aware-analytics/phase1',{recursive:true});writeFileSync(`qa/consensus-aware-analytics/phase1/${name}.json`,JSON.stringify({mode:'DETERMINISTIC_SYNTHETIC_INTEGRATION',data},null,2)+'\n');};
const routing:unknown[]=[];

describe('consensus-aware live analytical integration',()=>{
 it.each([
  ['pt','Qual o preço por acre?'],['en','What is the price per acre?'],['es','Cuál es el precio por acre?'],
 ])('localizes conflict, explicit choice and observed range without raw enums: %s',async(language,question)=>{
  const original=await reconcilePropertyFacts(property,[evidence(.547612)]);
  const keep=applyFactDecisions(original,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'owner');
  const range=await reconcilePropertyFacts(property,[evidence(.547612),evidence(1.23,'PUBLIC_PARCEL_GIS')]);
  const blocked=buildAreaAnalyticalAnswer(question,context(original),language)!,chosen=buildAreaAnalyticalAnswer(question,context(keep),language)!,ranged=buildAreaAnalyticalAnswer(question,context(range),language)!;
  expect(blocked.metric.calculable).toBe(false);expect(blocked.reviewField).toBe('lotArea');
  expect(chosen.metric.value).toBeCloseTo(19000/1.14,10);expect(chosen.answer).toMatch(/confirm/);expect(chosen.answer).toMatch(/indepen/);
  if(language==='pt')expect(chosen.answer).not.toContain('você'); // Public choice must not be attributed to another reader.
  expect(ranged.metric.value).toBeNull();expect(ranged.answer).toMatch(/provis/);expect(ranged.answer).not.toMatch(/1[,.]185/);
  for(const answer of [blocked,chosen,ranged]){expect(answer.providerCalls).toBe(0);expect(answer.answer).not.toMatch(/MATERIAL_CONFLICT|ALLOW_|BLOCK_|OUTLIER_DETECTED|USER_PROVIDED/);}
  routing.push({language,blocked,chosen,ranged});
 });
 it.each(['Qual o APN?','Qual é a área do lote?','Gerar relatório de preço por acre','Exportar PDF de price per acre','Who is the owner?'])('does not steal direct facts or report routes: %s',message=>{
  expect(detectAreaAnalyticalQuestion(message)).toBeNull();
 });
 it.each([['price per lot sqft','pricePerLotSqft'],['price per living sqft','pricePerLivingSqft'],['preço por sqft da área construída','pricePerLivingSqft']])('keeps explicit domain %s',(message,key)=>{
  expect(detectAreaAnalyticalQuestion(message)).toBe(key);
 });
 it('resolves ambiguous sqft from the property type without converting lot into living area',()=>{
  expect(buildAreaAnalyticalAnswer('price per sqft',buildAnalyticalPropertyInputs({property}))?.key).toBe('pricePerLotSqft');
  expect(buildAreaAnalyticalAnswer('price per sqft',buildAnalyticalPropertyInputs({property:{...property,type:'SFR',sqft:1000}}))?.metric.value).toBe(19);
 });
 it('uses effective lot across both LAND calculators, with no legacy raw fallback',async()=>{
  const before=await reconcilePropertyFacts(property,[evidence(.547612)]),keep=applyFactDecisions(before,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'owner');
  for(const [snapshot,allowed] of [[before,false],[keep,true]] as const){
   const analyticalPropertyInputs=context(snapshot),input={...property,purchasePrice:19000,analyticalPropertyInputs,targetExitPricePerAcre:30000};
   const dimensions=resolveLotDimensions(input),metrics=calculateLandUnitMetrics(19000,input),scenario=calculateLandScenario(input);
   expect(metrics.pricePerAcre).toBe(allowed?19000/1.14:null);expect(scenario.purchasePricePerAcre).toBe(metrics.pricePerAcre);
   expect(dimensions.lotSizeAcres).toBe(allowed?1.14:null);expect(scenario.targetExitValue).toBe(allowed?34200:null);
   expect(JSON.stringify(dimensions)).not.toContain('analyticalPropertyInputs');
  }
 });
 it('propagates observed ranges into existing LAND area-dependent totals without scalar substitution',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[evidence(.547612),evidence(1.23,'PUBLIC_PARCEL_GIS')]);
  const result=calculateLandScenario({...property,purchasePrice:19000,targetExitPricePerAcre:30000,analyticalPropertyInputs:context(snapshot)});
  expect(result.purchasePricePerAcre).toBeNull();expect(result.knownBasisPerAcre).toBeNull();expect(result.targetExitValue).toBeNull();
  expect(result.targetExitValueRange?.min).toBeCloseTo(34200,8);expect(result.targetExitValueRange?.max).toBeCloseTo(36900,8);
  expect(result.ROI).toBeNull();
  const unsafe=calculateLandScenario({...property,purchasePrice:19000,targetExitPricePerAcre:1e308,analyticalPropertyInputs:context(snapshot)});
  expect(unsafe.targetExitValueRange).toBeNull();expect(unsafe.targetExitValue).toBeNull();
 });
 it('migrates only the living denominator in dealMetrics, preserving acquisition and cap rate',async()=>{
  const p={...property,type:'SFR',sqft:1250},snapshot=await reconcilePropertyFacts(p,[{...evidence(2000,'PUBLIC_PARCEL_GIS'),field:'buildingArea',unit:'SQFT'}]);
  const original={price:19000,sqft:1250,rehab:35000,capRate:6},legacy=calculateDealMetrics(original),aware=calculateDealMetrics({...original,analyticalInputs:context(snapshot,p)});
  expect(aware.metrics.pricePerSqft.value).toBeNull();expect(aware.metrics.acquisitionPlusRehab).toEqual(legacy.metrics.acquisitionPlusRehab);expect(aware.metrics.capRate).toEqual(legacy.metrics.capRate);
  const chosen=applyFactDecisions(snapshot,[{field:'buildingArea',action:'KEEP_MY_VALUE'}],'owner');
  expect(calculateDealMetrics({...original,analyticalInputs:context(chosen,p)}).metrics.pricePerSqft.value).toBe(19000/1250);
  artifact('financial-engine-isolation',{legacy,aware,acquisitionPlusRehabChanged:false,storedCapRateChanged:false,financialInputsMigrated:0});
 });
 it('keeps market-reference payload area metrics under the same policy without migrating sales references',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[evidence(.547612)]),input={propertyId:property.id,propertyFacts:property};
  const legacy=buildMarketReferenceAnswer(input,'LAND_MARKET_REFERENCE','pt'),aware=buildMarketReferenceAnswer(input,'LAND_MARKET_REFERENCE','pt',context(snapshot));
  expect(legacy.data.landMetrics?.pricePerAcre).not.toBeNull();expect(aware.data.landMetrics?.pricePerAcre).toBeNull();
  expect(aware.data.reference).toEqual(legacy.data.reference);expect(aware.answer).toContain('fontes divergem');
 });
 it('live local LAND respects reviewed facts and keeps persisted payload below 16KB',async()=>{
  const before=await reconcilePropertyFacts(property,[evidence(.547612)]),keep=applyFactDecisions(before,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'owner');
  const request={property,message:'construir 1 SFR de 2000 sqft',storedAssumptions:{developmentIntent:'NEW_CONSTRUCTION',proposedUnitCount:1,proposedBuildingSqftPerUnit:2000,proposedPropertyType:'SFR'}};
  const blocked=resolveLocalLandDevelopment({...request,reviewSnapshot:before})!,resolved=resolveLocalLandDevelopment({...request,reviewSnapshot:keep})!;
  expect(blocked.data.scenario.calculatedOutputs.landMetrics.pricePerAcre).toBeNull();expect(resolved.data.scenario.calculatedOutputs.landMetrics.pricePerAcre).toBeCloseTo(19000/1.14,10);
  expect(Buffer.byteLength(JSON.stringify(landScenarioForPersistence(resolved.data.scenario)))).toBeLessThan(16*1024);
  expect(resolveLocalLandDevelopment({...request,reviewSnapshot:null})).toBeNull();
 });
 it('honors current public decision proof without exporting reviewer/private alternatives',async()=>{
  const before=await reconcilePropertyFacts(property,[evidence(.547612)]),keep=applyFactDecisions(before,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'private-owner');
  const facts=publicEffectiveFacts(keep),result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:property.id},propertyId:property.id,userId:'reader',secret:'qa',parcelEnabled:false,
   loadPublicProperty:async()=>property,loadCachedProvider:async()=>({state:'unavailable'} as any),loadReconciledFacts:async()=>({facts,owner:false,decisionProofs:publicAnalyticalDecisionProofs(keep,facts)})});
  expect(result.state).toBe('available');if(result.state!=='available')throw new Error('EXPECTED_AVAILABLE');
  const metric=calculateAreaMetrics(result.analyticalInputs).pricePerAcre;
  expect(metric.value).toBeCloseTo(19000/1.14,10);expect(metric.inputFact.consensusState).toBe('MATERIAL_CONFLICT');expect(result.canReview).toBe(false);
  expect(JSON.stringify(result)).not.toContain('private-owner');expect(JSON.stringify(result)).not.toContain('reviewSnapshot');
 });
 it('fails closed on review proof read failure instead of silently calculating the raw publisher lot',async()=>{
  const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:property.id},propertyId:property.id,userId:'reader',secret:'qa',parcelEnabled:false,
   loadPublicProperty:async()=>property,loadCachedProvider:async()=>({state:'unavailable'} as any),loadReconciledFacts:async()=>{throw new Error('READ_TIMEOUT');}});
  if(result.state!=='available')throw new Error('EXPECTED_AVAILABLE');
  expect(calculateAreaMetrics(result.analyticalInputs).pricePerAcre).toMatchObject({calculable:false,reasonCode:'INPUT_DECISION_PROOF_UNAVAILABLE'});
 });
 it('unauthorized/unpublished input performs no provider/review reads',async()=>{
  const read=vi.fn();const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:property.id},propertyId:property.id,userId:'reader',secret:'qa',parcelEnabled:false,loadPublicProperty:async()=>null,loadCachedProvider:read,loadReconciledFacts:read});
  expect(result.state).toBe('not_found');expect(read).not.toHaveBeenCalled();
 });
 it('direct analytical route precedes Gemini and stale local gap parsing',()=>{
  const runtime=readFileSync('supabase/functions/maxxis-chat/index.ts','utf8'),frontend=readFileSync('src/components/maxxis/MaxxisAssistant.jsx','utf8');
  expect(runtime.indexOf('const earlyAreaIntent')).toBeLessThan(runtime.indexOf('const earlyPropertyFact'));
  expect(runtime.indexOf('const earlyAreaIntent')).toBeLessThan(runtime.indexOf('const result = await callGemini'));
  expect(runtime).toContain('analyticalEvidenceRead ??=');expect(frontend).toContain('!meta.skipGapResolutionParse && !areaAnalyticalIntent');
  artifact('maxxis-analytical-routing',{routing,providerCalls:0,geminiArbitration:0,requestScopedReadDeduplication:true});
 });
 it('pure calculation repeats deterministically without network or mutation',()=>{
  const input=buildAnalyticalPropertyInputs({property}),before=JSON.stringify(input),expected=calculateAreaMetrics(input),fetch=vi.spyOn(globalThis,'fetch');
  const start=performance.now();for(let i=0;i<1000;i++)expect(calculateAreaMetrics(input)).toEqual(expected);
  expect(fetch).not.toHaveBeenCalled();fetch.mockRestore();expect(JSON.stringify(input)).toBe(before);
  artifact('performance-regression',{iterations:1000,totalMilliseconds:performance.now()-start,providerCalls:0,geminiCalls:0,inputMutations:0});
 });
});
