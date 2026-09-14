import { describe, expect, it } from 'vitest';
import { createReportEntitlement, REPORT_ACCESS_SOURCES, resolveIntelligenceReportAccess } from '../../../domain/intelligenceAccess';
import { normalizeMaxxisResponsePayload } from '../../../domain/maxxis/responseTypes';
import { buildMaxxisAnalysisReport, projectMaxxisAnalysisResponse } from './maxxisAnalysisReport';

function context() {
  return {
    type: 'deal_intelligence_context',
    propertyId: 'property-1',
    propertyContext: { fields: {
      address: { value: null, status: 'UNKNOWN', source: null },
      city: { value: 'Austin', status: 'USER_PROVIDED', source: 'DealSifter' },
      state: { value: 'TX', status: 'USER_PROVIDED', source: 'DealSifter' },
      zipCode: { value: '78701', status: 'USER_PROVIDED', source: 'DealSifter' },
      propertyType: { value: 'Single Family', status: 'VERIFIED_RECORD', source: 'public_record' },
      bedrooms: { value: 3, status: 'VERIFIED_RECORD', source: 'public_record' },
      bathrooms: { value: 2, status: 'USER_PROVIDED', source: 'DealSifter' },
      livingAreaSqft: { value: 1600, status: 'VERIFIED_RECORD', source: 'public_record' },
      lotSizeSqft: { value: null, status: 'UNKNOWN', source: null },
      yearBuilt: { value: null, status: 'UNKNOWN', source: null },
      askingPrice: { value: 320000, status: 'USER_PROVIDED', source: 'DealSifter' },
    } },
    investorContext: { provenance: 'USER_PROVIDED' },
    matchContext: { score: 75, classification: 'good', semantics: 'PROFILE_FIT_ONLY', reasons: [
      { key: 'market', status: 'matched', detail: 'Property location matches a target market.' },
      { key: 'price', status: 'matched', detail: 'Property price is inside the configured range.' },
      { key: 'property_type', status: 'matched', detail: 'Property type matches the configured profile.' },
      { key: 'strategy', status: 'not_evaluated', detail: 'Comparable strategy or property objective is missing.' },
    ] },
    dealMetrics: { metrics: {
      pricePerSqft: { value: 200, calculable: true, source: 'calculated' },
      acquisitionPlusRehab: { value: null, calculable: false },
      capRate: { value: null, calculable: false },
    } },
    fitAnalysis: {
      positiveFactors: ['Property location matches a target market.'],
      negativeFactors: ['Comparable strategy or property objective is missing.'],
    },
    risks: [
      { code: 'UNKNOWN_PROPERTY_FIELDS', category: 'DATA_RISK', severity: 'MEDIUM', explanation: 'Some property fields remain unknown.' },
      { code: 'ARV_EVIDENCE_LIMITED', category: 'VALUATION_RISK', severity: 'HIGH', explanation: 'ARV and comps are limited.' },
    ],
    limitations: ['rehab_not_provided', 'ARV_EVALUATION_NOT_LOADED', 'roi_not_calculated'],
    valuationContext: { status: 'ARV_AVAILABLE', range: { low: 400000, high: 500000 } },
    comparableEvidence: [{ address: 'Forbidden comp address', recordedSalePrice: 450000 }],
  };
}

describe('Maxxis Analysis Report Experience v1', () => {
  it('allows a Pro user to receive the structured Level 2 report', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'pro', reportType: 'MAXXIS_ANALYSIS' }).allowed).toBe(true);
    expect(buildMaxxisAnalysisReport(context())).toMatchObject({
      type: 'maxxis_analysis_report', reportType: 'MAXXIS_ANALYSIS',
      profileAlignment: { score: 75, semantics: 'PROFILE_FIT_ONLY' },
      exportCompatibility: { structured: true, pdfRendered: false },
    });
  });

  it('preserves the authenticated deal-insight payload through the client response boundary', () => {
    const payload = { type: 'deal_insight', propertyId: 'property-1', state: 'available', dealIntelligence: context() };
    expect(normalizeMaxxisResponsePayload('deal_insight', payload)).toEqual({ type: 'deal_insight', data: payload });
    expect(normalizeMaxxisResponsePayload('deal_insight', { propertyId: 'property-1' })).toEqual({ type: 'text', data: null });
  });

  it('blocks Free without a report entitlement', () => {
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: 'MAXXIS_ANALYSIS' })).toMatchObject({
      allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', nuggetCost: 3, paidUnlockEnabled: false,
    });
  });

  it('allows Free with an active Nugget unlock entitlement without charging in this flow', () => {
    const entitlement = createReportEntitlement({
      reportType: 'MAXXIS_ANALYSIS', accessSource: REPORT_ACCESS_SOURCES.NUGGET_UNLOCK,
      expires: '2030-01-01T00:00:00.000Z',
    });
    expect(resolveIntelligenceReportAccess({ plan: 'free', reportType: 'MAXXIS_ANALYSIS',
      entitlements: [entitlement], now: Date.parse('2029-01-01') })).toMatchObject({
      allowed: true, state: 'ENTITLED', accessSource: 'NUGGET_UNLOCK', nuggetCost: 0,
    });
  });

  it('does not leak Level 3 data through content, keys, risks, or hidden response data', () => {
    const projected = projectMaxxisAnalysisResponse({ type: 'deal_insight', answer: 'ARV is $450k',
      data: { dealIntelligence: context(), unrelated: { valuation: 1 } } });
    const serialized = JSON.stringify(projected);
    expect(serialized).not.toMatch(/\b(?:arv|comps?|comparables?|valuation|mao|roi)\b/i);
    expect(projected.data.maxxisAnalysisReport).toBeTruthy();
    expect(projected.data.maxxisReport).toMatchObject({
      reportType: 'MAXXIS_ANALYSIS',
      sections: {
        propertyEvidence: { available: false, data: null },
        comparableEvidence: { available: false, data: null },
        valuationEvidence: { available: false, data: null },
      },
    });
    const authorizedValues = Object.values(projected.data.maxxisReport.sections)
      .filter((section) => section.available).map((section) => section.data);
    expect(JSON.stringify(authorizedValues)).not.toMatch(/\b(?:arv|comps?|comparables?|valuation|mao|roi)\b/i);
    expect(projected.analysisExport).toBeNull();
  });

  it('preserves absent fields as UNKNOWN/null without inventing values', () => {
    const report = buildMaxxisAnalysisReport(context());
    expect(report.propertyHighlights.unknown).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'address', value: null, status: 'UNKNOWN', source: null }),
      expect.objectContaining({ field: 'yearBuilt', value: null, status: 'UNKNOWN', source: null }),
    ]));
    expect(report.propertyHighlights.unknown.every((field) => field.value === null)).toBe(true);
  });

  it('uses existing deterministic outputs and identifies the analytical policy without recalculating engines', () => {
    const report = buildMaxxisAnalysisReport(context());
    expect(report.keyObservations.positives).toContain('Existing deterministic price per square foot: $200.');
    expect(report.provenance).toMatchObject({
      match: 'DETERMINISTIC_PROFILE_FIT', dealMetrics: 'EXISTING_DETERMINISTIC_ENGINE',
      analyticalPolicy: 'MAXXIS_ANALYTICAL_INTERACTION',
    });
    expect(report.executiveSummary).not.toMatch(/great opportunity|good investment|buy|guarantee/i);
  });
});
