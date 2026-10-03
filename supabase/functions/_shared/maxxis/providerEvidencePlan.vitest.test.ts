import { describe, expect, it } from 'vitest';
import { buildProviderEvidencePlan } from './providerEvidencePlan.ts';

describe('ProviderEvidencePlan', () => {
  it('separates cached visibility from provider-call authorization for PRO Level 2', () => {
    const plan = buildProviderEvidencePlan({ propertyType: 'SFR', strategy: 'Fix and Flip', reportLevel: 'MAXXIS_ANALYSIS', plan: 'PRO' });
    expect(plan.families.PROPERTY_RECORD).toMatchObject({ cacheReadAllowed: true, providerCallAllowed: false });
    expect(plan.families.VALUATION).toMatchObject({ visibleWhenCached: true, providerCallAllowed: false });
    expect(plan.families.RECORDED_SOLD.providerCallAllowed).toBe(false);
  });

  it('authorizes only strategy-relevant Enterprise acquisition', () => {
    const hold = buildProviderEvidencePlan({ propertyType: 'SFR', strategy: 'Buy and Hold', reportLevel: 'DEAL_INTELLIGENCE', plan: 'ENTERPRISE' });
    expect(hold.families.RENT_ESTIMATE.providerCallAllowed).toBe(true);
    expect(hold.families.RENTAL_COMPS.providerCallAllowed).toBe(true);
    expect(hold.families.SALE_LISTINGS.required).toBe(false);
  });

  it('uses land evidence without residential rental families', () => {
    const land = buildProviderEvidencePlan({ propertyType: 'Land', strategy: 'Sell', reportLevel: 'DEAL_INTELLIGENCE', plan: 'ENTERPRISE' });
    expect(land.propertyCategory).toBe('LAND');
    expect(land.families.RECORDED_SOLD.required).toBe(true);
    expect(land.families.RENT_ESTIMATE.required).toBe(false);
  });

  it('allows no provider calls for FREE', () => {
    const plan = buildProviderEvidencePlan({ propertyType: 'SFR', strategy: 'Flip', reportLevel: 'DEAL_INTELLIGENCE', plan: 'FREE' });
    expect(Object.values(plan.families).every((family) => !family.providerCallAllowed)).toBe(true);
  });

  it('lets an entitled Basic release reuse cache without acquiring provider data', () => {
    const plan = buildProviderEvidencePlan({ propertyType: 'Land', strategy: 'Land', reportLevel: 'PROPERTY_RELEASE', plan: 'FREE', entitled: true });
    expect(plan.families.PROPERTY_RECORD).toMatchObject({ cacheReadAllowed: true, visibleWhenCached: true, providerCallAllowed: false });
  });
});
