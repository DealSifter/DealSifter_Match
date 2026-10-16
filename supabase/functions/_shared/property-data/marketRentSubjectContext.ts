import {propertyAddressFingerprint} from './address.ts';
import {SupabasePropertyIntelligenceCache} from './cache.ts';
import {cacheFreshness} from './cacheFreshness.ts';
import {resolveRentAvmSubjectAttributes,type RentAvmSubject} from './rentAvmSubject.ts';
import {reconcilePropertyFacts} from '../property-fact-reconciliation/model.ts';
type CandidateInput=Parameters<typeof reconcilePropertyFacts>[1][number];
/** Trusted backend report capability only; no provider acquisition or private
 * investor inputs. Uses the same publisher review and normalized record cache. */
export async function resolveCachedRentAvmSubject(client:any,propertyId:string):Promise<RentAvmSubject>{
  const property=await client.from('properties').select('id,type,address,city,state,zip,beds,baths,sqft,lot,owner_id,lat,lng,geocode_status').eq('id',propertyId).maybeSingle();
  if(property.error||!property.data)return {propertyId,state:'SUBJECT_UNAVAILABLE'};
  const raw=property.data,review=await client.from('property_fact_reviews').select('state').eq('property_id',propertyId).eq('owner_id',raw.owner_id).maybeSingle();
  if(review.error)return {propertyId,state:'SUBJECT_UNAVAILABLE'};
  const cached=await new SupabasePropertyIntelligenceCache(client).getPropertyRecord(propertyId,{allowStale:true});
  const candidates:CandidateInput[]=[];
  if(cached&&cached.addressFingerprint===await propertyAddressFingerprint({street:raw.address,city:raw.city,state:raw.state,zipCode:raw.zip})){
    for(const[field,key,unit]of [['propertyType','propertyType',null],['beds','bedrooms',null],['baths','bathrooms',null],['buildingArea','livingAreaSqft','SQFT']] as const){
      const fact=cached.record.characteristics[key];
      candidates.push({field,originalValue:fact.value,unit,sourceType:'RENTCAST',sourceId:'rentcast',sourceFamily:'RENTCAST',sourceAuthority:'RentCast',evidenceStatus:fact.status,
        retrievedAt:fact.retrievedAt,sourceUpdatedAt:fact.effectiveDate,freshness:cacheFreshness(cached).state,
        metadata:{year:null,countyFips:cached.record.parcel?.countyFips?.value??null}});
    }
  }
  // Retain current-identity GIS evidence already reconciled by the existing pipeline.
  const snapshot=review.data?.state??null;
  const {propertyIdentity,evidenceHash}=await import('../property-fact-reconciliation/model.ts');
  const currentFields=new Set(candidates.map(c=>`${c.sourceFamily}:${c.field}`));
  if(snapshot?.identityHash===await evidenceHash(propertyIdentity(raw)))
    candidates.push(...Object.values(snapshot.rows as Record<string,any>).flatMap(row=>row.projection.candidates.filter((c:CandidateInput)=>c.sourceFamily!=='PUBLISHER'&&!currentFields.has(`${c.sourceFamily}:${c.field}`))));
  const current=await reconcilePropertyFacts(raw,candidates,snapshot);
  return resolveRentAvmSubjectAttributes({property:raw,reviewSnapshot:current});
}
