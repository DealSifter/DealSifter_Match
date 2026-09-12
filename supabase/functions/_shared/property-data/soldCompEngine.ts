import { normalizeState, normalizeStreet, normalizeZipCode } from './address.ts';
import {
  analyzeComparableCandidate,
  analyzeSaleComparables,
  INITIAL_DEALSIFTER_COMP_POLICY,
} from './compEngine.ts';
import { evaluateRecordedSoldCandidate, referenceSetClass } from './compQualityCalibration.ts';
import { evaluateWeightedCompCandidate } from './weightedCompPolicy.ts';
import type {
  ComparableQualityDiagnostic,
  NormalizedComparableCandidate,
  NormalizedValuationEvidence,
} from './valuationTypes.ts';
import type {
  CandidateSoldMatch,
  QualifiedSoldComparable,
  RecordedSoldComparableCandidate,
  RecordedSoldCompSelection,
  SoldCompReasonCode,
  SoldCompSet,
  SoldMatchStrength,
  SoldPropertyRecord,
} from './soldTypes.ts';

export const INITIAL_SOLD_COMP_POLICY = Object.freeze({
  recentSaleDays: 270, maximumDistanceMiles: 3, maximumLivingAreaVariance: 0.4,
  geographicIdentityMiles: 0.08, geographicIdentityLivingVariance: 0.15,
  minimumReferenceComps: 2, acceptableReferenceComps: 3, preferredReferenceComps: 5,
});

const normalizeType = (value: string | null) => String(value || '').trim().toLowerCase().replace(/^sfr$/, 'single family');
const variance = (left: number | null, right: number | null) => left !== null && right !== null && right > 0
  ? Math.abs(left - right) / right : null;
