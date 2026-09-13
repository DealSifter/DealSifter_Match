import { describe, expect, it } from 'vitest';
import {
  buildArvValuationSet,
  DEALSIFTER_ARV_ENGINE_POLICY_V1,
  evaluateArv,
  type ArvEngineCandidate,
} from './arvEngine.ts';
import type { ConditionCompatibility } from './weightedCompTypes.ts';

const NOW = '2026-09-12T18:00:00.000Z';
const SUBJECT_SQFT = 2333;

function comp(id: string, address: string, price: number, sqft: number, score: number,
  condition: ConditionCompatibility | 'UNREVIEWED' = 'UNREVIEWED'): ArvEngineCandidate {
  return { source: 'ARV_COMP_CANDIDATE', compIdentifier: id, address, recordedSalePrice: price,
    recordedSaleDate: '2026-04-08T00:00:00.000Z', recordedSaleEvidenceStatus: 'VERIFIED_RECORD', livingAreaSqft: sqft,
    structuralComparabilityScore: score, dataCompletenessScore: 70, hardGatesPass: true,
    recordAmbiguousOrCorrupt: false, distanceMiles: .64, daysSinceSale: 157,
    transactionQuality: 'UNKNOWN', conditionCompatibility: condition,
    conditionEvidenceStatus: condition === 'UNREVIEWED' ? null : 'USER_PROVIDED' };
}

function honolulu(conditions: Array<ConditionCompatibility | 'UNREVIEWED'>) {
  return [
    comp('kekauluohi', '436 Kekauluohi St', 1550000, 1790, 84.5, conditions[0] || 'UNREVIEWED'),
    comp('kumukahi', '777 Kumukahi Pl', 2450000, 1866, 81.79, conditions[1] || 'UNREVIEWED'),
    comp('kauhako', '7304 Kauhako St', 1400000, 1792, 80, conditions[2] || 'UNREVIEWED'),
  ];
}

function evaluate(conditions: Array<ConditionCompatibility | 'UNREVIEWED'>, overrides = {}) {
  return evaluateArv({ subjectPropertyId: 'e86dd292-429d-4b51-9b02-bc60a3e9068f',
    subjectLivingAreaSqft: SUBJECT_SQFT, targetCondition: 'FULL_RENOVATION', candidates: honolulu(conditions),
    calculatedAt: NOW, ...overrides });
}

