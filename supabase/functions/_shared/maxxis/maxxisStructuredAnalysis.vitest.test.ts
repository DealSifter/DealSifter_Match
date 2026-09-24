import { describe, expect, it } from 'vitest';
import { buildEvidenceCompleteness } from './evidenceCompleteness.ts';
import { buildMaxxisStructuredAnalysis, explainMaxxisInternalState } from './maxxisStructuredAnalysis.ts';

const snapshot = {
  propertyFacts: { type: 'SFR', city: 'Beverly Hills', state: 'CA', beds: 3, baths: 2, sqft: 1838 },
  dealIntelligence: {
    propertyContext: { fields: {} },
    investorContext: { strategies: ['Buy and Hold'], targetMarkets: ['Los Angeles, CA'] },
    matchContext: { score: 62, reasons: [
      { key: 'property_type', status: 'matched', detail: 'The SFR type matches the configured profile.' },
      { key: 'market', status: 'not_matched', detail: 'The location is outside the configured target markets.' },
    ] },
    dealMetrics: { metrics: {
      pricePerSqft: { calculable: true, value: 1194.23 },
      capRate: { calculable: true, value: 6 },
      acquisitionPlusRehab: { calculable: false, value: null },
    } },
    valuationContext: { status: 'ARV_UNAVAILABLE', confidence: 'LOW', compsUsed: 0,
      warnings: ['INSUFFICIENT_COMPS'], providerEstimate: { value: 2236000 } },
    comparableEvidence: [],
    risks: [{ category: 'MARKET_RISK', explanation: 'The location is outside the configured target markets.' }],
    opportunities: [{ explanation: 'The property type matches the configured profile.' }],
    limitations: ['MISSING_REHAB', 'roi_not_calculated', 'arv_not_structured'],
    recommendedActions: ['Confirm property condition.'],
  },
};

describe('MaxxisStructuredAnalysis', () => {
  it('creates substantive profile-aware PRO analysis without raw internal codes', () => {
    const analysis = buildMaxxisStructuredAnalysis(snapshot, 'MAXXIS_ANALYSIS');
    expect(analysis).toMatchObject({ type: 'maxxis_structured_analysis', reportType: 'MAXXIS_ANALYSIS' });
    expect(analysis.investorFit.fitRationale).toContain('outside the configured target markets');
    expect(analysis.valuationAnalysis.currentPositioning).toContain('$1,194.23');
    expect(analysis.strategySpecificInsights[0]).toContain('Buy and Hold');
    expect(JSON.stringify(analysis)).not.toMatch(/MISSING_REHAB|roi_not_calculated|arv_not_structured/);
  });

  it('keeps provider AVM separate from DealSifter ARV and invents neither comps nor ARV', () => {
    const analysis = buildMaxxisStructuredAnalysis(snapshot, 'DEAL_INTELLIGENCE');
    expect(analysis.comparativeAnalysis.selectedCompSummary).toEqual([]);
    expect(analysis.valuationAnalysis.arvInterpretation).toContain('DealSifter ARV is unavailable');
    expect(analysis.valuationAnalysis.scenarioInterpretation).toContain('provider AVM');
    expect(analysis.valuationAnalysis.scenarioInterpretation).toContain('is not the DealSifter ARV');
  });

  it('centralizes natural-language explanations for internal states', () => {
    expect(explainMaxxisInternalState('MISSING_REHAB')).toBe('Rehabilitation scope and cost have not yet been confirmed.');
    expect(explainMaxxisInternalState('roi_not_calculated')).toContain('ROI cannot yet be calculated');
  });
});

describe('EvidenceCompleteness', () => {
  it('requires only property/app/profile evidence for PRO', () => {
    expect(buildEvidenceCompleteness({ reportType: 'MAXXIS_ANALYSIS', evidenceState: 'available', context: snapshot.dealIntelligence,
      trace: { propertyEvidence: 'HIT' } })).toMatchObject({
      complete: true, property: { status: 'AVAILABLE', cacheChecked: true },
      sold: { status: 'NOT_AUTHORIZED' }, valuation: { status: 'NOT_AUTHORIZED' },
    });
  });

  it('proves Enterprise sold and valuation evidence were checked before insufficiency', () => {
    expect(buildEvidenceCompleteness({ reportType: 'DEAL_INTELLIGENCE', evidenceState: 'available', context: snapshot.dealIntelligence,
      trace: { propertyEvidence: 'HIT', soldEvidence: 'MISS_REFRESHED', valuationEvidence: 'MISS_REFRESHED',
        soldProviderAttempted: true, valuationProviderAttempted: true } })).toMatchObject({
      complete: true,
      sold: { status: 'UNAVAILABLE', reason: 'PROVIDER_NO_RESULTS', cacheChecked: true, providerAttempted: true },
      valuation: { status: 'INSUFFICIENT', reason: 'PROVIDER_AVM_AVAILABLE_ARV_GATES_NOT_MET', cacheChecked: true, providerAttempted: true },
    });
  });

  it('keeps address mismatch fail-closed', () => {
    const result = buildEvidenceCompleteness({ reportType: 'DEAL_INTELLIGENCE', evidenceState: 'not_loaded', context: null,
      trace: { propertyEvidence: 'MISS', addressValidation: 'REJECTED', stopReason: 'ADDRESS_MISMATCH' } });
    expect(result.property.status).toBe('REJECTED');
    expect(result.sold).toMatchObject({ status: 'REJECTED', reason: 'ADDRESS_MISMATCH' });
    expect(result.valuation).toMatchObject({ status: 'REJECTED', reason: 'ADDRESS_MISMATCH' });
  });
});
