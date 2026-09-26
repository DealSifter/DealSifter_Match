import { describe, expect, it } from 'vitest';
import { buildMaxxisDealIntelligenceReport } from '../../../../src/features/maxxis/intelligence/maxxisDealIntelligenceReport.js';
import { buildMaxxisStructuredAnalysis } from '../maxxis/maxxisStructuredAnalysis.ts';
import { buildArvVisualCompReviewPayload } from './arvVisualCompReview.ts';
import {
  buildArvValuationSet,
  DEALSIFTER_ARV_ENGINE_POLICY_V1,
  evaluateArv,
  type ArvEngineCandidate,
} from './arvEngine.ts';
import { classifyMarketSubmarketCompatibility } from './compPromotion.ts';
import { selectRecordedSoldComparables } from './soldCompEngine.ts';
import { mapRentCastSoldRecordPool } from './soldMapper.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';
import { DEALSIFTER_WEIGHTED_COMP_POLICY_V1 } from './weightedCompPolicy.ts';

const NOW = '2026-09-26T03:50:36.138Z';
const SECONDARY = 'SECONDARY_PROXIMITY_WITHOUT_MICRO_MARKET_EVIDENCE';
const dalegrove = [
  ['12750-Moorpark-St,-Studio-City,-CA-91604', '12750 Moorpark St, Studio City, CA 91604', 81.36, 2.49714585590986],
  ['12420-Milbank-St,-Studio-City,-CA-91604', '12420 Milbank St, Studio City, CA 91604', 81.36, 2.648251339365571],
  ['12302-Sarah-St,-Studio-City,-CA-91604', '12302 Sarah St, Studio City, CA 91604', 82.07, 2.7102914953457296],
  ['12509-Rye-St,-Studio-City,-CA-91604', '12509 Rye St, Studio City, CA 91604', 80.14, 2.5824259944338737],
  ['12354-Sarah-St,-Studio-City,-CA-91604', '12354 Sarah St, Studio City, CA 91604', 81.71, 2.7092515795501284],
] as const;

function engineCandidate(entry = dalegrove[0], overrides: Partial<ArvEngineCandidate> = {}): ArvEngineCandidate {
  return {
    source: 'ARV_COMP_CANDIDATE', compIdentifier: entry[0], address: entry[1],
    recordedSalePrice: 2_000_000, recordedSaleDate: '2026-05-08T00:00:00.000Z',
    recordedSaleEvidenceStatus: 'VERIFIED_RECORD', bedrooms: 3, bathrooms: 2, livingAreaSqft: 1_838,
    structuralComparabilityScore: entry[2], dataCompletenessScore: 70, hardGatesPass: true,
    recordAmbiguousOrCorrupt: false, distanceMiles: entry[3], daysSinceSale: 141,
    transactionQuality: 'UNKNOWN', promotionBlockers: [SECONDARY], candidateCondition: 'UNKNOWN',
    conditionCompatibility: 'UNREVIEWED', conditionEvidenceStatus: null, ...overrides,
  };
}

function evaluate(candidates: ArvEngineCandidate[]) {
  return evaluateArv({ subjectPropertyId: 'dalegrove', subjectLivingAreaSqft: 1_838,
    targetCondition: 'FULL_RENOVATION', candidates, calculatedAt: NOW });
}

function directSelection() {
  const lookup = { street: '9537 Dalegrove Dr', city: 'Beverly Hills', state: 'CA', zipCode: '90210' };
  const valuation = mapRentCastValueEstimate({ lookup, requestPolicy: DEFAULT_VALUATION_REQUEST_POLICY,
    retrievedAt: NOW, raw: { price: 2_195_000, subjectProperty: { id: 'dalegrove',
      addressLine1: lookup.street, city: lookup.city, state: lookup.state, zipCode: lookup.zipCode,
      latitude: 34.114480746963, longitude: -118.402927451955, propertyType: 'Single Family',
      bedrooms: 3, bathrooms: 2, squareFootage: 1_838, lotSize: 8_316, yearBuilt: 1950 } } });
  const records = mapRentCastSoldRecordPool({ policy: { radiusMiles: 5, saleDateRangeDays: 270,
    propertyType: 'Single Family', limit: 100 }, queryFingerprint: 'd'.repeat(64), retrievedAt: NOW,
  records: [{ id: 'fixture', formattedAddress: 'Fixture, Beverly Hills, CA 90210', addressLine1: 'Fixture',
    city: 'Beverly Hills', state: 'CA', zipCode: '90210', latitude: 34.124480746963,
    longitude: -118.402927451955, propertyType: 'Single Family', bedrooms: 3, bathrooms: 2,
    squareFootage: 1_505, lotSize: 8_238, yearBuilt: 1940, lastSaleDate: '2026-05-08',
    lastSalePrice: 3_000_000 }] }).records;
  return { valuation, selection: selectRecordedSoldComparables(valuation, records) };
}

