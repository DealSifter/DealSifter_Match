// Lightweight deterministic UI/persistence projection. No providers or analytical engines.
import {classifyAreaDifference,relativeAreaDifference} from '../public-parcel/areaPolicy.ts';
export const REVIEW_FIELDS=['lotArea','apn','owner','assessedValue','propertyTax','zoning','propertyType','buildingArea','yearBuilt','beds','baths','subdivision','legalDescription'];
const approved=new Set(['PUBLIC_PARCEL_GIS','PUBLIC_ASSESSOR','PUBLIC_TAX','PUBLIC_ZONING','RENTCAST']);
const present=value=>value!==null&&value!==undefined&&value!=='';
// Consensus display IDs are ordinal and may change after JSONB key reordering.
// Match explicit decisions by material field/value/provenance, never by a new ordinal alone.
export function reviewCandidateIdentity(candidate){
 return JSON.stringify([candidate.field,candidate.sourceType,candidate.sourceId,candidate.sourceFamily,candidate.normalizedValue,candidate.normalizedUnit,candidate.evidenceStatus,candidate.metadata?.year??null,candidate.metadata?.concept??null,candidate.metadata?.countyFips??null]);
}
export function candidateCanBeAccepted(row,candidate,resolvedType){
 if(!candidate.comparable||candidate.sourceFamily==='PUBLISHER')return false;
 if(row.field==='propertyType'&&String(resolvedType).toUpperCase()==='LAND'&&candidate.normalizedValue!=='LAND')return false;
 return !(['propertyTax','assessedValue'].includes(row.field)&&['ESTIMATED','CALCULATED'].includes(candidate.evidenceStatus));
}
function qualified(candidate){
 return candidate&&approved.has(candidate.sourceType)&&candidate.sourceFamily!=='PUBLISHER'&&candidate.comparable===true&&present(candidate.normalizedValue)
  &&typeof candidate.sourceId==='string'&&candidate.sourceId.trim()&&typeof candidate.candidateId==='string'&&candidate.candidateId
  &&!['UNAVAILABLE','UNKNOWN','NOT_APPLICABLE'].includes(candidate.evidenceStatus)
  &&!['EXPIRED_UNUSABLE','IDENTITY_MISMATCH','CORRUPT','ABSENT','UNAVAILABLE'].includes(candidate.freshness);
}
function materialDifference(row,candidate){
 const current=row.currentValue,value=candidate.normalizedValue;
 if(['propertyTax','assessedValue'].includes(row.field)&&row.currentCandidate?.metadata?.year!==candidate.metadata?.year)return false;
 if(typeof current==='number'&&typeof value==='number'&&['lotArea','buildingArea'].includes(row.field)){
  return classifyAreaDifference(relativeAreaDifference(current,value))==='MATERIAL_CONFLICT';
 }
 return current!==value;
}
export function actionableReview(snapshot){
 const items=[];
 for(const field of REVIEW_FIELDS){
  const row=snapshot?.rows?.[field];if(!row||row.field!==field||!row.pending||!row.projection||!Array.isArray(row.candidates)||!['COMPLEMENT_AVAILABLE','REVIEW_REQUIRED'].includes(row.state))continue;
  if((String(snapshot.resolvedPropertyType).toUpperCase()==='LAND'||snapshot.rows.propertyType?.currentValue==='LAND')&&['beds','baths','buildingArea','yearBuilt'].includes(field))continue;
  if(row.decision?.evidenceHash===row.evidenceHash)continue; // Includes same-evidence REVIEW_LATER attention suppression.
  const seen=new Set(),candidates=(row.candidates||[]).filter(candidate=>{
   if(!qualified(candidate))return false;
   const identity=JSON.stringify([candidate.sourceFamily,candidate.normalizedValue,candidate.normalizedUnit,candidate.metadata?.year]);
   if(seen.has(identity))return false;seen.add(identity);return true;
  });
  if(!candidates.length)continue;
  const hasCurrent=present(row.currentValue),hasUser=present(row.originalValue)||row.currentUserMaintained===true;
  if(hasCurrent&&hasUser&&row.state==='REVIEW_REQUIRED'&&(row.currentUserMaintained===true||['MATERIAL_CONFLICT','OUTLIER_DETECTED','INSUFFICIENT_EVIDENCE'].includes(row.projection?.consensusState))){
   const differing=candidates.filter(candidate=>materialDifference(row,candidate));
   if(differing.length)items.push({...row,kind:'CONFLICT',candidates:differing});
  }else if(!hasCurrent){items.push({...row,kind:'COMPLEMENT',candidates});}
 }
 const conflicts=items.filter(item=>item.kind==='CONFLICT').length;
 return {items,summary:{conflicts,complements:items.length-conflicts,pending:items.length}};
}
export function publicEffectiveFacts(snapshot){
 return Object.fromEntries(REVIEW_FIELDS.flatMap(field=>{const fact=snapshot?.rows?.[field]?.effective;if(!fact)return [];
  return [[field,{value:fact.value,unit:fact.unit,state:fact.state,sourceType:fact.sourceType,status:fact.userConfirmed?'USER_CONFIRMED':fact.status??'UNKNOWN',freshness:fact.freshness??'UNKNOWN',year:fact.year??null}]];
 }));
}
