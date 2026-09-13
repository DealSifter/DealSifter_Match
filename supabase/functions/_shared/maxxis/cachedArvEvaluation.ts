import {
  buildArvVisualCompReviewPayload,
  isTargetCondition,
  type PersistedCompReviewRow,
} from '../property-data/arvVisualCompReview.ts';
import type { ArvEvaluationResult } from '../property-data/arvEngine.ts';
import type { SoldEvidenceResult } from '../property-data/soldTypes.ts';
import type { TargetCondition } from '../property-data/weightedCompTypes.ts';

export async function loadCachedArvEvaluation(input: {
  propertyId: string;
  userId: string;
  hasEntitlement: (propertyId: string) => Promise<boolean>;
  loadCachedSoldEvidence: (propertyId: string, userId: string) => Promise<SoldEvidenceResult | null>;
  loadTargetCondition: (propertyId: string, userId: string) => Promise<unknown>;
  loadReviews: (propertyId: string, userId: string) => Promise<PersistedCompReviewRow[]>;
}): Promise<ArvEvaluationResult | null> {
  if (!await input.hasEntitlement(input.propertyId)) return null;
  const soldEvidence = await input.loadCachedSoldEvidence(input.propertyId, input.userId);
  if (!soldEvidence) return null;
  const rawTarget = await input.loadTargetCondition(input.propertyId, input.userId);
  const targetCondition: TargetCondition | null = isTargetCondition(rawTarget) ? rawTarget : null;
  const reviews = targetCondition ? await input.loadReviews(input.propertyId, input.userId) : [];
  return buildArvVisualCompReviewPayload({
    propertyId: input.propertyId,
    targetCondition,
    candidates: soldEvidence.recordedSoldCompSelection.primaryStructuralCandidates,
    persistedReviews: reviews,
    subjectLivingAreaSqft: soldEvidence.valuation.subjectProperty.livingAreaSqft.value,
    cachedProviderAvm: {
      value: soldEvidence.valuation.providerEstimate.value.value,
      evidenceStatus: soldEvidence.valuation.providerEstimate.value.status === 'ESTIMATED' ? 'ESTIMATED' : 'UNAVAILABLE',
    },
  }).arvEvaluation;
}
