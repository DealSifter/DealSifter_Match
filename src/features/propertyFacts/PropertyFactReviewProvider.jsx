import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase,isSupabaseConfigured} from '../../lib/supabaseClient';
import {requestPropertyFactReview} from '../../services/propertyFactReviewService';
import {PropertyFactReviewContext} from './PropertyFactReviewContext';
import {actionableReview,publicEffectiveFacts,reviewCandidateIdentity} from '../../../supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js';

export function PropertyFactReviewProvider({userId='',properties=[],publicProperties=[],inventoryVersion=0,onOpenEditor,children}){
 const [owned,setOwned]=useState({actor:'',records:{}}),[publicState,setPublicState]=useState({actor:'',facts:{}}),[request,setRequest]=useState(null),[notice,setNotice]=useState(null);
 const actorRef=useRef(userId),recordsRef=useRef({}),pendingMutations=useRef(new Map()),alive=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{actorRef.current=userId;},[userId]);
 const ownedProperties=useMemo(()=>new Map(properties.filter(p=>String(p.ownerId||p.owner_id)===userId).map(p=>[String(p.id),p])),[properties,userId]);
 const ownKeys=[...ownedProperties.keys()].sort().join('|');
 const records=useMemo(()=>owned.actor===userId?Object.fromEntries(Object.entries(owned.records).filter(([id])=>ownedProperties.has(id))):{},[owned,userId,ownedProperties]);
 useEffect(()=>{recordsRef.current=records;},[records]);
 const accept=useCallback((result,actor)=>{
  if(!alive.current||actorRef.current!==actor||!result?.propertyId)return;
  setOwned(prev=>{const entries=prev.actor===actor?prev.records:{};if(entries[result.propertyId]?.revision>result.revision)return prev;
   return {actor,records:{...entries,[result.propertyId]:result}};});
 },[]);
 const read=useCallback(async id=>{const result=await requestPropertyFactReview(userId,id,'READ');accept(result,userId);return result;},[userId,accept]);
 const check=useCallback(async(id,values={})=>{
  const result=await requestPropertyFactReview(userId,id,'CHECK',values);accept(result,userId);const view=actionableReview(result?.snapshot);
  if(alive.current&&result?.newEvidence&&view.summary.pending&&actorRef.current===userId)setNotice({actor:userId,propertyId:id,evidenceHash:result.snapshot.evidenceHash,summary:view.summary,field:view.items.find(row=>row.kind==='CONFLICT')?.field||view.items[0].field});return result;
 },[userId,accept]);
 // Opening changes client state only; the existing edit modal owns the review UI.
 const open=useCallback((propertyId,field='')=>{
  if(!userId)return;const id=String(propertyId);if(!/^[a-f0-9-]{36}$/i.test(id))return;
  setRequest({actor:userId,propertyId:id,field:/^[a-zA-Z]+$/.test(field)?field:''});onOpenEditor?.();
 },[userId,onOpenEditor]);
 const consumeRequest=useCallback(()=>setRequest(null),[]);
 useEffect(()=>{
  if(!userId||!ownKeys||!supabase||!isSupabaseConfigured)return;let active=true;
  const load=async()=>{const {data,error}=await supabase.from('property_fact_reviews').select('property_id,state,revision').eq('owner_id',userId);if(error||!active)return;
   setOwned(prev=>{const entries={...(prev.actor===userId?prev.records:{})};for(const row of data||[]){if(!ownKeys.split('|').includes(row.property_id)||entries[row.property_id]?.revision>row.revision)continue;entries[row.property_id]={propertyId:row.property_id,snapshot:row.state,revision:row.revision};}return {actor:userId,records:entries};});
  };void load().catch(()=>null);return()=>{active=false;};
 },[userId,ownKeys]); // No property-object dependency or per-row provider warmup.
 const publicKeys=[...new Set([...publicProperties,...properties].map(p=>String(p.id||'')).filter(id=>/^[a-f0-9-]{36}$/i.test(id)))].sort().join('|');
 useEffect(()=>{
  if(!supabase||!isSupabaseConfigured||!publicKeys)return;let active=true;
  const load=async()=>{const ids=publicKeys.split('|'),facts={};for(let offset=0;offset<ids.length;offset+=128){const {data,error}=await supabase.rpc('ds_public_effective_property_facts',{p_property_ids:ids.slice(offset,offset+128)});if(error)return;for(const row of data||[])facts[row.property_id]=row.facts;}
   if(active)setPublicState({actor:userId,facts});};void load().catch(()=>null);return()=>{active=false;};
 },[publicKeys,userId,inventoryVersion]); // Decisions never refetch the entire public inventory.
 useEffect(()=>{
  const saved=event=>{if(event.detail?.userId===userId&&ownedProperties.has(String(event.detail.propertyId)))void check(event.detail.propertyId,{cacheOnly:true}).catch(()=>null);};
  const parcel=event=>{if(event.detail?.userId===userId&&ownedProperties.has(String(event.detail.propertyId)))void check(event.detail.propertyId,{cacheOnly:true}).catch(()=>null);};
  const deepLink=event=>{if(event.detail?.userId===userId)open(event.detail.propertyId,event.detail.field);};
  window.addEventListener('ds:property-saved',saved);window.addEventListener('ds:parcel-evidence-ready',parcel);window.addEventListener('ds:open-property-fact-review',deepLink);
  return()=>{window.removeEventListener('ds:property-saved',saved);window.removeEventListener('ds:parcel-evidence-ready',parcel);window.removeEventListener('ds:open-property-fact-review',deepLink);};
 },[userId,ownedProperties,check,open]);
 const mutate=useCallback((id,action,values={})=>{
  const key=`${userId}:${id}`;if(pendingMutations.current.has(key))return pendingMutations.current.get(key);
  const task=(async()=>{
   const basis=recordsRef.current[id];if(!basis?.snapshot||!ownedProperties.has(String(id)))throw new Error('REVIEW_UNAVAILABLE');let result;
   try{result=await requestPropertyFactReview(userId,id,action,{revision:basis.revision,evidenceHash:basis.snapshot.evidenceHash,...values});}
   catch(error){if(!/STALE|FACTS_CHANGED/.test(error.message))throw error;const latest=await read(id);
    if(!latest?.snapshot||latest.snapshot.evidenceHash!==basis.snapshot.evidenceHash||latest.snapshot.publisherHash!==basis.snapshot.publisherHash||latest.snapshot.identityHash!==basis.snapshot.identityHash)throw error;
    const decisions=values.decisions?.map(choice=>{
     if(choice.action!=='ACCEPT_EXTERNAL_VALUE')return choice;
     const selected=basis.snapshot.rows[choice.field]?.candidates.find(candidate=>candidate.candidateId===choice.candidateId);
     const equivalent=selected&&latest.snapshot.rows[choice.field]?.candidates.find(candidate=>reviewCandidateIdentity(candidate)===reviewCandidateIdentity(selected));
     if(!equivalent)throw error;return {...choice,candidateId:equivalent.candidateId};
    });
    const alreadyPersisted=action==='DECIDE'&&decisions?.length>0&&decisions.every(choice=>{
     const row=latest.snapshot.rows[choice.field],decision=row?.decision;if(!decision||decision.action!==choice.action||decision.evidenceHash!==row.evidenceHash)return false;
     if(choice.action==='REVIEW_LATER')return true;
     const selected=choice.action==='ACCEPT_EXTERNAL_VALUE'?row.candidates.find(candidate=>candidate.candidateId===choice.candidateId):basis.snapshot.rows[choice.field]?.currentCandidate;
     return selected&&row.currentCandidate&&reviewCandidateIdentity(selected)===reviewCandidateIdentity(row.currentCandidate);
    });
    result=alreadyPersisted||action==='DEFER'&&actionableReview(latest.snapshot).summary.pending===0?latest:await requestPropertyFactReview(userId,id,action,{revision:latest.revision,evidenceHash:latest.snapshot.evidenceHash,...values,...(decisions?{decisions}:{})});}
   if(result?.propertyId!==id||!result.snapshot||!Number.isInteger(result.revision))throw new Error('INVALID_REVIEW_RESPONSE');
   accept(result,userId);if(alive.current&&actorRef.current===userId)setNotice(null);return result;
  })();pendingMutations.current.set(key,task);void task.finally(()=>{if(pendingMutations.current.get(key)===task)pendingMutations.current.delete(key);}).catch(()=>null);return task;
 },[userId,ownedProperties,read,accept]);
 const defer=useCallback(id=>mutate(id,'DEFER'),[mutate]);
 const facts=useMemo(()=>({...((publicState.actor===userId)?publicState.facts:{}),...Object.fromEntries(Object.entries(records).filter(([,record])=>record.snapshot).map(([id,record])=>[id,publicEffectiveFacts(record.snapshot)]))}),[publicState,userId,records]);
 const value=useMemo(()=>({userId,records,facts,ownedProperties,open,read,check,mutate,defer,request:request?.actor===userId?request:null,consumeRequest,notice:notice?.actor===userId?notice:null,dismissNotice:()=>setNotice(null)}),[userId,records,facts,ownedProperties,open,read,check,mutate,defer,request,consumeRequest,notice]);
 return <PropertyFactReviewContext.Provider value={value}>{children}</PropertyFactReviewContext.Provider>;
}
