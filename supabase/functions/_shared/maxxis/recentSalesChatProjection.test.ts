import { describe, expect, it } from 'vitest';
import { buildMaxxisLLMContext } from './toolResultForGemini.ts';

describe('Recent-Sales chat projection', () => {
  it('projects the exact deterministic estimate and at most five selected comps without raw pools', () => {
    const comps = Array.from({ length: 8 }, (_, index) => ({ address: `${index} Sold St`, salePrice: 100000 + index,
      saleDate: '2026-09-01', saleAgeDays: 30, distanceMiles: 0.5, unitValue: 200 + index,
      impliedSubjectValue: 400000 + index, structuralScore: 90, classification: 'VALUATION_INCLUDED' }));
    const value = buildMaxxisLLMContext({ type: 'deal_insight', propertyId: 'property-1', state: 'available',
      property: { id: 'property-1', address: '100 Main St' }, dealIntelligence: { type: 'deal_intelligence_context',
        evidenceSummary: {}, valuationContext: {}, comparableEvidence: [] }, runtimeTrace: {},
      intelligenceSnapshot: { recentSalesMarketEstimate: { status: 'AVAILABLE', propertyCategory: 'RESIDENTIAL',
        centralEstimate: 400000, range: { low: 380000, high: 420000 }, unitMetric: 'PRICE_PER_SQFT',
        weightedUnitValue: 200, qualifyingSalesCount: 8, valuationCompCount: 5, confidence: 'MODERATE',
        confidenceReasons: ['5_QUALIFIED_RECENT_RECORDED_SALES', 'CONDITION_NOT_ADJUSTED'],
        dispersion: { coefficient: 0.12 }, conditionAdjustmentStatus: 'CONDITION_NOT_ADJUSTED',
        providerAvmCompatibility: 'COMPATIBLE', valuationComps: comps, rawPool: Array(100).fill({ secret: true }) },
        providerMarketContext: { providerEstimateDivergence: 0.05 }, analysisApplicability: {}, rehabAnalysis: {} } });
    expect(value.recentSalesMarketEstimate).toMatchObject({ centralEstimate: 400000, range: { low: 380000, high: 420000 },
      valuationCompCount: 5, providerEstimateDivergence: 0.05 });
    expect((value as any).recentSalesMarketEstimate.comps).toHaveLength(5);
    expect(JSON.stringify(value)).not.toContain('rawPool');
    expect(JSON.stringify(value).length).toBeLessThan(20_000);
  });
});
