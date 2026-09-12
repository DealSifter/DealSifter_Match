import { describe, expect, it, vi } from 'vitest';
import { InMemoryPropertyDataUsageGuard } from './usageGuard.ts';
import { PropertyDataError } from './types.ts';
import { RentCastValuationDataProvider } from './valuationProvider.ts';

const input = {
  street: '100 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
  propertyId: '11111111-1111-4111-8111-111111111111', userId: 'user-1',
};
const raw = {
  price: 300000, priceRangeLow: 280000, priceRangeHigh: 320000,
  subjectProperty: { id: 'subject', addressLine1: '100 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'Single Family', squareFootage: 1500 },
  comparables: [],
};

describe('RentCast valuation provider Usage Guard contract', () => {
  it('reserves the AVM operation, finalizes one successful 200 and returns only normalized evidence', async () => {
    const guard = new InMemoryPropertyDataUsageGuard();
    const client = { estimateValue: vi.fn(async () => ({ valuation: raw, httpStatus: 200 as const, billableSuccess: true as const })) };
    const provider = new RentCastValuationDataProvider({ client, usageGuard: guard, logger: vi.fn(), now: () => new Date('2026-09-12T12:00:00Z') });
    const result = await provider.getValuationEvidence(input);
    expect(client.estimateValue).toHaveBeenCalledWith(expect.objectContaining({
      address: '100 Fixture St, Austin, TX, 78701', maxRadius: 5, daysOld: 270, compCount: 20,
    }));
    expect(result).not.toHaveProperty('raw');
    expect(guard.snapshot()).toEqual([expect.objectContaining({
      operation: 'property_value_avm', status: 'succeeded', billableSuccess: true, httpStatus: 200,
    })]);
  });

  it('blocks before provider and finalizes non-billable provider failures', async () => {
    const now = new Date('2026-09-12T12:00:00Z');
    const rows = Array.from({ length: 45 }, (_, index) => ({
      id: `row-${index}`, provider: 'rentcast' as const, operation: 'property_lookup' as const,
      createdAt: now.toISOString(), status: 'succeeded' as const, billableSuccess: true, httpStatus: 200, errorCode: null,
    }));
    const blockedClient = { estimateValue: vi.fn() };
    const blocked = new RentCastValuationDataProvider({
      client: blockedClient, usageGuard: new InMemoryPropertyDataUsageGuard({ rows, now: () => now }), logger: vi.fn(),
    });
    await expect(blocked.getValuationEvidence(input)).rejects.toMatchObject({ code: 'MONTHLY_PROVIDER_LIMIT_REACHED' });
    expect(blockedClient.estimateValue).not.toHaveBeenCalled();

    const failureGuard = new InMemoryPropertyDataUsageGuard({ now: () => now });
    const failed = new RentCastValuationDataProvider({
      client: { estimateValue: async () => { throw new PropertyDataError('PROVIDER_TIMEOUT'); } },
      usageGuard: failureGuard, logger: vi.fn(),
    });
    await expect(failed.getValuationEvidence(input)).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
    expect(failureGuard.snapshot()[0]).toMatchObject({ operation: 'property_value_avm', status: 'failed', billableSuccess: false });
  });
});
