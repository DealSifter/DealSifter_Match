import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { ArcGISParcelAdapter, boundedJson, normalizeParcel } from './arcgis.ts';
import { areaCrossCheck, arcgisRingsToGeometry, geodesicParcelArea, geometryContains } from './geometry.ts';
import { PARCEL_SOURCES, ParcelSourceRegistry, approvedLayerUrl, normalizeCountyFips, productionSourceAllowed } from './registry.ts';
import { PublicParcelResolver, validateParcelQuery } from './resolver.ts';
import { ParcelRequestCache } from './cache.ts';
import { PublicCountyResolver } from './county.ts';
import { resolveFeatureFlags } from '../featureFlags.ts';
import type { ParcelSource, ParcelGeometry, ProviderResult } from './types.ts';

const geometry: ParcelGeometry = { type: 'Polygon', coordinates: [[[-122, 47], [-121.999, 47], [-121.999, 47.001], [-122, 47.001], [-122, 47]]] };
const active = (index = 2): ParcelSource => ({ ...PARCEL_SOURCES[index], status: 'ACTIVE', licenseStatus: 'APPROVED' });
const metadata = (source: ParcelSource, formats = 'JSON, geoJSON') => ({ geometryType: 'esriGeometryPolygon', capabilities: 'Query,Map', fields: Object.values(source.fieldMapping).map(name => ({ name })), maxRecordCount: 1000, objectIdField: 'OBJECTID', supportedQueryFormats: formats });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const providerResult = (source: ParcelSource): ProviderResult => ({ parcels: [normalizeParcel(source, { [source.fieldMapping.apn!]: '001-000-09' }, geometry, '2026-10-12T00:00:00Z', null)], exceededLimit: false });
const point = { lat: 47.0005, lng: -121.9995 };
const logger = vi.fn();

describe('national public parcel foundation', () => {
  it('defaults OFF in every existing feature flag environment', () => {
    for (const environment of ['development', 'staging', 'production'] as const) expect(resolveFeatureFlags({ userId: 'viewer', environment }).public_parcel_intelligence).toBe(false);
  });
  it('has no production source activated by discovery', () => expect(PARCEL_SOURCES.filter(productionSourceAllowed)).toHaveLength(0));
  it('requires BOTH ACTIVE status and cleared license', () => {
    expect(productionSourceAllowed({ ...active(), licenseStatus: 'UNKNOWN' })).toBe(false);
    expect(productionSourceAllowed({ ...active(), status: 'SCHEMA_VALIDATED' })).toBe(false);
    expect(productionSourceAllowed(active())).toBe(true);
  });
  it('normalizes FIPS without confusing counties with identical names', () => {
    expect(normalizeCountyFips('073', '01')).toBe('01073'); expect(normalizeCountyFips('01073', '06')).toBeNull(); expect(normalizeCountyFips('Jefferson')).toBeNull();
  });
  it.each([0, 2, 3, 4])('uses the same resolver API across registered state/county %s', async index => {
    const source = active(index); const service = providerResult(source);
    const factory = vi.fn(() => ({ queryByPoint: vi.fn(async () => service), queryByAPN: vi.fn(async () => service), queryByBounds: vi.fn(async () => service), getCoverage: () => source }));
    const resolver = new PublicParcelResolver({ registry: new ParcelSourceRegistry([source]), resolveCounty: async () => [source.countyFips], providerFactory: factory });
    const result = await resolver.resolve({ operation: 'query-point', point }); expect(result.status).toBe('COVERAGE_AVAILABLE'); expect(result.countyFips).toBe(source.countyFips);
  });
  it('uses existing geocode injection for address → point → county', async () => {
    const source = active(); const geocode = vi.fn(async () => point);
    const result = await new PublicParcelResolver({ registry: new ParcelSourceRegistry([source]), geocode, resolveCounty: async () => [source.countyFips], providerFactory: () => ({ queryByPoint: async () => providerResult(source), queryByAPN: async () => providerResult(source), queryByBounds: async () => providerResult(source), getCoverage: () => source }) })
      .resolve({ operation: 'resolve', address: { address: 'Control address', state: 'WA' } });
    expect(result.status).toBe('COVERAGE_AVAILABLE'); expect(geocode).toHaveBeenCalledOnce();
  });
  it('unsupported county returns a normal no-source result', async () => expect((await new PublicParcelResolver().resolve({ operation: 'coverage', countyFips: '06001' })).status).toBe('NO_ACTIVE_PUBLIC_SOURCE'));
  it('does not silently select a county at a boundary', async () => expect((await new PublicParcelResolver({ resolveCounty: async () => ['53033', '53061'] }).resolve({ operation: 'query-point', point })).status).toBe('AMBIGUOUS_LOCATION'));
  it('does not trust a contradictory client county hint', async () => expect((await new PublicParcelResolver({ resolveCounty: async () => ['53033'] }).resolve({ operation: 'query-point', point, countyFips: '01073' })).status).toBe('AMBIGUOUS_LOCATION'));
  it('does not silently misroute a viewport crossing county boundaries', async () => expect((await new PublicParcelResolver({ resolveCounty: async () => ['53033'], resolveBoundsCounties: async () => ['53033', '53061'] }).resolve({ operation: 'query-bounds', bounds: [-122, 47, -121.99, 47.01], zoom: 17 })).status).toBe('AMBIGUOUS_LOCATION'));
  it('sends zero county/GIS requests below the close-zoom threshold', async () => {
    const county = vi.fn(); const factory = vi.fn();
    const result = await new PublicParcelResolver({ resolveCounty: county, providerFactory: factory }).resolve({ operation: 'query-bounds', bounds: [-122, 47, -121.99, 47.01], zoom: 8 });
    expect(result.reason).toBe('ZOOM_REQUIRED'); expect(county).not.toHaveBeenCalled(); expect(factory).not.toHaveBeenCalled();
  });
  it('requires a narrower viewport before a county/GIS request', async () => {
    const county = vi.fn(); const result = await new PublicParcelResolver({ resolveCounty: county }).resolve({ operation: 'query-bounds', zoom: 17, bounds: [-124, 44, -120, 48] });
    expect(result.reason).toBe('NARROWER_VIEWPORT_REQUIRED'); expect(county).not.toHaveBeenCalled();
  });
  it('query-point returns all intersecting candidates with ambiguity instead of guessing', async () => {
    const source = active(); const data = providerResult(source); data.parcels.push({ ...data.parcels[0], apn: '002' });
    const result = await new PublicParcelResolver({ registry: new ParcelSourceRegistry([source]), resolveCounty: async () => [source.countyFips], providerFactory: () => ({ queryByPoint: async () => data, queryByAPN: async () => data, queryByBounds: async () => data, getCoverage: () => source }) }).resolve({ operation: 'query-point', point });
    expect(result.ambiguity).toBe(true); expect(result.parcels).toHaveLength(2);
  });
  it('maintains a future-provider seam without ArcGIS payloads in resolver results', async () => {
    const source = { ...active(), providerType: 'WFS_TEST' }; const registry = new ParcelSourceRegistry([source]);
    const result = await new PublicParcelResolver({ registry, providerFactory: () => ({ queryByPoint: async () => providerResult(source), queryByAPN: async () => providerResult(source), queryByBounds: async () => providerResult(source), getCoverage: () => source }) }).resolve({ operation: 'query-apn', countyFips: source.countyFips, apn: '001-000-09' });
    expect(result.parcels[0].apn).toBe('001-000-09'); expect(result.parcels[0]).not.toHaveProperty('attributes');
  });
});

