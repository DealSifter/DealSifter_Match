import { PARCEL_MAX_RESULTS, type Bounds, type ParcelEvidence, type ParcelField, type ParcelSource, type Point, type ProviderResult, type PublicParcelProvider } from './types.ts';
import { approvedLayerUrl, PARCEL_APPROVED_ORIGINS } from './registry.ts';
import { arcgisRingsToGeometry, areaCrossCheck, geodesicParcelArea, validGeometry, validPoint } from './geometry.ts';
import { waitForParcelRequest } from './cache.ts';
import { type ParcelRequestTelemetry, type ParcelTrace, parcelTelemetryObserver } from './telemetry.ts';

export async function boundedJson(url: string, fetcher: typeof fetch, signal?: AbortSignal, timeoutMs = 7500, observe?: (entry: ParcelRequestTelemetry) => void) {
  const started = performance.now(), requestedAt = new Date().toISOString();
  let httpStatus: number | null = null, outcome: ParcelRequestTelemetry['outcome'] = 'TRANSPORT_ERROR';
  const controller = new AbortController(); const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  try {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
    httpStatus = response.status; outcome = response.ok ? 'INVALID_RESPONSE' : 'HTTP_ERROR';
    if (!response.ok) {
      const retry = response.headers.get('retry-after');
      const retryAfterMs = retry == null ? 0 : /^\d+(?:\.\d+)?$/.test(retry.trim()) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
      throw Object.assign(new Error(`GIS_HTTP_${response.status}`), { retryAfterMs: Number.isFinite(retryAfterMs) ? Math.max(0, retryAfterMs) : 0 });
    }
    if (Number(response.headers.get('content-length')) > 5_000_000) throw new Error('GIS_RESPONSE_TOO_LARGE');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('GIS_EMPTY_RESPONSE');
    const parts: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break;
        size += value.length; if (size > 5_000_000) throw new Error('GIS_RESPONSE_TOO_LARGE'); parts.push(value); }
    } catch (error) { await reader.cancel(); throw error; }
    const buffer = new Uint8Array(size); let offset = 0;
    parts.forEach(part => { buffer.set(part, offset); offset += part.length; });
    const data = JSON.parse(new TextDecoder().decode(buffer));
    if (data?.error) throw new Error(`ARCGIS_${data.error.code || 'ERROR'}`);
    outcome = 'SUCCESS'; return data;
  } catch (error) {
    if (timedOut && !signal?.aborted) throw new Error('GIS_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    const service = new URL(url);
    observe?.({ provider: service.hostname === 'tigerweb.geo.census.gov' ? 'census' : 'arcgis',
      service: `${service.origin}${service.pathname}`, httpStatus, latencyMs: Math.max(0, Math.round(performance.now()-started)), requestedAt, outcome });
  }
}

/** Public diagnostic reason only: never expose provider response bodies or private attributes. */
export function parcelErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'GIS_TIMEOUT') return 'TIMEOUT';
  if (/^(GIS_HTTP_401|ARCGIS_49[89])$/.test(message)) return 'AUTH_REQUIRED';
  if (message === 'GIS_HTTP_403') return 'HTTP_403';
  if (message === 'GIS_HTTP_429') return 'HTTP_429';
  if (/^(UNSUPPORTED_|APN_NOT_AVAILABLE)/.test(message)) return 'UNSUPPORTED_OPERATION';
  if (/^ARCGIS_/.test(message)) return 'ARCGIS_JSON_ERROR';
  if (/^SOURCE_(CIRCUIT_OPEN|COURTESY_BACKOFF|SHARED_RATE_LIMIT)$/.test(message)) return message;
  return 'PROVIDER_ERROR';
}

