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
    expect(analysis).toMatchObject({
      investmentThesis: expect.any(String),
      profileFit: { score: 62, strengths: expect.any(Array), mismatches: expect.any(Array), unknownCriteria: expect.any(Array) },
      marketAnalysis: { interpretation: expect.any(String), evidence: expect.any(Array) },
      comparablesAnalysis: { candidatesConsidered: 0, selected: [] },
      valuationAnalysis: { providerEstimate: 2236000, providerEstimateRole: 'SUPPORTING_EVIDENCE_ONLY', arv: null },
    });
  });

  it('keeps provider AVM separate from DealSifter ARV and invents neither comps nor ARV', () => {
    const analysis = buildMaxxisStructuredAnalysis(snapshot, 'DEAL_INTELLIGENCE');
    expect(analysis.comparativeAnalysis.selectedCompSummary).toEqual([]);
    expect(analysis.valuationAnalysis.arvInterpretation).toContain('DealSifter ARV is unavailable');
    expect(analysis.valuationAnalysis.scenarioInterpretation).toContain('provider AVM');
    expect(analysis.valuationAnalysis.scenarioInterpretation).toContain('is not the DealSifter ARV');
  });

  it('propagates an optional benchmark as an estimated low-confidence scenario', () => {
    const benchmarkSnapshot = {
      ...snapshot,
      rehabAnalysis: {
        value: 302400,
        source: 'USER_CURATED_REHAB_BENCHMARK_2026',
        provenance: 'ESTIMATED',
        confidence: 'LOW',
        benchmark: {
          state: 'California', scope: 'FULL_RENOVATION', low: 241920, mid: 302400, high: 362880,
          source: 'USER_CURATED_REHAB_BENCHMARK_2026', confidence: 'LOW', usage: 'REFERENCE_ONLY',
        },
        sanityCheck: { actualRehabPerSqft: 180, classification: 'WITHIN_REFERENCE_RANGE' },
        providerCalls: 0,
      },
      dealIntelligence: {
        ...snapshot.dealIntelligence,
        dealMetrics: { metrics: {
          ...snapshot.dealIntelligence.dealMetrics.metrics,
          acquisitionPlusRehab: { calculable: true, value: 2497400 },
        } },
      },
    };
    const analysis = buildMaxxisStructuredAnalysis(benchmarkSnapshot, 'DEAL_INTELLIGENCE', 'pt');
    expect(analysis.rehabAnalysis).toMatchObject({
      budget: 302400, source: 'USER_CURATED_REHAB_BENCHMARK_2026', provenance: 'ESTIMATED',
      confidence: 'LOW', actualRehabPerSqft: 180,
    });
    expect(analysis.valuationAnalysis.rehabImpact).toContain('estimativa preliminar de baixa confiança');
    expect(analysis.rehabAnalysis.interpretation).toContain('não deve ser tratado como orçamento de empreiteiro');
  });

  it('centralizes natural-language explanations for internal states', () => {
    expect(explainMaxxisInternalState('MISSING_REHAB')).toBe('Rehabilitation scope and cost have not yet been confirmed.');
    expect(explainMaxxisInternalState('roi_not_calculated')).toContain('ROI cannot yet be calculated');
  });

  it.each([
    ['pt', 'O imóvel apresenta 62%', 'Não é possível calcular um ARV defensável', 'Limitação prioritária'],
    ['es', 'La propiedad presenta 62%', 'No es posible calcular un ARV defendible', 'Limitación prioritaria'],
  ])('keeps the canonical analysis entirely in the selected %s app language', (language, summary, arv, priority) => {
    const analysis = buildMaxxisStructuredAnalysis(snapshot, 'DEAL_INTELLIGENCE', language);
    expect(analysis.language).toBe(language);
    expect(analysis.executiveSummary).toContain(summary);
    expect(analysis.valuationAnalysis.limitations.join(' ')).toContain(arv);
    expect(analysis.profileAdaptedConclusion).toContain(priority);
    expect(JSON.stringify(analysis)).not.toContain('The property has 62%');
    expect(JSON.stringify(analysis)).not.toContain('A defensible ARV cannot');
  });

  it('represents vacant-land rehab and residential ARV as not applicable in Portuguese', () => {
    const landSnapshot = {
      ...snapshot,
      propertyFacts: { type: 'Land', city: 'Center Point', state: 'AL', lot: '52272', rehab: 0 },
      rehabAnalysis: { applicability: 'NOT_APPLICABLE', value: null, provenance: 'NOT_APPLICABLE' },
      dealIntelligence: {
        ...snapshot.dealIntelligence,
        analysisApplicability: {
          propertyCategory: 'VACANT_LAND', constructionPlanned: false,
          rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE',
        },
        limitations: ['RESIDENTIAL_ARV_NOT_APPLICABLE'],
        recommendedActions: ['Verify zoning, permitted use, utilities, access, survey, title and land-sale evidence.'],
      },
    };
    const analysis = buildMaxxisStructuredAnalysis(landSnapshot, 'DEAL_INTELLIGENCE', 'pt');
    expect(analysis.rehabAnalysis).toMatchObject({ applicability: 'NOT_APPLICABLE', provenance: 'NOT_APPLICABLE' });
    expect(analysis.rehabAnalysis.interpretation).toContain('não se aplica a terreno vago');
    expect(analysis.valuationAnalysis).toMatchObject({ applicability: 'NOT_APPLICABLE', arv: null });
    expect(analysis.valuationAnalysis.arvInterpretation).toContain('ignorado intencionalmente');
    expect(analysis.recommendedActions.join(' ')).toContain('zoneamento');
    expect(analysis.propertyContextInterpretation).toContain('terreno de 52.272 sqft');
    expect(analysis.propertyContextInterpretation).not.toMatch(/0 quartos|0 banheiros|0 sqft/);
  });
});

