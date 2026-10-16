import {describe,expect,it} from 'vitest';
import {reconcilePropertyFacts,applyFactDecisions,publicEffectiveFacts} from '../property-fact-reconciliation/model.ts';
import type {CandidateInput} from '../parcel-evidence-consensus/types.ts';
import {buildAnalyticalPropertyInputs,publicAnalyticalDecisionProofs} from './analyticalPropertyContext.ts';
import {calculateAreaMetrics} from './areaMetrics.ts';
import {resolveAnalyticalPropertyFact} from './analyticalPropertyFacts.ts';
import {mkdirSync,writeFileSync} from 'node:fs';

const raw={id:'33333333-3333-4333-8333-333333333333',owner_id:'owner',type:'Land',price:19000,lot:'1.14 ac',sqft:1000};
const evidence=(value:number,source:'RENTCAST'|'PUBLIC_PARCEL_GIS'='RENTCAST',field:'lotArea'|'buildingArea'='lotArea'):CandidateInput=>
 ({field,value,originalValue:value,unit:field==='lotArea'?'ACRES':'SQFT',sourceType:source,sourceId:source==='RENTCAST'?'rentcast':'approved-gis',sourceFamily:source==='RENTCAST'?'RENTCAST':'PUBLIC_GIS',sourceAuthority:source,evidenceStatus:'VERIFIED_RECORD',freshness:'FRESH'});
const metrics=(snapshot:any,property=raw)=>calculateAreaMetrics(buildAnalyticalPropertyInputs({property,reviewSnapshot:snapshot}));
const controls:Record<string,unknown>={};

