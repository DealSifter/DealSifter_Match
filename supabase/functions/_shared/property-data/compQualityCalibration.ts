import type {
  RecordedSoldComparableCandidate,
  RecordedSoldCompQuality,
  RecordedSoldQualityCheck,
} from './soldTypes.ts';

export const DEALSIFTER_RECORDED_COMP_POLICY_V1 = Object.freeze({
  proximityMiles: { preferred: 0.5, strongEligible: 1, secondaryMaximum: 3 },
  recencyDays: { veryRecent: 90, recent: 180, older: 270 },
  livingAreaVariance: { preferred: 0.15, strong: 0.25, usable: 0.4 },
  bedroomDifference: { preferred: 0, acceptable: 1 },
  bathroomDifference: { preferred: 0.5, acceptable: 1 },
  lotVarianceSingleFamily: { preferred: 0.25, acceptable: 0.5 },
  yearBuiltDifference: { preferred: 10, acceptable: 20 },
  score: { strong: 11, good: 8, acceptable: 6 },
});

export type CompCalibrationScenario = 'CURRENT' | 'MULTI_CHECK_BALANCED' | 'LOCALITY_PRIORITY' | 'STRUCTURAL_PRIORITY';

export type CalibratedCandidate = {
  candidate: RecordedSoldComparableCandidate;
  scenario: CompCalibrationScenario;
  quality: RecordedSoldCompQuality;
  score: number;
  checks: RecordedSoldComparableCandidate['qualityChecks'];
  primaryBlocker: string | null;
};

export type ScenarioResult = {
  scenario: CompCalibrationScenario;
  strong: number;
  good: number;
  acceptable: number;
  weak: number;
  hardInvalid: number;
  ranked: CalibratedCandidate[];
  topCandidates: CalibratedCandidate[];
};

export type SubjectBaseline = {
  source: 'INTERNAL_LISTING' | 'PROPERTY_RECORD' | 'AVM_SUBJECT' | 'COMP_ENGINE';
  evidenceStatus: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  lotSizeSqft: number | null;
  yearBuilt: number | null;
};

export function auditSubjectBaselines(sources: SubjectBaseline[]) {
  const fields: Array<keyof Omit<SubjectBaseline, 'source' | 'evidenceStatus'>> = [
    'propertyType', 'bedrooms', 'bathrooms', 'livingAreaSqft', 'lotSizeSqft', 'yearBuilt',
  ];
  const conflicts = fields.flatMap((field) => {
    const available = sources.filter((source) => source[field] !== null);
    const normalized = new Set(available.map((source) => field === 'propertyType'
      ? normalizedType(String(source[field])) : String(source[field])));
    return normalized.size > 1 ? [{ field, values: available.map((source) => ({
      source: source.source, value: source[field], evidenceStatus: source.evidenceStatus,
    })) }] : [];
  });
  return { sources, conflicts };
}

const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
const normalizedType = (value: string | null) => String(value || '').trim().toLowerCase().replace(/^sfr$/, 'single family');
const lotIsMaterial = (candidate: RecordedSoldComparableCandidate) =>
  normalizedType(candidate.soldRecord.propertyType) === 'single family';
const status = (value: number | null, preferred: number, acceptable: number): RecordedSoldQualityCheck => {
  if (!finite(value)) return 'UNAVAILABLE';
  if (value <= preferred) return 'PASS';
  if (value <= acceptable) return 'PARTIAL';
  return 'FAIL';
};

