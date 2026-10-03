import type { RecordedSoldComparableCandidate } from './soldTypes.ts';

export const RECENT_SALES_POLICY_V1 = Object.freeze({
  version: 'DEALSIFTER_RECENT_SALES_V1',
  maximumAgeDays: 180,
  minimumComparables: 2,
  preferredComparables: 3,
  maximumComparables: 5,
  maximumDistanceMiles: 5,
  outlierMadMultiplier: 3.5,
  weights: Object.freeze({
    structural: 0.35,
    completeness: 0.15,
    proximity: 0.15,
    recency: 0.15,
    sizeSimilarity: 0.15,
    providerCorrelation: 0.05,
  }),
});

export type RecentSalesSubject = {
  propertyType: string | null;
  livingAreaSqft: number | null;
  lotSizeSqft: number | null;
  providerPropertyType?: string | null;
  materialIdentityConflict?: boolean;
  analysisTypeResolution?: 'USE_STORED' | 'USE_PROVIDER' | null;
};

export type RecentSalesValuationComp = {
  providerPropertyId: string | null;
  address: string | null;
  salePrice: number;
  saleDate: string;
  saleAgeDays: number;
  distanceMiles: number;
  propertyType: string | null;
  unitMetric: 'PRICE_PER_SQFT' | 'PRICE_PER_ACRE';
  unitValue: number;
  lotPricePerSqft: number | null;
  impliedSubjectValue: number;
  weight: number;
  structuralScore: number;
  completenessScore: number;
  providerCorrelation: number | null;
  classification: 'VALUATION_INCLUDED' | 'MARKET_REFERENCE_OUTLIER';
  reasons: string[];
};

export type RecentSalesMarketEstimate = {
  methodology: 'RECENT_SALES_MARKET_ESTIMATE';
  methodologyVersion: string;
  status: 'AVAILABLE' | 'INSUFFICIENT_RECENT_SALES_EVIDENCE'
    | 'INSUFFICIENT_RECENT_LAND_SALES_EVIDENCE' | 'BLOCKED_BY_MATERIAL_CONFLICT';
  propertyCategory: 'RESIDENTIAL' | 'LAND';
  centralEstimate: number | null;
  range: { low: number; high: number } | null;
  weightedUnitValue: number | null;
  weightedLotPricePerSqft: number | null;
  unitMetric: 'PRICE_PER_SQFT' | 'PRICE_PER_ACRE';
  qualifyingSalesCount: number;
  valuationCompCount: number;
  confidence: 'LOW' | 'MODERATE' | 'HIGH';
  confidenceReasons: string[];
  dispersion: { coefficient: number | null; minimumUnitValue: number | null; maximumUnitValue: number | null };
  conditionAdjustmentStatus: 'CONDITION_NOT_ADJUSTED';
  valuationComps: RecentSalesValuationComp[];
  marketReferenceOutliers: RecentSalesValuationComp[];
  historicalReferences: Array<{ providerPropertyId: string | null; saleAgeDays: number | null; reason: string }>;
  exclusions: Array<{ providerPropertyId: string | null; reasons: string[] }>;
  providerAvmCompatibility: 'COMPATIBLE' | 'QUARANTINED_FOR_TYPE_CONFLICT' | 'UNKNOWN';
};

const finite = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const roundMoney = (value: number) => Math.round(value);
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const normalizeType = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const isLand = (value: unknown) => ['land', 'lot', 'vacantland', 'undevelopedland'].includes(normalizeType(value));
const sameType = (left: unknown, right: unknown) => {
  const a = normalizeType(left);
  const b = normalizeType(right);
  if (!a || !b) return false;
  if (isLand(a) || isLand(b)) return isLand(a) && isLand(b);
  const singleFamily = new Set(['sfr', 'singlefamily', 'singlefamilyresidence', 'detached']);
  return a === b || (singleFamily.has(a) && singleFamily.has(b));
};

