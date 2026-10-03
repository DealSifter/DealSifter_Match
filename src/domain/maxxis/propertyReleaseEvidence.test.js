import { describe, expect, it } from 'vitest';
import { mergePropertyReleaseEvidence } from './propertyReleaseEvidence';

describe('Property Release canonical evidence merge', () => {
  it('uses authorized verified facts without adding premium analysis', () => {
    const merged = mergePropertyReleaseEvidence({ id: 'p1', description: 'Owner note' }, {
      state: 'unlocked', intelligence: { fields: {
        yearBuilt: { value: 1976, status: 'VERIFIED_RECORD' },
        county: { value: 'Jefferson', status: 'VERIFIED_RECORD' },
        lotSizeSqft: { value: 49_658.4, status: 'VERIFIED_RECORD' },
        annualPropertyTax: { value: 5168, status: 'VERIFIED_RECORD' },
        assessedValue: { value: 1_842_500, status: 'VERIFIED_RECORD' },
        latestSalePrice: { value: 682_130, status: 'VERIFIED_RECORD' },
      } },
    });
    expect(merged).toMatchObject({ yearBuilt: 1976, county: 'Jefferson', lotSizeSqft: 49_658.4,
      annualPropertyTax: 5168, assessedValue: 1_842_500, latestSalePrice: 682_130, notes: 'Owner note' });
    expect(merged).not.toHaveProperty('comparableEvidence');
    expect(merged).not.toHaveProperty('valuationEvidence');
  });

  it('does not expose evidence when the backend has not authorized it', () => {
    expect(mergePropertyReleaseEvidence({ id: 'p1' }, { state: 'locked', intelligence: { fields: {
      yearBuilt: { value: 1976, status: 'VERIFIED_RECORD' },
    } } })).toEqual({ id: 'p1' });
  });
});
