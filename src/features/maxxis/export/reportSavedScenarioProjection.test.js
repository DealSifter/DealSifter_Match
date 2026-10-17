import { describe, expect, it } from 'vitest';
import { calculateScenario } from '../../../../supabase/functions/_shared/maxxis/scenarioEngine.ts';
import { calculateSellerFinancingScenario } from '../../../../supabase/functions/_shared/maxxis/sellerFinancingScenario.ts';
import { projectSavedReportScenario } from './reportSavedScenarioProjection';

const propertyId = 'owned-property-1';
const inputs = {
  SELLER_FINANCING: { purchasePrice: 113900, downPaymentAmount: 20000, annualInterestRate: 4, amortizationYears: 30, balloonYears: 5, closingCosts: 1000, otherCashToSeller: 0 },
  BUY_AND_HOLD: { purchasePrice: 200000, rent: 2000, vacancyRate: 5, propertyTax: 2400, insurance: 1200, HOA: 0,
    managementPercent: 8, maintenancePercent: 5, otherOperatingExpenses: 600, monthlyPI: 900, cashInvested: 50000 },
  FLIP: { purchasePrice: 100000, rehab: 30000, financingCosts: 0, acquisitionCosts: 5000, holdingCosts: 6000, sellingCosts: 12000, exitValue: 200000 },
  SUB_TO: { existingLoanBalance: 180000, monthlyPI: 1100, reinstatement: 12000, cashToSeller: 5000,
    closingCosts: 3000, propertyTax: 2400, insurance: 1200, HOA: 50, expectedRent: 2100 },
  WHOLESALE: { contractPrice: 90000, estimatedBuyerPrice: 110000, assignmentFee: 12000, closingCosts: 1000 },
};
const scenario = (strategy, assumptions = inputs[strategy]) => {
  assumptions = structuredClone(assumptions);
  const calculatedOutputs = calculateScenario(strategy, assumptions);
  return { id: `saved-${strategy}`, propertyId, confirmed: true, strategy, status: 'COMPLETE', assumptions,
    calculatedOutputs, unresolvedInputs: [], source: Object.fromEntries([
      ...Object.keys(calculatedOutputs).map(key => [key, 'CALCULATED']), ...Object.keys(assumptions).map(key => [key, 'USER_PROVIDED']),
    ]) };
};
const project = (value, locale = 'en', extra = {}) => projectSavedReportScenario({ scenario: value, locale, propertyId, ...extra });
const outputValue = (result, key) => Object.entries(result.values).find(([id]) => id.endsWith(`:output:${key}`))?.[1];
const inputValue = (result, key) => Object.entries(result.values).find(([id]) => id.endsWith(`:input:${key}`))?.[1];
const visible = result => result.sections.map(section => [section.title, section.text || '', ...(section.rows || []).flatMap(row => [row.label, row.value, row.source])]).flat(Infinity).join(' ');

