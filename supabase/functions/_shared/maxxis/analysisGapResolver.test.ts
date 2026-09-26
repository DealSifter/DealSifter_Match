import { describe, expect, it } from 'vitest';
import { buildEvidenceCompletenessGate } from './analysisGapResolver.ts';

describe('EvidenceCompletenessGate', () => {
  it('reuses stored rehab and does not ask for it', () => {
    const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: 300000 }, assumptions: { targetCondition: 'AS_IS' } });
    expect(gate.status).toBe('READY');
    expect(gate.missingUserInputs).not.toContain('rehab_budget');
  });

  it('asks for the target condition first when condition and rehab are missing', () => {
    const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: 0 }, assumptions: {}, language: 'pt' });
    expect(gate.missingUserInputs).toEqual(['target_condition']);
    expect(gate.question).toMatch(/condição alvo/i);
  });

  it('asks for rehab only after the target condition is available and exposes mapped benchmark choices', () => {
    const gate = buildEvidenceCompletenessGate({
      reportType: 'DEAL_INTELLIGENCE',
      property: { rehab: null, state: 'CA', sqft: 1680 },
      assumptions: { rehabBudget: null, targetCondition: 'FULL_RENOVATION' },
      language: 'pt',
    });
    expect(gate.missingUserInputs).toEqual(['rehab_budget']);
    expect(gate.question).toMatch(/orçamento de reforma/i);
    expect(gate.benchmarkOptions.find((item) => item?.scope === 'FULL_RENOVATION')).toMatchObject({
      low: 241920, mid: 302400, high: 362880, providerCalls: 0,
    });
  });

  it('accepts explicit zero rehab with USER_PROVIDED provenance', () => {
    const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: 0 }, assumptions: { rehabBudget: 0, targetCondition: 'TURN_KEY' } });
    expect(gate.status).toBe('READY');
    expect(gate.assumptions).toMatchObject({ rehabBudget: 0, provenance: 'USER_PROVIDED' });
  });

  it('continues with explicit limitations after the user declines', () => {
    const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: null }, assumptions: { declinedInputs: ['rehab_budget', 'target_condition'] } });
    expect(gate.status).toBe('LIMITED');
    expect(gate.complete).toBe(true);
  });

  it('does not repeat a resolved or declined question', () => {
    const resolved = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: null },
      assumptions: { targetCondition: 'FULL_RENOVATION', rehabBudget: 250000 } });
    const declined = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: null },
      assumptions: { targetCondition: 'FULL_RENOVATION', declinedInputs: ['rehab_budget'] } });
    expect(resolved).toMatchObject({ status: 'READY', missingUserInputs: [] });
    expect(declined).toMatchObject({ status: 'LIMITED', complete: true, missingUserInputs: [] });
  });
});
