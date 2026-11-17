import { buildDealDecisionContext } from './dealDecisionContext.ts';
import { buildMaxxisStructuredAnalysis } from './maxxisStructuredAnalysis.ts';
import { buildFinancialInputReadiness } from './financialReadiness.ts';
import { buildEvidenceCompletenessGate } from './analysisGapResolver.ts';
import { buildReportPreflight } from './reportCompletion.ts';

/** Reproject the report after late financial acquisition. Pure: never acquires data. */
export function refreshReportFinancialEvidence<T extends Record<string, any>>(report: T, evidence: Record<string, any>, reportType: unknown, language = 'en') {
  const previous = report.intelligenceSnapshot;
  const rentAvailable = evidence.marketRent?.state === 'AVAILABLE' && evidence.marketRent?.evidence?.status === 'AVAILABLE';
  const snapshot = { ...previous,
    financialEvidence: evidence.financialEvidence,
    marketRent: evidence.marketRent || null,
    rentalEvidence: { ...previous.rentalEvidence, ...(rentAvailable ? { rentEstimate: evidence.marketRent.evidence } : {}) },
    providerMarketContext: { ...previous.providerMarketContext, ...(rentAvailable ? { rentEstimate: evidence.marketRent.evidence } : {}) },
    financialReadiness: buildFinancialInputReadiness(evidence.financialEvidence, { strategy: evidence.financialStrategy, propertyType: evidence.financialPropertyType }),
  };
  // The user-condition gate stays independent from market rent and keeps declines.
  const gate = buildEvidenceCompletenessGate({ reportType: String(reportType || ''), property: snapshot.propertyFacts,
    assumptions: previous.evidenceCompletenessGate?.assumptions || {}, language });
  snapshot.dealIntelligence = { ...previous.dealIntelligence,
    providerMarketContext: snapshot.providerMarketContext,
    financialEvidence: snapshot.financialEvidence, financialReadiness: snapshot.financialReadiness };
  snapshot.evidenceCompletenessGate = gate;
  const completion = previous.dealAssumptions?.r3Completion;
  if (completion) {
    const preflight = buildReportPreflight({ reportType: String(reportType || 'DEAL_INTELLIGENCE'),
      property: snapshot.propertyFacts, dealAssumptions: previous.dealAssumptions,
      propertyId: snapshot.propertyId, userId: completion.userId, revision: previous.analysisRevision || 0,
      targetCondition: gate.assumptions.targetCondition, evidence: snapshot, language });
    snapshot.dealAssumptions = { ...previous.dealAssumptions, activeScenario: preflight.scenario };
  }
  snapshot.dealDecisionContext = buildDealDecisionContext(snapshot);
  return { ...report, dealIntelligence: snapshot.dealIntelligence, intelligenceSnapshot: snapshot, evidenceCompletenessGate: gate,
    structuredAnalysis: buildMaxxisStructuredAnalysis(snapshot, reportType, language) };
}
