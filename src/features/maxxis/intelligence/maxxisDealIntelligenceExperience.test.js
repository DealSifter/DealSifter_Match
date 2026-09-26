import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createReportEntitlement, REPORT_ACCESS_SOURCES, resolveIntelligenceReportAccess } from '../../../domain/intelligenceAccess';
import { buildMaxxisDealIntelligenceReport, projectMaxxisDealIntelligenceResponse } from './maxxisDealIntelligenceReport';

function context({ arvAvailable = true, missing = false, unsafe = false } = {}) {
  return {
    type: 'deal_intelligence_context', propertyId: 'property-1',
    propertyContext: { unknownFields: missing ? ['yearBuilt', 'lotSizeSqft'] : [] },
    evidenceSummary: { strength: 'MEDIUM' },
    matchContext: { score: 75, classification: 'good', calculable: true, semantics: 'PROFILE_FIT_ONLY', reasons: [
      { key: 'market', status: 'matched', detail: 'Property location matches a target market.' },
      { key: 'property_type', status: 'matched', detail: 'Property type matches the configured profile.' },
      { key: 'strategy', status: 'not_evaluated', detail: 'Property objective is missing.' },
    ] },
    valuationContext: arvAvailable
      ? { status: 'ARV_LIMITED', range: { low: 380000, high: 430000 }, centralReference: 405000,
        confidence: 'LOW', compsUsed: 2, methodologyVersion: 'DEALSIFTER_WEIGHTED_ARV_V1', warnings: ['VALUATION_DISPERSION_WARNING'] }
      : { status: 'ARV_UNAVAILABLE', range: { low: 1, high: 2 }, centralReference: 1,
        confidence: 'LOW', compsUsed: 0, methodologyVersion: null, warnings: ['INSUFFICIENT_COMPS'] },
    comparableEvidence: arvAvailable ? [
      { compIdentifier: 'comp-1', address: '100 Example St', recordedSalePrice: 390000, recordedSaleDate: '2026-04-08', distanceMiles: 0.6,
        transactionQuality: 'ARMS_LENGTH_VERIFIED', conditionCompatibility: 'MATCHES_TARGET', structuralComparabilityScore: 88,
        valuationRole: 'PRIMARY', valuationEligibility: 'INCLUDED', inclusionReason: 'CONDITION_MATCH' },
      { compIdentifier: 'comp-2', address: '200 Example St', recordedSaleDate: '2026-03-01', distanceMiles: 1.2,
        transactionQuality: 'UNKNOWN', conditionCompatibility: 'SUPERIOR_TO_TARGET', structuralComparabilityScore: 79,
        valuationRole: 'SUPPORTING', valuationEligibility: 'SUPPORTING_ONLY', exclusionReason: 'SUPERIOR_TO_TARGET' },
      { compIdentifier: 'comp-3', address: '300 Example St', recordedSaleDate: '2025-12-01', distanceMiles: 2.1,
        transactionQuality: 'NON_ARMS_LENGTH', conditionCompatibility: 'UNKNOWN', structuralComparabilityScore: 60,
        valuationRole: 'EXCLUDED', valuationEligibility: 'EXCLUDED', exclusionReason: 'TRANSACTION_NOT_ARMS_LENGTH' },
    ] : [],
    opportunities: [{ code: 'PROFILE_MARKET_MATCH', explanation: 'Property location matches the configured profile.' },
      { code: 'VERIFIED_PROPERTY_EVIDENCE_AVAILABLE', explanation: unsafe ? 'This is a good deal. Buy this property.' : 'Verified property evidence is available for review.' }],
    risks: [{ code: 'UNKNOWN_CONDITION', category: 'DATA_RISK', severity: 'HIGH', explanation: 'Property condition is unknown.' }],
    limitations: missing ? ['rehab_missing', 'property_condition_unknown'] : ['property_condition_unknown'],
    recommendedActions: unsafe ? ['You should buy this property.'] : ['Confirm the target condition before relying on the analysis.'],
    investorContext: { strategies: ['Wholesale'] },
    response: { initialAssessment: unsafe ? 'This is a strong investment.' : 'Based on available evidence, profile alignment is partial and valuation confidence is limited.' },
  };
}

