import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FINANCIAL_INPUT_FIELDS, normalizeFinancialInputs } from './financialInputContract.ts';
import { buildFinancialEvidenceFromAuthorizedContext } from './financialEvidenceContext.ts';
import { refreshReportFinancialEvidence } from './refreshReportFinancialEvidence.ts';
import { buildDealDecisionContext } from './dealDecisionContext.ts';

describe('G1 shared financial input contract', () => {
  it.each(Object.keys(FINANCIAL_INPUT_FIELDS))('consumes saved financial key %s', field => {
    const result = buildFinancialEvidenceFromAuthorizedContext({ propertyId: 'p', privateAssumptions: { [field]: 5 } });
    expect(result.inputContract.privateInputs[field].status).toBe('CONSUMED');
    expect(Object.values(result.inputs).some(input => input.source?.id === `private-${FINANCIAL_INPUT_FIELDS[field as keyof typeof FINANCIAL_INPUT_FIELDS].key}`)).toBe(true);
  });
  it('maps form units without turning zero into absence', () => {
    const result = buildFinancialEvidenceFromAuthorizedContext({ propertyId: 'p', privateAssumptions: { management: 8, maintenance: 1200, hoa: 0 } });
    expect(result.inputs.propertyManagement).toMatchObject({ value: 8, unit: 'PERCENT' });
    expect(result.inputs.maintenance).toMatchObject({ value: 1200, cadence: 'ANNUAL', annualizedValue: 1200 });
    expect(result.inputs.hoa).toMatchObject({ value: 0, cadence: 'MONTHLY', annualizedValue: 0 });
  });
  it('gives a disposition to every numeric field accepted by persistence', () => {
    const endpoint = readFileSync(new URL('../../maxxis-analysis-inputs/index.ts', import.meta.url), 'utf8');
    const keys = [...endpoint.split('const NUMERIC_DEAL_ASSUMPTIONS = new Set([')[1].split(']);')[0].matchAll(/'([A-Za-z_]+)'/g)].map(match => match[1]);
    const input = Object.fromEntries(keys.map(key => [key, 5]));
    const result = normalizeFinancialInputs(input);
    for (const key of keys) expect(result.dispositions[key]).toBeDefined();
    expect(result.dispositions.operatingExpenses).toMatchObject({ status: 'REJECTED', reason: 'NOT_AN_OPERATING_FINANCIAL_INPUT' });
  });
  it('rejects unknown fields, invalid values, alias conflicts and ambiguous maintenance', () => {
    expect(normalizeFinancialInputs({ management: 101 }).dispositions.management.reason).toBe('INVALID_FINANCIAL_VALUE');
    expect(normalizeFinancialInputs({ unexpected: 10 }).dispositions.unexpected.reason).toBe('NOT_AN_OPERATING_FINANCIAL_INPUT');
    const conflict = normalizeFinancialInputs({ hoa: 5, HOA: 6 });
    expect(conflict.values.HOA).toBeUndefined();
    expect(conflict.dispositions.hoa.reason).toBe('CONFLICTING_FINANCIAL_ALIASES');
    expect(normalizeFinancialInputs({ maintenance: 50, maintenancePercent: 5 }).dispositions.maintenance.reason).toBe('MAINTENANCE_BASIS_REQUIRED');
  });
  it('normalizes scenario aliases before overlaying private assumptions', () => {
    const result = buildFinancialEvidenceFromAuthorizedContext({ propertyId: 'p', privateAssumptions: { management: 5,
      activeScenario: { propertyId: 'p', strategy: 'BUY_AND_HOLD', assumptions: { managementPercent: 8 } } } });
    expect(result.inputs.propertyManagement.value).toBe(8);
  });
});

describe('G2 late rent refresh', () => {
  it('removes the rent evidence decision gap after acquisition, preserving other missing inputs', () => {
    const snapshot = { propertyId: 'p', propertyFacts: { id: 'p', type: 'SFR', objective: 'Buy & Hold', price: 200000 },
      rentalEvidence: {}, dealAssumptions: {}, evidenceCompletenessGate: { assumptions: { targetCondition: 'AS_IS' } } };
    const before = buildDealDecisionContext(snapshot);
    expect(before.decisionGaps.some(gap => gap.field === 'rent_evidence')).toBe(true);
    const stack = buildFinancialEvidenceFromAuthorizedContext({ propertyId: 'p' });
    const rent = { status: 'AVAILABLE', rent: 2200, provider: 'rentcast', evidenceType: 'rent_estimate' };
    const result = refreshReportFinancialEvidence({ intelligenceSnapshot: { ...snapshot, dealDecisionContext: before } }, {
      financialEvidence: stack, financialStrategy: 'Buy & Hold', financialPropertyType: 'SFR', marketRent: { state: 'AVAILABLE', evidence: rent },
    }, 'DEAL_INTELLIGENCE');
    expect(result.intelligenceSnapshot.dealDecisionContext.decisionGaps.some((gap: any) => gap.field === 'rent_evidence')).toBe(false);
    expect(result.intelligenceSnapshot.dealDecisionContext.relationships.rentEstimate).toBe(2200);
    expect(result.structuredAnalysis).toBeDefined();
    expect(result.intelligenceSnapshot.financialReadiness.missingCritical).toContain('currentContractRent');
    expect(result.evidenceCompletenessGate.assumptions.targetCondition).toBe('AS_IS');
    expect(snapshot.rentalEvidence).toEqual({});
  });
});
