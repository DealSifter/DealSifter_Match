import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
export function validateCensusMatch(property, match) {
  const expected = [property.address, property.city, property.state, property.zip].map(clean).join(', ');
  if (clean(match?.matchedAddress) !== expected) throw new Error('ADDRESS_MATCH_NOT_EXACT');
  const point = match?.coordinates;
  if (typeof point?.y !== 'number' || typeof point?.x !== 'number' || !Number.isFinite(point.y) || !Number.isFinite(point.x)
    || point.y < 24 || point.y > 50 || point.x < -125 || point.x > -66) throw new Error('INVALID_CENSUS_POINT');
  if (clean(match?.addressComponents?.city) !== clean(property.city) || clean(match?.addressComponents?.state) !== clean(property.state)
    || clean(match?.addressComponents?.zip) !== clean(property.zip)) throw new Error('ADDRESS_COMPONENT_MISMATCH');
  return { lat: point.y, lng: point.x };
}

export function repairScope(property) {
  if (!property?.id || !property?.owner_id || property.lat !== null || property.lng !== null || property.geocode_status !== 'pending') {
    throw new Error('REPAIR_REQUIRES_EXISTING_PENDING_PROPERTY_WITHOUT_COORDINATES');
  }
  return new URLSearchParams({ id: `eq.${property.id}`, owner_id: `eq.${property.owner_id}`, address: `eq.${property.address}`,
    city: `eq.${property.city}`, state: `eq.${property.state}`, zip: `eq.${property.zip}`, lat: 'is.null', lng: 'is.null', geocode_status: 'eq.pending' });
}

async function main() {
  const propertyId = process.argv.find(arg => arg.startsWith('--property='))?.slice(11);
  if (!/^[a-f0-9-]{36}$/i.test(propertyId || '')) throw new Error('EXPLICIT_PROPERTY_UUID_REQUIRED');
  const apply = process.argv.includes('--apply');
  const env = Object.fromEntries((await readFile('.env.local', 'utf8')).split(/\r?\n/).filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')]; }));
  const base = env.SUPABASE_URL || env.VITE_SUPABASE_URL; const key = env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (base !== 'https://cyeipfskwwisbbayyaca.supabase.co' || !key) throw new Error('PROJECT_SCOPED_MAINTENANCE_CONFIG_REQUIRED');
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const db = async (table, query, options = {}) => {
    const response = await fetch(`${base}/rest/v1/${table}?${query}`, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`SCOPED_DATABASE_${response.status}`);
    const body = await response.text();
    return body.trim() ? JSON.parse(body) : null;
  };
  const columns = 'id,owner_id,address,city,state,zip,lat,lng,geocode_status,geocode_source,geocoded_at,is_active,publish_to_showcase,hide_street_address_on_card';
  const [property] = await db('properties', new URLSearchParams({ select: columns, id: `eq.${propertyId}`, limit: '1' }));
  const scope = repairScope(property);
  const query = new URLSearchParams({ format: 'json', benchmark: 'Public_AR_Current', street: property.address, city: property.city, state: property.state, zip: property.zip });
  const response = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/address?${query}`, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`CENSUS_HTTP_${response.status}`);
  const result = await response.json(); const matches = result.result?.addressMatches;
  if (!Array.isArray(matches) || matches.length !== 1) throw new Error('UNIQUE_CENSUS_ADDRESS_MATCH_REQUIRED');
  const point = validateCensusMatch(property, matches[0]);
  const normalized = [property.address, property.city, property.state, property.zip, 'USA'].join(', ');
  let verified = null;
  if (apply) {
    const cache = { address_hash: createHash('sha256').update(`property-address-v1|${normalized}`.toLowerCase()).digest('hex'), normalized_address: normalized,
      ...point, provider_used: 'census', confidence: .92, status: 'success', error: null };
    await db('geocode_cache', new URLSearchParams({ on_conflict: 'address_hash' }), {
      method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(cache),
    });
    const update = { ...point, geocode_status: 'resolved', geocode_source: 'census', geocode_confidence: .92, geocode_input: normalized, geocoded_at: new Date().toISOString() };
    const changed = await db('properties', scope, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(update) });
    if (!Array.isArray(changed) || changed.length !== 1) throw new Error('CONCURRENT_PROPERTY_CHANGE_REPAIR_NOT_APPLIED');
    const [after] = await db('properties', new URLSearchParams({ select: columns, id: `eq.${propertyId}`, limit: '1' }));
    if (after?.lat !== point.lat || after?.lng !== point.lng || after?.geocode_status !== 'resolved' || after?.address !== property.address
      || after?.owner_id !== property.owner_id || after?.is_active !== property.is_active || after?.publish_to_showcase !== property.publish_to_showcase
      || after?.hide_street_address_on_card !== property.hide_street_address_on_card) throw new Error('POST_REPAIR_VERIFICATION_FAILED');
    verified = { lat: after.lat, lng: after.lng, status: after.geocode_status, source: after.geocode_source, isActive: after.is_active,
      published: after.publish_to_showcase, addressHidden: after.hide_street_address_on_card, ownershipUnchanged: true };
  }
  const receipt = { observedAt: new Date().toISOString(), mode: apply ? 'APPLIED_ONE_GUARDED_PROPERTY' : 'DRY_RUN_NO_DATABASE_WRITES', propertyId,
    address: normalized, before: { lat: property.lat, lng: property.lng, status: property.geocode_status }, matchedAddress: matches[0].matchedAddress,
    coordinates: point, source: 'US Census Public_AR_Current address match', precision: 'TIGER_STREET_ADDRESS_INTERPOLATION_NOT_SURVEY_OR_ROOFTOP',
    providerCalls: 1, paidProviderCalls: 0, after: verified };
  await mkdir('qa/geocode-wood-spring', { recursive: true });
  await writeFile(`qa/geocode-wood-spring/repair-${apply ? 'applied' : 'dry-run'}.json`, JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify(receipt));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
