import { describe,it,expect,vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveFeatureFlags } from '../featureFlags.ts';
import { PARCEL_SOURCES,productionSourceAllowed,ParcelSourceRegistry } from './registry.ts';
import { PublicParcelResolver,validateParcelQuery } from './resolver.ts';
import { normalizeParcel } from './arcgis.ts';
import { ParcelRequestCache } from './cache.ts';
import { contextualLensBounds,parcelOperationAllowed } from './lens.ts';
import { createParcelUpstreamFetch,parcelAuthorityBudgetKey } from './upstreamBudget.ts';
import type { ParcelSource } from './types.ts';

const config={public_parcel_intelligence:{enabled:true,environments:['production'],percentage:100}};
const flags=(userId:string)=>resolveFeatureFlags({userId,environment:'production',remoteConfig:config});
const source=PARCEL_SOURCES.find(row=>row.sourceId==='us-ma-massgis-parcels')!;
const point={lat:42,lng:-71};
const geometry={type:'Polygon',coordinates:[[[-71.0001,41.9999],[-70.9999,41.9999],[-70.9999,42.0001],[-71.0001,42.0001],[-71.0001,41.9999]]]};
const publicRow=normalizeParcel(source,{LOC_ID:'PUBLIC_APN',OWNER1:'Public record owner',privateNotes:'PRIVATE',email:'PRIVATE',isUnlocked:true},geometry,'2026-10-13',null);
const result={parcels:[publicRow],exceededLimit:false};
const provider={queryByPoint:vi.fn(async()=>result),queryByBounds:vi.fn(async()=>result),queryByAPN:vi.fn(async()=>result),getCoverage:()=>source};

describe('general authenticated eligibility and independent QA boundary',()=>{
 it.each(['FREE','PRO','ENTERPRISE'])('all normal %s accounts have free parcel access without preview identity or unlock',plan=>{
   for(const user of [`new-${plan}-a`,`new-${plan}-b`,`old-preview-${plan}`]){
     expect(flags(user).public_parcel_intelligence).toBe(true);expect(flags(user).public_parcel_qa_grid).toBe(false);
   }
 });
 it.each(['',' '])('anonymous/empty identity never grants parcel or grid: %s',user=>{
   expect(flags(user).public_parcel_intelligence).toBe(false);expect(flags(user).public_parcel_qa_grid).toBe(false);
 });
 it('ignores personal preview identities for contextual access, never promotes them to QA',()=>{
   const effective=resolveFeatureFlags({userId:'normal',environment:'production',remoteConfig:{public_parcel_intelligence:{...config.public_parcel_intelligence,internalUserIds:['old-preview']}}});
   expect(effective.public_parcel_intelligence).toBe(true);expect(effective.public_parcel_qa_grid).toBe(false);
 });
 it.each([undefined,null,{},'true',{enabled:false,environments:['production'],percentage:100},{enabled:true,environments:[],percentage:100}])('kill switch fails closed for absent/malformed/disabled configuration: %j',definition=>{
   expect(resolveFeatureFlags({userId:'normal',environment:'production',remoteConfig:{public_parcel_intelligence:definition},overrides:{public_parcel_intelligence:true},allowOverride:true}).public_parcel_intelligence).toBe(false);
 });
 it('only the independent QA allowlist authorizes viewport queries',()=>{
   expect(parcelOperationAllowed('query-bounds',flags('normal'))).toBe(false);
   expect(parcelOperationAllowed('query-lens',flags('normal'))).toBe(true);
   const qa=resolveFeatureFlags({userId:'qa',environment:'production',remoteConfig:{...config,public_parcel_qa_grid:{...config.public_parcel_intelligence,internalUserIds:['qa']}}});
   expect(parcelOperationAllowed('query-bounds',qa)).toBe(true);
   expect(parcelOperationAllowed('query-lens',{...qa,public_parcel_intelligence:false})).toBe(false);
 });
 it('source-level public-display policy fails closed independently of status and license',()=>{
   expect(productionSourceAllowed(source)).toBe(true);
   for(const permission of [undefined,'INTERNAL_ANALYTICS_ONLY','REVIEW_REQUIRED'] as const)expect(productionSourceAllowed({...source,usagePermission:permission})).toBe(false);
   expect(productionSourceAllowed(PARCEL_SOURCES.find(row=>row.state==='VT')!)).toBe(false);
 });
});

