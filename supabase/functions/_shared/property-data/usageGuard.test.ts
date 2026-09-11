import { describe, expect, it } from 'vitest';
import { InMemoryPropertyDataUsageGuard, normalizeRentCastHardLimit, SupabasePropertyDataUsageGuard } from './usageGuard.ts';

const NOW = new Date('2026-09-09T12:00:00.000Z');
const row = (index: number, overrides: Record<string, unknown> = {}) => ({
  id: `row-${index}`,
  provider: 'rentcast' as const,
  operation: 'property_lookup' as const,
  createdAt: NOW.toISOString(),
  status: 'succeeded' as const,
  billableSuccess: true,
  httpStatus: 200,
  errorCode: null,
  ...overrides,
});

describe('RentCast usage guard', () => {
  it.each([0, 44])('allows a reservation when current count is %s', async (count) => {
    const guard = new InMemoryPropertyDataUsageGuard({ rows: Array.from({ length: count }, (_, i) => row(i)), now: () => NOW });
    await expect(guard.reserve({})).resolves.toMatchObject({ provider: 'rentcast' });
  });

  it.each([45, 46])('blocks before request when current count is %s', async (count) => {
    const guard = new InMemoryPropertyDataUsageGuard({ rows: Array.from({ length: count }, (_, i) => row(i)), now: () => NOW });
    await expect(guard.reserve({})).rejects.toMatchObject({ code: 'MONTHLY_PROVIDER_LIMIT_REACHED' });
  });

  it('does not count failed, previous-month or other-provider rows', async () => {
    const rows = [
      row(1, { status: 'failed', billableSuccess: false }),
      row(2, { createdAt: '2026-08-31T23:59:59.000Z' }),
      row(3, { provider: 'other' }),
    ];
    const guard = new InMemoryPropertyDataUsageGuard({ hardLimit: 1, rows: rows as never, now: () => NOW });
    await expect(guard.reserve({})).resolves.toBeDefined();
  });

  it('counts successful/billable completion and releases a failed completion', async () => {
    const guard = new InMemoryPropertyDataUsageGuard({ hardLimit: 2, now: () => NOW });
    const failed = await guard.reserve({});
    await guard.finalize(failed, { billableSuccess: false, httpStatus: 500, errorCode: 'PROVIDER_UPSTREAM_ERROR' });
    const success = await guard.reserve({});
    await guard.finalize(success, { billableSuccess: true, httpStatus: 200, errorCode: null });
    await expect(guard.reserve({})).resolves.toBeDefined();
    await expect(guard.reserve({})).rejects.toMatchObject({ code: 'MONTHLY_PROVIDER_LIMIT_REACHED' });
  });

  it('uses configurable limits but never permits a value above 45', () => {
    expect(normalizeRentCastHardLimit(10)).toBe(10);
    expect(normalizeRentCastHardLimit(45)).toBe(45);
    expect(normalizeRentCastHardLimit(46)).toBe(45);
    expect(normalizeRentCastHardLimit(0)).toBe(45);
  });

  it('protects concurrent reservations at the hard limit', async () => {
    const guard = new InMemoryPropertyDataUsageGuard({
      hardLimit: 45,
      rows: Array.from({ length: 44 }, (_, i) => row(i)),
      now: () => NOW,
    });
    const results = await Promise.allSettled([guard.reserve({}), guard.reserve({}), guard.reserve({})]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(2);
  });

  it('uses the atomic reservation and finalization RPC contracts', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: name.includes('reserve') ? 'reservation-id' : null, error: null };
      },
    };
    const guard = new SupabasePropertyDataUsageGuard(client, 45);
    const reservation = await guard.reserve({ propertyId: null, userId: null });
    await guard.finalize(reservation, { billableSuccess: true, httpStatus: 200, errorCode: null });
    expect(calls[0]).toMatchObject({ name: 'ds_reserve_external_provider_usage', args: { p_provider: 'rentcast', p_hard_limit: 45 } });
    expect(calls[1]).toMatchObject({ name: 'ds_finalize_external_provider_usage', args: { p_billable_success: true, p_http_status: 200 } });
  });
});
