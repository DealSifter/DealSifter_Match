import { normalizeState, normalizeStreet, normalizeZipCode } from './address.ts';
import { analyzeSaleComparables } from './compEngine.ts';
import type { ComparableQualityDiagnostic, NormalizedComparableCandidate, NormalizedValuationEvidence } from './valuationTypes.ts';
import type { CandidateSoldMatch, QualifiedSoldComparable, SoldCompReasonCode, SoldCompSet, SoldMatchStrength, SoldPropertyRecord } from './soldTypes.ts';

export const INITIAL_SOLD_COMP_POLICY = Object.freeze({
  recentSaleDays: 270, maximumDistanceMiles: 3, maximumLivingAreaVariance: 0.4,
  geographicIdentityMiles: 0.08, geographicIdentityLivingVariance: 0.15, minimumStrongComps: 5,
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
  const sufficiency = strong.length >= INITIAL_SOLD_COMP_POLICY.minimumStrongComps
    ? 'SUFFICIENT' : qualified.length ? 'CONDITIONAL' : 'INSUFFICIENT';
  const count = (strength: SoldMatchStrength) => matches.filter((item) => item.matchStrength === strength).length;
  return {
    totalAvmCandidates: valuation.comparables.length, soldRecordsFound: records.length,
    matchedCandidates: count('EXACT') + count('STRONG'), exactMatches: count('EXACT'), strongMatches: count('STRONG'),
    ambiguousMatches: count('AMBIGUOUS'), unmatchedCandidates: count('NO_MATCH'),
    qualifiedSoldComps: qualified, strongSoldComps: strong, conditionalSoldComps: conditional, matches, sufficiency,
  };
}
