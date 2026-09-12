import type { SoldEvidenceService } from './soldEvidenceService.ts';
import type { RecordedSoldComparableCandidate } from './soldTypes.ts';
import {
  classifyStructuralReferenceSet,
  DEALSIFTER_WEIGHTED_COMP_POLICY_V1,
  rankWeightedCompCandidates,
  thresholdSensitivity,
  type WeightedCompScenario,
} from './weightedCompPolicy.ts';

export type WeightedSubjectBaseline = {
  source: 'INTERNAL_LISTING' | 'PROPERTY_RECORD' | 'AVM_SUBJECT' | 'COMP_ENGINE';
  evidenceStatus: string;
  propertyType: string | null;
  storyStyle: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  lotSizeSqft: number | null;
  yearBuilt: number | null;
  pool: boolean | null;
  garage: string | null;
  subdivision: string | null;
  latitude: number | null;
  longitude: number | null;
};

const round = (value: number) => Math.round(value * 100) / 100;
const normalized = (field: keyof WeightedSubjectBaseline, value: unknown) => field === 'propertyType'
  ? String(value || '').trim().toLowerCase().replace(/^sfr$/, 'single family') : String(value);

export function auditWeightedSubjectBaseline(sources: WeightedSubjectBaseline[]) {
  const fields: Array<keyof Omit<WeightedSubjectBaseline, 'source' | 'evidenceStatus'>> = [
    'propertyType', 'storyStyle', 'bedrooms', 'bathrooms', 'livingAreaSqft', 'lotSizeSqft', 'yearBuilt',
    'pool', 'garage', 'subdivision', 'latitude', 'longitude',
  ];
  const conflicts = fields.flatMap((field) => {
    const available = sources.filter((source) => source[field] !== null);
    const values = new Set(available.map((source) => normalized(field, source[field])));
    return values.size > 1 ? [{ field, values: available.map((source) => ({ source: source.source,
      value: source[field], evidenceStatus: source.evidenceStatus })) }] : [];
  });
  return { sources, conflicts };
}

function counts(ranked: ReturnType<typeof rankWeightedCompCandidates>) {
  const count = (value: string) => ranked.filter((item) => item.assessment.structuralClass === value).length;
  return {
    excellent: count('EXCELLENT_STRUCTURAL_CANDIDATE'),
    valid: count('VALID_STRUCTURAL_CANDIDATE'),
    supporting: count('SUPPORTING_ACCEPTABLE'),
    weak: count('WEAK'),
    invalid: count('INVALID'),
    primary: ranked.filter((item) => item.assessment.primaryArvCompCandidate).length,
  };
}

function summarize(item: ReturnType<typeof rankWeightedCompCandidates>[number]) {
  const candidate = item.candidate;
  const assessment = item.assessment;
  return {
    providerPropertyId: candidate.soldRecord.providerPropertyId,
    address: candidate.soldRecord.formattedAddress,
    recordedSaleDate: candidate.recordedSaleDate,
    recordedSalePrice: candidate.recordedSalePrice,
    distanceMiles: candidate.distanceFromSubjectMiles.value,
    structuralComparabilityScore: assessment.structuralComparabilityScore,
    dataCompletenessScore: assessment.dataCompletenessScore,
    structuralClass: assessment.structuralClass,
    propertyType: candidate.soldRecord.propertyType,
    storyStyle: null,
    sqftDelta: candidate.sqftDifference.value,
    yearDelta: candidate.yearBuiltDifference.value,
    lotDelta: candidate.lotSizeDifference.value,
    subdivision: null,
    majorRoadRelation: null,
    bedroomDelta: candidate.bedroomDifference.value,
    bathroomDelta: candidate.bathroomDifference.value,
    poolRelation: null,
    garageRelation: null,
    trafficFreewayRelation: null,
    hardGates: assessment.hardGates,
    passedChecks: assessment.checks.filter((check) => check.status === 'PASS').map((check) => check.key),
    failedChecks: assessment.checks.filter((check) => check.status === 'FAIL').map((check) => check.key),
    unknownChecks: assessment.checks.filter((check) => check.status === 'UNKNOWN').map((check) => check.key),
    primaryArvCompCandidate: assessment.primaryArvCompCandidate,
    primaryEligibilityBlockers: assessment.primaryEligibilityBlockers,
    conditionReviewStatus: assessment.conditionReviewStatus,
    confirmedArvComp: assessment.confirmedArvComp,
    visualReviewReady: assessment.visualReviewReady,
  };
}

function statistics(values: number[]) {
  if (!values.length) return { median: null, average: null, minimum: null, maximum: null, ratio: null };
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { median: round(median), average: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    minimum: sorted[0], maximum: sorted.at(-1)!, ratio: sorted[0] > 0 ? round(sorted.at(-1)! / sorted[0]) : null };
}

