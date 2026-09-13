import { describe, expect, it } from 'vitest';
import { createArvExplanationContext } from './arvResultExperience';

function evaluation(overrides = {}) {
  return {
    status: 'ARV_AVAILABLE',
    arvRangeLow: 480000,
    arvRangeHigh: 540000,
    centralReference: 510000,
    medianBasedReference: 510000,
    weightedReference: 512000,
    medianPricePerSqft: 300,
    weightedPricePerSqft: 301.18,
    confidence: 'MODERATE',
    eligibleCompCount: 3,
    warnings: [],
    limitations: ['TRANSACTION_QUALITY_UNKNOWN', 'MONETARY_ADJUSTMENTS_INACTIVE'],
    confidenceReasons: ['ELIGIBLE_COMP_COUNT_3'],
    policyVersion: 'DEALSIFTER_ARV_POLICY_V1',
    methodologyVersion: 'DEALSIFTER_ARV_ENGINE_V1',
    rangeMethod: 'INTERQUARTILE_PRICE_PER_SQFT_INTERVAL',
    adjustmentStatus: 'NOT_ACTIVE_UNCALIBRATED',
    evidenceSummary: { recordedSale: 'VERIFIED_RECORD', structuralScore: 'CALCULATED',
      conditionReview: 'USER_PROVIDED', arv: 'CALCULATED', confidence: 'CALCULATED' },
    providerAvmCrossCheck: { status: 'PROVIDER_ESTIMATE_WITHIN_RANGE', value: 525000, evidenceStatus: 'ESTIMATED' },
    valuationSet: [
      { compIdentifier: 'used-1', address: '1 Evidence St', recordedSalePrice: 500000,
        recordedSaleDate: '2026-03-01', distanceMiles: 0.4, structuralComparabilityScore: 91,
        dataCompletenessScore: 90, conditionCompatibility: 'MATCHES_TARGET', conditionEvidenceStatus: 'USER_PROVIDED',
        valuationWeight: 0.35, valuationRole: 'PRIMARY', valuationEligibility: 'INCLUDED',
        inclusionReason: 'CONDITION_MATCH', recordedSaleEvidenceStatus: 'VERIFIED_RECORD',
        pricePerSqftEvidenceStatus: 'CALCULATED' },
      { compIdentifier: 'excluded-1', address: '2 Pending St', recordedSalePrice: 490000,
        recordedSaleDate: '2026-02-01', distanceMiles: 0.8, structuralComparabilityScore: 86,
        dataCompletenessScore: 78, conditionCompatibility: 'UNKNOWN', conditionEvidenceStatus: 'USER_PROVIDED',
        valuationWeight: 0, valuationRole: 'EXCLUDED', valuationEligibility: 'EXCLUDED',
        exclusionReason: 'CONDITION_UNKNOWN', recordedSaleEvidenceStatus: 'VERIFIED_RECORD',
        pricePerSqftEvidenceStatus: 'CALCULATED' },
    ],
    ...overrides,
  };
}

describe('Maxxis ARV result explanation context', () => {
  it('presents an available range first without recalculating or mutating engine values', () => {
    const input = evaluation();
    const snapshot = JSON.stringify(input);
    const context = createArvExplanationContext(input);
    expect(context).toMatchObject({ status: 'ARV_AVAILABLE', statusLabel: 'AVAILABLE',
      range: { low: 480000, high: 540000 }, centralReference: 510000, confidence: 'MODERATE', eligibleCompCount: 3 });
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(context.statement).toMatch(/current evidence supports/i);
    expect(context.statement).not.toMatch(/the ARV is|property is worth/i);
  });

  it('does not upgrade a limited result and exposes dispersion and low-comp warnings', () => {
    const context = createArvExplanationContext(evaluation({ status: 'ARV_LIMITED', eligibleCompCount: 2,
      confidence: 'LOW', warnings: ['VALUATION_DISPERSION_WARNING', 'POSSIBLE_UNMODELED_FACTOR'] }));
    expect(context).toMatchObject({ statusLabel: 'LIMITED CONFIDENCE', confidence: 'LOW' });
    expect(context.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      'VALUATION_DISPERSION_WARNING', 'POSSIBLE_UNMODELED_FACTOR', 'LOW_COMP_COUNT',
    ]));
  });

  it('returns no monetary presentation for unavailable evidence', () => {
    const context = createArvExplanationContext(evaluation({ status: 'ARV_UNAVAILABLE', eligibleCompCount: 1,
      arvRangeLow: null, arvRangeHigh: null, centralReference: null, confidence: 'LOW',
      confidenceReasons: ['INSUFFICIENT_CONDITION_COMPATIBLE_COMPS'],
      evidenceSummary: { recordedSale: 'VERIFIED_RECORD', structuralScore: 'CALCULATED',
        conditionReview: 'USER_PROVIDED', arv: 'UNAVAILABLE', confidence: 'CALCULATED' } }));
    expect(context.range).toBeNull();
    expect(context.centralReference).toBeNull();
    expect(context.statusLabel).toBe('NOT AVAILABLE YET');
  });

  it('separates included and excluded evidence with explicit reasons and provenance', () => {
    const context = createArvExplanationContext(evaluation());
    expect(context.usedComps).toHaveLength(1);
    expect(context.usedComps[0]).toMatchObject({ reasonCode: 'CONDITION_MATCH',
      provenance: { recordedSale: 'VERIFIED_RECORD', conditionReview: 'USER_PROVIDED' } });
    expect(context.notIncludedComps[0]).toMatchObject({ reasonCode: 'CONDITION_UNKNOWN' });
    expect(context.warnings.map((warning) => warning.code)).toContain('UNKNOWN_CONDITION');
    expect(context.provenance).toMatchObject({ arv: 'CALCULATED', conditionReview: 'USER_PROVIDED', providerAvm: 'ESTIMATED' });
  });

  it('keeps cached provider AVM separate and never changes the DealSifter references', () => {
    const input = evaluation();
    const context = createArvExplanationContext(input);
    expect(context.providerEstimate).toEqual({ value: 525000, source: 'RentCast', type: 'Provider Estimate',
      evidenceStatus: 'ESTIMATED', crossCheckStatus: 'PROVIDER_ESTIMATE_WITHIN_RANGE' });
    expect(context.centralReference).toBe(input.centralReference);
    expect(context.range).toEqual({ low: input.arvRangeLow, high: input.arvRangeHigh });
  });
});
