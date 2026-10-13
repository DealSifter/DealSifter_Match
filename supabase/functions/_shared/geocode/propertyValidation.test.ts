import { describe, expect, it } from 'vitest';
import { hasValidPropertyGeocode, invalidateChangedPropertyAddress, validPoint } from './propertyValidation';
import { addressMatches, censusAddressMatches } from './addressMatch';
const valid = { address: '1524 Wood Spring Ct', city: 'Raleigh', state: 'NC', zip: '27614',
  lat: 35.921133041392, lng: -78.583547577238, geocodeStatus: 'resolved', geocodeSource: 'census', geocodedAt: '2026-10-13T01:00:00Z', publishToShowcase: true };
describe('canonical property publication geocode', () => {
  it('accepts validated address and intentional manual location', () => {
    expect(hasValidPropertyGeocode(valid)).toBe(true);
    expect(hasValidPropertyGeocode({ ...valid, geocodeStatus: 'manual', geocodeSource: 'manual' })).toBe(true);
  });
  it.each([null, undefined, '', ' ', false, 0, NaN, Infinity, 86])('rejects invalid latitude %s', lat => {
    expect(validPoint(lat, valid.lng)).toBe(false);
  });
  it.each(['pending', 'failed', ''])('rejects nonvalidated status %s even with coordinates', geocodeStatus => {
    expect(hasValidPropertyGeocode({ ...valid, geocodeStatus })).toBe(false);
  });
  it('requires provenance, and preserves private card without exposing its PIN', () => {
    expect(hasValidPropertyGeocode({ ...valid, geocodeSource: '' })).toBe(false);
    expect(hasValidPropertyGeocode({ ...valid, lat: null, lng: null, hideStreetAddressOnCard: true })).toBe(false);
    expect(hasValidPropertyGeocode({ ...valid, lat: null, lng: null, hideStreetAddressOnCard: true, geocodeValid: true })).toBe(true);
  });
  it('invalidates a changed address and cannot reuse its old PIN', () => {
    const changed = invalidateChangedPropertyAddress(valid, { ...valid, address: '100 Other Rd' });
    expect(changed).toMatchObject({ lat: null, lng: null, geocodeStatus: 'pending', isActive: false, publishToShowcase: false });
    expect(invalidateChangedPropertyAddress(valid, { ...valid, price: 250000 })).toMatchObject(valid);
  });
  it('requires exact address components, accepts standard street abbreviations, rejects city-only matches', () => {
    expect(censusAddressMatches(valid, '1524 WOOD SPRING COURT, RALEIGH, NC, 27614')).toBe(true);
    expect(censusAddressMatches(valid, '1525 WOOD SPRING CT, RALEIGH, NC, 27614')).toBe(false);
    expect(addressMatches(valid, { city: 'Raleigh', state: 'NC', zip: '27614' })).toBe(false);
    expect(addressMatches(valid, { ...valid, zip: '27615' })).toBe(false);
  });
});
