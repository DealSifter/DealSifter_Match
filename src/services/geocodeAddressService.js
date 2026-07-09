import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const toText = (value) => String(value || '').trim();

export function propertyNeedsBackendGeocode(property = {}) {
  const lat = Number(property?.lat);
  const lng = Number(property?.lng);
  const status = toText(property?.geocodeStatus || property?.geocode_status).toLowerCase();
  const source = toText(property?.geocodeSource || property?.geocode_source).toLowerCase();
  if (source === 'manual') return false;
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0 && status === 'resolved') return false;
  return Boolean(
    toText(property?.address)
    || toText(property?.city)
    || toText(property?.state)
    || toText(property?.zip)
  );
}

export async function geocodePropertyAddress(property = {}) {
  if (!isSupabaseConfigured || !supabase) return null;
  if (!propertyNeedsBackendGeocode(property)) return null;
  const { data, error } = await supabase.functions.invoke('geocode-address', {
    body: {
      propertyId: toText(property.id || property.propertyId || property.property_id),
      address: toText(property.address),
      city: toText(property.city),
      state: toText(property.state),
      zip: toText(property.zip),
    },
  });
  if (error) throw error;
  if (!data || data.status !== 'success') return data || null;
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return data;
  return {
    lat,
    lng,
    geocodeStatus: 'resolved',
    geocodeSource: data.provider_used || 'geocode-address',
    geocodeConfidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : null,
    geocodeInput: data.normalized_address || '',
    geocodedAt: new Date().toISOString(),
  };
}
