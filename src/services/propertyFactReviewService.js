import {supabase,isSupabaseConfigured} from '../lib/supabaseClient';
import {cachedParcelEvidenceReceipt} from '../features/parcel/parcelEvidenceReceipt';
const pending=new Map();
export async function requestPropertyFactReview(userId,propertyId,action='READ',values={},override=null){
 if(!userId||!propertyId)throw new Error('PROPERTY_OWNER_REQUIRED');
 if(!override){if(!isSupabaseConfigured||!supabase)throw new Error('REVIEW_UNAVAILABLE');const session=await supabase.auth.getSession();if(session.data?.session?.user?.id!==userId)throw new Error('SESSION_CHANGED');}
 const key=JSON.stringify([userId,propertyId,action,values]);if(pending.has(key))return pending.get(key);
 const run=(async()=>{const receipt=action==='CHECK'?cachedParcelEvidenceReceipt(userId,propertyId):null;
  const {data,error}=await (override||((body)=>supabase.functions.invoke('property-fact-review',{body,timeout:action==='CHECK'?90000:20000})))({...values,propertyId,action,...(receipt?{parcelEvidenceReceipt:receipt}:{})});
  if(error||!data?.success){let detail=data;if(!detail&&error?.context?.json)detail=await error.context.clone().json().catch(()=>null);throw new Error(String(detail?.error||'REVIEW_UNAVAILABLE'));}return data.data;
 })();pending.set(key,run);try{return await run;}finally{if(pending.get(key)===run)pending.delete(key);}
}
export function notifyPropertySaved(userId,propertyId){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ds:property-saved',{detail:{userId,propertyId}}));}
export function openPropertyFactReview(userId,propertyId,field=''){if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId,propertyId,field}}));}
