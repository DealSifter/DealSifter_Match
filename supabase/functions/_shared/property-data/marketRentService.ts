import type {SupplementalEvidenceCache} from './supplementalEvidenceCache.ts';
import type {SupplementalEvidenceProvider,RentEstimateEvidence} from './supplementalEvidenceTypes.ts';
import {cacheFreshness,type EvidenceFreshness} from './cacheFreshness.ts';
import {InMemoryPropertySingleFlight,type PropertySingleFlight} from './singleFlight.ts';
import {rentAvmRequestIdentity,type RentAvmSubject} from './rentAvmSubject.ts';
import type {ProviderExecution} from './providerExecution.ts';
import {evidenceAbsenceReason,type EvidenceAbsenceReason} from '../maxxis/evidenceAbsence.ts';

export type MarketRentResult={state:RentAvmSubject['state']|'AVAILABLE'|'NOT_QUERIED'|'NO_RESULT'|'PROVIDER_ERROR'|'ENTITLEMENT_BLOCKED'|'USAGE_BLOCKED'|'PROVIDER_DISABLED'|'SUBJECT_CHANGED';
  propertyId:string; evidence?:RentEstimateEvidence;freshness?:EvidenceFreshness;cacheHit?:boolean;providerCalls:number|null;
  executionPhase?:ProviderExecution['phase']|'UNKNOWN';absenceReason?:EvidenceAbsenceReason;reviewField?:string;reviewFields?:string[];reason?:string};
let providerQueue:Promise<unknown>=Promise.resolve();
async function serialProvider<T>(work:()=>Promise<T>):Promise<T>{
  const task=providerQueue.then(async()=>{const start=Date.now();try{return await work();}finally{const wait=250-(Date.now()-start);if(wait>0)await new Promise(resolve=>setTimeout(resolve,wait));}});
  providerQueue=task.catch(()=>undefined);return task;
}
/** Application layer, sharing existing persistent supplemental cache, usage guard
 * (inside provider) and database single-flight. Never writes property facts. */
