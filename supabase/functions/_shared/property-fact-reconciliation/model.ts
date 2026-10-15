import {computeParcelEvidenceConsensus} from '../parcel-evidence-consensus/engine.ts';
import {publisherLotCandidate} from '../parcel-evidence-consensus/adapters.ts';
import type {CandidateInput, EvidenceCandidate} from '../parcel-evidence-consensus/types.ts';
import {projectConsensusField, type ProjectionDomain, type ProjectedEvidenceField} from '../maxxis/canonicalEvidenceProjection.ts';
import {resolveAnalysisPropertyType,toKnownFiniteNumber} from '../maxxis/canonicalFactSemantics.ts';

export const REVIEW_FIELDS = ['lotArea','apn','owner','assessedValue','propertyTax','zoning','propertyType','buildingArea','yearBuilt','beds','baths','subdivision','legalDescription'] as const;
export type ReviewField=typeof REVIEW_FIELDS[number];
export type ReconciliationState='COMPLEMENT_AVAILABLE'|'CONFIRMED'|'REVIEW_REQUIRED'|'NO_ACTION'|'UNAVAILABLE'|'NOT_APPLICABLE';
export type ReviewAction='KEEP_MY_VALUE'|'ACCEPT_EXTERNAL_VALUE'|'REVIEW_LATER';
type Decision={action:ReviewAction;evidenceHash:string;candidateId:string|null;value:number|string|null;source:CandidateInput['sourceType'];sourceId:string;unit:string|null;status:string;freshness:string;year:number|null;by:string;at:string;originalValue:unknown};
export type ReviewRow={field:ReviewField;state:ReconciliationState;originalValue:unknown;currentCandidate:EvidenceCandidate|null;currentValue:number|string|null;evidenceHash:string;projection:ProjectedEvidenceField;candidates:EvidenceCandidate[];bulkCandidateId:string|null;decision:Decision|null;pending:boolean;effective:EffectiveFact};
export type EffectiveFact={value:number|string|null;unit:string|null;state:'AVAILABLE'|'CONFLICTED'|'UNAVAILABLE'|'NOT_APPLICABLE';sourceType:string|null;sourceId?:string;status?:string;freshness?:string;year?:number|null;adopted?:boolean;userConfirmed?:boolean};
export type ReviewSnapshot={version:1;propertyId:string;publisherUpdatedAt:string|null;publicCheckedAt?:string|null;identityHash:string;publisherHash:string;evidenceHash:string;rows:Record<ReviewField,ReviewRow>;summary:{complements:number;conflicts:number;pending:number};checkedAt:string;resolvedPropertyType:string};
const aliases:Record<ReviewField,string>= {lotArea:'lot',apn:'apn',owner:'publicOwnerName',assessedValue:'assessedValue',propertyTax:'propertyTax',zoning:'zoning',propertyType:'type',buildingArea:'sqft',yearBuilt:'yearBuilt',beds:'beds',baths:'baths',subdivision:'subdivision',legalDescription:'legalDescription'};
const clean=(value:unknown)=>typeof value==='string'?value.normalize('NFKC').trim():value??null;
export function stableJson(value:unknown):string {if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>`${JSON.stringify(key)}:${stableJson(v)}`).join(',')}}`;return JSON.stringify(value??null);}
export async function evidenceHash(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJson(value)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function propertyIdentity(property:Record<string,unknown>){return [property.address,property.city,property.state,property.zip,...[property.lat,property.lng].map(value=>typeof value==='number'&&Number.isFinite(value)?value.toFixed(7):''),property.geocode_status??property.geocodeStatus].map(v=>String(v||'').normalize('NFKC').trim().toUpperCase().replace(/\s+/g,' '));}
export function publisherCandidates(property:Record<string,unknown>):CandidateInput[]{
 return REVIEW_FIELDS.map(field=>{const raw=clean(property[aliases[field]]);const lot=field==='lotArea'?publisherLotCandidate(raw as string|number|null):null;
  const numeric=['buildingArea','yearBuilt','beds','baths','assessedValue','propertyTax'].includes(field);
  return {field,originalValue:raw,...(lot||{}),...(numeric?{value:toKnownFiniteNumber(raw)}:{}),unit:field==='buildingArea'?'SQFT':['assessedValue','propertyTax'].includes(field)?'USD':lot?.unit??null,
   sourceType:'USER_PROVIDED',sourceId:'dealSifter',sourceFamily:'PUBLISHER',sourceAuthority:'PUBLISHER',evidenceStatus:raw===null||raw===''?'UNAVAILABLE':'USER_PROVIDED'};
 });
}
export function candidateCanBeAccepted(row:ReviewRow,candidate:EvidenceCandidate,resolvedType:string){
 if(!candidate.comparable||candidate.sourceFamily==='PUBLISHER')return false;
 if(row.field==='propertyType'&&resolvedType==='LAND'&&candidate.normalizedValue!=='LAND')return false;
 if(['propertyTax','assessedValue'].includes(row.field)&&['ESTIMATED','CALCULATED'].includes(candidate.evidenceStatus))return false;
 return true;
}
/** Only current raw publisher inputs + authorized evidence; never migrate a calculation input. */
export async function reconcilePropertyFacts(property:Record<string,unknown>,external:readonly CandidateInput[],previous:ReviewSnapshot|null=null,now=new Date().toISOString()):Promise<ReviewSnapshot>{
 const original=publisherCandidates(property),identityHash=await evidenceHash(propertyIdentity(property)),publisherHash=await evidenceHash(original.map(c=>[c.field,c.originalValue,c.value??null]));
 const fiscal=external.map(c=>['assessedValue','propertyTax'].includes(c.field)&&c.evidenceStatus==='CALCULATED'?{...c,evidenceStatus:'ESTIMATED' as const}:c);
 const consensus=computeParcelEvidenceConsensus([...original,...fiscal]),resolvedType=String(resolveAnalysisPropertyType(property)??'UNKNOWN'),rows={} as ReviewSnapshot['rows'];
 for(const field of REVIEW_FIELDS){
  const projection=projectConsensusField(field as ProjectionDomain,consensus.fields[field]),publisher=projection.candidates.find(c=>c.sourceFamily==='PUBLISHER'&&c.comparable);
  const oldRow=previous?.identityHash===identityHash?previous.rows[field]:null;
  const priorPublisher=oldRow?.projection.candidates.find(c=>c.sourceFamily==='PUBLISHER'&&c.comparable);
  const samePublisher=(publisher?.normalizedValue??null)===(priorPublisher?.normalizedValue??null);
  const previousSelected=oldRow?.decision&&oldRow.decision.action!=='REVIEW_LATER'?oldRow.projection.candidates.find(c=>c.candidateId===oldRow.decision?.candidateId)||oldRow.currentCandidate:oldRow?.currentCandidate;
  const current=samePublisher&&previousSelected?previousSelected:publisher;
  const candidates=projection.candidates.filter(c=>c.sourceFamily!=='PUBLISHER'&&c.comparable);
  const materialIdentity=projection.candidates.map(c=>[c.sourceFamily,c.sourceId,c.normalizedValue,c.normalizedUnit,c.evidenceStatus,c.comparable,c.metadata?.year??null,c.metadata?.concept??null,c.metadata?.countyFips??null]).sort((a,b)=>stableJson(a).localeCompare(stableJson(b)));
  const hash=await evidenceHash([field,materialIdentity]);const prior=previous?.identityHash===identityHash?previous.rows[field]?.decision:null;
  const decision=prior?.evidenceHash===hash?structuredClone(prior):null;
  const notApplicable=resolvedType==='LAND'&&['beds','baths','buildingArea','yearBuilt'].includes(field);
  const agreesWithCurrent=Boolean(current&&projection.value===current.normalizedValue&&(!['propertyTax','assessedValue'].includes(field)||candidates.every(c=>c.metadata?.year===current.metadata?.year)));
  const state:ReconciliationState=notApplicable?'NOT_APPLICABLE':projection.analyticalUsability==='CONFLICTED'?'REVIEW_REQUIRED'
   :current&&candidates.length?agreesWithCurrent||current.sourceFamily==='PUBLISHER'&&projection.consensusState==='CONSISTENT'?'CONFIRMED':'REVIEW_REQUIRED'
   :!current&&candidates.length?projection.value!==null&&['CONFIRMED','SINGLE_SOURCE'].includes(projection.analyticalUsability)?'COMPLEMENT_AVAILABLE':'REVIEW_REQUIRED'
   :current?'NO_ACTION':'UNAVAILABLE';
  let effective:EffectiveFact={value:null,unit:projection.unit,state:notApplicable?'NOT_APPLICABLE':state==='REVIEW_REQUIRED'?'CONFLICTED':'UNAVAILABLE',sourceType:null};
  if(!notApplicable&&decision&&decision.action!=='REVIEW_LATER')effective={value:decision.value,unit:decision.unit,state:'AVAILABLE',sourceType:decision.source,sourceId:decision.sourceId,status:decision.status,freshness:decision.freshness,year:decision.year,adopted:true,userConfirmed:decision.action==='KEEP_MY_VALUE'&&decision.source==='USER_PROVIDED'};
  else if(!notApplicable&&current&&state!=='REVIEW_REQUIRED')effective={value:current.normalizedValue,unit:current.normalizedUnit,state:'AVAILABLE',sourceType:current.sourceType,status:current.evidenceStatus,year:current.metadata?.year??null,adopted:Boolean(previousSelected&&samePublisher)};
  const row:ReviewRow={field,state,originalValue:original.find(c=>c.field===field)?.originalValue??null,currentCandidate:current??null,currentValue:current?.normalizedValue??null,evidenceHash:hash,projection,candidates,bulkCandidateId:null,decision,
   pending:['COMPLEMENT_AVAILABLE','REVIEW_REQUIRED'].includes(state)&&(!decision||decision.action==='REVIEW_LATER'),effective};
  const eligible=candidates.filter(c=>candidateCanBeAccepted(row,c,resolvedType)&&c.evidenceStatus!=='CALCULATED');
  if(state==='COMPLEMENT_AVAILABLE'&&eligible.length&&new Set(eligible.map(c=>stableJson([c.normalizedValue,c.normalizedUnit]))).size===1)row.bulkCandidateId=eligible[0].candidateId;
  rows[field]=row;
 }
 const summary={complements:0,conflicts:0,pending:0};for(const row of Object.values(rows)){if(row.pending){summary.pending++;if(row.state==='COMPLEMENT_AVAILABLE')summary.complements++;else summary.conflicts++;}}
 return {version:1,propertyId:String(property.id),publisherUpdatedAt:typeof property.updated_at==='string'?property.updated_at:null,identityHash,publisherHash,evidenceHash:await evidenceHash(REVIEW_FIELDS.map(field=>rows[field].evidenceHash)),rows,summary,checkedAt:now,resolvedPropertyType:resolvedType};
}
export function applyFactDecisions(snapshot:ReviewSnapshot,actions:readonly {field:ReviewField;action:ReviewAction;candidateId?:string}[],userId:string,now=new Date().toISOString()):ReviewSnapshot{
 if(!userId||actions.length>REVIEW_FIELDS.length||new Set(actions.map(a=>a.field)).size!==actions.length)throw new Error('INVALID_DECISION');
 const next=structuredClone(snapshot);
 for(const action of actions){if(!REVIEW_FIELDS.includes(action.field))throw new Error('INVALID_DECISION');const row=next.rows[action.field];if(!row||!['KEEP_MY_VALUE','ACCEPT_EXTERNAL_VALUE','REVIEW_LATER'].includes(action.action)||row.state==='NOT_APPLICABLE')throw new Error('INVALID_DECISION');
  const candidate=action.action==='ACCEPT_EXTERNAL_VALUE'?row.candidates.find(c=>c.candidateId===action.candidateId):row.currentCandidate;
  if(action.action!=='REVIEW_LATER'&&(!candidate||action.action==='ACCEPT_EXTERNAL_VALUE'&&!candidateCanBeAccepted(row,candidate,next.resolvedPropertyType)))throw new Error('INELIGIBLE_CANDIDATE');
  row.decision={action:action.action,evidenceHash:row.evidenceHash,candidateId:candidate?.candidateId??null,value:candidate?.normalizedValue??null,source:candidate?.sourceType??'USER_PROVIDED',sourceId:candidate?.sourceId??'dealSifter',unit:candidate?.normalizedUnit??row.projection.unit,status:candidate?.evidenceStatus??'UNKNOWN',freshness:candidate?.freshness??'UNKNOWN',year:candidate?.metadata?.year??null,by:userId,at:now,originalValue:row.originalValue};
  row.pending=action.action==='REVIEW_LATER';
  if(!row.pending){row.currentCandidate=candidate??null;row.currentValue=candidate?.normalizedValue??null;row.effective={value:row.decision.value,unit:row.decision.unit,state:'AVAILABLE',sourceType:row.decision.source,sourceId:row.decision.sourceId,status:row.decision.status,freshness:row.decision.freshness,year:row.decision.year,adopted:true,userConfirmed:action.action==='KEEP_MY_VALUE'&&row.decision.source==='USER_PROVIDED'};}
 }
 next.summary={complements:0,conflicts:0,pending:0};for(const row of Object.values(next.rows))if(row.pending){next.summary.pending++;if(row.state==='COMPLEMENT_AVAILABLE')next.summary.complements++;else next.summary.conflicts++;}
 return next;
}
export function publicEffectiveFacts(snapshot:ReviewSnapshot){return Object.fromEntries(REVIEW_FIELDS.map(field=>{const fact=snapshot.rows[field].effective;return [field,{value:fact.value,unit:fact.unit,state:fact.state,sourceType:fact.sourceType,status:fact.userConfirmed?'USER_CONFIRMED':fact.status??'UNKNOWN',freshness:fact.freshness??'UNKNOWN',year:fact.year??null}];}));}
export function shouldNotify(previous:ReviewSnapshot|null,next:ReviewSnapshot){return next.summary.pending>0&&next.evidenceHash!==previous?.evidenceHash&&Object.values(next.rows).some(row=>row.pending&&!row.decision);}
