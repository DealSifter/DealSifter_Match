import { describe, expect, it, vi } from 'vitest';
import { MOCK_PROPERTY_FIXTURES } from './fixtures.ts';
import { buildInternalPropertyEvidence } from './propertyEvidenceService.ts';
import { resolvePropertyIntelligenceAccess } from './propertyIntelligenceAccess.ts';

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const evidence = {
  propertyId: PROPERTY_ID,
  internalData: buildInternalPropertyEvidence({
    id: PROPERTY_ID, type: 'SFR', address: '100 Fixture St', city: 'Austin', state: 'TX', zip: '78701',
    price: 250000, beds: 3, baths: 2, sqft: 1200, lot: null,
  }),
  externalData: MOCK_PROPERTY_FIXTURES[0].record,
  conflicts: [],
  missingFields: ['characteristics.lotSizeSqft'],
  provider: 'rentcast' as const,
  cacheHit: true,
  retrievedAt: MOCK_PROPERTY_FIXTURES[0].record.sourceMetadata.retrievedAt,
};

describe('Property Intelligence access boundary', () => {
  it('returns only locked metadata and performs zero evidence/provider work without entitlement', async () => {
    const loadEvidence = vi.fn();
    const result = await resolvePropertyIntelligenceAccess({
      userId: USER_ID, propertyId: PROPERTY_ID,
      hasEntitlement: vi.fn().mockResolvedValue(false), loadEvidence,
    });
    expect(result).toEqual({ success: true, state: 'locked', entitled: false, authRequired: false });
    expect(loadEvidence).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/fields|evidence|rentcast|publicRecordValue/i);
  });

  it('keeps unauthenticated access locked without checking entitlement or evidence', async () => {
    const hasEntitlement = vi.fn();
    const loadEvidence = vi.fn();
    await expect(resolvePropertyIntelligenceAccess({ userId: null, propertyId: PROPERTY_ID, hasEntitlement, loadEvidence }))
      .resolves.toEqual({ success: true, state: 'locked', entitled: false, authRequired: true });
    expect(hasEntitlement).not.toHaveBeenCalled();
    expect(loadEvidence).not.toHaveBeenCalled();
  });

  it('returns sanitized cached evidence only after entitlement succeeds', async () => {
    const loadEvidence = vi.fn().mockResolvedValue(evidence);
    const result = await resolvePropertyIntelligenceAccess({
      userId: USER_ID, propertyId: PROPERTY_ID,
      hasEntitlement: vi.fn().mockResolvedValue(true), loadEvidence,
    });
    expect(loadEvidence).toHaveBeenCalledWith(PROPERTY_ID, USER_ID);
    expect(result).toMatchObject({ success: true, state: 'unlocked', entitled: true, intelligence: { cacheHit: true } });
    expect(JSON.stringify(result)).not.toContain('ownerNames');
    expect(JSON.stringify(result)).not.toContain('providerPropertyId');
  });

  it('returns a friendly isolated error without provider classifications', async () => {
    const result = await resolvePropertyIntelligenceAccess({
      userId: USER_ID, propertyId: PROPERTY_ID,
      hasEntitlement: vi.fn().mockResolvedValue(true),
      loadEvidence: vi.fn().mockRejectedValue(new Error('PROVIDER_SUBSCRIPTION_ERROR')),
    });
    expect(result).toEqual({ success: false, state: 'unavailable', entitled: true, error: 'PROPERTY_INTELLIGENCE_UNAVAILABLE' });
  });
});
