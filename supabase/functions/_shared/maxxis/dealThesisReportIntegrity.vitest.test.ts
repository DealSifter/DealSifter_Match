import { describe, expect, it } from 'vitest';
import { buildDealThesis } from './dealThesis.ts';
import type { DealDecisionContext } from './dealDecisionContext.ts';

const context = (relationships: DealDecisionContext['relationships'] = {}): DealDecisionContext => ({
  type: 'deal_decision_context', version: 'DEAL_DECISION_CONTEXT_V1', strategy: 'BUY_AND_HOLD',
  verifiedEvidence: [], userAssumptions: [], calculatedMetrics: [], marketReferences: [],
  relationships, evidenceCoverage: {}, decisionGaps: [], scenariosPossible: [], scenariosBlocked: [],
});

describe('deal thesis presentation null and unavailable numeric semantics', () => {
  it.each(['en', 'pt', 'es'])('never invents zero financial claims from absent relationships in %s', language => {
    const thesis = buildDealThesis(context({ providerEstimate: null, reportedCapRate: null,
      baseCost: null, rehabBudget: null, rehabPerSqft: null }), language);
    expect(thesis.supportingEvidence).toEqual([]);
    expect(thesis.contraryEvidence).toEqual([]);
    expect(JSON.stringify(thesis)).not.toMatch(/\$\s*0|0%|0[.,]00/);
  });

  it.each([null, '', ' ', 'not available', 0, -1])('requires positive provider estimates, rejects %j', value => {
    expect(buildDealThesis(context({ providerEstimate: value })).contraryEvidence).toEqual([]);
  });

  it.each([null, '', ' ', 'not available', 0, -1, 100])('does not assert cap rate without a valid reported value: %j', value => {
    const thesis = buildDealThesis(context({ reportedCapRate: value }));
    expect(thesis.contraryEvidence).toEqual([]);
    expect(thesis.summary).toContain('a calculated cap rate is not yet available');
  });

  it('preserves positive provider estimates with qualification and nonzero reported cap rate', () => {
    const thesis = buildDealThesis(context({ providerEstimate: 225000, reportedCapRate: 5.5 }), 'en');
    expect(thesis.contraryEvidence.join(' ')).toContain('$225,000');
    expect(thesis.contraryEvidence.join(' ')).toContain('not a DealSifter ARV');
    expect(thesis.contraryEvidence.join(' ')).toContain('5.5%');
    expect(thesis.summary).toContain('reported, not calculated from NOI');
  });
});