function qualityChecks(candidate: RecordedSoldComparableCandidate) {
  const policy = DEALSIFTER_RECORDED_COMP_POLICY_V1;
  const missingStructural = [candidate.distanceFromSubjectMiles.value, candidate.daysSinceSale.value,
    candidate.sqftDifferencePercent.value, candidate.bedroomDifference.value,
    candidate.bathroomDifference.value, candidate.yearBuiltDifference.value]
    .filter((value) => !finite(value)).length;
  return {
    recordedSale: candidate.recordedSalePrice !== null && candidate.recordedSalePrice > 0
      && candidate.recordedSaleDate !== null ? 'PASS' as const : 'FAIL' as const,
    recency: status(candidate.daysSinceSale.value, policy.recencyDays.recent, policy.recencyDays.older),
    proximity: status(candidate.distanceFromSubjectMiles.value,
      policy.proximityMiles.preferred, policy.proximityMiles.strongEligible),
    propertyType: candidate.hardInvalidReasons.some((reason) =>
      reason === 'UNSUPPORTED_PROPERTY_TYPE' || reason === 'INCOMPATIBLE_PROPERTY_TYPE') ? 'FAIL' as const : 'PASS' as const,
    structuralCompatibility: candidate.hardInvalidReasons.length > 0 ? 'FAIL' as const
      : finite(candidate.sqftDifferencePercent.value)
        && candidate.sqftDifferencePercent.value <= policy.livingAreaVariance.usable ? 'PASS' as const : 'FAIL' as const,
    livingArea: status(candidate.sqftDifferencePercent.value,
      policy.livingAreaVariance.preferred, policy.livingAreaVariance.strong),
    bedrooms: status(candidate.bedroomDifference.value,
      policy.bedroomDifference.preferred, policy.bedroomDifference.acceptable),
    bathrooms: status(candidate.bathroomDifference.value,
      policy.bathroomDifference.preferred, policy.bathroomDifference.acceptable),
    lotSize: !lotIsMaterial(candidate) || candidate.lotSizeDifferencePercent.value === null ? 'UNAVAILABLE' as const
      : status(candidate.lotSizeDifferencePercent.value,
        policy.lotVarianceSingleFamily.preferred, policy.lotVarianceSingleFamily.acceptable),
    yearBuilt: status(candidate.yearBuiltDifference.value,
      policy.yearBuiltDifference.preferred, policy.yearBuiltDifference.acceptable),
    specialCharacteristics: 'UNAVAILABLE' as const,
    missingDataBurden: missingStructural === 0 ? 'PASS' as const : missingStructural <= 2 ? 'PARTIAL' as const : 'FAIL' as const,
  };
}

function signalScore(candidate: RecordedSoldComparableCandidate) {
  const distance = candidate.distanceFromSubjectMiles.value;
  const recency = candidate.daysSinceSale.value;
  const sqft = candidate.sqftDifferencePercent.value;
  const beds = candidate.bedroomDifference.value;
  const baths = candidate.bathroomDifference.value;
  const lot = candidate.lotSizeDifferencePercent.value;
  const year = candidate.yearBuiltDifference.value;
  return (finite(distance) ? distance <= 0.5 ? 3 : distance <= 1 ? 2 : distance <= 2 ? 1 : 0 : 0)
    + (finite(recency) ? recency <= 90 ? 3 : recency <= 180 ? 2 : recency <= 270 ? 1 : 0 : 0)
    + (finite(sqft) ? sqft <= 0.1 ? 4 : sqft <= 0.15 ? 3 : sqft <= 0.25 ? 2 : sqft <= 0.4 ? 1 : 0 : 0)
    + (finite(beds) ? beds === 0 ? 2 : beds <= 1 ? 1 : 0 : 0)
    + (finite(baths) ? baths <= 0.5 ? 2 : baths <= 1 ? 1 : 0 : 0)
    + (!lotIsMaterial(candidate) ? 1 : finite(lot) ? lot <= 0.25 ? 2 : lot <= 0.5 ? 1 : 0 : 0)
    + (finite(year) ? year <= 10 ? 2 : year <= 20 ? 1 : 0 : 0);
}

function core(candidate: RecordedSoldComparableCandidate) {
  const policy = DEALSIFTER_RECORDED_COMP_POLICY_V1;
  const distance = candidate.distanceFromSubjectMiles.value;
  const recency = candidate.daysSinceSale.value;
  const sqft = candidate.sqftDifferencePercent.value;
  return candidate.baselineCompQuality !== 'HARD_INVALID'
    && finite(distance) && distance <= policy.proximityMiles.secondaryMaximum
    && finite(recency) && recency >= 0 && recency <= policy.recencyDays.older
    && finite(sqft) && sqft <= policy.livingAreaVariance.usable;
}

function balancedQuality(candidate: RecordedSoldComparableCandidate, score: number) {
  const policy = DEALSIFTER_RECORDED_COMP_POLICY_V1;
  if (candidate.baselineCompQuality === 'HARD_INVALID') return 'HARD_INVALID' as const;
  if (!core(candidate)) return 'WEAK' as const;
  const distance = candidate.distanceFromSubjectMiles.value!;
  const recency = candidate.daysSinceSale.value!;
  const sqft = candidate.sqftDifferencePercent.value!;
  if (distance <= policy.proximityMiles.strongEligible && recency <= policy.recencyDays.recent
    && sqft <= policy.livingAreaVariance.strong && score >= policy.score.strong) return 'STRONG' as const;
  if (distance <= policy.proximityMiles.strongEligible && score >= policy.score.good) return 'GOOD' as const;
  return score >= policy.score.acceptable ? 'ACCEPTABLE' as const : 'WEAK' as const;
}

