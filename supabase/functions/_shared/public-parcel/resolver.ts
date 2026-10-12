import { ArcGISParcelAdapter } from './arcgis.ts';
import { ParcelRequestCache } from './cache.ts';
import { PublicCountyResolver } from './county.ts';
import { ParcelSourceRegistry, normalizeCountyFips } from './registry.ts';
import { validPoint } from './geometry.ts';
import { PARCEL_MIN_ZOOM, PARCEL_MAX_RESULTS, type ParcelQuery, type ParcelResult, type ParcelSource, type Point, type ProviderResult, type PublicParcelProvider } from './types.ts';

export function validBounds(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4 && value.every(v => typeof v === 'number' && Number.isFinite(v))
    && value[0] >= -180 && value[2] <= 180 && value[1] >= -90 && value[3] <= 90 && value[0] < value[2] && value[1] < value[3];
}
export function validateParcelQuery(input: unknown): ParcelQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_QUERY');
  const row = input as Record<string, unknown>;
  const keys = ['operation', 'point', 'bounds', 'zoom', 'countyFips', 'stateFips', 'apn', 'address'];
  if (Object.keys(row).some(key => !keys.includes(key))) throw new Error('UNKNOWN_QUERY_FIELD');
  if (!['resolve', 'query-point', 'query-apn', 'query-bounds', 'coverage'].includes(String(row.operation))) throw new Error('INVALID_OPERATION');
  if (row.point !== undefined && !validPoint(row.point)) throw new Error('INVALID_POINT');
  if (row.bounds !== undefined && !validBounds(row.bounds)) throw new Error('INVALID_BOUNDS');
  if (row.countyFips !== undefined && !normalizeCountyFips(row.countyFips, row.stateFips)) throw new Error('INVALID_FIPS');
  if (row.zoom !== undefined && (typeof row.zoom !== 'number' || !Number.isFinite(row.zoom) || row.zoom < 0 || row.zoom > 22)) throw new Error('INVALID_ZOOM');
  if (row.operation === 'query-bounds' && !validBounds(row.bounds)) throw new Error('BOUNDS_REQUIRED');
  if (row.operation === 'query-point' && !validPoint(row.point)) throw new Error('POINT_REQUIRED');
  if (row.operation === 'query-apn' && (typeof row.apn !== 'string' || !row.apn.trim() || row.apn.length > 80 || !/^[\p{L}\p{N} ._\/-]+$/u.test(row.apn))) throw new Error('INVALID_APN');
  if (row.address !== undefined) {
    const address = row.address as Record<string, unknown>;
    if (!address || Array.isArray(address) || typeof address !== 'object' || typeof address.address !== 'string' || !address.address.trim()
      || Object.keys(address).some(key => !['address', 'city', 'state', 'zip'].includes(key))
      || Object.values(address).some(v => typeof v !== 'string' || v.length > 200)) throw new Error('INVALID_ADDRESS');
  }
  return row as ParcelQuery;
}

