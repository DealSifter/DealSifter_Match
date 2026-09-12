import type { Evidence, PropertyLookupInput } from './types.ts';

export type ValuationRequestPolicy = {
  maxRadius: number;
  daysOld: number;
  compCount: number;
  lookupSubjectAttributes: boolean;
};

export type NormalizedValuationSubject = {
  providerPropertyId: Evidence<string>;
  formattedAddress: Evidence<string>;
  addressLine1: Evidence<string>;
  city: Evidence<string>;
  state: Evidence<string>;
  zipCode: Evidence<string>;
  latitude: Evidence<number>;
  longitude: Evidence<number>;
  propertyType: Evidence<string>;
  bedrooms: Evidence<number>;
  bathrooms: Evidence<number>;
  livingAreaSqft: Evidence<number>;
  lotSizeSqft: Evidence<number>;
  yearBuilt: Evidence<number>;
  lastSalePrice: Evidence<number>;
  lastSaleDate: Evidence<string>;
};

export type NormalizedComparableCandidate = {
  provider: 'rentcast';
  retrievedAt: string;
  evidenceStatus: 'ESTIMATED' | 'VERIFIED_RECORD';
  providerPropertyId: string | null;
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
  price: number | null;
  priceSemantic: 'PROVIDER_LISTING_PRICE' | 'RECORDED_SALE_PRICE';
  listingStatus: string | null;
  listingType: string | null;
  listedDate: string | null;
  removedDate: string | null;
  lastSeenDate: string | null;
  daysOnMarket: number | null;
  distanceMiles: number | null;
  daysOld: number | null;
  providerCorrelation: number | null;
  derived: {
    pricePerSqft: Evidence<number>;
    sqftVarianceFromSubject: Evidence<number>;
    lotSizeVarianceFromSubject: Evidence<number>;
    yearBuiltDifference: Evidence<number>;
    bedroomDifference: Evidence<number>;
    bathroomDifference: Evidence<number>;
  };
};

export type NormalizedValuationEvidence = {
  provider: 'rentcast';
  evidenceType: 'property_value_avm';
  schemaVersion: 1;
  retrievedAt: string;
  requestPolicy: ValuationRequestPolicy;
  providerComparableCount: number;
  providerEstimate: {
    value: Evidence<number>;
    rangeLow: Evidence<number>;
    rangeHigh: Evidence<number>;
    providerConfidenceSemantic: 'PROVIDER_85_PERCENT_RANGE';
  };
  subjectProperty: NormalizedValuationSubject;
  comparables: NormalizedComparableCandidate[];
  limitations: readonly [
    'RENOVATION_CONDITION_UNAVAILABLE',
    'ARMS_LENGTH_DISTRESS_UNAVAILABLE',
    'PROVIDER_LISTING_PRICE_IS_NOT_CONFIRMED_SALE_PRICE',
  ];
};

export interface ValuationDataProvider {
  getValuationEvidence(input: PropertyLookupInput): Promise<NormalizedValuationEvidence>;
}

export type ComparableReasonCode =
  | 'SAME_PROPERTY_TYPE'
  | 'CLOSE_DISTANCE'
  | 'RECENT_MARKET_EVIDENCE'
  | 'SIMILAR_LIVING_AREA'
  | 'BEDROOM_MISMATCH'
  | 'BATHROOM_MISMATCH'
  | 'LOT_SIZE_VARIANCE'
  | 'YEAR_BUILT_VARIANCE'
  | 'DISTANT_COMPARABLE'
  | 'STALE_COMPARABLE'
  | 'MISSING_PRICE'
  | 'MISSING_SQFT'
  | 'UNSUPPORTED_PROPERTY_TYPE'
  | 'INCOMPATIBLE_PROPERTY_TYPE'
  | 'INSUFFICIENT_DATA'
  | 'RENOVATION_CONDITION_UNAVAILABLE'
  | 'ARMS_LENGTH_DISTRESS_UNAVAILABLE'
  | 'SALE_PRICE_UNCONFIRMED';

export type ComparableQualityDiagnostic = {
  providerPropertyId: string | null;
  classification: 'strong' | 'usable' | 'down_ranked' | 'hard_rejected';
  hardInvalidReasons: ComparableReasonCode[];
  positiveReasons: ComparableReasonCode[];
  penaltyReasons: ComparableReasonCode[];
  limitations: ComparableReasonCode[];
};

export type ComparableAnalysis = {
  diagnostics: ComparableQualityDiagnostic[];
  counts: { total: number; usable: number; strong: number; downRanked: number; hardRejected: number };
  descriptiveStatistics: {
    medianPrice: number | null;
    averagePrice: number | null;
    medianPricePerSqft: number | null;
    averagePricePerSqft: number | null;
  };
};

export type ValuationEvidenceResult = {
  propertyId: string;
  cacheHit: boolean;
  valuation: NormalizedValuationEvidence;
  comparableAnalysis: ComparableAnalysis;
};
