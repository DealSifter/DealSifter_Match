import {
  analyzeCompQualitySensitivity,
  auditSubjectBaselines,
  type SubjectBaseline,
} from './compQualityCalibration.ts';
import type { SoldEvidenceService } from './soldEvidenceService.ts';
import type { RecordedSoldComparableCandidate } from './soldTypes.ts';

const round = (value: number) => Math.round(value * 100) / 100;
function statistics(values: number[]) {
  if (!values.length) return { median: null, average: null, minimum: null, maximum: null };
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { median: round(median), average: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    minimum: sorted[0], maximum: sorted[sorted.length - 1] };
}

function summarize(candidate: RecordedSoldComparableCandidate) {
  return {
    providerPropertyId: candidate.soldRecord.providerPropertyId,
    address: candidate.soldRecord.formattedAddress,
    distanceMiles: candidate.distanceFromSubjectMiles.value,
    recordedSaleDate: candidate.recordedSaleDate,
    daysSinceSale: candidate.daysSinceSale.value,
    propertyType: candidate.soldRecord.propertyType,
    livingAreaSqft: candidate.soldRecord.livingAreaSqft,
    sqftVariancePercent: candidate.sqftDifferencePercent.value === null
      ? null : round(candidate.sqftDifferencePercent.value * 100),
    bedroomDifference: candidate.bedroomDifference.value,
    bathroomDifference: candidate.bathroomDifference.value,
    lotVariancePercent: candidate.lotSizeDifferencePercent.value === null
      ? null : round(candidate.lotSizeDifferencePercent.value * 100),
    yearBuiltDifference: candidate.yearBuiltDifference.value,
    baselineCompQuality: candidate.baselineCompQuality,
    compQuality: candidate.compQuality,
    qualityScore: candidate.qualityScore,
    qualityChecks: candidate.qualityChecks,
    positiveSignals: candidate.qualityReasons,
    negativeSignals: candidate.penaltyReasons,
    limitations: candidate.limitations,
    primaryQualityBlocker: candidate.primaryQualityBlocker,
  };
}

export async function runCachedCompQualityCalibration(options: {
  service: Pick<SoldEvidenceService, 'getCachedSoldEvidence'>;
  propertyId: string;
  subjectBaselines: SubjectBaseline[];
  userId?: string | null;
}) {
  const result = await options.service.getCachedSoldEvidence({ propertyId: options.propertyId, userId: options.userId });
  if (!result) throw new Error('CACHE_REUSE_BLOCKED');
  const candidates = result.recordedSoldCompSelection.directSoldCompCandidates;
  const analysis = analyzeCompQualitySensitivity(candidates);
  const baseline = analysis.scenarios.find((scenario) => scenario.scenario === 'CURRENT')!;
  const balanced = analysis.scenarios.find((scenario) => scenario.scenario === 'MULTI_CHECK_BALANCED')!;
  const consensus = analysis.consensus.map((item) => ({
    ...summarize(item.candidate), topAppearances: item.topAppearances,
    strongAppearances: item.strongAppearances,
  }));
  const consensusCandidates = analysis.consensus.slice(0, 5).map((item) => item.candidate);
  const priceStats = statistics(consensusCandidates
    .map((candidate) => candidate.recordedSalePrice).filter((value): value is number => value !== null));
  const sqftStats = statistics(consensusCandidates
    .map((candidate) => candidate.recordedSalePricePerSqft.value).filter((value): value is number => value !== null));
  const salePriceDispersionRatio = priceStats.minimum && priceStats.maximum
    ? round(priceStats.maximum / priceStats.minimum) : null;
  const pricePerSqftDispersionRatio = sqftStats.minimum && sqftStats.maximum
    ? round(sqftStats.maximum / sqftStats.minimum) : null;
  const valuationDispersionWarning = [salePriceDispersionRatio, pricePerSqftDispersionRatio]
    .some((ratio) => ratio !== null && ratio >= 2);
  return {
    propertyId: result.propertyId,
    cache: 'HIT' as const,
    liveRentCastCalls: 0 as const,
    subjectAudit: auditSubjectBaselines(options.subjectBaselines),
    before: { strong: baseline.strong, good: baseline.good, acceptable: baseline.acceptable,
      weak: baseline.weak, hardInvalid: baseline.hardInvalid },
    after: { strong: balanced.strong, good: balanced.good, acceptable: balanced.acceptable,
      weak: balanced.weak, hardInvalid: balanced.hardInvalid },
    topSevenCurrentAcceptable: candidates.filter((candidate) => candidate.baselineCompQuality === 'ACCEPTABLE')
      .slice(0, 7).map(summarize),
    top15: baseline.ranked.slice(0, 15).map((item) => summarize(item.candidate)),
    scenarios: analysis.scenarios.map((scenario) => ({ scenario: scenario.scenario, strong: scenario.strong,
      good: scenario.good, acceptable: scenario.acceptable, weak: scenario.weak,
      hardInvalid: scenario.hardInvalid, topCandidates: scenario.topCandidates.map((item) => ({
        ...summarize(item.candidate), scenarioQuality: item.quality, scenarioScore: item.score,
      })) })),
    penaltyFrequencyAll: analysis.penaltyFrequencyAll,
    penaltyFrequencyTop15: analysis.penaltyFrequencyTop15,
    distributions: analysis.distributions,
    consensus,
    consensusStrongCount: analysis.consensusStrongCount,
    rankingStability: analysis.rankingStability,
    meanTopFiveJaccard: analysis.meanTopFiveJaccard,
    consensusPriceStatistics: { medianSalePrice: priceStats.median, averageSalePrice: priceStats.average,
      minimumSalePrice: priceStats.minimum, maximumSalePrice: priceStats.maximum,
      medianRecordedPricePerSqft: sqftStats.median, averageRecordedPricePerSqft: sqftStats.average,
      salePriceDispersionRatio, pricePerSqftDispersionRatio },
    valuationDispersionWarning,
    possibleUnmodeledFactor: valuationDispersionWarning,
    referenceSetClass: result.recordedSoldCompSelection.referenceSetClass,
    sufficiency: result.recordedSoldCompSelection.sufficiency,
    availableSpecialCharacteristics: [] as string[],
  };
}