function primaryBlocker(candidate: RecordedSoldComparableCandidate, quality: RecordedSoldCompQuality, score: number) {
  if (quality === 'STRONG') return null;
  if (candidate.baselineCompQuality === 'HARD_INVALID') return String(candidate.hardInvalidReasons[0] || 'FUNDAMENTAL_REQUIREMENT_FAILED');
  const policy = DEALSIFTER_RECORDED_COMP_POLICY_V1;
  const distance = candidate.distanceFromSubjectMiles.value;
  const recency = candidate.daysSinceSale.value;
  const sqft = candidate.sqftDifferencePercent.value;
  if (!finite(distance)) return 'DISTANCE_UNAVAILABLE';
  if (distance > policy.proximityMiles.strongEligible) return 'SECONDARY_PROXIMITY';
  if (!finite(recency)) return 'RECENCY_UNAVAILABLE';
  if (recency > policy.recencyDays.recent) return 'SALE_OLDER_THAN_STRONG_WINDOW';
  if (!finite(sqft)) return 'LIVING_AREA_COMPARISON_UNAVAILABLE';
  if (sqft > policy.livingAreaVariance.strong) return 'LIVING_AREA_VARIANCE';
  if (score < policy.score.strong) return 'MULTI_CHECK_SCORE_BELOW_STRONG';
  return 'SCENARIO_POLICY_LIMIT';
}

export function evaluateRecordedSoldCandidate(
  candidate: RecordedSoldComparableCandidate,
  scenario: CompCalibrationScenario,
): CalibratedCandidate {
  const score = signalScore(candidate);
  const checks = qualityChecks(candidate);
  const balanced = balancedQuality(candidate, score);
  let quality: RecordedSoldCompQuality;
  if (scenario === 'CURRENT') quality = candidate.baselineCompQuality;
  else if (scenario === 'MULTI_CHECK_BALANCED') quality = balanced;
  else if (scenario === 'LOCALITY_PRIORITY') {
    const distance = candidate.distanceFromSubjectMiles.value;
    if (balanced === 'HARD_INVALID' || balanced === 'WEAK') quality = balanced;
    else if (finite(distance) && distance <= 0.5 && balanced === 'STRONG') quality = 'STRONG';
    else if (finite(distance) && distance <= 1 && (balanced === 'STRONG' || balanced === 'GOOD')) quality = 'GOOD';
    else quality = 'ACCEPTABLE';
  } else {
    const distance = candidate.distanceFromSubjectMiles.value;
    const recency = candidate.daysSinceSale.value;
    const sqft = candidate.sqftDifferencePercent.value;
    const beds = candidate.bedroomDifference.value;
    const baths = candidate.bathroomDifference.value;
    if (balanced === 'HARD_INVALID' || !core(candidate)) quality = balanced === 'HARD_INVALID' ? balanced : 'WEAK';
    else if (finite(distance) && distance <= 1 && finite(recency) && recency <= 180
      && finite(sqft) && sqft <= 0.25 && finite(beds) && beds <= 1
      && finite(baths) && baths <= 1 && score >= 10) quality = 'STRONG';
    else if (finite(distance) && distance <= 1 && score >= 8) quality = 'GOOD';
    else quality = score >= 6 ? 'ACCEPTABLE' : 'WEAK';
  }
  return { candidate, scenario, quality, score, checks, primaryBlocker: primaryBlocker(candidate, quality, score) };
}

