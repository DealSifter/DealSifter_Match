import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_ENTITLEMENT_MATRIX,
  INTELLIGENCE_ECONOMY_CONFIG,
  INTELLIGENCE_ECONOMY_RUNTIME,
  MAXXIS_CAPABILITY_CATALOG,
  createIntelligenceUsageEvent,
  getIntelligencePlanCapabilities,
  resolveIntelligenceEconomyPresentation,
} from './intelligenceEconomy';

describe('Intelligence Economy plan capabilities', () => {
  it('defines the three capabilities, plan matrix and one-time costs without execution', () => {
    expect(MAXXIS_CAPABILITY_CATALOG.MAXXIS_ANALYSIS.oneTimeUnlockNuggetCost).toBe(3);
    expect(MAXXIS_CAPABILITY_CATALOG.DEAL_INTELLIGENCE.oneTimeUnlockNuggetCost).toBe(5);
    expect(CAPABILITY_ENTITLEMENT_MATRIX.FREE.optionalUnlock).toEqual(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']);
    expect(CAPABILITY_ENTITLEMENT_MATRIX.PRO.optionalUnlock).toEqual(['DEAL_INTELLIGENCE']);
    expect(CAPABILITY_ENTITLEMENT_MATRIX.ENTERPRISE.optionalUnlock).toEqual([]);
    expect(INTELLIGENCE_ECONOMY_RUNTIME).toEqual({ oneTimeUnlockExecutionEnabled: false, nuggetDebitEnabled: false, stripeEnabled: false });
  });

  it('models usage events without persisting, charging or granting access', () => {
    expect(createIntelligenceUsageEvent({ userId: 'u1', capability: 'MAXXIS_ANALYSIS', entitlementType: 'ONE_TIME_UNLOCK', timestamp: '2026-09-14T00:00:00.000Z' })).toEqual({
      userId: 'u1', capability: 'MAXXIS_ANALYSIS', source: 'NUGGET_UNLOCK', timestamp: '2026-09-14T00:00:00.000Z', entitlementType: 'ONE_TIME_UNLOCK',
    });
    expect(createIntelligenceUsageEvent({ userId: 'u1', capability: 'UNKNOWN', entitlementType: 'ONE_TIME_UNLOCK' })).toBeNull();
  });
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
