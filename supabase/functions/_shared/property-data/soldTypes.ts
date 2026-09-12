import type { Evidence, PropertyLookupInput } from './types.ts';
import type { ComparableQualityDiagnostic, NormalizedComparableCandidate, NormalizedValuationEvidence } from './valuationTypes.ts';

export type SoldSearchPolicy = {
  radiusMiles: number;
  saleDateRangeDays: number;
  propertyType: string;
  limit: number;
};

export type RecordedSaleTransaction = {
  saleDate: string;
  salePrice: number;
  evidenceStatus: 'VERIFIED_RECORD';
  source: 'rentcast_property_record';
};

export type SoldPropertyRecord = {
  provider: 'rentcast';
  providerPropertyId: string | null;
  assessorId: string | null;
  retrievedAt: string;
  formattedAddress: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  lotSizeSqft: number | null;
  yearBuilt: number | null;
  saleTransactions: RecordedSaleTransaction[];
  latestValidSale: RecordedSaleTransaction | null;
  saleTransactionAmbiguous: boolean;
  transactionQuality: 'UNKNOWN';
};

export type NormalizedSoldRecordPool = {
  provider: 'rentcast';
  evidenceType: 'property_sold_record_pool';
  schemaVersion: 1;
  retrievedAt: string;
  requestPolicy: SoldSearchPolicy;
  queryFingerprint: string;
  recordsReturned: number;
  records: SoldPropertyRecord[];
};

export interface SoldRecordDataProvider {
  getSoldRecordPool(input: PropertyLookupInput & { policy: SoldSearchPolicy; queryFingerprint: string }): Promise<NormalizedSoldRecordPool>;
}

export type SoldMatchStrength = 'EXACT' | 'STRONG' | 'AMBIGUOUS' | 'NO_MATCH';

export type SoldCompReasonCode =
  | 'RECORDED_SALE_CONFIRMED'
  | 'RECORDED_SALE_RECENT'
  | 'RECORDED_SALE_OLD'
  | 'EXACT_PROPERTY_MATCH'
  | 'STRONG_PROPERTY_MATCH'
  | 'AMBIGUOUS_PROPERTY_MATCH'
  | 'IDENTITY_ADDRESS_CONFLICT'
  | 'SALE_PRICE_UNAVAILABLE'
  | 'SALE_DATE_UNAVAILABLE'
  | 'TRANSACTION_QUALITY_UNKNOWN'
  | 'RENOVATION_CONDITION_UNKNOWN'
  | 'LOT_DATA_UNAVAILABLE'
  | 'NO_SOLD_RECORD_MATCH'
  | 'SALE_TRANSACTION_AMBIGUOUS'
  | 'DISTANCE_DIVERGENCE'
  | 'STRUCTURAL_COMPARABILITY_WEAK';

export type QualifiedSoldComparable = {
  candidate: NormalizedComparableCandidate;
  soldRecord: SoldPropertyRecord;
  recordedSalePrice: number;
  recordedSaleDate: string;
  recordedSalePricePerSqft: Evidence<number>;
  matchStrength: 'EXACT' | 'STRONG';
  quality: 'strong' | 'conditional';
  compDiagnostics: ComparableQualityDiagnostic;
  reasons: SoldCompReasonCode[];
  limitations: SoldCompReasonCode[];
  evidenceStatus: 'VERIFIED_RECORD';
};

export type CandidateSoldMatch = {
  candidateProviderPropertyId: string | null;
  soldProviderPropertyId: string | null;
  matchStrength: SoldMatchStrength;
  reasons: SoldCompReasonCode[];
};

export type SoldCompSet = {
  totalAvmCandidates: number;
  soldRecordsFound: number;
  matchedCandidates: number;
  exactMatches: number;
  strongMatches: number;
  ambiguousMatches: number;
  unmatchedCandidates: number;
  qualifiedSoldComps: QualifiedSoldComparable[];
  strongSoldComps: QualifiedSoldComparable[];
  conditionalSoldComps: QualifiedSoldComparable[];
  matches: CandidateSoldMatch[];
  sufficiency: 'SUFFICIENT' | 'CONDITIONAL' | 'INSUFFICIENT';
};

export type SoldEvidenceResult = {
  propertyId: string;
  cacheHit: boolean;
  soldPool: NormalizedSoldRecordPool;
  valuation: NormalizedValuationEvidence;
  soldCompSet: SoldCompSet;
};