const qualityOrder = { STRONG: 0, GOOD: 1, ACCEPTABLE: 2, WEAK: 3, HARD_INVALID: 4 } as const;
export function runCompQualityScenario(
  candidates: RecordedSoldComparableCandidate[],
  scenario: CompCalibrationScenario,
): ScenarioResult {
  const ranked = candidates.map((candidate) => evaluateRecordedSoldCandidate(candidate, scenario))
    .sort((left, right) => qualityOrder[left.quality] - qualityOrder[right.quality]
      || right.score - left.score
      || (left.candidate.distanceFromSubjectMiles.value ?? Infinity) - (right.candidate.distanceFromSubjectMiles.value ?? Infinity)
      || (left.candidate.sqftDifferencePercent.value ?? Infinity) - (right.candidate.sqftDifferencePercent.value ?? Infinity)
      || (left.candidate.daysSinceSale.value ?? Infinity) - (right.candidate.daysSinceSale.value ?? Infinity)
      || String(left.candidate.soldRecord.providerPropertyId || '')
        .localeCompare(String(right.candidate.soldRecord.providerPropertyId || '')));
  const count = (quality: RecordedSoldCompQuality) => ranked.filter((item) => item.quality === quality).length;
  return { scenario, strong: count('STRONG'), good: count('GOOD'), acceptable: count('ACCEPTABLE'),
    weak: count('WEAK'), hardInvalid: count('HARD_INVALID'), ranked,
    topCandidates: ranked.filter((item) => !['WEAK', 'HARD_INVALID'].includes(item.quality)).slice(0, 5) };
}

function bucket(values: Array<number | null>, tests: Array<(value: number) => boolean>) {
  const counts = tests.map(() => 0);
  let unavailable = 0;
  values.forEach((value) => {
    if (!finite(value)) { unavailable += 1; return; }
    const index = tests.findIndex((test) => test(value));
    if (index >= 0) counts[index] += 1;
  });
  return { counts, unavailable };
}

function penaltyFrequency(candidates: RecordedSoldComparableCandidate[]) {
  const has = (candidate: RecordedSoldComparableCandidate, reason: string) =>
    [...candidate.penaltyReasons, ...candidate.hardInvalidReasons].includes(reason as never);
  const missing = (candidate: RecordedSoldComparableCandidate) => [candidate.distanceFromSubjectMiles.value,
    candidate.daysSinceSale.value, candidate.sqftDifferencePercent.value, candidate.bedroomDifference.value,
    candidate.bathroomDifference.value, candidate.yearBuiltDifference.value]
    .some((value) => !finite(value))
    || (lotIsMaterial(candidate) && candidate.lotSizeDifferencePercent.value === null);
  return {
    distance: candidates.filter((item) => has(item, 'DISTANT_COMPARABLE')).length,
    recency: candidates.filter((item) => has(item, 'STALE_COMPARABLE')).length,
    livingArea: candidates.filter((item) => has(item, 'INSUFFICIENT_DATA') || has(item, 'MISSING_SQFT')).length,
    bedrooms: candidates.filter((item) => has(item, 'BEDROOM_MISMATCH')).length,
    bathrooms: candidates.filter((item) => has(item, 'BATHROOM_MISMATCH')).length,
    lot: candidates.filter((item) => has(item, 'LOT_SIZE_VARIANCE')).length,
    yearBuilt: candidates.filter((item) => has(item, 'YEAR_BUILT_VARIANCE')).length,
    propertyType: candidates.filter((item) => has(item, 'INCOMPATIBLE_PROPERTY_TYPE')
      || has(item, 'UNSUPPORTED_PROPERTY_TYPE')).length,
    specialAttributes: 0,
    missingData: candidates.filter(missing).length,
  };
}

export function referenceSetClass(strongCount: number) {
  if (strongCount >= 5) return 'PREFERRED' as const;
  if (strongCount === 4) return 'ROBUST' as const;
  if (strongCount === 3) return 'ACCEPTABLE' as const;
  if (strongCount === 2) return 'MINIMUM' as const;
  return 'INSUFFICIENT' as const;
}

