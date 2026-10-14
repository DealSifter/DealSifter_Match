import { boundedJson } from './arcgis.ts';
import type { Point, Bounds } from './types.ts';
import { validPoint } from './geometry.ts';
import { ParcelRequestCache, waitForParcelRequest } from './cache.ts';

const COUNTY_LAYER = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1';
export class PublicCountyResolver {
  private cache = new ParcelRequestCache<string[]>();
  constructor(private fetcher: typeof fetch = fetch) {}
  async resolve(point: Point, signal?: AbortSignal) {
    if (!validPoint(point)) throw new Error('INVALID_POINT');
    return this.query(`${point.lat},${point.lng}`, `${point.lng},${point.lat}`, 'esriGeometryPoint', signal);
  }
  async resolveBounds(bounds: Bounds, signal?: AbortSignal) {
    return this.query(JSON.stringify(bounds), JSON.stringify({ xmin: bounds[0], ymin: bounds[1], xmax: bounds[2], ymax: bounds[3] }), 'esriGeometryEnvelope', signal);
  }
  private async query(key: string, geometry: string, geometryType: string, signal?: AbortSignal) {
    // Exact coordinates: rounding can misroute a parcel beside a county boundary.
    const cached = this.cache.get(key); if (cached?.fresh) return cached.value;
    try {
      return await waitForParcelRequest(this.cache.run(key, 'census-county', async () => {
        const params = new URLSearchParams({ f: 'json', where: '1=1', geometry, geometryType, inSR: '4326',
          spatialRel: 'esriSpatialRelIntersects', outFields: 'GEOID,STATE,COUNTY', returnGeometry: 'false', resultRecordCount: '3' });
        const data = await boundedJson(`${COUNTY_LAYER}/query?${params}`, this.fetcher);
        if (data.exceededTransferLimit) throw new Error('AMBIGUOUS_COUNTY');
        return [...new Set<string>((data.features || []).map((row: { attributes: { GEOID: string } }) => row.attributes.GEOID).filter((fips: string) => /^\d{5}$/.test(fips)))];
      }),signal);
    } catch (error) { if (signal?.aborted) throw error; if (cached) return cached.value; throw error; }
  }
}
