import { describe, expect, it } from 'vitest';
import { mapRentCastSoldRecordPool } from './soldMapper.ts';
import { selectRecordedSoldComparables } from './soldCompEngine.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';
import {
  classifyStructuralReferenceSet,
  DEALSIFTER_MONETARY_ADJUSTMENT_REFERENCE_V1,
  DEALSIFTER_WEIGHTED_COMP_POLICY_V1,
  evaluateWeightedCompCandidate,
  rankWeightedCompCandidates,
  thresholdSensitivity,
} from './weightedCompPolicy.ts';
import {
  attachUserConditionReview,
  CONDITION_COMPATIBILITIES,
  CONDITION_REVIEW_STATUSES,
  createUserCompConditionReview,
  TARGET_CONDITIONS,
} from './weightedCompTypes.ts';
import { auditWeightedSubjectBaseline } from './weightedCompManualValidation.ts';

const NOW = '2026-09-12T12:00:00.000Z';
const lookup = { street: '100 Subject St', city: 'Austin', state: 'TX', zipCode: '78701' };

function candidates(options: { count?: number; distances?: number[]; type?: string; compSqft?: number;
  subjectLot?: number; compLot?: number; subjectYear?: number; compYear?: number } = {}) {
  const count = options.count ?? 5;
  const type = options.type || 'Single Family';
  const valuation = mapRentCastValueEstimate({
    lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: NOW,
    raw: { price: 500000, subjectProperty: { id: 'subject', addressLine1: lookup.street, city: lookup.city,
      state: lookup.state, zipCode: lookup.zipCode, latitude: 30, longitude: -97, propertyType: type,
      bedrooms: 3, bathrooms: 2, squareFootage: 2000, lotSize: options.subjectLot ?? 6000,
      yearBuilt: options.subjectYear ?? 2000 }, comparables: [] },
  });
  const records = mapRentCastSoldRecordPool({
    policy: { radiusMiles: 5, saleDateRangeDays: 270, propertyType: type, limit: 100 },
    queryFingerprint: 'c'.repeat(64), retrievedAt: NOW,
    records: Array.from({ length: count }, (_, index) => {
      const miles = options.distances?.[index] ?? 0.2 + index * 0.1;
      return { id: `weighted-${index}`, addressLine1: `${index} Sold St`, formattedAddress: `${index} Sold St, Austin, TX`,
        city: 'Austin', state: 'TX', zipCode: '78701', latitude: 30 + miles / 69, longitude: -97,
        propertyType: type, bedrooms: 3, bathrooms: 2, squareFootage: options.compSqft ?? 1950,
        lotSize: options.compLot ?? 6200, yearBuilt: options.compYear ?? 2002,
        lastSaleDate: '2026-07-01', lastSalePrice: 300000 + index * 100000 };
    }),
  }).records;
  return selectRecordedSoldComparables(valuation, records).directSoldCompCandidates;
}

