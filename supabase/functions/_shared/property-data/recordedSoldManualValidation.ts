import type { SoldEvidenceService } from './soldEvidenceService.ts';

export async function runCachedRecordedSoldCompSelectionValidation(options: {
  service: Pick<SoldEvidenceService, 'getCachedSoldEvidence'>;
  propertyId: string;
  userId?: string | null;
}) {
  const result = await options.service.getCachedSoldEvidence({
    propertyId: options.propertyId,
    userId: options.userId,
  });
  if (!result) throw new Error('CACHE_REUSE_BLOCKED');
  const selection = result.recordedSoldCompSelection;
  const withSale = result.soldPool.records.filter((record) => record.latestValidSale);
  const summarize = (item: typeof selection.directSoldCompCandidates[number]) => ({
    providerPropertyId: item.soldRecord.providerPropertyId,
    address: item.soldRecord.formattedAddress,
    distanceMiles: item.distanceFromSubjectMiles.value,
    recordedSaleDate: item.recordedSaleDate,
    daysSinceSale: item.daysSinceSale.value,
    recordedSalePrice: item.recordedSalePrice,
    livingAreaSqft: item.soldRecord.livingAreaSqft,
    recordedSalePricePerSqft: item.recordedSalePricePerSqft.value,
    bedrooms: item.soldRecord.bedrooms,
    bathrooms: item.soldRecord.bathrooms,
    lotSizeSqft: item.soldRecord.lotSizeSqft,
    yearBuilt: item.soldRecord.yearBuilt,
    compQuality: item.compQuality,
    qualityReasons: item.qualityReasons,
    penaltyReasons: item.penaltyReasons,
    limitations: item.limitations,
    avmOverlap: item.avmOverlap,
    recordMatchStrength: item.recordMatchStrength,
    providerCorrelation: item.providerCorrelation,
  });
  const topFive = selection.topFiveStrong.map(summarize);
  const topFiveUsable = selection.directSoldCompCandidates
    .filter((item) => item.compQuality === 'STRONG' || item.compQuality === 'ACCEPTABLE')
    .slice(0, 5)
    .map(summarize);
  return {
    propertyId: result.propertyId,
    soldRecordCache: 'HIT' as const,
    liveRentCastCalls: 0 as const,
    soldRecordsAvailable: selection.soldRecordsAvailable,
    recordedPriceCoverage: withSale.filter((record) => Boolean(record.latestValidSale?.salePrice)).length,
    recordedDateCoverage: withSale.filter((record) => Boolean(record.latestValidSale?.saleDate)).length,
    directSoldCompCandidates: selection.directSoldCompCandidates.length,
    hardInvalid: selection.hardInvalid.length,
    weak: selection.weak.length,
    acceptable: selection.acceptable.length,
    strong: selection.strong.length,
    topFive,
    topFiveUsable,
    weakExamples: selection.weak.slice(0, 5).map(summarize),
    avmOverlapAmongTopFive: selection.avmOverlapAmongTopFive,
    sufficiency: selection.sufficiency,
    descriptiveStatistics: selection.descriptiveStatistics,
    lotCoverage: result.soldPool.records.filter((record) => record.lotSizeSqft !== null).length,
  };
}
