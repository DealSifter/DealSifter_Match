import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase,isSupabaseConfigured} from '../../lib/supabaseClient';
import {useLang} from '../../i18n/translations';
import {requestPropertyFactReview} from '../../services/propertyFactReviewService';
import {PropertyFactReviewContext} from './PropertyFactReviewContext';
import {PropertyFactReview} from './PropertyFactReview';
import {publicEffectiveFacts} from '../../../supabase/functions/_shared/property-fact-reconciliation/model.ts';
export function PropertyFactReviewProvider({userId='',properties=[],publicProperties=[],inventoryVersion=0,children}){
 const language=useLang(),[owned,setOwned]=useState({actor:'',records:{}}),[publicFacts,setPublicFacts]=useState({actor:'',facts:{}}),[request,setRequest]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(null);
 const warmRef=useRef(new Set()),userRef=useRef(userId);useEffect(()=>{userRef.current=userId;warmRef.current.clear();},[userId]);
 const [pendingLink,setPendingLink]=useState(null);
 const ownedProperties=useMemo(()=>new Map(properties.filter(p=>String(p.ownerId||p.owner_id)===userId).map(p=>[String(p.id),p])),[properties,userId]);
 const records=owned.actor===userId?Object.fromEntries(Object.entries(owned.records).filter(([id])=>ownedProperties.has(id))):{};
 const accept=useCallback((result,actor)=>{if(userRef.current!==actor)return;
  setOwned(prev=>({actor,records:{...(prev.actor===actor?prev.records:{}),[result.propertyId]:result}}));
  if(result.snapshot)setPublicFacts(prev=>({actor,facts:{...(prev.actor===actor?prev.facts:{}),[result.propertyId]:publicEffectiveFacts(result.snapshot)}}));
 },[]);
 const check=useCallback(async(propertyId,values={})=>{
  const actor=userId;if(!actor)return null;const result=await requestPropertyFactReview(actor,propertyId,'CHECK',values);accept(result,actor);
  if(!values.cacheOnly&&result.newEvidence&&result.snapshot?.summary.pending&&userRef.current===actor){setNotice({actor,propertyId,evidenceHash:result.snapshot.evidenceHash,summary:result.snapshot.summary,field:Object.values(result.snapshot.rows).find(row=>row.pending&&row.state==='REVIEW_REQUIRED')?.field||'apn'});}
  return result;
 },[accept,userId]);
 const open=useCallback(async(propertyId,field='')=>{const id=String(propertyId);if(!ownedProperties.has(id))return;
  setRequest({actor:userId,propertyId:id,field:/^[a-zA-Z]+$/.test(field)?field:''});setError('');setBusy(true);
  try{const result=await requestPropertyFactReview(userId,id,'READ');accept(result,userId);if(!result.snapshot)await check(id);}
  catch(err){setError(err.message);}finally{setBusy(false);}
 },[ownedProperties,userId,accept,check]);
 useEffect(()=>{
  if(!pendingLink||pendingLink.actor!==userId||!ownedProperties.has(pendingLink.propertyId))return;
  const timer=setTimeout(()=>{setPendingLink(null);void open(pendingLink.propertyId,pendingLink.field);},0);
  return()=>clearTimeout(timer);
 },[pendingLink,userId,ownedProperties,open]);
 const ownKeys=[...ownedProperties.keys()].sort().join('|');
 useEffect(()=>{if(!userId||!supabase||!isSupabaseConfigured)return;let active=true;
  const load=async()=>{const {data,error:failure}=await supabase.from('property_fact_reviews').select('property_id,state,revision').eq('owner_id',userId);if(failure||!active)return;
   const rows=Object.fromEntries((data||[]).map(row=>[row.property_id,{propertyId:row.property_id,snapshot:row.state,revision:row.revision}]));setOwned(prev=>({actor:userId,records:{...rows,...(prev.actor===userId?Object.fromEntries(Object.entries(prev.records).filter(([id,record])=>!rows[id]||record.revision>rows[id].revision)): {})}}));
   // One-time bounded CACHE-ONLY warmup. No GIS or paid-provider acquisition on Portfolio open.
   const missing=ownKeys.split('|').filter(id=>id&&!rows[id]&&!ownedProperties.get(id)?._localDraft&&!warmRef.current.has(`${userId}:${id}`)).slice(0,16);
   for(const id of missing){if(!active)return;warmRef.current.add(`${userId}:${id}`);await check(id,{cacheOnly:true}).catch(()=>null);}
  };void load().catch(()=>null);return()=>{active=false;};
 },[userId,ownKeys,check,ownedProperties]);
 const publicKeys=[...new Set([...publicProperties,...properties].map(p=>String(p.id||'')).filter(id=>/^[a-f0-9-]{36}$/i.test(id)))].sort().join('|');
 useEffect(()=>{if(!supabase||!isSupabaseConfigured||!publicKeys)return;let active=true;
  const load=async()=>{const ids=publicKeys.split('|'),facts={};for(let offset=0;offset<ids.length;offset+=128){const {data,error:failure}=await supabase.rpc('ds_public_effective_property_facts',{p_property_ids:ids.slice(offset,offset+128)});if(failure)return;for(const row of data||[])facts[row.property_id]=row.facts;}
   if(active)setPublicFacts({actor:userId,facts:{...facts,...(owned.actor===userId?Object.fromEntries(Object.values(owned.records).filter(row=>row.snapshot&&ownedProperties.has(row.propertyId)).map(row=>[row.propertyId,publicEffectiveFacts(row.snapshot)])):{})}});
  };void load().catch(()=>null);const focus=()=>{void load().catch(()=>null);};window.addEventListener('focus',focus);return()=>{active=false;window.removeEventListener('focus',focus);};
 },[publicKeys,userId,inventoryVersion,owned,ownedProperties]);
 useEffect(()=>{const saved=event=>{if(event.detail?.userId===userId)void check(event.detail.propertyId).catch(()=>null);};
  const parcel=event=>{if(event.detail?.userId===userId&&ownedProperties.has(String(event.detail.propertyId)))void check(event.detail.propertyId).catch(()=>null);};
  window.addEventListener('ds:property-saved',saved);window.addEventListener('ds:parcel-evidence-ready',parcel);
  const deepLink=event=>{if(event.detail?.userId!==userId)return;const id=String(event.detail.propertyId||'');if(ownedProperties.has(id))void open(id,event.detail.field);else setPendingLink({actor:userId,propertyId:id,field:event.detail.field});};window.addEventListener('ds:open-property-fact-review',deepLink);
  return()=>{window.removeEventListener('ds:property-saved',saved);window.removeEventListener('ds:parcel-evidence-ready',parcel);window.removeEventListener('ds:open-property-fact-review',deepLink);};
 },[check,userId,ownedProperties,open]);
 const current=request?.actor===userId?request:null;
 const submit=async(action,values={})=>{if(!current||busy)return;const record=records[current.propertyId];if(!record?.snapshot)return;
  setBusy(true);setError('');try{const result=await requestPropertyFactReview(userId,current.propertyId,action,{revision:record.revision,evidenceHash:record.snapshot.evidenceHash,...values});accept(result,userId);setNotice(null);}
  catch(err){setError(err.message);if(/STALE|FACTS_CHANGED/.test(err.message)){const result=await requestPropertyFactReview(userId,current.propertyId,'CHECK').catch(()=>null);if(result)accept(result,userId);}throw err;}
  finally{setBusy(false);}
 };
 const defer=async(propertyId)=>{const record=records[propertyId];setNotice(null);if(!record?.snapshot)return;const result=await requestPropertyFactReview(userId,propertyId,'DEFER',{revision:record.revision,evidenceHash:record.snapshot.evidenceHash});accept(result,userId);};
 const value={userId,records,facts:publicFacts.actor===userId?publicFacts.facts:{},ownedProperties,open,check,defer,notice:notice?.actor===userId?notice:null,dismissNotice:()=>setNotice(null)};
 return <PropertyFactReviewContext.Provider value={value}>{children}{current?<PropertyFactReview key={`${userId}:${current.propertyId}`} request={current} record={records[current.propertyId]} property={ownedProperties.get(current.propertyId)} loading={busy} error={error} language={language} onClose={()=>{setRequest(null);setError('');}} onSubmit={submit} onCheck={async()=>{setBusy(true);setError('');try{await check(current.propertyId,{force:true});}catch(err){setError(err.message);}finally{setBusy(false);}}}/>:null}</PropertyFactReviewContext.Provider>;
}
