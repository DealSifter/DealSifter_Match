import { describe, expect, it, vi } from 'vitest';
import { runControlledPropertyEvidenceValidation } from './manualValidation.ts';
import { mapRentCastProperty } from './rentcast/rentcastMapper.ts';

const record = mapRentCastProperty({
  id: 'provider-sensitive-id', formattedAddress: '100 Fixture St, Austin, TX 78701',
  addressLine1: '100 Fixture St', city: 'Austin', state: 'TX', zipCode: '78701', bedrooms: 3,
}, '2026-09-09T12:00:00.000Z');
const result = (cacheHit: boolean) => ({
  propertyId: '11111111-1111-4111-8111-111111111111', internalData: {}, externalData: record,
  conflicts: [], missingFields: ['tax.annualPropertyTax'], provider: 'rentcast', cacheHit,
  retrievedAt: record.sourceMetadata.retrievedAt,
});

describe('controlled live validation harness', () => {
  it('cannot run without explicit opt-in', async () => {
    const service = { getPropertyEvidence: vi.fn() };
    await expect(runControlledPropertyEvidenceValidation({
      enabled: 'false', mode: 'live', environment: 'development', service: service as never,
      propertyId: '11111111-1111-4111-8111-111111111111',
    })).rejects.toThrow('LIVE_PROPERTY_VALIDATION_NOT_ENABLED');
    expect(service.getPropertyEvidence).not.toHaveBeenCalled();
  });

  it('performs one miss plus one cache verification and returns only sanitized metadata', async () => {
    const service = { getPropertyEvidence: vi.fn().mockResolvedValueOnce(result(false)).mockResolvedValueOnce(result(true)) };
    const output = await runControlledPropertyEvidenceValidation({
      enabled: 'true', mode: 'live', environment: 'staging', service: service as never,
      propertyId: '11111111-1111-4111-8111-111111111111',
    });
    expect(output).toMatchObject({ liveRequests: 1, cacheHits: 1, secondCacheHit: true, cachePersisted: true });
    expect(output.providerPropertyId).toBe('prov***e-id');
    expect(JSON.stringify(output)).not.toContain('100 Fixture St');
    expect(JSON.stringify(output)).not.toContain('ownerNames');
  });
});
