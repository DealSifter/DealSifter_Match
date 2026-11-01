import { describe, it, expect, vi } from 'vitest';
import { boundedJson, ArcGISParcelAdapter, normalizeParcel } from './arcgis.ts';
import { PublicCountyResolver } from './county.ts';
import { PublicParcelResolver } from './resolver.ts';
import { issueParcelEvidenceReceipt, readParcelEvidenceReceipt } from './evidenceReceipt.ts';
import { PARCEL_SOURCES } from './registry.ts';
import type { ParcelRequestTelemetry } from './telemetry.ts';
const point={lat:34.7,lng:-92.3};
const source=PARCEL_SOURCES.find(s=>s.sourceId==='us-ar-agiso-state-parcels')!;
describe('public GIS acquisition receipts without network',()=>{
 it('records the exact HTTP, latency and trace, with cached county requests causing no new fetch',async()=>{
  const fetcher=vi.fn(async()=>Response.json({features:[{attributes:{GEOID:'05119'}}]}));
  const county=new PublicCountyResolver(fetcher,{reportId:'report-fixture',requestId:'request-fixture',origin:'validation'});
  const first=await county.resolveEvidence(point), second=await county.resolveEvidence(point);
  expect(first.telemetry[0]).toMatchObject({provider:'census',httpStatus:200,outcome:'SUCCESS',reportId:'report-fixture',origin:'validation'});
  expect(first.telemetry[0].latencyMs).toBeGreaterThanOrEqual(0); expect(first.telemetry[0].service).not.toContain('?');
  expect(second.cacheHit).toBe(true);expect(second.telemetry).toEqual(first.telemetry);expect(fetcher).toHaveBeenCalledOnce();
 });
 it.each([404,503])('records HTTP %s even when the lookup fails',async status=>{
  const entries:ParcelRequestTelemetry[]=[];
  await expect(boundedJson('https://tigerweb.geo.census.gov/query?private=not-recorded',async()=>new Response('',{status}),undefined,100,e=>entries.push(e))).rejects.toThrow(`GIS_HTTP_${status}`);
  expect(entries[0]).toMatchObject({httpStatus:status,outcome:'HTTP_ERROR'});expect(JSON.stringify(entries)).not.toContain('private');
 });
 it('records transport failures without inventing an HTTP status',async()=>{
  const entries:ParcelRequestTelemetry[]=[];
  await expect(boundedJson('https://example.invalid/query',async()=>{throw Error('offline')},undefined,100,e=>entries.push(e))).rejects.toThrow();
  expect(entries[0]).toMatchObject({httpStatus:null,outcome:'TRANSPORT_ERROR'});
 });
 it('retains Census telemetry on a no-active-source result',async()=>{
  const county=new PublicCountyResolver(async()=>Response.json({features:[{attributes:{GEOID:'12105'}}]}));
  const result=await new PublicParcelResolver({resolveCounty: (p,s)=>county.resolve(p,s),resolveCountyEvidence:(p,s)=>county.resolveEvidence(p,s)}).resolve({operation:'query-point',point:{lat:28,lng:-81.7}});
  expect(result.status).toBe('NO_ACTIVE_PUBLIC_SOURCE'); expect(result.telemetry?.[0].httpStatus).toBe(200);
 });
 it('retains metadata and query HTTP timings in the adapter result',async()=>{
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('/query?')?Response.json({features:[]}):Response.json({geometryType:'esriGeometryPolygon',capabilities:'Query',fields:[{name:'OBJECTID'}]}));
  const result=await new ArcGISParcelAdapter(source,fetcher).queryByPoint(point);
  expect(result.telemetry?.map(e=>e.httpStatus)).toEqual([200,200]); expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('carries telemetry through the signed receipt and local verification',async()=>{
  const now=Date.now(),geometry={type:'Polygon' as const,coordinates:[[[-92.301,34.699],[-92.299,34.699],[-92.299,34.701],[-92.301,34.701],[-92.301,34.699]]]};
  const parcel=normalizeParcel(source,{parcelid:'TEST'},geometry,new Date(now).toISOString(),null);
  const telemetry:ParcelRequestTelemetry[]=[{provider:'arcgis',service:'https://example.invalid/query',httpStatus:200,latencyMs:23,requestedAt:new Date(now).toISOString(),outcome:'SUCCESS'}];
  const token=await issueParcelEvidenceReceipt({status:'COVERAGE_AVAILABLE',parcels:[parcel],countyFips:'05119',sourceIds:[source.sourceId],ambiguity:false,exceededLimit:false,freshness:'FRESH',cacheHit:false,expiresAt:new Date(now+3600000).toISOString(),telemetry},point,'fixture','fixture-secret',now);
  const verified=await readParcelEvidenceReceipt(token,{point,userId:'fixture',secret:'fixture-secret',enabled:true,now});
  expect(verified[0].telemetry).toEqual(telemetry);
 });
});
