import { describe, expect, it } from 'vitest';
import { detectPropertyEvidenceConflicts } from './conflicts.ts';
import { buildInternalPropertyEvidence } from './propertyEvidenceService.ts';
import { mapRentCastProperty } from './rentcast/rentcastMapper.ts';

const internal = () => buildInternalPropertyEvidence({
  id: '11111111-1111-4111-8111-111111111111', type: 'SFR', address: '100 Fixture Street',
  city: 'Austin', state: 'Texas', zip: '78701-1234', price: 200000, beds: 3, baths: 2,
  sqft: '1,500', lot: '6000',
});
const external = (overrides: Record<string, unknown> = {}) => mapRentCastProperty({
  id: 'provider-1', formattedAddress: '100 Fixture St, Austin, TX 78701', addressLine1: '100 Fixture St',
  city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'Single Family', bedrooms: 3,
  bathrooms: 2, squareFootage: 1500, lotSize: 6000, yearBuilt: 2000, ...overrides,
}, '2026-09-09T12:00:00.000Z');

describe('deterministic property evidence conflicts', () => {
  it('does not conflict on normalized equivalent address, state, zip, type, or numeric values', () => {
    expect(detectPropertyEvidenceConflicts(internal(), external())).toEqual([]);
  });

  it('reports address, beds, baths, and size conflicts without overwriting either side', () => {
    const result = detectPropertyEvidenceConflicts(internal(), external({
      addressLine1: '200 Other Rd', bedrooms: 4, bathrooms: 3, squareFootage: 1218, lotSize: 7000,
    }));
    expect(result.map((item) => item.field)).toEqual(['address', 'bedrooms', 'bathrooms', 'livingAreaSqft', 'lotSizeSqft']);
    expect(result.find((item) => item.field === 'livingAreaSqft')).toMatchObject({
      internalValue: 1500, externalValue: 1218, difference: 282,
    });
    expect(result.find((item) => item.field === 'livingAreaSqft')?.differencePercent).toBeCloseTo(18.8);
  });

  it('ignores size differences at or below 5 percent', () => {
    expect(detectPropertyEvidenceConflicts(internal(), external({ squareFootage: 1425 }))
      .some((item) => item.field === 'livingAreaSqft')).toBe(false);
  });

  it('supports deterministic yearBuilt conflicts when internal evidence later becomes available', () => {
    const evidence = internal();
    evidence.characteristics.yearBuilt = {
      value: 1990, status: 'USER_PROVIDED', source: 'dealSifter', retrievedAt: null,
      effectiveDate: null, providerPropertyId: null, confidence: null,
    };
    expect(detectPropertyEvidenceConflicts(evidence, external({ yearBuilt: 2000 })))
      .toContainEqual(expect.objectContaining({ field: 'yearBuilt', internalValue: 1990, externalValue: 2000 }));
  });
});
