import { describe, expect, it } from 'vitest';
import { buildReportPreflight } from './reportCompletion';
import { refreshReportFinancialEvidence } from './refreshReportFinancialEvidence';
import { buildFinancialEvidenceStack } from './financialEvidence';

const propertyId = '11111111-1111-4111-8111-111111111111';
const userId = 'reviewer-a';
const propertyFacts = { id: propertyId, type: 'SFR', objective: 'Buy and Hold', price: 200000 };
function report() {
  // The first unknown choice persists a disposition before any confirmed input.
  const dealAssumptions = { r3Completion: { unknown: { rent: { status: 'UNKNOWN' } } } };
  const preflight = buildReportPreflight({ reportType: 'DEAL_INTELLIGENCE', propertyId, userId,
    property: propertyFacts, dealAssumptions, revision: 1 });
  return { state: 'available', intelligenceSnapshot: { propertyId, propertyFacts, analysisRevision: 1,
    dealAssumptions: { ...dealAssumptions, activeScenario: preflight.scenario } } };
}
const evidence = { financialEvidence: buildFinancialEvidenceStack({ propertyId, candidates: [] }) };

describe('financial evidence refresh after first unknown choice', () => {
  it('keeps the authenticated identity when completion has no confirmed inputs yet', () => {
    const result = refreshReportFinancialEvidence(report(), evidence, 'DEAL_INTELLIGENCE', 'en', userId);
    expect(result.intelligenceSnapshot.dealAssumptions.activeScenario).toMatchObject({ propertyId, userId });
    expect(result.intelligenceSnapshot.dealAssumptions.r3Completion.unknown.rent.status).toBe('UNKNOWN');
  });

  it('still rejects a scenario belonging to another authenticated reviewer', () => {
    expect(() => refreshReportFinancialEvidence(report(), evidence, 'DEAL_INTELLIGENCE', 'en', 'reviewer-b'))
      .toThrow('SCENARIO_IDENTITY_MISMATCH');
  });
});
