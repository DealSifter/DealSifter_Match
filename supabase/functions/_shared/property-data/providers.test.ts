import { describe, expect, it, vi } from 'vitest';
import { formatPropertyLookupAddress, normalizeState, normalizeStreet, normalizeZipCode, rentCastAddressMatches } from './address.ts';
import {
  createPropertyDataProvider,
  DisabledPropertyDataProvider,
  MockPropertyDataProvider,
  normalizePropertyDataMode,
  readPropertyDataConfig,
  RentCastPropertyDataProvider,
} from './providers.ts';
import { PropertyDataError, type PropertyLookupInput } from './types.ts';
import { InMemoryPropertyDataUsageGuard } from './usageGuard.ts';

const INPUT: PropertyLookupInput = {
  street: '5500 Grand Lake Drive', city: 'San Antonio', state: 'Texas', zipCode: '78244-1234',
};
const RAW = {
  id: 'rentcast-property-id', formattedAddress: '5500 Grand Lake Dr, San Antonio, TX 78244',
  addressLine1: '5500 Grand Lake Dr', city: 'San Antonio', state: 'TX', zipCode: '78244', bedrooms: 3,
};

const silentLogger = vi.fn();

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code });
}

describe('address normalization and validation', () => {
  it('normalizes whitespace, punctuation, state, ZIP and common street suffixes without an LLM', () => {
    expect(normalizeStreet(' 5500 Grand Lake Drive. ')).toBe('5500 GRAND LAKE DR');
    expect(normalizeState('Texas')).toBe('TX');
    expect(normalizeZipCode('78244-1234')).toBe('78244');
    expect(formatPropertyLookupAddress(INPUT)).toBe('5500 Grand Lake Drive, San Antonio, TX, 78244');
    expect(rentCastAddressMatches(INPUT, RAW)).toBe(true);
  });

  it('fails safely on invalid input and relevant address mismatch', async () => {
    const provider = new MockPropertyDataProvider();
    await expectCode(provider.getPropertyRecord({ ...INPUT, zipCode: '' }), 'INVALID_PROPERTY_LOOKUP');
    expect(rentCastAddressMatches(INPUT, { ...RAW, zipCode: '99999' })).toBe(false);
    expect(rentCastAddressMatches(INPUT, { ...RAW, state: 'CA' })).toBe(false);
    expect(rentCastAddressMatches(INPUT, { ...RAW, addressLine1: '1 Other St' })).toBe(false);
  });
});

