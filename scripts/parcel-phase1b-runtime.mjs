import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

if (!process.argv.includes('--live') || process.env.NODE_ENV === 'production') throw new Error('EXPLICIT_LOCAL_DIAGNOSTICS_ONLY');
const output = 'qa/public-parcel-intelligence';
await mkdir(output, { recursive: true });
async function save(name, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  for (let attempt = 0; ; attempt++) {
    try { await writeFile(`${output}/${name}`, text); return; }
    catch (error) { if (attempt >= 3) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
}
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: { usePolling: false } }, appType: 'custom' });
const cases = [
  ['us-al-jefferson-parcels', '01073', 'Jefferson', 33.6528268892837, -86.664736200637],
  ['us-nc-wake-parcels', '37183', 'Wake', 35.7796, -78.6382],
  ['us-wa-king-parcels', '53033', 'King', 47.61, -122.33],
  ['us-ut-salt-lake-parcels', '49035', 'Salt Lake', 40.7608, -111.8910],
  ['us-ca-sonoma-parcels', '06097', 'Sonoma', 38.4404, -122.7141],
  ['us-ma-massgis-parcels', '25017', 'Middlesex', 42.3736, -71.1097, 'Cambridge'],
  ['us-ma-massgis-parcels', '25025', 'Suffolk', 42.3570, -71.0620, 'Boston'],
  ['us-nj-njogis-parcels', '34021', 'Mercer', 40.2206, -74.7597, 'Trenton'],
  ['us-nj-njogis-parcels', '34003', 'Bergen', 40.8859, -74.0435, 'Hackensack'],
  ['us-vt-vcgi-parcels', '50007', 'Chittenden', 44.4780, -73.2130, 'Burlington'],
  ['us-vt-vcgi-parcels', '50023', 'Washington', 44.2601, -72.5754, 'Montpelier'],
  ['us-ny-state-public-parcels', '36001', 'Albany', 42.6510, -73.7550, 'Albany'],
  ['us-ny-state-public-parcels', '36067', 'Onondaga', 43.0481, -76.1474, 'Syracuse'],
  ['us-nc-nconemap-parcels', '37183', 'Wake', 35.7796, -78.6382, 'Raleigh'],
  ['us-nc-nconemap-parcels', '37063', 'Durham', 35.9940, -78.8986, 'Durham'],
  ['us-fl-dep-public-parcels', '12105', 'Polk', 28.0395, -81.9498, 'Lakeland'],
  ['us-fl-dep-public-parcels', '12095', 'Orange', 28.5383, -81.3792, 'Orlando'],
  ['us-fl-fgio-state-parcels', '12105', 'Polk', 28.0395, -81.9498, 'Lakeland'],
  ['us-fl-fgio-state-parcels', '12095', 'Orange', 28.5383, -81.3792, 'Orlando'],
  ['us-tx-austin-travis-parcels', '48453', 'Travis', 30.2672, -97.7431],
  ['us-tx-harris-parcels', '48201', 'Harris', 29.7604, -95.3698],
];
try {
  const { PARCEL_SOURCES, ParcelSourceRegistry, productionSourceAllowed } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/registry.ts');
  const { ArcGISParcelAdapter } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/arcgis.ts');
  const { PublicParcelResolver } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/resolver.ts');
  const { PublicCountyResolver } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/county.ts');
  const { ParcelRequestCache } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/cache.ts');
  const { geometryContains } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/geometry.ts');
  const filter = process.argv.find(value => value.startsWith('--sources='))?.split('=')[1]?.split(',');
  const rows = filter ? await readFile(`${output}/phase1b-source-inspection.json`, 'utf8').then(JSON.parse, () => []) : [];
  for (const [sourceId, countyFips, county, lat, lng, city] of cases.filter(([id]) => !filter || filter.includes(id))) {
    const source = PARCEL_SOURCES.find(source => source.sourceId === sourceId);
    const record = { sourceId, state: source.state, county, countyFips, authority: source.authorityName, authorityUrl: source.authorityUrl,
      observedAt: new Date().toISOString(), licenseStatus: source.licenseStatus, status: source.status, statusReason: source.statusReason,
      productionSourceAllowed: productionSourceAllowed(source), automaticActivation: false, mappedFieldAvailability: {} };
    const index = rows.findIndex(row => row.sourceId === sourceId && row.countyFips === countyFips);
    try {
      let requests = 0; let outage = false; let clock = Date.now();
      const fetcher = (...args) => { if (outage) throw new Error('SIMULATED_SOURCE_OUTAGE'); requests++; return fetch(...args); };
      const adapter = new ArcGISParcelAdapter(source, fetcher);
      const metadata = await adapter.inspect();
      record.schema = { name: metadata.name, geometryType: metadata.geometryType, capabilities: metadata.capabilities,
        formats: metadata.supportedQueryFormats, maxRecordCount: metadata.maxRecordCount, editingInfo: metadata.editingInfo || null,
        fields: metadata.fields.map(({ name, alias, type }) => ({ name, alias, type })) };
      for (const [concept, field] of Object.entries(source.fieldMapping)) record.mappedFieldAvailability[concept] = metadata.fields.some(candidate => candidate.name === field);
      record.technicalScore = 40 + 30 + Math.min(30, Object.values(record.mappedFieldAvailability).filter(Boolean).length * 5);
      if (source.state === 'TX') {
        record.recordQueries = 'NOT_RUN_LICENSE_REVIEW';
      } else {
        const bounds = [lng - .0008, lat - .0006, lng + .0008, lat + .0006];
        const seed = await adapter.queryByBounds(bounds);
        const parcel = seed.parcels.find(item => item.geometry && item.apn);
        if (!parcel) throw new Error('NO_SEED_PARCEL_IN_BOUNDED_VIEWPORT');
        const ring = parcel.geometry.type === 'MultiPolygon' ? parcel.geometry.coordinates[0][0] : parcel.geometry.coordinates[0];
        const xs = ring.map(p => p[0]); const ys = ring.map(p => p[1]);
        const candidates = [{ lng: xs.reduce((a, b) => a + b, 0) / xs.length, lat: ys.reduce((a, b) => a + b, 0) / ys.length }];
        for (let x = 1; x <= 9; x++) for (let y = 1; y <= 9; y++) candidates.push({ lng: Math.min(...xs) + x / 10 * (Math.max(...xs) - Math.min(...xs)), lat: Math.min(...ys) + y / 10 * (Math.max(...ys) - Math.min(...ys)) });
        const point = candidates.find(point => geometryContains(parcel.geometry, point));
        if (!point) throw new Error('NO_INTERIOR_POINT');
        const cache = new ParcelRequestCache(() => clock, 5000, 7 * 86400000);
        const counties = new PublicCountyResolver();
        // Same normal resolver/adapter. Review-source inspection is explicitly local.
        const resolver = new PublicParcelResolver({ registry: new ParcelSourceRegistry([source]), diagnostics: !productionSourceAllowed(source), cache,
          providerFactory: () => adapter, resolveCounty: (p, signal) => counties.resolve(p, signal), resolveBoundsCounties: (b, signal) => counties.resolveBounds(b, signal),
          geocode: async address => {
            // Same first public provider as geocode-address; no property write or
            // impersonation of a production user's authenticated session.
            const query = [address.address, address.city, address.state, 'USA'].filter(Boolean).join(', ');
            try {
              const data = await fetch('https://nominatim.openstreetmap.org/search?' + new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'us', limit: '1' }), {
                headers: { 'User-Agent': 'DealSifter/1.0 (internal parcel validation)' }, signal: AbortSignal.timeout(12000),
              }).then(response => response.ok ? response.json() : []);
              const match = data[0];
              if (match && Number.isFinite(Number(match.lat)) && Number.isFinite(Number(match.lon))) {
                record.addressGeocode = { provider: 'NOMINATIM_PUBLIC', address, matchedAddress: match.display_name, productionGeocodeEndpoint: 'NOT_RUN_NO_AUTHENTICATED_SESSION' };
                return { lat: Number(match.lat), lng: Number(match.lon) };
              }
            } catch { /* Existing public fallback, not a paid provider. */ }
            const url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + new URLSearchParams({ address: [address.address, address.city, address.state].filter(Boolean).join(', '), benchmark: 'Public_AR_Current', format: 'json' });
            const data = await fetch(url, { signal: AbortSignal.timeout(12000) }).then(response => response.json());
            const match = data.result?.addressMatches?.[0]; record.addressGeocode = { provider: 'CENSUS_PUBLIC', address, matchedAddress: match?.matchedAddress || null, productionGeocodeEndpoint: 'NOT_RUN_NO_AUTHENTICATED_SESSION' };
            return match ? { lat: match.coordinates.y, lng: match.coordinates.x } : null;
          } });
        record.controlPoint = point;
        await new Promise(resolve => setTimeout(resolve, 1600));
        record.point = await resolver.resolve({ operation: 'query-point', point, countyFips });
        const before = requests;
        const repeat = await resolver.resolve({ operation: 'query-point', point, countyFips });
        record.repeat = { ...repeat, parcels: undefined, count: repeat.parcels.length };
        record.cacheProof = { firstMiss: !record.point.cacheHit, secondHit: repeat.cacheHit, repeatedSourceRequests: requests - before };
        clock += 2000; await new Promise(resolve => setTimeout(resolve, 1600));
        record.viewport = await resolver.resolve({ operation: 'query-bounds', bounds, zoom: 18, countyFips });
        // Courtesy reservation is intentionally shared across operations.
        clock += 2000; await new Promise(resolve => setTimeout(resolve, 1600));
        record.apn = await resolver.resolve({ operation: 'query-apn', apn: parcel.apn, countyFips });
        record.apnParity = record.apn.parcels.some(item => item.apn === parcel.apn);
        if (city && productionSourceAllowed(source) && parcel.situsAddress) {
          clock += 2000; await new Promise(resolve => setTimeout(resolve, 1600));
          record.address = await resolver.resolve({ operation: 'resolve', address: { address: parcel.situsAddress, city, state: source.state } });
        }
        // Isolated outage simulation over REAL cached source records, not fake parcel data.
        clock += 8000; outage = true;
        record.outage = await resolver.resolve({ operation: 'query-point', point, countyFips });
        outage = false;
        record.health = Object.fromEntries(cache.health);
        record.normalizationPass = record.point.status === 'COVERAGE_AVAILABLE' && record.point.parcels.some(item => item.geometry && item.apn);
        record.areaComparisons = record.point.parcels.map(item => ({ apn: item.apn, assessorAcres: item.assessorAcres, gisAcres: item.gisAcres, geometryCalculatedAcres: item.geometryCalculatedAcres, crossCheck: item.areaCrossCheck }));
      }
    } catch (error) { record.error = error.message; record.normalizationPass = false; }
    if (index < 0) rows.push(record); else rows[index] = record;
    await save('phase1b-source-inspection.json', rows);
    console.log(JSON.stringify({ sourceId, countyFips, active: record.productionSourceAllowed, point: record.point?.status, apn: record.apnParity, viewport: record.viewport?.status, error: record.error }));
  }
  await save('source-registry-expanded.json', PARCEL_SOURCES);
} finally { await server.close(); }
