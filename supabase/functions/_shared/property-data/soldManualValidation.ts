import type { SoldEvidenceResult } from './soldTypes.ts';
import type { SoldEvidenceService } from './soldEvidenceService.ts';

function summarize(result: SoldEvidenceResult) {
  const set = result.soldCompSet;
  const recordsWithSale = result.soldPool.records.filter((record) => record.latestValidSale);
  const summarizeComp = (item: SoldEvidenceResult['soldCompSet']['qualifiedSoldComps'][number]) => ({
    candidateProviderPropertyId: item.candidate.providerPropertyId,
    candidateAddress: item.candidate.formattedAddress,
    soldProviderPropertyId: item.soldRecord.providerPropertyId,
    address: item.soldRecord.formattedAddress,
    distanceMiles: item.candidate.distanceMiles,
    recordedSaleDate: item.recordedSaleDate,
    recordedSalePrice: item.recordedSalePrice,
    livingAreaSqft: item.soldRecord.livingAreaSqft,
    recordedSalePricePerSqft: item.recordedSalePricePerSqft.value,
    bedrooms: item.soldRecord.bedrooms,
    bathrooms: item.soldRecord.bathrooms,
    lotSizeSqft: item.soldRecord.lotSizeSqft,
    yearBuilt: item.soldRecord.yearBuilt,
    matchStrength: item.matchStrength,
    quality: item.quality,
    providerCorrelation: item.candidate.providerCorrelation,
    reasons: item.reasons,
    limitations: item.limitations,
    structuralDiagnostic: item.compDiagnostics,
  });
  return {
    soldRecordsReturned: result.soldPool.recordsReturned,
    soldRecordsNormalized: result.soldPool.records.length,
    avmCandidates: set.totalAvmCandidates,
    matchedToSoldRecord: set.matchedCandidates,
    exactMatches: set.exactMatches,
    strongMatches: set.strongMatches,
    ambiguousMatches: set.ambiguousMatches,
    noMatches: set.unmatchedCandidates,
    recordedSalePriceAvailable: recordsWithSale.filter((record) => Boolean(record.latestValidSale?.salePrice)).length,
    recordedSaleDateAvailable: recordsWithSale.filter((record) => Boolean(record.latestValidSale?.saleDate)).length,
    qualifiedSoldComps: set.qualifiedSoldComps.length,
    strongQualifiedSoldComps: set.strongSoldComps.length,
    conditionalSoldComps: set.conditionalSoldComps.length,
    lotCoverage: result.soldPool.records.filter((record) => record.lotSizeSqft !== null).length,
    sufficiency: set.sufficiency,
    topStrongSoldComps: set.strongSoldComps.slice(0, 5).map(summarizeComp),
    topQualifiedSoldComps: set.qualifiedSoldComps.slice(0, 5).map(summarizeComp),
    excludedExamples: set.matches.filter((item) => item.matchStrength === 'AMBIGUOUS' || item.matchStrength === 'NO_MATCH').slice(0, 5),
  };
}

export async function runControlledSoldEvidenceValidation(options: {
  enabled: string | undefined;
  mode: string | undefined;
  environment: string | undefined;
  service: SoldEvidenceService;
  propertyId: string;
  userId?: string | null;
}) {
  if (String(options.enabled || '').trim().toLowerCase() !== 'true') throw new Error('LIVE_SOLD_VALIDATION_NOT_ENABLED');
  if (String(options.mode || '').trim().toLowerCase() !== 'live') throw new Error('LIVE_SOLD_VALIDATION_REQUIRES_LIVE_MODE');
  if (!['local', 'development', 'staging', 'production'].includes(String(options.environment || '').trim().toLowerCase())) {
    throw new Error('LIVE_SOLD_VALIDATION_INVALID_ENVIRONMENT');
  }
  const cacheBefore = await options.service.getCachedSoldEvidence({ propertyId: options.propertyId, userId: options.userId });
  const first = cacheBefore || await options.service.getSoldEvidence({ propertyId: options.propertyId, userId: options.userId });
  const liveRequests = first.cacheHit ? 0 : 1;
  if (liveRequests > 1) throw new Error('LIVE_SOLD_VALIDATION_REQUEST_LIMIT_EXCEEDED');
  const second = await options.service.getSoldEvidence({ propertyId: options.propertyId, userId: options.userId });
  if (!second.cacheHit) throw new Error('LIVE_SOLD_SECOND_LOOKUP_NOT_CACHE_HIT');
  return { propertyId: options.propertyId, cacheBefore: cacheBefore ? 'HIT' as const : 'MISS' as const,
    liveRequests, secondCacheHit: true, secondLiveRequests: 0, ...summarize(first) };
}
