import { PARCEL_MAX_RESULTS, type Bounds, type ParcelEvidence, type ParcelField, type ParcelSource, type Point, type ProviderResult, type PublicParcelProvider } from './types.ts';
import { approvedLayerUrl, PARCEL_APPROVED_ORIGINS } from './registry.ts';
import { arcgisRingsToGeometry, areaCrossCheck, geodesicParcelArea, validGeometry, validPoint } from './geometry.ts';

export async function boundedJson(url: string, fetcher: typeof fetch, signal?: AbortSignal, timeoutMs = 7500) {
  const controller = new AbortController(); const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetcher(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`GIS_HTTP_${response.status}`);
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
    return data;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

const fieldName = (value: string) => { if (!/^[A-Za-z_][A-Za-z_0-9]*$/.test(value)) throw new Error('INVALID_REGISTRY_FIELD'); return value; };
const asText = (value: unknown) => value == null || String(value).trim() === '' ? null : String(value).trim().slice(0, 6000);
const asNumber = (value: unknown) => value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
const numericFields = new Set<ParcelField>(['assessorAcres', 'gisAcres', 'lotSqft', 'assessedValue', 'assessedYear', 'propertyTax', 'propertyTaxYear']);
export function normalizeParcel(source: ParcelSource, attributes: Record<string, unknown>, geometryInput: unknown, retrievedAt: string, sourceUpdatedAt: string | null): ParcelEvidence {
  const fields: Partial<Record<ParcelField, string | number | null>> = {}; const provenance: ParcelEvidence['provenance'] = {};
  for (const field of ['apn', 'parcelId', 'situsAddress', 'assessorAcres', 'gisAcres', 'lotSqft', 'ownerName', 'assessedValue', 'assessedYear', 'propertyTax', 'propertyTaxYear', 'taxCode', 'zoning', 'legalDescription', 'subdivision'] as ParcelField[]) {
    const name = source.fieldMapping[field]; const value = name ? numericFields.has(field) ? asNumber(attributes[name]) : asText(attributes[name]) : null;
    fields[field] = value;
    provenance[field] = { value, source: source.sourceId, sourceField: name || null, status: value === null ? 'UNAVAILABLE' : 'PUBLIC_RECORD' };
  }
  const geometry = validGeometry(geometryInput) ? geometryInput : null;
  const area = geodesicParcelArea(geometry);
  const assessorAcres = fields.assessorAcres as number | null; const gisAcres = fields.gisAcres as number | null; const recordedSqft = fields.lotSqft as number | null;
  // Parcel read model only. Preserve independent assessor/GIS/geometry values; no canonical promotion.
  const acres = assessorAcres ?? gisAcres ?? (recordedSqft == null ? area.acres : recordedSqft / 43560);
  const lotSqft = recordedSqft ?? (acres == null ? null : acres * 43560);
  provenance.acres = { value: acres, source: source.sourceId, sourceField: assessorAcres != null ? source.fieldMapping.assessorAcres! : gisAcres != null ? source.fieldMapping.gisAcres! : null,
    status: acres === null ? 'UNAVAILABLE' : assessorAcres != null || gisAcres != null ? 'PUBLIC_RECORD' : 'CALCULATED' };
  provenance.lotSqft = { value: lotSqft, source: source.sourceId, sourceField: recordedSqft == null ? null : source.fieldMapping.lotSqft!, status: lotSqft === null ? 'UNAVAILABLE' : recordedSqft == null ? 'CALCULATED' : 'PUBLIC_RECORD' };
  provenance.geometryCalculatedAcres = { value: area.acres, source: source.sourceId, sourceField: null, status: area.acres === null ? 'UNAVAILABLE' : 'CALCULATED' };
  provenance.geometryCalculatedSqft = { value: area.sqft, source: source.sourceId, sourceField: null, status: area.sqft === null ? 'UNAVAILABLE' : 'CALCULATED' };
  return { ...fields, geometry, acres, lotSqft, geometryCalculatedSqft: area.sqft, geometryCalculatedAcres: area.acres,
    source: source.sourceId, sourceAuthority: source.authorityName, sourceUrl: approvedLayerUrl(source), retrievedAt, sourceUpdatedAt, evidenceStatus: 'PUBLIC_RECORD',
    licenseStatus: source.licenseStatus, licenseUrl: source.licenseUrl, usageNotes: source.usageNotes, provenance,
    areaCrossCheck: areaCrossCheck([assessorAcres, gisAcres, recordedSqft == null ? null : recordedSqft / 43560, area.acres]) } as ParcelEvidence;
}

export class ArcGISParcelAdapter implements PublicParcelProvider {
  private metadata: Record<string, any> | null = null;
  private metadataAt = 0;
  private layerUrl: string;
  constructor(readonly source: ParcelSource, private fetcher: typeof fetch = fetch, origins: readonly string[] = PARCEL_APPROVED_ORIGINS) {
    this.layerUrl = approvedLayerUrl(source, origins);
  }
  getCoverage() { return this.source; }
  async inspect(signal?: AbortSignal) {
    if (this.metadata && Date.now() - this.metadataAt < 3600_000) return this.metadata;
    const data = await boundedJson(`${this.layerUrl}?f=json`, this.fetcher, signal);
    if (data.geometryType !== 'esriGeometryPolygon' || !/\bQuery\b/i.test(data.capabilities || '') || !Array.isArray(data.fields)) throw new Error('UNSUPPORTED_PARCEL_SCHEMA');
    this.metadata = data; this.metadataAt = Date.now(); return data;
  }
  private async query(params: Record<string, string>, signal?: AbortSignal): Promise<ProviderResult> {
    const metadata = await this.inspect(signal);
    const available = new Set(metadata.fields.map((field: { name: string }) => field.name));
    const requestedFields = [...new Set(Object.values(this.source.fieldMapping).filter((name): name is string => !!name && available.has(name)))].map(fieldName);
    if (params.apnField && !available.has(params.apnField)) throw new Error('APN_NOT_AVAILABLE');
    delete params.apnField;
    const format = /geojson/i.test(metadata.supportedQueryFormats || '') ? 'geojson' : 'json';
    const limit = Math.max(1, Math.min(PARCEL_MAX_RESULTS, Number(metadata.maxRecordCount) || PARCEL_MAX_RESULTS));
    const query = new URLSearchParams({ f: format, where: '1=1', outFields: requestedFields.join(',') || String(metadata.objectIdField || 'OBJECTID'),
      returnGeometry: 'true', outSR: '4326', resultRecordCount: String(limit), ...params });
    const data = await boundedJson(`${this.layerUrl}/query?${query}`, this.fetcher, signal);
    const features = Array.isArray(data.features) ? data.features : [];
    const stamp = new Date().toISOString();
    const update = asNumber(metadata.editingInfo?.lastEditDate); const updatedAt = update == null ? null : new Date(update).toISOString();
    const parcels = features.slice(0, limit).map((feature: Record<string, any>) => {
      let geometry = feature.geometry;
      if (format === 'json') {
        const sr = geometry?.spatialReference?.latestWkid ?? geometry?.spatialReference?.wkid ?? data.spatialReference?.latestWkid ?? data.spatialReference?.wkid;
        if (sr != null && sr !== 4326) throw new Error('GIS_OUTPUT_NOT_WGS84');
        geometry = geometry?.rings ? arcgisRingsToGeometry(geometry.rings) : null;
      }
      return normalizeParcel(this.source, feature.properties || feature.attributes || {}, geometry, stamp, updatedAt);
    });
    return { parcels, exceededLimit: data.exceededTransferLimit === true || features.length >= limit };
  }
  queryByPoint(point: Point, signal?: AbortSignal) {
    if (!validPoint(point)) return Promise.reject(new Error('INVALID_POINT'));
    return this.query({ geometry: JSON.stringify({ x: point.lng, y: point.lat }), geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }, signal);
  }
  queryByAPN(input: string, signal?: AbortSignal) {
    const apn = String(input).trim(); const mapping = this.source.fieldMapping.apn;
    if (!mapping) return Promise.reject(new Error('APN_NOT_AVAILABLE'));
    if (!apn || apn.length > 80 || !/^[\p{L}\p{N} ._\/-]+$/u.test(apn)) return Promise.reject(new Error('INVALID_APN'));
    const field = fieldName(mapping); const normalized = this.source.apnNormalization === 'REMOVE_SEPARATORS' ? apn.replace(/[ ._\/-]/g, '') : apn;
    return this.query({ apnField: field, where: normalized === apn ? `${field} = '${apn}'` : `(${field} = '${apn}' OR ${field} = '${normalized}')` }, signal);
  }
  queryByBounds(bounds: Bounds, signal?: AbortSignal) {
    return this.query({ geometry: JSON.stringify({ xmin: bounds[0], ymin: bounds[1], xmax: bounds[2], ymax: bounds[3] }), geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects' }, signal);
  }
}
