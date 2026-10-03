import { describe, expect, it } from 'vitest';
import { calculateLandUnitMetrics, parseCanonicalLotArea } from './landMetrics.ts';

describe('canonical land metrics', () => {
  it('parses a decimal-comma acre value without turning it into 114 sqft', () => {
    expect(parseCanonicalLotArea('1,14ac')).toEqual({
      lotSizeAcres: 1.14, lotSizeSqft: 49_658.4, sourceUnit: 'ACRES',
    });
  });

  it('calculates Gable unit metrics deterministically', () => {
    expect(calculateLandUnitMetrics(19_000, '1,14ac')).toMatchObject({
      lotSizeAcres: 1.14, lotSizeSqft: 49_658.4, pricePerLotSqft: 0.38, pricePerAcre: 16_666.67,
    });
  });
});
