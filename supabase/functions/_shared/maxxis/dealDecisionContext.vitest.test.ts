import { describe, expect, it } from 'vitest';
import { buildDealDecisionContext } from './dealDecisionContext.ts';
import { buildMaxxisStructuredAnalysis } from './maxxisStructuredAnalysis.ts';
import { dedupeSemanticStatements } from './semanticDeduplication.ts';

const field = (value: unknown, status = 'USER_PROVIDED', source = 'DealSifter') => ({ value, status, source });

function snapshot(overrides: Record<string, any> = {}) {
  const propertyFacts = {
    id: 'property-1', address: '10865 Wystone Ave', city: 'Porter Ranch', state: 'CA',
    type: 'SFR', objective: 'Sell', price: 1_295_000, rehab: 300_000, sqft: 1680, capRate: 4,
    ...(overrides.propertyFacts || {}),
  };
  const dealIntelligence = {
    type: 'deal_intelligence_context',
    propertyContext: { fields: {
      askingPrice: field(propertyFacts.price),
      propertyType: field(propertyFacts.type),
      livingAreaSqft: field(propertyFacts.sqft),
      ...(overrides.fields || {}),
    } },
    investorContext: { strategies: overrides.strategies || ['Fix and Flip'], targetMarkets: ['Los Angeles, CA'] },
    matchContext: { score: overrides.matchScore ?? 29, reasons: [
      { key: 'property_type', status: 'matched', detail: 'Property type matches the profile.' },
      { key: 'market', status: 'not_matched', detail: 'Location is outside the target market.' },
    ] },
    dealMetrics: { metrics: {
      pricePerSqft: { calculable: true, value: propertyFacts.price / Number(propertyFacts.sqft || 1) },
      acquisitionPlusRehab: { calculable: true, value: propertyFacts.price + propertyFacts.rehab },
      capRate: { calculable: true, value: propertyFacts.capRate },
    } },
    valuationContext: overrides.valuationContext || {
      status: 'ARV_UNAVAILABLE', confidence: 'LOW', compsUsed: 0, warnings: ['INSUFFICIENT_COMPS'],
      providerEstimate: null,
    },
    comparableEvidence: overrides.comparableEvidence || [],
    risks: [], opportunities: [], limitations: ['arv_not_structured', 'roi_not_calculated'],
    recommendedActions: ['Review additional condition-compatible recorded sales.'],
    analysisApplicability: overrides.analysisApplicability || {
      propertyCategory: 'IMPROVED_PROPERTY', constructionPlanned: false,
      rehab: 'APPLICABLE', residentialArv: 'APPLICABLE',
    },
    ...(overrides.dealIntelligence || {}),
  };
  return {
    propertyFacts,
    dealIntelligence,
    rehabAnalysis: overrides.rehabAnalysis || {
      value: propertyFacts.rehab, source: 'PROPERTY_APP_VALUE', provenance: 'REPORTED',
      benchmark: { state: 'California', scope: 'FULL_RENOVATION', low: 241_920, mid: 302_400,
        high: 362_880, source: 'USER_CURATED_REHAB_BENCHMARK_2026' },
      sanityCheck: { actualRehabPerSqft: 178.57, classification: 'WITHIN_REFERENCE_RANGE' },
    },
    evidenceCompletenessGate: { assumptions: overrides.assumptions || {
      targetCondition: 'FULL_RENOVATION', renovationScope: 'Full renovation',
    } },
    evidenceCompleteness: overrides.evidenceCompleteness || {
      property: { status: 'PROVIDER_NO_RESULT', reason: 'ADDRESS_MISMATCH' },
      sold: { status: 'PROVIDER_NO_RESULT', reason: 'ADDRESS_MISMATCH' },
      valuation: { status: 'REJECTED', reason: 'ADDRESS_MISMATCH' },
    },
  };
}

