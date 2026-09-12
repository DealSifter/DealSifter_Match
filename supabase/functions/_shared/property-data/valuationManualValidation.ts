import type { ValuationEvidenceService } from './valuationEvidenceService.ts';
import type { NormalizedComparableCandidate, ValuationEvidenceResult } from './valuationTypes.ts';

const present = (value: unknown) => value !== null && value !== undefined;
const count = (items: NormalizedComparableCandidate[], get: (item: NormalizedComparableCandidate) => unknown) =>
  items.filter((item) => present(get(item))).length;

function summarize(result: ValuationEvidenceResult) {
  const comps = result.valuation.comparables;
  const diagnosticsById = new Map(result.comparableAnalysis.diagnostics.map((item) => [item.providerPropertyId, item]));
  const rankedComps = result.comparableAnalysis.diagnostics
    .map((diagnostic) => comps.find((item) => item.providerPropertyId === diagnostic.providerPropertyId))
    .filter((item): item is NormalizedComparableCandidate => Boolean(item));
  return {
    providerEstimate: result.valuation.providerEstimate.value.value,
    providerRangeLow: result.valuation.providerEstimate.rangeLow.value,
    providerRangeHigh: result.valuation.providerEstimate.rangeHigh.value,
    providerConfidenceSemantic: result.valuation.providerEstimate.providerConfidenceSemantic,
    comparablesReturned: result.valuation.providerComparableCount,
    comparablesNormalized: comps.length,
    counts: result.comparableAnalysis.counts,
    coverage: {
      price: count(comps, (item) => item.price),
      distance: count(comps, (item) => item.distanceMiles),
      recency: count(comps, (item) => item.daysOld ?? item.lastSeenDate),
      propertyType: count(comps, (item) => item.propertyType),
      bedsBaths: count(comps, (item) => item.bedrooms !== null && item.bathrooms !== null ? true : null),
      livingSqft: count(comps, (item) => item.livingAreaSqft),
      lot: count(comps, (item) => item.lotSizeSqft),
      yearBuilt: count(comps, (item) => item.yearBuilt),
      providerCorrelation: count(comps, (item) => item.providerCorrelation),
    },
    topComparables: rankedComps.slice(0, 5).map((item) => ({
      providerPropertyId: item.providerPropertyId,
      formattedAddress: item.formattedAddress,
      distanceMiles: item.distanceMiles,
      daysOld: item.daysOld,
      propertyType: item.propertyType,
      bedrooms: item.bedrooms,
      bathrooms: item.bathrooms,
      livingAreaSqft: item.livingAreaSqft,
      lotSizeSqft: item.lotSizeSqft,
      yearBuilt: item.yearBuilt,
      price: item.price,
      pricePerSqft: item.derived.pricePerSqft.value,
      providerCorrelation: item.providerCorrelation,
      quality: diagnosticsById.get(item.providerPropertyId) || null,
    })),
    descriptiveStatistics: result.comparableAnalysis.descriptiveStatistics,
    limitations: [...result.valuation.limitations],
  };
}

/** Manual-only harness with no HTTP entrypoint. It cannot run without explicit operator opt-in. */
export async function runControlledValuationEvidenceValidation(options: {
  enabled: string | undefined;
  mode: string | undefined;
  environment: string | undefined;
  service: ValuationEvidenceService;
  propertyId: string;
  userId?: string | null;
}) {
  if (String(options.enabled || '').trim().toLowerCase() !== 'true') throw new Error('LIVE_VALUATION_VALIDATION_NOT_ENABLED');
  if (String(options.mode || '').trim().toLowerCase() !== 'live') throw new Error('LIVE_VALUATION_VALIDATION_REQUIRES_LIVE_MODE');
  if (!['local', 'development', 'staging', 'production'].includes(String(options.environment || '').trim().toLowerCase())) {
    throw new Error('LIVE_VALUATION_VALIDATION_INVALID_ENVIRONMENT');
  }
  const cacheBefore = await options.service.getCachedValuationEvidence({ propertyId: options.propertyId, userId: options.userId });
  const first = cacheBefore || await options.service.getValuationEvidence({ propertyId: options.propertyId, userId: options.userId });
  const liveRequests = first.cacheHit ? 0 : 1;
  if (liveRequests > 1) throw new Error('LIVE_VALUATION_VALIDATION_REQUEST_LIMIT_EXCEEDED');
  const second = await options.service.getValuationEvidence({ propertyId: options.propertyId, userId: options.userId });
  if (!second.cacheHit) throw new Error('LIVE_VALUATION_SECOND_LOOKUP_NOT_CACHE_HIT');
  return {
    propertyId: options.propertyId,
    cacheBefore: cacheBefore ? 'HIT' as const : 'MISS' as const,
    liveRequests,
    secondCacheHit: second.cacheHit,
    secondLiveRequests: 0,
    ...summarize(first),
  };
}
