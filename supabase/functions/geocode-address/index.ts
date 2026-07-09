import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseAnonKey = Deno.env.get('ANON_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const supabaseServiceRoleKey =
  Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');
if (!supabaseServiceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type GeocodeStatus = 'success' | 'pending' | 'failed';

type LocationInput = {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  text?: string;
  propertyId?: string;
};

type GeocodeResult = {
  lat: number | null;
  lng: number | null;
  status: GeocodeStatus;
  provider_used?: string | null;
  confidence?: number | null;
  normalized_address?: string;
  error?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAuthenticatedUser(authHeader: string) {
  const accessToken = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) return { user: null, error: 'Missing bearer token' };
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return { user: null, error: String(error?.message || 'Invalid user session') };
  return { user, error: null };
}

function clean(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function normalizeAddress(input: LocationInput) {
  const text = clean(input.text);
  if (text) return text;
  return [
    clean(input.address),
    clean(input.city),
    clean(input.state),
    clean(input.zip),
    'USA',
  ].filter(Boolean).join(', ');
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value.toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseNumber(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function success(lat: unknown, lng: unknown, provider: string, confidence = 0.75): GeocodeResult | null {
  const parsedLat = parseNumber(lat);
  const parsedLng = parseNumber(lng);
  if (parsedLat == null || parsedLng == null) return null;
  if (parsedLat < -85 || parsedLat > 85 || parsedLng < -180 || parsedLng > 180) return null;
  return {
    lat: parsedLat,
    lng: parsedLng,
    status: 'success',
    provider_used: provider,
    confidence,
  };
}

async function fetchJson(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeNominatim(input: LocationInput, normalizedAddress: string) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    countrycodes: 'us',
  });
  if (input.address || input.city || input.state || input.zip) {
    if (input.address) params.set('street', clean(input.address));
    if (input.city) params.set('city', clean(input.city));
    if (input.state) params.set('state', clean(input.state));
    if (input.zip) params.set('postalcode', clean(input.zip));
  } else {
    params.set('q', normalizedAddress);
  }
  const data = await fetchJson(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'DealSifter/1.0 (https://dealsiftermatch.vercel.app)',
    },
  });
  const first = Array.isArray(data) ? data[0] : null;
  const importance = Number(first?.importance ?? 0.65);
  return first ? success(first.lat, first.lon, 'nominatim', Math.max(0.45, Math.min(0.93, importance))) : null;
}

async function geocodeCensus(input: LocationInput) {
  if (!input.address) return null;
  const params = new URLSearchParams({
    format: 'json',
    benchmark: 'Public_AR_Current',
    street: clean(input.address),
  });
  if (input.city) params.set('city', clean(input.city));
  if (input.state) params.set('state', clean(input.state));
  if (input.zip) params.set('zip', clean(input.zip));
  const data = await fetchJson(`https://geocoding.geo.census.gov/geocoder/locations/address?${params.toString()}`);
  const match = data?.result?.addressMatches?.[0];
  return match ? success(match?.coordinates?.y, match?.coordinates?.x, 'census', 0.92) : null;
}

async function geocodePhoton(normalizedAddress: string) {
  const params = new URLSearchParams({ q: normalizedAddress, limit: '1' });
  const data = await fetchJson(`https://photon.komoot.io/api/?${params.toString()}`);
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  return Array.isArray(coords) ? success(coords[1], coords[0], 'photon', 0.65) : null;
}

async function geocodeArcGis(input: LocationInput, normalizedAddress: string) {
  const params = new URLSearchParams({
    f: 'pjson',
    outFields: '*',
    maxLocations: '1',
    countryCode: 'USA',
  });
  if (input.address) {
    params.set('Address', clean(input.address));
    if (input.city) params.set('City', clean(input.city));
    if (input.state) params.set('Region', clean(input.state));
    if (input.zip) params.set('Postal', clean(input.zip));
  } else {
    params.set('SingleLine', normalizedAddress);
  }
  const data = await fetchJson(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params.toString()}`);
  const candidate = data?.candidates?.[0];
  return candidate ? success(candidate?.location?.y, candidate?.location?.x, 'arcgis', Math.min(0.99, Number(candidate?.score || 75) / 100)) : null;
}

async function geocodeWithProviders(input: LocationInput, normalizedAddress: string): Promise<GeocodeResult> {
  const providers = [
    () => geocodeNominatim(input, normalizedAddress),
    () => geocodeCensus(input),
    () => geocodePhoton(normalizedAddress),
    () => geocodeArcGis(input, normalizedAddress),
  ];
  for (const provider of providers) {
    const result = await provider();
    if (result?.status === 'success') return { ...result, normalized_address: normalizedAddress };
  }
  return { lat: null, lng: null, status: 'failed', normalized_address: normalizedAddress, error: 'No provider returned coordinates.' };
}

async function readCachedResult(addressHash: string): Promise<GeocodeResult | null> {
  const { data } = await supabaseAdmin
    .from('geocode_cache')
    .select('lat, lng, provider_used, status, confidence, normalized_address, error')
    .eq('address_hash', addressHash)
    .maybeSingle();
  if (!data) return null;
  if (data.status !== 'success') return {
    lat: null,
    lng: null,
    status: data.status || 'pending',
    provider_used: data.provider_used || null,
    confidence: data.confidence == null ? null : Number(data.confidence),
    normalized_address: data.normalized_address || '',
    error: data.error || undefined,
  };
  return {
    lat: parseNumber(data.lat),
    lng: parseNumber(data.lng),
    status: 'success',
    provider_used: data.provider_used || null,
    confidence: data.confidence == null ? null : Number(data.confidence),
    normalized_address: data.normalized_address || '',
  };
}

async function cacheResult(addressHash: string, normalizedAddress: string, result: GeocodeResult) {
  await supabaseAdmin
    .from('geocode_cache')
    .upsert({
      address_hash: addressHash,
      normalized_address: normalizedAddress,
      lat: result.lat,
      lng: result.lng,
      provider_used: result.provider_used || null,
      status: result.status,
      confidence: result.confidence ?? null,
      error: result.error || null,
    }, { onConflict: 'address_hash' });
}

async function updatePropertyIfAllowed(propertyId: string, userId: string, result: GeocodeResult) {
  if (!propertyId || result.status !== 'success' || result.lat == null || result.lng == null) return;
  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, owner_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (!property || String(property.owner_id) !== String(userId)) return;
  await supabaseAdmin
    .from('properties')
    .update({
      lat: result.lat,
      lng: result.lng,
      geocode_status: 'resolved',
      geocode_source: result.provider_used || 'geocode-address',
      geocode_confidence: result.confidence ?? null,
      geocode_input: result.normalized_address || null,
      geocoded_at: new Date().toISOString(),
    })
    .eq('id', propertyId)
    .eq('owner_id', userId);
}

async function geocodeAddress(input: LocationInput, userId: string): Promise<GeocodeResult> {
  const normalizedAddress = normalizeAddress(input);
  if (!normalizedAddress || normalizedAddress === 'USA') {
    return { lat: null, lng: null, status: 'pending', normalized_address: normalizedAddress };
  }
  const addressHash = await sha256Hex(normalizedAddress);
  const cached = await readCachedResult(addressHash);
  if (cached?.status === 'success') {
    await updatePropertyIfAllowed(clean(input.propertyId), userId, cached);
    return cached;
  }
  const result = await geocodeWithProviders(input, normalizedAddress);
  await cacheResult(addressHash, normalizedAddress, result);
  await updatePropertyIfAllowed(clean(input.propertyId), userId, result);
  return result;
}

async function requireAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();
  return Boolean(data?.is_admin);
}

async function backfillProperties(userId: string, limit: number) {
  const isAdmin = await requireAdmin(userId);
  if (!isAdmin) return { error: 'Forbidden', status: 403 };
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select('id, owner_id, address, city, state, zip')
    .or('lat.is.null,lng.is.null,geocode_status.eq.pending,geocode_status.is.null')
    .limit(Math.max(1, Math.min(50, limit || 10)));
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const results = [];
  for (const row of rows) {
    const result = await geocodeAddress({
      propertyId: row.id,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
    }, String(row.owner_id || userId));
    results.push({ property_id: row.id, status: result.status, provider_used: result.provider_used || null });
  }
  return { processed: results.length, results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { user, error: authError } = await getAuthenticatedUser(authHeader);
    if (authError || !user) return jsonResponse({ error: authError || 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    if (body?.backfill === true) {
      const result = await backfillProperties(user.id, Number(body.limit || 10));
      if ('status' in result && result.status === 403) return jsonResponse({ error: result.error }, 403);
      return jsonResponse(result as Record<string, unknown>);
    }

    const result = await geocodeAddress({
      propertyId: clean(body.propertyId || body.property_id),
      address: clean(body.address),
      city: clean(body.city),
      state: clean(body.state),
      zip: clean(body.zip),
      text: clean(body.text || body.location),
    }, user.id);

    return jsonResponse({
      lat: result.lat,
      lng: result.lng,
      status: result.status,
      provider_used: result.provider_used || null,
      confidence: result.confidence ?? null,
      normalized_address: result.normalized_address || null,
      error: result.error || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Geocoding failed');
    return jsonResponse({ error: message }, 500);
  }
});
