import type { ConditionCompatibility, TargetCondition } from './weightedCompTypes.ts';

export type ArvEnginePolicy = {
  version: 'DEALSIFTER_ARV_POLICY_V1';
  methodologyVersion: 'DEALSIFTER_ARV_ENGINE_V1';
  minimumEligibleComps: number;
  maximumCoreComps: number;
  structuralScoreFloor: number;
  completenessFloor: number;
  includePartialMatchInCore: boolean;
  divergenceWarningRatio: number;
  dispersion: {
    moderateRangeRatio: number; highRangeRatio: number; extremeRangeRatio: number;
    moderateCoefficientOfVariation: number; highCoefficientOfVariation: number;
    extremeCoefficientOfVariation: number;
  };
  range: {
    twoComps: 'OBSERVED_PRICE_PER_SQFT_INTERVAL';
    threeToFiveLowDispersion: 'INTERQUARTILE_PRICE_PER_SQFT_INTERVAL';
    threeToFiveHighDispersion: 'OBSERVED_PRICE_PER_SQFT_INTERVAL';
  };
  valuationWeight: {
    structural: number; completeness: number; recency: number; proximity: number;
    partialConditionMultiplier: number;
  };
};

export type ArvEnginePolicyOverrides = Partial<Omit<ArvEnginePolicy,
  'version' | 'methodologyVersion' | 'dispersion' | 'range' | 'valuationWeight'>> & {
  dispersion?: Partial<ArvEnginePolicy['dispersion']>;
  range?: Partial<ArvEnginePolicy['range']>;
  valuationWeight?: Partial<ArvEnginePolicy['valuationWeight']>;
};

export const DEALSIFTER_ARV_ENGINE_POLICY_V1: ArvEnginePolicy = Object.freeze({
  version: 'DEALSIFTER_ARV_POLICY_V1' as const,
  methodologyVersion: 'DEALSIFTER_ARV_ENGINE_V1' as const,
  minimumEligibleComps: 2,
  maximumCoreComps: 5,
  structuralScoreFloor: 80,
  completenessFloor: 65,
  includePartialMatchInCore: false,
  divergenceWarningRatio: 0.1,
  dispersion: {
    moderateRangeRatio: 1.25,
    highRangeRatio: 1.5,
    extremeRangeRatio: 2.25,
    moderateCoefficientOfVariation: 0.15,
    highCoefficientOfVariation: 0.25,
    extremeCoefficientOfVariation: 0.5,
  },
  range: {
    twoComps: 'OBSERVED_PRICE_PER_SQFT_INTERVAL' as const,
    threeToFiveLowDispersion: 'INTERQUARTILE_PRICE_PER_SQFT_INTERVAL' as const,
    threeToFiveHighDispersion: 'OBSERVED_PRICE_PER_SQFT_INTERVAL' as const,
  },
  valuationWeight: {
    structural: 0.55,
    completeness: 0.25,
    recency: 0.1,
    proximity: 0.1,
    partialConditionMultiplier: 0.65,
  },
});

export type ArvEngineStatus = 'ARV_AVAILABLE' | 'ARV_LIMITED' | 'ARV_UNAVAILABLE';
export type ArvConfidence = 'LOW' | 'MODERATE' | 'HIGH';
export type ArvValuationRole = 'PRIMARY' | 'SUPPORTING' | 'EXCLUDED';

export type ArvEngineCandidate = {
  source: 'ARV_COMP_CANDIDATE';
  compIdentifier: string | null;
  address: string | null;
  recordedSalePrice: number | null;
  recordedSaleDate: string | null;
  recordedSaleEvidenceStatus: 'VERIFIED_RECORD';
  bedrooms?: number | null;
  bathrooms?: number | null;
  livingAreaSqft: number | null;
  latitude?: number | null;
  longitude?: number | null;
  structuralComparabilityScore: number;
  dataCompletenessScore: number;
  hardGatesPass: boolean;
  recordAmbiguousOrCorrupt: boolean;
  distanceMiles: number | null;
  daysSinceSale: number | null;
  transactionQuality: 'UNKNOWN' | 'ARMS_LENGTH_VERIFIED' | 'NON_ARMS_LENGTH';
  conditionCompatibility: ConditionCompatibility | 'UNREVIEWED';
  conditionEvidenceStatus: 'USER_PROVIDED' | null;
};

