import {describe,it,expect,vi} from 'vitest';
import {fetchPropertyReportParcelEvidence} from './propertyReportParcelService';
const id='11111111-1111-4111-8111-111111111111';
function deps({user='actor',receipt='signed-test-token',data={state:'available',propertyId:id},error=null}={}){
 return {client:{auth:{getSession:vi.fn().mockResolvedValue({data:{session:user?{user:{id:user}}:null}})},functions:{invoke:vi.fn().mockResolvedValue({data,error})}},receiptFor:vi.fn().mockReturnValue(receipt)};
}
describe('report public parcel service',()=>{
 it.each([{user:null},{receipt:null}])('does not acquire GIS or evidence without existing actor-owned receipt: %j',async setup=>{
  const dependencies=deps(setup);expect(await fetchPropertyReportParcelEvidence(id,dependencies)).toBeNull();expect(dependencies.client.functions.invoke).not.toHaveBeenCalled();
 });
 it('sends only opaque signed receipt and property ID, never facts or plan overrides',async()=>{
  const dependencies=deps();expect(await fetchPropertyReportParcelEvidence(id,dependencies)).toMatchObject({propertyId:id});
  expect(dependencies.receiptFor).toHaveBeenCalledWith('actor',id);
  expect(dependencies.client.functions.invoke).toHaveBeenCalledWith('public-parcel',{body:{operation:'report-evidence',propertyId:id,receipt:'signed-test-token'},timeout:8000});
 });
 it('rejects evidence for another property',async()=>{expect(await fetchPropertyReportParcelEvidence(id,deps({data:{state:'available',propertyId:'other'}}))).toBeNull();});
 it('coalesces concurrent duplicate requests',async()=>{const dependencies=deps();await Promise.all([fetchPropertyReportParcelEvidence(id,dependencies),fetchPropertyReportParcelEvidence(id,dependencies)]);expect(dependencies.client.functions.invoke).toHaveBeenCalledTimes(1);});
 it('does not promote transport errors',async()=>{await expect(fetchPropertyReportParcelEvidence(id,deps({error:{message:'unavailable'}}))).rejects.toThrow('REPORT_PARCEL_EVIDENCE_UNAVAILABLE');});
 it('can obtain public APN on explicit export without requiring a prior map visit',async()=>{
  const dependencies={...deps({receipt:null}),acquire:true,rememberReceipt:vi.fn()};
  dependencies.client.rpc=vi.fn(()=>({maybeSingle:vi.fn().mockResolvedValue({data:{id,address:'100 Example St',lat:34.7,lng:-92.3}})}));
  dependencies.client.functions.invoke.mockImplementation(async(_name,{body})=>({data:body.operation==='query-point'?{evidenceReceipt:'fresh-signed-token'}:{propertyId:id,state:'available',fields:{assessorId:{value:'000-TEST-001'}}}}));
  expect(await fetchPropertyReportParcelEvidence(id,dependencies)).toMatchObject({state:'available',fields:{assessorId:{value:'000-TEST-001'}}});
  expect(dependencies.client.rpc).toHaveBeenCalledWith('ds_get_public_property_details',{p_property_id:id});
  expect(dependencies.client.functions.invoke).toHaveBeenCalledTimes(2);
  expect(dependencies.rememberReceipt).toHaveBeenCalledWith('actor',id,'fresh-signed-token');
 });
 it.each([{address:null},{hide_street_address_on_card:true},{id:'another-property'},{lat:null}])('never acquires GIS for a private or unauthorized subject: %j',async invalid=>{
  const dependencies={...deps({receipt:null}),acquire:true};
  dependencies.client.rpc=vi.fn(()=>({maybeSingle:vi.fn().mockResolvedValue({data:{id,address:'100 Example St',lat:34.7,lng:-92.3,...invalid}})}));
  expect(await fetchPropertyReportParcelEvidence(id,dependencies)).toBeNull();expect(dependencies.client.functions.invoke).not.toHaveBeenCalled();
 });
});
