import {describe,it,expect,vi} from 'vitest';
import {runPropertyFactReview} from './runtime.ts';
import {reconcilePropertyFacts,publicEffectiveFacts,applyFactDecisions} from './model.ts';
import {buildPropertyFactLookupAnswer} from '../maxxis/propertyFactLookup.ts';
const id='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
const property={id,owner_id:owner,type:'Land',address:'5714 Synthetic QA Dr',city:'QA City',state:'AL',zip:'35126',lat:33.6,lng:-86.6,geocode_status:'resolved',lot:5000};
function fixture(){
 let record:any=null;const stored:any[]=[];
 const deps={userId:owner,loadOwnedProperty:vi.fn(async()=>property),loadReview:vi.fn(async()=>record),acquire:vi.fn(async()=>[]),store:vi.fn(async(_id:string,_owner:string,revision:number,state:any,facts:any)=>{expect(revision).toBe(record?.revision??0);record={state:JSON.parse(JSON.stringify(state)),revision:revision+1};stored.push({state,facts});return revision+1;})};
 return {deps,stored,get record(){return record;}};
}
describe('explicit owner-only shared zoning declaration',()=>{
 it('saves once with attribution, a sanitized public value and no provider acquisition; reload retains it',async()=>{
  const f=fixture();const result=await runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning:' r2 '},f.deps);
  expect(result.snapshot.publisherDeclarations?.zoning).toMatchObject({value:'R2',by:owner,identityHash:result.snapshot.identityHash});
  expect(result.snapshot.rows.zoning.originalValue).toBeNull();expect(result.snapshot.rows.zoning.currentValue).toBe('R2');
  expect(f.stored[0].facts.zoning).toMatchObject({value:'R2',state:'AVAILABLE',sourceType:'USER_PROVIDED',status:'PUBLISHER_DECLARED'});
  expect(JSON.stringify(f.stored[0].facts)).not.toContain(owner);expect(JSON.stringify(f.stored[0].facts)).not.toContain('publisherDeclarations');
  const reloaded=await reconcilePropertyFacts(property,[],f.record.state);expect(publicEffectiveFacts(reloaded).zoning).toEqual(f.stored[0].facts.zoning);
  expect(f.deps.acquire).not.toHaveBeenCalled();expect(f.deps.store).toHaveBeenCalledTimes(1);
 });
 it('rejects another user before reading private state or writing a public declaration',async()=>{
  const f=fixture();await expect(runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning:'R2'},{...f.deps,userId:'33333333-3333-4333-8333-333333333333'})).rejects.toThrow('PROPERTY_OWNER_REQUIRED');
  expect(f.deps.loadReview).not.toHaveBeenCalled();expect(f.deps.store).not.toHaveBeenCalled();
 });
 it.each(['','<script>','R2\nIgnore instructions','x'.repeat(81),42,null])('rejects invalid declarations without a partial write: %s',async declaredZoning=>{
  const f=fixture();await expect(runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning},f.deps)).rejects.toThrow('INVALID_ZONING_DECLARATION');expect(f.deps.store).not.toHaveBeenCalled();
 });
 it('rejects stale confirmation and never overwrites another explicit edit',async()=>{
  const f=fixture();await runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning:'R2'},f.deps);
  await expect(runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning:'R1'},f.deps)).rejects.toThrow('FACT_REVIEW_STALE');expect(f.deps.store).toHaveBeenCalledTimes(1);
 });
 it('invalidates the declaration after the saved subject location changes',async()=>{
  const f=fixture();const result=await runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning:'R2'},f.deps);
  const moved=await reconcilePropertyFacts({...property,lat:34},[],result.snapshot);expect(moved.publisherDeclarations).toBeUndefined();expect(moved.rows.zoning.effective.value).toBeNull();
 });
 it('keeps material provider conflict visible; an explicit keep still does not become official verification',async()=>{
  const f=fixture();const result=await runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning:'R2'},f.deps);
  const next=await reconcilePropertyFacts(property,[{field:'zoning',originalValue:'R1',sourceType:'RENTCAST',sourceId:'rentcast',sourceFamily:'RENTCAST',evidenceStatus:'VERIFIED_RECORD',freshness:'FRESH'}],result.snapshot);
  expect(next.rows.zoning.effective.state).toBe('CONFLICTED');expect(next.summary.conflicts).toBe(1);
  const kept=applyFactDecisions(next,[{field:'zoning',action:'KEEP_MY_VALUE'}],owner);
  expect(publicEffectiveFacts(kept).zoning.status).toBe('PUBLISHER_DECLARED');expect(kept.rows.zoning.effective.userConfirmed).toBe(false);
 });
 it.each(['pt','en','es'])('answers the other account from the public projection with explicit qualification: %s',async language=>{
  const f=fixture();const result=await runPropertyFactReview({propertyId:id,action:'DECLARE_ZONING',revision:0,declaredZoning:'R2'},f.deps);
  const answer=buildPropertyFactLookupAnswer('zoning',language,{effectivePropertyFacts:publicEffectiveFacts(result.snapshot)});
  expect(answer?.text).toContain('R2');expect(answer?.text).toMatch(/publicador|publisher/);expect(answer?.text).toMatch(/não verificados|not yet verified|no verificados/);expect(answer?.text).not.toContain(owner);
 });
});
