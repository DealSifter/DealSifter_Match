import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/maxxis/config.ts';
import { resolveFeatureFlags } from '../_shared/featureFlags.ts';
import { PublicParcelResolver, validateParcelQuery } from '../_shared/public-parcel/resolver.ts';
import { ParcelRequestCache } from '../_shared/public-parcel/cache.ts';
import { PublicCountyResolver } from '../_shared/public-parcel/county.ts';
import { ArcGISParcelAdapter } from '../_shared/public-parcel/arcgis.ts';
import type { ProviderResult } from '../_shared/public-parcel/types.ts';
import { parcelOperationAllowed } from '../_shared/public-parcel/lens.ts';
import { createParcelUpstreamFetch } from '../_shared/public-parcel/upstreamBudget.ts';

const url = Deno.env.get('SUPABASE_URL') || '';
const anon = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('ANON_KEY') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || '';
const environment = url.includes('cyeipfskwwisbbayyaca') ? 'production' : url.includes('oqdcnjupquhybwdbeeew') ? 'staging' : 'development';
const ttlHours = Math.max(1, Math.min(72, Number(Deno.env.get('PARCEL_CACHE_TTL_HOURS')) || 24));
const cache = new ParcelRequestCache<ProviderResult>(() => Date.now(), ttlHours * 3600_000);
const admin = serviceKey ? createClient(url, serviceKey) : null;
const publicFetcher = createParcelUpstreamFetch(async (subject,signal) => {
  if(!admin) return false;
  const query=admin.rpc('ds_consume_edge_rate_limit',{p_subject_id:subject,p_operation:'public_parcel_upstream',p_window_seconds:60,p_max_requests:40});
  const result=signal?await query.abortSignal(signal):await query;
  const decision=Array.isArray(result.data)?result.data[0]:result.data;
  return !result.error&&decision?.allowed===true;
});
const counties = new PublicCountyResolver(publicFetcher);
const providers = new Map<string, ArcGISParcelAdapter>();
function reply(value: unknown, status: number, origin: string) {
  return new Response(JSON.stringify(value), { status, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
function remoteFlags() { try { return JSON.parse(Deno.env.get('FEATURE_FLAGS_JSON') || '{}'); } catch { return {}; } }
Deno.serve(async req => {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || !url || !anon) return reply({ error: 'UNAUTHORIZED' }, 401, origin);
  const client = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return reply({ error: 'UNAUTHORIZED' }, 401, origin);
  // No request override: default OFF; activation needs explicit approved server configuration.
  const flags = resolveFeatureFlags({ userId: user.id, environment, remoteConfig: remoteFlags() });
  if (!flags.public_parcel_intelligence) return reply({ status: 'DISABLED', parcels: [], reason: 'FEATURE_FLAG_OFF' }, 200, origin);
  try {
    if (Number(req.headers.get('content-length')) > 4096) return reply({ error: 'QUERY_TOO_LARGE' }, 413, origin);
    const reader = req.body?.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
    if (!reader) return reply({ error: 'INVALID_QUERY' }, 400, origin);
    while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length;
      if (bytes > 4096) { await reader.cancel(); return reply({ error: 'QUERY_TOO_LARGE' }, 413, origin); } chunks.push(chunk.value); }
    const body = new Uint8Array(bytes); let offset = 0; chunks.forEach(chunk => { body.set(chunk, offset); offset += chunk.length; });
    const input = new TextDecoder().decode(body);
    let parsed: unknown;
    try { parsed = JSON.parse(input); } catch { return reply({ error: 'INVALID_QUERY_JSON' }, 400, origin); }
    const query = validateParcelQuery(parsed);
    if (!parcelOperationAllowed(query.operation, flags)) return reply({ status: 'DISABLED', parcels: [], reason: 'INTERNAL_GRID_ONLY' }, 200, origin);
    if (!serviceKey) return reply({ error: 'RATE_LIMIT_UNAVAILABLE' }, 503, origin);
    const limit = await admin!.rpc('ds_consume_edge_rate_limit', { p_subject_id: user.id, p_operation: 'public_parcel', p_window_seconds: 60, p_max_requests: 20 });
    const decision = Array.isArray(limit.data) ? limit.data[0] : limit.data;
    if (limit.error || decision?.allowed !== true) return reply({ error: limit.error ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED' }, limit.error ? 503 : 429, origin);
    const resolver = new PublicParcelResolver({ cache,
      resolveCounty: (point, signal) => counties.resolve(point, signal),
      resolveBoundsCounties: (bounds, signal) => counties.resolveBounds(bounds, signal),
      providerFactory: source => { let adapter = providers.get(source.sourceId); if (!adapter) { adapter = new ArcGISParcelAdapter(source, publicFetcher); providers.set(source.sourceId, adapter); } return adapter; },
      logger: event => console.log(JSON.stringify({ event: 'public_parcel', ...event })),
      geocode: async (address, signal) => {
        // Reuse existing geocoder/cache. Omitting propertyId prevents property mutations.
        const response = await fetch(`${url}/functions/v1/geocode-address`, { method: 'POST', signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(12000)]),
          headers: { Authorization: `Bearer ${token}`, apikey: anon, 'Content-Type': 'application/json' }, body: JSON.stringify(address) });
        const data = await response.json(); return response.ok && data.status === 'success' ? { lat: Number(data.lat), lng: Number(data.lng) } : null;
      },
    });
    return reply(await resolver.resolve({ ...query, signal: req.signal }), 200, origin);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'QUERY_FAILED';
    return reply({ error: /^(INVALID|UNKNOWN|POINT_REQUIRED|BOUNDS_REQUIRED)/.test(code) ? code : 'PARCEL_QUERY_UNAVAILABLE' }, /^(INVALID|UNKNOWN|POINT_REQUIRED|BOUNDS_REQUIRED)/.test(code) ? 400 : 503, origin);
  }
});
