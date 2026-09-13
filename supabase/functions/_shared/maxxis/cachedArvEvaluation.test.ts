import { describe, expect, it, vi } from 'vitest';
import { loadCachedArvEvaluation } from './cachedArvEvaluation.ts';

function soldCandidate(id: string, price: number) {
  return {
    soldRecord: { providerPropertyId: id, formattedAddress: `${id} Honolulu HI`, addressLine1: id,
      city: 'Honolulu', state: 'HI', zipCode: '96825', propertyType: 'Single Family', livingAreaSqft: 2000,
      saleTransactionAmbiguous: false, transactionQuality: 'UNKNOWN' },
    recordedSalePrice: price, recordedSaleDate: '2026-04-08', evidenceStatus: 'VERIFIED_RECORD',
    distanceFromSubjectMiles: { value: .5 }, daysSinceSale: { value: 120 }, hardInvalidReasons: [],
    weightedAssessment: { visualReviewReady: true, structuralComparabilityScore: 90,
      dataCompletenessScore: 90, hardGates: { pass: true } },
  };
}

function cachedSoldEvidence() {
  return { valuation: { subjectProperty: { livingAreaSqft: { value: 2333 } },
    providerEstimate: { value: { value: 2_500_000, status: 'ESTIMATED' } } },
  recordedSoldCompSelection: { primaryStructuralCandidates: [soldCandidate('comp-a', 1_500_000),
    soldCandidate('comp-b', 1_600_000)] } };
}

describe('cached-only ARV loading for Deal Intelligence', () => {
  it('fails closed before cache/review reads without entitlement', async () => {
    const loadCachedSoldEvidence = vi.fn();
    const loadTargetCondition = vi.fn();
    const loadReviews = vi.fn();
    expect(await loadCachedArvEvaluation({ propertyId: 'property', userId: 'user',
      hasEntitlement: vi.fn(async () => false), loadCachedSoldEvidence, loadTargetCondition, loadReviews })).toBeNull();
    expect(loadCachedSoldEvidence).not.toHaveBeenCalled();
    expect(loadTargetCondition).not.toHaveBeenCalled();
    expect(loadReviews).not.toHaveBeenCalled();
  });

  it('uses cached sold evidence and user reviews without any provider dependency', async () => {
    const loadCachedSoldEvidence = vi.fn(async () => cachedSoldEvidence() as never);
    const result = await loadCachedArvEvaluation({ propertyId: 'property', userId: 'user',
      hasEntitlement: vi.fn(async () => true), loadCachedSoldEvidence,
      loadTargetCondition: vi.fn(async () => 'FULL_RENOVATION'),
      loadReviews: vi.fn(async () => ['comp-a', 'comp-b'].map((id) => ({ comp_identifier: id,
        target_condition: 'FULL_RENOVATION', observed_condition: 'FULL_RENOVATION',
        condition_compatibility: 'MATCHES_TARGET', notes: null, evidence_status: 'USER_PROVIDED',
        reviewed_at: '2026-09-13T12:00:00.000Z' })) as never) });
    expect(loadCachedSoldEvidence).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: 'ARV_LIMITED', eligibleCompCount: 2,
      evidenceSummary: { conditionReview: 'USER_PROVIDED' } });
  });
});
