import { describe, it, expect } from 'vitest';
import { costResolutionPlan, applyUnknownChoice } from './unknownInputResolution';
import { buildReportPreflight, mergeConfirmedCompletion } from './reportCompletion';
const propertyId = '11111111-1111-4111-8111-111111111111', userId = 'fixture', now = '2026-11-09T12:00:00Z';
const merge = (patch: Record<string, any>, existing = {}) => mergeConfirmedCompletion({ patch, existing, propertyId, userId, now, revision: 1 });
const flip = { purchasePrice: 200000, exitValue: 300000, rehab: 30000, acquisitionCosts: 5000, scenarioStrategy: 'FLIP' };
const gate = (dealAssumptions: any, partialAccepted = false) => buildReportPreflight({ propertyId, userId, dealAssumptions, revision: 1,
  reportType: 'DEAL_INTELLIGENCE', property: { type: 'SFR', price: 200000, objective: 'Flip' }, targetCondition: 'AS_IS', partialAccepted });
describe('R3.1 unknown input resolution, offline', () => {
  it('T2/T3: unknown is recorded, not zero or not-applicable; explicit partial is generatable without return fabrication', () => {
    const stored = applyUnknownChoice(merge(flip), ['financingCosts', 'sellingCosts', 'holdingCosts'], now, 2);
    const p = gate(stored, true);
    expect(p.fields.financingCosts.status).toBe('UNKNOWN'); expect(p.scenario.assumptions.financingCosts).toBeUndefined();
    expect(p.canGenerate).toBe(true); expect(p.scenario.status).toBe('PARTIAL');
    expect(p.scenario.calculatedOutputs.ROI).toBeNull(); expect(p.scenario.calculatedOutputs.projectedProfit).toBeNull();
    expect(gate(stored).canGenerate).toBe(false);
  });
  it('T4: cash alone is insufficient; no financing charges must also be explicitly confirmed', () => {
    expect(costResolutionPlan(merge({ financingMode: 'CASH' }), propertyId, 1).candidates.financingCosts).toBeUndefined();
    const candidate = costResolutionPlan(merge({ financingMode: 'CASH', financingScope: 'NO_FINANCING_CHARGES' }), propertyId, 1).candidates.financingCosts;
    expect(candidate).toMatchObject({ value: 0, applicability: 'NOT_APPLICABLE', confirmed: false });
  });
  it('T5: selling uses only confirmed private exit price and approved total percentage, never asking price or AVM', () => {
    expect(costResolutionPlan(merge({ sellingCostPercent: 6 }), propertyId, 1).candidates.sellingCosts).toBeUndefined();
    const c = costResolutionPlan(merge({ exitValue: 300000, sellingCostPercent: 6 }), propertyId, 1).candidates.sellingCosts;
    expect(c.value).toBe(18000); expect(c.basis.exitValue.source).toBe('USER_PROVIDED'); expect(c.confirmed).toBe(false);
    expect(gate(merge({ ...flip, sellingCostPercent: 6 })).scenario.assumptions.sellingCosts).toBeUndefined();
  });
  it('T6: holding prorates itemized annual/monthly expenses; excludes rehab, financing and aggregate OPEX', () => {
    const inputs = { holdingPeriodMonths: 6, propertyTax: 2400, insurance: 1200, HOA: 100, maintenanceAmount: 600, utilities: 1200, otherOperatingExpenses: 0,
      holdingExpenseScope: 'ITEMIZED_EXCLUDES_REHAB_AND_FINANCING', rehab: 999999, opexPercent: 30, financingCosts: 50000 };
    const c = costResolutionPlan(merge(inputs), propertyId, 1).candidates.holdingCosts;
    expect(c.value).toBe(3300); expect(c.basis.rehab).toBeUndefined(); expect(c.basis.opexPercent).toBeUndefined();
    expect(costResolutionPlan(merge({ ...inputs, holdingPeriodMonths: 0 }), propertyId, 1).candidates.holdingCosts).toBeUndefined();
  });
  it('T1: financing separates single charges and period interest only with explicit supported loan method', () => {
    const params = { financingMode: 'FINANCED', financingInterestMethod: 'INTEREST_ONLY', financingCostScope: 'EXCLUDES_ACQUISITION_AND_HOLDING_CHARGES', loanAmount: 100000, annualInterestRate: 12,
      holdingPeriodMonths: 6, originationFee: 1000, loanPoints: 2, financeClosingCosts: 500, otherFinancingCosts: 0 };
    expect(costResolutionPlan(merge(params), propertyId, 1).candidates.financingCosts.value).toBe(9500);
    const { otherFinancingCosts: _, ...missing } = params;
    expect(costResolutionPlan(merge(missing), propertyId, 1).candidates.financingCosts).toBeUndefined();
  });
  it('T7: unknown and confirmations survive serialization; confirmed inputs are not asked again', () => {
    const a = applyUnknownChoice(merge({ ...flip, holdingCosts: 1000 }), ['financingCosts', 'holdingCosts'], now, 2);
    const restored = JSON.parse(JSON.stringify(a));
    expect(restored.r3Completion.unknown.holdingCosts).toBeUndefined();
    expect(gate(restored).questions.map((q: any) => q.id)).not.toContain('holdingCosts');
    expect(gate(restored).fields.financingCosts.status).toBe('UNKNOWN');
  });
  it('T9: complete costs retain existing engine results and L1 is unaffected', () => {
    const p = gate(merge({ ...flip, holdingCosts: 1000, financingCosts: 0, sellingCosts: 18000 }), true);
    expect(p.scenario.calculatedOutputs.projectedProfit).toBe(46000);
    expect(p.canGenerate).toBe(true);
    expect(buildReportPreflight({ reportType: 'PROPERTY_RELEASE' }).canGenerate).toBe(true);
  });
  it('T10: conflicting OPEX remains blocked even with explicit partial acceptance; identities are checked', () => {
    const a = merge({ scenarioStrategy: 'BUY_AND_HOLD', purchasePrice: 200000, rent: 2000, vacancyRate: 5, opexMethod: 'AGGREGATE_EGI', opexPercent: 1, insurance: 5000 });
    expect(gate(a, true).status).toBe('NEEDS_CONFIRMATION');
    expect(() => gate({ r3Completion: { propertyId: 'another', inputs: {} } }, true)).toThrow('SCENARIO_IDENTITY_MISMATCH');
  });
});
