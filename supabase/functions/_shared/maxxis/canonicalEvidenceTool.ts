import { resolvePropertyDetailsInput, normalizePropertyDetails } from './propertyDetails.ts';
import { candidatesFromAuthorizedBundle } from '../parcel-evidence-consensus/adapters.ts';
import type { CandidateInput, ConsensusField } from '../parcel-evidence-consensus/types.ts';
import { buildConsensusAwareCanonicalReadModel } from './canonicalEvidenceProjection.ts';
import { readParcelEvidenceReceipt } from '../public-parcel/evidenceReceipt.ts';
import type { MaxxisPropertyEvidenceResult } from './propertyEvidence.ts';
import { buildAnalyticalPropertyInputs } from './analyticalPropertyContext.ts';
import { buildFinancialEvidenceFromAuthorizedContext } from './financialEvidenceContext.ts';
import {resolveRentAvmSubjectAttributes,type RentAvmSubject} from '../property-data/rentAvmSubject.ts';
import type {MarketRentResult} from '../property-data/marketRentService.ts';
import {reconcilePropertyFacts,propertyIdentity,evidenceHash,type ReviewSnapshot} from '../property-fact-reconciliation/model.ts';
import {createProviderExecution,type ProviderExecution} from '../property-data/providerExecution.ts';
import {evidenceAbsenceReason} from './evidenceAbsence.ts';

const FIELD_MAP:Record<string,ConsensusField>={lotSizeSqft:'lotArea',assessorId:'apn',ownership:'owner',assessedValue:'assessedValue',annualPropertyTax:'propertyTax',zoning:'zoning',propertyType:'propertyType',livingAreaSqft:'buildingArea',yearBuilt:'yearBuilt'};
export function cachedProviderCandidates(provider:MaxxisPropertyEvidenceResult|null,id:string):CandidateInput[]{
 if(provider?.propertyId!==id||provider.state!=='available'||provider.entitlementState!=='authorized'||!provider.evidence)return [];
 const evidence=provider.evidence,rows:CandidateInput[]=[];
 for(const [name,field]of Object.entries({...FIELD_MAP,bedrooms:'beds',bathrooms:'baths',subdivision:'subdivision',legalDescription:'legalDescription'} as Record<string,ConsensusField>)){
  const fact=(evidence.fields as Record<string,{value:unknown;status:CandidateInput['evidenceStatus'];retrievedAt?:string|null;effectiveDate?:string|null}>)[name];if(!fact)continue;
  const year=field==='assessedValue'?evidence.fields.assessmentYear?.value:field==='propertyTax'?evidence.fields.propertyTaxYear?.value:undefined;
  rows.push({field,originalValue:fact.value,unit:field==='lotArea'||field==='buildingArea'?'SQFT':field==='assessedValue'||field==='propertyTax'?'USD':null,
   sourceType:'RENTCAST',sourceId:'rentcast',sourceFamily:'RENTCAST',sourceAuthority:'RentCast',evidenceStatus:fact.status,retrievedAt:fact.retrievedAt,sourceUpdatedAt:fact.effectiveDate,freshness:evidence.freshness?.state,
   metadata:{year:typeof year==='number'?year:null,effectiveDate:fact.effectiveDate,countyFips:typeof evidence.fields.countyFips?.value==='string'?evidence.fields.countyFips.value:null,...(field==='assessedValue'?{concept:'ASSESSED_VALUE'}:field==='propertyTax'?{concept:'ANNUAL_RECORDED_TAX'}:{})}});
 }return rows;
}
type Options={input:unknown;propertyId:string;userId:string;receipt?:unknown;secret:string;parcelEnabled:boolean;financialEvidence?:boolean;rentAvmSubject?:boolean;
  loadRentAvmState?:(id:string)=>Promise<{property:Record<string,unknown>;snapshot:ReviewSnapshot|null}|null>;
  loadMarketRent?:(id:string,subject:RentAvmSubject,execution:ProviderExecution)=>Promise<MarketRentResult>;
  loadCachedMarketRent?:(id:string)=>Promise<{evidence:Record<string,any>;freshness?:{state:string}}|null>;
  loadPublicProperty:(id:string)=>Promise<Record<string,unknown>|null>;
  loadUserFacts?:(id:string,userId:string)=>Promise<Record<string,unknown>|null>;
  loadReconciledFacts?:(id:string,userId:string)=>Promise<{facts:Record<string,unknown>;owner:boolean;reviewSnapshot?:Record<string,any>;financialSnapshot?:Record<string,any>|null;financialUnavailable?:boolean;decisionProofs?:Record<string,unknown>;analyticalUnavailable?:boolean}|null>;
  loadCachedProvider:(id:string)=>Promise<MaxxisPropertyEvidenceResult>};
/** Existing sanitized property authorization + existing provider cache entitlement;
 * receipt verification/computation never performs I/O or writes. */