const fieldName = (value: string) => { if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(value)) throw new Error('INVALID_REGISTRY_FIELD'); return value; };
const asText = (value: unknown) => value == null || String(value).trim() === '' ? null : String(value).trim().slice(0, 6000);
const asNumber = (value: unknown) => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
const numericFields = new Set<ParcelField>(['assessorAcres', 'gisAcres', 'lotSqft', 'assessedValue', 'assessedYear', 'propertyTax', 'propertyTaxYear', 'buildingArea', 'yearBuilt']);
export function normalizeParcel(source: ParcelSource, attributes: Record<string, unknown>, geometryInput: unknown, retrievedAt: string, sourceUpdatedAt: string | null): ParcelEvidence {
  const fields: Partial<Record<ParcelField, string | number | null>> = {}; const provenance: ParcelEvidence['provenance'] = {};
  for (const field of ['apn', 'parcelId', 'situsAddress', 'assessorAcres', 'gisAcres', 'lotSqft', 'ownerName', 'assessedValue', 'assessedYear', 'propertyTax', 'propertyTaxYear', 'taxCode', 'zoning', 'legalDescription', 'subdivision', 'buildingArea', 'yearBuilt'] as ParcelField[]) {
    const name = source.fieldMapping[field]; const value = name ? numericFields.has(field) ? asNumber(attributes[name]) : asText(attributes[name]) : null;
    fields[field] = value;
    provenance[field] = { value, source: source.sourceId, sourceField: name || null, status: value === null ? 'UNAVAILABLE' : 'PUBLIC_RECORD' };
  }
  if (source.situsMapping) {
    const {street, city, zip} = source.situsMapping;
    const address = asText(attributes[street]), locality = asText(attributes[city]), postal = asText(attributes[zip]);
    // Never guess missing postal components or replace a full situs string.
    if (address && !address.includes(',') && locality && postal && /^\d{5}(?:-\d{4})?$/.test(postal)) {
      fields.situsAddress = `${address}, ${locality}, ${source.state} ${postal}`;
      provenance.situsAddress = {value: fields.situsAddress, source: source.sourceId, sourceField: `${street},${city},${zip}`, status:'PUBLIC_RECORD'};
      for (const [key, name] of Object.entries(source.situsMapping)) provenance[`situs_${key}`] = {value: attributes[name] ?? null, source:source.sourceId, sourceField:name, status:attributes[name] == null ? 'UNAVAILABLE' : 'PUBLIC_RECORD'};
    }
  }
  if (source.areaMapping) {
    const { valueField, unitField } = source.areaMapping;
    const value = asNumber(attributes[valueField]);
    const unit = String(attributes[unitField] ?? '').trim().toUpperCase().replace(/[ ._-]/g, '');
    const target = ['AC', 'ACRE', 'ACRES'].includes(unit) ? 'assessorAcres' : ['SF', 'SQFT', 'SQUAREFEET'].includes(unit) ? 'lotSqft' : null;
    if (target && value !== null) {
      fields[target] = value;
      provenance[target] = { value, source: source.sourceId, sourceField: valueField, status: 'PUBLIC_RECORD' };
    }
  }
  const geometry = validGeometry(geometryInput) ? geometryInput : null;
  const area = geodesicParcelArea(geometry);
  const assessorAcres = fields.assessorAcres as number | null; const gisAcres = fields.gisAcres as number | null; const recordedSqft = fields.lotSqft as number | null;
  // Parcel read model only. Preserve independent assessor/GIS/geometry values; no canonical promotion.
  const acres = assessorAcres ?? gisAcres ?? (recordedSqft == null ? area.acres : recordedSqft / 43560);
  const lotSqft = recordedSqft ?? (acres == null ? null : acres * 43560);
  provenance.acres = { value: acres, source: source.sourceId, sourceField: assessorAcres != null ? provenance.assessorAcres.sourceField : gisAcres != null ? source.fieldMapping.gisAcres! : null,
    status: acres === null ? 'UNAVAILABLE' : assessorAcres != null || gisAcres != null ? 'PUBLIC_RECORD' : 'CALCULATED' };
  provenance.lotSqft = { value: lotSqft, source: source.sourceId, sourceField: recordedSqft == null ? null : provenance.lotSqft.sourceField, status: lotSqft === null ? 'UNAVAILABLE' : recordedSqft == null ? 'CALCULATED' : 'PUBLIC_RECORD' };
  provenance.geometryCalculatedAcres = { value: area.acres, source: source.sourceId, sourceField: null, status: area.acres === null ? 'UNAVAILABLE' : 'CALCULATED' };
  provenance.geometryCalculatedSqft = { value: area.sqft, source: source.sourceId, sourceField: null, status: area.sqft === null ? 'UNAVAILABLE' : 'CALCULATED' };
  return { ...fields, geometry, acres, lotSqft, geometryCalculatedSqft: area.sqft, geometryCalculatedAcres: area.acres,
    source: source.sourceId, sourceAuthority: source.authorityName, sourceUrl: approvedLayerUrl(source), retrievedAt, sourceUpdatedAt, evidenceStatus: 'PUBLIC_RECORD',
    licenseStatus: source.licenseStatus, licenseUrl: source.licenseUrl, usageNotes: source.usageNotes, sourceDomains: source.strengths || [], provenance,
    areaCrossCheck: areaCrossCheck([assessorAcres, gisAcres, recordedSqft == null ? null : recordedSqft / 43560, area.acres]) } as ParcelEvidence;
}

