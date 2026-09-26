import { describe, expect, it } from 'vitest';
import { parseAnalysisGapAnswer } from './analysisGapAnswer';

describe('natural-language active gap answers', () => {
  it.each([
    ['Use full renovation', 'FULL_RENOVATION'],
    ['O imóvel está pronto para morar', 'TURN_KEY'],
    ['Nova construção', 'NEW_CONSTRUCTION'],
  ])('maps %s to the canonical condition taxonomy', (answer, expected) => {
    expect(parseAnalysisGapAnswer({ data: { missingUserInputs: ['target_condition'] } }, answer))
      .toEqual({ action: 'resolve', values: { targetCondition: expected } });
  });

  it('accepts a typed user budget with USER_PROVIDED provenance', () => {
    expect(parseAnalysisGapAnswer({ data: { missingUserInputs: ['rehab_budget'] } }, 'Use US$ 300,000'))
      .toEqual({ action: 'resolve', values: { rehabBudget: 300000, rehabSource: 'USER_PROVIDED' } });
  });

  it('accepts the available benchmark without inventing a value', () => {
    const message = { data: { missingUserInputs: ['rehab_budget'], assumptions: { targetCondition: 'FULL_RENOVATION' },
      benchmarkOptions: [{ scope: 'FULL_RENOVATION', mid: 302400 }] } };
    expect(parseAnalysisGapAnswer(message, 'Use a referência de 2026')).toEqual({
      action: 'resolve', values: { rehabBudget: 302400, rehabSource: 'USER_CURATED_REHAB_BENCHMARK_2026' },
    });
  });

  it('allows the user to decline and prevents a forced loop', () => {
    expect(parseAnalysisGapAnswer({ data: { missingUserInputs: ['rehab_budget'] } }, 'Continuar com limitações'))
      .toEqual({ action: 'decline', fields: ['rehab_budget'] });
  });
});
