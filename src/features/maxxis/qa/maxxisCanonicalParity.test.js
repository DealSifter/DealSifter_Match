import { describe, expect, it } from 'vitest';
import { mergeVerifiedPropertyEvidenceIntoFacts } from '../../../../supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts';
import { buildPropertyFactLookupAnswer } from '../../../../supabase/functions/_shared/maxxis/propertyFactLookup.ts';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildCanonicalInvestmentAnalysis } from '../intelligence/canonicalInvestmentAnalysis';

const verified = (value, effectiveDate = null) => ({ value, status: 'VERIFIED_RECORD', source: 'rentcast',
  retrievedAt: '2026-09-25T12:00:00.000Z', effectiveDate, confidence: null });
const unknown = () => ({ value: null, status: 'UNKNOWN', source: null, retrievedAt: null, effectiveDate: null, confidence: null });

function droad() {
  const propertyContext = { fields: {
    propertyType: verified('Single Family'), county: verified('Duval'), lotSizeSqft: verified(7253), yearBuilt: verified(1962),
    assessedValue: verified(108188, '2025'), annualPropertyTax: verified(1843, '2024'),
    latestSalePrice: verified(80500, '2021-08-03'), latestSaleDate: verified('2021-08-03T00:00:00.000Z', '2021-08-03'),
    ownerOccupied: verified(true), assessorId: unknown(), zoning: unknown(), subdivision: unknown(),
    askingPrice: { value: 113900, status: 'USER_PROVIDED', source: 'DealSifter' },
  }, conflicts: [] };
  return mergeVerifiedPropertyEvidenceIntoFacts({ id: 'droad', address: '5939 Droad St', city: 'Jacksonville', state: 'FL', zip: '32208',
    type: 'SFR', objective: 'Seller Financing', price: 113900, notes: 'Excelent opportunity for buy&hold' }, propertyContext);
}

const matchContext = { score: 50, classification: 'moderate', calculable: true, reasons: [
  { key: 'market', label: 'Market', status: 'matched', points: 35, maxPoints: 35 },
  { key: 'price', label: 'Price range', status: 'not_matched', points: 0, maxPoints: 35 },
  { key: 'property_type', label: 'Property type', status: 'matched', points: 20, maxPoints: 20 },
  { key: 'strategy', label: 'Strategy', status: 'not_evaluated', points: 0, maxPoints: 10 },
] };

function analysisContext(propertyFacts, strategy, decisionGaps = [], fields = {}) {
  return { propertyFacts, matchContext, propertyContext: { fields }, evidenceSummary: { verifiedFieldCount: 8, userProvidedFieldCount: 7, unknownFieldCount: 3, conflictCount: 0 },
    risks: [], limitations: [], comparableEvidence: [], dealDecisionContext: { strategy, decisionGaps } };
}

