import { propertyAddressFingerprint } from './address.ts';
import type { InternalPropertyRecord } from './propertyEvidenceTypes.ts';
export async function matchesCachedSubject(property: InternalPropertyRecord, subject: {
  addressLine1: { value: unknown }; city: { value: unknown }; state: { value: unknown }; zipCode: { value: unknown };
  latitude?: { value: unknown }; longitude?: { value: unknown };
}) {
  try {
    const expected = await propertyAddressFingerprint({ street: property.address || '', city: property.city || '', state: property.state || '', zipCode: property.zip || '' });
    const actual = await propertyAddressFingerprint({ street: String(subject.addressLine1.value || ''), city: String(subject.city.value || ''), state: String(subject.state.value || ''), zipCode: String(subject.zipCode.value || '') });
    if (actual !== expected) return false;
    const lat = property.lat, lng = property.lng, otherLat = subject.latitude?.value, otherLng = subject.longitude?.value;
    if (lat != null && lng != null && otherLat != null && otherLng != null) {
      if (![lat, lng, otherLat, otherLng].every(value => Number.isFinite(Number(value)))) return false;
      const distanceKm = Math.hypot((Number(lat) - Number(otherLat)) * 111,
        (Number(lng) - Number(otherLng)) * 111 * Math.cos(Number(lat) * Math.PI / 180));
      if (distanceKm > 0.25) return false;
    }
    return true;
  } catch { return false; }
}
