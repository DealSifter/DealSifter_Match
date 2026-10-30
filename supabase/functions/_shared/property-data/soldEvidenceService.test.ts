import { describe, expect, it, vi } from 'vitest';
import { propertyAddressFingerprint } from './address.ts';
import { InMemoryPropertySingleFlight } from './singleFlight.ts';
import { InMemorySoldRecordPoolCache } from './soldCache.ts';
import { SoldEvidenceService } from './soldEvidenceService.ts';
import { mapRentCastSoldRecordPool } from './soldMapper.ts';
import { InMemoryValuationEvidenceCache } from './valuationCache.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-09-12T12:00:00.000Z');
const property = { id: ID, type: 'SFR', address: '100 Subject St', city: 'Austin', state: 'TX', zip: '78701',
  price: 1, beds: 3, baths: 2, sqft: '2000', lot: '6000' };
const lookup = { street: property.address, city: property.city, state: property.state, zipCode: property.zip };
const valuation = mapRentCastValueEstimate({ lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt: NOW.toISOString(),
  raw: { subjectProperty: { id: 'subject', addressLine1: property.address, city: property.city, state: property.state,
    zipCode: property.zip, propertyType: 'Single Family', squareFootage: 2000,
    latitude: 30.2672, longitude: -97.7431 }, comparables: [] } });

async function setup() {
  const valuationCache = new InMemoryValuationEvidenceCache({ now: () => NOW });
  await valuationCache.setValuation(ID, await propertyAddressFingerprint(lookup), valuation);
  const soldCache = new InMemorySoldRecordPoolCache({ now: () => NOW });
  const provider = { getSoldRecordPool: vi.fn(async (input) => mapRentCastSoldRecordPool({ records: [],
    policy: input.policy, queryFingerprint: input.queryFingerprint, retrievedAt: NOW.toISOString() })) };
  const service = new SoldEvidenceService({ repository: { getById: vi.fn(async () => property) }, valuationCache,
    soldCache, provider, singleFlight: new InMemoryPropertySingleFlight() });
  return { service, provider };
}

describe('SoldEvidenceService cache and single-flight', () => {
  it('retains independent queries and acquires a hypothetical exit pool without buying a land AVM', async () => {
    const land = { ...property, type: 'Land', lat: 33.65, lng: -86.68, lot: '1.14 acres' };
    const soldCache = new InMemorySoldRecordPoolCache({ now: () => NOW });
    const valuationCache = new InMemoryValuationEvidenceCache({ now: () => NOW });
    const provider = { getSoldRecordPool: vi.fn(async input => mapRentCastSoldRecordPool({ records: [], policy: input.policy,
      queryFingerprint: input.queryFingerprint, retrievedAt: NOW.toISOString() })) };
    const options = { repository: { getById: vi.fn(async () => land) }, soldCache, valuationCache, provider };
    const acquisition = new SoldEvidenceService(options);
    const exit = new SoldEvidenceService({ ...options, developmentPropertyType: 'SFR', policy: { saleDateRangeDays: 365 } });
    await acquisition.getSoldEvidence({ propertyId: ID }); await exit.getSoldEvidence({ propertyId: ID });
    expect(provider.getSoldRecordPool).toHaveBeenCalledTimes(2);
    await acquisition.getCachedSoldEvidence({ propertyId: ID }); await exit.getCachedSoldEvidence({ propertyId: ID });
    expect(provider.getSoldRecordPool).toHaveBeenCalledTimes(2);
    expect((await acquisition.getCachedSoldEvidence({ propertyId: ID }))?.soldPool.requestPolicy.propertyType).toBe('Land');
    expect((await exit.getCachedSoldEvidence({ propertyId: ID }))?.soldPool.requestPolicy.propertyType).toBe('Single Family');
  });
  it('coalesces parallel cache misses into one bulk provider call and then returns a cache hit', async () => {
    const { service, provider } = await setup();
    const [first, second] = await Promise.all([service.getSoldEvidence({ propertyId: ID }), service.getSoldEvidence({ propertyId: ID })]);
    expect(provider.getSoldRecordPool).toHaveBeenCalledTimes(1);
    expect([first.cacheHit, second.cacheHit]).toEqual([false, false]);
    await expect(service.getSoldEvidence({ propertyId: ID })).resolves.toMatchObject({ cacheHit: true });
    expect(provider.getSoldRecordPool).toHaveBeenCalledTimes(1);
    expect(provider.getSoldRecordPool).toHaveBeenCalledWith(expect.objectContaining({
      searchCenter: { latitude: 30.2672, longitude: -97.7431 },
    }));
  });

  it('searches closed sales with publisher identity without acquiring a value estimate', async () => {
    const provider = { getSoldRecordPool: vi.fn(async input => mapRentCastSoldRecordPool({ records: [],
      policy: input.policy, queryFingerprint: input.queryFingerprint, retrievedAt: NOW.toISOString() })) };
    const service = new SoldEvidenceService({ repository: { getById: vi.fn(async () => property) },
      valuationCache: new InMemoryValuationEvidenceCache({ now: () => NOW }),
      soldCache: new InMemorySoldRecordPoolCache({ now: () => NOW }), provider });
    const result = await service.getSoldEvidence({ propertyId: ID });
    expect(provider.getSoldRecordPool).toHaveBeenCalledOnce();
    expect(provider.getSoldRecordPool).toHaveBeenCalledWith(expect.objectContaining({ street: property.address, searchCenter: null }));
    expect(result.valuation.subjectProperty.addressLine1).toMatchObject({ value: property.address, status: 'USER_PROVIDED', source: 'dealSifter' });
    expect(result.valuation.providerEstimate.value.value).toBeNull();
    expect(result.valuation.subjectOrigin).toBe('PUBLISHER');
  });
});
