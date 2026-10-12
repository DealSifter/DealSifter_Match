import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

// Development-only assistance. Discovery NEVER edits or activates the runtime registry.
if (!process.argv.includes('--live') || process.env.NODE_ENV === 'production') throw new Error('EXPLICIT_LOCAL_DIAGNOSTICS_ONLY');
const output = 'qa/public-parcel-intelligence';
await mkdir(output, { recursive: true });
const save = (name, value) => writeFile(`${output}/${name}`, JSON.stringify(value, null, 2) + '\n');
const options = new Map(process.argv.slice(2).filter(value => value.includes('=')).map(value => value.split('=')));
const queries = options.has('--county') ? [`${options.get('--county')} parcels ${options.get('--state') || ''}`] : [
  'owner:JeffersonCountyALgis parcels', 'owner:WakeCountyGovernment parcels', 'owner:MassGIS parcels',
  'owner:NJOGIS parcels', 'owner:Services_VCGI parcels', 'owner:nconemap parcels',
  'owner:UtahAGRC parcels', 'FloridaGIO parcels 2026', 'owner:CTM.Publisher tcad parcel',
];
const server = await createServer({ optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: { usePolling: false } }, appType: 'custom' });
try {
  const { boundedJson } = await server.ssrLoadModule('/supabase/functions/_shared/public-parcel/arcgis.ts');
  const results = [];
  for (const query of queries) {
    try {
      const data = await boundedJson(`https://www.arcgis.com/sharing/rest/search?${new URLSearchParams({ f: 'json', q: query, num: '8' })}`, fetch, undefined, 15000);
      const candidates = [];
      for (const item of (data.results || []).filter(item => /(?:Feature|Map) Service/.test(item.type)).slice(0, 4)) {
        const detail = await boundedJson(`https://www.arcgis.com/sharing/rest/content/items/${item.id}?f=json`, fetch, undefined, 15000);
        const candidate = { itemId: item.id, title: item.title, publisher: item.owner, serviceUrl: item.url,
          authorityHint: detail.accessInformation || null, licenseLink: `https://www.arcgis.com/home/item.html?id=${item.id}`,
          termsSummary: String(detail.licenseInfo || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 2100),
          authorityVerified: false, status: 'DISCOVERED', automaticActivation: false };
        // Only HTTPS public ArcGIS service metadata. Private literals, userinfo and arbitrary paths rejected.
        const url = new URL(item.url);
        if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
          && /^(?:services\d*\.arcgis\.com|[a-z0-9-]+\.(?:gov|us))$/i.test(url.hostname)
          && /\/(?:FeatureServer|MapServer)(?:\/\d+)?$/i.test(url.pathname)) {
          try {
            const schema = await boundedJson(`${url.href}?f=json`, fetch, undefined, 15000);
            candidate.schemaAssessment = { geometry: schema.geometryType || null, fields: schema.fields?.map(field => field.name) || [],
              layers: schema.layers?.map(layer => ({ id: layer.id, name: layer.name })) || [], query: /\bQuery\b/i.test(schema.capabilities || ''),
              updatedAt: schema.editingInfo?.lastEditDate || null };
            candidate.technicalScore = (schema.geometryType === 'esriGeometryPolygon' ? 40 : 0) + (/\bQuery\b/i.test(schema.capabilities || '') ? 30 : 0) + (schema.fields?.length ? 30 : 0);
          } catch (error) { candidate.technicalError = error.message; }
        }
        candidates.push(candidate);
      }
      results.push({ query, total: data.total, candidates });
    } catch (error) { results.push({ query, error: error.message }); }
    console.log(JSON.stringify({ query, candidates: results.at(-1).candidates?.length || 0 }));
  }
  await save(options.has('--county') ? 'county-discovery-assistance.json' : 'phase1b-discovery.json', { observedAt: new Date().toISOString(), requestedFips: options.get('--fips') || null,
    mode: 'LOCAL_OFFICIAL_CANDIDATE_ASSISTANCE', authorityRequiresManualReview: true, legalApprovalFromScore: false, automaticActivation: false, results });
} finally { await server.close(); }