export async function runCachedWeightedCompValidation(options: {
  service: Pick<SoldEvidenceService, 'getCachedSoldEvidence'>;
  propertyId: string;
  subjectBaselines: WeightedSubjectBaseline[];
  userId?: string | null;
}) {
  const result = await options.service.getCachedSoldEvidence({ propertyId: options.propertyId, userId: options.userId });
  if (!result) throw new Error('CACHE_REUSE_BLOCKED');
  const candidates = result.recordedSoldCompSelection.directSoldCompCandidates;
  const scenarioNames: WeightedCompScenario[] = [
    'WEIGHTED_BALANCED', 'APPRAISAL_STYLE_STRICT', 'LOCALITY_TIME_TRAVEL',
  ];
  const scenarioResults = scenarioNames.map((scenario) => {
    const ranked = rankWeightedCompCandidates(candidates, scenario);
    return { scenario, ...counts(ranked), topFive: ranked.slice(0, 5).map(summarize) };
  });
  const appearances = new Map<string, { item: ReturnType<typeof rankWeightedCompCandidates>[number]; appearances: number }>();
  scenarioNames.forEach((scenario) => rankWeightedCompCandidates(candidates, scenario).slice(0, 5).forEach((item) => {
    const id = item.candidate.soldRecord.providerPropertyId || item.candidate.soldRecord.formattedAddress || '';
    const current = appearances.get(id) || { item, appearances: 0 };
    current.appearances += 1;
    if (scenario === 'WEIGHTED_BALANCED') current.item = item;
    appearances.set(id, current);
  }));
  const balanced = rankWeightedCompCandidates(candidates, 'WEIGHTED_BALANCED');
  const primaryIds = new Set(balanced.filter((item) => item.assessment.primaryArvCompCandidate)
    .map((item) => item.candidate.soldRecord.providerPropertyId));
  const consensus = [...appearances.values()].filter((item) => primaryIds.has(item.item.candidate.soldRecord.providerPropertyId))
    .sort((left, right) => right.appearances - left.appearances
      || right.item.assessment.structuralComparabilityScore - left.item.assessment.structuralComparabilityScore)
    .slice(0, 5).map((item) => ({ ...summarize(item.item), topFiveAppearances: item.appearances,
      stability: item.appearances === 3 ? 'STABLE' as const : item.appearances === 2 ? 'POLICY_SENSITIVE' as const : 'UNSTABLE' as const }));
  const prices = statistics(consensus.map((item) => item.recordedSalePrice).filter((value): value is number => value !== null));
  const pricePerSqft = statistics(consensus.map((item) => {
    const candidate = candidates.find((value) => value.soldRecord.providerPropertyId === item.providerPropertyId);
    return candidate?.recordedSalePricePerSqft.value ?? null;
  }).filter((value): value is number => value !== null));
  const valuationDispersionWarning = [prices.ratio, pricePerSqft.ratio].some((ratio) => ratio !== null
    && ratio >= DEALSIFTER_WEIGHTED_COMP_POLICY_V1.valuationDispersionWarningRatio);
  const currentCounts = { strong: candidates.filter((item) => item.compQuality === 'STRONG').length,
    good: candidates.filter((item) => item.compQuality === 'GOOD').length,
    acceptable: candidates.filter((item) => item.compQuality === 'ACCEPTABLE').length,
    weak: candidates.filter((item) => item.compQuality === 'WEAK').length,
    invalid: candidates.filter((item) => item.compQuality === 'HARD_INVALID').length,
    topFive: candidates.slice(0, 5).map((candidate) => ({
      address: candidate.soldRecord.formattedAddress,
      currentClass: candidate.compQuality,
      currentPolicySignalScore: candidate.qualityScore,
    })) };
  return {
    propertyId: result.propertyId,
    cache: 'HIT' as const,
    liveRentCastCalls: 0 as const,
    subjectAudit: auditWeightedSubjectBaseline(options.subjectBaselines),
    scenarioCurrent: currentCounts,
    weightedScenarios: scenarioResults,
    thresholdSensitivity: thresholdSensitivity(candidates, 'WEIGHTED_BALANCED'),
    consensusPrimaryCandidates: consensus,
    primaryStructuralCandidateCount: balanced.filter((item) => item.assessment.primaryArvCompCandidate).length,
    stablePrimaryCandidateCount: consensus.filter((item) => item.stability === 'STABLE').length,
    referenceSet: classifyStructuralReferenceSet(balanced.filter((item) => item.assessment.primaryArvCompCandidate).length),
    conditionVerifiedArvComps: 0 as const,
    priceDispersion: { salePrice: prices, recordedPricePerSqft: pricePerSqft },
    valuationDispersionWarning,
    possibleUnmodeledFactor: valuationDispersionWarning,
    readyForVisualReview: consensus.length > 0 && consensus.every((item) => item.visualReviewReady),
  };
}
