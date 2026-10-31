import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {createProviderTrace,evidenceOutcome} from './providerTrace.ts';
import {SupabasePropertyDataUsageGuard} from './usageGuard.ts';
import {RentCastPropertyDataProvider} from './providers.ts';
import {RentCastValuationDataProvider} from './valuationProvider.ts';
import {RentCastSupplementalEvidenceProvider} from './supplementalEvidenceProvider.ts';
import {PropertyDataError} from './types.ts';
const input={street:'100 Example Avenue',city:'Example City',state:'TX',zipCode:'78701'};
const record={id:'fictional-provider-record',addressLine1:input.street,city:input.city,state:input.state,zipCode:input.zipCode};
function setup(origin:'user'|'test'|'validation'|'system'='test',failTrace=false){
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const client={rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return{data:name==='ds_reserve_external_provider_usage'?crypto.randomUUID():null,error:failTrace&&name==='ds_annotate_provider_attempt'?{message:'write failure'}:null};}};
 const budget={reserve:vi.fn(async()=>({id:crypto.randomUUID(),bucket:'report' as const})),finalize:vi.fn(async()=>{})};
 const trace=createProviderTrace({origin,report:true});
 return{calls,client,budget,trace,guard:new SupabasePropertyDataUsageGuard(client,45,budget,trace)};
}
describe('R13 trusted attempt correlation, zero network',()=>{
 it.each(['user','test','validation','system'] as const)('binds both ledgers before transport, origin %s',async origin=>{
  const s=setup(origin),reservation=await s.guard.reserve({operation:'rent_estimate'});
  expect(s.calls.filter(c=>c.name==='ds_annotate_provider_attempt')).toHaveLength(2);
  await s.guard.finalize(reservation,{billableSuccess:true,httpStatus:200,errorCode:null});
  const metadata=s.calls.filter(c=>c.name==='ds_annotate_provider_attempt');
  expect(metadata.every(c=>c.args.p_request_id===s.trace.requestId&&c.args.p_report_id===s.trace.reportId&&c.args.p_origin===origin)).toBe(true);
  expect(metadata.at(-1)!.args).toMatchObject({p_usage_id:reservation.id,p_budget_usage_id:expect.any(String),p_evidence_outcome:'ACCEPTED'});
  expect(s.budget.finalize).toHaveBeenCalledWith(expect.anything(),true);
 });
 it.each([
  ['accepted',record,null,'ACCEPTED',true],
  ['rejected identity',{...record,zipCode:'99999'},null,'IDENTITY_REJECTED',true],
  ['empty',null,null,'EMPTY',true],
  ['not found',null,new PropertyDataError('PROPERTY_NOT_FOUND',{httpStatus:404}),'NOT_FOUND',false],
  ['timeout',null,new PropertyDataError('PROVIDER_TIMEOUT'),null,false],
 ] as const)('records %s independently of conservative billing',async(_label,record,failure,outcome,billable)=>{
  const s=setup('validation');
  const provider=new RentCastPropertyDataProvider({usageGuard:s.guard,logger:vi.fn(),client:{lookupProperty:async()=>{
   expect(s.calls.filter(c=>c.name==='ds_annotate_provider_attempt')).toHaveLength(2);
   if(failure)throw failure;return{record,httpStatus:200,billableSuccess:true} as any;
  }}});
  await provider.getPropertyRecord(input).catch(()=>null);
  expect(s.calls.find(c=>c.name==='ds_finalize_external_provider_usage')!.args.p_billable_success).toBe(billable);
  expect(s.calls.filter(c=>c.name==='ds_annotate_provider_attempt').at(-1)!.args.p_evidence_outcome).toBe(outcome);
 });
 it('validates the value response before recording acceptance; rejected HTTP 200 remains billable',async()=>{
  const s=setup(),provider=new RentCastValuationDataProvider({usageGuard:s.guard,logger:vi.fn(),client:{estimateValue:async()=>({valuation:{price:200000,subjectProperty:{...record,zipCode:'99999'}} as any,httpStatus:200,billableSuccess:true})}});
  await expect(provider.getValuationEvidence(input)).rejects.toMatchObject({code:'ADDRESS_MISMATCH'});
  expect(s.calls.find(c=>c.name==='ds_finalize_external_provider_usage')!.args.p_billable_success).toBe(true);
  expect(s.trace.attempts[0].evidenceOutcome).toBe('IDENTITY_REJECTED');
 });
 it('fails before HTTP and releases reservations when correlation cannot be persisted',async()=>{
  const s=setup('test',true),lookupProperty=vi.fn();
  const provider=new RentCastPropertyDataProvider({usageGuard:s.guard,logger:vi.fn(),client:{lookupProperty}});
  await expect(provider.getPropertyRecord(input)).rejects.toMatchObject({code:'PROVIDER_UPSTREAM_ERROR'});
  expect(lookupProperty).not.toHaveBeenCalled();expect(s.budget.finalize).toHaveBeenCalledWith(expect.anything(),false);
 });
 it('records an empty value response after mapping without releasing its billable HTTP 200',async()=>{
  const s=setup(),provider=new RentCastValuationDataProvider({usageGuard:s.guard,logger:vi.fn(),client:{estimateValue:async()=>({valuation:{subjectProperty:record,comparables:[]} as any,httpStatus:200,billableSuccess:true})}});
  await provider.getValuationEvidence(input);expect(s.trace.attempts[0].evidenceOutcome).toBe('EMPTY');
  expect(s.calls.find(c=>c.name==='ds_finalize_external_provider_usage')!.args.p_billable_success).toBe(true);
 });
 it('marks an empty market aggregate as EMPTY after normalization',async()=>{
  const s=setup('validation'),provider=new RentCastSupplementalEvidenceProvider({usageGuard:s.guard,client:{getMarketData:async()=>({data:{},httpStatus:200,billableSuccess:true})} as any});
  await provider.getMarketData({...input,queryFingerprint:'fictional-audit'});
  expect(s.trace.attempts[0].evidenceOutcome).toBe('EMPTY');
  expect(s.calls.find(c=>c.name==='ds_finalize_external_provider_usage')!.args.p_billable_success).toBe(true);
 });
 it('never calls a pre-HTTP failure an accepted or empty response',()=>{
  expect(evidenceOutcome({httpStatus:null,errorCode:'PROVIDER_NETWORK_ERROR'})).toBeNull();
  expect(()=>createProviderTrace({origin:'client-controlled' as any})).toThrow('INVALID_TRUSTED_PROVIDER_ORIGIN');
 });
 it('shares a report reference across independent attempts without reusing ledger IDs',async()=>{
  const s=setup('user');await s.guard.reserve({operation:'property_value_avm'});await s.guard.reserve({operation:'property_sold_search'});
  expect(s.trace.attempts).toHaveLength(2);expect(s.trace.attempts[0].usageId).not.toBe(s.trace.attempts[1].usageId);
  expect(s.calls.filter(c=>c.name==='ds_annotate_provider_attempt').every(c=>c.args.p_report_id===s.trace.reportId)).toBe(true);
 });
 it('has additive nullable metadata, post-add defaults, no backfill or historical billing RPC changes',()=>{
  const sql=readFileSync(new URL('../../../migrations/20261031060000_provider_report_attempt_trace.sql',import.meta.url),'utf8');
  expect(sql).not.toMatch(/\b(?:drop|truncate|delete)\b/i);expect(sql).not.toMatch(/alter\s+(?:policy|function)|enable\s+row\s+level/i);
  expect(sql.match(/add column request_id uuid null/g)).toHaveLength(2);expect(sql.match(/alter column origin set default 'system'/g)).toHaveLength(2);
  expect(sql).not.toMatch(/ds_(?:reserve|finalize)_(?:external_provider_usage|maxxis_provider_budget)/);
 });
});
