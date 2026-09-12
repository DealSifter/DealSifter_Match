export const TARGET_CONDITIONS = [
  'AS_IS',
  'LIGHT_REHAB',
  'STANDARD_RENOVATION',
  'FULL_RENOVATION',
  'HIGH_END',
  'TURN_KEY',
  'NEW_CONSTRUCTION',
  'UNKNOWN',
] as const;

export type TargetCondition = typeof TARGET_CONDITIONS[number];
export type ObservedCondition = TargetCondition;

export const CONDITION_REVIEW_STATUSES = [
  'UNREVIEWED',
  'UNKNOWN',
  'VISUALLY_SIMILAR',
  'PARTIALLY_SIMILAR',
  'SUPERIOR_TO_TARGET',
  'INFERIOR_TO_TARGET',
  'NOT_COMPARABLE',
] as const;

export type ConditionReviewStatus = typeof CONDITION_REVIEW_STATUSES[number];

export const CONDITION_COMPATIBILITIES = [
  'MATCHES_TARGET',
  'PARTIAL_MATCH',
  'SUPERIOR_TO_TARGET',
  'INFERIOR_TO_TARGET',
  'DIFFERENT_PRODUCT_CLASS',
  'UNKNOWN',
] as const;

export type ConditionCompatibility = typeof CONDITION_COMPATIBILITIES[number];

export type UserCompConditionReview = {
  candidateProviderPropertyId: string | null;
  observedCondition: ObservedCondition;
  targetCondition: TargetCondition;
  reviewStatus: Exclude<ConditionReviewStatus, 'UNREVIEWED'>;
  conditionCompatibility: ConditionCompatibility;
  userConfirmed: boolean;
  evidenceStatus: 'USER_PROVIDED';
  reviewedAt: string;
  notes: string | null;
};

export function createUserCompConditionReview(input: Omit<UserCompConditionReview,
  'evidenceStatus' | 'userConfirmed'>): UserCompConditionReview {
  if (!input.reviewedAt || !Number.isFinite(Date.parse(input.reviewedAt))) {
    throw new Error('CONDITION_REVIEW_TIMESTAMP_REQUIRED');
  }
  return { ...input, evidenceStatus: 'USER_PROVIDED', userConfirmed: true };
}

export type WeightedCheckStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type WeightedCheckKey =
  | 'subdivision'
  | 'majorRoadBarrier'
  | 'distance'
  | 'propertyType'
  | 'storyStyle'
  | 'livingArea'
  | 'yearBuilt'
  | 'lotSize'
  | 'bedrooms'
  | 'bathrooms'
  | 'pool'
  | 'garage'
  | 'otherFeatures'
  | 'recency'
  | 'trafficFreeway';

export type WeightedCheckResult = {
  key: WeightedCheckKey;
  status: WeightedCheckStatus;
  weight: number;
  earnedWeight: number;
  factor: number | null;
  reason: string;
};

export type WeightedHardGateResult = {
  pass: boolean;
  checks: {
    recordedSalePrice: boolean;
    recordedSaleDate: boolean;
    usablePropertyRecord: boolean;
    compatiblePropertyType: boolean;
    sufficientLivingAreaEvidence: boolean;
    nonCorruptRecord: boolean;
  };
  failures: string[];
};

export type WeightedStructuralClass =
  | 'EXCELLENT_STRUCTURAL_CANDIDATE'
  | 'VALID_STRUCTURAL_CANDIDATE'
  | 'SUPPORTING_ACCEPTABLE'
  | 'WEAK'
  | 'INVALID';

export type WeightedCompAssessment = {
  policyVersion: 'DEALSIFTER_WEIGHTED_COMP_POLICY_V1';
  structuralComparabilityScore: number;
  dataCompletenessScore: number;
  structuralClass: WeightedStructuralClass;
  hardGates: WeightedHardGateResult;
  checks: WeightedCheckResult[];
  primaryArvCompCandidate: boolean;
  primaryEligibilityBlockers: string[];
  conditionReviewStatus: 'UNREVIEWED';
  conditionCompatibility: 'UNKNOWN';
  targetCondition: 'UNKNOWN';
  confirmedArvComp: false;
  visualReviewReady: boolean;
  limitations: string[];
};

export type CompSupplementalStructuralEvidence = {
  sameSubdivision?: boolean | null;
  majorRoadRelation?: 'NO_BARRIER' | 'SEPARATED' | null;
  sameStoryStyle?: boolean | null;
  poolMatch?: boolean | null;
  garageMatch?: boolean | null;
  otherFeatureCompatibility?: boolean | null;
  trafficFreewayRelation?: 'SIMILAR' | 'DIFFERENT' | null;
};

export function attachUserConditionReview(assessment: WeightedCompAssessment, review: UserCompConditionReview) {
  const arvUseStatus = review.reviewStatus === 'NOT_COMPARABLE'
    || review.conditionCompatibility === 'DIFFERENT_PRODUCT_CLASS' ? 'REJECTED' as const
    : ['SUPERIOR_TO_TARGET', 'INFERIOR_TO_TARGET'].includes(review.conditionCompatibility)
      ? 'ADJUSTMENT_REQUIRED' as const : 'USER_REVIEWED_CANDIDATE' as const;
  return {
    structuralAssessment: assessment,
    conditionReview: review,
    arvUseStatus,
    confirmedArvComp: false as const,
  };
}
