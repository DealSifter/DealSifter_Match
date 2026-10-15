import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { isPropertyIntelligenceId } from './propertyIntelligenceService';
import { cachedParcelEvidenceReceipt, rememberParcelEvidenceReceipt } from '../features/parcel/parcelEvidenceReceipt';
const pending=new Map();
export async function fetchPropertyReportParcelEvidence(propertyId, dependencies = {}) {
 if(!isPropertyIntelligenceId(propertyId))return null;
 const client=dependencies.client??supabase;
 if(!client||(!dependencies.client&&!isSupabaseConfigured))return null;
 const {data}=await client.auth.getSession();const userId=data?.session?.user?.id;
 if(!userId)return null;
 const receipt=(dependencies.receiptFor??cachedParcelEvidenceReceipt)(userId,propertyId);
 const acquire=dependencies.acquire===true;
 if(!receipt&&!acquire)return null;
 const key=JSON.stringify([userId,propertyId,receipt,acquire]);
 if(pending.has(key))return pending.get(key);
 const request=(async()=>{
  const project=async token=>{
   const result=await client.functions.invoke('public-parcel',{body:{operation:'report-evidence',propertyId,receipt:token},timeout:8000});
   if(result.error)throw new Error('REPORT_PARCEL_EVIDENCE_UNAVAILABLE');
   return result.data?.propertyId===propertyId?result.data:null;
  };
  const available=receipt?await project(receipt):null;
  if(!acquire||available?.state==='available'||available?.reason==='PARCEL_ADDRESS_MISMATCH')return available;
  // Explicit report generation may acquire an approved public parcel once;
  // ordinary portfolio rendering never performs a GIS query.
  const subject=await client.rpc('ds_get_public_property_details',{p_property_id:propertyId}).maybeSingle();
  const property=subject.data,lat=property?.latitude??property?.lat,lng=property?.longitude??property?.lng;
  if(subject.error||property?.id!==propertyId||!property.address||property.hide_street_address_on_card===true||property.hideStreetAddressOnCard===true
   ||typeof lat!=='number'||typeof lng!=='number'||!Number.isFinite(lat)||!Number.isFinite(lng))return available;
  const acquired=await client.functions.invoke('public-parcel',{body:{operation:'query-point',point:{lat,lng}},timeout:15000});
  const token=acquired.error?null:acquired.data?.evidenceReceipt;
  if(!token)return available;
  const projected=await project(token);
  if(projected?.state==='available')(dependencies.rememberReceipt??rememberParcelEvidenceReceipt)(userId,propertyId,token);
  return projected;
 })();
 pending.set(key,request);
 try{return await request;}finally{if(pending.get(key)===request)pending.delete(key);}
}
