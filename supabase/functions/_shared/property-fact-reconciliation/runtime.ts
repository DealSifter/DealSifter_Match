import type {CandidateInput} from '../parcel-evidence-consensus/types.ts';
import {reconcilePropertyFacts,applyFactDecisions,publicEffectiveFacts,shouldNotify,REVIEW_FIELDS,type ReviewSnapshot,type ReviewField,type ReviewAction} from './model.ts';
type Stored={state:ReviewSnapshot;revision:number};
type Dependencies={userId:string;loadOwnedProperty:(id:string,userId:string)=>Promise<Record<string,unknown>|null>;loadReview:(id:string,userId:string)=>Promise<Stored|null>;
 acquire:(property:Record<string,unknown>,previous:ReviewSnapshot|null,receipt:unknown,force:boolean)=>Promise<CandidateInput[]>;
 store:(propertyId:string,userId:string,revision:number,state:ReviewSnapshot,publicFacts:ReturnType<typeof publicEffectiveFacts>,notify:boolean)=>Promise<number>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function runPropertyFactReview(input:unknown,deps:Dependencies){
 const body=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const id=String(body.propertyId||''),action=String(body.action||'READ');
 if(Object.keys(body).some(key=>!['propertyId','action','revision','evidenceHash','decisions','cacheOnly','force','parcelEvidenceReceipt'].includes(key)))throw new Error('INVALID_REVIEW_REQUEST');
 if(!deps.userId||!UUID.test(id)||!['READ','CHECK','DECIDE','ACCEPT_ALL','DEFER'].includes(action))throw new Error('INVALID_REVIEW_REQUEST');
 const property=await deps.loadOwnedProperty(id,deps.userId);if(!property||String(property.id)!==id||property.owner_id!==deps.userId)throw new Error('PROPERTY_OWNER_REQUIRED');
 const previous=await deps.loadReview(id,deps.userId);
 if(action==='READ')return {propertyId:id,snapshot:previous?.state??null,revision:previous?.revision??0};
 let next:ReviewSnapshot;
 if(action==='CHECK'){next=await reconcilePropertyFacts(property,await deps.acquire(property,previous?.state??null,body.parcelEvidenceReceipt,body.force===true),previous?.state??null);next.publicCheckedAt=body.cacheOnly===true?previous?.state.publicCheckedAt??null:next.checkedAt;}
 else{
  if(!previous||body.revision!==previous.revision||body.evidenceHash!==previous.state.evidenceHash)throw new Error('FACT_REVIEW_STALE');
  const cached=Object.values(previous.state.rows).flatMap(row=>row.projection.candidates.filter(c=>c.sourceFamily!=='PUBLISHER'));
  const current=await reconcilePropertyFacts(property,cached,previous.state);
  if(current.publisherHash!==previous.state.publisherHash||current.identityHash!==previous.state.identityHash)throw new Error('PROPERTY_FACTS_CHANGED');
  let actions:{field:ReviewField;action:ReviewAction;candidateId?:string}[]=[];
  if(action==='DECIDE'){
   if(!Array.isArray(body.decisions))throw new Error('INVALID_DECISION');
   actions=body.decisions.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('INVALID_DECISION');const row=item as Record<string,unknown>;
    if(Object.keys(row).some(k=>!['field','action','candidateId'].includes(k)))throw new Error('INVALID_DECISION');
    return {field:String(row.field) as ReviewField,action:String(row.action) as ReviewAction,candidateId:typeof row.candidateId==='string'?row.candidateId:undefined};});
  }else if(action==='ACCEPT_ALL')actions=REVIEW_FIELDS.filter(field=>current.rows[field].pending&&current.rows[field].bulkCandidateId).map(field=>({field,action:'ACCEPT_EXTERNAL_VALUE',candidateId:current.rows[field].bulkCandidateId!}));
  else actions=REVIEW_FIELDS.filter(field=>current.rows[field].pending).map(field=>({field,action:'REVIEW_LATER'}));
  next=applyFactDecisions(current,actions,deps.userId);
 }
 const revision=await deps.store(id,deps.userId,previous?.revision??0,next,publicEffectiveFacts(next),action==='CHECK'&&shouldNotify(previous?.state??null,next));
 return {propertyId:id,snapshot:next,revision,newEvidence:action==='CHECK'&&shouldNotify(previous?.state??null,next)};
}
