import { describe, expect, it } from 'vitest';
import { buildEvidenceCompletenessGate } from './analysisGapResolver.ts';

describe('EvidenceCompletenessGate', () => {
  it('reuses stored rehab and does not ask for it', () => {
    const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: 300000 }, assumptions: { targetCondition: 'AS_IS' } });
    expect(gate.status).toBe('READY');
    expect(gate.missingUserInputs).not.toContain('rehab_budget');
  });

  it('asks only for missing user-resolvable inputs', () => {
    const gate = buildEvidenceCompletenessGate({ reportType: 'DEAL_INTELLIGENCE', property: { rehab: 0 }, assumptions: {}, language: 'pt' });
    expect(gate.missingUserInputs).toEqual(['rehab_budget', 'target_condition']);
    expect(gate.question).toMatch(/condição alvo.*orçamento de reforma/i);
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
});
