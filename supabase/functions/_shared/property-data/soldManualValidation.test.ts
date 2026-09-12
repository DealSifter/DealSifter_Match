import { describe, expect, it, vi } from 'vitest';
import { runControlledSoldEvidenceValidation } from './soldManualValidation.ts';

const result = (cacheHit: boolean) => ({ cacheHit, soldPool: { recordsReturned: 0, records: [] },
  soldCompSet: { totalAvmCandidates: 20, soldRecordsFound: 0, matchedCandidates: 0, exactMatches: 0, strongMatches: 0,
    ambiguousMatches: 0, unmatchedCandidates: 20, qualifiedSoldComps: [], strongSoldComps: [], conditionalSoldComps: [],
    matches: [], sufficiency: 'INSUFFICIENT' } });

describe('controlled sold evidence validation', () => {
  it('requires opt-in and guarantees the second service result is a cache hit', async () => {
    const blocked = { getCachedSoldEvidence: vi.fn(), getSoldEvidence: vi.fn() };
    await expect(runControlledSoldEvidenceValidation({ enabled: 'false', mode: 'live', environment: 'production',
      service: blocked as never, propertyId: '11111111-1111-4111-8111-111111111111' })).rejects.toThrow('NOT_ENABLED');
    const service = { getCachedSoldEvidence: vi.fn(async () => null),
      getSoldEvidence: vi.fn().mockResolvedValueOnce(result(false)).mockResolvedValueOnce(result(true)) };
    await expect(runControlledSoldEvidenceValidation({ enabled: 'true', mode: 'live', environment: 'production',
      service: service as never, propertyId: '11111111-1111-4111-8111-111111111111' })).resolves.toMatchObject({
        cacheBefore: 'MISS', liveRequests: 1, secondCacheHit: true, secondLiveRequests: 0,
      });
    expect(service.getSoldEvidence).toHaveBeenCalledTimes(2);
  });
});
