import {describe,expect,it} from 'vitest';
import {reconcilePropertyFacts,applyFactDecisions,REVIEW_FIELDS} from '../../../supabase/functions/_shared/property-fact-reconciliation/model.ts';
import {actionableReview,REVIEW_FIELDS as LIGHT_FIELDS} from '../../../supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js';
import {overlayEffectiveDraft,publisherEditValue} from './editReviewDraft';
import {runPropertyFactReview} from '../../../supabase/functions/_shared/property-fact-reconciliation/runtime.ts';
const property={id:'33333333-3333-4333-8333-333333333333',owner_id:'owner',type:'SFR',address:'QA',city:'QA',state:'NC',zip:'27614',beds:4,baths:3,lot:'1.14 ac'};
const evidence=(field,value,unit=null,sourceType='PUBLIC_PARCEL_GIS')=>({field,originalValue:value,value,unit,sourceType,sourceId:'approved-qa-source',sourceFamily:sourceType==='RENTCAST'?'RENTCAST':'COUNTY_GIS:00000',evidenceStatus:'PUBLIC_RECORD',freshness:'FRESH'});
const additions=[evidence('apn','000-TEST'),evidence('owner','QA OWNER'),evidence('assessedValue',120000,'USD'),evidence('propertyTax',2000,'USD'),evidence('zoning','R1'),evidence('yearBuilt',1980),evidence('subdivision','QA SUBDIVISION'),evidence('legalDescription','QA LEGAL DESCRIPTION')];
describe('single actionable review projection',()=>{
 it('shares the exact persisted field contract',()=>expect(LIGHT_FIELDS).toEqual(REVIEW_FIELDS));
 it('shows the Gable material lot conflict with a visible publisher value, RentCast candidate and source',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[evidence('lotArea',0.547612,'ACRES','RENTCAST')]);const view=actionableReview(snapshot);
  expect(view.summary).toEqual({complements:0,conflicts:1,pending:1});expect(view.items[0]).toMatchObject({field:'lotArea',kind:'CONFLICT'});expect(view.items[0].currentValue).toBeCloseTo(1.14*43560);expect(view.items[0].candidates[0].sourceType).toBe('RENTCAST');
 });
 it.each([['beds',4,null],['propertyType','SFR',null],['lotArea',1.13,'ACRES'],['lotArea',1.06,'ACRES']])('does not warn for identical/normalized/minor values: %s=%s',async(field,value,unit)=>{
  const snapshot=await reconcilePropertyFacts(property,[evidence(field,value,unit)]);expect(actionableReview(snapshot).summary.conflicts).toBe(0);
 });
 it('suppresses a stale one-conflict summary when its competing source is missing',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[]);snapshot.summary={complements:0,conflicts:1,pending:1};snapshot.rows.beds.pending=true;snapshot.rows.beds.state='REVIEW_REQUIRED';snapshot.rows.beds.projection.consensusState='MATERIAL_CONFLICT';
  expect(actionableReview(snapshot).items).toEqual([]);expect(actionableReview(snapshot).summary.conflicts).toBe(0);
 });
 it('treats eight provider-only facts as neutral complements, never user conflicts',async()=>{
  const snapshot=await reconcilePropertyFacts(property,additions);expect(actionableReview(snapshot).summary).toEqual({complements:8,conflicts:0,pending:8});expect(actionableReview(snapshot).items.every(row=>row.kind==='COMPLEMENT')).toBe(true);
 });
 it('saves eight complement decisions and does not render them again',async()=>{
  const snapshot=await reconcilePropertyFacts(property,additions),view=actionableReview(snapshot);
  const next=applyFactDecisions(snapshot,view.items.map(row=>({field:row.field,action:'ACCEPT_EXTERNAL_VALUE',candidateId:row.bulkCandidateId})),'owner');
  expect(next.summary.pending).toBe(0);expect(actionableReview(next).items).toEqual([]);expect(Object.values(next.rows).filter(row=>row.decision?.action==='ACCEPT_EXTERNAL_VALUE')).toHaveLength(8);
  expect(snapshot.rows.apn.originalValue).toBeNull();expect(next.rows.apn.effective.sourceType).toBe('PUBLIC_PARCEL_GIS');expect(next.rows.apn.originalValue).toBeNull();
 });
 it('accepts the exact reviewed sources after JSONB reorders object keys and ordinal display IDs change',async()=>{
  const actor='11111111-1111-4111-8111-111111111111',raw={...property,owner_id:actor};let stored=null,revision=0,writes=0,lookups=0;
  const jsonb=value=>Array.isArray(value)?value.map(jsonb):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,jsonb(item)])):value;
  const deps={userId:actor,loadOwnedProperty:async()=>raw,loadReview:async()=>stored?{state:stored,revision}:null,acquire:async()=>{lookups++;return additions;},store:async(_id,_owner,_revision,state)=>{stored=jsonb(state);writes++;return ++revision;}};
  const first=await runPropertyFactReview({propertyId:raw.id,action:'CHECK',cacheOnly:true},deps);
  const decisions=actionableReview(first.snapshot).items.map(row=>({field:row.field,action:'ACCEPT_EXTERNAL_VALUE',candidateId:row.bulkCandidateId}));
  const next=await runPropertyFactReview({propertyId:raw.id,action:'DECIDE',revision:1,evidenceHash:first.snapshot.evidenceHash,decisions},deps);
  expect(decisions).toHaveLength(8);expect(writes).toBe(2);expect(lookups).toBe(1);expect(next.snapshot.summary.pending).toBe(0);
  for(const candidate of additions){expect(next.snapshot.rows[candidate.field].effective.value).toBe(candidate.value);expect(next.snapshot.rows[candidate.field].effective.sourceType).toBe(candidate.sourceType);}
 });
 it('suppresses keep/accept/defer for the same evidence, and reopens materially new evidence',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[evidence('lotArea',0.55,'ACRES','RENTCAST')]);
  for(const action of ['KEEP_MY_VALUE','ACCEPT_EXTERNAL_VALUE','REVIEW_LATER']){
   const next=applyFactDecisions(snapshot,[{field:'lotArea',action,candidateId:snapshot.rows.lotArea.candidates[0].candidateId}],'owner');expect(actionableReview(next).items).toEqual([]);
   const same=await reconcilePropertyFacts(property,[evidence('lotArea',0.55,'ACRES','RENTCAST')],next);expect(actionableReview(same).items).toEqual([]);
   const changed=await reconcilePropertyFacts(property,[evidence('lotArea',0.75,'ACRES','RENTCAST')],next);expect(actionableReview(changed).summary.conflicts).toBe(1);
  }
 });
 it('keeps LAND locked even when a competing type is visible',async()=>{
  const snapshot=await reconcilePropertyFacts({...property,type:'Land'},[evidence('propertyType','SFR')]);const view=actionableReview(snapshot);
  expect(view.summary.conflicts).toBe(1);expect(snapshot.resolvedPropertyType).toBe('LAND');expect(snapshot.rows.beds.state).toBe('NOT_APPLICABLE');
 });
 it('reopens materially changed evidence for an explicitly accepted complement without rewriting its original null',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[evidence('apn','FIRST-TEST')]),adopted=applyFactDecisions(snapshot,[{field:'apn',action:'ACCEPT_EXTERNAL_VALUE',candidateId:snapshot.rows.apn.bulkCandidateId}],'owner');
  const next=await reconcilePropertyFacts(property,[evidence('apn','CHANGED-TEST')],adopted);
  expect(next.rows.apn.originalValue).toBeNull();expect(next.rows.apn.currentValue).toBe('FIRST-TEST');expect(actionableReview(next).summary.conflicts).toBe(1);expect(actionableReview(next).items[0].candidates[0].normalizedValue).toBe('CHANGED-TEST');
 });
 it('never warns for unqualified, unknown or unusable sources',async()=>{
  for(const source of [evidence('beds',3),{...evidence('beds',3),sourceType:'FUTURE_PROVIDER'},{...evidence('beds',3),freshness:'IDENTITY_MISMATCH'}]){
   const snapshot=await reconcilePropertyFacts(property,[source]);if(source.sourceType==='PUBLIC_PARCEL_GIS'&&source.freshness==='FRESH'){snapshot.rows.beds.candidates[0].sourceId='';}
   expect(actionableReview(snapshot).summary.conflicts).toBe(0);
  }
 });
 it('shows accepted values in the form without relabeling them as publisher input on unchanged save',async()=>{
  const raw={...property,beds:null},snapshot=await reconcilePropertyFacts(raw,[evidence('beds',3)]);
  const next=applyFactDecisions(snapshot,[{field:'beds',action:'ACCEPT_EXTERNAL_VALUE',candidateId:snapshot.rows.beds.bulkCandidateId}],'owner');
  const {draft,baseline}=overlayEffectiveDraft({beds:''},next);expect(draft.beds).toBe('3');expect(publisherEditValue('beds',draft,raw,baseline)).toBeNull();
  expect(publisherEditValue('beds',{beds:'5'},raw,baseline)).toBe('5');expect(raw.beds).toBeNull();
 });
});