describe('weighted appraisal-style comp policy foundation', () => {
  it('separates hard gates, structural score, completeness, and condition review', () => {
    const assessment = evaluateWeightedCompCandidate(candidates({ count: 1 })[0]);
    expect(assessment.hardGates.pass).toBe(true);
    expect(assessment.structuralComparabilityScore).toBeGreaterThanOrEqual(80);
    expect(assessment.dataCompletenessScore).toBeLessThan(100);
    expect(assessment.conditionReviewStatus).toBe('UNREVIEWED');
    expect(assessment.confirmedArvComp).toBe(false);
    expect(assessment.primaryArvCompCandidate).toBe(true);
  });

  it('treats unknown as unavailable evidence rather than a mismatch and enforces the completeness floor', () => {
    const candidate = candidates({ count: 1 })[0];
    const assessment = evaluateWeightedCompCandidate(candidate);
    expect(assessment.checks.filter((check) => check.status === 'UNKNOWN').map((check) => check.key))
      .toEqual(expect.arrayContaining(['subdivision', 'majorRoadBarrier', 'storyStyle', 'pool', 'garage', 'trafficFreeway']));
    expect(assessment.checks.filter((check) => check.status === 'UNKNOWN').every((check) => check.factor === null)).toBe(true);
    expect(evaluateWeightedCompCandidate(candidate, 'WEIGHTED_BALANCED', {}, { minimumCompleteness: 90 })
      .primaryEligibilityBlockers).toContain('DATA_COMPLETENESS_BELOW_MINIMUM');
  });

  it('hard-fails invalid recorded-sale evidence and incompatible/corrupt records', () => {
    const candidate = candidates({ count: 1 })[0];
    const invalid = { ...candidate, recordedSalePrice: null, hardInvalidReasons: ['INCOMPATIBLE_PROPERTY_TYPE'] as const };
    const assessment = evaluateWeightedCompCandidate(invalid);
    expect(assessment.hardGates.pass).toBe(false);
    expect(assessment.structuralClass).toBe('INVALID');
    expect(assessment.primaryArvCompCandidate).toBe(false);
  });

  it('implements local bands plus sqft ±200, year ±5, and SFR lot ±2500 checks', () => {
    const candidate = candidates({ count: 1, distances: [0.4], compSqft: 1800,
      subjectLot: 6000, compLot: 8500, subjectYear: 2000, compYear: 2005 })[0];
    const assessment = evaluateWeightedCompCandidate(candidate, 'APPRAISAL_STYLE_STRICT');
    const check = (key: string) => assessment.checks.find((item) => item.key === key);
    expect(check('distance')).toMatchObject({ status: 'PASS', factor: 1 });
    expect(check('livingArea')).toMatchObject({ status: 'PASS', factor: 1 });
    expect(check('yearBuilt')).toMatchObject({ status: 'PASS', factor: 1 });
    expect(check('lotSize')).toMatchObject({ status: 'PASS', factor: 1 });
    const secondary = evaluateWeightedCompCandidate(candidates({ count: 1, distances: [1.2] })[0]);
    expect(secondary.primaryEligibilityBlockers).toContain('SECONDARY_PROXIMITY_WITHOUT_MICRO_MARKET_EVIDENCE');
  });

  it('supports verified subdivision/story signals without inventing them', () => {
    const candidate = candidates({ count: 1, distances: [1.2] })[0];
    const unknown = evaluateWeightedCompCandidate(candidate);
    const known = evaluateWeightedCompCandidate(candidate, 'LOCALITY_TIME_TRAVEL', {
      sameSubdivision: true, sameStoryStyle: true, majorRoadRelation: 'NO_BARRIER',
    });
    expect(unknown.checks.find((check) => check.key === 'subdivision')?.status).toBe('UNKNOWN');
    expect(known.checks.find((check) => check.key === 'subdivision')?.status).toBe('PASS');
    expect(known.primaryEligibilityBlockers).not.toContain('SECONDARY_PROXIMITY_WITHOUT_MICRO_MARKET_EVIDENCE');
  });

  it('keeps lot non-applicable for condos and supports 2–5 reference classes', () => {
    const condo = evaluateWeightedCompCandidate(candidates({ count: 1, type: 'Condo' })[0]);
    expect(condo.checks.find((check) => check.key === 'lotSize')?.status).toBe('NOT_APPLICABLE');
    expect([0, 1, 2, 3, 4, 5].map(classifyStructuralReferenceSet)).toEqual([
      'INSUFFICIENT', 'INSUFFICIENT', 'MINIMUM', 'ACCEPTABLE', 'ROBUST', 'PREFERRED',
    ]);
  });

  it('runs rational scenarios and 75/80/85 threshold sensitivity', () => {
    const set = candidates({ count: 8 });
    expect([
      rankWeightedCompCandidates(set, 'WEIGHTED_BALANCED').length,
      rankWeightedCompCandidates(set, 'APPRAISAL_STYLE_STRICT').length,
      rankWeightedCompCandidates(set, 'LOCALITY_TIME_TRAVEL').length,
    ]).toEqual([8, 8, 8]);
    expect(thresholdSensitivity(set, 'WEIGHTED_BALANCED').map((item) => item.threshold)).toEqual([75, 80, 85]);
    expect(DEALSIFTER_WEIGHTED_COMP_POLICY_V1.arvCandidateThreshold).toBe(80);
    expect(Object.values(DEALSIFTER_WEIGHTED_COMP_POLICY_V1.weights)
      .every((weights) => Object.values(weights).reduce((sum, weight) => sum + weight, 0) === 100)).toBe(true);
  });

  it('does not use price in structural selection or implement an ARV', () => {
    const set = candidates({ count: 5 });
    const before = rankWeightedCompCandidates(set, 'WEIGHTED_BALANCED')
      .map((item) => [item.candidate.soldRecord.providerPropertyId, item.assessment.structuralComparabilityScore]);
    const repriced = set.map((candidate, index) => ({ ...candidate, recordedSalePrice: index ? 1 : 999999999,
      recordedSalePricePerSqft: { ...candidate.recordedSalePricePerSqft, value: index ? 0.01 : 999999 } }));
    const after = rankWeightedCompCandidates(repriced, 'WEIGHTED_BALANCED')
      .map((item) => [item.candidate.soldRecord.providerPropertyId, item.assessment.structuralComparabilityScore]);
    expect(after).toEqual(before);
    expect(JSON.stringify(rankWeightedCompCandidates(set, 'WEIGHTED_BALANCED')))
      .not.toMatch(/finalArv|recommendedArv|dealSifterArv/i);
  });

  it('preserves distinct condition taxonomy and a USER_PROVIDED review contract', () => {
    expect(TARGET_CONDITIONS).toEqual(['AS_IS', 'LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION',
      'HIGH_END', 'TURN_KEY', 'NEW_CONSTRUCTION', 'UNKNOWN']);
    expect(new Set(TARGET_CONDITIONS).size).toBe(8);
    expect(CONDITION_REVIEW_STATUSES).toContain('UNREVIEWED');
    expect(CONDITION_COMPATIBILITIES).toContain('DIFFERENT_PRODUCT_CLASS');
    expect(TARGET_CONDITIONS.indexOf('TURN_KEY')).not.toBe(TARGET_CONDITIONS.indexOf('HIGH_END'));
    expect(TARGET_CONDITIONS.indexOf('NEW_CONSTRUCTION')).not.toBe(TARGET_CONDITIONS.indexOf('HIGH_END'));
    const assessment = evaluateWeightedCompCandidate(candidates({ count: 1 })[0]);
    const review = createUserCompConditionReview({ candidateProviderPropertyId: 'weighted-0',
      observedCondition: 'NEW_CONSTRUCTION', targetCondition: 'STANDARD_RENOVATION',
      reviewStatus: 'NOT_COMPARABLE', conditionCompatibility: 'DIFFERENT_PRODUCT_CLASS',
      reviewedAt: NOW, notes: 'Distinct product class.' });
    const reviewed = attachUserConditionReview(assessment, review);
    expect(review.evidenceStatus).toBe('USER_PROVIDED');
    expect(reviewed.arvUseStatus).toBe('REJECTED');
    expect(reviewed.structuralAssessment.structuralComparabilityScore).toBe(assessment.structuralComparabilityScore);
    expect(reviewed.confirmedArvComp).toBe(false);
  });

  it('keeps monetary values as inactive, locally calibratable base references', () => {
    expect(DEALSIFTER_MONETARY_ADJUSTMENT_REFERENCE_V1).toMatchObject({
      status: 'BASE_REFERENCE_PARAMETERS_ONLY', productionValuationLogicEnabled: false,
    });
    expect(DEALSIFTER_MONETARY_ADJUSTMENT_REFERENCE_V1.calibrationRequired)
      .toEqual(expect.arrayContaining(['market', 'local_evidence', 'effective_date', 'seasonality']));
    expect(DEALSIFTER_MONETARY_ADJUSTMENT_REFERENCE_V1.undefinedPolicy).toContain('TRAFFIC_250K_TO_500K');
  });

  it('surfaces subject-source conflicts while preserving explicit SFR normalization', () => {
    const base = { storyStyle: null, bathrooms: 2, lotSizeSqft: 6000, yearBuilt: 2000,
      pool: null, garage: null, subdivision: null, latitude: 30, longitude: -97 };
    const audit = auditWeightedSubjectBaseline([
      { ...base, source: 'INTERNAL_LISTING', evidenceStatus: 'USER_PROVIDED', propertyType: 'SFR',
        bedrooms: 3, livingAreaSqft: 2000 },
      { ...base, source: 'PROPERTY_RECORD', evidenceStatus: 'VERIFIED_RECORD', propertyType: 'Single Family',
        bedrooms: 3, livingAreaSqft: 2100 },
    ]);
    expect(audit.conflicts.map((conflict) => conflict.field)).toEqual(['livingAreaSqft']);
  });
});
