import { referenceSetClass } from './compQualityCalibration.ts';
import type { RecordedSoldComparableCandidate } from './soldTypes.ts';
import type {
  CompSupplementalStructuralEvidence,
  WeightedCheckKey,
  WeightedCheckResult,
  WeightedCompAssessment,
  WeightedHardGateResult,
} from './weightedCompTypes.ts';

export type WeightedCompScenario = 'WEIGHTED_BALANCED' | 'APPRAISAL_STYLE_STRICT' | 'LOCALITY_TIME_TRAVEL';

type WeightMap = Record<WeightedCheckKey, number>;

export const DEALSIFTER_WEIGHTED_COMP_POLICY_V1 = Object.freeze({
  version: 'DEALSIFTER_WEIGHTED_COMP_POLICY_V1' as const,
  arvCandidateThreshold: 80,
  minimumPrimaryDataCompleteness: 65,
  valuationDispersionWarningRatio: 1.5,
  scoreClasses: { excellent: 90, valid: 80, supporting: 70 },
  thresholds: {
    distanceMiles: { preferred: 0.5, local: 1, secondary: 3 },
    recencyDays: { veryRecent: 90, recent: 180, older: 270 },
    livingAreaDeltaSqft: { preferred: 200, moderate: 400, material: 600, weak: 800 },
    yearBuiltDelta: { preferred: 5, moderate: 10, material: 20 },
    lotDeltaSqftSingleFamily: { preferred: 2500, moderate: 5000, material: 7500 },
    bedroomDelta: { preferred: 0, moderate: 1, material: 2 },
    bathroomDelta: { preferred: 0, near: 0.5, moderate: 1, material: 2 },
  },
  weights: {
    WEIGHTED_BALANCED: {
      subdivision: 10, majorRoadBarrier: 5, distance: 12, propertyType: 12, storyStyle: 5,
      livingArea: 15, yearBuilt: 7, lotSize: 6, bedrooms: 5, bathrooms: 5, pool: 3,
      garage: 3, otherFeatures: 2, recency: 8, trafficFreeway: 2,
    },
    APPRAISAL_STYLE_STRICT: {
      subdivision: 10, majorRoadBarrier: 5, distance: 13, propertyType: 12, storyStyle: 6,
      livingArea: 17, yearBuilt: 8, lotSize: 7, bedrooms: 5, bathrooms: 5, pool: 2,
      garage: 2, otherFeatures: 1, recency: 5, trafficFreeway: 2,
    },
    LOCALITY_TIME_TRAVEL: {
      subdivision: 18, majorRoadBarrier: 7, distance: 17, propertyType: 12, storyStyle: 5,
      livingArea: 13, yearBuilt: 5, lotSize: 5, bedrooms: 4, bathrooms: 4, pool: 2,
      garage: 2, otherFeatures: 1, recency: 2, trafficFreeway: 3,
    },
  } satisfies Record<WeightedCompScenario, WeightMap>,
});

export const DEALSIFTER_MONETARY_ADJUSTMENT_REFERENCE_V1 = Object.freeze({
  status: 'BASE_REFERENCE_PARAMETERS_ONLY' as const,
  productionValuationLogicEnabled: false,
  calibrationRequired: ['market', 'price_band', 'local_evidence', 'effective_date', 'seasonality'] as const,
  confirmedTextualBaseParameters: {
    poolUsd: 10_000,
    garageUsd: 10_000,
    bedroomUsd: 5_000,
    trafficSideRearBelow250kUsd: 10_000,
    trafficFrontBelow250kUsd: 15_000,
    trafficAbove500kPercent: 20,
    freewayUsd: 20_000,
    livingAreaFallbackUsd: 20_000,
  },
  undefinedPolicy: ['TRAFFIC_250K_TO_500K'],
  pendingPolicyConfirmation: ['BATHROOM_10K', 'CARPORT_5K', 'BASEMENT_GUEST_HOUSE_50_PERCENT_PPSF'],
  sourceConflicts: ['TRAFFIC_LOW_BAND_IMAGE_350K_TEXT_250K_USE_TEXT_250K',
    'BEDROOM_IMAGE_10K_TO_25K_TEXT_5K_USE_TEXT_5K'],
});

const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
const normalizedType = (value: string | null) => String(value || '').trim().toLowerCase().replace(/^sfr$/, 'single family');
const round = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const lotIsMaterial = (candidate: RecordedSoldComparableCandidate) =>
  normalizedType(candidate.soldRecord.propertyType) === 'single family';

function factorStatus(factor: number): WeightedCheckResult['status'] {
  if (factor >= 0.9) return 'PASS';
  if (factor > 0) return 'PARTIAL';
  return 'FAIL';
}

