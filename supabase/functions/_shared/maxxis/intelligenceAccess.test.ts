import { describe, expect, it } from 'vitest';
import { filterIntelligenceReportContent, resolveIntelligenceReportAccess } from './intelligenceAccess.ts';

describe('backend Intelligence Access foundation', () => {
  it.each([
    ['free', 'PROPERTY_RELEASE', true],
    ['pro', 'PROPERTY_RELEASE', true],
    ['enterprise', 'PROPERTY_RELEASE', true],
    ['free', 'MAXXIS_ANALYSIS', false],
    ['pro', 'MAXXIS_ANALYSIS', true],
    ['pro', 'DEAL_INTELLIGENCE', false],
    ['enterprise', 'DEAL_INTELLIGENCE', true],
  ])('resolves %s access to %s', (plan, reportType, allowed) => {
    expect(resolveIntelligenceReportAccess({ plan, reportType }).allowed).toBe(allowed);
  });

  it('is fail-closed and exposes catalog cost without activating execution', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'enterprise', reportType: 'UNKNOWN' })).toMatchObject({
      allowed: false, state: 'DENIED', paidUnlockEnabled: false,
    });
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: 'DEAL_INTELLIGENCE' })).toMatchObject({
      allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', nuggetCost: 5, paidUnlockEnabled: true,
    });
  });

  it('prevents intelligence leakage from lower-level report payloads', () => {
    const payload = {
      property: { id: 'p1' }, maxxisInterpretation: { summary: 'facts' }, investorContext: {},
      propertyIntelligence: { evidence: true }, valuationIntelligence: { arv: 10 }, decisionIntelligence: { risk: 'x' },
    };
    expect(filterIntelligenceReportContent('PROPERTY_RELEASE', payload)).toEqual({ property: { id: 'p1' } });
    expect(filterIntelligenceReportContent('MAXXIS_ANALYSIS', payload)).not.toHaveProperty('valuationIntelligence');
    expect(filterIntelligenceReportContent('UNKNOWN', payload)).toEqual({});
  });

  it('accepts a valid point entitlement without charging on reread', () => {
    expect(resolveIntelligenceReportAccess({
      plan: 'free', reportType: 'DEAL_INTELLIGENCE', now: Date.parse('2026-09-13'),
      entitlements: [{ reportType: 'DEAL_INTELLIGENCE', accessSource: 'NUGGET_UNLOCK', expires: '2027-01-01' }],
    })).toMatchObject({ allowed: true, state: 'ENTITLED', accessLevel: 'NUGGET_UNLOCK', nuggetCost: 0 });
  });

});
