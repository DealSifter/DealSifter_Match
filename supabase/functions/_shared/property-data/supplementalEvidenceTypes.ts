import type { PropertyLookupInput } from './types.ts';

export type ListingEvidenceItem = {
  listingId: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  price: number | null;
  status: string | null;
  listingType: string | null;
  listedDate: string | null;
  lastSeenDate: string | null;
  removedDate: string | null;
  daysOnMarket: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  livingAreaSqft: number | null;
  lotSizeSqft: number | null;
  yearBuilt: number | null;
};

export type ListingEvidence = {
  provider: 'rentcast';
  evidenceType: 'sale_listings' | 'rental_listings';
  schemaVersion: 1;
  retrievedAt: string;
  queryFingerprint: string;
  status: 'AVAILABLE';
  provenance: 'PROVIDER_LISTING_RECORD';
  records: ListingEvidenceItem[];
};

export type RentEstimateEvidence = {
  provider: 'rentcast';
  evidenceType: 'rent_estimate';
  schemaVersion: 1;
  retrievedAt: string;
  queryFingerprint: string;
  status: 'AVAILABLE';
  provenance: 'PROVIDER_ESTIMATE';
  rent: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  subjectProperty: ListingEvidenceItem | null;
  comparables: Array<ListingEvidenceItem & { distanceMiles: number | null; daysOld: number | null; providerCorrelation: number | null }>;
};

export type MarketSegment = {
  averagePrice: number | null;
  medianPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  averagePricePerSqft: number | null;
  medianPricePerSqft: number | null;
  averageSquareFootage: number | null;
  medianSquareFootage: number | null;
  averageDaysOnMarket: number | null;
  medianDaysOnMarket: number | null;
  newListings: number | null;
  totalListings: number | null;
  dataByPropertyType: Record<string, unknown>;
  dataByBedrooms: Record<string, unknown>;
  history: Record<string, unknown>;
};

export type MarketEvidence = {
  provider: 'rentcast';
  evidenceType: 'market_data';
  schemaVersion: 1;
  retrievedAt: string;
  queryFingerprint: string;
  status: 'AVAILABLE';
  provenance: 'PROVIDER_ZIP_AGGREGATE';
  zipCode: string;
  lastUpdatedDate: string | null;
  sale: MarketSegment | null;
  rental: MarketSegment | null;
};

export type SupplementalEvidenceFamily = 'saleListings' | 'rentEstimate' | 'rentalListings' | 'market';
export type SupplementalEvidence = ListingEvidence | RentEstimateEvidence | MarketEvidence;

export interface SupplementalEvidenceProvider {
  getSaleListings(input: PropertyLookupInput & { queryFingerprint: string; propertyType?: string | null }): Promise<ListingEvidence>;
  getRentEstimate(input: PropertyLookupInput & { queryFingerprint: string }): Promise<RentEstimateEvidence>;
  getRentalListings(input: PropertyLookupInput & { queryFingerprint: string; propertyType?: string | null }): Promise<ListingEvidence>;
  getMarketData(input: PropertyLookupInput & { queryFingerprint: string }): Promise<MarketEvidence>;
}
