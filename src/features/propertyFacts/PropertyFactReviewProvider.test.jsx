// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
const mock=vi.hoisted(()=>({request:vi.fn(async(_actor,id)=>({propertyId:id,snapshot:null,revision:0}))}));
vi.mock('../../services/propertyFactReviewService',()=>({requestPropertyFactReview:mock.request}));
vi.mock('../../lib/supabaseClient',()=>({isSupabaseConfigured:true,supabase:{from:()=>({select:()=>({eq:async()=>({data:[{property_id:'33333333-3333-4333-8333-333333333333',state:null,revision:0}],error:null})})}),rpc:async()=>({data:[],error:null})}}));
import {PropertyFactReviewProvider} from './PropertyFactReviewProvider';
const actor='11111111-1111-4111-8111-111111111111',id='33333333-3333-4333-8333-333333333333';
const property={id,ownerId:actor,address:'100 Synthetic QA Street'};
const signal=()=>window.dispatchEvent(new CustomEvent('ds:open-property-fact-review',{detail:{userId:actor,propertyId:id,field:'lotArea'}}));
afterEach(()=>{cleanup();mock.request.mockClear();});
describe('owner-scoped cold-start deep link',()=>{
 it('queues the requested review until the owning portfolio hydrates, then opens once',async()=>{
  const view=render(<PropertyFactReviewProvider userId={actor} properties={[]}/>);signal();expect(mock.request).not.toHaveBeenCalled();
  view.rerender(<PropertyFactReviewProvider userId={actor} properties={[property]}/>);
  await waitFor(()=>expect(screen.getByRole('dialog')).toBeTruthy());expect(mock.request.mock.calls.filter(call=>call[2]==='READ')).toHaveLength(1);
  expect(mock.request.mock.calls[0].slice(0,2)).toEqual([actor,id]);
 });
 it('never replays a queued link after the authenticated actor changes',async()=>{
  const view=render(<PropertyFactReviewProvider userId={actor} properties={[]}/>);signal();
  view.rerender(<PropertyFactReviewProvider userId="different-owner" properties={[property]}/>);signal();
  await new Promise(resolve=>setTimeout(resolve,20));expect(screen.queryByRole('dialog')).toBeNull();expect(mock.request).not.toHaveBeenCalled();
 });
});
