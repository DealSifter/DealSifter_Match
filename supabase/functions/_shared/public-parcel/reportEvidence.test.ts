import {describe,it,expect,vi} from 'vitest';
import {resolveReportParcelEvidence,validateReportParcelRequest} from './reportEvidence.ts';
import {issueParcelEvidenceReceipt} from './evidenceReceipt.ts';
import {normalizeParcel} from './arcgis.ts';
import {PARCEL_SOURCES} from './registry.ts';
const id='11111111-1111-4111-8111-111111111111',point={lat:34.7,lng:-92.3},now=Date.parse('2026-10-14T12:00:00Z');
const source=PARCEL_SOURCES.find(s=>s.sourceId==='us-ar-agiso-state-parcels')!;
const geometry={type:'Polygon' as const,coordinates:[[[-92.301,34.699],[-92.299,34.699],[-92.299,34.701],[-92.301,34.701],[-92.301,34.699]]]};
const parcel=normalizeParcel(source,{parcelid:'000-TEST-001',adrlabel:'100 Example Street'},geometry,new Date(now).toISOString(),null);
const result={status:'COVERAGE_AVAILABLE' as const,parcels:[parcel],countyFips:'05119',sourceIds:[source.sourceId],ambiguity:false,exceededLimit:false,freshness:'FRESH' as const,cacheHit:true,expiresAt:new Date(now+3600000).toISOString()};
async function setup(){
 const receipt=await issueParcelEvidenceReceipt(result,point,'actor','test-secret',now);
 return {input:{operation:'report-evidence',propertyId:id,receipt},userId:'actor',secret:'test-secret',enabled:true,now,
  loadPublicProperty:vi.fn().mockResolvedValue({id,address:'100 Example St',lat:point.lat,lng:point.lng,is_active:true,publish_to_showcase:true})};
}
describe('signed public APN report projection',()=>{
 it('projects APN with provenance, without providers, premium entitlement or mutation',async()=>{
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('NO_ACQUISITION'));
  try{const response=await resolveReportParcelEvidence(await setup());expect(response).toMatchObject({state:'available',propertyId:id,fields:{assessorId:{value:'000-TEST-001',status:'VERIFIED_RECORD',source:`PUBLIC_PARCEL:${source.sourceId}`}},providerCalls:0});expect(Object.keys(response.fields)).toEqual(['assessorId']);expect(fetch).not.toHaveBeenCalled();}finally{fetch.mockRestore();}
 });
 it('refuses a neighbouring parcel even when the PIN is inside it',async()=>{const options=await setup();options.loadPublicProperty.mockResolvedValue({id,address:'102 Example St',...point});expect(await resolveReportParcelEvidence(options)).toMatchObject({state:'unavailable',reason:'PARCEL_ADDRESS_MISMATCH'});});
 it.each(['actor','point','signature','expiry','disabled','private','not-found','inactive'])('fails closed for %s',async violation=>{
  const options=await setup();
  if(violation==='actor')options.userId='other';if(violation==='signature')options.secret='other';if(violation==='expiry')options.now+=8*86400000;if(violation==='disabled')options.enabled=false;
  if(violation==='point')options.loadPublicProperty.mockResolvedValue({id,address:'100 Example St',lat:34.8,lng:point.lng});
  if(violation==='private')options.loadPublicProperty.mockResolvedValue({id,address:'100 Example St',...point,hide_street_address_on_card:true});
  if(violation==='not-found')options.loadPublicProperty.mockResolvedValue(null);
  if(violation==='inactive')options.loadPublicProperty.mockResolvedValue({id,address:'100 Example St',...point,is_active:false});
  expect(await resolveReportParcelEvidence(options)).toMatchObject({state:'unavailable',fields:{}});
  if(violation==='disabled')expect(options.loadPublicProperty).not.toHaveBeenCalled();
 });
 it('rejects arbitrary URLs, client facts, and forged scope',()=>{for(const extra of [{url:'https://invalid.example'},{apn:'forged'},{plan:'enterprise'},{propertyId:'other'}])expect(()=>validateReportParcelRequest({operation:'report-evidence',propertyId:id,receipt:'test',...extra})).toThrow();});
});