describe('final structural candidate promotion correction', () => {
  it('1. traces all five cached Dalegrove structural candidates to SUPPORTING with exact blocker', () => {
    const result = evaluate(dalegrove.map((entry) => engineCandidate(entry)));
    expect(result.valuationSet).toHaveLength(5);
    result.valuationSet.forEach((candidate, index) => expect(candidate).toMatchObject({
      compIdentifier: dalegrove[index][0], structuralComparabilityScore: dalegrove[index][2],
      dataCompletenessScore: 70, candidateCondition: 'UNKNOWN', valuationRole: 'SUPPORTING',
      valuationEligibility: 'SUPPORTING_ONLY', exclusionReason: SECONDARY,
    }));
  });

  it('2. carries the resolved subject condition into the promotion result', () => {
    expect(evaluate([engineCandidate()]).targetCondition).toBe('FULL_RENOVATION');
  });

  it('3. does not treat UNKNOWN candidate condition as factual incompatibility', () => {
    const candidate = engineCandidate(dalegrove[0], { promotionBlockers: [], candidateCondition: 'UNKNOWN' });
    expect(evaluate([candidate]).valuationSet[0]).toMatchObject({ valuationRole: 'SUPPORTING',
      exclusionReason: 'CONDITION_REVIEW_PENDING' });
  });

  it('4. does not confirm an UNKNOWN-condition candidate when verification is required', () => {
    expect(evaluate([engineCandidate(dalegrove[0], { promotionBlockers: [] })]).eligibleCompCount).toBe(0);
  });

  it('5. retains UNKNOWN-condition evidence as SUPPORTING', () => {
    expect(evaluate([engineCandidate(dalegrove[0], { promotionBlockers: [] })]).supportingCompCount).toBe(1);
  });

  it('6. promotes a confirmed condition-compatible local candidate to SELECTED', () => {
    const result = evaluate([engineCandidate(dalegrove[0], { promotionBlockers: [], distanceMiles: .4,
      candidateCondition: 'FULL_RENOVATION', conditionCompatibility: 'MATCHES_TARGET',
      conditionEvidenceStatus: 'USER_PROVIDED' })]);
    expect(result.valuationSet[0]).toMatchObject({ valuationRole: 'PRIMARY', valuationEligibility: 'INCLUDED' });
  });

  it('7. retains a structurally valid but locality-unconfirmed candidate as SUPPORTING', () => {
    expect(evaluate([engineCandidate()]).valuationSet[0].valuationEligibility).toBe('SUPPORTING_ONLY');
  });

  it('8. preserves an exact material exclusion reason', () => {
    const result = evaluate([engineCandidate(dalegrove[0], { promotionBlockers: [],
      candidateCondition: 'FULL_RENOVATION', conditionCompatibility: 'NOT_COMPARABLE',
      conditionEvidenceStatus: 'USER_PROVIDED' })]);
    expect(result.valuationSet[0]).toMatchObject({ valuationEligibility: 'EXCLUDED', exclusionReason: 'NOT_COMPARABLE' });
  });

  it('9. does not subtract score or completeness again for missing condition', () => {
    const result = evaluate([engineCandidate(dalegrove[0], { promotionBlockers: [] })]).valuationSet[0];
    expect([result.structuralComparabilityScore, result.dataCompletenessScore]).toEqual([81.36, 70]);
  });

  it('10. rejects an invalid sale date without widening the recency rule', () => {
    const result = buildArvValuationSet({ subjectPropertyId: 'dalegrove', subjectLivingAreaSqft: 1_838,
      targetCondition: 'FULL_RENOVATION', candidates: [engineCandidate(dalegrove[0], {
        promotionBlockers: [], recordedSaleDate: 'invalid', conditionCompatibility: 'MATCHES_TARGET',
        conditionEvidenceStatus: 'USER_PROVIDED' })] });
    expect(result.excluded[0].exclusionReason).toBe('MISSING_RECORDED_SALE_DATE');
  });

  it('11. calculates coordinate distance in miles', () => {
    const miles = directSelection().selection.directSoldCompCandidates[0].distanceFromSubjectMiles.value;
    expect(miles).toBeGreaterThan(.68);
    expect(miles).toBeLessThan(.70);
  });

  it('12. calculates the subject living-area delta without unit conversion', () => {
    expect(directSelection().selection.directSoldCompCandidates[0].sqftDifference.value).toBe(333);
  });

  it('13. calculates the subject year-built delta exactly', () => {
    expect(directSelection().selection.directSoldCompCandidates[0].yearBuiltDifference.value).toBe(10);
  });

  it('14. reports exact city and ZIP compatibility instead of a vague market mismatch', () => {
    const { valuation } = directSelection();
    expect(classifyMarketSubmarketCompatibility(valuation.subjectProperty,
      { city: 'Studio City', zipCode: '91604' })).toBe('DIFFERENT_CITY_AND_ZIP');
  });

  it('15. keeps SUPPORTING semantically distinct from EXCLUDED', () => {
    const result = evaluate([engineCandidate(), engineCandidate(dalegrove[1], { promotionBlockers: [],
      conditionCompatibility: 'NOT_COMPARABLE', conditionEvidenceStatus: 'USER_PROVIDED' })]);
    expect([result.supportingCompCount, result.excludedCompCount]).toEqual([1, 1]);
  });

  it('16. leaves ARV unavailable when there are no eligible confirmed comps', () => {
    expect(evaluate(dalegrove.map((entry) => engineCandidate(entry)))).toMatchObject({
      status: 'ARV_UNAVAILABLE', eligibleCompCount: 0, supportingCompCount: 5, centralReference: null,
    });
  });

  it('17. gives Maxxis a grouped human explanation for retained supporting evidence', () => {
    const result = evaluate(dalegrove.map((entry) => engineCandidate(entry)));
    const comparableEvidence = result.valuationSet.map((item) => ({ ...item, distanceMiles: item.distanceMiles }));
    const analysis = buildMaxxisStructuredAnalysis({ dealIntelligence: { comparableEvidence },
      compPromotionDiagnostics: dalegrove.map((entry) => ({ candidateId: entry[0],
        finalClassification: 'SUPPORTING', rejectionReasons: [SECONDARY] })) }, 'DEAL_INTELLIGENCE', 'en');
    expect(analysis.comparablesAnalysis.interpretation).toContain('5 structurally relevant sales');
    expect(JSON.stringify(analysis.comparablesAnalysis)).not.toContain(SECONDARY);
  });

  it('18. prevents report language from saying no comps when supporting comps exist', () => {
    const support = evaluate([engineCandidate()]).valuationSet[0];
    const report = buildMaxxisDealIntelligenceReport({ type: 'deal_intelligence_context', propertyId: 'dalegrove',
      propertyContext: { fields: {}, unknownFields: [] }, investorContext: {}, evidenceSummary: {},
      valuationContext: { status: 'ARV_UNAVAILABLE', warnings: [], confidence: 'LOW', compsUsed: 0 },
      comparableEvidence: [support], risks: [], opportunities: [], limitations: [], recommendedActions: [] });
    expect(report.limitations.join(' ')).toContain('retained as supporting market evidence');
    expect(report.limitations.join(' ')).not.toContain('comparables used by the existing evaluation: NONE');
  });

  it('19. makes zero provider calls during cached promotion evaluation', () => {
    const { valuation, selection } = directSelection();
    const payload = buildArvVisualCompReviewPayload({ propertyId: 'dalegrove', targetCondition: 'FULL_RENOVATION',
      candidates: [selection.directSoldCompCandidates[0]], subjectLivingAreaSqft: valuation.subjectProperty.livingAreaSqft.value });
    expect(payload.providerCalls).toBe(0);
  });

  it('20. preserves all canonical structural and ARV thresholds', () => {
    expect(DEALSIFTER_WEIGHTED_COMP_POLICY_V1).toMatchObject({ arvCandidateThreshold: 80,
      minimumPrimaryDataCompleteness: 65, scoreClasses: { excellent: 90, valid: 80, supporting: 70 } });
    expect(DEALSIFTER_ARV_ENGINE_POLICY_V1).toMatchObject({ structuralScoreFloor: 80,
      completenessFloor: 65, minimumEligibleComps: 2 });
  });
});