describe('DealSifter deterministic ARV Engine v1', () => {
  it('returns unavailable with null monetary values for zero or one matching review', () => {
    for (const result of [evaluate([]), evaluate(['MATCHES_TARGET'])]) {
      expect(result).toMatchObject({ status: 'ARV_UNAVAILABLE', confidence: 'LOW', centralReference: null,
        arvRangeLow: null, arvRangeHigh: null });
      expect(result.confidenceReasons).toContain('INSUFFICIENT_CONDITION_COMPATIBLE_COMPS');
    }
  });

  it('produces a range-first limited result for two matching Honolulu comps', () => {
    const result = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET']);
    expect(result.status).toBe('ARV_LIMITED');
    expect(result.eligibleCompCount).toBe(2);
    expect(result.arvRangeLow).toBeLessThan(result.centralReference!);
    expect(result.arvRangeHigh).toBeGreaterThan(result.centralReference!);
    expect(result.medianPricePerSqft).toBeCloseTo((1550000 / 1790 + 2450000 / 1866) / 2, 1);
    expect(result.meanPricePerSqft).toBeCloseTo(result.medianPricePerSqft!, 1);
    expect(Math.abs(result.weightedReference! - Math.round(SUBJECT_SQFT * result.weightedPricePerSqft!)))
      .toBeLessThan(10);
    expect(result.confidence).toBe('LOW');
  });

  it('detects the known three-comp Honolulu dispersion and never reaches high confidence', () => {
    const result = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET', 'MATCHES_TARGET']);
    expect(result).toMatchObject({ status: 'ARV_LIMITED', eligibleCompCount: 3, confidence: 'LOW' });
    expect(result.warnings).toEqual(expect.arrayContaining(['VALUATION_DISPERSION_WARNING', 'POSSIBLE_UNMODELED_FACTOR']));
    expect(result.dispersion?.rangeRatio).toBeCloseTo(1.68, 2);
    expect(result.centralReference).toBe(Math.round(SUBJECT_SQFT * (1550000 / 1790)));
  });

  it('can return available only for an adequate, complete and consistent set', () => {
    const candidates = [500000, 510000, 520000].map((price, index) => ({
      ...comp(`stable-${index}`, `${index} Stable St`, price, 1500, 90 - index, 'MATCHES_TARGET'),
      dataCompletenessScore: 90,
    }));
    const result = evaluateArv({ subjectPropertyId: 'subject', subjectLivingAreaSqft: 1600,
      targetCondition: 'TURN_KEY', candidates, calculatedAt: NOW });
    expect(result.status).toBe('ARV_AVAILABLE');
    expect(result.confidence).toBe('MODERATE');
    expect(result.dispersion?.level).toBe('LOW');
  });

  it('can reach high confidence only with a robust verified and consistent set', () => {
    const candidates = Array.from({ length: 5 }, (_, index) => ({
      ...comp(`verified-${index}`, `${index} Verified St`, 500000 + index * 5000, 1500, 95 - index, 'MATCHES_TARGET'),
      dataCompletenessScore: 95,
      transactionQuality: 'ARMS_LENGTH_VERIFIED' as const,
    }));
    const result = evaluateArv({ subjectPropertyId: 'subject', subjectLivingAreaSqft: 1600,
      targetCondition: 'NEW_CONSTRUCTION', candidates, calculatedAt: NOW });
    expect(result).toMatchObject({ status: 'ARV_AVAILABLE', confidence: 'HIGH', eligibleCompCount: 5 });
    expect(result.limitations).not.toContain('TRANSACTION_QUALITY_UNKNOWN');
  });

  it('keeps not-comparable and unknown comps visible but outside the core set', () => {
    const notComparable = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET', 'NOT_COMPARABLE']);
    const unknown = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET', 'UNKNOWN']);
    expect(notComparable.eligibleCompCount).toBe(2);
    expect(notComparable.valuationSet.find((item) => item.compIdentifier === 'kauhako')).toMatchObject({
      valuationEligibility: 'EXCLUDED', exclusionReason: 'NOT_COMPARABLE', valuationWeight: 0,
    });
    expect(unknown.valuationSet.find((item) => item.compIdentifier === 'kauhako')?.exclusionReason).toBe('CONDITION_UNKNOWN');
  });

  it('uses partial, superior and inferior only as supporting evidence without guessed adjustments', () => {
    const result = evaluate(['MATCHES_TARGET', 'PARTIAL_MATCH', 'SUPERIOR_TO_TARGET']);
    expect(result.status).toBe('ARV_UNAVAILABLE');
    expect(result.eligibleCompCount).toBe(1);
    expect(result.supportingCompCount).toBe(2);
    expect(result.adjustmentStatus).toBe('NOT_ACTIVE_UNCALIBRATED');
    const inferior = evaluate(['MATCHES_TARGET', 'INFERIOR_TO_TARGET', 'DIFFERENT_PRODUCT_CLASS']);
    expect(inferior.supportingCompCount).toBe(1);
    expect(inferior.excludedCompCount).toBe(1);
  });

  it('excludes every different-product-class candidate and does not hallucinate ARV', () => {
    const result = evaluate(['DIFFERENT_PRODUCT_CLASS', 'DIFFERENT_PRODUCT_CLASS', 'DIFFERENT_PRODUCT_CLASS']);
    expect(result).toMatchObject({ status: 'ARV_UNAVAILABLE', eligibleCompCount: 0,
      centralReference: null, arvRangeLow: null, arvRangeHigh: null });
  });

  it('uses up to five primary comps and enforces structural, completeness, identity, sale and living-area gates', () => {
    const candidates = Array.from({ length: 7 }, (_, index) => comp(`c${index}`, `${index} Comp St`,
      500000 + index * 10000, 1500, 90 - index, 'MATCHES_TARGET'));
    candidates[0] = { ...candidates[0], hardGatesPass: false };
    candidates[1] = { ...candidates[1], dataCompletenessScore: 40 };
    const built = buildArvValuationSet({ subjectPropertyId: 'subject', subjectLivingAreaSqft: 1600,
      targetCondition: 'TURN_KEY', candidates, calculatedAt: NOW });
    expect(built.core.length).toBe(5);
    expect(built.valuationSet.find((item) => item.compIdentifier === 'c0')?.exclusionReason).toBe('FAILED_HARD_GATE');
    expect(built.valuationSet.find((item) => item.compIdentifier === 'c1')?.exclusionReason).toBe('INSUFFICIENT_COMPLETENESS');
    const invalid = [
      { ...comp('identity', 'Identity St', 500000, 1500, 90, 'MATCHES_TARGET'), compIdentifier: null },
      { ...comp('price', 'Price St', 500000, 1500, 90, 'MATCHES_TARGET'), recordedSalePrice: null },
      { ...comp('date', 'Date St', 500000, 1500, 90, 'MATCHES_TARGET'), recordedSaleDate: null },
      { ...comp('sqft', 'Sqft St', 500000, 1500, 90, 'MATCHES_TARGET'), livingAreaSqft: null },
    ];
    expect(buildArvValuationSet({ subjectPropertyId: 'subject', subjectLivingAreaSqft: 1600,
      targetCondition: 'TURN_KEY', candidates: invalid }).valuationSet.map((item) => item.exclusionReason))
      .toEqual(['MISSING_STABLE_COMP_IDENTITY', 'MISSING_RECORDED_SALE_PRICE',
        'MISSING_RECORDED_SALE_DATE', 'MISSING_LIVING_AREA']);
  });

  it('normalizes transparent non-price weights and prevents price leakage into eligibility and weights', () => {
    const before = buildArvValuationSet({ subjectPropertyId: 'subject', subjectLivingAreaSqft: SUBJECT_SQFT,
      targetCondition: 'FULL_RENOVATION', candidates: honolulu(['MATCHES_TARGET', 'MATCHES_TARGET', 'MATCHES_TARGET']) });
    const repriced = honolulu(['MATCHES_TARGET', 'MATCHES_TARGET', 'MATCHES_TARGET'])
      .map((candidate, index) => ({ ...candidate, recordedSalePrice: index === 0 ? 1 : 999999999 }));
    const after = buildArvValuationSet({ subjectPropertyId: 'subject', subjectLivingAreaSqft: SUBJECT_SQFT,
      targetCondition: 'FULL_RENOVATION', candidates: repriced });
    expect(after.valuationSet.map((item) => [item.compIdentifier, item.valuationEligibility, item.valuationWeight]))
      .toEqual(before.valuationSet.map((item) => [item.compIdentifier, item.valuationEligibility, item.valuationWeight]));
    expect(before.core.reduce((sum, item) => sum + item.valuationWeight, 0)).toBeCloseTo(1, 2);
  });

  it('marks extreme dispersion unavailable and missing subject sqft unavailable', () => {
    const dispersed = honolulu(['MATCHES_TARGET', 'MATCHES_TARGET']);
    dispersed[1] = { ...dispersed[1], recordedSalePrice: 10000000 };
    expect(evaluateArv({ subjectPropertyId: 'subject', subjectLivingAreaSqft: SUBJECT_SQFT,
      targetCondition: 'AS_IS', candidates: dispersed, calculatedAt: NOW }).status).toBe('ARV_UNAVAILABLE');
    expect(evaluate(['MATCHES_TARGET', 'MATCHES_TARGET'], { subjectLivingAreaSqft: null })).toMatchObject({
      status: 'ARV_UNAVAILABLE', centralReference: null,
    });
  });

  it('distinguishes low, moderate, high, and extreme dispersion deterministically', () => {
    const withPrices = (prices: number[]) => prices.map((price, index) => ({
      ...comp(`d${index}`, `${index} Dispersion St`, price, 1000, 90, 'MATCHES_TARGET'),
      dataCompletenessScore: 90,
    }));
    const status = (prices: number[]) => evaluateArv({ subjectPropertyId: 'subject', subjectLivingAreaSqft: 1000,
      targetCondition: 'TURN_KEY', candidates: withPrices(prices), calculatedAt: NOW });
    expect(status([500000, 510000, 520000]).dispersion?.level).toBe('LOW');
    expect(status([500000, 550000, 650000]).dispersion?.level).toBe('MODERATE');
    expect(status([500000, 600000, 800000]).dispersion?.level).toBe('HIGH');
    expect(status([300000, 500000, 1000000]).dispersion?.level).toBe('EXTREME');
  });

  it('cross-checks cached AVM without blending it into DealSifter ARV', () => {
    const baseline = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET']);
    const below = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET'], {
      cachedProviderAvm: { value: Number(baseline.arvRangeLow) - 1, evidenceStatus: 'ESTIMATED' },
    });
    const within = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET'], {
      cachedProviderAvm: { value: baseline.centralReference, evidenceStatus: 'ESTIMATED' },
    });
    const above = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET'], {
      cachedProviderAvm: { value: Number(baseline.arvRangeHigh) + 1, evidenceStatus: 'ESTIMATED' },
    });
    expect([below.providerAvmCrossCheck.status, within.providerAvmCrossCheck.status, above.providerAvmCrossCheck.status])
      .toEqual(['PROVIDER_ESTIMATE_BELOW_RANGE', 'PROVIDER_ESTIMATE_WITHIN_RANGE', 'PROVIDER_ESTIMATE_ABOVE_RANGE']);
    expect(within.centralReference).toBe(baseline.centralReference);
    expect(evaluate(['MATCHES_TARGET', 'MATCHES_TARGET']).providerAvmCrossCheck.status)
      .toBe('PROVIDER_ESTIMATE_UNAVAILABLE');
  });

  it('preserves provenance and inactive base adjustments', () => {
    const result = evaluate(['MATCHES_TARGET', 'MATCHES_TARGET']);
    expect(result.evidenceSummary).toEqual({ recordedSale: 'VERIFIED_RECORD', structuralScore: 'CALCULATED',
      conditionReview: 'USER_PROVIDED', arv: 'CALCULATED', confidence: 'CALCULATED' });
    expect(result.adjustmentStatus).toBe('NOT_ACTIVE_UNCALIBRATED');
    expect(DEALSIFTER_ARV_ENGINE_POLICY_V1.valuationWeight).not.toHaveProperty('price');
  });
});