export type ArvEngineInput = {
  subjectPropertyId: string;
  subjectLivingAreaSqft: number | null;
  targetCondition: TargetCondition;
  candidates: ArvEngineCandidate[];
  cachedProviderAvm?: { value: number | null; evidenceStatus: 'ESTIMATED' | 'UNAVAILABLE' } | null;
  calculatedAt?: string;
  policy?: ArvEnginePolicyOverrides;
};

const finitePositive = (value: number | null): value is number => Number.isFinite(value) && Number(value) > 0;
const round = (value: number) => Math.round(value * 100) / 100;
const roundMoney = (value: number) => Math.round(value);
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const sorted = (values: number[]) => [...values].sort((left, right) => left - right);
const median = (values: number[]) => {
  const ordered = sorted(values);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const quantile = (values: number[], percentile: number) => {
  const ordered = sorted(values);
  if (ordered.length === 1) return ordered[0];
  const index = (ordered.length - 1) * percentile;
  const lower = Math.floor(index);
  const remainder = index - lower;
  return ordered[lower + 1] === undefined ? ordered[lower]
    : ordered[lower] + remainder * (ordered[lower + 1] - ordered[lower]);
};

function recencyFactor(days: number | null) {
  if (!Number.isFinite(days)) return 0.5;
  if (Number(days) <= 90) return 1;
  if (Number(days) <= 180) return 0.85;
  if (Number(days) <= 270) return 0.65;
  return 0.35;
}

function proximityFactor(miles: number | null) {
  if (!Number.isFinite(miles)) return 0.5;
  if (Number(miles) <= 0.5) return 1;
  if (Number(miles) <= 1) return 0.9;
  if (Number(miles) <= 2) return 0.65;
  if (Number(miles) <= 3) return 0.4;
  return 0.2;
}

function classify(candidate: ArvEngineCandidate, policy: ArvEnginePolicy) {
  if (candidate.source !== 'ARV_COMP_CANDIDATE') return { role: 'EXCLUDED' as const, reason: 'NOT_STRUCTURAL_CANDIDATE' };
  if (!candidate.hardGatesPass) return { role: 'EXCLUDED' as const, reason: 'FAILED_HARD_GATE' };
  if (candidate.recordAmbiguousOrCorrupt) return { role: 'EXCLUDED' as const, reason: 'CORRUPT_OR_AMBIGUOUS_RECORD' };
  if (candidate.transactionQuality === 'NON_ARMS_LENGTH') return { role: 'EXCLUDED' as const, reason: 'TRANSACTION_NOT_ARMS_LENGTH' };
  if (!candidate.compIdentifier) return { role: 'EXCLUDED' as const, reason: 'MISSING_STABLE_COMP_IDENTITY' };
  if (candidate.structuralComparabilityScore < policy.structuralScoreFloor) return { role: 'EXCLUDED' as const, reason: 'INSUFFICIENT_STRUCTURAL_SCORE' };
  if (candidate.dataCompletenessScore < policy.completenessFloor) return { role: 'EXCLUDED' as const, reason: 'INSUFFICIENT_COMPLETENESS' };
  if (candidate.recordedSaleEvidenceStatus !== 'VERIFIED_RECORD') return { role: 'EXCLUDED' as const, reason: 'UNVERIFIED_RECORDED_SALE' };
  if (!finitePositive(candidate.recordedSalePrice)) return { role: 'EXCLUDED' as const, reason: 'MISSING_RECORDED_SALE_PRICE' };
  if (!candidate.recordedSaleDate || !Number.isFinite(Date.parse(candidate.recordedSaleDate))) return { role: 'EXCLUDED' as const, reason: 'MISSING_RECORDED_SALE_DATE' };
  if (!finitePositive(candidate.livingAreaSqft)) return { role: 'EXCLUDED' as const, reason: 'MISSING_LIVING_AREA' };
  if (candidate.conditionEvidenceStatus !== 'USER_PROVIDED' || candidate.conditionCompatibility === 'UNREVIEWED') {
    return { role: 'EXCLUDED' as const, reason: 'CONDITION_REVIEW_PENDING' };
  }
  if (candidate.conditionCompatibility === 'MATCHES_TARGET') return { role: 'PRIMARY' as const, reason: 'CONDITION_MATCH' };
  if (candidate.conditionCompatibility === 'PARTIAL_MATCH') return policy.includePartialMatchInCore
    ? { role: 'PRIMARY' as const, reason: 'PARTIAL_CONDITION_MATCH' }
    : { role: 'SUPPORTING' as const, reason: 'PARTIAL_CONDITION_MATCH' };
  if (candidate.conditionCompatibility === 'SUPERIOR_TO_TARGET') return { role: 'SUPPORTING' as const, reason: 'SUPERIOR_TO_TARGET' };
  if (candidate.conditionCompatibility === 'INFERIOR_TO_TARGET') return { role: 'SUPPORTING' as const, reason: 'INFERIOR_TO_TARGET' };
  if (candidate.conditionCompatibility === 'DIFFERENT_PRODUCT_CLASS') return { role: 'EXCLUDED' as const, reason: 'DIFFERENT_PRODUCT_CLASS' };
  if (candidate.conditionCompatibility === 'NOT_COMPARABLE') return { role: 'EXCLUDED' as const, reason: 'NOT_COMPARABLE' };
  return { role: 'EXCLUDED' as const, reason: 'CONDITION_UNKNOWN' };
}

function rawWeight(candidate: ArvEngineCandidate, policy: ArvEnginePolicy) {
  const factors = policy.valuationWeight;
  const base = (candidate.structuralComparabilityScore / 100) * factors.structural
    + (candidate.dataCompletenessScore / 100) * factors.completeness
    + recencyFactor(candidate.daysSinceSale) * factors.recency
    + proximityFactor(candidate.distanceMiles) * factors.proximity;
  return base * (candidate.conditionCompatibility === 'PARTIAL_MATCH' ? factors.partialConditionMultiplier : 1);
}

function dispersion(values: number[]) {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const average = mean(values);
  const med = median(values);
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  const coefficientOfVariation = average > 0 ? Math.sqrt(variance) / average : null;
  const medianAbsoluteDeviation = median(values.map((value) => Math.abs(value - med)));
  return {
    pricePerSqftMin: round(minimum), pricePerSqftMax: round(maximum),
    pricePerSqftMedian: round(med), pricePerSqftMean: round(average),
    rangeRatio: minimum > 0 ? round(maximum / minimum) : null,
    coefficientOfVariation: coefficientOfVariation === null ? null : round(coefficientOfVariation),
    medianAbsoluteDeviation: round(medianAbsoluteDeviation),
  };
}

function providerCrossCheck(value: number | null, low: number | null, high: number | null) {
  if (!finitePositive(value)) return {
    status: 'PROVIDER_ESTIMATE_UNAVAILABLE' as const, value: null, evidenceStatus: 'UNAVAILABLE' as const,
  };
  // A cached provider estimate remains useful evidence even when DealSifter cannot
  // produce a condition-supported ARV. Preserve it as an unvalidated estimate and
  // never blend it into, or present it as, the DealSifter ARV.
  if (!finitePositive(low) || !finitePositive(high)) return {
    status: 'PROVIDER_ESTIMATE_UNVALIDATED' as const, value, evidenceStatus: 'ESTIMATED' as const,
  };
  return { status: value < low ? 'PROVIDER_ESTIMATE_BELOW_RANGE' as const
    : value > high ? 'PROVIDER_ESTIMATE_ABOVE_RANGE' as const : 'PROVIDER_ESTIMATE_WITHIN_RANGE' as const,
  value, evidenceStatus: 'ESTIMATED' as const };
}

export function buildArvValuationSet(input: ArvEngineInput) {
  const policy = { ...DEALSIFTER_ARV_ENGINE_POLICY_V1, ...input.policy,
    dispersion: { ...DEALSIFTER_ARV_ENGINE_POLICY_V1.dispersion, ...input.policy?.dispersion },
    range: { ...DEALSIFTER_ARV_ENGINE_POLICY_V1.range, ...input.policy?.range },
    valuationWeight: { ...DEALSIFTER_ARV_ENGINE_POLICY_V1.valuationWeight, ...input.policy?.valuationWeight } };
  const seenIdentifiers = new Set<string>();
  const classified = input.candidates.map((candidate) => {
    const duplicate = Boolean(candidate.compIdentifier && seenIdentifiers.has(candidate.compIdentifier));
    if (candidate.compIdentifier) seenIdentifiers.add(candidate.compIdentifier);
    return { candidate, ...(duplicate
      ? { role: 'EXCLUDED' as const, reason: 'DUPLICATE_COMP_IDENTITY' }
      : classify(candidate, policy)) };
  });
  const rankedPrimary = classified.filter((item) => item.role === 'PRIMARY')
    .sort((left, right) => right.candidate.structuralComparabilityScore - left.candidate.structuralComparabilityScore
      || (left.candidate.distanceMiles ?? Infinity) - (right.candidate.distanceMiles ?? Infinity)
      || String(left.candidate.compIdentifier).localeCompare(String(right.candidate.compIdentifier)));
  const core = rankedPrimary.slice(0, policy.maximumCoreComps);
  const rawWeights = core.map((item) => rawWeight(item.candidate, policy));
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
  const normalizedWeights = rawWeights.map((value) => weightTotal > 0 ? Math.round((value / weightTotal) * 1_000_000) / 1_000_000 : 0);
  if (normalizedWeights.length && weightTotal > 0) {
    normalizedWeights[normalizedWeights.length - 1] = Math.round((1
      - normalizedWeights.slice(0, -1).reduce((sum, value) => sum + value, 0)) * 1_000_000) / 1_000_000;
  }
  const coreIds = new Set(core.map((item) => item.candidate.compIdentifier));
  const valuationSet = classified.map((item) => {
    const coreIndex = core.findIndex((entry) => entry.candidate.compIdentifier === item.candidate.compIdentifier);
    const included = coreIndex >= 0;
    const pricePerSqft = finitePositive(item.candidate.recordedSalePrice) && finitePositive(item.candidate.livingAreaSqft)
      ? round(item.candidate.recordedSalePrice / item.candidate.livingAreaSqft) : null;
    const role: ArvValuationRole = item.role === 'PRIMARY' && !coreIds.has(item.candidate.compIdentifier)
      ? 'SUPPORTING' : item.role;
    return {
      ...item.candidate,
      recordedPricePerSqft: pricePerSqft,
      recordedSaleEvidenceStatus: item.candidate.recordedSaleEvidenceStatus,
      pricePerSqftEvidenceStatus: pricePerSqft === null ? 'UNAVAILABLE' as const : 'CALCULATED' as const,
      valuationRole: role,
      valuationEligibility: included ? 'INCLUDED' as const : role === 'SUPPORTING' ? 'SUPPORTING_ONLY' as const : 'EXCLUDED' as const,
      valuationWeight: included ? normalizedWeights[coreIndex] : 0,
      inclusionReason: included ? item.reason : null,
      exclusionReason: included ? null : item.role === 'PRIMARY' ? 'MAXIMUM_CORE_COMP_COUNT' : item.reason,
      warnings: item.candidate.transactionQuality === 'UNKNOWN' ? ['TRANSACTION_QUALITY_UNKNOWN'] : [],
    };
  });
  return { policy, valuationSet, core: valuationSet.filter((item) => item.valuationEligibility === 'INCLUDED'),
    supporting: valuationSet.filter((item) => item.valuationEligibility === 'SUPPORTING_ONLY'),
    excluded: valuationSet.filter((item) => item.valuationEligibility === 'EXCLUDED') };
}

export type ArvEvaluationResult = ReturnType<typeof evaluateArv>;

export function evaluateArv(input: ArvEngineInput) {
  const built = buildArvValuationSet(input);
  const core = built.core;
  const base = {
    subjectPropertyId: input.subjectPropertyId,
    targetCondition: input.targetCondition,
    eligibleCompCount: core.length,
    supportingCompCount: built.supporting.length,
    excludedCompCount: built.excluded.length,
    valuationSet: built.valuationSet,
    policyVersion: built.policy.version,
    methodologyVersion: built.policy.methodologyVersion,
    calculatedAt: input.calculatedAt || new Date().toISOString(),
    adjustmentStatus: 'NOT_ACTIVE_UNCALIBRATED' as const,
    appliedMonetaryAdjustment: 0 as const,
    adjustmentPotential: true as const,
    evidenceSummary: { recordedSale: 'VERIFIED_RECORD' as const, structuralScore: 'CALCULATED' as const,
      conditionReview: classifiedConditionEvidence(built.valuationSet), arv: 'CALCULATED' as const,
      confidence: 'CALCULATED' as const },
  };
  const cachedAvmValue = input.cachedProviderAvm?.evidenceStatus === 'ESTIMATED'
    ? input.cachedProviderAvm.value : null;
  const transactionQualityUnknown = built.valuationSet.some((item) => item.transactionQuality === 'UNKNOWN');
  const commonLimitations = [...(transactionQualityUnknown ? ['TRANSACTION_QUALITY_UNKNOWN'] : []),
    'MONETARY_ADJUSTMENTS_INACTIVE'];
  const unavailable = (reason: string, warnings: string[] = [], dispersionValue: (ReturnType<typeof dispersion>
    & { level?: 'EXTREME' }) | null = null) => ({ ...base,
    status: 'ARV_UNAVAILABLE' as const, centralReference: null, medianBasedReference: null,
    weightedReference: null, arvRangeLow: null, arvRangeHigh: null, medianPricePerSqft: null,
    meanPricePerSqft: null, weightedPricePerSqft: null, rangeMethod: null, confidence: 'LOW' as const,
    confidenceReasons: [reason], limitations: [reason, ...commonLimitations],
    warnings, dispersion: dispersionValue, providerAvmCrossCheck: providerCrossCheck(cachedAvmValue, null, null),
    evidenceSummary: { ...base.evidenceSummary, arv: 'UNAVAILABLE' as const } });
  if (!finitePositive(input.subjectLivingAreaSqft)) return unavailable('MISSING_SUBJECT_LIVING_AREA');
  if (core.length < built.policy.minimumEligibleComps) return unavailable('INSUFFICIENT_CONDITION_COMPATIBLE_COMPS');
  const pricesPerSqft = core.map((item) => finitePositive(item.recordedSalePrice) && finitePositive(item.livingAreaSqft)
    ? item.recordedSalePrice / item.livingAreaSqft : null).filter((value): value is number => finitePositive(value));
  if (pricesPerSqft.length < built.policy.minimumEligibleComps) return unavailable('INSUFFICIENT_PRICE_PER_SQFT_EVIDENCE');
  const stats = dispersion(pricesPerSqft);
  const isExtreme = Number(stats.rangeRatio) >= built.policy.dispersion.extremeRangeRatio
    || Number(stats.coefficientOfVariation) >= built.policy.dispersion.extremeCoefficientOfVariation;
  const isHigh = Number(stats.rangeRatio) >= built.policy.dispersion.highRangeRatio
    || Number(stats.coefficientOfVariation) >= built.policy.dispersion.highCoefficientOfVariation;
  const isModerate = Number(stats.rangeRatio) >= built.policy.dispersion.moderateRangeRatio
    || Number(stats.coefficientOfVariation) >= built.policy.dispersion.moderateCoefficientOfVariation;
  const dispersionWarnings = isModerate ? ['VALUATION_DISPERSION_WARNING', 'POSSIBLE_UNMODELED_FACTOR'] : [];
  if (isExtreme) return unavailable('EXTREME_VALUATION_DISPERSION', dispersionWarnings, { ...stats, level: 'EXTREME' });
  const medianPricePerSqft = median(pricesPerSqft);
  const weightedPricePerSqft = core.reduce((sum, item) => sum
    + (Number(item.recordedSalePrice) / Number(item.livingAreaSqft)) * item.valuationWeight, 0);
  const medianBasedReference = roundMoney(input.subjectLivingAreaSqft * medianPricePerSqft);
  const weightedReference = roundMoney(input.subjectLivingAreaSqft * weightedPricePerSqft);
  const centralDivergence = Math.abs(weightedReference - medianBasedReference) / medianBasedReference;
  const warnings = [...dispersionWarnings];
  if (centralDivergence >= built.policy.divergenceWarningRatio) warnings.push('CENTRAL_REFERENCE_DIVERGENCE');
  const lowPricePerSqft = core.length === 2 || isHigh ? Math.min(...pricesPerSqft) : quantile(pricesPerSqft, 0.25);
  const highPricePerSqft = core.length === 2 || isHigh ? Math.max(...pricesPerSqft) : quantile(pricesPerSqft, 0.75);
  const rangeMethod = core.length === 2 ? built.policy.range.twoComps
    : isHigh ? built.policy.range.threeToFiveHighDispersion : built.policy.range.threeToFiveLowDispersion;
  const arvRangeLow = roundMoney(input.subjectLivingAreaSqft * lowPricePerSqft);
  const arvRangeHigh = roundMoney(input.subjectLivingAreaSqft * highPricePerSqft);
  const averageStructural = mean(core.map((item) => item.structuralComparabilityScore));
  const averageCompleteness = mean(core.map((item) => item.dataCompletenessScore));
  const materialUnknownBurden = transactionQualityUnknown;
  let confidencePoints = core.length === 2 ? 35 : core.length === 3 ? 50 : core.length === 4 ? 60 : 70;
  confidencePoints += Math.max(0, Math.min(10, (averageStructural - built.policy.structuralScoreFloor) / 2));
  confidencePoints += Math.max(0, Math.min(10, (averageCompleteness - built.policy.completenessFloor) / 2));
  if (isHigh) confidencePoints -= 25;
  else if (isModerate) confidencePoints -= 10;
  if (materialUnknownBurden) confidencePoints -= 8;
  let confidence: ArvConfidence = confidencePoints >= 75 ? 'HIGH' : confidencePoints >= 50 ? 'MODERATE' : 'LOW';
  if (isHigh || materialUnknownBurden) confidence = confidence === 'HIGH' ? 'MODERATE' : confidence;
  const limited = core.length === 2 || isHigh || averageCompleteness < 75 || confidence === 'LOW';
  const status: ArvEngineStatus = limited ? 'ARV_LIMITED' : 'ARV_AVAILABLE';
  const confidenceReasons = [
    `ELIGIBLE_COMP_COUNT_${core.length}`,
    `AVERAGE_STRUCTURAL_SCORE_${round(averageStructural)}`,
    `AVERAGE_COMPLETENESS_${round(averageCompleteness)}`,
    isHigh ? 'HIGH_DISPERSION_CONFIDENCE_CAP' : isModerate ? 'MODERATE_DISPERSION_PENALTY' : 'DISPERSION_WITHIN_TOLERANCE',
    materialUnknownBurden ? 'TRANSACTION_QUALITY_UNKNOWN_CAP' : 'TRANSACTION_QUALITY_VERIFIED',
  ];
  return { ...base, status, centralReference: medianBasedReference, medianBasedReference,
    weightedReference, arvRangeLow, arvRangeHigh, rangeMethod, medianPricePerSqft: round(medianPricePerSqft),
    meanPricePerSqft: stats.pricePerSqftMean, weightedPricePerSqft: round(weightedPricePerSqft),
    confidence, confidenceReasons, limitations: commonLimitations,
    warnings, dispersion: { ...stats, level: isHigh ? 'HIGH' as const : isModerate ? 'MODERATE' as const : 'LOW' as const },
    providerAvmCrossCheck: providerCrossCheck(cachedAvmValue, arvRangeLow, arvRangeHigh) };
}

function classifiedConditionEvidence(valuationSet: Array<{ conditionEvidenceStatus: 'USER_PROVIDED' | null }>) {
  return valuationSet.some((item) => item.conditionEvidenceStatus === 'USER_PROVIDED')
    ? 'USER_PROVIDED' as const : 'UNAVAILABLE' as const;
}
