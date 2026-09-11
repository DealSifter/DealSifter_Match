import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { propertyAddressFingerprint } from '../property-data/address.ts';
import { InMemoryPropertyIntelligenceCache } from '../property-data/cache.ts';
import { PropertyEvidenceService } from '../property-data/propertyEvidenceService.ts';
import { buildInternalPropertyEvidence } from '../property-data/propertyEvidenceService.ts';
import { mapRentCastProperty } from '../property-data/rentcast/rentcastMapper.ts';
import { getPropertyEvidenceWithDependencies, presentPropertyEvidenceForMaxxis } from './propertyEvidence.ts';
import { sanitizeToolResultForGemini } from './toolResultForGemini.ts';

const PROPERTY_ID = 'e86dd292-429d-4b51-9b02-bc60a3e9068f';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-09-11T15:02:45.944Z');
const property = {
  id: PROPERTY_ID, type: 'SFR', address: '7081 Kalanianaole Hwy', city: 'Honolulu', state: 'HI', zip: '96825',
  price: 2_100_000, beds: 5, baths: 3, sqft: 2333, lot: null,
};
const publicRecord = () => mapRentCastProperty({
  id: 'real-provider-id', formattedAddress: '7081 Kalanianaole Hwy, Honolulu, HI 96825',
  addressLine1: '7081 Kalanianaole Hwy', city: 'Honolulu', state: 'HI', zipCode: '96825',
  county: 'Honolulu', latitude: 21.283, longitude: -157.711, propertyType: 'Single Family',
  bedrooms: 4, bathrooms: 3, squareFootage: 2500, lotSize: 10000, yearBuilt: 1970,
  owner: { names: ['Private Owner Name'] }, ownerOccupied: true,
  taxAssessments: { '2025': { value: 1_500_000 } }, propertyTaxes: { '2025': { total: 6000 } },
  history: { '2020-01-02': { event: 'Sale', price: 1_200_000 } },
}, NOW.toISOString());

async function cachedService(record = publicRecord()) {
  const cache = new InMemoryPropertyIntelligenceCache({ now: () => NOW });
  await cache.setPropertyRecord(PROPERTY_ID, record);
  const provider = { getPropertyRecord: vi.fn() };
  const service = new PropertyEvidenceService({
    repository: { getById: vi.fn(async () => property) }, cache, provider, logger: vi.fn(),
  });
  return { service, provider };
}

