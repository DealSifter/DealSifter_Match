import { describe, it, expect, vi } from 'vitest';
import { propertyIntelligenceExposed } from './exposure.ts';
import { propertyAddressFingerprint } from './address.ts';
import { PropertyEvidenceService } from './propertyEvidenceService.ts';
import { InMemoryPropertyIntelligenceCache } from './cache.ts';
import { InMemoryPropertySingleFlight, SupabasePropertySingleFlight } from './singleFlight.ts';
import { mapRentCastProperty } from './rentcast/rentcastMapper.ts';
import { resolvePropertyIntelligenceAccess } from './propertyIntelligenceAccess.ts';
import { RentCastPropertyDataProvider } from './providers.ts';
import { SupabasePropertyEvidenceRepository } from './propertyRepository.ts';
import { createBackendPropertyEvidenceService } from './backendFactory.ts';

const id='11111111-1111-4111-8111-111111111111';
const lookup={street:'100 Fixture St',city:'Austin',state:'TX',zipCode:'78701'};
const property={id,type:'SFR',address:lookup.street,city:lookup.city,state:lookup.state,zip:lookup.zipCode,price:1,beds:1,baths:1,sqft:1,lot:null};
const record=(street=lookup.street)=>mapRentCastProperty({id:'isolated-test',addressLine1:street,city:lookup.city,state:'TX',zipCode:lookup.zipCode},new Date().toISOString());
describe('production hardening without network',()=>{
 it('disabled access ignores a positive grant and never constructs evidence',async()=>{
  const hasEntitlement=vi.fn(async()=>true),loadEvidence=vi.fn();
  const result=await resolvePropertyIntelligenceAccess({dataMode:'disabled',userId:'owner',propertyId:id,hasEntitlement,loadEvidence});
  expect(result.state).toBe('locked');expect(hasEntitlement).not.toHaveBeenCalled();expect(loadEvidence).not.toHaveBeenCalled();
 });
 it('mock mode is fail-closed in a non-test backend factory',async()=>{
  const rpc=vi.fn(),from=vi.fn();
  const service=createBackendPropertyEvidenceService({
   supabaseAdmin:{rpc,from} as never,
   getEnv:(name)=>name==='PROPERTY_DATA_MODE'?'mock':name==='NODE_ENV'?'production':undefined,
   fetchImpl:vi.fn(),logger:vi.fn(),
  });
  await expect(service.getPropertyEvidence({propertyId:id,userId:'owner'})).rejects.toMatchObject({code:'PROVIDER_DISABLED'});
  expect(rpc).not.toHaveBeenCalled();expect(from).not.toHaveBeenCalled();
 });
 it('independent database coordinators coalesce to ONE usage reservation and provider call',async()=>{
  let token:string|null=null;
  const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
   if(name==='ds_acquire_property_evidence_lease') {
    if(token) return {data:false,error:null};token=String(args.p_token);return {data:true,error:null};
   }
   if(token===args.p_token) token=null;return {data:null,error:null};
  });
  const reserve=vi.fn(async()=>({id:'test-reservation'}));
  const lookupProperty=vi.fn(async()=>({record:{id:'test-provider-id',addressLine1:lookup.street,city:lookup.city,state:lookup.state,zipCode:lookup.zipCode}}));
  const provider=new RentCastPropertyDataProvider({client:{lookupProperty},usageGuard:{reserve,finalize:vi.fn()},logger:vi.fn()});
  const cache=new InMemoryPropertyIntelligenceCache();
  const services=Array.from({length:4},()=>new PropertyEvidenceService({repository:{getById:async()=>property},cache,provider,singleFlight:new SupabasePropertySingleFlight({rpc}),logger:vi.fn()}));
  const results=await Promise.all(services.map(s=>s.getPropertyEvidence({propertyId:id})));
  expect(reserve).toHaveBeenCalledOnce();expect(lookupProperty).toHaveBeenCalledOnce();
  expect(results.filter(r=>r.cacheHit)).toHaveLength(3);
 });
 it('private acceptance fixture is readable only by its exact owner',async()=>{
  const fixtureId='07343e87-1ef8-4ca5-a88e-be49d95431a7';
  const repo=new SupabasePropertyEvidenceRepository({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{...property,id:fixtureId,owner_id:'owner'},error:null})})})})});
  expect(await repo.getById(fixtureId,'other')).toBeNull();
  expect(await repo.getById(fixtureId)).toBeNull();
  expect(await repo.getById(fixtureId,'owner')).not.toBeNull();
 });
 it('public exposure is independent of entitlement; explicit suppression still works',()=>{
  expect(propertyIntelligenceExposed(()=>undefined,'u')).toBe(true);
  expect(propertyIntelligenceExposed(()=> 'disabled','u')).toBe(false);
  expect(propertyIntelligenceExposed(k=>k==='PROPERTY_INTELLIGENCE_EXPOSURE'?'allowlist':'u','u')).toBe(true);
  expect(propertyIntelligenceExposed(k=>k==='PROPERTY_INTELLIGENCE_EXPOSURE'?'allowlist':'u','other')).toBe(false);
 });
 it('fingerprint normalizes suffix/state/ZIP but distinguishes units and addresses',async()=>{
  expect(await propertyAddressFingerprint(lookup)).toBe(await propertyAddressFingerprint({...lookup,street:'100 Fixture Street',state:'Texas',zipCode:'78701-1234'}));
  expect(await propertyAddressFingerprint(lookup)).not.toBe(await propertyAddressFingerprint({...lookup,street:'100 Fixture St #2'}));
 });
 it('disabled does zero repository/cache/provider work even with a warm cache',async()=>{
  const read=vi.fn(),load=vi.fn();
  const service=new PropertyEvidenceService({repository:{getById:read},cache:{getPropertyRecord:read,setPropertyRecord:read},provider:{getPropertyRecord:load},enabled:false,logger:vi.fn()});
  await expect(service.getPropertyEvidence({propertyId:id})).rejects.toMatchObject({code:'PROVIDER_DISABLED'});
  expect(read).not.toHaveBeenCalled();expect(load).not.toHaveBeenCalled();
 });
 it('rejects cached evidence for previous address and coalesces across service instances',async()=>{
  const cache=new InMemoryPropertyIntelligenceCache();
  await cache.setPropertyRecord(id,record('99 Previous St'));
  const flight=new InMemoryPropertySingleFlight();
  const load=vi.fn(async()=>record());
  const services=Array.from({length:8},()=>new PropertyEvidenceService({repository:{getById:async()=>property},cache,provider:{getPropertyRecord:load},singleFlight:flight,logger:vi.fn()}));
  const results=await Promise.all(services.map(s=>s.getPropertyEvidence({propertyId:id})));
  expect(load).toHaveBeenCalledOnce();
  expect(results.every(r=>r.externalData.address.addressLine1.value===lookup.street)).toBe(true);
  await services[0].getPropertyEvidence({propertyId:id});expect(load).toHaveBeenCalledOnce();
 });
 it('does not cache or deliver when address changes during provider work',async()=>{
  const cache=new InMemoryPropertyIntelligenceCache();let reads=0;
  const service=new PropertyEvidenceService({repository:{getById:async()=>({...property,address:reads++? '999 Changed St':property.address})},cache,provider:{getPropertyRecord:async()=>record()},logger:vi.fn()});
  await expect(service.getPropertyEvidence({propertyId:id})).rejects.toThrow('PROPERTY_ADDRESS_CHANGED');
  expect(cache.size()).toBe(0);
 });
 it('database lease failure never starts work',async()=>{
  const work=vi.fn();const flight=new SupabasePropertySingleFlight({rpc:async()=>({data:null,error:{message:'offline'}})});
  await expect(flight.run('key',work)).rejects.toThrow('LEASE_UNAVAILABLE');expect(work).not.toHaveBeenCalled();
 });
 it('releases only own successful work and retains failed work',async()=>{
  const rpc=vi.fn(async()=>({data:true,error:null}));const flight=new SupabasePropertySingleFlight({rpc});
  expect(await flight.run('key',async()=>42)).toBe(42);
  expect(rpc.mock.calls.length).toBe(2);
  rpc.mockClear();
  await expect(flight.run('key',async()=>{throw Error('provider');})).rejects.toThrow('provider');
  expect(rpc.mock.calls.length).toBe(1);
 });
});