describe('Maxxis Deal Intelligence Experience v1', () => {
  it('allows Enterprise Deal Intelligence', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'enterprise', reportType: 'DEAL_INTELLIGENCE' })).toMatchObject({
      allowed: true, state: 'INCLUDED', accessSource: 'SUBSCRIPTION',
    });
    expect(buildMaxxisDealIntelligenceReport(context())).toMatchObject({
      type: 'maxxis_deal_intelligence_report', reportType: 'DEAL_INTELLIGENCE',
      investmentFit: { score: 75, semantics: 'PROFILE_FIT_ONLY' },
      analysisConfidence: { semantics: 'ANALYSIS_COMPLETENESS_AND_RELIABILITY_ONLY', notPropertyScore: true },
      investorPerspective: { persona: 'WHOLESALER', narrativeOnly: true },
      executiveSummaryIntelligence: { lines: expect.any(Array) },
    });
  });

  it('keeps unknown and not-evaluated criteria out of percentage scoring', () => {
    const input = context();
    input.matchContext.reasons = [
      { key: 'market', status: 'matched', points: 35, maxPoints: 35, detail: 'matched' },
      { key: 'price', status: 'not_matched', points: 0, maxPoints: 25, detail: 'mismatch' },
      { key: 'property_type', status: 'not_evaluated', points: 0, maxPoints: 25, detail: 'unknown' },
      { key: 'strategy', status: 'not_evaluated', points: null, maxPoints: 15, detail: 'unavailable' },
    ];
    const report = buildMaxxisDealIntelligenceReport(input);
    expect(report.investmentFit.criteria.map((criterion) => criterion.score)).toEqual([100, 0, null, null]);
  });

  it('asks Pro without a complete entitlement to unlock instead of exposing premium content', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'pro', reportType: 'DEAL_INTELLIGENCE' })).toMatchObject({
      allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', paidUnlockEnabled: true, nuggetCost: 5,
    });
  });

  it('blocks Free without unlock and accepts an active Nugget entitlement', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: 'DEAL_INTELLIGENCE' }).allowed).toBe(false);
    const entitlement = createReportEntitlement({ reportType: 'DEAL_INTELLIGENCE',
      accessSource: REPORT_ACCESS_SOURCES.NUGGET_UNLOCK, expires: '2030-01-01T00:00:00.000Z' });
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: 'DEAL_INTELLIGENCE',
      entitlements: [entitlement], now: Date.parse('2029-01-01') }).allowed).toBe(true);
  });

  it('keeps unavailable ARV monetary values null even when malformed input contains numbers', () => {
    const report = buildMaxxisDealIntelligenceReport(context({ arvAvailable: false }));
    expect(report.valuationIntelligence).toMatchObject({ status: 'ARV_UNAVAILABLE', range: null, centralReference: null, compsUsed: 0 });
    expect(JSON.stringify(report.valuationIntelligence)).not.toContain('"low":1');
  });

  it('translates valuation engine states before they reach preview, PDF, or email', () => {
    const input = context({ arvAvailable: false });
    input.valuationContext.warnings = ['ARV_EVALUATION_NOT_LOADED', 'INSUFFICIENT_COMPS'];
    const report = buildMaxxisDealIntelligenceReport(input);
    expect(report.valuationIntelligence.warnings).toEqual([
      'A defensible ARV cannot be calculated with the evidence currently available.',
      'There are not enough condition-compatible recorded sales to support a defensible ARV.',
    ]);
    expect(JSON.stringify(report)).not.toMatch(/ARV_EVALUATION_NOT_LOADED|INSUFFICIENT_COMPS/);
  });

  it('preserves missing data explicitly as UNKNOWN', () => {
    const report = buildMaxxisDealIntelligenceReport(context({ missing: true }));
    expect(report.limitations).toEqual(expect.arrayContaining(['yearBuilt: UNKNOWN', 'lotSizeSqft: UNKNOWN']));
    expect(report.investmentFit.strategy.explanation).toBe('Property objective is missing.');
  });

  it('removes recommendation leakage from every projected response field', () => {
    const projected = projectMaxxisDealIntelligenceResponse({ data: { dealIntelligence: context({ unsafe: true }) } });
    expect(JSON.stringify(projected)).not.toMatch(/good deal|great opportunity|strong investment|buy this|should buy|guaranteed return/i);
    expect(projected.analysisExport).toBeNull();
  });

  it('persists the exact IntelligenceSnapshot used to build the report', () => {
    const snapshot = { version: 'MAXXIS_INTELLIGENCE_SNAPSHOT_V1', propertyFacts: { id: 'property-1', address: '100 Snapshot St' } };
    const projected = projectMaxxisDealIntelligenceResponse({ data: {
      dealIntelligence: context(), property: { id: 'property-1' }, intelligenceSnapshot: snapshot,
      runtimeTrace: { propertyEvidence: 'HIT' },
    } });
    expect(projected.data.intelligenceSnapshot).toBe(snapshot);
    expect(projected.data.runtimeTrace).toEqual({ propertyEvidence: 'HIT' });
    expect(projected.data.maxxisReport.sections.propertySummary.data.address).toBe('100 Snapshot St');
  });

  it('combines provider facts with app-authorized owner data for the persisted report', () => {
    const projected = projectMaxxisDealIntelligenceResponse({ data: {
      dealIntelligence: context(),
      intelligenceSnapshot: { propertyFacts: { id: 'property-1', address: '9537 Dalegrove Dr', yearBuilt: 1950 } },
    } }, { reportProperty: {
      id: 'property-1', beds: 3, baths: 2,
      owner: { name: 'Mr. Zen', type: 'FSBO', allowedContacts: [{ type: 'phone', value: '555-0100' }] },
    } });
    expect(projected.data.maxxisReport.sections.propertySummary.data).toMatchObject({
      address: '9537 Dalegrove Dr', yearBuilt: 1950, beds: 3, baths: 2,
      owner: { name: 'Mr. Zen', type: 'FSBO', allowedContacts: [{ value: '555-0100' }] },
    });
  });

  it('binds the same canonical analysis into Enterprise chat projection and persisted report', () => {
    const structuredAnalysis = {
      type: 'maxxis_structured_analysis', executiveSummary: 'Canonical summary.',
      opportunityAssessment: 'Canonical opportunity assessment.', positiveSignals: [], concerns: [],
      missingEvidence: ['Condition is not verified.'], recommendedVerificationSteps: ['Inspect the property.'],
      recommendedActions: [], userFacingDisclaimers: [], riskAnalysis: {},
    };
    const projected = projectMaxxisDealIntelligenceResponse({ data: {
      dealIntelligence: context(), structuredAnalysis,
    } });
    expect(projected.content).toBe(structuredAnalysis.opportunityAssessment);
    expect(projected.data.maxxisDealIntelligence.structuredAnalysis).toBe(structuredAnalysis);
    expect(projected.data.maxxisReport.structuredAnalysis).toBe(structuredAnalysis);
  });

  it('is a pure presentation projector with no engine or provider dependency', () => {
    const source = readFileSync(new URL('./maxxisDealIntelligenceReport.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"].*(?:arvEngine|compEngine|calculatePropertyMatch|dealMetrics|rentcast)/i);
    expect(source).not.toMatch(/\b(?:fetch|supabase|invoke)\s*\(/i);
  });

  it('routes every required premium chat question to the single Deal Intelligence context', () => {
    const router = readFileSync(new URL('../../../../supabase/functions/maxxis-chat/index.ts', import.meta.url), 'utf8');
    for (const question of ['analyze this deal', 'is this property worth looking at', 'what are the risks', 'explain this arv']) {
      expect(router).toContain(`' ${question} '`);
    }
    expect(router).toMatch(/return \{ name: 'getDealInsightContext', args: \{ propertyId: propertyContextId \} \}/);
  });

  it('preserves exact comp roles and values instead of recomputing them', () => {
    const report = buildMaxxisDealIntelligenceReport(context());
    expect(report.comparableEvidence.used[0]).toMatchObject({ address: '100 Example St', salePrice: 390000, distanceMiles: 0.6, similarity: 88, role: 'PRIMARY', sourceType: 'VERIFIED_RECORD' });
    expect(report.comparableEvidence.supporting[0].role).toBe('SUPPORTING');
    expect(report.comparableEvidence.excluded[0].exclusionReason).toBe('TRANSACTION_NOT_ARMS_LENGTH');
  });

  it('keeps Match Score semantics unchanged while adapting only report narrative', () => {
    const wholesale = buildMaxxisDealIntelligenceReport(context());
    const holdInput = context();
    holdInput.investorContext = { strategies: ['Buy and Hold'] };
    const hold = buildMaxxisDealIntelligenceReport(holdInput);
    expect(wholesale.investmentFit).toEqual(hold.investmentFit);
    expect(wholesale.valuationIntelligence).toEqual(hold.valuationIntelligence);
    expect(wholesale.investorPerspective.persona).toBe('WHOLESALER');
    expect(hold.investorPerspective.persona).toBe('BUY_AND_HOLD');
  });
});
