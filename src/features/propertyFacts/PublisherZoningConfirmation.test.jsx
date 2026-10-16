// @vitest-environment jsdom
import React from 'react';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {PublisherZoningConfirmation} from './PublisherZoningConfirmation';
import {PropertyFactReviewContext} from './PropertyFactReviewContext';
import {publisherZoning,withPublisherZoning} from './publisherZoning';
afterEach(cleanup);
describe('explicit shared zoning confirmation',()=>{
 it('requires an owner click; showing or parsing a chat message never publishes',async()=>{
  const declareZoning=vi.fn().mockResolvedValue({});render(<PropertyFactReviewContext.Provider value={{ownedProperties:new Map([['a',{}]]),facts:{},declareZoning}}><PublisherZoningConfirmation propertyId="a" value="R2" language="pt"/></PropertyFactReviewContext.Provider>);
  expect(declareZoning).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Compartilhar zoneamento R2 no imóvel'}));await waitFor(()=>expect(declareZoning).toHaveBeenCalledWith('a','R2'));
 });
 it('does not offer publishing to a nonowner',()=>{
  render(<PropertyFactReviewContext.Provider value={{ownedProperties:new Map(),facts:{}}}><PublisherZoningConfirmation propertyId="a" value="R2"/></PropertyFactReviewContext.Provider>);expect(screen.queryByRole('button')).toBeNull();
 });
 it('reads only available explicitly publisher-declared zoning, not generic private/verified/conflicted facts',()=>{
  const fact={value:'R2',state:'AVAILABLE',sourceType:'USER_PROVIDED',status:'PUBLISHER_DECLARED'};
  expect(publisherZoning({zoning:fact})).toBe('R2');expect(withPublisherZoning({id:'a'},{zoning:fact})).toEqual({id:'a',publisherDeclaredZoning:'R2'});
  for(const patch of [{state:'CONFLICTED'},{status:'USER_CONFIRMED'},{sourceType:'RENTCAST'},{value:null}])expect(publisherZoning({zoning:{...fact,...patch}})).toBeNull();
 });
});