describe('RentCast property provider', () => {
  it('reserves usage, returns only a NormalizedPropertyRecord and records a billable HTTP 200', async () => {
    const guard = new InMemoryPropertyDataUsageGuard();
    const client = { lookupProperty: vi.fn(async () => ({ record: RAW, httpStatus: 200 as const, billableSuccess: true as const })) };
    const provider = new RentCastPropertyDataProvider({ client, usageGuard: guard, logger: silentLogger, now: () => new Date('2026-09-09T12:00:00Z') });
    const result = await provider.getPropertyRecord(INPUT);
    expect(client.lookupProperty).toHaveBeenCalledWith('5500 Grand Lake Drive, San Antonio, TX, 78244');
    expect(result.provider).toBe('rentcast');
    expect(result.identity.providerPropertyId.value).toBe('rentcast-property-id');
    expect(result).not.toHaveProperty('history');
    expect(result).not.toHaveProperty('owner');
    expect(guard.snapshot()).toEqual([expect.objectContaining({ status: 'succeeded', billableSuccess: true, httpStatus: 200 })]);
  });

  it('counts an empty HTTP 200 as billable and returns PROPERTY_NOT_FOUND', async () => {
    const guard = new InMemoryPropertyDataUsageGuard();
    const provider = new RentCastPropertyDataProvider({
      client: { lookupProperty: async () => ({ record: null, httpStatus: 200, billableSuccess: true }) },
      usageGuard: guard,
      logger: silentLogger,
    });
    await expectCode(provider.getPropertyRecord(INPUT), 'PROPERTY_NOT_FOUND');
    expect(guard.snapshot()[0]).toMatchObject({ status: 'succeeded', billableSuccess: true });
  });

  it('rejects an address mismatch after recording the billable response', async () => {
    const guard = new InMemoryPropertyDataUsageGuard();
    const provider = new RentCastPropertyDataProvider({
      client: { lookupProperty: async () => ({ record: { ...RAW, zipCode: '99999' }, httpStatus: 200, billableSuccess: true }) },
      usageGuard: guard,
      logger: silentLogger,
    });
    await expectCode(provider.getPropertyRecord(INPUT), 'ADDRESS_MISMATCH');
    expect(guard.snapshot()[0]).toMatchObject({ status: 'succeeded', billableSuccess: true });
  });

  it.each([
    'PROVIDER_UPSTREAM_ERROR', 'PROVIDER_NETWORK_ERROR', 'PROVIDER_TIMEOUT', 'INVALID_PROVIDER_RESPONSE',
  ])('propagates sanitized %s and releases non-billable reservations', async (code) => {
    const guard = new InMemoryPropertyDataUsageGuard();
    const provider = new RentCastPropertyDataProvider({
      client: { lookupProperty: async () => { throw new PropertyDataError(code as never); } },
      usageGuard: guard,
      logger: silentLogger,
    });
    await expectCode(provider.getPropertyRecord(INPUT), code);
    expect(guard.snapshot()[0]).toMatchObject({ status: 'failed', billableSuccess: false, errorCode: code });
  });

  it('blocks before client invocation when monthly quota is reached', async () => {
    const now = new Date('2026-09-09T12:00:00Z');
    const rows = Array.from({ length: 45 }, (_, index) => ({
      id: `row-${index}`, provider: 'rentcast' as const, operation: 'property_lookup' as const,
      createdAt: now.toISOString(), status: 'succeeded' as const, billableSuccess: true,
      httpStatus: 200, errorCode: null,
    }));
    const guard = new InMemoryPropertyDataUsageGuard({ rows, now: () => now });
    const client = { lookupProperty: vi.fn() };
    const provider = new RentCastPropertyDataProvider({ client, usageGuard: guard, logger: silentLogger });
    await expectCode(provider.getPropertyRecord(INPUT), 'MONTHLY_PROVIDER_LIMIT_REACHED');
    expect(client.lookupProperty).not.toHaveBeenCalled();
  });

  it('fails safely and leaves the reservation conservative when usage finalization fails', async () => {
    const guard = {
      reserve: async () => ({ id: 'reservation', provider: 'rentcast' as const, operation: 'property_lookup' as const, createdAt: new Date().toISOString() }),
      finalize: vi.fn(async () => { throw new Error('database details'); }),
    };
    const provider = new RentCastPropertyDataProvider({
      client: { lookupProperty: async () => ({ record: RAW, httpStatus: 200, billableSuccess: true }) },
      usageGuard: guard,
      logger: silentLogger,
    });
    await expectCode(provider.getPropertyRecord(INPUT), 'PROVIDER_UPSTREAM_ERROR');
    expect(guard.finalize).toHaveBeenCalledTimes(1);
  });
});

describe('provider modes and configuration', () => {
  it('disabled mode never calls network', async () => {
    const provider = new DisabledPropertyDataProvider();
    await expectCode(provider.getPropertyRecord(INPUT), 'PROVIDER_DISABLED');
  });

  it('mock mode is explicit, deterministic and never calls network', async () => {
    const fetchImpl = vi.fn();
    const provider = createPropertyDataProvider({ mode: 'mock', apiKey: 'unused', fetchImpl });
    const result = await provider.getPropertyRecord({ street: '100 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701' });
    expect(result.identity.providerPropertyId.value).toBe('mock-100-fixture-st');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('live mode never silently falls back to mock when key or usage guard is absent', async () => {
    const provider = createPropertyDataProvider({ mode: 'live' });
    await expectCode(provider.getPropertyRecord(INPUT), 'PROVIDER_NOT_CONFIGURED');
  });

  it('uses secure defaults and clamps the monthly hard limit to 45', () => {
    expect(normalizePropertyDataMode('unexpected')).toBe('disabled');
    const config = readPropertyDataConfig((name) => ({
      PROPERTY_DATA_MODE: 'live', RENTCAST_API_KEY: 'backend-key', RENTCAST_TIMEOUT_MS: '9000', RENTCAST_MONTHLY_HARD_LIMIT: '999',
    }[name]));
    expect(config).toEqual({ mode: 'live', apiKey: 'backend-key', timeoutMs: 9000, monthlyHardLimit: 45 });
  });
});