export async function getCanonicalPropertyEvidenceWithDependencies(options:Options){
  if(!options.userId)throw new Error('UNAUTHORIZED');
  const input=resolvePropertyDetailsInput(options.input,options.propertyId);
  const row=await options.loadPublicProperty(input.propertyId);
  if(!row||String(row.id)!==input.propertyId||row.is_active===false||row.publish_to_showcase===false||row.deal_closed===true)return {type:'canonical_property_evidence' as const,propertyId:input.propertyId,state:'not_found' as const,readModel:null,effectiveFacts:null,canReview:false};
  const property=normalizePropertyDetails(row).property!;
  // Only the sanitized RPC publisher facts enter the bundle, never cached private internalData/profile contacts.
  const publisher={id:property.id,type:property.type,address:property.address??null,city:property.city,state:property.state,zip:property.zip,
    price:property.price,beds:property.beds,baths:property.baths,sqft:property.sqft,lot:property.lot};
  const point=typeof property.latitude==='number'&&typeof property.longitude==='number'?{lat:property.latitude,lng:property.longitude}:null;
  const parcels=await readParcelEvidenceReceipt(options.receipt,{userId:options.userId,point,secret:options.secret,enabled:options.parcelEnabled});
  const candidates=candidatesFromAuthorizedBundle({publisher,publicParcels:parcels});
  const own=await options.loadUserFacts?.(input.propertyId,options.userId).catch(()=>null);
  if(own){
    for(const [name,field,unit]of [['zoning','zoning',null],['apn','apn',null],['ownerName','owner',null],['lotSizeAcres','lotArea','ACRES'],['lotSizeSqft','lotArea','SQFT']] as const){
      const value=own[name];if(value===null||value===undefined||value==='')continue;
      candidates.push({field,originalValue:value,unit,sourceType:'USER_PROVIDED',sourceId:'dealSifter-user-facts',sourceFamily:'PUBLISHER',
        sourceAuthority:'USER_PROVIDED',evidenceStatus:'USER_PROVIDED',userConfirmed:true});
    }
  }
  let provider:MaxxisPropertyEvidenceResult|null=null;
  let providerAccessCheckFailed=false;
  try{provider=await options.loadCachedProvider(input.propertyId);}catch{providerAccessCheckFailed=true;}
  if(provider?.entitlementState==='not_authorized'&&/CHECK_FAILED/.test(provider.reason||''))providerAccessCheckFailed=true;
  if(provider?.propertyId===input.propertyId&&provider.state==='available'&&provider.entitlementState==='authorized'&&provider.evidence){
    const evidence=provider.evidence;
    for(const [name,field]of Object.entries((options.financialEvidence||options.rentAvmSubject?{...FIELD_MAP,bedrooms:'beds',bathrooms:'baths'}:FIELD_MAP) as Record<string,ConsensusField>)){
      const fact=(evidence.fields as Record<string,{value:unknown;status:CandidateInput['evidenceStatus'];retrievedAt?:string|null;effectiveDate?:string|null}>)[name];
      if(!fact)continue;
      const year=field==='assessedValue'?evidence.fields.assessmentYear?.value:field==='propertyTax'?evidence.fields.propertyTaxYear?.value:undefined;
      candidates.push({field,originalValue:fact.value,unit:field==='lotArea'||field==='buildingArea'?'SQFT':field==='assessedValue'||field==='propertyTax'?'USD':null,
        sourceType:'RENTCAST',sourceId:'rentcast',sourceFamily:'RENTCAST',sourceAuthority:'RentCast',evidenceStatus:fact.status,
        retrievedAt:fact.retrievedAt,sourceUpdatedAt:fact.effectiveDate,freshness:evidence.freshness?.state,
        metadata:{year:typeof year==='number'?year:null,effectiveDate:fact.effectiveDate,countyFips:typeof evidence.fields.countyFips?.value==='string'?evidence.fields.countyFips.value:null,
          ...(field==='assessedValue'?{concept:'ASSESSED_VALUE'}:field==='propertyTax'?{concept:'ANNUAL_RECORDED_TAX'}:{})}});
    }
  }
  const readModel=buildConsensusAwareCanonicalReadModel(property as unknown as Record<string,unknown>,candidates,
    provider?.state==='available'&&provider.entitlementState==='authorized'&&provider.propertyId===input.propertyId?provider.evidence as Parameters<typeof buildConsensusAwareCanonicalReadModel>[2]:null);
  const reconciled:Awaited<ReturnType<NonNullable<Options['loadReconciledFacts']>>>|undefined=await options.loadReconciledFacts?.(input.propertyId,options.userId).catch(()=>({facts:{},owner:false,analyticalUnavailable:true}));
  const analyticalInputs=buildAnalyticalPropertyInputs({property:publisher,effectiveFacts:reconciled?.facts??{},
    projections:readModel.analyticalEvidence.fields,reviewSnapshot:reconciled?.owner?reconciled.reviewSnapshot??null:null,decisionProofs:reconciled?.decisionProofs??{},
    unavailableReason:reconciled?.analyticalUnavailable?'INPUT_DECISION_PROOF_UNAVAILABLE':undefined});
  // Reconcile AVM-critical inputs against current publisher data and authorized
  // cached evidence. An address/subject change invalidates old decisions normally.
  let rentAvmSubject:RentAvmSubject|undefined;
  if((options.financialEvidence||options.rentAvmSubject)&&provider?.entitlementState==='authorized'){
    let subjectReason:string|undefined;
    const state=options.loadRentAvmState?await options.loadRentAvmState(input.propertyId).catch(error=>{
      const code=error instanceof Error?error.message:'';
      subjectReason=['RENT_SUBJECT_PROPERTY_READ_FAILED','RENT_SUBJECT_PROPERTY_NOT_FOUND','RENT_SUBJECT_REVIEW_READ_FAILED'].includes(code)?code:'RENT_SUBJECT_STATE_READ_FAILED';
      return null;
    }):null;
    const external=candidates.filter(c=>c.sourceFamily!=='PUBLISHER');
    const currentFields=new Set(external.map(c=>`${c.sourceFamily}:${c.field}`));
    const retained=state?.snapshot&&state.snapshot.identityHash===await evidenceHash(propertyIdentity(state.property))
      ?Object.values(state.snapshot.rows).flatMap(r=>r.projection.candidates.filter(c=>c.sourceFamily!=='PUBLISHER'&&!currentFields.has(`${c.sourceFamily}:${c.field}`))):[];
    const fresh=state?await reconcilePropertyFacts(state.property,[...retained,...external],state.snapshot):null;
    rentAvmSubject=resolveRentAvmSubjectAttributes({property:row,effectiveFacts:reconciled?.facts,projections:readModel.analyticalEvidence.fields,
      reviewSnapshot:fresh??(reconciled?.owner?reconciled.reviewSnapshot:null),unavailable:!!options.loadRentAvmState&&!state});
    if(rentAvmSubject.state==='SUBJECT_UNAVAILABLE')rentAvmSubject={...rentAvmSubject,reason:subjectReason??'RENT_SUBJECT_STATE_UNAVAILABLE'};
  }
  const rentExecution=createProviderExecution();
  const marketRent:MarketRentResult|undefined=options.financialEvidence?(provider?.entitlementState!=='authorized'?{propertyId:input.propertyId,
    state:providerAccessCheckFailed?'PROVIDER_ERROR' as const:'ENTITLEMENT_BLOCKED' as const,providerCalls:0,
    absenceReason:providerAccessCheckFailed?'PROVIDER_ERROR':'NOT_ENTITLED',...(providerAccessCheckFailed?{reason:'PROPERTY_EVIDENCE_ACCESS_CHECK_FAILED'}:{})}
    :options.loadMarketRent&&rentAvmSubject?await options.loadMarketRent(input.propertyId,rentAvmSubject,rentExecution).catch((error)=>({propertyId:input.propertyId,state:'PROVIDER_ERROR' as const,
      providerCalls:rentExecution.recorded?rentExecution.providerCalls:null,executionPhase:rentExecution.recorded?rentExecution.phase:'UNKNOWN' as const,absenceReason:evidenceAbsenceReason('RENT_EXECUTION_FAILED'),
      // A cache/guard/execution failure is not an invalid physical attribute.
      // Retain a bounded diagnostic category, never an arbitrary error payload.
      reason:/CACHE/.test(error instanceof Error?error.message:'')?'RENT_CACHE_READ_FAILED':/ENTITLEMENT/.test(error instanceof Error?error.message:'')?'RENT_ENTITLEMENT_CHECK_FAILED':'RENT_EXECUTION_FAILED'})):undefined):undefined;
  const rent=marketRent?.evidence?{evidence:marketRent.evidence,freshness:marketRent.freshness}
    :options.financialEvidence&&!options.loadMarketRent&&provider?.entitlementState==='authorized'
    ?await options.loadCachedMarketRent?.(input.propertyId).catch(()=>null):null;
  const financialEvidence=options.financialEvidence?buildFinancialEvidenceFromAuthorizedContext({propertyId:input.propertyId,
    taxProjection:readModel.analyticalEvidence.fields.propertyTax,effectiveTax:reconciled?.facts?.propertyTax as Record<string,any>|undefined,
    taxReviewUnavailable:reconciled?.analyticalUnavailable===true||reconciled?.financialUnavailable===true,
    reviewSnapshot:reconciled?.owner?reconciled.reviewSnapshot:reconciled?.financialSnapshot,
    provider,cachedRent:rent,privateAssumptions:own}):null;
  return {type:'canonical_property_evidence' as const,propertyId:input.propertyId,state:'available' as const,readModel,
    ...(options.financialEvidence?{financialEvidence,financialStrategy:property.objective,financialPropertyType:property.type,marketRent}:{}),
    ...(options.rentAvmSubject?{rentAvmSubject}:{}),
    analyticalInputs,
    effectiveFacts:reconciled?.facts??null,canReview:reconciled?.owner===true,
    publicParcelState:parcels.length?'AVAILABLE':'NO_APPROVED_AVAILABLE_EVIDENCE',providerState:provider?.state??'unavailable',providerCalls:0};
}
