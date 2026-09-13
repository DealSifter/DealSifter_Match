import type { RecordedSoldComparableCandidate } from './soldTypes.ts';
import { evaluateArv } from './arvEngine.ts';
import {
  CONDITION_COMPATIBILITIES,
  createUserCompConditionReview,
  evaluateArvCompReviewEligibility,
  summarizeArvCompReviewSet,
  TARGET_CONDITIONS,
  type ConditionCompatibility,
  type ObservedCondition,
  type TargetCondition,
  type UserCompConditionReview,
} from './weightedCompTypes.ts';

export const ARV_VISUAL_COMP_REVIEW_POLICY_VERSION = 'ARV_VISUAL_COMP_REVIEW_V1' as const;
export const DEFAULT_MINIMUM_COMPATIBLE_COMPS = 2;

export type PersistedCompReviewRow = {
  comp_identifier: string;
  target_condition: TargetCondition;
  observed_condition: ObservedCondition;
  condition_compatibility: ConditionCompatibility;
  notes: string | null;
  evidence_status: 'USER_PROVIDED';
  reviewed_at: string;
  reviewer_user_id?: string;
  policy_version?: string;
};

export function isTargetCondition(value: unknown): value is TargetCondition {
  return TARGET_CONDITIONS.includes(String(value || '') as TargetCondition);
}

export function isConditionCompatibility(value: unknown): value is ConditionCompatibility {
  return CONDITION_COMPATIBILITIES.includes(String(value || '') as ConditionCompatibility);
}

export function reviewStatusForCompatibility(value: ConditionCompatibility) {
  if (value === 'MATCHES_TARGET') return 'VISUALLY_SIMILAR' as const;
  if (value === 'PARTIAL_MATCH') return 'PARTIALLY_SIMILAR' as const;
  if (value === 'SUPERIOR_TO_TARGET') return 'SUPERIOR_TO_TARGET' as const;
  if (value === 'INFERIOR_TO_TARGET') return 'INFERIOR_TO_TARGET' as const;
  if (value === 'UNKNOWN') return 'UNKNOWN' as const;
  return 'NOT_COMPARABLE' as const;
}

export function persistedRowToReview(row: PersistedCompReviewRow): UserCompConditionReview {
  return createUserCompConditionReview({
    candidateProviderPropertyId: row.comp_identifier,
    targetCondition: row.target_condition,
    observedCondition: row.observed_condition,
    conditionCompatibility: row.condition_compatibility,
    reviewStatus: reviewStatusForCompatibility(row.condition_compatibility),
    reviewedAt: row.reviewed_at,
    notes: row.notes,
  });
}

export function buildArvVisualCompReviewPayload(input: {
  propertyId: string;
  targetCondition?: TargetCondition | null;
  candidates: RecordedSoldComparableCandidate[];
  persistedReviews?: PersistedCompReviewRow[];
  minimumCompatibleComps?: number;
  subjectLivingAreaSqft?: number | null;
  cachedProviderAvm?: { value: number | null; evidenceStatus: 'ESTIMATED' | 'UNAVAILABLE' } | null;
  calculatedAt?: string;
}) {
  const targetCondition = input.targetCondition || 'UNKNOWN';
  const reviews = (input.persistedReviews || [])
    .filter((row) => row.target_condition === targetCondition)
    .map(persistedRowToReview);
  const reviewByIdentifier = new Map(reviews.map((review) => [review.candidateProviderPropertyId, review]));
  const candidates = input.candidates
    .filter((candidate) => Boolean(candidate.soldRecord.providerPropertyId && candidate.weightedAssessment?.visualReviewReady))
    .map((candidate) => {
      const stableCompIdentifier = String(candidate.soldRecord.providerPropertyId);
      const review = reviewByIdentifier.get(stableCompIdentifier) || null;
      return {
        stableCompIdentifier,
        address: {
          line1: candidate.soldRecord.addressLine1,
          city: candidate.soldRecord.city,
          state: candidate.soldRecord.state,
          zipCode: candidate.soldRecord.zipCode,
          formatted: candidate.soldRecord.formattedAddress,
        },
        propertyType: candidate.soldRecord.propertyType,
        structuralComparabilityScore: candidate.weightedAssessment!.structuralComparabilityScore,
        dataCompletenessScore: candidate.weightedAssessment!.dataCompletenessScore,
        distanceMiles: candidate.distanceFromSubjectMiles.value,
        recordedSalePrice: candidate.recordedSalePrice,
        recordedSaleDate: candidate.recordedSaleDate,
        recordedSaleEvidenceStatus: candidate.evidenceStatus,
        livingAreaSqft: candidate.soldRecord.livingAreaSqft,
        structuralEvidenceStatus: 'CALCULATED' as const,
        saleEvidenceStatus: candidate.evidenceStatus,
        review,
        reviewEligibility: evaluateArvCompReviewEligibility(candidate.weightedAssessment!, review),
      };
    });
  const summary = summarizeArvCompReviewSet({
    candidateProviderPropertyIds: candidates.map((candidate) => candidate.stableCompIdentifier),
    reviews,
    minimumCompatibleComps: input.minimumCompatibleComps ?? DEFAULT_MINIMUM_COMPATIBLE_COMPS,
  });
  const arvEvaluation = evaluateArv({
    subjectPropertyId: input.propertyId,
    subjectLivingAreaSqft: input.subjectLivingAreaSqft ?? null,
    targetCondition,
    calculatedAt: input.calculatedAt,
    cachedProviderAvm: input.cachedProviderAvm,
    candidates: input.candidates.map((candidate) => {
      const compIdentifier = candidate.soldRecord.providerPropertyId;
      const review = reviewByIdentifier.get(compIdentifier) || null;
      return {
        source: 'ARV_COMP_CANDIDATE' as const,
        compIdentifier,
        address: candidate.soldRecord.formattedAddress,
        recordedSalePrice: candidate.recordedSalePrice,
        recordedSaleDate: candidate.recordedSaleDate,
        recordedSaleEvidenceStatus: candidate.evidenceStatus,
        livingAreaSqft: candidate.soldRecord.livingAreaSqft,
        structuralComparabilityScore: candidate.weightedAssessment?.structuralComparabilityScore ?? 0,
        dataCompletenessScore: candidate.weightedAssessment?.dataCompletenessScore ?? 0,
        hardGatesPass: candidate.weightedAssessment?.hardGates.pass === true,
        recordAmbiguousOrCorrupt: candidate.soldRecord.saleTransactionAmbiguous
          || candidate.hardInvalidReasons.length > 0,
        distanceMiles: candidate.distanceFromSubjectMiles.value,
        daysSinceSale: candidate.daysSinceSale.value,
        transactionQuality: candidate.soldRecord.transactionQuality,
        conditionCompatibility: review?.conditionCompatibility || 'UNREVIEWED' as const,
        conditionEvidenceStatus: review?.evidenceStatus || null,
      };
    }),
  });
  return {
    propertyId: input.propertyId,
    policyVersion: ARV_VISUAL_COMP_REVIEW_POLICY_VERSION,
    targetCondition,
    targetConditionEvidenceStatus: input.targetCondition ? 'USER_PROVIDED' as const : null,
    candidates,
    summary,
    arvEvaluation,
    arvCalculated: arvEvaluation.status !== 'ARV_UNAVAILABLE',
    maoCalculated: false as const,
    providerCalls: 0 as const,
  };
}