describe('central analytical physical-fact permission',()=>{
 it('blocks the Gable unresolved conflict, without choosing a provider',async()=>{
  const snapshot=await reconcilePropertyFacts(raw,[evidence(.547612)]),copy=JSON.stringify(snapshot),result=metrics(snapshot);
  expect(result.inputs.LOT_AREA.inputResolution).toBe('BLOCK_CONFLICT');expect(result.pricePerAcre.value).toBeNull();expect(result.pricePerLotSqft.calculable).toBe(false);
  expect(JSON.stringify(snapshot)).toBe(copy);controls.unresolved={consensus:snapshot.rows.lotArea.projection.consensusState,result};
 });
 it('uses KEEP 1.14 ac as qualified without rewriting MATERIAL_CONFLICT',async()=>{
  const before=await reconcilePropertyFacts(raw,[evidence(.547612)]),snapshot=applyFactDecisions(before,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'owner'),result=metrics(snapshot);
  expect(result.inputs.LOT_AREA.inputResolution).toBe('ALLOW_QUALIFIED');expect(result.inputs.LOT_AREA.reasonCode).toBe('USER_CONFIRMED_AMID_CONFLICT');
  expect(result.inputs.LOT_AREA.value!/43560).toBeCloseTo(1.14,12);expect(result.pricePerAcre.value).toBeCloseTo(19000/1.14,10);
  expect(snapshot.rows.lotArea.projection).toEqual(before.rows.lotArea.projection);expect(result.inputs.LOT_AREA.consensusState).toBe('MATERIAL_CONFLICT');controls.keep={result,consensus:snapshot.rows.lotArea.projection.consensusState};
 });
 it('uses the exact explicitly accepted GIS candidate and preserves external provenance',async()=>{
  const before=await reconcilePropertyFacts(raw,[evidence(.55,'PUBLIC_PARCEL_GIS')]),snapshot=applyFactDecisions(before,[{field:'lotArea',action:'ACCEPT_EXTERNAL_VALUE',candidateId:before.rows.lotArea.candidates[0].candidateId}],'owner'),result=metrics(snapshot);
  expect(result.inputs.LOT_AREA).toMatchObject({inputResolution:'ALLOW_QUALIFIED',userAccepted:true,userConfirmed:false,inputSource:{sourceType:'PUBLIC_PARCEL_GIS'}});
  expect(result.pricePerAcre.value).toBeCloseTo(19000/.55,10);expect(snapshot.rows.lotArea.originalValue).toBe('1.14 ac');expect(snapshot.rows.lotArea.projection.consensusState).toBe('MATERIAL_CONFLICT');controls.accept={result};
 });
 it('does not let REVIEW_LATER or a stale decision authorize a conflict',async()=>{
  const before=await reconcilePropertyFacts(raw,[evidence(.547612)]);
  for(const snapshot of [applyFactDecisions(before,[{field:'lotArea',action:'REVIEW_LATER'}],'owner'),applyFactDecisions(before,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'owner')]){
   if(snapshot.rows.lotArea.decision?.action==='KEEP_MY_VALUE')snapshot.rows.lotArea.decision.evidenceHash='stale';
   expect(metrics(snapshot).inputs.LOT_AREA.inputResolution).toBe('BLOCK_CONFLICT');
  }
 });
 it('keeps a three-source observed 1.14–1.23 ac range, inversion and RentCast outlier',async()=>{
  const snapshot=await reconcilePropertyFacts(raw,[evidence(1.23,'PUBLIC_PARCEL_GIS'),evidence(.547612)]),result=metrics(snapshot);
  expect(result.inputs.LOT_AREA.inputResolution).toBe('ALLOW_RANGE');expect(result.inputs.LOT_AREA.consensusState).toBe('OUTLIER_DETECTED');expect(result.pricePerAcre.value).toBeNull();
  expect(result.inputs.LOT_AREA.range!.min/43560).toBeCloseTo(1.14,12);expect(result.inputs.LOT_AREA.range!.max/43560).toBeCloseTo(1.23,12);
  expect(result.pricePerAcre.range!.min).toBeCloseTo(19000/1.23,10);expect(result.pricePerAcre.range!.max).toBeCloseTo(19000/1.14,10);
  expect(result.inputs.LOT_AREA.outliers.some(row=>row.sourceType==='RENTCAST')).toBe(true);controls.range={result};
 });
 it('allows an approved single GIS source only as qualified',async()=>{
  const property={...raw,lot:''},snapshot=await reconcilePropertyFacts(property,[evidence(.75,'PUBLIC_PARCEL_GIS')]),result=metrics(snapshot,property);
  expect(result.inputs.LOT_AREA).toMatchObject({inputResolution:'ALLOW_QUALIFIED',reasonCode:'SINGLE_SOURCE_INPUT',consensusState:'SINGLE_SOURCE'});
  expect(result.pricePerAcre.value).toBeCloseTo(19000/.75,10);controls.single={result};
 });
 it('allows observed consistent scalar values as confirmed, not a midpoint',async()=>{
  const snapshot=await reconcilePropertyFacts(raw,[evidence(1.14,'PUBLIC_PARCEL_GIS')]),result=metrics(snapshot);
  expect(result.inputs.LOT_AREA.inputResolution).toBe('ALLOW_CONFIRMED');expect(result.pricePerAcre.range).toBeNull();expect(result.pricePerAcre.value).toBeCloseTo(19000/1.14,10);controls.confirmed={result};
 });
 it.each([null,undefined,'',0,-1,NaN,Infinity,false])('blocks missing/invalid lot denominator %s without zero/NaN/infinity',value=>{
  const input=buildAnalyticalPropertyInputs({property:{...raw,lot:value}}),result=calculateAreaMetrics(input);
  expect(result.pricePerAcre.value).toBeNull();expect(result.pricePerAcre.range).toBeNull();expect(result.inputs.LOT_AREA.inputResolution).toBe('BLOCK_UNAVAILABLE');
 });
 it.each([null,undefined,'',0,-10,'unknown'])('never substitutes assessed value or AVM for missing/invalid asking price %s',price=>{
  const result=calculateAreaMetrics(buildAnalyticalPropertyInputs({property:{...raw,price,assessedValue:90000,providerEstimate:50000,marketValue:75000}}));
  expect(result.pricePerAcre.value).toBeNull();expect(result.pricePerAcre.reasonCode).toBe('PRICE_INPUT_UNAVAILABLE');
 });
 it('retains full acreage precision instead of rounding the analytical denominator',()=>{
  const acreage=1.140000123456,property={...raw,lot:`${acreage} ac`},result=calculateAreaMetrics(buildAnalyticalPropertyInputs({property}));
  expect(result.pricePerAcre.value).toBeCloseTo(19000/acreage,10);
 });
 it('uses only living sqft for price/living sqft and only lot sqft for price/lot sqft',async()=>{
  const property={...raw,type:'SFR',lot:'2 ac',sqft:1250,price:250000};const snapshot=await reconcilePropertyFacts(property,[evidence(1250,'PUBLIC_PARCEL_GIS','buildingArea')]),result=metrics(snapshot,property);
  expect(result.pricePerLivingSqft.value).toBe(200);expect(result.pricePerLotSqft.value).toBeCloseTo(250000/87120,12);expect(result.pricePerAcre.value).toBe(125000);controls.separation={result};
 });
 it('blocks a living-area conflict and allows an explicit retained area as qualified',async()=>{
  const property={...raw,type:'SFR',price:250000,sqft:1250},before=await reconcilePropertyFacts(property,[evidence(2000,'PUBLIC_PARCEL_GIS','buildingArea')]);
  expect(metrics(before,property).pricePerLivingSqft.value).toBeNull();
  const retained=applyFactDecisions(before,[{field:'buildingArea',action:'KEEP_MY_VALUE'}],'owner');expect(metrics(retained,property).pricePerLivingSqft.value).toBe(200);controls.living={before:metrics(before,property),after:metrics(retained,property)};
 });
 it('accepts a living-area external choice without claiming cross-source confirmation',async()=>{
  const property={...raw,type:'SFR',price:250000,sqft:1250},before=await reconcilePropertyFacts(property,[evidence(2000,'PUBLIC_PARCEL_GIS','buildingArea')]);
  const adopted=applyFactDecisions(before,[{field:'buildingArea',action:'ACCEPT_EXTERNAL_VALUE',candidateId:before.rows.buildingArea.candidates[0].candidateId}],'owner');
  expect(metrics(adopted,property).pricePerLivingSqft).toMatchObject({value:125,inputResolution:'ALLOW_QUALIFIED',inputFact:{userAccepted:true,consensusState:'MATERIAL_CONFLICT'}});
 });
 it('does not turn LAND into SFR or a living/buildable area',async()=>{
  const snapshot=await reconcilePropertyFacts(raw,[{...evidence(1.14),field:'propertyType',value:'SFR',originalValue:'SFR',unit:null}]);
  expect(metrics(snapshot).inputs.LIVING_AREA.inputResolution).toBe('NOT_APPLICABLE');expect(metrics(snapshot).pricePerLivingSqft.value).toBeNull();expect(snapshot.resolvedPropertyType).toBe('LAND');
 });
 it('rejects cross-domain projections and invalid units',()=>{
  expect(resolveAnalyticalPropertyFact({domain:'LIVING_AREA',projection:{field:'lotArea',value:1000,unit:'SQFT',analyticalUsability:'CONFIRMED'}}).reasonCode).toBe('INPUT_DOMAIN_MISMATCH');
  expect(resolveAnalyticalPropertyFact({domain:'LIVING_AREA',effective:{state:'AVAILABLE',value:2,unit:'ACRES',sourceType:'USER_PROVIDED'}}).inputResolution).toBe('BLOCK_UNAVAILABLE');
 });
 it('does not admit an unsupported provider or expired evidence',()=>{
  for(const fact of [{sourceType:'FUTURE_PROVIDER',freshness:'FRESH'},{sourceType:'PUBLIC_PARCEL_GIS',freshness:'EXPIRED_UNUSABLE'}]){
   expect(resolveAnalyticalPropertyFact({domain:'LOT_AREA',effective:{...fact,state:'AVAILABLE',value:1000,unit:'SQFT'}}).inputResolution).toBe('BLOCK_UNAVAILABLE');
  }
 });
 it('qualifies stale usable physical evidence rather than upgrading it',()=>{
  expect(resolveAnalyticalPropertyFact({domain:'LOT_AREA',effective:{state:'AVAILABLE',value:1000,unit:'SQFT',sourceType:'PUBLIC_PARCEL_GIS',freshness:'STALE_USABLE'}}).qualification).toContain('STALE_USABLE_INPUT');
 });
 it('projects only public-matching current decision proof, without reviewer/history/private alternatives',async()=>{
  const before=await reconcilePropertyFacts(raw,[evidence(.547612)]),snapshot=applyFactDecisions(before,[{field:'lotArea',action:'ACCEPT_EXTERNAL_VALUE',candidateId:before.rows.lotArea.candidates[0].candidateId}],'private-owner');
  const facts=publicEffectiveFacts(snapshot),proofs=publicAnalyticalDecisionProofs(snapshot,facts);
  expect(JSON.stringify(proofs)).not.toContain('private-owner');expect(JSON.stringify(proofs)).not.toContain('candidates');expect(JSON.stringify(proofs)).not.toContain('originalValue');
  const result=calculateAreaMetrics(buildAnalyticalPropertyInputs({property:raw,effectiveFacts:facts,decisionProofs:proofs,projections:{lotArea:before.rows.lotArea.projection}}));
  expect(result.inputs.LOT_AREA).toMatchObject({inputResolution:'ALLOW_QUALIFIED',userAccepted:true});
  expect(publicAnalyticalDecisionProofs(snapshot,{lotArea:{...facts.lotArea,value:111}})).toEqual({});
 });
 it('blocks deferred decisions in public proof even without authorized alternatives',async()=>{
  const before=await reconcilePropertyFacts(raw,[evidence(.547612)]),snapshot=applyFactDecisions(before,[{field:'lotArea',action:'REVIEW_LATER'}],'owner');
  const facts=publicEffectiveFacts(snapshot),result=calculateAreaMetrics(buildAnalyticalPropertyInputs({property:raw,effectiveFacts:facts,decisionProofs:publicAnalyticalDecisionProofs(snapshot,facts)}));
  expect(result.inputs.LOT_AREA.inputResolution).toBe('BLOCK_CONFLICT');
 });
 it('rejects a different property review snapshot',async()=>{
  const snapshot=await reconcilePropertyFacts(raw,[]);expect(()=>buildAnalyticalPropertyInputs({property:{...raw,id:'different'},reviewSnapshot:snapshot})).toThrow('IDENTITY_MISMATCH');
 });
 it('requires current decision proof, not a public USER_CONFIRMED status marker alone',async()=>{
  const before=await reconcilePropertyFacts(raw,[evidence(.547612)]),snapshot=applyFactDecisions(before,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'owner');
  const facts=publicEffectiveFacts(snapshot),result=calculateAreaMetrics(buildAnalyticalPropertyInputs({property:raw,effectiveFacts:facts}));
  expect(result.inputs.LOT_AREA).toMatchObject({inputResolution:'BLOCK_CONFLICT',reasonCode:'INVALID_USER_DECISION_PROOF'});
 });
 it('keeps valid full-precision living division consistent at the numerical safety boundary',()=>{
  const property={...raw,type:'SFR',sqft:1e-11},result=calculateAreaMetrics(buildAnalyticalPropertyInputs({property}));
  expect(result.pricePerLivingSqft.value).toBe(19000/1e-11);expect(result.pricePerLivingSqft.calculable).toBe(true);
  const unsafe=calculateAreaMetrics(buildAnalyticalPropertyInputs({property:{...property,sqft:1e-20}}));
  expect(unsafe.pricePerLivingSqft).toMatchObject({value:null,calculable:false,reasonCode:'UNSAFE_ANALYTICAL_RESULT'});
 });
 it('writes reproducible control artifacts without production data',()=>{
  const directory='qa/consensus-aware-analytics/phase1';mkdirSync(directory,{recursive:true});
  for(const[name,data]of Object.entries({'lot-area-controls':controls,'price-per-acre-controls':controls,'price-per-lot-sqft-controls':controls.separation,
   'price-per-living-sqft-controls':controls.living,'gable-controls':{unresolved:controls.unresolved,keep:controls.keep,accept:controls.accept},'provisional-range-controls':controls.range,
   'user-decision-controls':{keep:controls.keep,accept:controls.accept},'lot-living-separation':controls.separation}))writeFileSync(`${directory}/${name}.json`,JSON.stringify({mode:'DETERMINISTIC_SYNTHETIC_CONTROLS',data},null,2)+'\n');
 });
});