function weightedQuantile(values: Array<{ value: number; weight: number }>, quantile: number) {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  const target = total * quantile;
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= target) return item.value;
  }
  return sorted.at(-1)?.value ?? 0;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function outlierIndexes(values: number[]) {
  if (values.length < 4) return new Set<number>();
  const center = median(values);
  const mad = median(values.map((value) => Math.abs(value - center)));
  if (mad === 0) return new Set(values.map((value, index) => Math.abs(value - center) > 0 ? index : -1).filter((index) => index >= 0));
  return new Set(values.map((value, index) => Math.abs(value - center) / (1.4826 * mad) > RECENT_SALES_POLICY_V1.outlierMadMultiplier ? index : -1)
    .filter((index) => index >= 0));
}

function avmCompatibility(subject: RecentSalesSubject) {
  if (!subject.providerPropertyType) return 'UNKNOWN' as const;
  return sameType(subject.propertyType, subject.providerPropertyType)
    ? 'COMPATIBLE' as const : 'QUARANTINED_FOR_TYPE_CONFLICT' as const;
}

export function buildRecentSalesMarketEstimate(
  subject: RecentSalesSubject,
  candidates: RecordedSoldComparableCandidate[],
): RecentSalesMarketEstimate {
  const land = isLand(subject.propertyType);
  const propertyCategory = land ? 'LAND' as const : 'RESIDENTIAL' as const;
  const compatibility = avmCompatibility(subject);
  const base = {
    methodology: 'RECENT_SALES_MARKET_ESTIMATE' as const,
    methodologyVersion: RECENT_SALES_POLICY_V1.version,
    propertyCategory,
    conditionAdjustmentStatus: 'CONDITION_NOT_ADJUSTED' as const,
    providerAvmCompatibility: compatibility,
  };
  const blocked = subject.materialIdentityConflict === true
    || (compatibility === 'QUARANTINED_FOR_TYPE_CONFLICT' && !subject.analysisTypeResolution);
  if (blocked) return {
    ...base, status: 'BLOCKED_BY_MATERIAL_CONFLICT', centralEstimate: null, range: null,
    weightedUnitValue: null, weightedLotPricePerSqft: null,
    unitMetric: land ? 'PRICE_PER_ACRE' : 'PRICE_PER_SQFT', qualifyingSalesCount: 0,
    valuationCompCount: 0, confidence: 'LOW', confidenceReasons: ['UNRESOLVED_MATERIAL_IDENTITY_OR_TYPE_CONFLICT'],
    dispersion: { coefficient: null, minimumUnitValue: null, maximumUnitValue: null },
    valuationComps: [], marketReferenceOutliers: [], historicalReferences: [], exclusions: [],
  };

  const subjectArea = land ? finite(subject.lotSizeSqft) : finite(subject.livingAreaSqft);
  const historicalReferences: RecentSalesMarketEstimate['historicalReferences'] = [];
  const exclusions: RecentSalesMarketEstimate['exclusions'] = [];
  const qualified: RecentSalesValuationComp[] = [];
  for (const candidate of candidates) {
    const id = candidate.soldRecord.providerPropertyId;
    const reasons: string[] = [];
    const price = finite(candidate.recordedSalePrice);
    const age = finite(candidate.daysSinceSale.value);
    const distance = finite(candidate.distanceFromSubjectMiles.value);
    const compArea = land ? finite(candidate.soldRecord.lotSizeSqft) : finite(candidate.soldRecord.livingAreaSqft);
    if (age !== null && age > RECENT_SALES_POLICY_V1.maximumAgeDays) {
      historicalReferences.push({ providerPropertyId: id, saleAgeDays: age, reason: 'SALE_OLDER_THAN_180_DAYS' });
      continue;
    }
    if (!price || price <= 0) reasons.push('INVALID_RECORDED_SALE_PRICE');
    if (age === null || age < 0) reasons.push('INVALID_RECORDED_SALE_DATE');
    if (!sameType(subject.propertyType, candidate.soldRecord.propertyType)) reasons.push('INCOMPATIBLE_PROPERTY_TYPE');
    if (distance === null || distance > RECENT_SALES_POLICY_V1.maximumDistanceMiles) reasons.push('EXTREME_GEOGRAPHICAL_MISMATCH');
    if (!subjectArea || subjectArea <= 0) reasons.push(land ? 'INVALID_SUBJECT_LOT_AREA' : 'INVALID_SUBJECT_LIVING_AREA');
    if (!compArea || compArea <= 0) reasons.push(land ? 'INVALID_COMP_LOT_AREA' : 'INVALID_COMP_LIVING_AREA');
    if (candidate.evidenceStatus !== 'VERIFIED_RECORD') reasons.push('NOT_RECORDED_CLOSED_SALE');
    if (candidate.soldRecord.saleTransactionAmbiguous) reasons.push('SALE_TRANSACTION_AMBIGUOUS');
    if (reasons.length) {
      exclusions.push({ providerPropertyId: id, reasons });
      continue;
    }
    const assessment = candidate.weightedAssessment;
    const structuralScore = finite(assessment?.structuralComparabilityScore) ?? finite(candidate.qualityScore) ?? 0;
    const completenessScore = finite(assessment?.dataCompletenessScore) ?? 50;
    const sizeDelta = land ? finite(candidate.lotSizeDifferencePercent.value) : finite(candidate.sqftDifferencePercent.value);
    const sizeFactor = Math.max(0, 1 - Math.min(1, sizeDelta ?? 1));
    const proximityFactor = Math.max(0, 1 - (distance! / RECENT_SALES_POLICY_V1.maximumDistanceMiles));
    const recencyFactor = Math.max(0, 1 - (age! / RECENT_SALES_POLICY_V1.maximumAgeDays));
    const correlation = finite(candidate.providerCorrelation);
    const correlationFactor = correlation === null ? 0.5 : Math.max(0, Math.min(1, correlation));
    const weights = RECENT_SALES_POLICY_V1.weights;
    const weight = weights.structural * Math.max(0, Math.min(1, structuralScore / 100))
      + weights.completeness * Math.max(0, Math.min(1, completenessScore / 100))
      + weights.proximity * proximityFactor + weights.recency * recencyFactor
      + weights.sizeSimilarity * sizeFactor + weights.providerCorrelation * correlationFactor;
    const unitValue = land ? price! / (compArea! / 43_560) : price! / compArea!;
    const lotPricePerSqft = land ? price! / compArea! : null;
    const impliedSubjectValue = land ? unitValue * (subjectArea! / 43_560) : unitValue * subjectArea!;
    qualified.push({
      providerPropertyId: id, address: candidate.soldRecord.formattedAddress,
      salePrice: price!, saleDate: candidate.recordedSaleDate!, saleAgeDays: age!, distanceMiles: distance!,
      propertyType: candidate.soldRecord.propertyType, unitMetric: land ? 'PRICE_PER_ACRE' : 'PRICE_PER_SQFT',
      unitValue, lotPricePerSqft, impliedSubjectValue, weight: Math.max(0.0001, weight),
      structuralScore, completenessScore, providerCorrelation: correlation,
      classification: 'VALUATION_INCLUDED', reasons: ['RECORDED_SALE', 'SALE_WITHIN_180_DAYS', 'STRUCTURALLY_QUALIFIED'],
    });
  }
  qualified.sort((a, b) => b.weight - a.weight || a.saleAgeDays - b.saleAgeDays || a.distanceMiles - b.distanceMiles
    || String(a.providerPropertyId || '').localeCompare(String(b.providerPropertyId || '')));
  const outliers = outlierIndexes(qualified.map((item) => item.unitValue));
  const marketReferenceOutliers = qualified.filter((_, index) => outliers.has(index)).map((item) => ({
    ...item, classification: 'MARKET_REFERENCE_OUTLIER' as const, reasons: [...item.reasons, 'UNIT_VALUE_OUTLIER'],
  }));
  const valuationComps = qualified.filter((_, index) => !outliers.has(index)).slice(0, RECENT_SALES_POLICY_V1.maximumComparables);
  const insufficientStatus = land ? 'INSUFFICIENT_RECENT_LAND_SALES_EVIDENCE' as const
    : 'INSUFFICIENT_RECENT_SALES_EVIDENCE' as const;
  if (valuationComps.length < RECENT_SALES_POLICY_V1.minimumComparables) return {
    ...base, status: insufficientStatus, centralEstimate: null, range: null, weightedUnitValue: null,
    weightedLotPricePerSqft: null, unitMetric: land ? 'PRICE_PER_ACRE' : 'PRICE_PER_SQFT',
    qualifyingSalesCount: qualified.length, valuationCompCount: valuationComps.length, confidence: 'LOW',
    confidenceReasons: ['FEWER_THAN_TWO_QUALIFIED_RECENT_RECORDED_SALES'],
    dispersion: { coefficient: null, minimumUnitValue: null, maximumUnitValue: null },
    valuationComps, marketReferenceOutliers, historicalReferences, exclusions,
  };
  const weighted = valuationComps.map((item) => ({ value: item.unitValue, weight: item.weight }));
  const weightedUnitValue = weightedQuantile(weighted, 0.5);
  const weightedLotPricePerSqft = land
    ? weightedQuantile(valuationComps.map((item) => ({ value: item.lotPricePerSqft!, weight: item.weight })), 0.5) : null;
  const implied = valuationComps.map((item) => ({ value: item.impliedSubjectValue, weight: item.weight }));
  const centralEstimate = weightedUnitValue * (land ? subjectArea! / 43_560 : subjectArea!);
  const low = valuationComps.length === 2 ? Math.min(...implied.map((item) => item.value)) : weightedQuantile(implied, 0.25);
  const high = valuationComps.length === 2 ? Math.max(...implied.map((item) => item.value)) : weightedQuantile(implied, 0.75);
  const units = valuationComps.map((item) => item.unitValue);
  const minimumUnitValue = Math.min(...units);
  const maximumUnitValue = Math.max(...units);
  const dispersion = weightedUnitValue > 0 ? (maximumUnitValue - minimumUnitValue) / weightedUnitValue : null;
  const averageStructural = valuationComps.reduce((sum, item) => sum + item.structuralScore, 0) / valuationComps.length;
  const averageCompleteness = valuationComps.reduce((sum, item) => sum + item.completenessScore, 0) / valuationComps.length;
  const averageDistance = valuationComps.reduce((sum, item) => sum + item.distanceMiles, 0) / valuationComps.length;
  const confidenceReasons = [`${valuationComps.length}_QUALIFIED_RECENT_RECORDED_SALES`, 'CONDITION_NOT_ADJUSTED'];
  let confidence: 'LOW' | 'MODERATE' | 'HIGH' = valuationComps.length === 2 ? 'LOW' : 'MODERATE';
  if (dispersion !== null && dispersion > 0.35) {
    confidence = 'LOW';
    confidenceReasons.push('HIGH_UNIT_VALUE_DISPERSION');
  } else if (valuationComps.length >= 4 && averageStructural >= 80 && averageCompleteness >= 75 && averageDistance <= 1.5) {
    // Unknown condition deliberately caps what would otherwise be HIGH.
    confidence = 'MODERATE';
    confidenceReasons.push('HIGH_EVIDENCE_QUALITY_CAPPED_BY_UNADJUSTED_CONDITION');
  }
  if (compatibility === 'QUARANTINED_FOR_TYPE_CONFLICT') confidenceReasons.push('PROVIDER_AVM_QUARANTINED_FOR_TYPE_CONFLICT');
  return {
    ...base, status: 'AVAILABLE', centralEstimate: roundMoney(centralEstimate),
    range: { low: roundMoney(Math.min(low, centralEstimate)), high: roundMoney(Math.max(high, centralEstimate)) },
    weightedUnitValue: round(weightedUnitValue, 2),
    weightedLotPricePerSqft: weightedLotPricePerSqft === null ? null : round(weightedLotPricePerSqft, 4),
    unitMetric: land ? 'PRICE_PER_ACRE' : 'PRICE_PER_SQFT', qualifyingSalesCount: qualified.length,
    valuationCompCount: valuationComps.length, confidence, confidenceReasons,
    dispersion: { coefficient: dispersion === null ? null : round(dispersion), minimumUnitValue: round(minimumUnitValue, 2), maximumUnitValue: round(maximumUnitValue, 2) },
    valuationComps, marketReferenceOutliers, historicalReferences, exclusions,
  };
}

export function providerEstimateDivergence(providerEstimate: number | null, estimate: RecentSalesMarketEstimate) {
  if (estimate.status !== 'AVAILABLE' || !estimate.centralEstimate || !Number.isFinite(Number(providerEstimate))) return null;
  return round((Number(providerEstimate) - estimate.centralEstimate) / estimate.centralEstimate);
}