describe('ArcGIS provider contract and security', () => {
  it.each([0, 2, 3, 4])('maps distinct APN/address/area fields from source %s without global aliases', async index => {
    const source = active(index); const attributes = { [source.fieldMapping.apn!]: '00019', ...(source.fieldMapping.assessorAcres ? { [source.fieldMapping.assessorAcres]: 1.2 } : {}) };
    const fetcher = vi.fn(async (url: string | URL | Request) => response(String(url).includes('/query?') ? { features: [{ type: 'Feature', properties: attributes, geometry }] } : metadata(source)));
    const result = await new ArcGISParcelAdapter(source, fetcher as typeof fetch).queryByPoint(point);
    expect(result.parcels[0].apn).toBe('00019'); expect(result.parcels[0].provenance.apn.sourceField).toBe(source.fieldMapping.apn);
    expect(result.parcels[0].assessorAcres).toBe(source.fieldMapping.assessorAcres ? 1.2 : null);
  });
  it('inspects query support before sending feature queries', async () => {
    const fetcher = vi.fn(async () => response({ ...metadata(active()), capabilities: 'Map' }));
    await expect(new ArcGISParcelAdapter(active(), fetcher as typeof fetch).queryByPoint(point)).rejects.toThrow('UNSUPPORTED_PARCEL_SCHEMA'); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('supports JSON rings with multiple shells/holes when GeoJSON is unavailable', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => response(String(url).includes('/query?') ? { spatialReference: { wkid: 4326 }, features: [{ attributes: { PIN: '001' }, geometry: { rings: geometry.coordinates } }] } : metadata(active(), 'JSON')));
    const result = await new ArcGISParcelAdapter(active(), fetcher as typeof fetch).queryByPoint(point); expect(result.parcels[0].geometry?.type).toBe('Polygon');
  });
  it('rejects unexpected projected JSON coordinates rather than calculating wrong geographic area', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => response(String(url).includes('/query?') ? { spatialReference: { wkid: 3857 }, features: [{ geometry: { rings: geometry.coordinates } }] } : metadata(active(), 'JSON')));
    await expect(new ArcGISParcelAdapter(active(), fetcher as typeof fetch).queryByPoint(point)).rejects.toThrow('GIS_OUTPUT_NOT_WGS84');
  });
  it('APN exact query preserves meaningful leading zeroes and uses only a registry field', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => response(String(url).includes('/query?') ? { features: [] } : metadata(active())));
    await new ArcGISParcelAdapter(active(), fetcher as typeof fetch).queryByAPN('001-09');
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get('where')).toBe("PIN = '001-09'");
  });
  it.each(["1' OR 1=1 --", 'a;DROP TABLE parcels', '<script>'])('rejects unsafe APN %s before any GIS requests', async input => {
    const fetcher = vi.fn(); await expect(new ArcGISParcelAdapter(active(), fetcher).queryByAPN(input)).rejects.toThrow('INVALID_APN'); expect(fetcher).not.toHaveBeenCalled();
  });
  it('respects both source and application result limits without pagination', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => response(String(url).includes('/query?') ? { features: [], exceededTransferLimit: true } : { ...metadata(active()), maxRecordCount: 40 }));
    const result = await new ArcGISParcelAdapter(active(), fetcher as typeof fetch).queryByBounds([-122, 47, -121.99, 47.01]);
    expect(new URL(String(fetcher.mock.calls[1][0])).searchParams.get('resultRecordCount')).toBe('40'); expect(result.exceededLimit).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['http://127.0.0.1/MapServer', 'https://169.254.169.254/FeatureServer', 'https://evil.example/MapServer', 'https://user:secret@gismaps.kingcounty.gov/MapServer'])('rejects registry URL %s', url => expect(() => approvedLayerUrl({ ...active(), serviceUrl: url })).toThrow('UNAPPROVED_SOURCE_URL'));
  it.each(['serviceUrl', 'url', 'sourceId', 'diagnostics', 'internal', 'providerType'])('rejects arbitrary client field %s', key => expect(() => validateParcelQuery({ operation: 'coverage', countyFips: '53033', [key]: 'https://evil.example' })).toThrow('UNKNOWN_QUERY_FIELD'));
  it('rejects oversized response before decoding and disallows redirects', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { headers: { 'content-length': '9000000' } }));
    await expect(boundedJson('https://example.test', fetcher)).rejects.toThrow('GIS_RESPONSE_TOO_LARGE'); expect(fetcher.mock.calls[0][1]?.redirect).toBe('error');
  });
  it('validates bounds/point/range types without accepting null as a real coordinate', () => {
    expect(() => validateParcelQuery({ operation: 'query-point', point: { lat: null, lng: 0 } })).toThrow('INVALID_POINT');
    expect(() => validateParcelQuery({ operation: 'query-bounds', bounds: [180, 90, -180, -90] })).toThrow('INVALID_BOUNDS');
    expect(() => validateParcelQuery({ operation: 'coverage', countyFips: 'WA' })).toThrow('INVALID_FIPS');
  });
});

