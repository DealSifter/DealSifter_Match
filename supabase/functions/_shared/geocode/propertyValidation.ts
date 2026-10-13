type Property = Record<string, unknown>;
const text = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export function coordinate(value: unknown): number | null {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function validPoint(lat: unknown, lng: unknown): boolean {
  const y = coordinate(lat); const x = coordinate(lng);
  return y !== null && x !== null && y !== 0 && x !== 0 && Math.abs(y) <= 85 && Math.abs(x) <= 180;
}
export function propertyAddressKey(property: Property): string {
  return [property.address, property.city, property.state, property.zip].map(text).join('|');
}
export function hasValidPropertyGeocode(property: Property = {}): boolean {
  const status = text(property.geocodeStatus ?? property.geocode_status);
  const source = text(property.geocodeSource ?? property.geocode_source);
  const at = property.geocodedAt ?? property.geocoded_at;
  if (!['resolved', 'manual'].includes(status) || !source || !at || !Number.isFinite(Date.parse(String(at)))) return false;
  // The authenticated public inventory attests validity without exposing private coordinates.
  if (property.geocodeValid === true && (property.hideStreetAddressOnCard === true || property.hide_street_address_on_card === true)) return true;
  return validPoint(property.lat, property.lng);
}
export function invalidateChangedPropertyAddress(previous: Property, next: Property): Property {
  if (propertyAddressKey(previous) === propertyAddressKey(next)) return next;
  return { ...next, lat: null, lng: null, geocodeStatus: 'pending', geocodeSource: '', geocodeInput: '',
    geocodeConfidence: null, geocodedAt: null, geocodeValid: false, isActive: false, publishToShowcase: false };
}
