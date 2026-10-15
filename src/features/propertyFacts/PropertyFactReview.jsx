import React,{useEffect,useMemo,useRef,useState} from 'react';
import {factCopy,factSource,factValue} from './copy';
import {actionableReview,candidateCanBeAccepted,reviewCandidateIdentity} from '../../../supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js';
import './propertyFacts.css';

// Page content only. The existing Edit Property Modal owns overlay, header, close and focus trap.
export function PropertyFactReview({request,record,property,onReturn,onClose,onSubmit,onCheck,onLoad,language='en'}){
 const copy=factCopy(language),rootRef=useRef(null),alive=useRef(false),saving=useRef(false);
 const [choices,setChoices]=useState({}),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[refreshError,setRefreshError]=useState(false);
 const snapshot=record?.snapshot,view=useMemo(()=>actionableReview(snapshot),[snapshot]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(record||!onLoad||!property?.id)return;let active=true;void onLoad(property.id).catch(()=>{if(active)setRefreshError(true);});return()=>{active=false;};},[record,onLoad,property?.id]);
 useEffect(()=>{const timer=setTimeout(()=>{const row=request?.field?rootRef.current?.querySelector(`[data-field="${request.field}"]`):null;(row||rootRef.current)?.focus();row?.scrollIntoView?.({block:'nearest'});},20);return()=>clearTimeout(timer);},[request?.field]);
 const finish=onReturn||onClose||(()=>{});
 const submit=async(action,values={})=>{
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{const result=await onSubmit(action,values);if(!result?.snapshot||!Number.isFinite(result.revision))throw new Error('REVIEW_SAVE_FAILED');if(alive.current)finish(result);}
  catch(failure){if(alive.current)setError(/STALE|FACTS_CHANGED/.test(failure.message)?copy.stale:copy.error);}
  finally{saving.current=false;if(alive.current)setBusy(false);}
 };
 const refresh=async()=>{if(refreshing)return;setRefreshing(true);setRefreshError(false);try{await onCheck();}catch{if(alive.current)setRefreshError(true);}finally{if(alive.current)setRefreshing(false);}};
 const selected=Object.values(choices).flatMap(choice=>{
  const row=view.items.find(item=>item.field===choice.field&&item.evidenceHash===choice.version);if(!row)return [];
  if(choice.action!=='ACCEPT_EXTERNAL_VALUE')return [{field:choice.field,action:choice.action}];
  const candidate=row.candidates.find(item=>reviewCandidateIdentity(item)===choice.identity);
  return candidate?[{field:choice.field,action:choice.action,candidateId:candidate.candidateId}]:[];
 });
 const outdated=selected.length!==Object.keys(choices).length;
 const additions=view.items.filter(row=>row.kind==='COMPLEMENT'&&row.bulkCandidateId&&row.candidates.some(candidate=>candidate.candidateId===row.bulkCandidateId&&candidateCanBeAccepted(row,candidate,snapshot.resolvedPropertyType)));
 return <div className="property-fact-review-page" ref={rootRef} tabIndex={-1} data-testid="property-review-page2" aria-busy={busy}>
  <div className="property-fact-review-summary"><p role="status">{copy.summary(view.summary.complements,view.summary.conflicts)}</p><button type="button" onClick={()=>finish()}>{copy.back}</button></div>
  {error||outdated?<p role="alert" className="property-fact-error">{outdated?copy.stale:error}</p>:null}
  {refreshError?<small role="status">{copy.refreshError}</small>:null}
  {additions.length?<button type="button" disabled={busy} onClick={()=>setChoices(prev=>({...prev,...Object.fromEntries(additions.map(row=>[row.field,{field:row.field,action:'ACCEPT_EXTERNAL_VALUE',version:row.evidenceHash,identity:reviewCandidateIdentity(row.candidates.find(candidate=>candidate.candidateId===row.bulkCandidateId))}]))}))}>{copy.bulk}</button>:null}
  <div className="property-fact-review-items">
   {view.items.map(row=><article key={row.field} data-field={row.field} tabIndex={-1} className={row.kind==='CONFLICT'?'property-fact-conflict':''}>
    <h4>{copy.fields[row.field]}</h4>
    <div className="property-fact-current"><span>{copy.yourData}</span><strong>{row.currentValue==null?copy.empty:factValue({value:row.currentValue,unit:row.projection.unit},row.field,language)}</strong></div>
    <fieldset disabled={busy}><legend className="property-fact-sr-only">{copy.review}: {copy.fields[row.field]}</legend>
     {row.currentValue!=null?<label><input type="radio" name={`review-${row.field}`} checked={choices[row.field]?.action==='KEEP_MY_VALUE'&&choices[row.field]?.version===row.evidenceHash} onChange={()=>setChoices(prev=>({...prev,[row.field]:{field:row.field,action:'KEEP_MY_VALUE',version:row.evidenceHash}}))}/><span>{copy.keep}</span></label>:null}
     {row.candidates.map(candidate=><label key={candidate.candidateId}>
      <input type="radio" name={`review-${row.field}`} checked={choices[row.field]?.identity===reviewCandidateIdentity(candidate)&&choices[row.field]?.version===row.evidenceHash} disabled={!candidateCanBeAccepted(row,candidate,snapshot.resolvedPropertyType)} onChange={()=>setChoices(prev=>({...prev,[row.field]:{field:row.field,action:'ACCEPT_EXTERNAL_VALUE',identity:reviewCandidateIdentity(candidate),version:row.evidenceHash}}))}/>
      <span><span className="property-fact-source">{factSource(candidate.sourceType,language)}{candidate.metadata?.year?` · ${candidate.metadata.year}`:''}</span><strong>{factValue({value:candidate.normalizedValue,unit:candidate.normalizedUnit},row.field,language)}</strong>{typeof candidate.sourceAuthority==='string'&&candidate.sourceAuthority!==factSource(candidate.sourceType,language)&&!(/^[A-Z0-9_:.-]+$/).test(candidate.sourceAuthority)?<small>{candidate.sourceAuthority}</small>:null}{candidate.freshness==='STALE_USABLE'?<small>{copy.staleSource}</small>:null}</span>
     </label>)}
     <label><input type="radio" name={`review-${row.field}`} checked={choices[row.field]?.action==='REVIEW_LATER'&&choices[row.field]?.version===row.evidenceHash} onChange={()=>setChoices(prev=>({...prev,[row.field]:{field:row.field,action:'REVIEW_LATER',version:row.evidenceHash}}))}/><span>{copy.later}</span></label>
    </fieldset>
   </article>)}
  </div>
  {!view.items.length?<p>{copy.quiet}</p>:<details><summary>{copy.sources}</summary><p>{copy.qualified}</p></details>}
  <footer><button type="button" disabled={refreshing} onClick={()=>void refresh()}>{copy.check}</button><button type="button" disabled={busy||!view.items.length} onClick={()=>void submit('DEFER')}>{copy.later}</button><button type="button" disabled={busy||outdated||!selected.length} onClick={()=>void submit('DECIDE',{decisions:selected})}>{copy.apply}</button></footer>
 </div>;
}
