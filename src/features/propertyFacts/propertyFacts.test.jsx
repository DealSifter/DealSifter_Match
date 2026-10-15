// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {PropertyFactReview} from './PropertyFactReview';
import {PropertyFactReviewContext} from './PropertyFactReviewContext';
import {PortfolioPropertyFacts} from '../../components/matches/PortfolioPropertyFacts';
import {buildPortfolioPropertyFacts} from '../../components/matches/portfolioPropertyFactsModel';
import {buildPropertyCardFacts} from './cardFacts';
import {factCopy} from './copy';
import {optionalPropertyNumber} from '../../lib/optionalPropertyNumber';
import {reconcilePropertyFacts} from '../../../supabase/functions/_shared/property-fact-reconciliation/model.ts';

afterEach(cleanup);
const property={id:'33333333-3333-4333-8333-333333333333',owner_id:'owner',address:'100 QA Street',city:'QA City',state:'NC',zip:'27614',type:'SFR',lot:5000,sqft:1760,beds:3,baths:2,rehab:null};
const candidate=(field,value)=>({field,value,sourceType:'PUBLIC_PARCEL_GIS',sourceId:'synthetic',sourceFamily:'PUBLIC_GIS',sourceAuthority:'Synthetic county',evidenceStatus:'PUBLIC_RECORD',subjectMatch:'VERIFIED_SUBJECT',freshness:'FRESH',unit:field==='lotArea'?'SQFT':null});

describe('optional property input semantics',()=>{
 it.each([null,undefined,'','  ','\t',false,[],{},NaN,Infinity,-1])('does not manufacture zero from %j',value=>expect(optionalPropertyNumber(value)).toBeNull());
 it.each([0,'0','0.00'])('preserves explicit zero %j',value=>expect(optionalPropertyNumber(value)).toBe(0));
 it('supports currency grouping and integer fields',()=>{expect(optionalPropertyNumber('1,200',{currency:true})).toBe(1200);expect(optionalPropertyNumber('3.9',{integer:true})).toBe(3);});
});

describe('effective display isolation',()=>{
 it('does not mutate raw facts or silently resolve a conflict',()=>{
  const raw=Object.freeze({...property});
  const model=buildPortfolioPropertyFacts(raw,{},'en',{lotArea:{value:null,state:'CONFLICTED'},apn:{value:'000-TEST',state:'AVAILABLE'}});
  expect(model.details.find(row=>row.id==='lot').value).toBe('Conflicting facts');
  expect(model.details.find(row=>row.id==='apn').value).toBe('000-TEST');expect(raw.lot).toBe(5000);expect(raw.apn).toBeUndefined();
 });
 it('adapts LAND and residential without duplicating physical or rehab facts',()=>{
  const facts={propertyType:{value:'LAND',state:'AVAILABLE'},zoning:{value:'R1',state:'AVAILABLE'}};
  const land=buildPropertyCardFacts(property,facts,'en');
  expect(land.some(row=>['beds','baths','buildingArea','rehab'].includes(row.field))).toBe(false);
  const portfolio=buildPortfolioPropertyFacts(property,{},'en',facts);
  expect(portfolio.summary.find(row=>row.id==='rehab').value).toBe('N/A');expect(portfolio.details.some(row=>row.id==='beds')).toBe(false);
  expect(buildPortfolioPropertyFacts(property).summary.find(row=>row.id==='rehab').value).toBe('—');
  expect(buildPropertyCardFacts({...property,rehab:0}).find(row=>row.field==='rehab').label).toContain('0');
 });
 it('opens the exact portfolio conflict only for the owner',()=>{
  const open=vi.fn(),value={facts:{[property.id]:{lotArea:{value:null,state:'CONFLICTED'}}},ownedProperties:new Map([[property.id,property]]),open};
  const {rerender}=render(<PropertyFactReviewContext.Provider value={value}><PortfolioPropertyFacts item={property} language="en"/></PropertyFactReviewContext.Provider>);
  fireEvent.click(screen.getByRole('button',{name:'Review facts: Lot area'}));expect(open).toHaveBeenCalledWith(property.id,'lotArea');
  rerender(<PropertyFactReviewContext.Provider value={{...value,ownedProperties:new Map()}}><PortfolioPropertyFacts item={property} language="en"/></PropertyFactReviewContext.Provider>);
  expect(screen.queryByRole('button')).toBeNull();
 });
});

describe('reusable Property Fact Review',()=>{
 it.each(['pt','en','es'])('localizes the same review, permits explicit choice, defers and restores focus: %s',async language=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate('lotArea',7000),candidate('apn','000-TEST')]),copy=factCopy(language),onSubmit=vi.fn(async()=>{}),onClose=vi.fn();
  const origin=document.createElement('button');document.body.appendChild(origin);origin.focus();
  const view=render(<PropertyFactReview request={{propertyId:property.id,field:'lotArea'}} property={property} record={{snapshot,revision:1}} language={language} onSubmit={onSubmit} onClose={onClose} onCheck={()=>{}}/>);
  expect(screen.getByRole('dialog').getAttribute('aria-label')).not.toBe('');
  expect(screen.getByRole('heading',{name:copy.title})).toBeTruthy();
  const article=document.querySelector('[data-field="lotArea"]');expect(document.activeElement).toBe(article);
  fireEvent.keyDown(article,{key:'Tab',shiftKey:true});expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  const keep=[...article.querySelectorAll('input')][0];fireEvent.click(keep);
  const apply=screen.getByRole('button',{name:copy.apply});apply.focus();fireEvent.keyDown(apply,{key:'Tab'});expect(document.activeElement).toBe(screen.getByRole('dialog').querySelector('header button'));fireEvent.click(apply);
  await waitFor(()=>expect(onSubmit).toHaveBeenCalledWith('DECIDE',{decisions:[{field:'lotArea',action:'KEEP_MY_VALUE'}]}));
  const footer=screen.getByRole('dialog').querySelector('footer');fireEvent.click([...footer.querySelectorAll('button')].find(button=>button.textContent===copy.later));
  await waitFor(()=>expect(onSubmit).toHaveBeenCalledWith('DEFER',{}));
  view.unmount();expect(document.activeElement).toBe(origin);origin.remove();expect(onClose).toHaveBeenCalled();
 });
 it('preserves stale errors and does not close after a rejected save',async()=>{
  const snapshot=await reconcilePropertyFacts(property,[candidate('apn','000-TEST')]),onClose=vi.fn();
  render(<PropertyFactReview request={{propertyId:property.id}} property={property} record={{snapshot,revision:1}} onClose={onClose} onSubmit={async()=>{throw new Error('FACT_REVIEW_STALE');}} onCheck={()=>{}} error="FACT_REVIEW_STALE"/>);
  expect(screen.getByRole('alert').textContent).toContain('changed');fireEvent.click(screen.getByRole('button',{name:'Accept all non-conflicting additions'}));await new Promise(resolve=>setTimeout(resolve,0));expect(onClose).not.toHaveBeenCalled();
 });
});