type ResolverOptions = {
  registry?: ParcelSourceRegistry;
  providerFactory?: (source: ParcelSource) => PublicParcelProvider;
  resolveCounty?: (point: Point, signal?: AbortSignal) => Promise<string[]>;
  resolveBoundsCounties?: (bounds: [number, number, number, number], signal?: AbortSignal) => Promise<string[]>;
  geocode?: (address: NonNullable<ParcelQuery['address']>, signal?: AbortSignal) => Promise<Point | null>;
  cache?: ParcelRequestCache<ProviderResult>;
  diagnostics?: boolean; // Constructor-only local tooling; NEVER accepted from HTTP input.
  logger?: (event: Record<string, unknown>) => void;
};
export class PublicParcelResolver {
  private options: ResolverOptions;
  private registry: ParcelSourceRegistry;
  private cache: ParcelRequestCache<ProviderResult>;
  private providers = new Map<string, PublicParcelProvider>();
  constructor(options: ResolverOptions = {}) {
    this.options = options; this.registry = options.registry || new ParcelSourceRegistry(); this.cache = options.cache || new ParcelRequestCache();
    if (!this.options.resolveCounty) {
      const counties = new PublicCountyResolver(); this.options.resolveCounty = (point, signal) => counties.resolve(point, signal);
      this.options.resolveBoundsCounties ||= (bounds, signal) => counties.resolveBounds(bounds, signal);
    }
  }
  async resolve(query: ParcelQuery): Promise<ParcelResult> {
    const start = Date.now();
    const empty = (status: ParcelResult['status'], reason: string, fips: string | null = null): ParcelResult =>
      ({ status, reason, parcels: [], countyFips: fips, sourceIds: [], ambiguity: status === 'AMBIGUOUS_LOCATION', exceededLimit: false, cacheHit: false, freshness: 'UNAVAILABLE', expiresAt: null });
    if (query.operation === 'query-bounds' && (!validBounds(query.bounds) || (query.zoom ?? 0) < PARCEL_MIN_ZOOM)) return empty('PARCEL_NOT_FOUND', 'ZOOM_REQUIRED');
    if (query.bounds && (query.bounds[2] - query.bounds[0] > 0.08 || query.bounds[3] - query.bounds[1] > 0.06)) return empty('PARCEL_NOT_FOUND', 'NARROWER_VIEWPORT_REQUIRED');
    let point = query.point;
    if (!point && query.address) {
      try { point = await this.options.geocode?.(query.address, query.signal) || undefined; }
      catch { return empty('SOURCE_TEMPORARILY_UNAVAILABLE', 'GEOCODE_UNAVAILABLE'); }
    }
    if (point && !validPoint(point)) return empty('AMBIGUOUS_LOCATION', 'INVALID_POINT');
    if (!point && query.bounds) point = { lng: (query.bounds[0] + query.bounds[2]) / 2, lat: (query.bounds[1] + query.bounds[3]) / 2 };
    let fips = normalizeCountyFips(query.countyFips, query.stateFips);
    // A client FIPS hint cannot override the spatial county when a point is available.
    if (point) {
      try {
        const counties = query.bounds && this.options.resolveBoundsCounties ? await this.options.resolveBoundsCounties(query.bounds, query.signal) : await this.options.resolveCounty!(point, query.signal);
        if (counties.length !== 1 || fips && counties[0] !== fips) return empty('AMBIGUOUS_LOCATION', 'COUNTY_UNRESOLVED_OR_CONFLICT');
        fips = counties[0];
      } catch { return empty('SOURCE_TEMPORARILY_UNAVAILABLE', 'COUNTY_LOOKUP_UNAVAILABLE'); }
    }
    if (!fips) return empty('AMBIGUOUS_LOCATION', 'COUNTY_OR_LOCATION_REQUIRED');
    const sources = this.registry.forCounty(fips, this.options.diagnostics === true);
    if (!sources.length) return empty('NO_ACTIVE_PUBLIC_SOURCE', 'NO_APPROVED_ACTIVE_SOURCE', fips);
    if (query.operation === 'coverage') return { ...empty('COVERAGE_AVAILABLE', 'SOURCE_REGISTERED', fips), sourceIds: sources.map(s => s.sourceId) };
    if (!point && !query.apn) return empty('AMBIGUOUS_LOCATION', 'POINT_APN_OR_ADDRESS_REQUIRED', fips);
    const records: ParcelResult[] = [];
    for (const source of sources.slice(0, 3)) {
      const identity = query.bounds || (query.apn ? { apn: query.apn } : point);
      const key = `${source.sourceId}:${source.lastValidatedAt}:${query.operation}:${JSON.stringify(identity)}`;
      const cached = this.cache.get(key); let value: ProviderResult; let freshness: ParcelResult['freshness'] = 'FRESH'; let cacheHit = false;
      try {
        if (cached?.fresh) { value = cached.value; cacheHit = true; }
        else value = await this.cache.run(key, source.sourceId, async () => {
          let provider = this.providers.get(source.sourceId);
          if (!provider) { provider = this.options.providerFactory?.(source) || new ArcGISParcelAdapter(source); this.providers.set(source.sourceId, provider); }
          return query.bounds ? provider.queryByBounds(query.bounds, query.signal) : query.apn ? provider.queryByAPN(query.apn, query.signal) : provider.queryByPoint(point!, query.signal);
        });
      } catch (error) {
        if (query.signal?.aborted) throw error;
        this.options.logger?.({ sourceId: source.sourceId, countyFips: fips, operation: query.operation, cacheHit: !!cached, duration: Date.now() - start, resultCount: cached?.value.parcels.length || 0, errorClass: (error as Error).message.slice(0, 80) });
        if (!cached) { records.push({ ...empty('SOURCE_TEMPORARILY_UNAVAILABLE', 'SOURCE_QUERY_UNAVAILABLE', fips), sourceIds: [source.sourceId] }); continue; }
        value = cached.value; freshness = 'STALE_USABLE'; cacheHit = true;
      }
      const row = this.cache.get(key);
      records.push({ status: value.parcels.length ? 'COVERAGE_AVAILABLE' : 'PARCEL_NOT_FOUND', parcels: value.parcels,
        countyFips: fips, sourceIds: [source.sourceId], ambiguity: query.operation !== 'query-bounds' && value.parcels.length > 1,
        exceededLimit: value.exceededLimit, freshness, cacheHit, expiresAt: row ? new Date(row.expiresAt).toISOString() : null });
      this.options.logger?.({ sourceId: source.sourceId, countyFips: fips, operation: query.operation, cacheHit, duration: Date.now() - start, resultCount: value.parcels.length, errorClass: null });
    }
    const available = records.filter(row => row.status === 'COVERAGE_AVAILABLE');
    if (!available.length) return records.find(row => row.status === 'SOURCE_TEMPORARILY_UNAVAILABLE') || records[0];
    const parcels = available.flatMap(row => row.parcels);
    return { ...available[0], parcels: parcels.slice(0, PARCEL_MAX_RESULTS), sourceIds: available.flatMap(row => row.sourceIds), ambiguity: query.operation !== 'query-bounds' && parcels.length > 1,
      exceededLimit: parcels.length > PARCEL_MAX_RESULTS || available.some(row => row.exceededLimit), freshness: available.some(row => row.freshness === 'STALE_USABLE') ? 'STALE_USABLE' : 'FRESH', cacheHit: available.every(row => row.cacheHit) };
  }
}
