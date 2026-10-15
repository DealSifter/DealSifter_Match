// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {PropertyFactReview} from './PropertyFactReview';
import {FactReviewIndicator} from './FactReviewIndicator';
import {PropertyFactNotificationSync} from './PropertyFactNotificationSync';
import {PropertyFactReviewContext} from './PropertyFactReviewContext';
import {reconcilePropertyFacts,applyFactDecisions} from '../../../supabase/functions/_shared/property-fact-reconciliation/model.ts';
afterEach(cleanup);
const property={id:'33333333-3333-4333-8333-333333333333',owner_id:'owner',type:'SFR',beds:4,lot:'1.14 ac'};
const ev=(field,value,unit=null)=>({field,originalValue:value,value,unit,sourceType:'PUBLIC_PARCEL_GIS',sourceId:'qa-county',sourceFamily:'COUNTY_GIS:00000',evidenceStatus:'PUBLIC_RECORD',freshness:'FRESH'});
const additions=[ev('apn','000-TEST'),ev('owner','QA OWNER'),ev('assessedValue',120000,'USD'),ev('propertyTax',2000,'USD'),ev('zoning','R1'),ev('yearBuilt',1980),ev('subdivision','QA SUBDIVISION'),ev('legalDescription','QA LEGAL DESCRIPTION')];
describe('inline page responsiveness and persistence',()=>{
 it('selects eight complements locally and applies all in one confirmed persistence call',async()=>{
  const snapshot=await reconcilePropertyFacts(property,additions),submit=vi.fn(async(action,values)=>({snapshot:applyFactDecisions(snapshot,values.decisions,'owner'),revision:2})),back=vi.fn();
  render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={back} onSubmit={submit} onCheck={async()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Select additions'}));expect(submit).not.toHaveBeenCalled();expect(screen.getAllByRole('radio').filter(radio=>radio.checked)).toHaveLength(8);
  fireEvent.click(screen.getByRole('button',{name:'Apply and return'}));await waitFor(()=>expect(back).toHaveBeenCalledTimes(1));
  expect(submit).toHaveBeenCalledTimes(1);expect(submit.mock.calls[0][1].decisions).toHaveLength(8);expect(back.mock.calls[0][0].snapshot.summary.pending).toBe(0);
 });
 it('keeps selections on save failure and does not report a false success',async()=>{
  const snapshot=await reconcilePropertyFacts(property,additions),back=vi.fn(),submit=vi.fn().mockRejectedValueOnce(new Error('REVIEW_SAVE_FAILED')).mockImplementation(async(_action,values)=>({snapshot:applyFactDecisions(snapshot,values.decisions,'owner'),revision:2}));
  render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={back} onSubmit={submit} onCheck={async()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Select additions'}));fireEvent.click(screen.getByRole('button',{name:'Apply and return'}));await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
  expect(back).not.toHaveBeenCalled();expect(screen.getAllByRole('radio').filter(radio=>radio.checked)).toHaveLength(8);
  fireEvent.click(screen.getByRole('button',{name:'Apply and return'}));await waitFor(()=>expect(back).toHaveBeenCalledTimes(1));
 });
 it('does not disable cached decisions during a pending optional refresh',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[ev('lotArea',0.55,'ACRES')]);let finish;
  render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={()=>{}} onSubmit={async()=>{}} onCheck={()=>new Promise(resolve=>{finish=resolve;})}/>);
  fireEvent.click(screen.getByRole('button',{name:'Check available facts'}));const radio=screen.getByRole('radio',{name:'Keep my value'});expect(radio.disabled).toBe(false);fireEvent.click(radio);expect(screen.getByRole('button',{name:'Apply and return'}).disabled).toBe(false);
  await act(async()=>finish());
 });
 it('returns locally without network and ignores refresh completion after unmount',async()=>{
  const snapshot=await reconcilePropertyFacts(property,additions),back=vi.fn(),submit=vi.fn();let finish;
  const view=render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={back} onSubmit={submit} onCheck={()=>new Promise(resolve=>{finish=resolve;})}/>);
  fireEvent.click(screen.getByRole('button',{name:'Check available facts'}));fireEvent.click(screen.getByRole('button',{name:'Back to editing'}));expect(back).toHaveBeenCalledTimes(1);expect(submit).not.toHaveBeenCalled();view.unmount();await act(async()=>finish());expect(back).toHaveBeenCalledTimes(1);
 });
 it('does not call onReturn after an in-flight explicit save completes on an unmounted page',async()=>{
  const snapshot=await reconcilePropertyFacts(property,additions),back=vi.fn();let finish;
  const view=render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={back} onSubmit={()=>new Promise(resolve=>{finish=resolve;})} onCheck={async()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Select additions'}));fireEvent.click(screen.getByRole('button',{name:'Apply and return'}));view.unmount();await act(async()=>finish({snapshot,revision:2}));expect(back).not.toHaveBeenCalled();
 });
 it('renders no duplicate confirmed/resolved field cards despite stale summary counts',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[ev('beds',4)]);snapshot.summary={conflicts:1,complements:0,pending:1};snapshot.rows.beds.effective.adopted=true;
  render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={()=>{}} onSubmit={vi.fn()} onCheck={async()=>{}}/>);
  expect(document.querySelectorAll('article')).toHaveLength(0);expect(screen.getByRole('status').textContent).toBe('0 additional facts · 0 conflicts');expect(screen.queryByRole('radio')).toBeNull();
 });
 it('uses one accessible yellow icon, clickable only inside the edit modal',()=>{
  const click=vi.fn(),view=render(<FactReviewIndicator language="pt-BR"/>);expect(screen.getByRole('img',{name:'Há dados divergentes para revisar'})).toBeTruthy();expect(screen.queryByRole('button')).toBeNull();
  view.rerender(<FactReviewIndicator language="pt-BR" onClick={click}/>);fireEvent.click(screen.getByRole('button'));expect(click).toHaveBeenCalledTimes(1);
 });
 it('keeps the reviewed source selected across ordinal-ID renumbering and sends only the strict API fields',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[ev('apn','000-TEST')]),submit=vi.fn(async()=>({snapshot,revision:3}));
  const view=render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={()=>{}} onSubmit={submit} onCheck={async()=>{}}/>);
  fireEvent.click(screen.getByRole('radio',{name:/Public GIS/}));
  const reindexed=structuredClone(snapshot);reindexed.rows.apn.candidates[0].candidateId='different-display-ordinal';
  view.rerender(<PropertyFactReview property={property} record={{snapshot:reindexed,revision:2}} onReturn={()=>{}} onSubmit={submit} onCheck={async()=>{}}/>);
  expect(screen.getByRole('radio',{name:/Public GIS/}).checked).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Apply and return'}));
  await waitFor(()=>expect(submit).toHaveBeenCalledWith('DECIDE',{decisions:[{field:'apn',action:'ACCEPT_EXTERNAL_VALUE',candidateId:'different-display-ordinal'}]}));
 });
 it('does not silently apply a subset of choices after material evidence changes',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[ev('apn','000-TEST')]),submit=vi.fn();
  const view=render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={()=>{}} onSubmit={submit} onCheck={async()=>{}}/>);fireEvent.click(screen.getByRole('radio',{name:/Public GIS/}));
  const changed=await reconcilePropertyFacts(property,[ev('apn','NEW-TEST')]);view.rerender(<PropertyFactReview property={property} record={{snapshot:changed,revision:2}} onReturn={()=>{}} onSubmit={submit} onCheck={async()=>{}}/>);
  expect(screen.getByRole('button',{name:'Apply and return'}).disabled).toBe(true);expect(screen.getByRole('alert').textContent).toContain('changed');expect(submit).not.toHaveBeenCalled();
 });
 it.each([['RentCast','RENTCAST','RentCast'],['PUBLIC_PARCEL_GIS','PUBLIC_PARCEL_GIS','Public GIS']])('does not duplicate a source label or leak its internal enum: %s',async(authority,source,label)=>{
  const snapshot=await reconcilePropertyFacts(property,[{...ev('apn','000-TEST'),sourceType:source,sourceAuthority:authority}]);
  render(<PropertyFactReview property={property} record={{snapshot,revision:1}} onReturn={()=>{}} onSubmit={vi.fn()} onCheck={async()=>{}}/>);
  expect(screen.getAllByText(label)).toHaveLength(1);if(authority!==label)expect(screen.queryByText(authority)).toBeNull();
 });
 it('derives neutral/conflict notifications from the same actionable list and clears resolved attention',async()=>{
  let state=[],snapshot=await reconcilePropertyFacts(property,additions);const set=updater=>{state=updater(state);};
  const notifications=[{id:'notice',type:'property_data',propertyId:property.id,payload:{conflicts:99},read:false}];
  const context=()=>({ownedProperties:new Map([[property.id,property]]),records:{[property.id]:{snapshot}}});
  const node=()=> <PropertyFactReviewContext.Provider value={context()}><PropertyFactNotificationSync notifications={notifications} setNotifications={set} language="pt-BR"/></PropertyFactReviewContext.Provider>;
  const view=render(node());await waitFor(()=>expect(state[0]?.title).toBe('Novos dados disponíveis'));expect(state[0].message).toBe('8 novos dados · 0 divergências');
  snapshot=await reconcilePropertyFacts(property,[ev('lotArea',0.55,'ACRES')]);view.rerender(node());await waitFor(()=>expect(state[0]?.title).toBe('Dados divergentes'));expect(state[0].field).toBe('lotArea');
  snapshot=applyFactDecisions(snapshot,[{field:'lotArea',action:'KEEP_MY_VALUE'}],'owner');view.rerender(node());await waitFor(()=>expect(state).toEqual([]));
 });
});
