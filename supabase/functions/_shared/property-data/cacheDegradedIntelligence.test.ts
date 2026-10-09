import { describe, it, expect, vi } from 'vitest';
import { cacheFreshness, canReadRetained } from './cacheFreshness.ts';
import { matchesCachedSubject } from './cacheIdentity.ts';
import { propertyAddressFingerprint } from './address.ts';
import { InMemoryValuationEvidenceCache } from './valuationCache.ts';
import { InMemorySoldRecordPoolCache, soldSearchQueryFingerprint, legacySoldSearchQueryFingerprint } from './soldCache.ts';
import { SoldEvidenceService } from './soldEvidenceService.ts';
import { ValuationEvidenceService } from './valuationEvidenceService.ts';
import { DEFAULT_SOLD_SEARCH_POLICY } from './soldProvider.ts';
import { DEFAULT_VALUATION_REQUEST_POLICY } from './valuationProvider.ts';
import { mapRentCastValueEstimate } from './valuationMapper.ts';
import { mapRentCastSoldRecordPool } from './soldMapper.ts';
import { createRentCastClient } from './rentcast/rentcastClient.ts';
import { providerAvailabilityFromError } from './providerAvailability.ts';
import { findRetainedRecentSalesReference } from '../maxxis/retainedReportReference.ts';

const ID = '11111111-1111-4111-8111-111111111111';
const property = { id: ID, type: 'SFR', address: '9537 Dalegrove Dr', city: 'Beverly Hills', state: 'CA', zip: '90210',
  price: 2195000, beds: 3, baths: 2, sqft: '1838', lot: null, lat: 34.11448, lng: -118.40292 };
const lookup = { street: property.address, city: property.city, state: property.state, zipCode: property.zip };
const now = new Date('2026-10-09T12:00:00Z');
const retrievedAt = '2026-09-26T12:00:00Z';
const valuation = mapRentCastValueEstimate({ lookup, requestPolicy: { ...DEFAULT_VALUATION_REQUEST_POLICY }, retrievedAt,
  raw: { price: 2236000, subjectProperty: { id: 'dalegrove', addressLine1: property.address, city: property.city, state: property.state,
    zipCode: property.zip, propertyType: 'Single Family', squareFootage: 1838, latitude: property.lat, longitude: property.lng }, comparables: [] } });