describe('parcel evidence, geodesic area, degraded cache', () => {
  it('computes geodesic area, including latitude rather than naive degree multiplication', () => {
    const result = geodesicParcelArea(geometry); expect(result.acres).toBeGreaterThan(2); expect(result.acres).toBeLessThan(2.2); expect(result.sqft! / 43560).toBe(result.acres);
  });
  it('subtracts holes, handles multiple shells and leaves geometry intact', () => {
    const hole = [[-121.9998, 47.0002], [-121.9992, 47.0002], [-121.9992, 47.0008], [-121.9998, 47.0008], [-121.9998, 47.0002]];
    const separate = geometry.coordinates[0].map(c => [c[0] + .002, c[1]]);
    const result = arcgisRingsToGeometry([geometry.coordinates[0], hole, separate]); expect(result?.type).toBe('MultiPolygon');
    expect(geodesicParcelArea(result).acres!).toBeCloseTo(geodesicParcelArea(geometry).acres! * 1.64, 2);
    expect(geometryContains(result, point)).toBe(false);
  });
  it('detects assessor/GIS/geometry conflict without deleting any source field', () => {
    const source = { ...active(), fieldMapping: { ...active().fieldMapping, assessorAcres: 'A', gisAcres: 'B' } };
    const result = normalizeParcel(source, { A: 1, B: 1.05 }, geometry, '2026-10-12', null);
    expect(result.areaCrossCheck.status).toBe('MATERIAL_CONFLICT'); expect(result.assessorAcres).toBe(1); expect(result.gisAcres).toBe(1.05); expect(result.geometryCalculatedAcres).not.toBeNull();
  });
  it('classifies consistent/minor variance and insufficient evidence', () => {
    expect(areaCrossCheck([1, 1.01]).status).toBe('CONSISTENT'); expect(areaCrossCheck([1, 1.05]).status).toBe('MINOR_VARIANCE'); expect(areaCrossCheck([null, 1]).status).toBe('NOT_EVALUATED');
  });
  it('missing APN, annual tax, zoning, assessed value stay null; no land-use/market-value inference', () => {
    const result = normalizeParcel(active(), { TOTAL_MKT_VALUE: 999999, LAND_USE: 'Residential' }, null, '2026-10-12', null);
    for (const key of ['apn', 'propertyTax', 'assessedValue', 'zoning', 'acres', 'lotSqft'] as const) expect(result[key]).toBeNull();
    expect(result.provenance.propertyTax.status).toBe('UNAVAILABLE');
  });
  it('retains explicit reported zero tax rather than treating all zeros as unavailable', () => {
    const source = { ...active(), fieldMapping: { propertyTax: 'TAX' } };
    expect(normalizeParcel(source, { TAX: 0 }, null, '2026-10-12', null).propertyTax).toBe(0);
  });
  it('cache-first coalesces concurrent identical requests and records expiry/health', async () => {
    let stamp = 0; const cache = new ParcelRequestCache(() => stamp, 100, 1000); const work = vi.fn(async () => 'parcel');
    await Promise.all([cache.run('same', 'source', work), cache.run('same', 'source', work)]); expect(work).toHaveBeenCalledOnce();
    expect(cache.get('same')?.fresh).toBe(true); stamp = 101; expect(cache.get('same')?.fresh).toBe(false); stamp = 1101; expect(cache.get('same')).toBeNull();
  });
  it('source outage returns STALE_USABLE with retained timestamps and backoff', async () => {
    let stamp = 0; const cache = new ParcelRequestCache<ProviderResult>(() => stamp, 100, 10000); const source = active();
    const work = vi.fn().mockResolvedValueOnce(providerResult(source)).mockRejectedValue(new Error('GIS_HTTP_503'));
    const resolver = new PublicParcelResolver({ cache, logger, registry: new ParcelSourceRegistry([source]), providerFactory: () => ({ queryByPoint: work, queryByAPN: work, queryByBounds: work, getCoverage: () => source }) });
    await resolver.resolve({ operation: 'query-apn', countyFips: source.countyFips, apn: '001' }); stamp = 2000;
    const stale = await resolver.resolve({ operation: 'query-apn', countyFips: source.countyFips, apn: '001' }); expect(stale.freshness).toBe('STALE_USABLE'); expect(stale.cacheHit).toBe(true);
    await resolver.resolve({ operation: 'query-apn', countyFips: source.countyFips, apn: '001' }); expect(work).toHaveBeenCalledTimes(2);
    expect(cache.health.get(source.sourceId)?.consecutiveFailures).toBe(1);
  });
  it('opens a circuit only after repeated failures and does not permanently disable registry', async () => {
    let stamp = 0; const cache = new ParcelRequestCache(() => stamp); const fail = vi.fn(async () => { throw new Error('outage'); });
    for (let i = 0; i < 3; i++) { stamp += 100000; await expect(cache.run(`key${i}`, 'county', fail)).rejects.toThrow('outage'); }
    expect(cache.health.get('county')?.status).toBe('CIRCUIT_OPEN'); await expect(cache.run('next', 'county', fail)).rejects.toThrow('SOURCE_CIRCUIT_OPEN'); expect(fail).toHaveBeenCalledTimes(3);
  });
  it('Census county lookup is normalized, bounded and redirect-free', async () => {
    const fetcher = vi.fn(async () => response({ features: [{ attributes: { GEOID: '53033' } }] }));
    const resolver = new PublicCountyResolver(fetcher); expect(await resolver.resolve(point)).toEqual(['53033']); await resolver.resolve(point); expect(fetcher).toHaveBeenCalledOnce();
    expect(new URL(String(fetcher.mock.calls[0][0])).hostname).toBe('tigerweb.geo.census.gov');
  });
  it('has no analytical/provider/mutation imports and keeps property/report source untouched', () => {
    for (const module of ['types', 'geometry', 'registry', 'arcgis', 'county', 'cache', 'resolver']) {
      const code = readFileSync(new URL(`./${module}.ts`, import.meta.url), 'utf8');
      expect(code).not.toMatch(/from\s+['"].*(?:maxxis|property-data|rentcast|gemini|stripe)/i);
      expect(code).not.toMatch(/\.from\(['"]properties['"]\)|\.update\(|\.upsert\(/);
    }
    const edge = readFileSync(new URL('../../public-parcel/index.ts', import.meta.url), 'utf8');
    expect(edge).toContain('if (!flags.public_parcel_intelligence)'); expect(edge).not.toContain('diagnostics: true');
  });
});
