import type {RentEstimateEvidence} from './supplementalEvidenceTypes.ts';
type CandidateInput=Parameters<typeof import('../property-fact-reconciliation/model.ts').reconcilePropertyFacts>[1][number];
/** AVM subject metadata is not an independent verified property record. Only
 * non-echoed attributes enter the existing explicit reconciliation CHECK. */
export function marketRentSubjectCandidates(evidence:RentEstimateEvidence|null|undefined):CandidateInput[]{
  if(evidence?.status!=='AVAILABLE'||evidence.scope==='UNIT'||!evidence.subjectProperty)return [];
  const rows:CandidateInput[]=[];
  for(const[field,key,requestKey,unit]of [['propertyType','propertyType','propertyType',null],['beds','bedrooms','bedrooms',null],['baths','bathrooms','bathrooms',null],['buildingArea','livingAreaSqft','squareFootage','SQFT']] as const){
    const value=evidence.subjectProperty[key];
    if(value==null||value===evidence.request?.[requestKey])continue;
    rows.push({field,originalValue:value,unit,sourceType:'RENTCAST',sourceId:'rentcast-rent-avm-subject',sourceFamily:'RENTCAST',sourceAuthority:'RentCast',
      evidenceStatus:'ESTIMATED',retrievedAt:evidence.retrievedAt});
  }
  return rows;
}
