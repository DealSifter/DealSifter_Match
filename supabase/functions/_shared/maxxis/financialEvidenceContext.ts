import {buildFinancialEvidenceStack,type FinancialCandidate,type FinancialDecision,type FinancialDomain,type FinancialCadence} from './financialEvidence.ts';
// Adapter inputs are already authorized by the existing property/cache/reviewer gates.
type Values=Record<string,any>;
const number=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
function taxCandidate(c:Values,index:number):FinancialCandidate {
  const estimated=['ESTIMATED','CALCULATED'].includes(c.evidenceStatus),user=c.sourceType==='USER_PROVIDED';
  return {id:String(c.candidateId??`tax-${index}`),domain:'propertyTax',value:number(c.normalizedValue??c.value??c.originalValue),unit:'USD',cadence:'ANNUAL',
    evidenceClass:estimated?'PROVIDER_ESTIMATE':user?'USER_PROVIDED_ACTUAL':'PUBLIC_RECORD',
    sourceType:String(c.sourceType??''),sourceId:String(c.sourceId??''),sourceFamily:String(c.sourceFamily??''),sourceAuthority:String(c.sourceAuthority??c.sourceType??''),
    evidenceStatus:c.evidenceStatus??'UNKNOWN',freshness:c.freshness??'UNKNOWN',periodYear:c.metadata?.year??null,
    retrievedAt:c.retrievedAt??null,sourceUpdatedAt:c.sourceUpdatedAt??null,metadata:{concept:estimated?'ESTIMATED_TAX':'ANNUAL_RECORDED_TAX'}};
}
/** Sanitized public proof only for an already-authorized effective tax fact. */
export function publicFinancialTaxProof(snapshot:Values,facts:Values){
  const row=snapshot?.rows?.propertyTax,d=row?.decision,f=facts?.propertyTax;
  if(!f||!d||d.evidenceHash!==row.evidenceHash||d.action==='REVIEW_LATER'||f.state!=='AVAILABLE'
    ||row.effective?.value!==f.value||row.effective?.unit!==f.unit||row.effective?.sourceType!==f.sourceType
    ||d.value!==f.value||d.unit!==f.unit||d.source!==f.sourceType)return null;
  return {propertyId:snapshot.propertyId,rows:{propertyTax:{evidenceHash:row.evidenceHash,
    effective:{value:f.value,unit:f.unit,state:f.state,sourceType:f.sourceType},
    decision:{action:d.action,evidenceHash:d.evidenceHash,value:d.value,unit:d.unit,source:d.source,sourceId:d.sourceId,year:d.year,status:d.status,freshness:d.freshness},
    projection:{analyticalUsability:row.projection?.analyticalUsability}}}};
}
/** No generic property spreading: no contacts, private history or unrelated account choices. */
export function buildFinancialEvidenceFromAuthorizedContext(context:{propertyId:string;taxProjection?:Values;effectiveTax?:Values|null;taxReviewUnavailable?:boolean;reviewSnapshot?:Values|null;provider?:Values|null;
  cachedRent?:{evidence:Values;freshness?:{state:string}}|null;privateAssumptions?:Values|null}){
  const {propertyId}=context,row=context.reviewSnapshot?.propertyId===propertyId?context.reviewSnapshot.rows?.propertyTax:null;
  const projection=row?.projection?.candidates?row.projection:context.taxProjection;
  const candidates:FinancialCandidate[]=(projection?.candidates??[]).filter((c:Values)=>c.comparable!==false
    &&(!c.metadata?.concept||c.metadata.concept==='ANNUAL_RECORDED_TAX')).map(taxCandidate);
  // A public declaration is an actual-declared candidate, never evidence of a KEEP decision.
  const effective=context.effectiveTax;
  if(!row&&effective?.state==='AVAILABLE'&&effective.sourceType==='USER_PROVIDED'&&effective.unit==='USD'&&effective.status==='USER_PROVIDED'){
    candidates.push(taxCandidate({candidateId:'public-declared-tax',value:effective.value,sourceType:'USER_PROVIDED',sourceId:'public-publisher-declaration',sourceFamily:'PUBLISHER',evidenceStatus:'USER_PROVIDED',freshness:effective.freshness,metadata:{year:effective.year}},candidates.length));
  }
  const decisions:Partial<Record<FinancialDomain,FinancialDecision>>={};
  const d=row?.decision;
  if(d&&d.action!=='REVIEW_LATER'&&d.evidenceHash===row.evidenceHash&&row.effective?.state==='AVAILABLE'
    &&d.value===row.effective.value&&d.unit===row.effective.unit&&d.source===row.effective.sourceType){
    // A public proof may have no alternatives; reconstruct ONLY its sanctioned effective choice.
    let chosen=candidates.find(c=>c.value===d.value&&c.sourceType===d.source&&c.sourceId===d.sourceId&&c.periodYear===(d.year??null));
    if(!chosen&&['USER_PROVIDED','PUBLIC_TAX','PUBLIC_ASSESSOR','PUBLIC_PARCEL_GIS','RENTCAST'].includes(d.source)&&d.unit==='USD'){
      chosen=taxCandidate({candidateId:'reconciled-tax',value:d.value,sourceType:d.source,sourceId:d.sourceId,
        sourceFamily:d.source==='USER_PROVIDED'?'PUBLISHER':d.source==='RENTCAST'?'RENTCAST':d.sourceId,
        evidenceStatus:d.status,freshness:d.freshness,metadata:{year:d.year}},candidates.length);candidates.push(chosen);
    }
    if(chosen)decisions.propertyTax={candidateId:chosen.id,action:d.action,evidenceHash:d.evidenceHash,currentEvidenceHash:row.evidenceHash};
  }
  const provider=context.provider;
  if(provider?.propertyId===propertyId&&provider.entitlementState==='authorized'&&provider.state==='available'){
    const hoa=provider.evidence?.fields?.hoaFee;
    if(hoa)candidates.push({id:'rentcast-hoa',domain:'hoa',value:number(hoa.value),unit:'USD',cadence:'UNKNOWN',evidenceClass:'PUBLIC_RECORD',sourceType:'RENTCAST',sourceId:'rentcast',sourceFamily:'RENTCAST',sourceAuthority:'RentCast',evidenceStatus:hoa.status,freshness:provider.evidence?.freshness?.state??'UNKNOWN',retrievedAt:hoa.retrievedAt??null,sourceUpdatedAt:hoa.effectiveDate??null});
  }
  const rent=context.cachedRent;
  if(rent?.evidence?.provider==='rentcast'&&rent.evidence.evidenceType==='rent_estimate'&&rent.evidence.status==='AVAILABLE'){
    candidates.push({id:'rentcast-market-rent',domain:'providerMarketRentEstimate',value:number(rent.evidence.rent),unit:'USD',cadence:'MONTHLY',evidenceClass:'PROVIDER_ESTIMATE',sourceType:'RENTCAST',sourceId:'rentcast',sourceFamily:'RENTCAST',sourceAuthority:'RentCast',evidenceStatus:'ESTIMATED',freshness:rent.freshness?.state??'UNKNOWN',retrievedAt:rent.evidence.retrievedAt??null,sourceUpdatedAt:null,
      metadata:{referenceCount:Array.isArray(rent.evidence.comparables)?rent.evidence.comparables.length:0,rangeLow:number(rent.evidence.rangeLow),rangeHigh:number(rent.evidence.rangeHigh),
        scope:rent.evidence.scope,requestFingerprint:rent.evidence.queryFingerprint,subjectProperty:rent.evidence.subjectProperty??null}});
  }
  // Existing authenticated private BUY_AND_HOLD scenario contract. Never read arbitrary public property keys as actual rent.
  const privateInputs=context.privateAssumptions??{},active=privateInputs.activeScenario;
  const inputs={...privateInputs,...(active?.propertyId===propertyId&&active?.strategy==='BUY_AND_HOLD'?active.assumptions??{}:{})};
  const aliases:Array<[FinancialDomain,string,FinancialCadence,'USD'|'PERCENT']>=[
    ['investorRentAssumption','rent','MONTHLY','USD'],['investorRentAssumption','expectedRent','MONTHLY','USD'],
    ['propertyTax','propertyTax','ANNUAL','USD'],['insurance','insurance','ANNUAL','USD'],['hoa','HOA','MONTHLY','USD'],
    ['propertyManagement','managementPercent','ANNUAL','PERCENT'],['vacancy','vacancyRate','ANNUAL','PERCENT'],
    ['maintenance','maintenanceAmount','ANNUAL','USD'],['maintenance','maintenancePercent','ANNUAL','PERCENT'],
    ['otherOperatingExpenses','otherOperatingExpenses','ANNUAL','USD']];
  for(const[domain,key,frequency,unit]of aliases){
    if(number(inputs[key])===null||candidates.some(c=>c.domain===domain&&c.evidenceClass==='INVESTOR_ASSUMPTION'))continue;
    candidates.push({id:`private-${key}`,domain,value:number(inputs[key]),unit,cadence:frequency,evidenceClass:'INVESTOR_ASSUMPTION',sourceType:'USER_PROVIDED',sourceId:'PRIVATE_SCENARIO',sourceFamily:'CURRENT_INVESTOR',sourceAuthority:'Current investor',evidenceStatus:'USER_PROVIDED',freshness:'UNKNOWN',
      metadata:unit==='PERCENT'?{percentageBasis:domain==='vacancy'?'SCHEDULED_RENT':'EFFECTIVE_INCOME'}:{}});
  }
  // Future actual rent/HOA collection is intentionally not introduced here.
  const publicChoiceDisagreement=!row&&effective?.state==='AVAILABLE'&&effective.sourceType!=='USER_PROVIDED'
    &&(effective.value!==projection?.value||effective.unit!==projection?.unit);
  const result=buildFinancialEvidenceStack({propertyId,candidates,decisions,conflicts:projection?.analyticalUsability==='CONFLICTED'||effective?.state==='CONFLICTED'||publicChoiceDisagreement?['propertyTax']:[]});
  if(context.taxReviewUnavailable)result.inputs.propertyTax={...result.inputs.propertyTax,value:null,annualizedValue:null,source:null,sourceClass:'UNAVAILABLE',analyticalUsability:'UNAVAILABLE',reasonCode:'REVIEW_STATE_UNAVAILABLE',conflictPreserved:false};
  return result;
}