function knownCheck(key: WeightedCheckKey, weight: number, factor: number, reason: string): WeightedCheckResult {
  const normalized = clamp(factor);
  return { key, status: factorStatus(normalized), weight, earnedWeight: weight * normalized,
    factor: normalized, reason };
}

function unknownCheck(key: WeightedCheckKey, weight: number, reason: string): WeightedCheckResult {
  return { key, status: 'UNKNOWN', weight, earnedWeight: 0, factor: null, reason };
}

function notApplicableCheck(key: WeightedCheckKey, weight: number, reason: string): WeightedCheckResult {
  return { key, status: 'NOT_APPLICABLE', weight, earnedWeight: 0, factor: null, reason };
}

function hardGates(candidate: RecordedSoldComparableCandidate): WeightedHardGateResult {
  const checks = {
    recordedSalePrice: finite(candidate.recordedSalePrice) && candidate.recordedSalePrice > 0,
    recordedSaleDate: Boolean(candidate.recordedSaleDate && Number.isFinite(Date.parse(candidate.recordedSaleDate))),
    usablePropertyRecord: Boolean(candidate.soldRecord.providerPropertyId
      || candidate.soldRecord.assessorId || candidate.soldRecord.formattedAddress),
    compatiblePropertyType: Boolean(candidate.soldRecord.propertyType)
      && !candidate.hardInvalidReasons.some((reason) =>
        reason === 'UNSUPPORTED_PROPERTY_TYPE' || reason === 'INCOMPATIBLE_PROPERTY_TYPE'),
    sufficientLivingAreaEvidence: finite(candidate.soldRecord.livingAreaSqft)
      && candidate.soldRecord.livingAreaSqft > 0 && finite(candidate.sqftDifference.value),
    nonCorruptRecord: !candidate.soldRecord.saleTransactionAmbiguous
      && candidate.hardInvalidReasons.length === 0,
  };
  const failures = Object.entries(checks).filter(([, pass]) => !pass).map(([key]) => key);
  return { pass: failures.length === 0, checks, failures };
}

function distanceFactor(value: number, scenario: WeightedCompScenario) {
  if (value <= 0.5) return 1;
  if (value <= 1) return 0.9;
  if (value <= 2) return scenario === 'APPRAISAL_STYLE_STRICT' ? 0.3 : scenario === 'LOCALITY_TIME_TRAVEL' ? 0.45 : 0.6;
  if (value <= 3) return scenario === 'APPRAISAL_STYLE_STRICT' ? 0.1 : scenario === 'LOCALITY_TIME_TRAVEL' ? 0.2 : 0.35;
  return 0;
}

function livingAreaFactor(delta: number, variance: number | null, scenario: WeightedCompScenario) {
  if (delta <= 200) return 1;
  if (delta <= 400) return scenario === 'APPRAISAL_STYLE_STRICT' ? 0.65 : 0.85;
  if (delta <= 600) return scenario === 'APPRAISAL_STYLE_STRICT' ? 0.35 : 0.7;
  if (delta <= 800) return scenario === 'APPRAISAL_STYLE_STRICT' ? 0.15 : 0.45;
  if (finite(variance) && variance <= 0.4) return 0.2;
  return 0;
}

