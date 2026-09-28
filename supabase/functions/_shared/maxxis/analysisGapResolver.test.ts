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

  it('keeps rehab optional after target condition is available and exposes benchmark choices', () => {
    const gate = buildEvidenceCompletenessGate({
      reportType: 'DEAL_INTELLIGENCE',
      property: { rehab: null, state: 'CA', sqft: 1680 },
      assumptions: { rehabBudget: null, targetCondition: 'FULL_RENOVATION' },
      language: 'pt',
    });
    expect(gate).toMatchObject({ status: 'READY', complete: true, missingUserInputs: [] });
    expect(gate.inputs.rehabBudget).toBe('USER_RESOLVABLE');
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

  it('does not ask residential condition or rehab questions for vacant land', () => {
    const gate = buildEvidenceCompletenessGate({
      reportType: 'DEAL_INTELLIGENCE',
      property: { type: 'Land', rehab: 0, sqft: null, lot: '1.2 acres' },
      assumptions: { renovationScope: 'é um terreno, não haverá construção' },
      language: 'pt',
    });
    expect(gate).toMatchObject({
      status: 'READY', complete: true, missingUserInputs: [],
      inputs: {
        rehabBudget: 'NOT_APPLICABLE', targetCondition: 'NOT_APPLICABLE',
        acquisitionPlusRehab: 'NOT_APPLICABLE',
      },
      analysisApplicability: { propertyCategory: 'VACANT_LAND', rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE' },
    });
    expect(gate.benchmarkOptions).toEqual([]);
  });
});
