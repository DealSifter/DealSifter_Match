import { describe, expect, it } from 'vitest';
import { mergeVerifiedPropertyEvidenceIntoFacts } from './propertyEvidenceProjection.ts';

describe('property evidence snapshot projection', () => {
  it('preserves every supported verified provider field through propertyFacts', () => {
    const value = mergeVerifiedPropertyEvidenceIntoFacts({ id: 'property-1', address: '5939 Droad St' }, {
      fields: {
        yearBuilt: { value: 1962, status: 'VERIFIED_RECORD' },
        county: { value: 'Duval', status: 'VERIFIED_RECORD' },
        lotSizeSqft: { value: 7253, status: 'VERIFIED_RECORD' },
        assessedValue: { value: 108188, status: 'VERIFIED_RECORD' },
        assessmentYear: { value: 2025, status: 'VERIFIED_RECORD' },
        annualPropertyTax: { value: 1843, status: 'VERIFIED_RECORD' },
        propertyTaxYear: { value: 2024, status: 'VERIFIED_RECORD' },
        latestSalePrice: { value: 80500, status: 'VERIFIED_RECORD' },
        latestSaleDate: { value: '2021-08-03T00:00:00.000Z', status: 'VERIFIED_RECORD' },
        ownerOccupied: { value: true, status: 'VERIFIED_RECORD' },
        ownershipRecordPresent: { value: true, status: 'VERIFIED_RECORD' },
      },
    });
    expect(value).toMatchObject({
      address: '5939 Droad St', yearBuilt: 1962, county: 'Duval', lot: 7253,
      assessedValue: 108188, assessmentYear: 2025, annualPropertyTax: 1843,
      propertyTaxYear: 2024, latestSalePrice: 80500,
      latestSaleDate: '2021-08-03T00:00:00.000Z', ownerOccupied: true,
      ownershipRecordPresent: true,
    });
  });

  it('does not promote unknown or unavailable values and invents no evidence', () => {
    const value = mergeVerifiedPropertyEvidenceIntoFacts({ lot: 6000 }, {
      fields: {
        lotSizeSqft: { value: 0, status: 'UNAVAILABLE' },
        yearBuilt: { value: null, status: 'VERIFIED_RECORD' },
      },
    });
    expect(value).toEqual({ lot: 6000 });
    expect(value).not.toHaveProperty('yearBuilt');
  });
});
