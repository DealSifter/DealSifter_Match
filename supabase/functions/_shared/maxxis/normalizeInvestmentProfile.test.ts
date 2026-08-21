import { describe, expect, it } from 'vitest';
import { extractInvestmentProfile, normalizeInvestmentProfile } from './normalizeInvestmentProfile.ts';

describe('normalizeInvestmentProfile', () => {
  it('reads the current professional payload and returns only investment fields', () => {
    const payload = {
      profiles: { professional: { investmentProfile: {
        version: 1,
        status: 'complete',
        profileStrength: 73,
        targetMarkets: [' Alabama ', 'Alabama'],
        propertyTypes: ['Single Family'],
        strategies: ['Fix & Flip'],
        priceRange: '100_200k',
        email: 'private@example.com',
      } } },
    };
    const result = normalizeInvestmentProfile(extractInvestmentProfile(payload));
    expect(result.exists).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.profile?.targetMarkets).toEqual(['Alabama']);
    expect(result.profile).not.toHaveProperty('email');
  });

  it('supports the legacy professional profile path', () => {
    const payload = { legacy: { professionalProfile: { investmentProfile: { investorRoles: ['Cash Buyer'] } } } };
    expect(normalizeInvestmentProfile(extractInvestmentProfile(payload)).profile?.investorRoles).toEqual(['Cash Buyer']);
  });

  it('treats a defaults-only draft as an absent profile', () => {
    const result = normalizeInvestmentProfile({
      version: 1,
      status: 'draft',
      profileStrength: 0,
      dealsClosedLifetime: '0',
      dealsClosedLast12mo: '0',
      avgDealSize: 'lt_250k',
      yearsInvesting: '1_3',
      currentlyActiveDeals: 0,
    });
    expect(result).toEqual({ profile: null, complete: false, exists: false });
  });

  it('preserves a partial profile without marking it complete', () => {
    const result = normalizeInvestmentProfile({ status: 'draft', targetMarkets: ['TX'], capitalReady: 'no' });
    expect(result.exists).toBe(true);
    expect(result.complete).toBe(false);
    expect(result.profile).toMatchObject({ status: 'draft', targetMarkets: ['TX'], capitalReady: 'no' });
  });
});
