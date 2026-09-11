import { describe, expect, it, vi } from 'vitest';
import { InMemoryPropertyIntelligenceCache, SupabasePropertyIntelligenceCache } from './cache.ts';
import { mapRentCastProperty } from './rentcast/rentcastMapper.ts';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-09-09T12:00:00.000Z');
const record = (retrievedAt = NOW.toISOString()) => mapRentCastProperty({
  id: 'provider-record-1', formattedAddress: '100 Fixture St, Austin, TX 78701',
  addressLine1: '100 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701',
  propertyType: 'Single Family', bedrooms: 3, bathrooms: 2, squareFootage: 1500,
}, retrievedAt);

describe('property intelligence cache', () => {
  it('persists normalized data, preserves retrievedAt, and replaces the same deterministic key', async () => {
    const cache = new InMemoryPropertyIntelligenceCache({ now: () => NOW, ttlHours: 168 });
    await cache.setPropertyRecord(PROPERTY_ID, record());
    await cache.setPropertyRecord(PROPERTY_ID, record());
    await expect(cache.getPropertyRecord(PROPERTY_ID)).resolves.toMatchObject({
      propertyId: PROPERTY_ID, provider: 'rentcast', dataType: 'property_record', schemaVersion: 1,
      retrievedAt: NOW.toISOString(),
    });
    expect(cache.size()).toBe(1);
  });

  it('treats expired or corrupt entries as safe misses', async () => {
    const cache = new InMemoryPropertyIntelligenceCache({ now: () => NOW });
    cache.seedRaw(PROPERTY_ID, { rawProviderResponse: true }, '2026-09-10T00:00:00.000Z');
    await expect(cache.getPropertyRecord(PROPERTY_ID)).resolves.toBeNull();
    cache.seedRaw(PROPERTY_ID, record(), '2026-09-09T11:59:59.000Z');
    await expect(cache.getPropertyRecord(PROPERTY_ID)).resolves.toBeNull();
  });

  it('writes only the normalized model and never a key, headers, or raw response', async () => {
    const rpc = vi.fn(async () => ({ data: 'cache-id', error: null }));
    const cache = new SupabasePropertyIntelligenceCache({ rpc }, 168);
    await cache.setPropertyRecord(PROPERTY_ID, record());
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_payload).toEqual(record());
    expect(JSON.stringify(args)).not.toMatch(/X-Api-Key|RENTCAST_API_KEY|rawProviderResponse|secret/i);
    expect(Object.keys(args)).toEqual([
      'p_address_fingerprint',
      'p_property_id', 'p_provider', 'p_provider_property_id', 'p_data_type', 'p_schema_version',
      'p_payload', 'p_retrieved_at', 'p_expires_at',
    ]);
  });
});
