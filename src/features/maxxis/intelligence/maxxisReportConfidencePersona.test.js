import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildMaxxisAnalysisConfidence,
  buildMaxxisExecutiveSummaryIntelligence,
  resolveMaxxisInvestorPersona,
} from './maxxisReportConfidencePersona';

const NOW = Date.parse('2026-09-14T00:00:00.000Z');

function context(overrides = {}) {
  return {
    propertyContext: { verifiedFields: ['sqft', 'beds', 'baths'], userProvidedFields: ['price'], unknownFields: ['condition', 'rehab'] },
    evidenceSummary: { verifiedFieldCount: 3, userProvidedFieldCount: 1, unknownFieldCount: 2, conflictCount: 0 },
    comparableEvidence: [
      { valuationRole: 'PRIMARY', structuralComparabilityScore: 88, distanceMiles: 0.6, transactionQuality: 'ARMS_LENGTH_VERIFIED', recordedSaleDate: '2026-04-08' },
      { valuationRole: 'SUPPORTING', structuralComparabilityScore: 78, distanceMiles: 1.2, transactionQuality: 'UNKNOWN', recordedSaleDate: '2026-03-01' },
    ],
    valuationContext: { status: 'ARV_LIMITED', confidence: 'MODERATE', warnings: ['SCENARIO_BASED'], compsUsed: 2 },
    matchContext: { score: 75, semantics: 'PROFILE_FIT_ONLY', reasons: [{ key: 'market', status: 'matched' }] },
    limitations: ['property_condition_unknown', 'rehab_missing'],
    recommendedActions: ['Verify property condition and renovation assumptions.'],
    ...overrides,
  };
}

describe('Maxxis report confidence and investor persona v1', () => {
  it('defines confidence only as analysis completeness and reliability', () => {
    const result = buildMaxxisAnalysisConfidence(context(), { now: NOW });
    expect(result).toMatchObject({ semantics: 'ANALYSIS_COMPLETENESS_AND_RELIABILITY_ONLY', notPropertyScore: true });
    expect(result.components.map((item) => item.code)).toEqual([
      'EVIDENCE_COMPLETENESS', 'COMPARABLE_STRENGTH', 'VALUATION_CONFIDENCE', 'DATA_FRESHNESS', 'MISSING_INFORMATION_IMPACT',
    ]);
    expect(JSON.stringify(result)).not.toMatch(/good deal|bad deal|investment score|guaranteed|recommend(?:ed)? (?:to )?(?:buy|sell)/i);
  });

  it('keeps unavailable inputs unknown instead of inventing values', () => {
    const result = buildMaxxisAnalysisConfidence(context({
      propertyContext: {}, evidenceSummary: {}, comparableEvidence: [],
      valuationContext: { status: 'ARV_UNAVAILABLE' }, limitations: [],
    }), { now: NOW });
    expect(result.components.filter((item) => ['EVIDENCE_COMPLETENESS', 'COMPARABLE_STRENGTH', 'VALUATION_CONFIDENCE', 'DATA_FRESHNESS'].includes(item.code)))
      .toEqual(expect.arrayContaining([expect.objectContaining({ score: null, status: 'UNKNOWN' })]));
    expect(result.classification).toBe('LIMITED');
  });

  it('adapts narrative by persona without changing calculations', () => {
    const before = buildMaxxisAnalysisConfidence(context(), { now: NOW });
    const wholesaler = resolveMaxxisInvestorPersona({ strategies: ['Wholesale'] });
    const holder = resolveMaxxisInvestorPersona({ strategies: ['Buy and Hold'] });
    const after = buildMaxxisAnalysisConfidence(context(), { now: NOW });
    expect(wholesaler).toMatchObject({ persona: 'WHOLESALER', narrativeOnly: true });
    expect(holder).toMatchObject({ persona: 'BUY_AND_HOLD', narrativeOnly: true });
    expect(wholesaler.priorities).not.toEqual(holder.priorities);
    expect(wholesaler.message).not.toBe(holder.message);
    expect(after).toEqual(before);
  });

  it.each([
    [{ strategies: ['Fix & Flip'] }, 'FLIPPER'],
    [{ taxDealObjectives: ['Tax Deed'] }, 'TAX_DEED_INVESTOR'],
  ])('recognizes supported investor perspectives', (profile, expected) => {
    expect(resolveMaxxisInvestorPersona(profile).persona).toBe(expected);
  });

  it('creates a factual six-line executive summary with uncertainty and next verification', () => {
    const input = context();
    const confidence = buildMaxxisAnalysisConfidence(input, { now: NOW });
    const summary = buildMaxxisExecutiveSummaryIntelligence(input, confidence, resolveMaxxisInvestorPersona({ strategies: ['Wholesale'] }));
    expect(summary.lines).toHaveLength(6);
    expect(summary.lines.join(' ')).toMatch(/Based on available evidence/i);
    expect(summary.lines.join(' ')).toMatch(/uncertainty/i);
    expect(summary.lines.join(' ')).toMatch(/Next verification priority/i);
    expect(summary.lines.join(' ')).not.toMatch(/good deal|buy this|sell this|guaranteed|expected return/i);
  });

  it('has no engine, provider, network, Nuggets or Stripe dependency', () => {
    const source = readFileSync(new URL('./maxxisReportConfidencePersona.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"].*(?:arvEngine|compEngine|matchScore|rentcast|nugget|stripe)/i);
    expect(source).not.toMatch(/\b(?:fetch|supabase|invoke)\s*\(/i);
  });
});
