export type EvidenceStatus =
  | 'VERIFIED_RECORD'
  | 'USER_PROVIDED'
  | 'CALCULATED'
  | 'ESTIMATED'
  | 'UNAVAILABLE';

export type Evidence<T> = {
  value: T | null;
  status: EvidenceStatus;
  source: 'rentcast' | 'dealSifter' | 'calculation' | null;
  retrievedAt: string | null;
  effectiveDate: string | null;
  providerPropertyId: string | null;
  confidence: number | null;
};

export type PropertyLookupInput = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  propertyId?: string | null;
  userId?: string | null;
};

export type NormalizedPropertyRecord = {
  provider: 'rentcast';
  sourceMetadata: {
    source: 'rentcast';
    retrievedAt: string;
    providerPropertyId: string;
    confidence: null;
  };
  identity: {
    providerPropertyId: Evidence<string>;
  };
  address: {
    formattedAddress: Evidence<string>;
    addressLine1: Evidence<string>;
    city: Evidence<string>;
    state: Evidence<string>;
    zipCode: Evidence<string>;
    county: Evidence<string>;
    latitude: Evidence<number>;
    longitude: Evidence<number>;
  };
  characteristics: {
    propertyType: Evidence<string>;
    bedrooms: Evidence<number>;
    bathrooms: Evidence<number>;
    livingAreaSqft: Evidence<number>;
    lotSizeSqft: Evidence<number>;
    yearBuilt: Evidence<number>;
  };
  ownership: {
    ownerNames: Evidence<string[]>;
    ownerOccupied: Evidence<boolean>;
  };
  tax: {
    assessedValue: Evidence<number>;
    assessmentYear: Evidence<number>;
    annualPropertyTax: Evidence<number>;
    propertyTaxYear: Evidence<number>;
  };
  lastSale: {
    price: Evidence<number>;
    date: Evidence<string>;
  };
};

export interface PropertyDataProvider {
  getPropertyRecord(input: PropertyLookupInput): Promise<NormalizedPropertyRecord>;
}

export type PropertyDataMode = 'mock' | 'live' | 'disabled';

export type PropertyDataErrorCode =
  | 'PROVIDER_DISABLED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'INVALID_PROPERTY_LOOKUP'
  | 'MONTHLY_PROVIDER_LIMIT_REACHED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_NETWORK_ERROR'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_SUBSCRIPTION_ERROR'
  | 'PROVIDER_RATE_LIMIT'
  | 'PROVIDER_UPSTREAM_ERROR'
  | 'PROPERTY_NOT_FOUND'
  | 'PROPERTY_EVIDENCE_CACHE_MISS'
  | 'PROPERTY_EVIDENCE_CACHE_INVALID'
  | 'ADDRESS_MISMATCH'
  | 'INVALID_PROVIDER_RESPONSE';

export class PropertyDataError extends Error {
  readonly code: PropertyDataErrorCode;
  readonly httpStatus: number | null;
  readonly billableSuccess: boolean;

  constructor(code: PropertyDataErrorCode, options: { httpStatus?: number | null; billableSuccess?: boolean } = {}) {
    super(code);
    this.name = 'PropertyDataError';
    this.code = code;
    this.httpStatus = options.httpStatus ?? null;
    this.billableSuccess = Boolean(options.billableSuccess);
  }
}

export function asPropertyDataError(value: unknown, fallback: PropertyDataErrorCode = 'PROVIDER_UPSTREAM_ERROR') {
  return value instanceof PropertyDataError ? value : new PropertyDataError(fallback);
}
