import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTELLIGENCE_REPORT_TYPES, resolveIntelligenceReportAccess } from '../intelligenceAccess';
import { buildAuthorizedMaxxisReport, buildMaxxisReportSchema, MAXXIS_REPORT_SOURCE_TYPES } from './maxxisReportSchema';

const property = Object.freeze({
  id: 'property-1', title: 'Fixture property', address: 'Stored address', city: 'Austin', state: 'TX',
  zip: '78701', description: 'Stored description', type: 'SFR', beds: 3, baths: 2,
  sqft: 1600, lot: null, price: 320000, images: ['stored-image.jpg'], internalSecret: 'never-export',
  owner: { name: 'Stored owner', type: 'FSBO', status: 'ACTIVE', privateEmail: 'never-export@example.test',
    allowedContacts: [{ type: 'email', label: 'Email', value: 'allowed@example.test', internalId: 'never-export' }] },
});

function analysis() {
  return {
    executiveSummary: 'The available information indicates partial profile fit.',
    profileAlignment: { score: 75, semantics: 'PROFILE_FIT_ONLY' },
    riskAwareness: [{ code: 'UNKNOWN_CONDITION', category: 'DATA_RISK', severity: 'MEDIUM' }],
    limitations: ['Property condition is unknown.'], nextSteps: ['Verify property condition.'],
    provenance: { property: 'EXISTING_PROPERTY_CONTEXT' },
  };
}

function intelligence(status = 'ARV_AVAILABLE') {
  const unavailable = status === 'ARV_UNAVAILABLE';
  return {
    executiveDealOverview: 'Evidence-based investment intelligence.',
    investmentFit: { score: 75, semantics: 'PROFILE_FIT_ONLY', strategy: { status: 'matched' } },
    propertyEvidence: { strength: 'MEDIUM', verifiedRecords: [{ field: 'sqft', value: 1600, sourceType: 'VERIFIED_RECORD' }], userProvided: [], unknown: [], conflicts: [] },
    comparableEvidence: { used: unavailable ? [] : [{ compIdentifier: 'comp-1', address: 'Recorded comp', salePrice: 390000, distanceMiles: 0.5, similarity: 88, conditionStatus: 'MATCHES_TARGET', role: 'PRIMARY', sourceType: 'VERIFIED_RECORD', hiddenProviderPayload: 'never-export' }], supporting: [], excluded: [] },
    valuationIntelligence: { status, range: unavailable ? { low: 0, high: 0 } : { low: 380000, high: 430000 }, centralReference: unavailable ? 0 : 405000, confidence: unavailable ? 'LOW' : 'MODERATE', compsUsed: unavailable ? 0 : 1, methodology: unavailable ? null : 'DEALSIFTER_WEIGHTED_ARV_V1', warnings: unavailable ? ['INSUFFICIENT_COMPS'] : [], avm: 999999 },
    riskAnalysis: [{ code: 'UNKNOWN_CONDITION', category: 'DATA_RISK', severity: 'HIGH' }],
    limitations: unavailable ? ['ARV: UNKNOWN'] : [], nextVerificationSteps: ['Validate condition.'],
    provenance: { comparableEvidence: 'COMP_ENGINE', arvEvaluation: 'ARV_ENGINE' },
  };
}

