import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RecordedSoldComparableCandidate } from './soldTypes.ts';
import {
  buildArvVisualCompReviewPayload,
  persistedRowToReview,
} from './arvVisualCompReview.ts';
import {
  evaluateArvCompReviewEligibility,
  summarizeArvCompReviewSet,
  type ConditionCompatibility,
  type UserCompConditionReview,
  type WeightedCompAssessment,
} from './weightedCompTypes.ts';

const assessment = (score: number): WeightedCompAssessment => ({
  policyVersion: 'DEALSIFTER_WEIGHTED_COMP_POLICY_V1', structuralComparabilityScore: score,
  dataCompletenessScore: 70, structuralClass: 'VALID_STRUCTURAL_CANDIDATE',
  hardGates: { pass: true, checks: { recordedSalePrice: true, recordedSaleDate: true,
    usablePropertyRecord: true, compatiblePropertyType: true, sufficientLivingAreaEvidence: true,
    nonCorruptRecord: true }, failures: [] }, checks: [], primaryArvCompCandidate: true,
  primaryEligibilityBlockers: [], conditionReviewStatus: 'UNREVIEWED', conditionCompatibility: 'UNKNOWN',
  targetCondition: 'UNKNOWN', confirmedArvComp: false, visualReviewReady: true, limitations: [],
});

function candidate(id: string, address: string, score: number): RecordedSoldComparableCandidate {
  return {
    soldRecord: { provider: 'rentcast', providerPropertyId: id, assessorId: null,
      retrievedAt: '2026-09-12T00:00:00.000Z', formattedAddress: `${address}, Honolulu, HI 96825`,
      addressLine1: address, city: 'Honolulu', state: 'HI', zipCode: '96825', latitude: null,
      longitude: null, propertyType: 'Single Family', bedrooms: 4, bathrooms: 3,
      livingAreaSqft: 1800, lotSizeSqft: 5000, yearBuilt: 1970, saleTransactions: [],
      latestValidSale: null, saleTransactionAmbiguous: false, transactionQuality: 'UNKNOWN' },
    recordedSalePrice: 1550000, recordedSaleDate: '2026-04-08T00:00:00.000Z',
    recordedSalePricePerSqft: { value: 850, status: 'CALCULATED', source: 'rentcast', retrievedAt: null,
      effectiveDate: null, providerPropertyId: id, confidence: null },
    distanceFromSubjectMiles: { value: .64, status: 'CALCULATED', source: 'rentcast', retrievedAt: null,
      effectiveDate: null, providerPropertyId: id, confidence: null },
    daysSinceSale: { value: 150, status: 'CALCULATED', source: 'rentcast', retrievedAt: null,
      effectiveDate: null, providerPropertyId: id, confidence: null },
    sqftDifference: { value: 100, status: 'CALCULATED', source: 'rentcast', retrievedAt: null, effectiveDate: null, providerPropertyId: id, confidence: null },
    sqftDifferencePercent: { value: 5, status: 'CALCULATED', source: 'rentcast', retrievedAt: null, effectiveDate: null, providerPropertyId: id, confidence: null },
    bedroomDifference: { value: 0, status: 'CALCULATED', source: 'rentcast', retrievedAt: null, effectiveDate: null, providerPropertyId: id, confidence: null },
    bathroomDifference: { value: 0, status: 'CALCULATED', source: 'rentcast', retrievedAt: null, effectiveDate: null, providerPropertyId: id, confidence: null },
    lotSizeDifference: { value: 0, status: 'CALCULATED', source: 'rentcast', retrievedAt: null, effectiveDate: null, providerPropertyId: id, confidence: null },
    lotSizeDifferencePercent: { value: 0, status: 'CALCULATED', source: 'rentcast', retrievedAt: null, effectiveDate: null, providerPropertyId: id, confidence: null },
    yearBuiltDifference: { value: 0, status: 'CALCULATED', source: 'rentcast', retrievedAt: null, effectiveDate: null, providerPropertyId: id, confidence: null },
    evidenceStatus: 'VERIFIED_RECORD', baselineCompQuality: 'ACCEPTABLE', compQuality: 'GOOD',
    qualityScore: score, qualityChecks: { recordedSale: 'PASS', recency: 'PASS', proximity: 'PASS',
      propertyType: 'PASS', structuralCompatibility: 'PASS', livingArea: 'PASS', bedrooms: 'PASS',
      bathrooms: 'PASS', lotSize: 'PASS', yearBuilt: 'PASS', specialCharacteristics: 'UNAVAILABLE',
      missingDataBurden: 'PARTIAL' }, primaryQualityBlocker: null, weightedAssessment: assessment(score),
    qualityReasons: [], penaltyReasons: [], hardInvalidReasons: [], limitations: [], recordMatchStrength: 'EXACT',
    avmOverlap: false, providerCorrelation: null,
  };
}

const review = (id: string, compatibility: ConditionCompatibility): UserCompConditionReview => ({
  candidateProviderPropertyId: id, targetCondition: 'FULL_RENOVATION', observedCondition: 'UNKNOWN',
  reviewStatus: compatibility === 'UNKNOWN' ? 'UNKNOWN' : compatibility === 'MATCHES_TARGET'
    ? 'VISUALLY_SIMILAR' : compatibility === 'PARTIAL_MATCH' ? 'PARTIALLY_SIMILAR' : 'NOT_COMPARABLE',
  conditionCompatibility: compatibility, userConfirmed: true, evidenceStatus: 'USER_PROVIDED',
  reviewedAt: '2026-09-12T12:00:00.000Z', notes: null,
});

