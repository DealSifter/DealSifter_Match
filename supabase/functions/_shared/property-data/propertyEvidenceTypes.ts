import type { Evidence, NormalizedPropertyRecord } from './types.ts';

export type InternalPropertyRecord = {
  id: string;
  type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | string | null;
  lot: number | string | null;
};

export type InternalPropertyEvidence = {
  source: 'dealSifter';
  address: {
    addressLine1: Evidence<string>;
    city: Evidence<string>;
    state: Evidence<string>;
    zipCode: Evidence<string>;
  };
  characteristics: {
    propertyType: Evidence<string>;
    bedrooms: Evidence<number>;
    bathrooms: Evidence<number>;
    livingAreaSqft: Evidence<number>;
    lotSizeSqft: Evidence<number>;
    yearBuilt: Evidence<number>;
  };
  listing: { askingPrice: Evidence<number> };
};

export type PropertyEvidenceConflict = {
  field: string;
  internalValue: string | number;
  externalValue: string | number;
  internalSource: 'dealSifter';
  externalSource: 'rentcast';
  difference: number | null;
  differencePercent: number | null;
  severity: 'INFO' | 'WARNING';
};

export type PropertyEvidenceResult = {
  propertyId: string;
  internalData: InternalPropertyEvidence;
  externalData: NormalizedPropertyRecord;
  conflicts: PropertyEvidenceConflict[];
  missingFields: string[];
  provider: 'rentcast';
  cacheHit: boolean;
  retrievedAt: string;
};

export interface PropertyEvidenceRepository {
  getById(propertyId: string, userId?: string | null): Promise<InternalPropertyRecord | null>;
}