describe('MaxxisReportSchema v2', () => {
  it('TEST 1 exports Property Release from allowlisted user-provided card data only', () => {
    const report = buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', property });
    expect(report).toMatchObject({ version: 'MAXXIS_REPORT_SCHEMA_V2', pages: [{ page: 1, code: 'PROPERTY_OVERVIEW' }] });
    expect(report.sections.propertySummary).toMatchObject({ available: true, sourceType: 'USER_PROVIDED' });
    expect(report.sections.propertySummary.data.internalSecret).toBeUndefined();
    expect(report.sections.propertySummary.data.owner).toEqual({
      name: 'Stored owner', type: 'FSBO', status: 'ACTIVE',
      allowedContacts: [{ type: 'email', label: 'Email', value: 'allowed@example.test' }],
    });
    expect(JSON.stringify(report.sections.propertySummary.data.owner)).not.toContain('privateEmail');
    for (const key of ['executiveSummary', 'propertyEvidence', 'comparableEvidence', 'valuationEvidence', 'riskAssessment']) {
      expect(report.sections[key]).toEqual({ available: false, sourceType: 'UNKNOWN', data: null });
    }
  });

  it('TEST 2 exports Maxxis Analysis without evidence, comps, ARV, or valuation data', () => {
    const report = buildMaxxisReportSchema({ reportType: 'MAXXIS_ANALYSIS', property, maxxisAnalysis: analysis() });
    expect(report.sections.executiveSummary.available).toBe(true);
    expect(report.pages).toHaveLength(3);
    expect(report.sections.executiveSummary.data).toMatchObject({ summary: expect.any(String) });
    expect(report.sections.investmentProfile.data).toMatchObject({ semantics: 'PROFILE_FIT_ONLY' });
    expect(report.sections.propertyEvidence.data).toBeNull();
    expect(report.sections.comparableEvidence.data).toBeNull();
    expect(report.sections.valuationEvidence.data).toBeNull();
  });

  it.each(['ARV_AVAILABLE', 'ARV_LIMITED', 'ARV_UNAVAILABLE'])('TEST 3 supports the Level 3 fixture %s without inventing valuation', (status) => {
    const report = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: intelligence(status) });
    expect(report.pages).toHaveLength(6);
    expect(report.sections.comparableEvidence.available).toBe(true);
    expect(report.exportFoundation).toEqual({ pdf: 'CLIENT_RENDERED', email: 'PREPARED_NOT_RENDERED', share: 'PREPARED_NOT_RENDERED' });
    if (status === 'ARV_UNAVAILABLE') {
      expect(report.sections.valuationEvidence).toMatchObject({ sourceType: 'UNKNOWN', data: { range: null, centralReference: null } });
      expect(JSON.stringify(report.sections.valuationEvidence.data)).not.toContain('"avm"');
      expect(JSON.stringify(report.sections.valuationEvidence.data)).not.toContain('"low":0');
    }
  });

  it('TEST 4 fails closed for Free premium access and returns no report', () => {
    const accessDecision = resolveIntelligenceReportAccess({ plan: 'free', reportType: 'DEAL_INTELLIGENCE' });
    expect(buildAuthorizedMaxxisReport({ reportType: 'DEAL_INTELLIGENCE', accessDecision, property, dealIntelligence: intelligence() }))
      .toEqual({ state: 'LOCKED', reportType: 'DEAL_INTELLIGENCE', report: null });
  });

  it('TEST 5 preserves the Pro upgrade flow without enabling a paid unlock', () => {
    const accessDecision = resolveIntelligenceReportAccess({ plan: 'pro', reportType: 'DEAL_INTELLIGENCE' });
    expect(accessDecision).toMatchObject({ allowed: false, state: 'NUGGET_UNLOCK_REQUIRED', nuggetCost: 5, paidUnlockEnabled: true });
    expect(buildAuthorizedMaxxisReport({ reportType: 'DEAL_INTELLIGENCE', accessDecision, property, dealIntelligence: intelligence() }).report).toBeNull();
  });

  it('TEST 6 allows Enterprise to build the complete Level 3 contract', () => {
    const accessDecision = resolveIntelligenceReportAccess({ plan: 'enterprise', reportType: 'DEAL_INTELLIGENCE' });
    const result = buildAuthorizedMaxxisReport({ reportType: 'DEAL_INTELLIGENCE', accessDecision, property, dealIntelligence: intelligence() });
    expect(result.state).toBe('AVAILABLE');
    expect(result.report.sections.valuationEvidence.available).toBe(true);
  });

  it('TEST 7 keeps source ownership explicit and UNKNOWN intact', () => {
    const report = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: intelligence('ARV_UNAVAILABLE') });
    expect(MAXXIS_REPORT_SOURCE_TYPES).toEqual(['USER_PROVIDED', 'VERIFIED_RECORD', 'CALCULATED', 'ESTIMATED', 'UNKNOWN']);
    expect(report.sections.propertySummary.sourceType).toBe('USER_PROVIDED');
    expect(report.sections.propertyEvidence.sourceType).toBe('VERIFIED_RECORD');
    expect(report.sections.valuationEvidence.sourceType).toBe('UNKNOWN');
  });

  it('TEST 8 strips non-contract provider fields from comparable evidence', () => {
    const report = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: intelligence() });
    expect(report.sections.comparableEvidence.data.used[0].hiddenProviderPayload).toBeUndefined();
    expect(report.sections.comparableEvidence.data.used[0].salePrice).toBe(390000);
  });

  it('TEST 9 has no provider, network, payment, or calculation-engine dependency', () => {
    const source = readFileSync(new URL('./maxxisReportSchema.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\b(?:fetch|supabase|rentcast|stripe|debit|invoke)\b/i);
    expect(source).not.toMatch(/from ['"].*(?:arvEngine|compEngine|dealMetrics|calculatePropertyMatch)/i);
    expect(INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE).toBe('DEAL_INTELLIGENCE');
  });

  it('TEST 10 normalizes app lat/lng coordinates for report maps', () => {
    const report = buildMaxxisReportSchema({
      reportType: 'PROPERTY_RELEASE',
      property: { ...property, lat: 28.5653, lng: -81.5862 },
    });
    expect(report.sections.propertySummary.data).toMatchObject({
      latitude: 28.5653,
      longitude: -81.5862,
    });
  });
});
