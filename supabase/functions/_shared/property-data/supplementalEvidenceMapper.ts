import type { ListingEvidence, ListingEvidenceItem, MarketEvidence, MarketSegment, RentEstimateEvidence } from './supplementalEvidenceTypes.ts';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : {};
const objectCopy = (value: unknown) => ({ ...object(value) });

export function mapListingItem(rawValue: unknown): ListingEvidenceItem {
  const raw = object(rawValue);
  return {
    listingId: text(raw.id), address: text(raw.formattedAddress) || text(raw.addressLine1), city: text(raw.city),
    state: text(raw.state), zipCode: text(raw.zipCode), latitude: number(raw.latitude), longitude: number(raw.longitude),
    propertyType: text(raw.propertyType), price: number(raw.price), status: text(raw.status), listingType: text(raw.listingType),
    listedDate: text(raw.listedDate), lastSeenDate: text(raw.lastSeenDate), removedDate: text(raw.removedDate),
    daysOnMarket: number(raw.daysOnMarket), bedrooms: number(raw.bedrooms), bathrooms: number(raw.bathrooms),
    livingAreaSqft: number(raw.squareFootage), lotSizeSqft: number(raw.lotSize), yearBuilt: number(raw.yearBuilt),
  };
}

export function mapListings(records: unknown[], evidenceType: ListingEvidence['evidenceType'], queryFingerprint: string, retrievedAt: string): ListingEvidence {
  return { provider: 'rentcast', evidenceType, schemaVersion: 1, retrievedAt, queryFingerprint,
    status: 'AVAILABLE', provenance: 'PROVIDER_LISTING_RECORD', records: records.map(mapListingItem) };
}

export function mapRentEstimate(rawValue: unknown, queryFingerprint: string, retrievedAt: string): RentEstimateEvidence {
  const raw = object(rawValue);
  const comparables = Array.isArray(raw.comparables) ? raw.comparables.map((value) => {
    const item = object(value);
    return { ...mapListingItem(item), distanceMiles: number(item.distance), daysOld: number(item.daysOld),
      providerCorrelation: number(item.correlation) };
  }) : [];
  return { provider: 'rentcast', evidenceType: 'rent_estimate', schemaVersion: 1, retrievedAt, queryFingerprint,
    status: 'AVAILABLE', provenance: 'PROVIDER_ESTIMATE', rent: number(raw.rent) ?? number(raw.price),
    rangeLow: number(raw.rentRangeLow) ?? number(raw.priceRangeLow), rangeHigh: number(raw.rentRangeHigh) ?? number(raw.priceRangeHigh),
    subjectProperty: raw.subjectProperty ? mapListingItem(raw.subjectProperty) : null, comparables };
}

function segment(value: unknown, rental = false): MarketSegment | null {
  const raw = object(value);
  if (!Object.keys(raw).length) return null;
  return {
    averagePrice: number(rental ? raw.averageRent : raw.averagePrice) ?? number(raw.averagePrice),
    medianPrice: number(rental ? raw.medianRent : raw.medianPrice) ?? number(raw.medianPrice),
    minPrice: number(rental ? raw.minRent : raw.minPrice) ?? number(raw.minPrice),
    maxPrice: number(rental ? raw.maxRent : raw.maxPrice) ?? number(raw.maxPrice),
    averagePricePerSqft: number(rental ? raw.averageRentPerSquareFoot : raw.averagePricePerSquareFoot)
      ?? number(raw.averagePricePerSqft),
    medianPricePerSqft: number(rental ? raw.medianRentPerSquareFoot : raw.medianPricePerSquareFoot)
      ?? number(raw.medianPricePerSqft),
    averageSquareFootage: number(raw.averageSquareFootage), medianSquareFootage: number(raw.medianSquareFootage),
    averageDaysOnMarket: number(raw.averageDaysOnMarket), medianDaysOnMarket: number(raw.medianDaysOnMarket),
    newListings: number(raw.newListings), totalListings: number(raw.totalListings),
    dataByPropertyType: objectCopy(raw.dataByPropertyType), dataByBedrooms: objectCopy(raw.dataByBedrooms), history: objectCopy(raw.history),
  };
}

export function mapMarketData(rawValue: unknown, zipCode: string, queryFingerprint: string, retrievedAt: string): MarketEvidence {
  const raw = object(rawValue);
  return { provider: 'rentcast', evidenceType: 'market_data', schemaVersion: 1, retrievedAt, queryFingerprint,
    status: 'AVAILABLE', provenance: 'PROVIDER_ZIP_AGGREGATE', zipCode,
    lastUpdatedDate: text(raw.lastUpdatedDate), sale: segment(raw.saleData), rental: segment(raw.rentalData, true) };
}
