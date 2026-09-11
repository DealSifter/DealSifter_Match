import { describe, expect, it, vi } from 'vitest';
import { InMemoryPropertyIntelligenceCache } from './cache.ts';
import { PropertyEvidenceService } from './propertyEvidenceService.ts';
import { mapRentCastProperty } from './rentcast/rentcastMapper.ts';
import { PropertyDataError } from './types.ts';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-09-09T12:00:00.000Z');
const property = {
  id: PROPERTY_ID, type: 'SFR', address: '100 Fixture St', city: 'Austin', state: 'TX', zip: '78701',
  price: 200000, beds: 3, baths: 2, sqft: '1500', lot: null,
};
const external = () => mapRentCastProperty({
  id: 'provider-1', formattedAddress: '100 Fixture St, Austin, TX 78701', addressLine1: '100 Fixture St',
  city: 'Austin', state: 'TX', zipCode: '78701', propertyType: 'Single Family', bedrooms: 3,
  bathrooms: 2, squareFootage: 1500,
}, NOW.toISOString());

function setup(options: { cache?: InMemoryPropertyIntelligenceCache; providerError?: Error } = {}) {
  const provider = { getPropertyRecord: vi.fn(async () => {
    if (options.providerError) throw options.providerError;
    return external();
  }) };
  const cache = options.cache || new InMemoryPropertyIntelligenceCache({ now: () => NOW });
  const service = new PropertyEvidenceService({
    repository: { getById: vi.fn(async () => property) }, cache, provider, logger: vi.fn(),
  });
  return { service, provider, cache };
}

describe('PropertyEvidenceService', () => {
  it('on miss calls provider, persists normalized data, and keeps sources separated', async () => {
    const { service, provider, cache } = setup();
    const result = await service.getPropertyEvidence({ propertyId: PROPERTY_ID });
    expect(provider.getPropertyRecord).toHaveBeenCalledOnce();
    expect(cache.size()).toBe(1);
    expect(result.cacheHit).toBe(false);
    expect(result.internalData.listing.askingPrice).toMatchObject({ value: 200000, status: 'USER_PROVIDED', source: 'dealSifter' });
    expect(result.externalData.characteristics.bedrooms).toMatchObject({ value: 3, status: 'VERIFIED_RECORD', source: 'rentcast' });
    expect(result.internalData).not.toBe(result.externalData);
  });

  it('on hit makes zero provider calls and preserves original retrievedAt', async () => {
    const cache = new InMemoryPropertyIntelligenceCache({ now: () => NOW });
    await cache.setPropertyRecord(PROPERTY_ID, external());
    const { service, provider } = setup({ cache });
    const result = await service.getPropertyEvidence({ propertyId: PROPERTY_ID });
    expect(provider.getPropertyRecord).not.toHaveBeenCalled();
    expect(result).toMatchObject({ cacheHit: true, retrievedAt: NOW.toISOString() });
  });

  it('uses provider on an expired hit and does not cache provider failures', async () => {
    const cache = new InMemoryPropertyIntelligenceCache({ now: () => NOW });
    cache.seedRaw(PROPERTY_ID, external(), '2026-09-09T11:00:00.000Z');
    const { service, provider } = setup({ cache, providerError: new PropertyDataError('PROVIDER_TIMEOUT') });
    await expect(service.getPropertyEvidence({ propertyId: PROPERTY_ID })).rejects.toMatchObject({ code: 'PROVIDER_TIMEOUT' });
    expect(provider.getPropertyRecord).toHaveBeenCalledOnce();
    await expect(cache.getPropertyRecord(PROPERTY_ID)).resolves.toBeNull();
  });

  it('lists unavailable values and never converts absence into zero', async () => {
    const { service } = setup();
    const result = await service.getPropertyEvidence({ propertyId: PROPERTY_ID });
    expect(result.internalData.characteristics.lotSizeSqft).toMatchObject({ value: null, status: 'UNAVAILABLE' });
    expect(result.internalData.characteristics.yearBuilt).toMatchObject({ value: null, status: 'UNAVAILABLE' });
    expect(result.missingFields).toContain('tax.annualPropertyTax');
    expect(result.externalData.tax.annualPropertyTax.value).toBeNull();
  });
});
