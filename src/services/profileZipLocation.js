const cache = new Map();
const pending = new Map();

export const normalizeProfileZip = (value) => String(value ?? '').trim();

export function getProfileZipLocation(value) {
  if (!value || !/^\d{5}$/.test(normalizeProfileZip(value.zip))) return null;
  if (value.source !== 'zippopotamus' || !/^[A-Z]{2}$/.test(value.state || '')) return null;
  if (value.lat == null || value.lng == null || value.lat === '' || value.lng === '') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 85 || Math.abs(lng) > 180) return null;
  return { ...value, lat, lng };
}

// ZIP-level coordinates only: never substitute a state center or a street address.
export async function lookupProfileZip(value, fetchImpl = fetch) {
  const zip = normalizeProfileZip(value);
  if (!/^\d{5}$/.test(zip)) throw new Error('INVALID_ZIP');
  if (cache.has(zip)) return cache.get(zip);
  if (pending.has(zip)) return pending.get(zip);
  const request = (async () => {
    const response = await fetchImpl(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(10000) });
    if (response.status === 404) throw new Error('ZIP_NOT_FOUND');
    if (!response.ok) throw new Error('ZIP_LOOKUP_UNAVAILABLE');
    const data = await response.json();
    const place = data?.places?.[0];
    const location = getProfileZipLocation({
      zip: data?.['post code'],
      state: place?.['state abbreviation'],
      city: String(place?.['place name'] || ''),
      lat: place?.latitude,
      lng: place?.longitude,
      source: 'zippopotamus',
    });
    if (data?.['country abbreviation'] !== 'US' || location?.zip !== zip) throw new Error('ZIP_NOT_FOUND');
    cache.set(zip, location);
    return location;
  })();
  pending.set(zip, request);
  try { return await request; }
  finally { pending.delete(zip); }
}
