// @vitest-environment jsdom
import React,{useEffect} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,render,waitFor} from '@testing-library/react';
const mock=vi.hoisted(()=>({request:vi.fn(),load:vi.fn(),rpc:vi.fn(),context:null}));
vi.mock('../../services/propertyFactReviewService',()=>({requestPropertyFactReview:mock.request}));
vi.mock('../../lib/supabaseClient',()=>({isSupabaseConfigured:true,supabase:{from:()=>({select:()=>({eq:mock.load})}),rpc:mock.rpc}}));
import {PropertyFactReviewProvider} from './PropertyFactReviewProvider';
import {usePropertyFactReview} from './PropertyFactReviewContext';
import {reconcilePropertyFacts,applyFactDecisions} from '../../../supabase/functions/_shared/property-fact-reconciliation/model.ts';
const actor='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
const property={id,ownerId:actor,owner_id:actor,address:'100 Synthetic QA Street',type:'SFR',lot:5000};
function Probe(){const context=usePropertyFactReview();useEffect(()=>{mock.context=context;},[context]);return <output>{context.request?.propertyId}</output>;}
const shell=(properties=[property],userId=actor,onOpenEditor=()=>{})=><PropertyFactReviewProvider userId={userId} properties={properties} onOpenEditor={onOpenEditor}><Probe/></PropertyFactReviewProvider>;
const candidate={field:'lotArea',originalValue:7000,value:7000,unit:'SQFT',sourceType:'PUBLIC_PARCEL_GIS',sourceId:'qa-county',sourceFamily:'COUNTY_GIS:00000',evidenceStatus:'PUBLIC_RECORD',freshness:'FRESH'};
beforeEach(()=>{mock.request.mockReset();mock.load.mockReset().mockResolvedValue({data:[],error:null});mock.rpc.mockReset().mockResolvedValue({data:[],error:null});mock.context=null;});
afterEach(cleanup);
describe('non-blocking owner review repository',()=>{
 it('opens/queues only client state, without a mandatory READ/CHECK or independent drawer',async()=>{
  const navigate=vi.fn(),view=render(shell([],actor,navigate));
  act(()=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'lotArea'}})));
  expect(mock.context.request).toMatchObject({propertyId:id,field:'lotArea'});expect(navigate).toHaveBeenCalledTimes(1);expect(mock.request).not.toHaveBeenCalled();expect(document.querySelector('[role="dialog"]')).toBeNull();
  view.rerender(shell());await waitFor(()=>expect(mock.context.ownedProperties.has(id)).toBe(true));expect(mock.request).not.toHaveBeenCalled();
 });
 it('never exposes a queued link or private state after actor changes',async()=>{
  const view=render(shell());act(()=>mock.context.open(id));view.rerender(shell([property],'other-owner'));
  expect(mock.context.request).toBeNull();expect(mock.context.records).toEqual({});expect(mock.context.ownedProperties.size).toBe(0);
 });
 it('uses one owner batch/public RPC, without N-property warmup or property-object refetch loops',async()=>{
  const properties=Array.from({length:10},(_,i)=>({...property,id:`33333333-3333-4333-8333-${String(i).padStart(12,'0')}`}));
  const view=render(shell(properties));await waitFor(()=>expect(mock.load).toHaveBeenCalledTimes(1));await waitFor(()=>expect(mock.rpc).toHaveBeenCalledTimes(1));
  for(let i=0;i<4;i++)view.rerender(shell(properties.map(p=>({...p}))));
  expect(mock.load).toHaveBeenCalledTimes(1);expect(mock.rpc).toHaveBeenCalledTimes(1);expect(mock.request).not.toHaveBeenCalled();
 });
 it('applies one batch, projects immediately and does not refetch public inventory',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate]);mock.load.mockResolvedValue({data:[{property_id:id,state:snapshot,revision:1}],error:null});
  const decided=applyFactDecisions(snapshot,[{field:'lotArea',action:'KEEP_MY_VALUE'}],actor);mock.request.mockResolvedValue({propertyId:id,snapshot:decided,revision:2});
  render(shell());await waitFor(()=>expect(mock.context.records[id]?.revision).toBe(1));await waitFor(()=>expect(mock.rpc).toHaveBeenCalledTimes(1));
  const values={decisions:[{field:'lotArea',action:'KEEP_MY_VALUE'}]};let first,second;
  await act(async()=>{first=mock.context.mutate(id,'DECIDE',values);second=mock.context.mutate(id,'DECIDE',values);await Promise.all([first,second]);});
  expect(first).toBe(second);expect(mock.request).toHaveBeenCalledTimes(1);expect(mock.context.facts[id].lotArea.value).toBe(5000);expect(mock.rpc).toHaveBeenCalledTimes(1);
 });
 it('ignores an older READ response rather than resurrecting resolved conflicts',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate]),decided=applyFactDecisions(snapshot,[{field:'lotArea',action:'KEEP_MY_VALUE'}],actor);
  mock.load.mockResolvedValue({data:[{property_id:id,state:snapshot,revision:1}],error:null});let resolveRead;
  mock.request.mockImplementation((_actor,_id,action)=>action==='READ'?new Promise(resolve=>{resolveRead=resolve;}):Promise.resolve({propertyId:id,snapshot:decided,revision:2}));
  render(shell());await waitFor(()=>expect(mock.context.records[id]?.revision).toBe(1));let reading;act(()=>{reading=mock.context.read(id);});
  await act(async()=>{await mock.context.mutate(id,'DECIDE',{decisions:[{field:'lotArea',action:'KEEP_MY_VALUE'}]});});
  await act(async()=>{resolveRead({propertyId:id,snapshot,revision:1});await reading;});expect(mock.context.records[id].revision).toBe(2);expect(mock.context.facts[id].lotArea.value).toBe(5000);
 });
 it('recovers a same-evidence revision conflict via READ, never a provider CHECK',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate]),decided=applyFactDecisions(snapshot,[{field:'lotArea',action:'KEEP_MY_VALUE'}],actor);
  mock.load.mockResolvedValue({data:[{property_id:id,state:snapshot,revision:1}],error:null});
  mock.request.mockRejectedValueOnce(new Error('FACT_REVIEW_STALE')).mockResolvedValueOnce({propertyId:id,snapshot,revision:2}).mockResolvedValueOnce({propertyId:id,snapshot:decided,revision:3});
  render(shell());await waitFor(()=>expect(mock.context.records[id]?.revision).toBe(1));await act(async()=>{await mock.context.mutate(id,'DECIDE',{decisions:[{field:'lotArea',action:'KEEP_MY_VALUE'}]});});
  expect(mock.request.mock.calls.map(call=>call[2])).toEqual(['DECIDE','READ','DECIDE']);expect(mock.context.records[id].revision).toBe(3);
 });
 it('preserves changed-evidence errors and never silently accepts an unreviewed version',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate]);mock.load.mockResolvedValue({data:[{property_id:id,state:snapshot,revision:1}],error:null});
  mock.request.mockRejectedValueOnce(new Error('FACT_REVIEW_STALE')).mockResolvedValueOnce({propertyId:id,snapshot:{...snapshot,evidenceHash:'changed'},revision:2});
  render(shell());await waitFor(()=>expect(mock.context.records[id]?.revision).toBe(1));await act(async()=>{await expect(mock.context.mutate(id,'DECIDE',{decisions:[]})).rejects.toThrow('STALE');});expect(mock.request).toHaveBeenCalledTimes(2);
 });
 it('recognizes a previously committed retry without making another write',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate]),decided=applyFactDecisions(snapshot,[{field:'lotArea',action:'ACCEPT_EXTERNAL_VALUE',candidateId:snapshot.rows.lotArea.candidates[0].candidateId}],actor);
  mock.load.mockResolvedValue({data:[{property_id:id,state:snapshot,revision:1}],error:null});mock.request.mockRejectedValueOnce(new Error('FACT_REVIEW_STALE')).mockResolvedValueOnce({propertyId:id,snapshot:decided,revision:2});
  render(shell());await waitFor(()=>expect(mock.context.records[id]?.revision).toBe(1));await act(async()=>{await mock.context.mutate(id,'DECIDE',{decisions:[{field:'lotArea',action:'ACCEPT_EXTERNAL_VALUE',candidateId:snapshot.rows.lotArea.candidates[0].candidateId}]});});
  expect(mock.request.mock.calls.map(call=>call[2])).toEqual(['DECIDE','READ']);expect(mock.context.facts[id].lotArea.value).toBe(7000);
 });
 it('rebinds a same-evidence retry to the exact source after ordinal IDs changed',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate]),fresh=structuredClone(snapshot);fresh.rows.lotArea.candidates[0].candidateId='new-ordinal';
  const decided=applyFactDecisions(fresh,[{field:'lotArea',action:'ACCEPT_EXTERNAL_VALUE',candidateId:'new-ordinal'}],actor);
  mock.load.mockResolvedValue({data:[{property_id:id,state:snapshot,revision:1}],error:null});mock.request.mockRejectedValueOnce(new Error('FACT_REVIEW_STALE')).mockResolvedValueOnce({propertyId:id,snapshot:fresh,revision:2}).mockResolvedValueOnce({propertyId:id,snapshot:decided,revision:3});
  render(shell());await waitFor(()=>expect(mock.context.records[id]?.revision).toBe(1));await act(async()=>{await mock.context.mutate(id,'DECIDE',{decisions:[{field:'lotArea',action:'ACCEPT_EXTERNAL_VALUE',candidateId:snapshot.rows.lotArea.candidates[0].candidateId}]});});
  expect(mock.request.mock.calls[2][3].decisions[0].candidateId).toBe('new-ordinal');expect(mock.context.facts[id].lotArea.value).toBe(7000);
 });
});
