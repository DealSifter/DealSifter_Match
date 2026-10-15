// @vitest-environment jsdom
import {describe,expect,it,vi} from 'vitest';
import {requestPropertyFactReview,notifyPropertySaved,openPropertyFactReview} from './propertyFactReviewService';
describe('owner-scoped review transport',()=>{
 it('coalesces a concurrent request without allowing identity/action override',async()=>{
  let done;const invoke=vi.fn(body=>new Promise(resolve=>{done=()=>resolve({data:{success:true,data:body}});}));
  const values={propertyId:'forged',action:'DECIDE',cacheOnly:true};
  const first=requestPropertyFactReview('owner','property','CHECK',values,invoke),second=requestPropertyFactReview('owner','property','CHECK',values,invoke);
  expect(invoke).toHaveBeenCalledTimes(1);done();expect(await first).toMatchObject({propertyId:'property',action:'CHECK'});expect(await second).toEqual(await first);
  await requestPropertyFactReview('other','property','READ',{},async()=>({data:{success:true,data:{actor:'other'}}}));expect(invoke).toHaveBeenCalledTimes(1);
 });
 it('clears failed requests so a later retry is possible',async()=>{const invoke=vi.fn().mockResolvedValueOnce({error:{},data:{error:'FACT_REVIEW_STALE'}}).mockResolvedValueOnce({data:{success:true,data:{revision:2}}});await expect(requestPropertyFactReview('owner','p','READ',{},invoke)).rejects.toThrow('STALE');expect(await requestPropertyFactReview('owner','p','READ',{},invoke)).toEqual({revision:2});});
 it('rejects missing ownership and emits only stable saved/deep-link events',async()=>{await expect(requestPropertyFactReview('','p','READ',{},vi.fn())).rejects.toThrow('OWNER');const saved=vi.fn(),open=vi.fn();window.addEventListener('ds:property-saved',saved);window.addEventListener('ds:open-property-fact-review',open);notifyPropertySaved('owner','p');openPropertyFactReview('owner','p','lotArea');expect(saved.mock.calls[0][0].detail).toEqual({userId:'owner',propertyId:'p'});expect(open.mock.calls[0][0].detail).toEqual({userId:'owner',propertyId:'p',field:'lotArea'});window.removeEventListener('ds:property-saved',saved);window.removeEventListener('ds:open-property-fact-review',open);});
});
