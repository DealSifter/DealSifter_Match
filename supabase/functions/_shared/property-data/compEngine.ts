import type {
  ComparableAnalysis,
  ComparableQualityDiagnostic,
  ComparableReasonCode,
  NormalizedComparableCandidate,
  NormalizedValuationEvidence,
} from './valuationTypes.ts';

export const INITIAL_DEALSIFTER_COMP_POLICY = Object.freeze({
  closeDistanceMiles: 1,
  distantComparableMiles: 3,
  recentDays: 90,
  staleDays: 180,
  similarLivingAreaVariance: 0.2,
  highLivingAreaVariance: 0.4,
  highLotSizeVariance: 0.5,
  highYearBuiltDifference: 20,
  highBedroomDifference: 1,
  highBathroomDifference: 1,
});

const SUPPORTED_TYPES = new Set(['single family', 'condo', 'townhouse']);
const normalizeType = (value: string | null) => String(value || '').trim().toLowerCase()
  .replace(/^sfr$/, 'single family');
const present = (value: number | null) => typeof value === 'number' && Number.isFinite(value);

export function analyzeComparableCandidate(
  candidate: NormalizedComparableCandidate,
  subjectType: string | null,
  policy = INITIAL_DEALSIFTER_COMP_POLICY,
): ComparableQualityDiagnostic {
  const hardInvalidReasons: ComparableReasonCode[] = [];
  const positiveReasons: ComparableReasonCode[] = [];
  const penaltyReasons: ComparableReasonCode[] = [];
  const limitations: ComparableReasonCode[] = [
    'RENOVATION_CONDITION_UNAVAILABLE', 'ARMS_LENGTH_DISTRESS_UNAVAILABLE',
  ];
  if (candidate.priceSemantic !== 'RECORDED_SALE_PRICE') limitations.push('SALE_PRICE_UNCONFIRMED');
  const normalizedSubjectType = normalizeType(subjectType);
  const normalizedCandidateType = normalizeType(candidate.propertyType);
  if (!SUPPORTED_TYPES.has(normalizedSubjectType) || !SUPPORTED_TYPES.has(normalizedCandidateType)) {
    hardInvalidReasons.push('UNSUPPORTED_PROPERTY_TYPE');
  } else if (normalizedSubjectType !== normalizedCandidateType) {
    hardInvalidReasons.push('INCOMPATIBLE_PROPERTY_TYPE');
  } else {
    positiveReasons.push('SAME_PROPERTY_TYPE');
  }
  if (!present(candidate.price) || candidate.price! <= 0) hardInvalidReasons.push('MISSING_PRICE');
  if (!present(candidate.livingAreaSqft) || candidate.livingAreaSqft! <= 0) hardInvalidReasons.push('MISSING_SQFT');

  if (present(candidate.distanceMiles)) {
    if (candidate.distanceMiles! <= policy.closeDistanceMiles) positiveReasons.push('CLOSE_DISTANCE');
    else if (candidate.distanceMiles! > policy.distantComparableMiles) penaltyReasons.push('DISTANT_COMPARABLE');
  }
  if (present(candidate.daysOld)) {
    if (candidate.daysOld! <= policy.recentDays) positiveReasons.push('RECENT_MARKET_EVIDENCE');
    else if (candidate.daysOld! > policy.staleDays) penaltyReasons.push('STALE_COMPARABLE');
  }
  const sqftVariance = candidate.derived.sqftVarianceFromSubject.value;
  if (present(sqftVariance)) {
    if (sqftVariance! <= policy.similarLivingAreaVariance) positiveReasons.push('SIMILAR_LIVING_AREA');
    else if (sqftVariance! > policy.highLivingAreaVariance) penaltyReasons.push('INSUFFICIENT_DATA');
  }
  if ((candidate.derived.bedroomDifference.value ?? 0) > policy.highBedroomDifference) penaltyReasons.push('BEDROOM_MISMATCH');
  if ((candidate.derived.bathroomDifference.value ?? 0) > policy.highBathroomDifference) penaltyReasons.push('BATHROOM_MISMATCH');
  if ((candidate.derived.lotSizeVarianceFromSubject.value ?? 0) > policy.highLotSizeVariance) penaltyReasons.push('LOT_SIZE_VARIANCE');
  if ((candidate.derived.yearBuiltDifference.value ?? 0) > policy.highYearBuiltDifference) penaltyReasons.push('YEAR_BUILT_VARIANCE');

  const classification = hardInvalidReasons.length
    ? 'hard_rejected'
    : penaltyReasons.length
      ? 'down_ranked'
      : positiveReasons.length >= 3 ? 'strong' : 'usable';
  return { providerPropertyId: candidate.providerPropertyId, classification, hardInvalidReasons, positiveReasons, penaltyReasons, limitations };
}

const round = (value: number) => Math.round(value * 100) / 100;
function statistics(values: number[]) {
  if (!values.length) return { median: null, average: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { median: round(median), average: round(sorted.reduce((sum, item) => sum + item, 0) / sorted.length) };
}

export function analyzeSaleComparables(valuation: NormalizedValuationEvidence): ComparableAnalysis {
  const subjectType = valuation.subjectProperty.propertyType.value;
  const paired = valuation.comparables.map((candidate, index) => ({
    candidate,
    index,
    diagnostic: analyzeComparableCandidate(candidate, subjectType),
  }));
  const order = { strong: 0, usable: 1, down_ranked: 2, hard_rejected: 3 } as const;
  paired.sort((left, right) => order[left.diagnostic.classification] - order[right.diagnostic.classification]
    || left.diagnostic.penaltyReasons.length - right.diagnostic.penaltyReasons.length
    || right.diagnostic.positiveReasons.length - left.diagnostic.positiveReasons.length
    || left.index - right.index);
  const usable = paired.filter(({ diagnostic }) => diagnostic.classification !== 'hard_rejected');
  const prices = usable.map(({ candidate }) => candidate.price).filter((value): value is number => present(value));
  const pricePerSqft = usable.map(({ candidate }) => candidate.derived.pricePerSqft.value)
    .filter((value): value is number => present(value));
  const priceStats = statistics(prices);
  const sqftStats = statistics(pricePerSqft);
  return {
    diagnostics: paired.map(({ diagnostic }) => diagnostic),
    counts: {
      total: paired.length,
      usable: usable.length,
      strong: paired.filter(({ diagnostic }) => diagnostic.classification === 'strong').length,
      downRanked: paired.filter(({ diagnostic }) => diagnostic.classification === 'down_ranked').length,
      hardRejected: paired.filter(({ diagnostic }) => diagnostic.classification === 'hard_rejected').length,
    },
    descriptiveStatistics: {
      medianPrice: priceStats.median,
      averagePrice: priceStats.average,
      medianPricePerSqft: sqftStats.median,
      averagePricePerSqft: sqftStats.average,
    },
  };
}
