import { describe, expect, it } from 'vitest';
import {
  INTELLIGENCE_ECONOMY_CONFIG,
  getIntelligencePlanCapabilities,
  resolveIntelligenceEconomyPresentation,
} from './intelligenceEconomy';

describe('Intelligence Economy plan capabilities', () => {
  it('models Free value before an explicit Nugget unlock without enabling an undefined price', () => {
    const access = resolveIntelligenceEconomyPresentation({ plan: 'free' });
    expect(access).toMatchObject({
      includedIntelligence: true, maxxisIncluded: true,
      fullPropertyIntelligence: 'nugget_unlock', requiresPropertyIntelligenceUnlock: true,
      paidUnlockEnabled: false, configuredNuggetCost: null,
    });
    expect(INTELLIGENCE_ECONOMY_CONFIG.fullPropertyIntelligenceNuggetCost).toBeNull();
  });

  it('models Pro allowance and Nugget overage without inventing a quota', () => {
    expect(getIntelligencePlanCapabilities('professional')).toMatchObject({
      fullPropertyIntelligence: 'included_allowance_then_nuggets',
      hasIncludedPropertyIntelligenceAllowance: true,
      canUseNuggetOverage: true,
    });
    expect(INTELLIGENCE_ECONOMY_CONFIG.proMonthlyPropertyIntelligenceAllowance).toBeNull();
  });

  it('models Enterprise as included and not normally credit-metered', () => {
    expect(getIntelligencePlanCapabilities('enterprise')).toMatchObject({
      fullPropertyIntelligence: 'included_fair_use',
      enterpriseIntelligenceIncluded: true,
      canUseNuggetOverage: false,
    });
    expect(INTELLIGENCE_ECONOMY_CONFIG.enterpriseFairUseThreshold).toBeNull();
  });

  it('keeps persistent access free to reread and frontend presentation non-authoritative', () => {
    const entitled = resolveIntelligenceEconomyPresentation({ plan: 'free', hasPersistentEntitlement: true });
    expect(entitled).toMatchObject({
      canReadFullPropertyIntelligence: true,
      requiresPropertyIntelligenceUnlock: false,
      repeatReadCharge: 0,
      backendAuthoritative: true,
      frontendCanGrantAccess: false,
    });
  });
});