export function analyzeCompQualitySensitivity(candidates: RecordedSoldComparableCandidate[]) {
  const names: CompCalibrationScenario[] = ['CURRENT', 'MULTI_CHECK_BALANCED', 'LOCALITY_PRIORITY', 'STRUCTURAL_PRIORITY'];
  const scenarios = names.map((name) => runCompQualityScenario(candidates, name));
  const top15 = scenarios[0].ranked.slice(0, 15).map((item) => item.candidate);
  const distance = bucket(candidates.map((item) => item.distanceFromSubjectMiles.value), [
    (value) => value <= 0.5, (value) => value <= 1, (value) => value <= 2, (value) => value <= 3, () => true,
  ]);
  const recency = bucket(candidates.map((item) => item.daysSinceSale.value), [
    (value) => value <= 90, (value) => value <= 180, (value) => value <= 270, (value) => value <= 365, () => true,
  ]);
  const sqft = bucket(candidates.map((item) => item.sqftDifferencePercent.value), [
    (value) => value <= 0.1, (value) => value <= 0.15, (value) => value <= 0.2,
    (value) => value <= 0.25, (value) => value <= 0.3, () => true,
  ]);
  const differenceBuckets = (values: Array<number | null>) => bucket(values, [
    (value) => value === 0, (value) => value <= 1, () => true,
  ]);
  const year = bucket(candidates.map((item) => item.yearBuiltDifference.value), [
    (value) => value <= 5, (value) => value <= 10, (value) => value <= 20, () => true,
  ]);
  const lot = bucket(candidates.map((item) => item.lotSizeDifferencePercent.value), [
    (value) => value <= 0.25, (value) => value <= 0.5, () => true,
  ]);
  const appearances = new Map<string, { candidate: RecordedSoldComparableCandidate; topAppearances: number;
    strongAppearances: number; rankTotal: number }>();
  scenarios.forEach((scenario) => scenario.topCandidates.forEach((item, index) => {
    const id = item.candidate.soldRecord.providerPropertyId || item.candidate.soldRecord.formattedAddress || '';
    const current = appearances.get(id) || { candidate: item.candidate, topAppearances: 0, strongAppearances: 0, rankTotal: 0 };
    current.topAppearances += 1;
    current.strongAppearances += Number(item.quality === 'STRONG');
    current.rankTotal += index;
    appearances.set(id, current);
  }));
  const consensus = [...appearances.values()].sort((left, right) => right.topAppearances - left.topAppearances
    || right.strongAppearances - left.strongAppearances || left.rankTotal - right.rankTotal
    || (left.candidate.distanceFromSubjectMiles.value ?? Infinity) - (right.candidate.distanceFromSubjectMiles.value ?? Infinity));
  const overlapPairs: number[] = [];
  scenarios.forEach((left, index) => scenarios.slice(index + 1).forEach((right) => {
    const leftIds = new Set(left.topCandidates.map((item) => item.candidate.soldRecord.providerPropertyId));
    const rightIds = new Set(right.topCandidates.map((item) => item.candidate.soldRecord.providerPropertyId));
    overlapPairs.push([...leftIds].filter((id) => rightIds.has(id)).length / Math.max(1, new Set([...leftIds, ...rightIds]).size));
  }));
  const meanOverlap = overlapPairs.length ? overlapPairs.reduce((sum, value) => sum + value, 0) / overlapPairs.length : 0;
  return {
    scenarios,
    penaltyFrequencyAll: penaltyFrequency(candidates),
    penaltyFrequencyTop15: penaltyFrequency(top15),
    distributions: {
      distance: { preferredHalfMile: distance.counts[0], halfToOne: distance.counts[1], oneToTwo: distance.counts[2],
        twoToThree: distance.counts[3], overThree: distance.counts[4], unavailable: distance.unavailable },
      recency: { zeroTo90: recency.counts[0], days91To180: recency.counts[1], days181To270: recency.counts[2],
        days271To365: recency.counts[3], over365: recency.counts[4], unavailable: recency.unavailable },
      livingAreaVariance: { upTo10: sqft.counts[0], tenTo15: sqft.counts[1], fifteenTo20: sqft.counts[2],
        twentyTo25: sqft.counts[3], twentyFiveTo30: sqft.counts[4], over30: sqft.counts[5], unavailable: sqft.unavailable },
      bedrooms: differenceBuckets(candidates.map((item) => item.bedroomDifference.value)),
      bathrooms: differenceBuckets(candidates.map((item) => item.bathroomDifference.value)),
      yearBuilt: { upTo5: year.counts[0], sixTo10: year.counts[1], elevenTo20: year.counts[2],
        over20: year.counts[3], unavailable: year.unavailable },
      lot: { upTo25: lot.counts[0], twentyFiveTo50: lot.counts[1], over50: lot.counts[2], unavailable: lot.unavailable },
    },
    consensus: consensus.slice(0, 5),
    consensusStrongCount: consensus.filter((item) => item.strongAppearances >= 2 && item.topAppearances >= 3).length,
    rankingStability: meanOverlap >= 0.8 ? 'HIGH' as const : meanOverlap >= 0.5 ? 'MEDIUM' as const : 'LOW' as const,
    meanTopFiveJaccard: Math.round(meanOverlap * 1000) / 1000,
  };
}