describe('retained cache degradation, zero acquisition', () => {
  it('saved old sales remain identifiable historical references, never current valuation comps', async () => {
    const estimate = { methodology: 'RECENT_SALES_MARKET_ESTIMATE', centralEstimate: 2100000,
      valuationComps: [{ address: '111 Sample St', saleDate: '2020-01-01', salePrice: 2000000 }, { address: '222 Sample St', saleDate: '2020-02-01', salePrice: 2200000 }] };
    const reports = [{ id: 'saved-report', created_at: retrievedAt, report_payload: { data: { maxxisReport: { sections: {
      propertySummary: { data: property }, valuationEvidence: { data: { recentSalesMarketEstimate: estimate } } } } } } }];
    const reference = await findRetainedRecentSalesReference(reports, property);
    expect(reference?.referenceState).toBe('STALE_CALCULATED_REFERENCE');
    expect(reference?.valuationComps.every((comp: any) => comp.classification === 'HISTORICAL_MARKET_REFERENCE')).toBe(true);
    expect(await findRetainedRecentSalesReference(reports, { ...property, address: '9538 Dalegrove Dr' })).toBeNull();
    expect(estimate.valuationComps[0]).not.toHaveProperty('classification');
  });
  it.each(['network', 'timeout'])('known %s failure prevents subsequent provider transport attempts', async kind => {
    const failure = new Error('unavailable'); if (kind === 'timeout') failure.name = 'AbortError';
    const fetchImpl = vi.fn().mockRejectedValue(failure);
    for (let index = 0; index < 3; index++) {
      const client = createRentCastClient({ apiKey: `isolated-${kind}-test`, fetchImpl });
      await expect(client.lookupProperty('9537 Dalegrove Dr')).rejects.toThrow(kind === 'timeout' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_NETWORK_ERROR');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it.each([
    [null, {}, 'ABSENT'],
    [{ retrievedAt: 'bad', expiresAt: 'bad' }, {}, 'CORRUPT'],
    [{ retrievedAt: '2026-09-01', expiresAt: '2026-09-02' }, { identityMatches: false }, 'IDENTITY_MISMATCH'],
    [{ retrievedAt: '2026-09-01', expiresAt: '2026-09-02' }, { invalidated: true }, 'EXPIRED_UNUSABLE'],
    [{ retrievedAt: '2026-09-01', expiresAt: '2026-09-02' }, {}, 'STALE_USABLE'],
    [{ retrievedAt: '2026-10-08', expiresAt: '2026-10-10' }, {}, 'FRESH'],
  ])('classifies freshness without making expiry a generic miss', (entry, options, state) => {
    expect(cacheFreshness(entry as any, { ...options, now: now.getTime() }).state).toBe(state);
  });
  it('fresh reader remains strict, retained reader does not delete historic analytical value', () => {
    const entry = { retrievedAt, expiresAt: '2026-09-29T12:00:00Z' };
    expect(canReadRetained(entry, {}, now.getTime())).toBe(false);
    expect(canReadRetained(entry, { allowStale: true }, now.getTime())).toBe(true);
  });
  it.each([
    { addressLine1: { value: '9537 Dalegrove Drive' } },
    { addressLine1: { value: '9538 Dalegrove Dr' } },
    { zipCode: { value: '90211' } },
    { latitude: { value: 35.11448 } },
  ])('accepts normalization but rejects address/ZIP/coordinate conflicts', async patch => {
    const expected = patch.addressLine1?.value === '9537 Dalegrove Drive';
    expect(await matchesCachedSubject(property, { ...valuation.subjectProperty, ...patch })).toBe(expected);
  });
  it.each([false, true])('unlocks fresh sold evidence behind an expired AVM, including the exact legacy query alias %s', async legacy => {
    const fingerprint = await propertyAddressFingerprint(lookup);
    const valuationCache = new InMemoryValuationEvidenceCache({ now: () => now });
    await valuationCache.setValuation(ID, fingerprint, valuation);
    expect(await valuationCache.getValuation(ID)).toBeNull();
    const soldCache = new InMemorySoldRecordPoolCache({ now: () => now });
    const queryFingerprint = legacy ? await legacySoldSearchQueryFingerprint(fingerprint, DEFAULT_SOLD_SEARCH_POLICY)
      : await soldSearchQueryFingerprint(fingerprint, DEFAULT_SOLD_SEARCH_POLICY, { latitude: property.lat, longitude: property.lng });
    const pool = mapRentCastSoldRecordPool({ records: [], policy: DEFAULT_SOLD_SEARCH_POLICY, queryFingerprint, retrievedAt });
    await soldCache.setSoldPool(ID, fingerprint, pool);
    const provider = { getSoldRecordPool: vi.fn() };
    const service = new SoldEvidenceService({ repository: { getById: async () => property }, valuationCache, soldCache, provider, enabled: false });
    const result = await service.getCachedSoldEvidence({ propertyId: ID });
    expect(result?.soldPool).toEqual(pool);
    expect(result?.valuationFreshness?.state).toBe('STALE_USABLE');
    expect(result?.freshness?.state).toBe('FRESH');
    expect(provider.getSoldRecordPool).not.toHaveBeenCalled();
  });
  it('finds a legitimate old subject fingerprint through independently validated canonical payload identity', async () => {
    const cache = new InMemoryValuationEvidenceCache({ now: () => now });
    await cache.setValuation(ID, 'a'.repeat(64), valuation);
    const provider = { getValuationEvidence: vi.fn() };
    const service = new ValuationEvidenceService({ repository: { getById: async () => property }, cache, provider });
    expect((await service.getCachedValuationEvidence({ propertyId: ID }))?.freshness?.state).toBe('STALE_USABLE');
    expect(provider.getValuationEvidence).not.toHaveBeenCalled();
  });
  it('recovers stale AVM after one budget rejection without retrying refresh', async () => {
    const cache = new InMemoryValuationEvidenceCache({ now: () => now });
    await cache.setValuation(ID, await propertyAddressFingerprint(lookup), valuation);
    const provider = { getValuationEvidence: vi.fn().mockRejectedValue(new Error('PROVIDER_BUDGET_EXHAUSTED')) };
    const result = await new ValuationEvidenceService({ repository: { getById: async () => property }, cache, provider }).getValuationEvidence({ propertyId: ID });
    expect(result.freshness?.state).toBe('STALE_USABLE');
    expect(provider.getValuationEvidence).toHaveBeenCalledTimes(1);
  });
  it('one known quota failure prevents repeated transport calls across clients', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    for (let index = 0; index < 3; index++) {
      const client = createRentCastClient({ apiKey: 'isolated-quota-test', fetchImpl });
      await expect(client.lookupProperty('9537 Dalegrove Dr')).rejects.toThrow('PROVIDER_RATE_LIMIT');
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(providerAvailabilityFromError(new Error('PROVIDER_BUDGET_EXHAUSTED'))).toBe('BUDGET_BLOCKED');
    expect(providerAvailabilityFromError(new Error('MONTHLY_PROVIDER_LIMIT_REACHED'))).toBe('QUOTA_EXHAUSTED');
  });
});
