import { describe, expect, it, vi } from 'vitest';
import { runControlledValuationEvidenceValidation } from './valuationManualValidation.ts';

const result = (cacheHit: boolean) => ({
  propertyId: '11111111-1111-4111-8111-111111111111', cacheHit,
  valuation: {
    providerEstimate: { value: { value: 300000 }, rangeLow: { value: 280000 }, rangeHigh: { value: 320000 }, providerConfidenceSemantic: 'PROVIDER_85_PERCENT_RANGE' },
    providerComparableCount: 0, comparables: [],
    limitations: ['RENOVATION_CONDITION_UNAVAILABLE', 'ARMS_LENGTH_DISTRESS_UNAVAILABLE', 'PROVIDER_LISTING_PRICE_IS_NOT_CONFIRMED_SALE_PRICE'],
  },
  comparableAnalysis: {
    counts: { total: 0, usable: 0, strong: 0, downRanked: 0, hardRejected: 0 }, diagnostics: [],
    descriptiveStatistics: { medianPrice: null, averagePrice: null, medianPricePerSqft: null, averagePricePerSqft: null },
  },
});

describe('controlled valuation validation harness', () => {
  it('cannot run without explicit operator opt-in', async () => {
    const service = { getCachedValuationEvidence: vi.fn(), getValuationEvidence: vi.fn() };
    await expect(runControlledValuationEvidenceValidation({
      enabled: 'false', mode: 'live', environment: 'production', service: service as never,
      propertyId: '11111111-1111-4111-8111-111111111111',
    })).rejects.toThrow('LIVE_VALUATION_VALIDATION_NOT_ENABLED');
    expect(service.getValuationEvidence).not.toHaveBeenCalled();
  });

  it('allows at most one miss and requires the second lookup to be a cache hit', async () => {
    const service = {
      getCachedValuationEvidence: vi.fn(async () => null),
      getValuationEvidence: vi.fn().mockResolvedValueOnce(result(false)).mockResolvedValueOnce(result(true)),
    };
    const output = await runControlledValuationEvidenceValidation({
      enabled: 'true', mode: 'live', environment: 'production', service: service as never,
      propertyId: '11111111-1111-4111-8111-111111111111',
    });
    expect(output).toMatchObject({ cacheBefore: 'MISS', liveRequests: 1, secondCacheHit: true, secondLiveRequests: 0 });
    expect(service.getValuationEvidence).toHaveBeenCalledTimes(2);
  });
});
