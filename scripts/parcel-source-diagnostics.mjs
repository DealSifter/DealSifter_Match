import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createHash } from 'node:crypto';

const refreshOnly = process.argv.includes('--refresh-artifacts');
if ((!process.argv.includes('--live') && !refreshOnly) || process.env.NODE_ENV === 'production') throw new Error('EXPLICIT_LOCAL_DIAGNOSTICS_ONLY');
const output = 'qa/public-parcel-intelligence/';
await mkdir(output, { recursive: true });
const save = (name, value) => writeFile(output + name, JSON.stringify(value, null, 2) + '\n');
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: { usePolling: false } }, appType: 'custom' });
try {
  const { PARCEL_SOURCES, approvedLayerUrl, productionSourceAllowed } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/registry.ts');
  const { ArcGISParcelAdapter, boundedJson } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/arcgis.ts');
  const { PublicParcelResolver } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/resolver.ts');
  const { geometryContains } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/geometry.ts');
  if (refreshOnly) {
    const recorded = JSON.parse(await readFile(output + 'cross-state-validation.json', 'utf8'));
    for (const record of recorded.sources) {
      const source = PARCEL_SOURCES.find(candidate => candidate.sourceId === record.sourceId);
      record.status = source.status; record.lastValidatedAt = source.lastValidatedAt;
      if (record.schema) record.inspection = inspectDiscoverySource(source, record.schema);
    }
    await save('cross-state-validation.json', recorded);
    await save('source-registry.json', PARCEL_SOURCES);
    await save('source-inspection.json', recorded.sources.map(({ sourceId, inspection, diagnosticError }) => ({ sourceId, inspection: inspection || null, diagnosticError: diagnosticError || null, automaticActivation: false })));
  } else {
  const discovery = [];
  for (const owner of ['JeffersonCountyALgis', 'WakeCountyGovernment', 'UtahAGRC']) {
    const url = new URL('https://www.arcgis.com/sharing/rest/search'); url.search = new URLSearchParams({ q: `owner:${owner} parcels`, f: 'json', num: '12' });
    try {
      const data = await boundedJson(url.href, fetch, undefined, 15000);
      discovery.push({ query: `owner:${owner} parcels`, total: data.total, candidates: (data.results || []).map(item => ({ itemId: item.id, publisher: item.owner, title: item.title, type: item.type, serviceUrl: item.url, status: 'DISCOVERED' })), automaticActivation: false });
    } catch (error) { discovery.push({ query: owner, error: error.message, automaticActivation: false }); }
  }
  await save('discovery.json', discovery);
  let gablePoint = null; let appControl = null; let geocodeControl = null;
  // Existing property and geocode cache, scoped read-only. Never invoke RentCast/Maxxis or impersonate a browser session.
  try {
    const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line)).map(line => {
      const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')];
    }));
    const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL; const key = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    const scopedRead = async path => {
      const response = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`CONTROL_READ_${response.status}`); return response.json();
    };
    const [property] = await scopedRead('properties?select=id,address,city,state,zip,lot,lat,lng&id=eq.20e8a78f-fcf7-4017-83cd-5c8355498da9');
    if (!property || !/^741 Gable/i.test(property.address)) throw new Error('CONTROL_IDENTITY_MISMATCH');
    appControl = property;
    const address = [property.address, property.city, property.state, property.zip, 'USA'].filter(Boolean).join(', ');
    const hash = createHash('sha256').update(address.toLowerCase()).digest('hex');
    const cached = await scopedRead(`geocode_cache?select=lat,lng,provider_used,status&address_hash=eq.${hash}`);
    geocodeControl = cached[0] || null;
    const coords = geocodeControl?.status === 'success' ? geocodeControl : property;
    if (coords.lat != null && coords.lng != null) gablePoint = { lat: Number(coords.lat), lng: Number(coords.lng) };
  } catch (error) { geocodeControl = { status: 'NOT_AVAILABLE', reason: error.message }; }
  const controls = [];
  for (const source of PARCEL_SOURCES) {
    const adapter = new ArcGISParcelAdapter(source);
    const record = { sourceId: source.sourceId, state: source.state, county: source.county, countyFips: source.countyFips,
      authority: source.authorityName, providerType: source.providerType, serviceUrl: approvedLayerUrl(source), licenseStatus: source.licenseStatus,
      status: source.status, productionEnabled: productionSourceAllowed(source), diagnosticOnly: true };
    try {
      const metadata = await adapter.inspect();
      record.schema = { name: metadata.name, geometry: metadata.geometryType, fields: metadata.fields.map(field => ({ name: field.name, type: field.type, alias: field.alias })),
        capabilities: metadata.capabilities, maxRecordCount: metadata.maxRecordCount, spatialReference: metadata.spatialReference, formats: metadata.supportedQueryFormats };
      record.inspection = inspectDiscoverySource(source, record.schema);
      await save(`metadata-${source.sourceId}.json`, record.schema);
      let point = source.countyFips === '01073' ? gablePoint : null;
      if (!point) {
        const sample = await boundedJson(`${approvedLayerUrl(source)}/query?${new URLSearchParams({ f: /geojson/i.test(metadata.supportedQueryFormats) ? 'geojson' : 'json', where: '1=1', resultRecordCount: '1', outFields: Object.values(source.fieldMapping).filter(name => metadata.fields.some(field => field.name === name)).join(',') || 'OBJECTID', returnGeometry: 'true', outSR: '4326' })}`, fetch);
        const geometry = sample.features?.[0]?.geometry;
        const ring = geometry?.type === 'MultiPolygon' ? geometry.coordinates[0][0] : geometry?.coordinates?.[0];
        if (!ring) throw new Error('DIAGNOSTIC_SEED_GEOMETRY_UNAVAILABLE');
        const center = { lng: ring.reduce((n, p) => n + p[0], 0) / ring.length, lat: ring.reduce((n, p) => n + p[1], 0) / ring.length };
        point = geometryContains(geometry, center) ? center : { lng: ring[0][0], lat: ring[0][1] };
      }
      // Same resolver API for every county/state. Review-source permission is constructor-local, never an HTTP flag.
      const resolver = new PublicParcelResolver({ diagnostics: true, providerFactory: () => adapter });
      record.result = await resolver.resolve({ operation: 'query-point', point, countyFips: source.countyFips });
      record.controlPoint = point;
      record.normalizationPass = record.result.status === 'COVERAGE_AVAILABLE' && record.result.parcels.length > 0;
      const parcel = record.result.parcels[0];
      if (parcel?.apn) {
        await new Promise(resolve => setTimeout(resolve, 1700));
        record.apnResult = await resolver.resolve({ operation: 'query-apn', apn: parcel.apn, countyFips: source.countyFips });
        record.apnParity = record.apnResult.parcels.some(item => item.apn === parcel.apn);
      }
      if (source.countyFips === '01073') await save('gable-public-parcel.json', { ...record, appControl, geocodeControl, canonicalFactsModified: false, maxxisIntegration: false, reportIntegration: false });
    } catch (error) {
      record.normalizationPass = false; record.diagnosticError = error.message;
      if (source.countyFips === '01073') await save('gable-public-parcel.json', { ...record, appControl, geocodeControl, parcelFound: false, geometry: null, reason: 'Source unavailable; no parcel/APN/area is invented.', canonicalFactsModified: false });
    }
    controls.push(record); console.log(JSON.stringify({ sourceId: source.sourceId, status: record.result?.status, normalizationPass: record.normalizationPass, error: record.diagnosticError }));
  }
  await save('source-registry.json', PARCEL_SOURCES);
  await save('cross-state-validation.json', { mode: 'LIVE_PUBLIC_DIAGNOSTICS_ONLY', sources: controls, successfulCounties: controls.filter(source => source.normalizationPass).length });
  await save('coverage-report.json', { architecture: 'NATIONAL', coverage: 'PROGRESSIVE', statesAttempted: [...new Set(controls.map(s => s.state))], countiesAttempted: controls.map(s => s.countyFips),
    activePublicSources: PARCEL_SOURCES.filter(productionSourceAllowed).length, candidateSources: PARCEL_SOURCES.length,
    licenseReviewCounties: PARCEL_SOURCES.filter(s => s.licenseStatus !== 'CLEAR_FOR_USE' && s.licenseStatus !== 'APPROVED').map(s => s.countyFips),
    successfulDiagnosticCounties: controls.filter(s => s.normalizationPass).map(s => s.countyFips),
    unavailableSources: controls.filter(s => s.diagnosticError).map(s => ({ sourceId: s.sourceId, reason: s.diagnosticError })),
    unsupportedControl: '06001', publicExposure: 'DISABLED', automatedRentCastCalls: 0, geminiCalls: 0, stripeMutations: 0 });
  }
  // Diagnostic comparison from an already captured cache artifact. No new paid-provider request.
  const gable = JSON.parse(await readFile(output + 'gable-public-parcel.json', 'utf8'));
  const previous = JSON.parse(await readFile('qa/land-report-hardening/lot-dimension-resolution.json', 'utf8'));
  gable.existingFactsComparison = { previousObservationAt: previous.observedAt, publisherLot: gable.appControl?.lot ?? null,
    cachedProviderSqft: previous.sourceSqft, resolvedLot: previous.resolved,
    parcelComparison: gable.parcelFound === false ? 'NOT_AVAILABLE_NO_PUBLIC_PARCEL' : 'DIAGNOSTIC_ONLY',
    canonicalFactsModified: false, newPaidProviderCalls: 0 };
  gable.addressGeocodeValidation = { realAuthenticatedGeocode: 'NOT_RUN', matchedCache: Boolean(gable.geocodeControl?.status === 'success'),
    pointSource: gable.geocodeControl?.status === 'success' ? 'EXISTING_GEOCODE_CACHE' : 'EXISTING_STORED_PROPERTY_COORDINATES',
    unitAddressGeocodeFlow: 'PASS_WITH_INJECTED_EXISTING_GEOCODER' };
  await save('gable-public-parcel.json', gable);
} finally { await server.close(); }

// Discovery assistance only. A high score NEVER clears a license or activates a source.
function inspectDiscoverySource(source, schema) {
  const mappedFields = Object.fromEntries(Object.entries(source.fieldMapping).map(([concept, field]) => [concept, schema.fields.some(candidate => candidate.name === field)]));
  const geometry = schema.geometry === 'esriGeometryPolygon';
  const querySupport = /query/i.test(schema.capabilities || '');
  return { authority: source.authorityName, authorityUrl: source.authorityUrl, geometry, querySupport, mappedFields,
    lastUpdatePolicy: source.sourceFreshness, licenseStatus: source.licenseStatus, licenseUrl: source.licenseUrl,
    assistanceScore: (geometry ? 30 : 0) + (querySupport ? 30 : 0) + Math.min(40, Object.values(mappedFields).filter(Boolean).length * 5),
    automaticActivation: false };
}
