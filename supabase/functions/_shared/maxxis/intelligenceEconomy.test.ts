import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_ENTITLEMENT_MATRIX,
  INTELLIGENCE_ECONOMY_RUNTIME,
  MAXXIS_CAPABILITY_CATALOG,
  createIntelligenceUsageEvent,
} from './intelligenceEconomy.ts';

describe('Maxxis Intelligence Economy v2 backend contracts', () => {
  it('publishes the exact capability catalog and plan matrix', () => {
    expect(MAXXIS_CAPABILITY_CATALOG.PROPERTY_RELEASE.oneTimeUnlockNuggetCost).toBe(0);
    expect(MAXXIS_CAPABILITY_CATALOG.MAXXIS_ANALYSIS.oneTimeUnlockNuggetCost).toBe(3);
    expect(MAXXIS_CAPABILITY_CATALOG.DEAL_INTELLIGENCE.oneTimeUnlockNuggetCost).toBe(5);
    expect(CAPABILITY_ENTITLEMENT_MATRIX.FREE).toEqual({ included: ['PROPERTY_RELEASE'], optionalUnlock: ['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'] });
    expect(CAPABILITY_ENTITLEMENT_MATRIX.PRO).toEqual({ included: ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS'], optionalUnlock: ['DEAL_INTELLIGENCE'] });
    expect(CAPABILITY_ENTITLEMENT_MATRIX.ENTERPRISE.optionalUnlock).toEqual([]);
  });

  it('creates an immutable usage event contract without persistence', () => {
    const event = createIntelligenceUsageEvent({ userId: 'user-1', capability: 'DEAL_INTELLIGENCE', entitlementType: 'ONE_TIME_UNLOCK', timestamp: '2026-09-14T00:00:00.000Z' });
    expect(event).toEqual({ userId: 'user-1', capability: 'DEAL_INTELLIGENCE', source: 'NUGGET_UNLOCK', timestamp: '2026-09-14T00:00:00.000Z', entitlementType: 'ONE_TIME_UNLOCK' });
    expect(Object.isFrozen(event)).toBe(true);
  });

  it('keeps all economic execution switches off and contains no payment integration', () => {
    expect(INTELLIGENCE_ECONOMY_RUNTIME).toEqual({ oneTimeUnlockExecutionEnabled: false, nuggetDebitEnabled: false, stripeEnabled: false });
    const source = readFileSync(new URL('./intelligenceEconomy.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/STRIPE_SECRET|consume_nuggets|createPayment|charge\s*\(/i);
  });
});