describe('saved scenario strict report preservation without engine migration', () => {
  it.each(Object.keys(inputs))('preserves real existing pure-engine outputs for %s', strategy => {
    const saved = scenario(strategy), result = project(saved);
    expect(result.sections.some(section => section.id === 'saved-scenario-assumptions')).toBe(true);
    expect(result.sections.some(section => section.id === 'saved-scenario-results')).toBe(true);
    const key = { SELLER_FINANCING: 'monthlyPI', BUY_AND_HOLD: 'NOI', FLIP: 'ROI', SUB_TO: 'knownMonthlyCarry', WHOLESALE: 'estimatedNetAssignmentSpread' }[strategy];
    expect(outputValue(result, key)?.numericValue).toBe(saved.calculatedOutputs[key]);
    for (const row of result.sections.flatMap(section => section.rows || [])) {
      expect(row.evidenceRefs[0]).toContain(`property:${propertyId}:dealAssumptions.activeScenario:scenario:saved-${strategy}`);
      expect(result.evidencePacket.some(entry => entry.id === row.evidenceRefs[0])).toBe(true);
    }
    expect(visible(result)).toContain('not current income, verified return or a guarantee');
    expect(saved.calculatedOutputs).toEqual(calculateScenario(strategy, inputs[strategy]));
  });

  it.each(['pt', 'en', 'es'])('provides localized closed labels in %s', locale => {
    const result = project(scenario('SUB_TO'), locale), body = visible(result);
    expect(body).not.toMatch(/existingLoanBalance|monthlyPI|knownMonthlyCarry|estimatedMonthlyCashFlow|USER_PROVIDED|CALCULATED|\[object Object\]/);
    expect(body).toMatch(locale === 'pt' ? /premissas|Premissa/ : locale === 'es' ? /supuestos|Supuesto/ : /assumptions|assumption/);
  });

  it('preserves the exact saved rent premise but rejects shorthand NOI without expense basis', () => {
    const result = project({ strategy: 'BUY_AND_HOLD', confirmed: true, assumptions: { rent: 1800 }, calculatedOutputs: { NOI: 14200 } });
    expect(inputValue(result, 'rent')?.numericValue).toBe(1800);
    expect(outputValue(result, 'NOI')).toBeUndefined();
    expect(result.sections.some(section => section.id === 'saved-scenario-limitations')).toBe(true);
    expect(result.evidencePacket[0].id).toContain(`property:${propertyId}:dealAssumptions.activeScenario`);
    expect(visible(result)).not.toContain('14,200');
    expect(visible(result)).toContain('not a public fact or current contract income');
  });

  it('preserves the legacy direct saved seller-financing result without inventing an ID', () => {
    const existing = calculateSellerFinancingScenario(inputs.SELLER_FINANCING);
    const result = project({ ...existing, confirmed: true }, 'pt', { sourcePath: 'sellerFinancingScenario' });
    expect(outputValue(result, 'monthlyPI')?.numericValue).toBe(448.29);
    expect(outputValue(result, 'balloonBalance')?.numericValue).toBe(84930.21);
    expect(result.evidencePacket[0].id).toContain(`property:${propertyId}:dealAssumptions.sellerFinancingScenario`);
    expect(result.evidencePacket[0].id).not.toContain(':scenario:');
  });

  it('preserves payment and balloon with missing expenses but not complete cash entry', () => {
    const saved = scenario('SELLER_FINANCING', { purchasePrice: 113900, downPaymentAmount: 20000, annualInterestRate: 4, amortizationYears: 30, balloonYears: 5 });
    saved.status = 'PARTIAL'; saved.unresolvedInputs = ['SCENARIO_CASH_TO_ENTRY_REQUIRED'];
    const result = project(saved);
    expect(outputValue(result, 'monthlyPI')?.numericValue).toBe(saved.calculatedOutputs.monthlyPI);
    expect(outputValue(result, 'balloonBalance')?.numericValue).toBe(saved.calculatedOutputs.balloonBalance);
    expect(outputValue(result, 'cashToEntry')).toBeUndefined();
  });

  it.each(['BUY_AND_HOLD', 'FLIP', 'SUB_TO', 'WHOLESALE'])('rejects valid-looking financial outputs from incomplete %s basis', strategy => {
    const saved = scenario(strategy), key = { BUY_AND_HOLD: 'NOI', FLIP: 'ROI', SUB_TO: 'estimatedMonthlyCashFlow', WHOLESALE: 'estimatedNetAssignmentSpread' }[strategy];
    delete saved.assumptions.closingCosts;
    if (strategy === 'BUY_AND_HOLD') delete saved.assumptions.insurance;
    if (strategy === 'FLIP') delete saved.assumptions.holdingCosts;
    const result = project(saved);
    expect(outputValue(result, key)).toBeUndefined();
    expect(result.sections.some(section => section.id === 'saved-scenario-limitations')).toBe(true);
  });

  it('requires COMPLETE calculation status and an explicitly empty unresolved-input collection', () => {
    const saved = scenario('BUY_AND_HOLD');
    for (const override of [{ status: 'PARTIAL' }, { calculatedOutputs: { ...saved.calculatedOutputs, calculationStatus: 'PARTIAL' } }, { unresolvedInputs: ['still missing'] }, { unresolvedInputs: undefined }]) {
      expect(outputValue(project({ ...saved, ...override }), 'NOI')).toBeUndefined();
    }
  });

  it('does not turn assumed rent into actual income or feed a financial engine', () => {
    const result = project(scenario('BUY_AND_HOLD'));
    expect(result.values.currentContractRent).toBeUndefined();
    expect(result.values.capRate).toBeUndefined();
    expect(Object.keys(result.values).every(key => key.includes('dealAssumptions.activeScenario'))).toBe(true);
    expect(inputValue(result, 'rent')?.source).toContain('private investor assumption');
  });

  it('preserves legitimate zero only with explicit input or complete calculated proof', () => {
    const saved = scenario('BUY_AND_HOLD'), result = project(saved);
    expect(inputValue(result, 'HOA')?.state).toBe('EXPLICIT_ZERO');
    const untrusted = structuredClone(saved); delete untrusted.source.HOA;
    expect(inputValue(project(untrusted), 'HOA')).toBeUndefined();
    expect(outputValue(project(untrusted), 'NOI')).toBeUndefined();
    const zeroInterest = scenario('SELLER_FINANCING', { purchasePrice: 120000, downPaymentAmount: 0, annualInterestRate: 0, amortizationYears: 10, balloonYears: 10, closingCosts: 0, otherCashToSeller: 0 });
    expect(outputValue(project(zeroInterest), 'balloonBalance')).toMatchObject({ state: 'EXPLICIT_ZERO', numericValue: 0 });
    expect(outputValue(project(zeroInterest), 'cashToEntry')).toMatchObject({ state: 'EXPLICIT_ZERO', numericValue: 0 });
  });

  it('retains valid negative scenario cash flow without recasting it as zero/unavailable', () => {
    const saved = scenario('BUY_AND_HOLD', { ...inputs.BUY_AND_HOLD, monthlyPI: 2000 });
    expect(saved.calculatedOutputs.annualCashFlow).toBeLessThan(0);
    expect(outputValue(project(saved), 'annualCashFlow')?.numericValue).toBe(saved.calculatedOutputs.annualCashFlow);
  });

  it.each([false, undefined, null])('does not render unconfirmed scenario flag %j', confirmed => {
    expect(project({ ...scenario('WHOLESALE'), confirmed }).sections).toEqual([]);
  });

  it('rejects mismatched property IDs, leaves LAND to its established projector and omits unknown output keys', () => {
    expect(project({ ...scenario('WHOLESALE'), propertyId: 'another-property' }).sections).toEqual([]);
    expect(project({ strategy: 'LAND', confirmed: true, assumptions: { purchasePrice: 20000 } }).sections).toEqual([]);
    const saved = scenario('WHOLESALE'); saved.calculatedOutputs = { ...saved.calculatedOutputs, privateUnexpectedBackendKey: { translation: 'must not render' } };
    const result = project(saved);
    expect(result.diagnostics).toContain('SAVED_SCENARIO_OUTPUT_NOT_DISPLAY_AUTHORIZED:privateUnexpectedBackendKey');
    expect(visible(result)).not.toMatch(/privateUnexpectedBackendKey|translation|\[object Object\]/);
  });
});
