import { describe, expect, it } from 'vitest';
import {
  INTELLIGENCE_REPORT_CONFIG,
  INTELLIGENCE_REPORT_TYPES,
  REPORT_ACCESS_SOURCES,
  createReportEntitlement,
  filterReportContent,
  inferRequestedIntelligenceReportType,
  resolveExportPopupFlow,
  resolveIntelligenceReportAccess,
} from './intelligenceAccess';

describe('Intelligence access and report architecture', () => {
  it('allows Property Release for Free, Pro, and Enterprise', () => {
    for (const plan of ['free', 'pro', 'enterprise']) {
      expect(resolveIntelligenceReportAccess({ plan, reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE })).toMatchObject({
        allowed: true, state: 'INCLUDED', accessSource: 'SUBSCRIPTION',
      });
    }
  });

  it('models the 3-Nugget Free unlock without activating execution', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS })).toMatchObject({
      allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', requiredAccessMethod: 'NUGGET_UNLOCK',
      nuggetCost: 3, paidUnlockEnabled: true,
    });
    expect(INTELLIGENCE_REPORT_CONFIG.paidUnlockEnabled).toBe(true);
  });

  it('includes Maxxis Analysis for Pro but gates Deal Intelligence', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'pro', reportType: INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS }).allowed).toBe(true);
    expect(resolveIntelligenceReportAccess({ plan: 'pro', reportType: INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE })).toMatchObject({
      allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', nuggetCost: 5,
    });
  });

  it('includes Deal Intelligence for Enterprise and admin', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'enterprise', reportType: INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE }).allowed).toBe(true);
    expect(resolveIntelligenceReportAccess({ plan: 'admin', reportType: INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE }).allowed).toBe(true);
  });

  it('honors an active point unlock and rejects expired or malformed grants', () => {
    const active = createReportEntitlement({
      reportType: 'DEAL_INTELLIGENCE', accessSource: REPORT_ACCESS_SOURCES.NUGGET_UNLOCK, expires: '2030-01-01T00:00:00.000Z',
    });
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: 'DEAL_INTELLIGENCE', entitlements: [active], now: Date.parse('2029-01-01') })).toMatchObject({
      allowed: true, state: 'ENTITLED', accessLevel: 'NUGGET_UNLOCK', nuggetCost: 0,
    });
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: 'DEAL_INTELLIGENCE', entitlements: [active], now: Date.parse('2031-01-01') }).allowed).toBe(false);
    expect(createReportEntitlement({ reportType: 'UNKNOWN', accessSource: 'NUGGET_UNLOCK' })).toBeNull();
  });

  it('uses plan-specific popup behavior', () => {
    expect(resolveExportPopupFlow({ plan: 'free' })).toMatchObject({ requiresLevelChoice: true, directReportType: null });
    expect(resolveExportPopupFlow({ plan: 'pro' })).toMatchObject({ requiresLevelChoice: false, directReportType: 'MAXXIS_ANALYSIS' });
    expect(resolveExportPopupFlow({ plan: 'enterprise' })).toMatchObject({ requiresLevelChoice: false, directReportType: 'DEAL_INTELLIGENCE' });
  });

  it('fails closed and strips content above the selected report level', () => {
    const payload = {
      property: { id: 'p1' }, maxxisInterpretation: { summary: 'Stored facts only' }, investorContext: {},
      propertyIntelligence: { evidence: ['record'] }, valuationIntelligence: { arv: 1 }, decisionIntelligence: { risk: 'x' },
    };
    expect(filterReportContent('PROPERTY_RELEASE', payload)).toEqual({ property: { id: 'p1' } });
    expect(filterReportContent('MAXXIS_ANALYSIS', payload)).toEqual({
      property: { id: 'p1' }, maxxisInterpretation: { summary: 'Stored facts only' }, investorContext: {},
    });
    expect(filterReportContent('UNKNOWN', payload)).toEqual({});
    expect(resolveIntelligenceReportAccess({ plan: 'enterprise', reportType: 'UNKNOWN' }).allowed).toBe(false);
  });

  it('detects only explicit property analysis intents and preserves general chat', () => {
    expect(inferRequestedIntelligenceReportType('Analyze this property deeply', { hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
    expect(inferRequestedIntelligenceReportType('Analyze this property', { hasPropertyContext: true })).toBe('MAXXIS_ANALYSIS');
    expect(inferRequestedIntelligenceReportType('How does the dashboard work?', { hasPropertyContext: true })).toBeNull();
    expect(inferRequestedIntelligenceReportType('Analyze this property deeply', { hasPropertyContext: false })).toBeNull();
    expect(inferRequestedIntelligenceReportType('Analyze this deal', { hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
    expect(inferRequestedIntelligenceReportType('Is this property worth looking at?', { hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
    expect(inferRequestedIntelligenceReportType('What are the risks?', { hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
    expect(inferRequestedIntelligenceReportType('Explain this ARV', { hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
    expect(inferRequestedIntelligenceReportType('Calculate ARV', { hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
  });
});
