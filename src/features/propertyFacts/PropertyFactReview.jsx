import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {factCopy,factSource,factValue} from './copy';
import {candidateCanBeAccepted} from '../../../supabase/functions/_shared/property-fact-reconciliation/model.ts';
import './propertyFacts.css';
export function PropertyFactReview({request,record,property,onClose,onSubmit,onCheck,language='en',loading=false,error=''}){
 const copy=factCopy(language),dialogRef=useRef(null),[choices,setChoices]=useState({});
 const snapshot=record?.snapshot;
 useEffect(()=>{const timer=setTimeout(()=>setChoices({}),0);return()=>clearTimeout(timer);},[record?.revision]);
 useEffect(()=>{const previous=document.activeElement,dialog=dialogRef.current;const priorOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog?.focus();
  const row=request?.field&&dialog?.querySelector(`[data-field="${request.field}"]`);row?.scrollIntoView?.({block:'center'});row?.focus();
  return()=>{document.body.style.overflow=priorOverflow;previous?.focus?.();};},[request?.propertyId,request?.field]);
 useEffect(()=>{if(!snapshot||!request?.field)return;const row=dialogRef.current?.querySelector(`[data-field="${request.field}"]`);row?.scrollIntoView?.({block:'center'});row?.focus();},[snapshot,request?.field]);
 const submit=async(action,values={})=>{try{await onSubmit(action,values);if(action==='DEFER'||action==='DECIDE')onClose();}catch{/* error remains in the drawer */}};
 return createPortal(<div className="property-fact-review-backdrop"><section className="property-fact-review" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="property-review-title" tabIndex={-1} onKeyDown={event=>{
  if(event.key==='Escape'){event.preventDefault();if(!loading)onClose();}
  if(event.key==='Tab'){const items=[...dialogRef.current.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(item=>!item.disabled&&!item.closest('fieldset[disabled]'));if(!items.length){event.preventDefault();return;}const index=items.indexOf(document.activeElement);if(event.shiftKey&&index<=0){event.preventDefault();items.at(-1).focus();}else if(!event.shiftKey&&(index<0||index===items.length-1)){event.preventDefault();items[0].focus();}}
 }}>
  <header><div><h2 id="property-review-title">{copy.title}</h2><p>{[property?.address,property?.city,property?.state].filter(Boolean).join(', ')}</p></div><button type="button" aria-label={copy.later} disabled={loading} onClick={onClose}>×</button></header>
  <div className="property-fact-review-body">
   {loading&&!snapshot?<p role="status">{copy.loading}</p>:null}{error?<p role="alert">{/STALE|FACTS_CHANGED/.test(error)?copy.stale:copy.error}</p>:null}
   {snapshot?<><p role="status">{copy.summary(snapshot.summary.complements,snapshot.summary.conflicts)}</p><p className="property-fact-qualified">{copy.qualified}</p>
    <button type="button" disabled={loading||!Object.values(snapshot.rows).some(row=>row.pending&&row.bulkCandidateId)} onClick={()=>submit('ACCEPT_ALL')}>{copy.bulk}</button>
    {Object.values(snapshot.rows).filter(row=>row.candidates.length||row.pending||row.effective.adopted).map(row=><article tabIndex={-1} data-field={row.field} key={row.field} className={row.state==='REVIEW_REQUIRED'?'property-fact-conflict':''}>
     <h3>{copy.fields[row.field]}</h3><p>{row.state==='CONFIRMED'?`✓ ${copy.confirmed}`:row.pending?row.state==='REVIEW_REQUIRED'?`⚠ ${copy.conflict}`:copy.complement:copy.reviewed}</p>
     <p><strong>{row.currentCandidate?factSource(row.currentCandidate.sourceType,language):copy.current}: </strong>{row.currentValue===null?copy.empty:factValue({value:row.currentValue,unit:row.projection.unit},row.field,language)}</p>
     {row.originalValue!=null?<small>{copy.current}: {String(row.originalValue)}</small>:null}
     {row.decision?.action==='REVIEW_LATER'?<p>{copy.deferred}</p>:null}
     <fieldset disabled={loading||row.state==='NOT_APPLICABLE'}><legend>{copy.review}</legend>
      {row.currentValue!==null?<label><input type="radio" name={row.field} checked={choices[row.field]?.action==='KEEP_MY_VALUE'} onChange={()=>setChoices(prev=>({...prev,[row.field]:{field:row.field,action:'KEEP_MY_VALUE'}}))}/>{copy.keep}: {factValue({value:row.currentValue,unit:row.projection.unit},row.field,language)}</label>:null}
      {row.candidates.map(candidate=><label key={candidate.candidateId}><input type="radio" name={row.field} checked={choices[row.field]?.candidateId===candidate.candidateId} disabled={!candidateCanBeAccepted(row,candidate,snapshot.resolvedPropertyType)} onChange={()=>setChoices(prev=>({...prev,[row.field]:{field:row.field,action:'ACCEPT_EXTERNAL_VALUE',candidateId:candidate.candidateId}}))}/>
       <span>{copy.accept}: {factValue({value:candidate.normalizedValue,unit:candidate.normalizedUnit},row.field,language)} · {factSource(candidate.sourceType,language)}{candidate.sourceAuthority&&candidate.sourceAuthority!=='PUBLISHER'?` · ${candidate.sourceAuthority}`:''}
        {candidate.metadata?.year?` · ${candidate.metadata.year}`:''}{candidate.freshness==='STALE_USABLE'?` · ${copy.staleSource}`:''}{row.projection.outliers.some(c=>c.candidateId===candidate.candidateId)?` · ${copy.outlier}`:''}
       </span></label>)}
      <label><input type="radio" name={row.field} checked={choices[row.field]?.action==='REVIEW_LATER'} onChange={()=>setChoices(prev=>({...prev,[row.field]:{field:row.field,action:'REVIEW_LATER'}}))}/>{copy.later}</label>
     </fieldset><small>{copy.original}</small>
    </article>)}{!snapshot.summary.pending?<p>{copy.quiet}</p>:null}</>:null}
  </div>
  <footer><button type="button" disabled={loading} onClick={()=>onCheck()}>{copy.check}</button><button type="button" disabled={loading} onClick={()=>snapshot?submit('DEFER'):onClose()}>{copy.later}</button><button type="button" disabled={loading||!Object.keys(choices).length} onClick={()=>submit('DECIDE',{decisions:Object.values(choices)})}>{copy.apply}</button></footer>
 </section></div>,document.body);
}
