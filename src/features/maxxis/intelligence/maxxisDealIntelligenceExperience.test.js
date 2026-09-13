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
    });
  });

  it('asks Pro without a complete entitlement to unlock instead of exposing premium content', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'pro', reportType: 'DEAL_INTELLIGENCE' })).toMatchObject({
      allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', paidUnlockEnabled: false, nuggetCost: null,
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
});
