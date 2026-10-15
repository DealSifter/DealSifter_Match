import { resolvePropertyDetailsInput, normalizePropertyDetails } from './propertyDetails.ts';
import { candidatesFromAuthorizedBundle } from '../parcel-evidence-consensus/adapters.ts';
import type { CandidateInput, ConsensusField } from '../parcel-evidence-consensus/types.ts';
import { buildConsensusAwareCanonicalReadModel } from './canonicalEvidenceProjection.ts';
import { readParcelEvidenceReceipt } from '../public-parcel/evidenceReceipt.ts';
import type { MaxxisPropertyEvidenceResult } from './propertyEvidence.ts';

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
type Options={input:unknown;propertyId:string;userId:string;receipt?:unknown;secret:string;parcelEnabled:boolean;
  loadPublicProperty:(id:string)=>Promise<Record<string,unknown>|null>;
  loadUserFacts?:(id:string,userId:string)=>Promise<Record<string,unknown>|null>;
  loadReconciledFacts?:(id:string,userId:string)=>Promise<{facts:Record<string,unknown>;owner:boolean}|null>;
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
  try{provider=await options.loadCachedProvider(input.propertyId);}catch{/* unavailable is evidence absence, not a new acquisition */}
  if(provider?.propertyId===input.propertyId&&provider.state==='available'&&provider.entitlementState==='authorized'&&provider.evidence){
    const evidence=provider.evidence;
    for(const [name,field]of Object.entries(FIELD_MAP)){
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
  const reconciled=await options.loadReconciledFacts?.(input.propertyId,options.userId).catch(()=>null);
  return {type:'canonical_property_evidence' as const,propertyId:input.propertyId,state:'available' as const,readModel,
    effectiveFacts:reconciled?.facts??null,canReview:reconciled?.owner===true,
    publicParcelState:parcels.length?'AVAILABLE':'NO_APPROVED_AVAILABLE_EVIDENCE',providerState:provider?.state??'unavailable',providerCalls:0};
}