function buildChecks(candidate: RecordedSoldComparableCandidate, scenario: WeightedCompScenario,
  supplemental: CompSupplementalStructuralEvidence): WeightedCheckResult[] {
  const weights = DEALSIFTER_WEIGHTED_COMP_POLICY_V1.weights[scenario];
  const distance = candidate.distanceFromSubjectMiles.value;
  const sqftDelta = candidate.sqftDifference.value;
  const sqftVariance = candidate.sqftDifferencePercent.value;
  const yearDelta = candidate.yearBuiltDifference.value;
  const lotDelta = candidate.lotSizeDifference.value;
  const beds = candidate.bedroomDifference.value;
  const baths = candidate.bathroomDifference.value;
  const recency = candidate.daysSinceSale.value;
  const booleanEvidence = (key: WeightedCheckKey, value: boolean | null | undefined, mismatchFactor: number, unknownReason: string) =>
    value === null || value === undefined ? unknownCheck(key, weights[key], unknownReason)
      : knownCheck(key, weights[key], value ? 1 : mismatchFactor, value ? `${key.toUpperCase()}_MATCH` : `${key.toUpperCase()}_MISMATCH`);
  return [
    booleanEvidence('subdivision', supplemental.sameSubdivision, 0.25, 'SUBDIVISION_UNKNOWN'),
    supplemental.majorRoadRelation === null || supplemental.majorRoadRelation === undefined
      ? unknownCheck('majorRoadBarrier', weights.majorRoadBarrier, 'MAJOR_ROAD_RELATION_UNKNOWN')
      : knownCheck('majorRoadBarrier', weights.majorRoadBarrier,
        supplemental.majorRoadRelation === 'NO_BARRIER' ? 1 : 0.25, supplemental.majorRoadRelation),
    finite(distance) ? knownCheck('distance', weights.distance, distanceFactor(distance, scenario), `DISTANCE_${round(distance)}_MILES`)
      : unknownCheck('distance', weights.distance, 'DISTANCE_UNKNOWN'),
    candidate.soldRecord.propertyType
      ? knownCheck('propertyType', weights.propertyType,
        candidate.hardInvalidReasons.some((reason) => reason === 'INCOMPATIBLE_PROPERTY_TYPE') ? 0 : 1,
        `PROPERTY_TYPE_${normalizedType(candidate.soldRecord.propertyType).replace(/\s+/g, '_').toUpperCase()}`)
      : unknownCheck('propertyType', weights.propertyType, 'PROPERTY_TYPE_UNKNOWN'),
    booleanEvidence('storyStyle', supplemental.sameStoryStyle, 0.25, 'STORY_STYLE_UNKNOWN'),
    finite(sqftDelta) ? knownCheck('livingArea', weights.livingArea,
      livingAreaFactor(sqftDelta, sqftVariance, scenario), `LIVING_AREA_DELTA_${round(sqftDelta)}_SQFT`)
      : unknownCheck('livingArea', weights.livingArea, 'LIVING_AREA_UNKNOWN'),
    finite(yearDelta) ? knownCheck('yearBuilt', weights.yearBuilt,
      yearDelta <= 5 ? 1 : yearDelta <= 10 ? 0.8 : yearDelta <= 20 ? 0.5 : 0.2, `YEAR_DELTA_${yearDelta}`)
      : unknownCheck('yearBuilt', weights.yearBuilt, 'YEAR_BUILT_UNKNOWN'),
    !lotIsMaterial(candidate) ? notApplicableCheck('lotSize', weights.lotSize, 'LOT_NOT_MATERIAL_FOR_PROPERTY_TYPE')
      : finite(lotDelta) ? knownCheck('lotSize', weights.lotSize,
        lotDelta <= 2500 ? 1 : lotDelta <= 5000 ? 0.7 : lotDelta <= 7500 ? 0.4 : 0.15, `LOT_DELTA_${round(lotDelta)}_SQFT`)
        : unknownCheck('lotSize', weights.lotSize, 'LOT_DATA_UNKNOWN'),
    finite(beds) ? knownCheck('bedrooms', weights.bedrooms,
      beds === 0 ? 1 : beds <= 1 ? 0.7 : beds <= 2 ? 0.3 : 0, `BEDROOM_DELTA_${beds}`)
      : unknownCheck('bedrooms', weights.bedrooms, 'BEDROOMS_UNKNOWN'),
    finite(baths) ? knownCheck('bathrooms', weights.bathrooms,
      baths === 0 ? 1 : baths <= 0.5 ? 0.85 : baths <= 1 ? 0.65 : baths <= 2 ? 0.25 : 0, `BATHROOM_DELTA_${baths}`)
      : unknownCheck('bathrooms', weights.bathrooms, 'BATHROOMS_UNKNOWN'),
    booleanEvidence('pool', supplemental.poolMatch, 0.4, 'POOL_RELATION_UNKNOWN'),
    booleanEvidence('garage', supplemental.garageMatch, 0.4, 'GARAGE_RELATION_UNKNOWN'),
    booleanEvidence('otherFeatures', supplemental.otherFeatureCompatibility, 0.4, 'OTHER_VERIFIED_FEATURES_UNKNOWN'),
    finite(recency) ? knownCheck('recency', weights.recency,
      recency <= 90 ? 1 : recency <= 180 ? 0.8 : recency <= 270 ? 0.55 : 0, `RECENCY_${recency}_DAYS`)
      : unknownCheck('recency', weights.recency, 'RECORDED_SALE_RECENCY_UNKNOWN'),
    supplemental.trafficFreewayRelation === null || supplemental.trafficFreewayRelation === undefined
      ? unknownCheck('trafficFreeway', weights.trafficFreeway, 'TRAFFIC_FREEWAY_RELATION_UNKNOWN')
      : knownCheck('trafficFreeway', weights.trafficFreeway,
        supplemental.trafficFreewayRelation === 'SIMILAR' ? 1 : 0.25, supplemental.trafficFreewayRelation),
  ];
}

