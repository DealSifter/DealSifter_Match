import { describe, it, expect, vi } from 'vitest';
import { buildReportPreflight, mergeConfirmedCompletion, confirmedScenarioMetricAnswer } from './reportCompletion';
import { calculateScenario } from './scenarioEngine';
import { parseConversationalCompletion } from '../../../../src/features/maxxis/intelligence/conversationalCompletion';
import { saveReportCompletionRequest, readReportCompletionRequest } from '../../../../src/features/maxxis/intelligence/reportCompletionRequest';

const propertyId = '11111111-1111-4111-8111-111111111111', userId = 'user-a';
const base = { propertyId, userId, reportType: 'DEAL_INTELLIGENCE', property: { id: propertyId, type: 'SFR', objective: 'Buy and Hold', price: 200000 }, targetCondition: 'AS_IS', now: '2026-11-05T12:00:00Z' };
const expenses = { rent: 2000, vacancyRate: 5, opexMethod: 'ITEMIZED', propertyTax: 2200, insurance: 1600,
  maintenanceAmount: 1200, HOA: 0, managementPercent: 0, utilities: 0, otherOperatingExpenses: 0 };
function assumptions(values: Record<string, any>) {
  return mergeConfirmedCompletion({ existing: {}, patch: values, propertyId, userId, now: base.now, revision: 1 });
}
const preflight = (values: Record<string, any>, extra: Record<string, any> = {}) => buildReportPreflight({ ...base, dealAssumptions: assumptions(values), revision: 1, ...extra });