describe('EvidenceCompleteness', () => {
  it('marks residential sold and ARV evidence not applicable for vacant land', () => {
    const completeness = buildEvidenceCompleteness({
      reportType: 'DEAL_INTELLIGENCE',
      evidenceState: 'available',
      context: {
        ...snapshot.dealIntelligence,
        analysisApplicability: { propertyCategory: 'VACANT_LAND', constructionPlanned: false,
          rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE' },
        valuationContext: { status: 'NOT_APPLICABLE' },
      },
      trace: { propertyEvidence: 'HIT', soldEvidence: 'NOT_REQUIRED', valuationEvidence: 'NOT_REQUIRED' },
    });
    expect(completeness).toMatchObject({
      complete: true,
      property: { status: 'AVAILABLE' },
      sold: { status: 'NOT_APPLICABLE', providerAttempted: false },
      valuation: { status: 'NOT_APPLICABLE', providerAttempted: false },
    });
  });

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
      sold: { status: 'PROVIDER_NO_RESULT', reason: 'PROVIDER_NO_RESULTS', cacheChecked: true, providerAttempted: true },
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

  it('records an exhausted provider budget as explicit unavailable evidence without a false attempt', () => {
    const completeness = buildEvidenceCompleteness({
      reportType: 'DEAL_INTELLIGENCE', evidenceState: 'unavailable', context: snapshot.dealIntelligence,
      trace: {
        propertyEvidence: 'UNKNOWN', propertyEvidenceReason: 'PLAN_PROVIDER_BUDGET_EXHAUSTED',
        propertyProviderAttempted: false, soldEvidence: 'UNKNOWN', valuationEvidence: 'UNKNOWN',
      },
    });
    expect(completeness.property).toMatchObject({
      status: 'INSUFFICIENT', reason: 'PLAN_PROVIDER_BUDGET_EXHAUSTED', providerAttempted: false,
    });
    expect(completeness.sold).toMatchObject({ status: 'NOT_REQUESTED', providerAttempted: false });
    expect(completeness.valuation).toMatchObject({ status: 'NOT_REQUESTED', providerAttempted: false });
  });

  it('keeps stale, unauthorized, and provider-no-result evidence states distinct', () => {
    const stale = buildEvidenceCompleteness({
      reportType: 'DEAL_INTELLIGENCE', evidenceState: 'unavailable', context: snapshot.dealIntelligence,
      trace: { propertyEvidence: 'STALE', propertyEvidenceReason: 'CACHE_EXPIRED' },
    });
    expect(stale.property).toMatchObject({ status: 'STALE', reason: 'CACHE_EXPIRED' });

    const unauthorized = buildEvidenceCompleteness({
      reportType: 'DEAL_INTELLIGENCE', evidenceState: 'unavailable', context: snapshot.dealIntelligence,
      trace: { propertyEvidence: 'UNKNOWN', propertyEvidenceReason: 'PROPERTY_INTELLIGENCE_NOT_AUTHORIZED' },
    });
    expect(unauthorized.property).toMatchObject({
      status: 'NOT_AUTHORIZED', reason: 'PROPERTY_INTELLIGENCE_NOT_AUTHORIZED', providerAttempted: false,
    });

    const noResult = buildEvidenceCompleteness({
      reportType: 'DEAL_INTELLIGENCE', evidenceState: 'not_found', context: snapshot.dealIntelligence,
      trace: { propertyEvidence: 'MISS', propertyEvidenceReason: 'PROPERTY_NOT_FOUND', propertyProviderAttempted: true },
    });
    expect(noResult.property).toMatchObject({
      status: 'PROVIDER_NO_RESULT', reason: 'PROPERTY_NOT_FOUND', providerAttempted: true,
    });
  });
});