export class ArcGISParcelAdapter implements PublicParcelProvider {
  private metadataTelemetry: ParcelRequestTelemetry[] = [];
  private metadata: Record<string, any> | null = null;
  private metadataAt = 0;
  private metadataPending: Promise<Record<string, any>> | null = null;
  private layerUrl: string;
  constructor(readonly source: ParcelSource, private fetcher: typeof fetch = fetch, origins: readonly string[] = PARCEL_APPROVED_ORIGINS, private trace: ParcelTrace = {}) {
    this.layerUrl = approvedLayerUrl(source, origins);
  }
  getCoverage() { return this.source; }
  async inspect(signal?: AbortSignal) {
    if (this.metadata && Date.now() - this.metadataAt < 3600_000) return this.metadata;
    if(!this.metadataPending) this.metadataPending=(async()=>{
      this.metadataTelemetry = [];
      const data = await boundedJson(`${this.layerUrl}?f=json`, this.fetcher, undefined, 7500, parcelTelemetryObserver(this.metadataTelemetry, this.trace));
      if (data.geometryType !== 'esriGeometryPolygon' || !/\bQuery\b/i.test(data.capabilities || '') || !Array.isArray(data.fields)) throw new Error('UNSUPPORTED_PARCEL_SCHEMA');
      this.metadata = data; this.metadataAt = Date.now(); return data;
    })().finally(()=>{this.metadataPending=null;});
    return waitForParcelRequest(this.metadataPending,signal);
  }
  private async query(params: Record<string, string>, signal?: AbortSignal): Promise<ProviderResult> {
    const telemetry: ParcelRequestTelemetry[] = [];
    try {
    const metadata = await this.inspect(signal);
    const available = new Set(metadata.fields.map((field: { name: string }) => field.name));
    const mappedNames = [...Object.values(this.source.fieldMapping), ...Object.values(this.source.areaMapping || {}), ...Object.values(this.source.situsMapping || {})];
    const requestedFields = [...new Set(mappedNames.filter((name): name is string => !!name && available.has(name)))].map(fieldName);
    if (params.apnField && !available.has(params.apnField)) throw new Error('APN_NOT_AVAILABLE');
    delete params.apnField;
    if (this.source.countyQuery) {
      const { field, codes } = this.source.countyQuery;
      const fips = this.source.queryCountyFips;
      if (!fips || !/^\d{5}$/.test(fips) || ![this.source.countyFips, ...this.source.coverageCountyFips || []].includes(fips)) throw new Error('COUNTY_SCOPE_REQUIRED');
      const code = codes ? codes[fips] : fips;
      // Some approved state schemas (e.g. Ohio) use a county NAME, not FIPS.
      // Values are registry-owned; clients still cannot provide SQL predicates.
      if (code == null || !/^[\p{L}\p{N} .'-]{1,80}$/u.test(String(code)) || !available.has(field)
        || typeof code === 'number' && !Number.isSafeInteger(code)) throw new Error('COUNTY_SCOPE_UNAVAILABLE');
      const literal = typeof code === 'number' ? String(code) : `'${String(code).replaceAll("'", "''")}'`;
      params.where = `(${params.where || '1=1'}) AND ${fieldName(field)} = ${literal}`;
    }
    const format = this.source.preferredQueryFormat === 'json' ? 'json' : params.returnGeometry !== 'false' && /geojson/i.test(metadata.supportedQueryFormats || '') ? 'geojson' : 'json';
    const limit = Math.max(1, Math.min(PARCEL_MAX_RESULTS, Number(metadata.maxRecordCount) || PARCEL_MAX_RESULTS));
    const query = new URLSearchParams({ f: format, where: '1=1', outFields: requestedFields.join(',') || String(metadata.objectIdField || 'OBJECTID'),
      returnGeometry: 'true', outSR: '4326', resultRecordCount: String(limit), ...params });
    const data = await boundedJson(`${this.layerUrl}/query?${query}`, this.fetcher, signal, 7500, parcelTelemetryObserver(telemetry, this.trace));
    if (!Array.isArray(data?.features)) throw new Error('GIS_INVALID_QUERY_RESPONSE');
    const features = data.features;
    const stamp = new Date().toISOString();
    const update = asNumber(metadata.editingInfo?.lastEditDate); const updatedAt = update == null ? null : new Date(update).toISOString();
    const parcels = features.slice(0, limit).map((feature: Record<string, any>) => {
      let geometry = params.returnGeometry === 'false' ? null : feature.geometry;
      if (format === 'json') {
        const sr = geometry?.spatialReference?.latestWkid ?? geometry?.spatialReference?.wkid ?? data.spatialReference?.latestWkid ?? data.spatialReference?.wkid;
        if (geometry && sr != null && sr !== 4326) throw new Error('GIS_OUTPUT_NOT_WGS84');
        geometry = geometry?.rings ? arcgisRingsToGeometry(geometry.rings) : null;
      }
      return normalizeParcel(this.source, feature.properties || feature.attributes || {}, geometry, stamp, updatedAt);
    });
    return { parcels, exceededLimit: data.exceededTransferLimit === true || features.length >= limit, telemetry: [...this.metadataTelemetry, ...telemetry] };
    } catch (error) { throw Object.assign(error instanceof Error ? error : new Error('GIS_QUERY_FAILED'), { telemetry: [...this.metadataTelemetry, ...telemetry] }); }
  }
  queryByPoint(point: Point, signal?: AbortSignal, includeGeometry = this.source.defaultLookupGeometry ?? true) {
    if (!validPoint(point)) return Promise.reject(new Error('INVALID_POINT'));
    return this.query({ returnGeometry: String(includeGeometry), geometry: JSON.stringify({ x: point.lng, y: point.lat }), geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }, signal);
  }
  queryByAPN(input: string, signal?: AbortSignal, includeGeometry = this.source.defaultLookupGeometry ?? true) {
    const apn = String(input).trim(); const mapping = this.source.fieldMapping.apn;
    if (!mapping) return Promise.reject(new Error('APN_NOT_AVAILABLE'));
    // '*' is a literal character in official APNs (e.g. Brevard FL). These
    // predicates use equality, never LIKE; SQL metacharacters remain rejected.
    if (!apn || apn.length > 80 || !/^[\p{L}\p{N} ._*\/-]+$/u.test(apn)) return Promise.reject(new Error('INVALID_APN'));
    const field = fieldName(mapping); const normalized = this.source.apnNormalization === 'REMOVE_SEPARATORS' ? apn.replace(/[ ._\/-]/g, '') : apn;
    return this.query({ returnGeometry: String(includeGeometry), apnField: field, where: normalized === apn ? `${field} = '${apn}'` : `(${field} = '${apn}' OR ${field} = '${normalized}')` }, signal);
  }
  queryByBounds(bounds: Bounds, signal?: AbortSignal) {
    return this.query({ geometry: JSON.stringify({ xmin: bounds[0], ymin: bounds[1], xmax: bounds[2], ymax: bounds[3] }), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }, signal);
  }
}
