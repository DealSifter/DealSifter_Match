import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repairScope, validateCensusMatch } from './repair-property-geocode.mjs';

const property = { id: 'property', owner_id: 'owner', address: '1524 Wood Spring Ct', city: 'Raleigh', state: 'NC', zip: '27614', lat: null, lng: null, geocode_status: 'pending' };
const match = { matchedAddress: '1524 WOOD SPRING CT, RALEIGH, NC, 27614', addressComponents: { city: 'RALEIGH', state: 'NC', zip: '27614' }, coordinates: { y: 35.921133041392, x: -78.583547577238 } };
test('accepts the exact unique address point, not a city fallback', () => assert.deepEqual(validateCensusMatch(property, match), { lat: match.coordinates.y, lng: match.coordinates.x }));
test('rejects a different house, locality, ZIP or coordinates', () => {
  for (const invalid of [ { ...match, matchedAddress: match.matchedAddress.replace('1524', '1526') }, { ...match, addressComponents: { ...match.addressComponents, zip: '27601' } },
    { ...match, coordinates: { x: null, y: null } }, { ...match, coordinates: { x: 0, y: 0 } }, { ...match, coordinates: { x: -78, y: NaN } } ]) assert.throws(() => validateCensusMatch(property, invalid));
});
test('guards the exact property, owner, address, pending state and absent coordinates', () => {
  const scope = repairScope(property); assert.equal(scope.get('owner_id'), 'eq.owner'); assert.equal(scope.get('address'), 'eq.1524 Wood Spring Ct');
  assert.equal(scope.get('lat'), 'is.null'); assert.equal(scope.get('geocode_status'), 'eq.pending');
});
test('never overwrites resolved or manually positioned properties', () => {
  for (const row of [{ ...property, lat: 35, lng: -78 }, { ...property, geocode_status: 'manual' }, { ...property, geocode_status: 'resolved' }, { ...property, owner_id: null }]) assert.throws(() => repairScope(row));
});