const radians = (value: number) => value * Math.PI / 180;
function coordinateDistanceMiles(leftLat: number | null, leftLng: number | null, rightLat: number | null, rightLng: number | null) {
  if (leftLat === null || leftLng === null || rightLat === null || rightLng === null) return null;
  const dLat = radians(rightLat - leftLat);
  const dLon = radians(rightLng - leftLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(leftLat)) * Math.cos(radians(rightLat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function distanceMiles(candidate: NormalizedComparableCandidate, record: SoldPropertyRecord) {
  return coordinateDistanceMiles(candidate.latitude, candidate.longitude, record.latitude, record.longitude);
}
function addressMatches(candidate: NormalizedComparableCandidate, record: SoldPropertyRecord) {
  return Boolean(candidate.addressLine1 && record.addressLine1
    && normalizeStreet(candidate.addressLine1) === normalizeStreet(record.addressLine1)
    && normalizeState(candidate.state) === normalizeState(record.state)
    && normalizeZipCode(candidate.zipCode) === normalizeZipCode(record.zipCode));
}

function unitIdentifier(value: string | null) {
  return String(value || '').toUpperCase().match(/(?:UNIT|APT|#)[\s,-]*([A-Z0-9-]+)/)?.[1] || null;
}

function hasUnitConflict(candidate: NormalizedComparableCandidate, record: SoldPropertyRecord) {
  const candidateUnits = new Set([candidate.providerPropertyId, candidate.formattedAddress]
    .map(unitIdentifier).filter((value): value is string => Boolean(value)));
  const recordUnits = new Set([record.providerPropertyId, record.formattedAddress]
    .map(unitIdentifier).filter((value): value is string => Boolean(value)));
  if (candidateUnits.size > 1 || recordUnits.size > 1) return true;
  if (!candidateUnits.size && !recordUnits.size) return false;
  return [...candidateUnits][0] !== [...recordUnits][0];
}

function matchCandidate(candidate: NormalizedComparableCandidate, records: SoldPropertyRecord[]) {
  const exactId = candidate.providerPropertyId
    ? records.filter((record) => record.providerPropertyId === candidate.providerPropertyId) : [];
  if (exactId.length === 1 && hasUnitConflict(candidate, exactId[0])) {
    return { strength: 'AMBIGUOUS' as const, record: null,
      reasons: ['AMBIGUOUS_PROPERTY_MATCH', 'IDENTITY_ADDRESS_CONFLICT'] as SoldCompReasonCode[] };
  }
  if (exactId.length === 1) return { strength: 'EXACT' as const, record: exactId[0], reasons: ['EXACT_PROPERTY_MATCH'] as SoldCompReasonCode[] };
  if (exactId.length > 1) return { strength: 'AMBIGUOUS' as const, record: null, reasons: ['AMBIGUOUS_PROPERTY_MATCH'] as SoldCompReasonCode[] };
  const exactAddress = records.filter((record) => addressMatches(candidate, record));
  if (exactAddress.length === 1 && hasUnitConflict(candidate, exactAddress[0])) {
    return { strength: 'AMBIGUOUS' as const, record: null,
      reasons: ['AMBIGUOUS_PROPERTY_MATCH', 'IDENTITY_ADDRESS_CONFLICT'] as SoldCompReasonCode[] };
  }
  if (exactAddress.length === 1) return { strength: 'EXACT' as const, record: exactAddress[0], reasons: ['EXACT_PROPERTY_MATCH'] as SoldCompReasonCode[] };
  if (exactAddress.length > 1) return { strength: 'AMBIGUOUS' as const, record: null, reasons: ['AMBIGUOUS_PROPERTY_MATCH'] as SoldCompReasonCode[] };
  const geographic = records.filter((record) => {
    const distance = distanceMiles(candidate, record);
    const sqftVariance = variance(record.livingAreaSqft, candidate.livingAreaSqft);
    return distance !== null && distance <= INITIAL_SOLD_COMP_POLICY.geographicIdentityMiles
      && normalizeType(record.propertyType) === normalizeType(candidate.propertyType)
      && sqftVariance !== null && sqftVariance <= INITIAL_SOLD_COMP_POLICY.geographicIdentityLivingVariance;
  });
  if (geographic.length === 1) return { strength: 'STRONG' as const, record: geographic[0], reasons: ['STRONG_PROPERTY_MATCH'] as SoldCompReasonCode[] };
  if (geographic.length > 1) return { strength: 'AMBIGUOUS' as const, record: null, reasons: ['AMBIGUOUS_PROPERTY_MATCH'] as SoldCompReasonCode[] };
  return { strength: 'NO_MATCH' as const, record: null, reasons: ['NO_SOLD_RECORD_MATCH'] as SoldCompReasonCode[] };
}

function calculated(value: number | null, retrievedAt: string) {
  return value === null
    ? { value: null, status: 'UNAVAILABLE' as const, source: 'calculation' as const, retrievedAt, effectiveDate: null, providerPropertyId: null, confidence: null }
    : { value, status: 'CALCULATED' as const, source: 'calculation' as const, retrievedAt, effectiveDate: null, providerPropertyId: null, confidence: null };
}

function qualify(candidate: NormalizedComparableCandidate, record: SoldPropertyRecord,
  matchStrength: 'EXACT' | 'STRONG', diagnostic: ComparableQualityDiagnostic,
  valuation: NormalizedValuationEvidence, initialReasons: SoldCompReasonCode[]): QualifiedSoldComparable | null {
  const sale = record.latestValidSale;
  if (!sale) return null;
  const retrievedAt = valuation.retrievedAt;
  const reasons = [...initialReasons, 'RECORDED_SALE_CONFIRMED'] as SoldCompReasonCode[];
  const limitations: SoldCompReasonCode[] = ['TRANSACTION_QUALITY_UNKNOWN', 'RENOVATION_CONDITION_UNKNOWN'];
  if (record.lotSizeSqft === null) limitations.push('LOT_DATA_UNAVAILABLE');
  if (record.saleTransactionAmbiguous) limitations.push('SALE_TRANSACTION_AMBIGUOUS');
  const saleAge = Math.floor((Date.parse(retrievedAt) - Date.parse(sale.saleDate)) / 86_400_000);
  if (saleAge <= INITIAL_SOLD_COMP_POLICY.recentSaleDays) reasons.push('RECORDED_SALE_RECENT');
  else reasons.push('RECORDED_SALE_OLD');
  const sqftVariance = variance(record.livingAreaSqft, candidate.livingAreaSqft);
  const recalculatedDistance = coordinateDistanceMiles(
    valuation.subjectProperty.latitude.value, valuation.subjectProperty.longitude.value,
    record.latitude, record.longitude,
  );
  const distanceDiverges = candidate.distanceMiles !== null && recalculatedDistance !== null
    && Math.abs(candidate.distanceMiles - recalculatedDistance) > Math.max(0.25, candidate.distanceMiles * 0.3);
  if (distanceDiverges) limitations.push('DISTANCE_DIVERGENCE');
  const structurallyStrong = diagnostic.classification !== 'hard_rejected'
    && normalizeType(record.propertyType) === normalizeType(candidate.propertyType)
    && candidate.distanceMiles !== null && candidate.distanceMiles <= INITIAL_SOLD_COMP_POLICY.maximumDistanceMiles
    && sqftVariance !== null && sqftVariance <= INITIAL_SOLD_COMP_POLICY.maximumLivingAreaVariance
    && saleAge <= INITIAL_SOLD_COMP_POLICY.recentSaleDays && !record.saleTransactionAmbiguous && !distanceDiverges;
  if (!structurallyStrong) limitations.push('STRUCTURAL_COMPARABILITY_WEAK');
  const pricePerSqft = record.livingAreaSqft && record.livingAreaSqft > 0 ? sale.salePrice / record.livingAreaSqft : null;
  return {
    candidate, soldRecord: record, recordedSalePrice: sale.salePrice, recordedSaleDate: sale.saleDate,
    recordedSalePricePerSqft: calculated(pricePerSqft, retrievedAt), matchStrength,
    quality: structurallyStrong ? 'strong' : 'conditional', compDiagnostics: diagnostic,
    reasons, limitations, evidenceStatus: 'VERIFIED_RECORD',
  };
}

export function crossValidateSoldComparables(valuation: NormalizedValuationEvidence, records: SoldPropertyRecord[]): SoldCompSet {
  const diagnostics = analyzeSaleComparables(valuation).diagnostics;
  const diagnosticById = new Map(diagnostics.map((item) => [item.providerPropertyId, item]));
  const matches: CandidateSoldMatch[] = [];
  const qualified: QualifiedSoldComparable[] = [];
  valuation.comparables.forEach((candidate) => {
    const match = matchCandidate(candidate, records);
    const matchReasons = [...match.reasons];
    if (match.record && !match.record.latestValidSale) matchReasons.push('SALE_PRICE_UNAVAILABLE', 'SALE_DATE_UNAVAILABLE');
    if (match.record?.saleTransactionAmbiguous) matchReasons.push('SALE_TRANSACTION_AMBIGUOUS');
    matches.push({ candidateProviderPropertyId: candidate.providerPropertyId,
      soldProviderPropertyId: match.record?.providerPropertyId || null, matchStrength: match.strength, reasons: matchReasons });
    const diagnostic = diagnosticById.get(candidate.providerPropertyId);
    if (match.record && diagnostic && (match.strength === 'EXACT' || match.strength === 'STRONG')) {
      const item = qualify(candidate, match.record, match.strength, diagnostic, valuation, matchReasons);
      if (item) qualified.push(item);
    }
  });
  qualified.sort((left, right) => Number(right.quality === 'strong') - Number(left.quality === 'strong')
    || left.limitations.length - right.limitations.length
    || (left.candidate.distanceMiles ?? Infinity) - (right.candidate.distanceMiles ?? Infinity));
  const strong = qualified.filter((item) => item.quality === 'strong');
  const conditional = qualified.filter((item) => item.quality === 'conditional');
  const sufficiency = strong.length >= INITIAL_SOLD_COMP_POLICY.acceptableReferenceComps
    ? 'SUFFICIENT' : strong.length >= INITIAL_SOLD_COMP_POLICY.minimumReferenceComps
      ? 'CONDITIONAL' : 'INSUFFICIENT';
  const count = (strength: SoldMatchStrength) => matches.filter((item) => item.matchStrength === strength).length;
  return {
    totalAvmCandidates: valuation.comparables.length, soldRecordsFound: records.length,
    matchedCandidates: count('EXACT') + count('STRONG'), exactMatches: count('EXACT'), strongMatches: count('STRONG'),
    ambiguousMatches: count('AMBIGUOUS'), unmatchedCandidates: count('NO_MATCH'),
    qualifiedSoldComps: qualified, strongSoldComps: strong, conditionalSoldComps: conditional, matches, sufficiency,
  };
}

function absoluteDifference(left: number | null, right: number | null) {
  return left !== null && right !== null ? Math.abs(left - right) : null;
}

function directCandidateAdapter(
  valuation: NormalizedValuationEvidence,
  record: SoldPropertyRecord,
  distance: number | null,
  daysSinceSale: number | null,
): NormalizedComparableCandidate {
  const subject = valuation.subjectProperty;
  const salePrice = record.latestValidSale?.salePrice ?? null;
  return {
    provider: 'rentcast',
    retrievedAt: record.retrievedAt,
    evidenceStatus: 'VERIFIED_RECORD',
    providerPropertyId: record.providerPropertyId,
    formattedAddress: record.formattedAddress,
    addressLine1: record.addressLine1,
    city: record.city,
    state: record.state,
    zipCode: record.zipCode,
    latitude: record.latitude,
    longitude: record.longitude,
    propertyType: record.propertyType,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms,
    livingAreaSqft: record.livingAreaSqft,
    lotSizeSqft: record.lotSizeSqft,
    yearBuilt: record.yearBuilt,
    price: salePrice,
    priceSemantic: 'RECORDED_SALE_PRICE',
    listingStatus: null,
    listingType: null,
    listedDate: null,
    removedDate: null,
    lastSeenDate: null,
    daysOnMarket: null,
    distanceMiles: distance,
    daysOld: daysSinceSale,
    providerCorrelation: null,
    derived: {
      pricePerSqft: calculated(salePrice !== null && record.livingAreaSqft !== null
        ? salePrice / record.livingAreaSqft : null, record.retrievedAt),
      sqftVarianceFromSubject: calculated(variance(record.livingAreaSqft, subject.livingAreaSqft.value), record.retrievedAt),
      lotSizeVarianceFromSubject: calculated(variance(record.lotSizeSqft, subject.lotSizeSqft.value), record.retrievedAt),
      yearBuiltDifference: calculated(absoluteDifference(record.yearBuilt, subject.yearBuilt.value), record.retrievedAt),
      bedroomDifference: calculated(absoluteDifference(record.bedrooms, subject.bedrooms.value), record.retrievedAt),
      bathroomDifference: calculated(absoluteDifference(record.bathrooms, subject.bathrooms.value), record.retrievedAt),
    },
  };
}

function findAvmOverlap(record: SoldPropertyRecord, valuation: NormalizedValuationEvidence) {
  const matches = valuation.comparables.map((candidate) => ({ candidate, ...matchCandidate(candidate, [record]) }));
  const exact = matches.filter((item) => item.strength === 'EXACT');
  if (exact.length === 1) return { strength: 'EXACT' as const, candidate: exact[0].candidate };
  if (exact.length > 1) return { strength: 'AMBIGUOUS' as const, candidate: null };
  const strong = matches.filter((item) => item.strength === 'STRONG');
  if (strong.length === 1) return { strength: 'STRONG' as const, candidate: strong[0].candidate };
  if (strong.length > 1 || matches.some((item) => item.strength === 'AMBIGUOUS')) {
    return { strength: 'AMBIGUOUS' as const, candidate: null };
  }
  return { strength: 'NO_MATCH' as const, candidate: null };
}

const round = (value: number) => Math.round(value * 100) / 100;
function distribution(values: number[]) {
  if (!values.length) return { median: null, average: null, minimum: null, maximum: null };
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    median: round(median),
    average: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    minimum: sorted[0],
    maximum: sorted[sorted.length - 1],
  };
}

export function selectRecordedSoldComparables(
  valuation: NormalizedValuationEvidence,
  records: SoldPropertyRecord[],
): RecordedSoldCompSelection {
  const subject = valuation.subjectProperty;
  const asOf = records[0]?.retrievedAt || valuation.retrievedAt;
  const candidates = records.map((record): RecordedSoldComparableCandidate => {
    const sale = record.latestValidSale;
    const daysSinceSale = sale && Number.isFinite(Date.parse(sale.saleDate))
      ? Math.floor((Date.parse(asOf) - Date.parse(sale.saleDate)) / 86_400_000) : null;
    const distance = coordinateDistanceMiles(
      subject.latitude.value, subject.longitude.value, record.latitude, record.longitude,
    );
    const adapter = directCandidateAdapter(valuation, record, distance, daysSinceSale);
    const diagnostic = analyzeComparableCandidate(adapter, subject.propertyType.value);
    const hardInvalidReasons = [...diagnostic.hardInvalidReasons] as RecordedSoldComparableCandidate['hardInvalidReasons'];
    if (!sale) hardInvalidReasons.push('SALE_PRICE_UNAVAILABLE', 'SALE_DATE_UNAVAILABLE');
    if (record.saleTransactionAmbiguous) hardInvalidReasons.push('SALE_TRANSACTION_AMBIGUOUS');
    const hasCoreSimilarity = distance !== null
      && distance <= INITIAL_SOLD_COMP_POLICY.maximumDistanceMiles
      && adapter.derived.sqftVarianceFromSubject.value !== null
      && adapter.derived.sqftVarianceFromSubject.value <= INITIAL_SOLD_COMP_POLICY.maximumLivingAreaVariance
      && daysSinceSale !== null && daysSinceSale >= 0
      && daysSinceSale <= INITIAL_SOLD_COMP_POLICY.recentSaleDays;
    let baselineCompQuality: RecordedSoldComparableCandidate['baselineCompQuality'];
    if (hardInvalidReasons.length) baselineCompQuality = 'HARD_INVALID';
    else if (diagnostic.classification === 'strong' && hasCoreSimilarity) baselineCompQuality = 'STRONG';
    else if (diagnostic.classification === 'usable' && hasCoreSimilarity) baselineCompQuality = 'ACCEPTABLE';
    else baselineCompQuality = 'WEAK';
    const overlap = findAvmOverlap(record, valuation);
    const qualityReasons: RecordedSoldComparableCandidate['qualityReasons'] = [
      ...(sale ? ['RECORDED_SALE_CONFIRMED' as const] : []),
      ...(sale && daysSinceSale !== null && daysSinceSale <= INITIAL_DEALSIFTER_COMP_POLICY.recentDays
        ? ['RECORDED_SALE_RECENT' as const]
        : sale && daysSinceSale !== null && daysSinceSale <= INITIAL_SOLD_COMP_POLICY.recentSaleDays
          ? ['RECORDED_SALE_WITHIN_WINDOW' as const]
          : sale ? ['RECORDED_SALE_OLD' as const] : []),
      ...diagnostic.positiveReasons,
    ];
    const penaltyReasons: RecordedSoldComparableCandidate['penaltyReasons'] = [...diagnostic.penaltyReasons];
    if (!hasCoreSimilarity && !hardInvalidReasons.length) penaltyReasons.push('STRUCTURAL_COMPARABILITY_WEAK');
    const limitations: RecordedSoldComparableCandidate['limitations'] = [
      'TRANSACTION_QUALITY_UNKNOWN', 'RENOVATION_CONDITION_UNKNOWN',
      ...(record.lotSizeSqft === null ? ['LOT_DATA_UNAVAILABLE' as const] : []),
    ];
    const base: RecordedSoldComparableCandidate = {
      soldRecord: record,
      recordedSalePrice: sale?.salePrice ?? null,
      recordedSaleDate: sale?.saleDate ?? null,
      recordedSalePricePerSqft: adapter.derived.pricePerSqft,
      distanceFromSubjectMiles: calculated(distance, asOf),
      daysSinceSale: calculated(daysSinceSale, asOf),
      sqftDifference: calculated(absoluteDifference(record.livingAreaSqft, subject.livingAreaSqft.value), asOf),
      sqftDifferencePercent: adapter.derived.sqftVarianceFromSubject,
      bedroomDifference: adapter.derived.bedroomDifference,
      bathroomDifference: adapter.derived.bathroomDifference,
      lotSizeDifference: calculated(absoluteDifference(record.lotSizeSqft, subject.lotSizeSqft.value), asOf),
      lotSizeDifferencePercent: adapter.derived.lotSizeVarianceFromSubject,
      yearBuiltDifference: adapter.derived.yearBuiltDifference,
      evidenceStatus: 'VERIFIED_RECORD',
      baselineCompQuality,
      compQuality: baselineCompQuality,
      qualityScore: 0,
      qualityChecks: {
        recordedSale: 'UNAVAILABLE', recency: 'UNAVAILABLE', proximity: 'UNAVAILABLE',
        propertyType: 'UNAVAILABLE', structuralCompatibility: 'UNAVAILABLE', livingArea: 'UNAVAILABLE', bedrooms: 'UNAVAILABLE',
        bathrooms: 'UNAVAILABLE', lotSize: 'UNAVAILABLE', yearBuilt: 'UNAVAILABLE',
        specialCharacteristics: 'UNAVAILABLE', missingDataBurden: 'UNAVAILABLE',
      },
      primaryQualityBlocker: null,
      weightedAssessment: null,
      qualityReasons,
      penaltyReasons,
      hardInvalidReasons,
      limitations,
      recordMatchStrength: overlap.strength,
      avmOverlap: overlap.strength === 'EXACT' || overlap.strength === 'STRONG',
      providerCorrelation: overlap.candidate?.providerCorrelation ?? null,
    };
    const calibrated = evaluateRecordedSoldCandidate(base, 'MULTI_CHECK_BALANCED');
    const calibratedCandidate = { ...base, compQuality: calibrated.quality, qualityScore: calibrated.score,
      qualityChecks: calibrated.checks, primaryQualityBlocker: calibrated.primaryBlocker };
    return { ...calibratedCandidate,
      weightedAssessment: evaluateWeightedCompCandidate(calibratedCandidate, 'WEIGHTED_BALANCED') };
  });
  const order = { STRONG: 0, GOOD: 1, ACCEPTABLE: 2, WEAK: 3, HARD_INVALID: 4 } as const;
  candidates.sort((left, right) => order[left.compQuality] - order[right.compQuality]
    || left.penaltyReasons.length - right.penaltyReasons.length
    || right.qualityReasons.length - left.qualityReasons.length
    || (left.distanceFromSubjectMiles.value ?? Infinity) - (right.distanceFromSubjectMiles.value ?? Infinity)
    || (left.sqftDifferencePercent.value ?? Infinity) - (right.sqftDifferencePercent.value ?? Infinity)
    || (left.daysSinceSale.value ?? Infinity) - (right.daysSinceSale.value ?? Infinity)
    || String(left.soldRecord.providerPropertyId || '').localeCompare(String(right.soldRecord.providerPropertyId || '')));
  const hardInvalid = candidates.filter((item) => item.compQuality === 'HARD_INVALID');
  const weak = candidates.filter((item) => item.compQuality === 'WEAK');
  const good = candidates.filter((item) => item.compQuality === 'GOOD');
  const acceptable = candidates.filter((item) => item.compQuality === 'ACCEPTABLE');
  const strong = candidates.filter((item) => item.compQuality === 'STRONG');
  const topFiveStrong = strong.slice(0, 5);
  const primaryStructuralCandidates = candidates.filter((item) => item.weightedAssessment?.primaryArvCompCandidate)
    .sort((left, right) => (right.weightedAssessment?.structuralComparabilityScore ?? 0)
      - (left.weightedAssessment?.structuralComparabilityScore ?? 0)
      || (left.distanceFromSubjectMiles.value ?? Infinity) - (right.distanceFromSubjectMiles.value ?? Infinity));
  const usable = [...strong, ...good, ...acceptable];
  const statisticsSource = topFiveStrong.length ? topFiveStrong : usable.slice(0, 5);
  const priceStats = distribution(statisticsSource
    .map((item) => item.recordedSalePrice).filter((value): value is number => value !== null));
  const sqftStats = distribution(statisticsSource
    .map((item) => item.recordedSalePricePerSqft.value).filter((value): value is number => value !== null));
  return {
    soldRecordsAvailable: records.length,
    directSoldCompCandidates: candidates,
    hardInvalid,
    weak,
    good,
    acceptable,
    strong,
    topFiveStrong,
    avmOverlapAmongTopFive: topFiveStrong.filter((item) => item.avmOverlap).length,
    sufficiency: strong.length >= 3 ? 'SUFFICIENT' : strong.length === 2 ? 'CONDITIONAL' : 'INSUFFICIENT',
    referenceSetClass: referenceSetClass(strong.length),
    primaryStructuralCandidates,
    structuralReferenceSetClass: referenceSetClass(primaryStructuralCandidates.length),
    conditionVerifiedArvComps: [],
    descriptiveStatistics: {
      scope: topFiveStrong.length ? 'TOP_5_STRONG' : 'TOP_5_USABLE',
      medianRecordedSalePrice: priceStats.median,
      medianRecordedSalePricePerSqft: sqftStats.median,
      averageRecordedSalePricePerSqft: sqftStats.average,
      minimumRecordedSalePrice: priceStats.minimum,
      maximumRecordedSalePrice: priceStats.maximum,
    },
  };
}
