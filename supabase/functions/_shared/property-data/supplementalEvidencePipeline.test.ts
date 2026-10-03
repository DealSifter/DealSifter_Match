import { describe, expect, it, vi } from 'vitest';
import { InMemorySupplementalEvidenceCache } from './supplementalEvidenceCache.ts';
import { RentCastSupplementalEvidenceProvider } from './supplementalEvidenceProvider.ts';
import { SupplementalEvidenceService } from './supplementalEvidenceService.ts';
import { InMemoryPropertyDataUsageGuard } from './usageGuard.ts';

const propertyId = '11111111-1111-4111-8111-111111111111';
const property = { id: propertyId, type: 'Single Family', address: '100 Main St', city: 'Austin', state: 'TX',
  zip: '78701', price: 500000, beds: 3, baths: 2, sqft: 2000, lot: 6000 };
const listing = { id: 'listing-1', formattedAddress: '101 Main St, Austin, TX 78701', city: 'Austin', state: 'TX',
  zipCode: '78701', propertyType: 'Single Family', price: 510000, status: 'Active', listedDate: '2026-09-01',
  lastSeenDate: '2026-10-01', daysOnMarket: 30, bedrooms: 3, bathrooms: 2, squareFootage: 1980, lotSize: 6100,
  yearBuilt: 2001, listingAgent: { name: 'must-not-leak' } };

function setup() {
  const client = {
    searchSaleListings: vi.fn(async () => ({ records: [listing], httpStatus: 200 as const, billableSuccess: true as const })),
    estimateRent: vi.fn(async () => ({ data: { rent: 2800, rentRangeLow: 2600, rentRangeHigh: 3000,
      subjectProperty: listing, comparables: [{ ...listing, price: 2700, distance: 0.3, daysOld: 10, correlation: 0.92 }] },
      httpStatus: 200 as const, billableSuccess: true as const })),
    searchRentalListings: vi.fn(async () => ({ records: [{ ...listing, price: 2750, listingType: 'Rental' }],
      httpStatus: 200 as const, billableSuccess: true as const })),
    getMarketData: vi.fn(async () => ({ data: { zipCode: '78701', lastUpdatedDate: '2026-10-01',
      saleData: { medianPrice: 500000, medianPricePerSquareFoot: 250, medianDaysOnMarket: 25, totalListings: 100,
        history: { '2026-09': { medianPrice: 490000 } } },
      rentalData: { medianRent: 2700, medianRentPerSquareFoot: 1.4, totalListings: 45 } },
      httpStatus: 200 as const, billableSuccess: true as const })),
  };
  const provider = new RentCastSupplementalEvidenceProvider({ client, usageGuard: new InMemoryPropertyDataUsageGuard(),
    now: () => new Date('2026-10-03T00:00:00.000Z') });
  const service = new SupplementalEvidenceService({ repository: { getById: async () => property },
    cache: new InMemorySupplementalEvidenceCache(() => new Date('2026-10-03T01:00:00.000Z')), provider });
  return { client, service };
}

describe('supplemental provider evidence pipelines', () => {
  it.each([
    ['saleListings', 'searchSaleListings', 'sale_listings'],
    ['rentEstimate', 'estimateRent', 'rent_estimate'],
    ['rentalListings', 'searchRentalListings', 'rental_listings'],
    ['market', 'getMarketData', 'market_data'],
  ] as const)('runs %s client → normalizer → family cache → evidence', async (family, method, evidenceType) => {
    const { client, service } = setup();
    const first = await service.get({ propertyId, userId: 'user-1' }, family);
    const second = await service.get({ propertyId, userId: 'user-1' }, family);
    expect(first?.cacheHit).toBe(false);
    expect(second?.cacheHit).toBe(true);
    expect(first?.evidence.evidenceType).toBe(evidenceType);
    expect(client[method]).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(first)).not.toContain('must-not-leak');
  });

  it('normalizes provider fields into decision-safe sale, rent, rental and ZIP market evidence', async () => {
    const { service } = setup();
    const bundle = await service.getBundle({ propertyId, userId: 'user-1',
      families: ['saleListings', 'rentEstimate', 'rentalListings', 'market'] });
    expect((bundle.saleListings as any).records[0]).toMatchObject({ listingId: 'listing-1', price: 510000, daysOnMarket: 30 });
    expect(bundle.rentEstimate).toMatchObject({ rent: 2800, rangeLow: 2600, rangeHigh: 3000 });
    expect((bundle.rentalListings as any).records[0]).toMatchObject({ price: 2750, listingType: 'Rental' });
    expect(bundle.market).toMatchObject({ zipCode: '78701', sale: { medianPrice: 500000, medianPricePerSqft: 250 },
      rental: { medianPrice: 2700 } });
  });
});
