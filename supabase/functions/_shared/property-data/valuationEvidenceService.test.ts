import { describe, expect, it, vi } from 'vitest';
import { propertyAddressFingerprint } from './address.ts';
import { InMemoryPropertySingleFlight } from './singleFlight.ts';
import { InMemoryValuationEvidenceCache } from './valuationCache.ts';
import { ValuationEvidenceService } from './valuationEvidenceService.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-09-12T12:00:00.000Z');
const property = { id: PROPERTY_ID, type: 'SFR', address: '100 Fixture St', city: 'Austin', state: 'TX', zip: '78701', price: 200000, beds: 3, baths: 2, sqft: '1500', lot: '6000' };
const lookup = { street: property.address, city: property.city, state: property.state, zipCode: property.zip };
const valuation = () => mapRentCastValueEstimate({
  lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: NOW.toISOString(),
  raw: {
    price: 300000, priceRangeLow: 280000, priceRangeHigh: 320000,
    subjectProperty: { id: 'subject', addressLine1: property.address, city: property.city, state: property.state, zipCode: property.zip, propertyType: 'Single Family', squareFootage: 1500 },
    comparables: [],
  },
});

function setup(cache = new InMemoryValuationEvidenceCache({ now: () => NOW })) {
  const provider = { getValuationEvidence: vi.fn(async () => valuation()) };
  const service = new ValuationEvidenceService({
    repository: { getById: vi.fn(async () => property) }, cache, provider,
    singleFlight: new InMemoryPropertySingleFlight(),
  });
  return { service, provider, cache };
}

describe('ValuationEvidenceService cache/fingerprint/single-flight', () => {
  it('uses a valid valuation cache hit with zero provider call', async () => {
    const cache = new InMemoryValuationEvidenceCache({ now: () => NOW });
    const fingerprint = await propertyAddressFingerprint(lookup);
    await cache.setValuation(PROPERTY_ID, fingerprint, valuation());
    const { service, provider } = setup(cache);
    await expect(service.getValuationEvidence({ propertyId: PROPERTY_ID })).resolves.toMatchObject({ cacheHit: true });
    expect(provider.getValuationEvidence).not.toHaveBeenCalled();
  });

  it('treats fingerprint mismatch and corrupt/incompatible payload as safe misses', async () => {
    const fingerprint = await propertyAddressFingerprint(lookup);
    const wrongFingerprint = await propertyAddressFingerprint({ ...lookup, street: '200 Other St' });
    const mismatchCache = new InMemoryValuationEvidenceCache({ now: () => NOW });
    await mismatchCache.setValuation(PROPERTY_ID, wrongFingerprint, valuation());
    const mismatch = setup(mismatchCache);
    await expect(mismatch.service.getValuationEvidence({ propertyId: PROPERTY_ID })).resolves.toMatchObject({ cacheHit: false });
    expect(mismatch.provider.getValuationEvidence).toHaveBeenCalledOnce();

    const corruptCache = new InMemoryValuationEvidenceCache({ now: () => NOW });
    corruptCache.seedRaw(PROPERTY_ID, { raw: 'provider payload' }, '2026-09-13T12:00:00.000Z', fingerprint);
    const corrupt = setup(corruptCache);
    await expect(corrupt.service.getValuationEvidence({ propertyId: PROPERTY_ID })).resolves.toMatchObject({ cacheHit: false });
    expect(corrupt.provider.getValuationEvidence).toHaveBeenCalledOnce();
  });

  it('coalesces parallel misses into one provider call and one shared cached result', async () => {
    const { service, provider } = setup();
    const [first, second] = await Promise.all([
      service.getValuationEvidence({ propertyId: PROPERTY_ID }),
      service.getValuationEvidence({ propertyId: PROPERTY_ID }),
    ]);
    expect(provider.getValuationEvidence).toHaveBeenCalledOnce();
    expect([first.cacheHit, second.cacheHit]).toEqual([false, false]);
    await expect(service.getValuationEvidence({ propertyId: PROPERTY_ID })).resolves.toMatchObject({ cacheHit: true });
  });
});
