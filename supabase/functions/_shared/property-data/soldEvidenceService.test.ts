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
    zipCode: property.zip, propertyType: 'Single Family', squareFootage: 2000 }, comparables: [] } });

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
  it('coalesces parallel cache misses into one bulk provider call and then returns a cache hit', async () => {
    const { service, provider } = await setup();
    const [first, second] = await Promise.all([service.getSoldEvidence({ propertyId: ID }), service.getSoldEvidence({ propertyId: ID })]);
    expect(provider.getSoldRecordPool).toHaveBeenCalledTimes(1);
    expect([first.cacheHit, second.cacheHit]).toEqual([false, false]);
    await expect(service.getSoldEvidence({ propertyId: ID })).resolves.toMatchObject({ cacheHit: true });
    expect(provider.getSoldRecordPool).toHaveBeenCalledTimes(1);
  });

  it('requires a valid cached AVM and never acquires AVM itself', async () => {
    const service = new SoldEvidenceService({ repository: { getById: vi.fn(async () => property) },
      valuationCache: new InMemoryValuationEvidenceCache({ now: () => NOW }),
      soldCache: new InMemorySoldRecordPoolCache({ now: () => NOW }), provider: { getSoldRecordPool: vi.fn() } });
    await expect(service.getSoldEvidence({ propertyId: ID })).rejects.toThrow('VALUATION_EVIDENCE_CACHE_REQUIRED');
  });
});