describe('DealDecisionContext', () => {
  it('turns Wystone facts into base cost, rehab intensity, benchmark context, and an exit-evidence priority', () => {
    const input = snapshot();
    const decision = buildDealDecisionContext(input);
    const analysis = buildMaxxisStructuredAnalysis({ ...input, dealDecisionContext: decision }, 'DEAL_INTELLIGENCE', 'en');
    expect(decision.strategy).toBe('FLIP');
    expect(decision.relationships).toMatchObject({ baseCost: 1_595_000, rehabPerSqft: 178.57, arvStatus: 'ARV_UNAVAILABLE' });
    expect(decision.decisionGaps[0]).toMatchObject({ field: 'exit_value_evidence', criticality: 'CRITICAL' });
    expect(decision.relationships).toMatchObject({ reportedCapRate: 4, calculatedCapRate: null });
    expect(decision.marketReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'rehabBenchmark', provenance: 'MARKET_REFERENCE' }),
    ]));
    expect(analysis.dealThesis.summary).toContain('$1,595,000');
    expect(analysis.dealThesis.supportingEvidence.join(' ')).toContain('178.57');
    expect(analysis.executiveSummary).toContain('profile-fit measure, not a deal-quality score');
  });

  it('classifies rehab benchmark resemblance without silently assigning target condition', () => {
    const input = snapshot({ assumptions: {} });
    input.rehabAnalysis = { ...input.rehabAnalysis, benchmark: null };
    input.evidenceCompletenessGate.benchmarkOptions = [
      { scope: 'STANDARD_RENOVATION', state: 'California', rate: { low: 80, average: 100, high: 120 } },
      { scope: 'FULL_RENOVATION', state: 'California', rate: { low: 144, average: 180, high: 216 } },
    ];
    const decision = buildDealDecisionContext(input);
    const analysis = buildMaxxisStructuredAnalysis({ ...input, dealDecisionContext: decision }, 'DEAL_INTELLIGENCE', 'en');
    expect(decision.relationships.rehabBenchmarkResemblance).toBe('FULL_RENOVATION');
    expect(decision.userAssumptions.some((item) => item.key === 'targetCondition')).toBe(false);
    expect(analysis.dealThesis.supportingEvidence.join(' ')).toContain('must confirm the intended scope');
  });

  it('uses richer Droad provider evidence without changing its provenance', () => {
    const input = snapshot({
      propertyFacts: { address: '5939 Droad St', city: 'Jacksonville', state: 'FL', price: 410_000, rehab: 55_000, sqft: 1830 },
      fields: {
        yearBuilt: field(1962, 'VERIFIED_RECORD', 'rentcast'),
        assessedValue: field(355_000, 'VERIFIED_RECORD', 'rentcast'),
        latestSalePrice: field(290_000, 'VERIFIED_RECORD', 'rentcast'),
      },
    });
    const decision = buildDealDecisionContext(input);
    expect(decision.verifiedEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'yearBuilt', provenance: 'PROVIDER_VERIFIED' }),
      expect.objectContaining({ key: 'assessedValue', provenance: 'PROVIDER_VERIFIED' }),
    ]));
    expect(decision.relationships).toMatchObject({ assessedValue: 355_000, latestSalePrice: 290_000 });
  });

  it('keeps Honolulu supporting comps and provider estimate as context, never ARV', () => {
    const input = snapshot({
      propertyFacts: { address: '7081 Kalanianaole Hwy', city: 'Honolulu', state: 'HI', price: 2_100_000, rehab: 0, sqft: 2333 },
      valuationContext: { status: 'ARV_UNAVAILABLE', confidence: 'LOW', compsUsed: 0,
        providerEstimate: { value: 2_236_000, provenance: 'ESTIMATED' } },
      comparableEvidence: [
        { compIdentifier: 'support-1', address: '436 Kekauluohi St', recordedSalePrice: 1_550_000,
          valuationRole: 'SUPPORTING', valuationEligibility: 'SUPPORTING_ONLY' },
      ],
    });
    const decision = buildDealDecisionContext(input);
    const analysis = buildMaxxisStructuredAnalysis({ ...input, dealDecisionContext: decision }, 'DEAL_INTELLIGENCE', 'en');
    expect(decision.relationships).toMatchObject({ providerEstimate: 2_236_000, supportingCompCount: 1, selectedCompCount: 0 });
    expect(decision.marketReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'providerEstimate', source: 'PROVIDER_AVM_NOT_ARV' }),
      expect.objectContaining({ key: expect.stringMatching(/^supportingComp:/) }),
    ]));
    expect(analysis.dealThesis.contraryEvidence.join(' ')).toContain('not a DealSifter ARV');
  });

  it('uses the land playbook and produces no residential rehab or ARV gaps', () => {
    const input = snapshot({
      propertyFacts: { type: 'Land', objective: 'Sell', price: 180_000, rehab: 0, sqft: null, lot: 52_272 },
      strategies: ['Land'],
      analysisApplicability: { propertyCategory: 'VACANT_LAND', constructionPlanned: false,
        rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE' },
      rehabAnalysis: { applicability: 'NOT_APPLICABLE', value: null, provenance: 'NOT_APPLICABLE' },
      valuationContext: { status: 'NOT_APPLICABLE', confidence: 'LOW', providerEstimate: null },
      assumptions: {},
    });
    const decision = buildDealDecisionContext(input);
    expect(decision.strategy).toBe('LAND');
    expect(decision.decisionGaps.map((gap) => gap.field)).not.toEqual(expect.arrayContaining([
      'rehab_budget', 'target_condition', 'exit_value_evidence',
    ]));
    expect(decision.decisionGaps.map((gap) => gap.field)).toEqual(expect.arrayContaining(['zoning', 'allowed_use', 'land_sale_evidence']));
  });

  it('preserves Gable notes and calculates canonical land unit metrics', () => {
    const input = snapshot({
      propertyFacts: { type: 'Land', objective: 'Sell', price: 19_000, rehab: null, sqft: null,
        lot: '1,14ac', notes: 'opportunity to subdivide in 2 lots for new constructions' },
      strategies: ['Land'],
      analysisApplicability: { propertyCategory: 'VACANT_LAND', constructionPlanned: false,
        rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE' },
      rehabAnalysis: { applicability: 'NOT_APPLICABLE', value: null, provenance: 'NOT_APPLICABLE' },
      valuationContext: { status: 'NOT_APPLICABLE', confidence: 'LOW', providerEstimate: null },
      assumptions: {},
    });
    const decision = buildDealDecisionContext(input);
    expect(decision.relationships).toMatchObject({
      lotSizeAcres: 1.14, lotSizeSqft: 49_658.4, pricePerLotSqft: 0.38, pricePerAcre: 16_666.67,
    });
    expect(decision.userAssumptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'propertyNotes', provenance: 'USER_PROVIDED' }),
    ]));
    expect(decision.calculatedMetrics).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'pricePerAcre', value: 16_666.67 }),
      expect.objectContaining({ key: 'pricePerLotSqft', value: 0.38 }),
    ]));
  });

  it('uses financing-specific SUB-TO gaps instead of residential ARV gaps', () => {
    const input = snapshot({
      propertyFacts: { objective: 'SUB-TO', rehab: 0 },
      strategies: ['SUB-TO'],
      assumptions: { interestRate: 3.25 },
    });
    const decision = buildDealDecisionContext(input);
    expect(decision.strategy).toBe('SUB_TO');
    expect(decision.decisionGaps.map((gap) => gap.field)).toEqual(expect.arrayContaining([
      'existing_loan_balance', 'monthly_pi_payment', 'arrears', 'cash_to_seller',
    ]));
    expect(decision.decisionGaps.map((gap) => gap.field)).not.toContain('exit_value_evidence');
  });

  it('uses persisted seller-financing assumptions to remove only resolved financing gaps', () => {
    const input = snapshot({ propertyFacts: { objective: 'Seller Financing', rehab: 0 }, strategies: ['Seller Financing'] });
    input.dealAssumptions = { downPayment: 60000, interestRate: 6.5, termMonths: 60 };
    const decision = buildDealDecisionContext(input);
    expect(decision.strategy).toBe('SELLER_FINANCING');
    expect(decision.userAssumptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'downPayment', provenance: 'USER_ASSUMPTION' }),
    ]));
    expect(decision.decisionGaps.map((gap) => gap.field)).not.toEqual(expect.arrayContaining([
      'down_payment', 'interest_rate', 'term_months',
    ]));
    expect(decision.decisionGaps.map((gap) => gap.field)).toContain('amortization_months');
  });

  it('deduplicates equivalent verification warnings and separates report pages 5 and 6', () => {
    expect(dedupeSemanticStatements([
      'Property data should be independently verified.',
      'Registered property information requires independent verification.',
    ])).toHaveLength(1);
    const input = snapshot();
    const decision = buildDealDecisionContext(input);
    const analysis = buildMaxxisStructuredAnalysis({ ...input, dealDecisionContext: decision }, 'DEAL_INTELLIGENCE', 'en');
    expect(analysis.missingEvidence.length).toBeLessThanOrEqual(3);
    expect(analysis.reportPage5).not.toEqual(analysis.reportPage6);
    expect(analysis.reportPage5).toHaveProperty('supportsDeal');
    expect(analysis.reportPage6).toHaveProperty('decisionChangingActions');
    expect(analysis.reportPage6.openDecisionQuestions).not.toEqual(analysis.reportPage6.decisionChangingActions);
  });
});
