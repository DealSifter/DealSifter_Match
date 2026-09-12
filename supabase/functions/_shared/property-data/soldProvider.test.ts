import { describe, expect, it, vi } from 'vitest';
import { RentCastSoldRecordDataProvider } from './soldProvider.ts';
import { InMemoryPropertyDataUsageGuard } from './usageGuard.ts';

describe('sold record provider', () => {
  it('uses one guarded bulk request and returns normalized records only', async () => {
    const guard = new InMemoryPropertyDataUsageGuard();
    const client = { searchSoldProperties: vi.fn(async () => ({ records: [{ id: 'sold-1', addressLine1: '110 Test St',
      city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'Single Family', squareFootage: 1500,
      lastSaleDate: '2026-06-01', lastSalePrice: 300000 }], httpStatus: 200 as const, billableSuccess: true as const })) };
    const provider = new RentCastSoldRecordDataProvider({ client, usageGuard: guard, logger: vi.fn(),
      now: () => new Date('2026-09-12T12:00:00Z') });
    const pool = await provider.getSoldRecordPool({ street: '100 Test St', city: 'Austin', state: 'TX', zipCode: '78701',
      propertyId: '11111111-1111-4111-8111-111111111111', policy: { radiusMiles: 5, saleDateRangeDays: 270,
        propertyType: 'Single Family', limit: 100 }, queryFingerprint: 'a'.repeat(64) });
    expect(client.searchSoldProperties).toHaveBeenCalledTimes(1);
    expect(pool.records[0].latestValidSale).toMatchObject({ salePrice: 300000, evidenceStatus: 'VERIFIED_RECORD' });
    expect(pool).not.toHaveProperty('raw');
    expect(guard.snapshot()[0]).toMatchObject({ operation: 'property_sold_search', status: 'succeeded', billableSuccess: true });
  });
});
