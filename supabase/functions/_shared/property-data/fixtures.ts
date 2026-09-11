import type { NormalizedPropertyRecord, PropertyLookupInput } from './types.ts';
import { mapRentCastProperty } from './rentcast/rentcastMapper.ts';

export type MockPropertyFixture = {
  input: PropertyLookupInput;
  record: NormalizedPropertyRecord;
};

export const MOCK_PROPERTY_FIXTURES: MockPropertyFixture[] = [
  {
    input: { street: '100 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701' },
    record: mapRentCastProperty({
      id: 'mock-100-fixture-st',
      formattedAddress: '100 Fixture St, Austin, TX 78701',
      addressLine1: '100 Fixture St',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      county: 'Travis',
      latitude: 30.2672,
      longitude: -97.7431,
      propertyType: 'Single Family',
      bedrooms: 3,
      bathrooms: 2,
      squareFootage: 1500,
      lotSize: 6000,
      yearBuilt: 2000,
    }, '2026-01-01T00:00:00.000Z'),
  },
];