describe('Maxxis getPropertyEvidence cache-only contract', () => {
  it('returns entitled cached evidence, preserves conflicts/unavailable fields, and never calls provider', async () => {
    const { service, provider } = await cachedService();
    const loadCachedEvidence = vi.fn((propertyId: string, userId: string) => service.getCachedPropertyEvidence({ propertyId, userId }));
    const result = await getPropertyEvidenceWithDependencies({
      propertyId: PROPERTY_ID, contextPropertyId: PROPERTY_ID, userId: USER_ID,
      hasEntitlement: vi.fn(async () => true), loadCachedEvidence,
    });
    expect(result).toMatchObject({ state: 'available', entitlementState: 'authorized', cacheState: 'hit' });
    expect(result.evidence?.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'bedrooms', dealSifterValue: 5, publicRecordValue: 4 }),
      expect.objectContaining({ field: 'livingAreaSqft', dealSifterValue: 2333, publicRecordValue: 2500 }),
    ]));
    expect(result.evidence?.internalFields.yearBuilt).toMatchObject({ value: null, status: 'UNAVAILABLE' });
    expect(provider.getPropertyRecord).not.toHaveBeenCalled();
  });

  it('stops before evidence when entitlement is missing', async () => {
    const loadCachedEvidence = vi.fn();
    const result = await getPropertyEvidenceWithDependencies({
      propertyId: PROPERTY_ID, contextPropertyId: PROPERTY_ID, userId: USER_ID,
      hasEntitlement: vi.fn(async () => false), loadCachedEvidence,
    });
    expect(result).toMatchObject({ state: 'locked', entitlementState: 'not_authorized' });
    expect(loadCachedEvidence).not.toHaveBeenCalled();
  });

  it('returns not_loaded on cache miss with zero provider and usage work', async () => {
    const provider = { getPropertyRecord: vi.fn() };
    const service = new PropertyEvidenceService({
      repository: { getById: vi.fn(async () => property) },
      cache: new InMemoryPropertyIntelligenceCache({ now: () => NOW }), provider, logger: vi.fn(),
    });
    const result = await getPropertyEvidenceWithDependencies({
      propertyId: PROPERTY_ID, contextPropertyId: PROPERTY_ID, userId: USER_ID,
      hasEntitlement: vi.fn(async () => true),
      loadCachedEvidence: (propertyId, userId) => service.getCachedPropertyEvidence({ propertyId, userId }),
    });
    expect(result).toMatchObject({ state: 'not_loaded', cacheState: 'miss' });
    expect(provider.getPropertyRecord).not.toHaveBeenCalled();
  });

  it('treats address-bound corrupt cache as unavailable without provider access', async () => {
    const wrongRecord = mapRentCastProperty({
      id: 'wrong', addressLine1: '999 Other St', city: 'Honolulu', state: 'HI', zipCode: '96825',
    }, NOW.toISOString());
    const expectedFingerprint = await propertyAddressFingerprint({
      street: property.address, city: property.city, state: property.state, zipCode: property.zip,
    });
    const cache = { getPropertyRecord: vi.fn(async () => ({ addressFingerprint: expectedFingerprint, record: wrongRecord })), setPropertyRecord: vi.fn() };
    const provider = { getPropertyRecord: vi.fn() };
    const service = new PropertyEvidenceService({ repository: { getById: vi.fn(async () => property) }, cache, provider, logger: vi.fn() });
    const result = await getPropertyEvidenceWithDependencies({
      propertyId: PROPERTY_ID, contextPropertyId: PROPERTY_ID, userId: USER_ID,
      hasEntitlement: vi.fn(async () => true),
      loadCachedEvidence: (propertyId, userId) => service.getCachedPropertyEvidence({ propertyId, userId }),
    });
    expect(result).toMatchObject({ state: 'not_loaded', cacheState: 'invalid' });
    expect(provider.getPropertyRecord).not.toHaveBeenCalled();
  });

  it('sanitizes owner identity and raw provider metadata before Gemini', async () => {
    const { service } = await cachedService();
    const evidence = await service.getCachedPropertyEvidence({ propertyId: PROPERTY_ID, userId: USER_ID });
    const safe = sanitizeToolResultForGemini({
      type: 'property_evidence', propertyId: PROPERTY_ID, state: 'available', entitlementState: 'authorized',
      cacheState: 'hit', evidence: presentPropertyEvidenceForMaxxis(evidence), rawProviderPayload: { secret: true },
    });
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain('Private Owner Name');
    expect(serialized).not.toContain('ownerNames');
    expect(serialized).not.toContain('rawProviderPayload');
    expect(serialized).not.toContain('providerPropertyId');
    expect(safe).toMatchObject({ publicEvidence: { ownershipRecordPresent: { value: true } } });
  });

  it('preserves unavailable public fields as null and never invents zero or false', async () => {
    const sparseRecord = mapRentCastProperty({
      id: 'sparse', addressLine1: property.address, city: property.city, state: property.state, zipCode: property.zip,
      propertyType: 'Single Family', bedrooms: 5, bathrooms: 3, squareFootage: 2333,
    }, NOW.toISOString());
    const { service } = await cachedService(sparseRecord);
    const evidence = await service.getCachedPropertyEvidence({ propertyId: PROPERTY_ID, userId: USER_ID });
    const safe = sanitizeToolResultForGemini({
      type: 'property_evidence', propertyId: PROPERTY_ID, state: 'available', entitlementState: 'authorized',
      cacheState: 'hit', evidence: presentPropertyEvidenceForMaxxis(evidence),
    });
    expect(safe).toMatchObject({
      publicEvidence: {
        yearBuilt: { value: null, status: 'UNAVAILABLE' },
        assessedValue: { value: null, status: 'UNAVAILABLE' },
        ownerOccupied: { value: null, status: 'UNAVAILABLE' },
      },
    });
    expect((safe as { missingFields: string[] }).missingFields).toContain('characteristics.yearBuilt');
  });

  it('registers one cache-only tool and routes evidence intents without RentCast imports', () => {
    const registry = readFileSync(new URL('./toolRegistry.ts', import.meta.url), 'utf8');
    const chat = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    const module = readFileSync(new URL('./getPropertyEvidence.ts', import.meta.url), 'utf8');
    expect((registry.match(/name: 'getPropertyEvidence'/g) || [])).toHaveLength(1);
    expect(chat).toContain("return { name: 'getPropertyEvidence', args: { propertyId: propertyContextId } };");
    expect(module).toContain('getCachedPropertyEvidence');
    expect(module).not.toMatch(/createRentCastClient|RentCastPropertyDataProvider|usageGuard/i);
  });
});