export function evaluateWeightedCompCandidate(
  candidate: RecordedSoldComparableCandidate,
  scenario: WeightedCompScenario = 'WEIGHTED_BALANCED',
  supplemental: CompSupplementalStructuralEvidence = {},
  overrides: { candidateThreshold?: number; minimumCompleteness?: number } = {},
): WeightedCompAssessment {
  const policy = DEALSIFTER_WEIGHTED_COMP_POLICY_V1;
  const gates = hardGates(candidate);
  const checks = buildChecks(candidate, scenario, supplemental);
  const applicable = checks.filter((check) => check.status !== 'NOT_APPLICABLE');
  const available = applicable.filter((check) => check.status !== 'UNKNOWN');
  const availableWeight = available.reduce((sum, check) => sum + check.weight, 0);
  const applicableWeight = applicable.reduce((sum, check) => sum + check.weight, 0);
  const earnedWeight = available.reduce((sum, check) => sum + check.earnedWeight, 0);
  const structuralComparabilityScore = availableWeight ? round(earnedWeight / availableWeight * 100) : 0;
  const dataCompletenessScore = applicableWeight ? round(availableWeight / applicableWeight * 100) : 0;
  const threshold = overrides.candidateThreshold ?? policy.arvCandidateThreshold;
  const completenessFloor = overrides.minimumCompleteness ?? policy.minimumPrimaryDataCompleteness;
  const distance = candidate.distanceFromSubjectMiles.value;
  const localEligibility = finite(distance) && (distance <= policy.thresholds.distanceMiles.local
    || supplemental.sameSubdivision === true);
  const primaryEligibilityBlockers = [
    ...gates.failures.map((failure) => `HARD_GATE_${failure.toUpperCase()}`),
    ...(structuralComparabilityScore < threshold ? ['STRUCTURAL_SCORE_BELOW_THRESHOLD'] : []),
    ...(dataCompletenessScore < completenessFloor ? ['DATA_COMPLETENESS_BELOW_MINIMUM'] : []),
    ...(!localEligibility ? ['SECONDARY_PROXIMITY_WITHOUT_MICRO_MARKET_EVIDENCE'] : []),
  ];
  const structuralClass = !gates.pass ? 'INVALID' as const
    : structuralComparabilityScore >= policy.scoreClasses.excellent ? 'EXCELLENT_STRUCTURAL_CANDIDATE' as const
      : structuralComparabilityScore >= policy.scoreClasses.valid ? 'VALID_STRUCTURAL_CANDIDATE' as const
        : structuralComparabilityScore >= policy.scoreClasses.supporting ? 'SUPPORTING_ACCEPTABLE' as const : 'WEAK' as const;
  const visualReviewReady = Boolean(candidate.soldRecord.formattedAddress && candidate.soldRecord.providerPropertyId
    && candidate.recordedSaleDate && candidate.recordedSalePrice && candidate.soldRecord.propertyType
    && candidate.soldRecord.livingAreaSqft);
  return {
    policyVersion: policy.version,
    structuralComparabilityScore,
    dataCompletenessScore,
    structuralClass,
    hardGates: gates,
    checks,
    primaryArvCompCandidate: primaryEligibilityBlockers.length === 0,
    primaryEligibilityBlockers,
    conditionReviewStatus: 'UNREVIEWED',
    conditionCompatibility: 'UNKNOWN',
    targetCondition: 'UNKNOWN',
    confirmedArvComp: false,
    visualReviewReady,
    limitations: checks.filter((check) => check.status === 'UNKNOWN').map((check) => check.reason),
  };
}

export function classifyStructuralReferenceSet(primaryCandidateCount: number) {
  return referenceSetClass(primaryCandidateCount);
}

export function thresholdSensitivity(candidates: RecordedSoldComparableCandidate[], scenario: WeightedCompScenario,
  thresholds = [75, 80, 85] as const) {
  return thresholds.map((threshold) => ({ threshold, primaryCandidateCount: candidates.filter((candidate) =>
    evaluateWeightedCompCandidate(candidate, scenario, {}, { candidateThreshold: threshold }).primaryArvCompCandidate).length }));
}

export function rankWeightedCompCandidates(candidates: RecordedSoldComparableCandidate[], scenario: WeightedCompScenario) {
  return candidates.map((candidate) => ({ candidate, assessment: evaluateWeightedCompCandidate(candidate, scenario) }))
    .sort((left, right) => Number(right.assessment.primaryArvCompCandidate) - Number(left.assessment.primaryArvCompCandidate)
      || right.assessment.structuralComparabilityScore - left.assessment.structuralComparabilityScore
      || right.assessment.dataCompletenessScore - left.assessment.dataCompletenessScore
      || (left.candidate.distanceFromSubjectMiles.value ?? Infinity) - (right.candidate.distanceFromSubjectMiles.value ?? Infinity)
      || String(left.candidate.soldRecord.providerPropertyId || '')
        .localeCompare(String(right.candidate.soldRecord.providerPropertyId || '')));
}