describe('ARV visual comp review domain', () => {
  it('keeps all eligibility states conservative and structural score untouched', () => {
    const base = assessment(84.5);
    expect(evaluateArvCompReviewEligibility(base, null)).toBe('CONDITION_REVIEW_PENDING');
    expect(evaluateArvCompReviewEligibility(base, review('a', 'MATCHES_TARGET'))).toBe('CONDITION_MATCH');
    expect(evaluateArvCompReviewEligibility(base, review('a', 'PARTIAL_MATCH'))).toBe('CONDITION_PARTIAL_MATCH');
    expect(evaluateArvCompReviewEligibility(base, review('a', 'SUPERIOR_TO_TARGET'))).toBe('CONDITION_MISMATCH');
    expect(evaluateArvCompReviewEligibility(base, review('a', 'INFERIOR_TO_TARGET'))).toBe('CONDITION_MISMATCH');
    expect(evaluateArvCompReviewEligibility(base, review('a', 'DIFFERENT_PRODUCT_CLASS'))).toBe('DIFFERENT_PRODUCT_CLASS');
    expect(evaluateArvCompReviewEligibility(base, review('a', 'NOT_COMPARABLE'))).toBe('NOT_COMPARABLE');
    expect(evaluateArvCompReviewEligibility(base, review('a', 'UNKNOWN'))).toBe('CONDITION_UNKNOWN');
    expect(base.structuralComparabilityScore).toBe(84.5);
  });

  it('aggregates zero, partial, ready, and insufficient review sets with configurable minimum', () => {
    const ids = ['a', 'b', 'c'];
    expect(summarizeArvCompReviewSet({ candidateProviderPropertyIds: ids, reviews: [] }).status).toBe('NOT_STARTED');
    expect(summarizeArvCompReviewSet({ candidateProviderPropertyIds: ids, reviews: [review('a', 'UNKNOWN')] }).status).toBe('IN_PROGRESS');
    expect(summarizeArvCompReviewSet({ candidateProviderPropertyIds: ids,
      reviews: [review('a', 'MATCHES_TARGET'), review('b', 'PARTIAL_MATCH')] }).status).toBe('READY_FOR_ARV_EVALUATION');
    expect(summarizeArvCompReviewSet({ candidateProviderPropertyIds: ids,
      reviews: [review('a', 'UNKNOWN'), review('b', 'NOT_COMPARABLE'), review('c', 'DIFFERENT_PRODUCT_CLASS')] }).status)
      .toBe('INSUFFICIENT_CONDITION_EVIDENCE');
  });

  it('rehydrates USER_PROVIDED reviews and exposes the three real cached candidates without calculating ARV', () => {
    const candidates = [candidate('kekauluohi', '436 Kekauluohi St', 84.5),
      candidate('kumukahi', '777 Kumukahi Pl', 81.79), candidate('kauhako', '7304 Kauhako St', 80)];
    const row = { comp_identifier: 'kekauluohi', target_condition: 'FULL_RENOVATION' as const,
      observed_condition: 'STANDARD_RENOVATION' as const, condition_compatibility: 'PARTIAL_MATCH' as const,
      notes: 'User observation', evidence_status: 'USER_PROVIDED' as const,
      reviewed_at: '2026-09-12T12:00:00.000Z' };
    expect(persistedRowToReview(row).evidenceStatus).toBe('USER_PROVIDED');
    const firstLoad = buildArvVisualCompReviewPayload({ propertyId: 'e86dd292-429d-4b51-9b02-bc60a3e9068f',
      targetCondition: 'FULL_RENOVATION', candidates, persistedReviews: [row] });
    const reload = buildArvVisualCompReviewPayload({ propertyId: firstLoad.propertyId,
      targetCondition: 'FULL_RENOVATION', candidates, persistedReviews: [row] });
    expect(reload.candidates.map((item) => item.address.line1)).toEqual([
      '436 Kekauluohi St', '777 Kumukahi Pl', '7304 Kauhako St',
    ]);
    expect(reload.candidates[0].review).toEqual(firstLoad.candidates[0].review);
    expect(reload.candidates.map((item) => item.structuralComparabilityScore)).toEqual([84.5, 81.79, 80]);
    expect(reload).toMatchObject({ arvCalculated: false, maoCalculated: false, providerCalls: 0 });
  });

  it('enforces own-user RLS and idempotent upsert keys in the migration', () => {
    const sql = readFileSync(new URL('../../../migrations/20260912160000_arv_visual_comp_reviews.sql', import.meta.url), 'utf8');
    expect(sql).toMatch(/reviewer_user_id\s*=\s*auth\.uid\(\)/);
    expect(sql).toMatch(/ds_has_property_intelligence_entitlement/);
    expect(sql).toMatch(/unique \(subject_property_id, reviewer_user_id, comp_identifier\)/);
    expect(sql).not.toMatch(/grant\s+(all|delete).*authenticated/i);
  });
});