describe('canonical property and investment parity', () => {
  it('projects the exact Droad facts through L1, L2 and L3 from one overview model', () => {
    const property = droad();
    const profile = { ...matchContext, semantics: 'PROFILE_FIT_ONLY', criteria: [] };
    const l1 = buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', property });
    const l2 = buildMaxxisReportSchema({ reportType: 'MAXXIS_ANALYSIS', property, maxxisAnalysis: { profileAlignment: profile } });
    const l3 = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: { investmentFit: profile } });
    const fields = ['county', 'lotSizeSqft', 'yearBuilt', 'assessedValue', 'annualPropertyTax', 'latestSalePrice', 'latestSaleDate', 'ownerOccupied', 'propertyUserNotes'];
    for (const field of fields) {
      expect(l2.sections.propertySummary.data[field]).toEqual(l1.sections.propertySummary.data[field]);
      expect(l3.sections.propertySummary.data[field]).toEqual(l1.sections.propertySummary.data[field]);
    }
    expect(l1.sections.propertySummary.data.assessorId).toBeUndefined();
    expect(l1.sections.propertySummary.data.canonicalPropertyFacts.parcel.assessorId.status).toBe('UNKNOWN');
  });

  it('answers direct facts without Gemini and localizes dates and booleans', () => {
    const propertyFacts = droad();
    const snapshot = { propertyFacts, dealDecisionContext: { strategy: 'SELLER_FINANCING', decisionGaps: [
      { field: 'down_payment' }, { field: 'interest_rate' }, { field: 'term_months' },
    ] } };
    expect(buildPropertyFactLookupAnswer('qual o APN?', 'pt', snapshot).text)
      .toBe('Não disponível no registro externo atual.');
    const combined = buildPropertyFactLookupAnswer('Qual o APN e quais são os 3 pontos mais importantes para estruturar este Seller Financing?', 'pt', snapshot).text;
    expect(combined).toContain('Não disponível no registro externo atual.');
    expect(combined).toContain('Prioridades para SELLER_FINANCING');
    expect(combined).toContain('definir a entrada');
    expect(buildPropertyFactLookupAnswer('qual foi a última venda?', 'pt', snapshot).text).toMatch(/US\$\s*80\.500.*3 de ago\. de 2021/);
    expect(buildPropertyFactLookupAnswer('o owner ocupa o imóvel?', 'pt', snapshot).text).toContain('Sim');
    expect(buildPropertyFactLookupAnswer('quais são as Notes?', 'pt', snapshot).text).toContain('Excelent opportunity for buy&hold');
  });

  it('projects a known canonical APN to chat and all three report levels without invention', () => {
    const property = mergeVerifiedPropertyEvidenceIntoFacts({ id: 'known-apn', address: '1 APN St', type: 'SFR' }, {
      fields: { assessorId: verified('APN-EXACT-123') }, conflicts: [],
    });
    const snapshot = { propertyFacts: property };
    expect(buildPropertyFactLookupAnswer('Qual é o APN deste imóvel?', 'pt', snapshot).text).toContain('APN-EXACT-123');
    for (const reportType of ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']) {
      const schema = buildMaxxisReportSchema({ reportType, property,
        maxxisAnalysis: { profileAlignment: {} }, dealIntelligence: { investmentFit: {} } });
      expect(schema.sections.propertySummary.data.assessorId).toBe('APN-EXACT-123');
    }
    expect(JSON.stringify(snapshot)).not.toContain('APN-GENERATED');
  });

  it('keeps a user-provided APN when the stored provider field is unavailable', () => {
    const property = mergeVerifiedPropertyEvidenceIntoFacts({ id: 'user-apn', address: '2 APN St', type: 'SFR', apn: 'USER-APN-77' }, {
      fields: { assessorId: unknown() }, conflicts: [],
    });
    expect(property.assessorId).toBeUndefined();
    expect(property.apn).toBe('USER-APN-77');
    expect(property.canonicalPropertyFacts.parcel.assessorId).toMatchObject({ value: 'USER-APN-77', status: 'USER_PROVIDED' });
    const schema = buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', property });
    expect(schema.sections.propertySummary.data.assessorId).toBe('USER-APN-77');
  });

  it('deduplicates equivalent land gaps in the three direct priorities', () => {
    const answer = buildPropertyFactLookupAnswer('Quais são os 3 dados mais importantes para decidir se este terreno é interessante?', 'pt', {
      propertyFacts: { type: 'Land' }, dealDecisionContext: { strategy: 'LAND', decisionGaps: [
        { field: 'allowed_use' }, { field: 'land_sale_evidence' }, { field: 'zoning' }, { field: 'road_access' },
      ] },
    }).text;
    expect(answer).toContain('1. verificar o uso permitido.');
    expect(answer).toContain('2. obter vendas recentes de terrenos comparáveis.');
    expect(answer).toContain('3. verificar acesso legal e físico.');
    expect(answer.match(/uso permitido/g)).toHaveLength(1);
  });

  it('uses the same non-default profile scores and never invents 35 for not-evaluated criteria', () => {
    const result = buildCanonicalInvestmentAnalysis(analysisContext(droad(), 'SELLER_FINANCING'), 'pt');
    expect(result.profileFit.criteria.map((item) => item.score)).toEqual([100, 0, 100, null]);
  });

  it('creates strategy-aware and evidence-varying focus maps', () => {
    const seller = buildCanonicalInvestmentAnalysis(analysisContext(droad(), 'SELLER_FINANCING', [
      { field: 'down_payment' }, { field: 'interest_rate' }, { field: 'term_months' }, { field: 'amortization_months' }, { field: 'balloon_months' },
    ]), 'pt').focusMap;
    const gable = buildCanonicalInvestmentAnalysis(analysisContext({ type: 'Land', resolvedAnalysisStrategy: 'LAND' }, 'LAND', [
      { field: 'zoning' }, { field: 'allowed_use' }, { field: 'road_access' }, { field: 'utilities' }, { field: 'survey' },
    ], { lotSizeSqft: verified(23854), ownershipRecordPresent: verified(true) }), 'pt').focusMap;
    const bent = buildCanonicalInvestmentAnalysis(analysisContext({ type: 'Land', resolvedAnalysisStrategy: 'LAND' }, 'LAND', [
      { field: 'zoning' }, { field: 'allowed_use' }, { field: 'road_access' }, { field: 'utilities' }, { field: 'land_sale_evidence' }, { field: 'ownership' }, { field: 'survey' }, { field: 'topography' }, { field: 'lot_size' },
    ]), 'pt').focusMap;
    expect(seller.strategy).toBe('SELLER_FINANCING');
    expect(seller.dimensions.map((item) => item.dimension).join(' ')).not.toMatch(/reforma|ARV/i);
    expect(gable.strategy).toBe('LAND');
    expect(gable.dimensions.map((item) => item.dimension)).not.toEqual(seller.dimensions.map((item) => item.dimension));
    expect(gable.dimensions.map((item) => item.readiness)).not.toEqual(bent.dimensions.map((item) => item.readiness));
  });

  it('updates Seller Financing readiness from confirmed deterministic inputs, not economic favorability', () => {
    const gaps = [{ field: 'down_payment' }, { field: 'interest_rate' }, { field: 'term_months' },
      { field: 'amortization_months' }, { field: 'balloon_months' }];
    const before = buildCanonicalInvestmentAnalysis(analysisContext(droad(), 'SELLER_FINANCING', gaps), 'pt').focusMap;
    const after = buildCanonicalInvestmentAnalysis({
      ...analysisContext(droad(), 'SELLER_FINANCING', gaps),
      sellerFinancingScenario: { purchasePrice: 113900, downPaymentAmount: 20000, annualInterestRate: 6,
        amortizationMonths: 360, balloonMonth: 60, monthlyPI: 562.98 },
    }, 'pt').focusMap;
    expect(after.semantics).toBe('STRATEGY_DECISION_READINESS_ONLY');
    expect(after.dimensions[1].readiness).toBeGreaterThan(before.dimensions[1].readiness);
    expect(after.dimensions[2].readiness).toBeGreaterThan(before.dimensions[2].readiness);
    expect(after.dimensions[3].readiness).toBeGreaterThan(before.dimensions[3].readiness);
  });
});
