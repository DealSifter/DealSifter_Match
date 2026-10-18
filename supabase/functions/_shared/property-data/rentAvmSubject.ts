import {formatPropertyLookupAddress, normalizeStreet, propertyAddressFingerprint, validatePropertyLookupInput} from './address.ts';
import {supplementalQueryFingerprint} from './supplementalEvidenceCache.ts';
import type {PropertyLookupInput} from './types.ts';

/** Website-compatible policy, not a promise of identical website/API values. */
export const RENTCAST_MARKET_RENT_POLICY = Object.freeze({maxRadius:5, daysOld:270, compCount:20, lookupSubjectAttributes:true});
export type RentAvmOverrides = {propertyType?:string; bedrooms?:number; bathrooms?:number; squareFootage?:number};
export type RentAvmSubject = {state:'READY'|'RENT_AVM_REVIEW_REQUIRED'|'NOT_APPLICABLE'|'UNSUPPORTED_TYPE'|'UNIT_CONTEXT_REQUIRED'|'ADDRESS_REQUIRED'|'SUBJECT_UNAVAILABLE';
  propertyId:string; lookup?:PropertyLookupInput; overrides?:RentAvmOverrides; scope?:'PROPERTY'|'UNIT'; unitId?:string; reviewField?:string};
type Values=Record<string,any>;
const TYPE_MAP:Record<string,string>={SFR:'Single Family',SINGLEFAMILY:'Single Family',SFH:'Single Family',CONDO:'Condo',CONDOMINIUM:'Condo',TOWNHOUSE:'Townhouse',TOWNHOME:'Townhouse',MANUFACTURED:'Manufactured',MOBILEHOME:'Manufactured',MULTIFAMILY:'Multi-Family',MF:'Multi-Family',APARTMENT:'Apartment'};
export function rentCastRentPropertyType(value:unknown){return TYPE_MAP[String(value??'').toUpperCase().replace(/[^A-Z]/g,'')]??null;}
const numeric=(v:unknown,min:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=Number.MAX_SAFE_INTEGER?v:null;
/** Pure resolver: a missing optional override is not an unresolved conflict. */
export function resolveRentAvmSubjectAttributes(input:{property:Values;effectiveFacts?:Values;projections?:Values;reviewSnapshot?:Values|null;decisionProofs?:Values;unavailable?:boolean;
  unitContext?:{unitId:string;bedrooms:number;bathrooms:number;squareFootage:number}}):RentAvmSubject {
  const propertyId=String(input.property.id??''),base={propertyId};
  if(input.unavailable)return {...base,state:'SUBJECT_UNAVAILABLE'};
  let lookup:PropertyLookupInput;
  try{lookup=validatePropertyLookupInput({street:input.property.address,city:input.property.city,state:input.property.state,zipCode:input.property.zip,propertyId});}
  catch{return {...base,state:'ADDRESS_REQUIRED'};}
  const overrides:RentAvmOverrides={};
  const snapshot=input.reviewSnapshot?.propertyId===propertyId?input.reviewSnapshot:null;
  for(const [field,key,raw]of [['propertyType','propertyType','type'],['beds','bedrooms','beds'],['baths','bathrooms','baths'],['buildingArea','squareFootage','sqft']] as const){
    const row=snapshot?.rows?.[field],fact=row?.effective??input.effectiveFacts?.[field],projection=row?.projection??input.projections?.[field];
    const proof=row??input.decisionProofs?.[field],decision=proof?.decision;
    const chosen=!!(fact?.state==='AVAILABLE'&&decision&&['KEEP_MY_VALUE','ACCEPT_EXTERNAL_VALUE'].includes(decision.action)
      &&decision.evidenceHash===proof.evidenceHash&&decision.value===fact.value&&decision.unit===fact.unit&&decision.source===fact.sourceType);
    if(fact?.state==='CONFLICTED'||(projection?.analyticalUsability==='CONFLICTED'||fact?.adopted===true)&&!chosen)
      return {...base,state:'RENT_AVM_REVIEW_REQUIRED',reviewField:field,lookup,overrides:{propertyType:overrides.propertyType}};
    const value=fact?.state==='AVAILABLE'?fact.value:projection?.analyticalUsability&&['CONFIRMED','SINGLE_SOURCE'].includes(projection.analyticalUsability)?projection.value:input.property[raw];
    if(key==='propertyType'){
      const token=String(value??'').toUpperCase().replace(/[^A-Z]/g,'');
      if(['LAND','LOT','TERRENO','VACANTLAND'].includes(token))return {...base,state:'NOT_APPLICABLE'};
      if(value!=null&&value!==''){
        const mapped=rentCastRentPropertyType(value);if(!mapped)return {...base,state:'UNSUPPORTED_TYPE'};
        overrides.propertyType=mapped;
      }
    }else{
      const n=numeric(value,key==='squareFootage'?Number.MIN_VALUE:0);
      if(n!==null)overrides[key]=n;
    }
  }
  const multi=['Multi-Family','Apartment'].includes(overrides.propertyType??'');
  if(multi){
    const unit=input.unitContext;
    if(!unit?.unitId?.trim()||numeric(unit.bedrooms,0)===null||numeric(unit.bathrooms,0)===null||numeric(unit.squareFootage,Number.MIN_VALUE)===null)
      return {...base,state:'UNIT_CONTEXT_REQUIRED'};
    Object.assign(overrides,{bedrooms:unit.bedrooms,bathrooms:unit.bathrooms,squareFootage:unit.squareFootage});
    return {...base,state:'READY',lookup,overrides,scope:'UNIT',unitId:unit.unitId.trim()};
  }
  return {...base,state:'READY',lookup,overrides,scope:'PROPERTY'};
}
export async function rentAvmRequestIdentity(subject:RentAvmSubject){
  if(subject.state!=='READY'||!subject.lookup)throw new Error('RENT_AVM_SUBJECT_NOT_READY');
  const addressFingerprint=await propertyAddressFingerprint(subject.lookup);
  const request={address:formatPropertyLookupAddress({...subject.lookup,street:normalizeStreet(subject.lookup.street)}),...subject.overrides,...RENTCAST_MARKET_RENT_POLICY};
  const queryFingerprint=await supplementalQueryFingerprint(addressFingerprint,'rentEstimate',{
    propertyId:subject.propertyId,provider:'rentcast',endpointVersion:'v1/avm/rent/long-term',...request,address:request.address.toUpperCase(),scope:subject.scope,unitId:subject.unitId??null});
  return {addressFingerprint,queryFingerprint,request};
}
/** Public matching proof only; no identity, history or private assumptions. */
export function publicRentAvmDecisionProofs(snapshot:Values,facts:Values){
  const proofs:Values={};
  for(const field of ['propertyType','beds','baths','buildingArea']){
    const row=snapshot?.rows?.[field],d=row?.decision,f=facts?.[field];
    if(!d||!f||d.evidenceHash!==row.evidenceHash||f.state!=='AVAILABLE'||row.effective?.value!==f.value||row.effective?.unit!==f.unit||row.effective?.sourceType!==f.sourceType)continue;
    proofs[field]={evidenceHash:row.evidenceHash,decision:{action:d.action,evidenceHash:d.evidenceHash,value:d.value,unit:d.unit,source:d.source}};
  }
  return proofs;
}