export class MarketRentService {
  private flight:PropertySingleFlight;
  constructor(private options:{cache:SupplementalEvidenceCache;provider:SupplementalEvidenceProvider;singleFlight?:PropertySingleFlight;
    resolveSubject:()=>Promise<RentAvmSubject>;hasEntitlement:()=>Promise<boolean>;enabled:boolean;now?:()=>Date;execution?:ProviderExecution;providerGate?:<T>(work:()=>Promise<T>)=>Promise<T>}){
    this.flight=options.singleFlight??new InMemoryPropertySingleFlight();
  }
  async get(input:{propertyId:string;userId:string;acquire:boolean}):Promise<MarketRentResult>{
    const execution=this.options.execution,initialCalls=execution?.providerCalls??0;
    let result:MarketRentResult;
    try {result=await this.load(input);}catch(error){
      const raw=error instanceof Error?error.message:'';
      result={propertyId:input.propertyId,state:'PROVIDER_ERROR',providerCalls:null,
        reason:/CACHE/.test(raw)?((execution?.providerCalls??0)>initialCalls?'RENT_CACHE_PERSISTENCE_FAILED':'RENT_CACHE_READ_FAILED')
          :/ENTITLEMENT/.test(raw)?'RENT_ENTITLEMENT_CHECK_FAILED':'RENT_EXECUTION_FAILED'};
    }
    if(execution?.recorded)result={...result,providerCalls:execution.providerCalls-initialCalls,executionPhase:execution.phase};
    return result.state==='AVAILABLE'?result:{...result,absenceReason:evidenceAbsenceReason(result.reason||result.state)};
  }
  private async load(input:{propertyId:string;userId:string;acquire:boolean}):Promise<MarketRentResult>{
    const base={propertyId:input.propertyId,providerCalls:0};
    if(!input.userId||!await this.options.hasEntitlement())return {...base,state:'ENTITLEMENT_BLOCKED'};
    const subject=await this.options.resolveSubject();
    if(subject.propertyId!==input.propertyId)return {...base,state:'SUBJECT_UNAVAILABLE'};
    if(subject.state!=='READY')return {...base,state:subject.state,reviewField:subject.reviewField,reviewFields:subject.reviewFields,reason:subject.reason};
    const identity=await rentAvmRequestIdentity(subject);
    const read=()=>this.options.cache.get(input.propertyId,'rentEstimate',identity.addressFingerprint,identity.queryFingerprint,{allowStale:true});
    const present=(entry:NonNullable<Awaited<ReturnType<typeof read>>>,calls=0):MarketRentResult=>({
      ...base,state:entry.evidence.evidenceType==='rent_estimate'&&entry.evidence.unavailableReason==='UNIT_CONTEXT_REQUIRED'?'UNIT_CONTEXT_REQUIRED':entry.evidence.status==='AVAILABLE'?'AVAILABLE':entry.evidence.status==='NO_RESULT'?'NO_RESULT':'PROVIDER_ERROR',
      evidence:entry.evidence as RentEstimateEvidence,freshness:cacheFreshness(entry,{now:this.now().getTime()}),cacheHit:calls===0,providerCalls:calls});
    const existing=await read();
    const usable=(entry:NonNullable<typeof existing>)=>entry.evidence.evidenceType==='rent_estimate'&&
      (entry.evidence.status==='AVAILABLE'||!entry.evidence.retryAfter||Date.parse(entry.evidence.retryAfter)>this.now().getTime());
    const backoff=(entry:NonNullable<typeof existing>)=>entry.evidence.evidenceType==='rent_estimate'&&!!entry.evidence.retryAfter&&Date.parse(entry.evidence.retryAfter)>this.now().getTime();
    if(existing&&(!input.acquire||!this.options.enabled||usable(existing)&&(backoff(existing)||cacheFreshness(existing,{now:this.now().getTime()}).state==='FRESH')))return present(existing);
    if(!this.options.enabled)return existing&&usable(existing)?present(existing):{...base,state:'PROVIDER_DISABLED'};
    if(!input.acquire)return {...base,state:'NOT_QUERIED'};
    return this.flight.run(`market-rent:${input.propertyId}:${identity.queryFingerprint}`,async()=>{
      const cached=await read();
      if(cached&&usable(cached)&&(backoff(cached)||cacheFreshness(cached,{now:this.now().getTime()}).state==='FRESH'))return present(cached);
      const current=await this.options.resolveSubject();
      if(current.state!=='READY')return {...base,state:current.state,reason:current.reason,reviewField:current.reviewField,reviewFields:current.reviewFields};
      if((await rentAvmRequestIdentity(current)).queryFingerprint!==identity.queryFingerprint)return {...base,state:'SUBJECT_CHANGED'};
      let evidence:RentEstimateEvidence;
      try{
        // Shared cross-isolate provider gate: at most four Market Rent starts/sec,
        // below the documented key ceiling. No retry loop around provider calls.
        evidence=await (this.options.providerGate??serialProvider)(()=>this.options.provider.getRentEstimate({...subject.lookup!,...subject.overrides,propertyId:input.propertyId,userId:input.userId,queryFingerprint:identity.queryFingerprint}));
      }catch(error){
        const reason=error instanceof Error?error.message:'';
        if(reason==='ADDRESS_CONFIRMATION_REQUIRED'||reason==='ADDRESS_MISMATCH')return {...base,state:'SUBJECT_UNAVAILABLE',reason};
        if(/BUDGET|MONTHLY_PROVIDER_LIMIT|COOLDOWN|CREDITS/.test(reason))return existing?.evidence.status==='AVAILABLE'?{...present(existing),reason:'REFRESH_BUDGET_BLOCKED'}:{...base,state:'USAGE_BLOCKED'};
        if(/PROVIDER_DISABLED|NOT_CONFIGURED/.test(reason))return {...base,state:'PROVIDER_DISABLED'};
        // Existing availability circuit uses 60s backoff. Persist only a normalized
        // attempt (not an error payload), so other isolates do not repeat a miss.
        evidence=existing?.evidence.evidenceType==='rent_estimate'&&existing.evidence.status==='AVAILABLE'
          ?{...existing.evidence,retryAfter:new Date(this.now().getTime()+60_000).toISOString()}
          :{provider:'rentcast',evidenceType:'rent_estimate',schemaVersion:1,retrievedAt:this.now().toISOString(),queryFingerprint:identity.queryFingerprint,
          status:reason==='PROPERTY_NOT_FOUND'?'NO_RESULT':'PROVIDER_ERROR',provenance:'PROVIDER_ESTIMATE',rent:null,rangeLow:null,rangeHigh:null,subjectProperty:null,comparables:[],
          retryAfter:new Date(this.now().getTime()+60_000).toISOString()};
      }
      const latest=await this.options.resolveSubject();
      if(latest.state!=='READY')return {...base,state:latest.state,reason:latest.reason,reviewField:latest.reviewField,reviewFields:latest.reviewFields,providerCalls:1};
      if((await rentAvmRequestIdentity(latest)).queryFingerprint!==identity.queryFingerprint)return {...base,state:'SUBJECT_CHANGED',providerCalls:1};
      evidence={...evidence,request:identity.request,scope:subject.scope??'PROPERTY',currency:'USD',cadence:'MONTHLY'};
      if(subject.scope!=='UNIT'&&['Multi-Family','Apartment'].includes(evidence.subjectProperty?.propertyType??''))
        evidence={...evidence,status:'NO_RESULT',rent:null,rangeLow:null,rangeHigh:null,unavailableReason:'UNIT_CONTEXT_REQUIRED'};
      const entry=await this.options.cache.set(input.propertyId,'rentEstimate',identity.addressFingerprint,evidence);
      return present(entry,1);
    });
  }
  private now(){return (this.options.now??(()=>new Date()))();}
}
