import type { ArvEvaluationResult } from './arvEngine.ts';
import type { RecordedSoldComparableCandidate } from './soldTypes.ts';
import type { NormalizedValuationSubject } from './valuationTypes.ts';

export type CompPromotionClassification = 'SELECTED' | 'SUPPORTING' | 'EXCLUDED' | 'UNRESOLVED';

export function classifyMarketSubmarketCompatibility(
  subject: Pick<NormalizedValuationSubject, 'city' | 'zipCode'>,
  candidate: { city: string | null; zipCode: string | null },
) {
  const sameCity = String(candidate.city || '').trim().toLowerCase()
    === String(subject.city.value || '').trim().toLowerCase();
  const sameZip = String(candidate.zipCode || '').trim() === String(subject.zipCode.value || '').trim();
  return sameCity && sameZip ? 'SAME_CITY_AND_ZIP' as const
    : sameCity ? 'SAME_CITY_DIFFERENT_ZIP' as const
      : sameZip ? 'SAME_ZIP_DIFFERENT_CITY' as const : 'DIFFERENT_CITY_AND_ZIP' as const;
}

export function buildStructuralCandidatePromotionDiagnostic(
  candidate: RecordedSoldComparableCandidate,
  subject: NormalizedValuationSubject,
) {
  const assessment = candidate.weightedAssessment;
  const majorRoad = assessment?.checks.find((check) => check.key === 'majorRoadBarrier');
  const recency = assessment?.checks.find((check) => check.key === 'recency');
  return {
    candidateId: candidate.soldRecord.providerPropertyId,
    address: candidate.soldRecord.formattedAddress,
    salePrice: candidate.recordedSalePrice,
    saleDate: candidate.recordedSaleDate,
    distanceMiles: candidate.distanceFromSubjectMiles.value,
    beds: candidate.soldRecord.bedrooms,
    baths: candidate.soldRecord.bathrooms,
    livingAreaSqft: candidate.soldRecord.livingAreaSqft,
    yearBuilt: candidate.soldRecord.yearBuilt,
    propertyType: candidate.soldRecord.propertyType,
    bedsDelta: candidate.bedroomDifference.value,
    bathsDelta: candidate.bathroomDifference.value,
    sqftDelta: candidate.sqftDifference.value,
    yearBuiltDelta: candidate.yearBuiltDifference.value,
    structuralComparabilityScore: assessment?.structuralComparabilityScore ?? null,
    dataCompletenessScore: assessment?.dataCompletenessScore ?? null,
    hardGatesPass: assessment?.hardGates.pass === true,
    subjectCondition: null as string | null,
    candidateCondition: 'UNKNOWN',
    conditionEvidenceSource: null as string | null,
    conditionCompatibilityStatus: 'UNKNOWN',
    marketSubmarketCompatibility: classifyMarketSubmarketCompatibility(subject, candidate.soldRecord),
    subdivisionCompatibility: 'UNKNOWN',
    majorRoadRuleResult: majorRoad?.status === 'UNKNOWN' ? 'UNKNOWN' : majorRoad?.reason || 'NOT_IMPLEMENTED',
    saleRecencyResult: recency?.reason || 'UNKNOWN',
    finalClassification: 'UNRESOLVED' as CompPromotionClassification,
    promotionBlockers: assessment?.primaryEligibilityBlockers || [],
  };
}

export function finalizeCompPromotionDiagnostic(
  diagnostic: ReturnType<typeof buildStructuralCandidatePromotionDiagnostic>,
  evaluation: ArvEvaluationResult,
) {
  const evaluated = evaluation.valuationSet.find((candidate) => candidate.compIdentifier === diagnostic.candidateId);
  const finalClassification: CompPromotionClassification = evaluated?.valuationEligibility === 'INCLUDED' ? 'SELECTED'
    : evaluated?.valuationEligibility === 'SUPPORTING_ONLY' ? 'SUPPORTING'
      : evaluated?.valuationEligibility === 'EXCLUDED' ? 'EXCLUDED' : 'UNRESOLVED';
  return {
    ...diagnostic,
    subjectCondition: evaluation.targetCondition,
    candidateCondition: evaluated?.candidateCondition || 'UNKNOWN',
    conditionEvidenceSource: evaluated?.conditionEvidenceStatus || null,
    conditionCompatibilityStatus: evaluated?.conditionCompatibility === 'UNREVIEWED'
      ? 'UNKNOWN' : evaluated?.conditionCompatibility || 'UNKNOWN',
    finalClassification,
    promotionBlockers: [...new Set([
      ...diagnostic.promotionBlockers,
      ...(evaluated?.exclusionReason ? [evaluated.exclusionReason] : []),
    ])],
  };
}