describe('source capability split, fixed-radius queries and public-only evidence',()=>{
 it('accepts only a point for contextual neighbors, with bounds fixed server-side',async()=>{
   const query=validateParcelQuery({operation:'query-lens',point});
   const resolver=new PublicParcelResolver({registry:new ParcelSourceRegistry([source]),resolveCounty:async()=>['25017'],resolveBoundsCounties:async()=>['25017'],providerFactory:()=>provider});
   await resolver.resolve(query);expect(provider.queryByBounds).toHaveBeenCalledWith(contextualLensBounds(point));
   expect(contextualLensBounds(point)![2]-point.lng).toBeLessThan(.002);
 });
 it.each([{bounds:[-71,41,-70,42]},{radius:20000},{zoom:20},{propertyId:'private'},{url:'http://127.0.0.1'}])('rejects query widening/proxy/private context: %j',extra=>{
   expect(()=>validateParcelQuery({operation:'query-lens',point,...extra})).toThrow();
 });
 it.each(['resolve','query-point','query-apn','coverage'])('never disguises a viewport query as a public %s operation',operation=>{
   expect(()=>validateParcelQuery({operation,point,apn:'PUBLIC',countyFips:'25017',bounds:[-71.01,41.99,-70.99,42.01],zoom:17})).toThrow('INVALID_OPERATION_BOUNDS');
 });
 it('rejects private metadata in point payloads before they can enter shared cache keys',()=>{
   expect(()=>validateParcelQuery({operation:'query-point',point:{...point,privateNotes:'PRIVATE'}})).toThrow('INVALID_POINT');
 });
 it('subject-only geometry remains eligible without inventing APN or neighborhood capability',async()=>{
   const subjectOnly:ParcelSource={...source,fieldMapping:{},capabilities:{subjectLookup:true,neighborLens:false,apnLookup:false},validation:{...source.validation!,apnQueryValidated:false,viewportQueryValidated:false}};
   expect(productionSourceAllowed(subjectOnly)).toBe(true);
   const factory=vi.fn(()=>provider);const resolver=new PublicParcelResolver({registry:new ParcelSourceRegistry([subjectOnly]),resolveCounty:async()=>['25017'],resolveBoundsCounties:async()=>['25017'],providerFactory:factory});
   expect((await resolver.resolve({operation:'query-point',point})).parcels).toHaveLength(1);
   factory.mockClear();expect((await resolver.resolve({operation:'query-lens',point})).status).toBe('NO_ACTIVE_PUBLIC_SOURCE');expect(factory).not.toHaveBeenCalled();
 });
 it('supports statewide and complementary county sources as fallback without implicit evidence merging',async()=>{
   const primary={...source,capabilities:{subjectLookup:true,neighborLens:false,apnLookup:true}};
   const secondary={...source,sourceId:'county-neighbors',role:'SECONDARY_PARCEL' as const};
   const factory=vi.fn(()=>provider);const resolver=new PublicParcelResolver({registry:new ParcelSourceRegistry([primary,secondary]),resolveCounty:async()=>['25025'],resolveBoundsCounties:async()=>['25025'],providerFactory:factory});
   expect((await resolver.resolve({operation:'query-point',point})).sourceIds).toEqual([primary.sourceId]);
   expect((await resolver.resolve({operation:'query-lens',point})).sourceIds).toEqual([secondary.sourceId]);
 });
 it('never normalizes private notes, contact data, unlock state or assumptions into public evidence',()=>{
   const serialized=JSON.stringify(publicRow);expect(serialized).not.toContain('PRIVATE');expect(serialized).not.toContain('isUnlocked');
   expect(publicRow.ownerName).toBe('Public record owner');expect(publicRow.sourceDomains).toContain('PARCEL_GEOMETRY');
   expect(publicRow.assessorAcres).toBeNull();expect(publicRow.geometryCalculatedAcres).toBeGreaterThan(0);
   expect(publicRow.provenance.geometryCalculatedAcres.status).toBe('CALCULATED');
 });
 it('parcel endpoint has no property/contact/financial/Maxxis write or paid-provider dependency',()=>{
   const text=readFileSync(new URL('../../public-parcel/index.ts',import.meta.url),'utf8');
   expect(text).not.toMatch(/rentcast|regrid|attom|\.(?:insert|update|upsert|delete)\(/i);
   expect(text).toContain('client.auth.getUser(token)');expect(text).toContain('parcelOperationAllowed(query.operation, flags)');
 });
});

describe('multi-user public cache and cross-isolate government load safety',()=>{
 it('coalesces 30 concurrent public lookups into one upstream request and subsequent cache HIT',async()=>{
   let release!:(value:typeof result)=>void;const call=vi.fn(()=>new Promise<typeof result>(resolve=>{release=resolve;}));
   const cache=new ParcelRequestCache<typeof result>();
   const resolver=new PublicParcelResolver({cache,registry:new ParcelSourceRegistry([source]),resolveCounty:async()=>['25017'],providerFactory:()=>({...provider,queryByPoint:call})});
   const requests=Array.from({length:30},()=>resolver.resolve({operation:'query-point',point}));
   await Promise.resolve();await Promise.resolve();expect(call).toHaveBeenCalledOnce();release(result);
   const rows=await Promise.all(requests);expect(rows.every(row=>row.parcels.length===1)).toBe(true);expect(rows[0].cacheHit).toBe(false);
   expect((await resolver.resolve({operation:'query-point',point})).cacheHit).toBe(true);expect(call).toHaveBeenCalledOnce();
 });
 it('user A cancellation does not abort user B shared public work',async()=>{
   let release!:(value:typeof result)=>void;const call=vi.fn(()=>new Promise<typeof result>(resolve=>{release=resolve;}));
   const resolver=new PublicParcelResolver({registry:new ParcelSourceRegistry([source]),resolveCounty:async()=>['25017'],providerFactory:()=>({...provider,queryByPoint:call})});
   const abort=new AbortController();const a=resolver.resolve({operation:'query-point',point,signal:abort.signal});const rejected=expect(a).rejects.toMatchObject({name:'AbortError'});
   const b=resolver.resolve({operation:'query-point',point});await Promise.resolve();await Promise.resolve();abort.abort();release(result);
   await rejected;expect((await b).parcels).toHaveLength(1);expect(call).toHaveBeenCalledOnce();
 });
 it('uses stable authority counters independent of identities and query paths',async()=>{
   const id=await parcelAuthorityBudgetKey('https://official-gis.gov');expect(id).toMatch(/^[a-f0-9-]{36}$/);
   expect(await parcelAuthorityBudgetKey('https://official-gis.gov')).toBe(id);
   const consume=vi.fn(async()=>true);const fetcher=vi.fn(async()=>new Response('{}'));
   const guarded=createParcelUpstreamFetch(consume,fetcher as typeof fetch);
   await guarded('https://official-gis.gov/a');await guarded('https://official-gis.gov/b');
   expect(consume.mock.calls[0][0]).toBe(consume.mock.calls[1][0]);expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('shared authority rate limiter rejects before public GIS HTTP and fails closed',async()=>{
   const fetcher=vi.fn();const guarded=createParcelUpstreamFetch(async()=>false,fetcher);
   await expect(guarded('https://official-gis.gov/parcel')).rejects.toThrow('SOURCE_SHARED_RATE_LIMIT');expect(fetcher).not.toHaveBeenCalled();
 });
});

describe('strategic manifest integrity and source evidence',()=>{
 it('P0 coverage includes every mandatory state and matches only public runtime registrations',()=>{
   const manifest=JSON.parse(readFileSync(new URL('../../../../qa/public-parcel-intelligence/coverage/strategic-coverage-manifest.json',import.meta.url),'utf8'));
   expect(manifest.states.map((row:{state:string})=>row.state)).toEqual(['FL','TX','OH','PA','AR','CA','GA','MI']);
   const ar=manifest.states.find((row:{state:string})=>row.state==='AR');expect(ar.activeCounties).toBe(75);expect(ar.partialCounties).toBe(75);
   const ga=manifest.states.find((row:{state:string})=>row.state==='GA');expect(ga.activeCounties).toBe(1);expect(ga.partialCounties).toBe(1);
   for(const state of ['FL','TX','OH','PA','CA','MI'])expect(manifest.states.find((row:{state:string})=>row.state===state).activeCounties).toBe(0);
 });
 it('Arkansas registrations exactly match audited positive-area APN county inventory, not a statewide label',()=>{
   const inventory=JSON.parse(readFileSync(new URL('../../../../qa/public-parcel-intelligence/coverage/county-source-inventories.json',import.meta.url),'utf8'));
   const proof=inventory.results.find((row:{state:string})=>row.state==='05');const registered=PARCEL_SOURCES.find(row=>row.state==='AR')!;
   expect([...registered.coverageCountyFips!].sort()).toEqual(proof.counties.map((row:{countyFips:string})=>row.countyFips).sort());
   expect(registered.validation?.sampledCountyFips).toEqual(['05119','05007']);expect(registered.validation?.countyInventoryEvidencePath).toBeTruthy();
 });
 it('no ACTIVE public source lacks a fresh successful recorded runtime sample or intended-use clearance',()=>{
   const audit=JSON.parse(readFileSync(new URL('../../../../qa/public-parcel-intelligence/coverage/runtime-source-validation.json',import.meta.url),'utf8'));
   for(const registered of PARCEL_SOURCES.filter(productionSourceAllowed)){
     expect(audit.results.some((row:{sourceId:string;pass:boolean})=>row.sourceId===registered.sourceId&&row.pass)).toBe(true);
     expect(registered.usagePermission).toBe('PUBLIC_DISPLAY_ALLOWED');
   }
 });
});