describe('R-3 deterministic acceptance contracts (offline, not authenticated homologation)', () => {
  it('R3-01/R3-19: L1 requires no financial completion; L2 optional evidence does not block', () => {
    expect(buildReportPreflight({ ...base, reportType: 'PROPERTY_RELEASE' }).status).toBe('READY');
    const l2 = buildReportPreflight({ ...base, reportType: 'MAXXIS_ANALYSIS' });
    expect(l2.gaps.filter(g => g.required)).toEqual([]);
    expect(['READY', 'PARTIAL_ALLOWED']).toContain(l2.status);
  });
  it('R3-02: missing expenses must precede complete L3 generation, <=3 questions per round', () => {
    const result = preflight({ rent: 2000, vacancyRate: 5, opexMethod: 'ITEMIZED' });
    expect(result.canGenerate).toBe(false); expect(result.gaps.some(g => g.id === 'insurance' && g.required)).toBe(true);
    expect(result.questions).toHaveLength(3);
  });
  it('R3-03/R3-06/R3-22: only insurance is asked when every other required input is confirmed', () => {
    const { insurance: _, ...rest } = expenses;
    const result = preflight(rest);
    expect(result.missingUserInputs).toEqual(['insurance']);
    const after = preflight(expenses);
    expect(after.gaps.some(g => g.id === 'insurance')).toBe(false);
    expect(after.scenario.assumptions.insurance).toBe(1600);
    expect(after.fields.insurance).toMatchObject({ status: 'AVAILABLE_USER_CONFIRMED', origin: 'USER_DECLARED' });
  });
  it('R3-04: 30% of EGI includes 3800 known expenses rather than adding them twice', () => {
    const result = preflight({ rent: 2000, vacancyRate: 5, opexMethod: 'AGGREGATE_EGI', opexPercent: 30, propertyTax: 2200, insurance: 1600 });
    expect(result.scenario.calculatedOutputs).toMatchObject({ effectiveGrossIncome: 22800, operatingExpenses: 6840,
      knownOperatingExpenses: 3800, unallocatedOperatingReserve: 3040, NOI: 15960 });
    expect(result.scenario.calculatedOutputs.debtService).toBeNull();
  });
  it('R3-04 conflict: known costs above budget do not create NOI or implicit zero categories', () => {
    const result = preflight({ rent: 2000, vacancyRate: 5, opexMethod: 'AGGREGATE_EGI', opexPercent: 10, propertyTax: 3800 });
    expect(result.status).toBe('NEEDS_CONFIRMATION'); expect(result.scenario.calculatedOutputs.NOI).toBeNull();
    expect(result.scenario.calculatedOutputs.unallocatedOperatingReserve).toBeNull();
    expect(result.scenario.assumptions.insurance).toBeUndefined();
  });
  it('R3-05: itemized costs do not add an aggregate percentage; vacancy and debt are distinct', () => {
    const result = preflight({ ...expenses, opexPercent: 30, monthlyPI: 1000 });
    expect(result.scenario.calculatedOutputs).toMatchObject({ operatingExpenses: 5000, NOI: 17800, annualCashFlow: 5800 });
    expect(result.scenario.calculatedOutputs.aggregateOpexBudget).toBeNull();
  });
  it('R3-07/R3-23: hypothetical text never confirms; expected rent stays an assumption', () => {
    expect(parseConversationalCompletion('What if my insurance is $1,600 per year?')).toBeNull();
    const result = parseConversationalCompletion('My insurance is $1,600 per year and I expect $2,000 monthly rent.');
    expect(result?.values).toEqual({ insurance: 1600, rent: 2000 });
    expect(result?.candidates.find(c => c.field === 'rent')).toMatchObject({ confirmed: false, origin: 'ASSUMPTION' });
  });
  it('R3-08: editing one field preserves other confirmations and recalculates dependent outputs', () => {
    const before = assumptions(expenses);
    const after = mergeConfirmedCompletion({ existing: before, patch: { insurance: 2000 }, propertyId, userId, now: '2026-11-06T12:00:00Z', revision: 2 });
    expect(after.r3Completion.inputs.rent).toEqual(before.r3Completion.inputs.rent);
    expect(after.r3Completion.inputs.insurance.version).toBe(2);
    const a = buildReportPreflight({ ...base, dealAssumptions: before }), b = buildReportPreflight({ ...base, dealAssumptions: after });
    expect(b.scenario.calculatedOutputs.NOI).toBe(a.scenario.calculatedOutputs.NOI - 400);
  });
  it('R3-09/R3-11/R3-16: reload recovers the same request, no cross-account/private-property reuse', () => {
    const data = new Map<string, string>(), storage = { getItem: (k: string) => data.get(k) || null, setItem: (k: string, v: string) => data.set(k, v) } as Storage;
    saveReportCompletionRequest('a', { id: 'request-one', propertyId, reportType: 'DEAL_INTELLIGENCE', expectedRevision: 4, options: { includePublisher: true } }, storage);
    expect(readReportCompletionRequest('a', storage)).toMatchObject({ id: 'request-one', reportType: 'DEAL_INTELLIGENCE', expectedRevision: 4 });
    expect(readReportCompletionRequest('b', storage)).toBeNull();
    expect(() => buildReportPreflight({ ...base, dealAssumptions: assumptions(expenses), userId: 'user-b' })).toThrow('SCENARIO_IDENTITY_MISMATCH');
  });
  it('R3-12/R3-13: missing target condition is asked; absent sales cannot be replaced by AVM', () => {
    const result = preflight(expenses, { targetCondition: null, evidence: { providerEstimate: { value: 999999 } } });
    expect(result.gaps.some(g => g.id === 'target_condition')).toBe(true);
    expect(result.limitations).toContain('ARV_REQUIRES_ELIGIBLE_RECORDED_SALES');
    expect(result.scenario.calculatedOutputs.ARV).toBeUndefined();
  });
  it('R3-14/R3-15: preparing gaps is cache-only and invokes no external network', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('NETWORK_FORBIDDEN'));
    try { expect(preflight(expenses).acquisition.providerCalls).toBe(0); expect(fetch).not.toHaveBeenCalled(); } finally { fetch.mockRestore(); }
  });
  it('R3-17/R3-18: persisted inputs, engine and snapshot use the same calculation', () => {
    const state = JSON.parse(JSON.stringify(assumptions({ ...expenses, monthlyPI: 0 })));
    const result = buildReportPreflight({ ...base, dealAssumptions: state, revision: 5, partialAccepted: true });
    expect(result.scenario.version).toBe(5);
    expect(result.scenario.calculatedOutputs).toEqual(calculateScenario('BUY_AND_HOLD', result.scenario.assumptions));
    expect(result.scenario.inputMetadata.insurance.cadence).toBe('ANNUAL');
    const answer=confirmedScenarioMetricAnswer({propertyId,analysisRevision:5,dealAssumptions:{...state,activeScenario:result.scenario}},'NOI');
    expect(answer).toContain('17,800');expect(answer).toContain('Projected NOI');
  });
  it('R3.1 supersedes R3-19: explicit partial delivery preserves missing financial inputs without inventing metrics', () => {
    expect(preflight(expenses).status).toBe('PARTIAL_ALLOWED');
    expect(preflight(expenses, { partialAccepted: true }).canGenerate).toBe(true);
    const sparse = preflight({}, { partialAccepted: true });
    expect(sparse.canGenerate).toBe(true);
    expect(sparse.gaps.some(g => g.required)).toBe(true);
    expect(sparse.scenario.calculatedOutputs.NOI).toBeUndefined();
  });
  it('never selects a default OPEX method or percentage and refuses invalid amounts', () => {
    const r = preflight({ rent: 2000, vacancyRate: 5 }); expect(r.scenario.assumptions.opexPercent).toBeUndefined();
    expect(r.gaps.some(g => g.id === 'opexMethod')).toBe(true);
    expect(() => assumptions({ opexPercent: 101 })).toThrow();
    expect(() => assumptions({ insurance: -1 })).toThrow();
  });
  it('parses decimal money without multiplying cents by 100',()=>{
    expect(parseConversationalCompletion('My insurance is $1,600.50 per year')?.values.insurance).toBe(1600.5);
    expect(parseConversationalCompletion('Meu seguro é USD 1.600,50 por ano')?.values.insurance).toBe(1600.5);
  });
  it('preserves a confirmed land scenario and reuses a confirmed legacy rent alias',()=>{
    const land={propertyId,userId,confirmed:true,strategy:'LAND',assumptions:{lotSizeAcres:2},calculatedOutputs:{pricePerAcre:10000}};
    expect(buildReportPreflight({...base,property:{...base.property,type:'LAND',objective:'Land'},dealAssumptions:{activeScenario:land},revision:7}).scenario).toMatchObject({...land,version:7});
    const activeScenario={propertyId,userId,confirmed:true,strategy:'BUY_AND_HOLD',assumptions:{expectedRent:2100},source:{expectedRent:'USER_PROVIDED'}};
    const result=buildReportPreflight({...base,dealAssumptions:{activeScenario}});
    expect(result.gaps.some(g=>g.id==='rent')).toBe(false);
    expect(result.scenario.assumptions.rent).toBe(2100);
  });
});
