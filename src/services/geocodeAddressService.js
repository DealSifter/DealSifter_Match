import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { coordinate, hasValidPropertyGeocode, validPoint } from '../../supabase/functions/_shared/geocode/propertyValidation.ts';

const toText = (value) => String(value || '').trim();

export function propertyNeedsBackendGeocode(property = {}) {
  if (hasValidPropertyGeocode(property)) return false;
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
  if (!data || data.status !== 'success' || !validPoint(data.lat, data.lng)) {
    return { lat: null, lng: null, geocodeStatus: 'failed', geocodeSource: '', geocodedAt: null, geocodeValid: false };
  }
  const lat = coordinate(data.lat);
  const lng = coordinate(data.lng);
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

export async function validatePortfolioProperty(property, geocode = geocodePropertyAddress) {
  let next = property;
  try { next = { ...property, ...await geocode(property) }; }
  catch { next = { ...property, lat: null, lng: null, geocodeStatus: 'pending', geocodeSource: '', geocodedAt: null, geocodeValid: false }; }
  const valid = hasValidPropertyGeocode(next);
  return { ...next, isActive: valid, publishToShowcase: valid && property.publishToShowcase === true };
}
