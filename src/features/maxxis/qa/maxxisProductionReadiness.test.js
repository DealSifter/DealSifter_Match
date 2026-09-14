import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { resolveReportExportEntitlement } from '../export/reportExportEntitlement';
import { assessMaxxisProductionReadiness, buildMaxxisCostAudit, validateIntelligenceConsistency, validateReportIntegrity } from './maxxisProductionReadiness';

const property = { id: 'property-1', address: '100 Stored St', type: 'SFR', price: 250000, rehab: 50000 };
const provenance = { propertyEvidence: 'PROPERTY_INTELLIGENCE', arvEvaluation: 'ARV_ENGINE' };

function deal(overrides = {}) {
  return { executiveDealOverview: 'Based on available evidence, verification is recommended.',
    propertyEvidence: { verifiedRecords: [{ field: 'sqft' }], userProvided: [], unknown: [], conflicts: [] },
    investmentFit: { score: 70 },
    comparableEvidence: { used: [{ compIdentifier: 'comp-1', salePrice: 390000, saleDate: '2026-04-08', role: 'PRIMARY' }], supporting: [], excluded: [] },
    valuationIntelligence: { status: 'ARV_LIMITED', range: { low: 380000, high: 420000 }, centralReference: 400000, confidence: 'MODERATE', compsUsed: 1 },
    riskAnalysis: [], limitations: [], nextVerificationSteps: ['Additional due diligence required.'], provenance,
    ...overrides };
}

const schema = (reportType, input = {}) => buildMaxxisReportSchema({ reportType, property,
  maxxisAnalysis: input.maxxisAnalysis || { executiveSummary: 'Based on available evidence.', profileAlignment: { score: 70 }, provenance },
  dealIntelligence: input.dealIntelligence || deal() });
const exportAccess = (plan, reportType) => resolveReportExportEntitlement({ plan, reportType, channel: 'PDF' });

describe('Maxxis Investor Report QA + Production Readiness v1', () => {
  it.each([['free', 'PROPERTY_RELEASE'], ['pro', 'MAXXIS_ANALYSIS'], ['enterprise', 'DEAL_INTELLIGENCE']])('accepts valid plan/report integrity for %s', (plan, reportType) => {
    expect(validateReportIntegrity({ schema: schema(reportType), exportEntitlement: exportAccess(plan, reportType) })).toMatchObject({ validator: 'ReportIntegrityValidator', valid: true });
  });

  it('fails report integrity for missing property identity, provenance or entitlement', () => {
    const invalid = buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', property: { type: 'SFR', title: 'Draft' } });
    const result = validateReportIntegrity({ schema: invalid, exportEntitlement: exportAccess('free', 'PROPERTY_RELEASE') });
    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PROPERTY_EXISTS', valid: false })]));
    expect(validateReportIntegrity({ schema: schema('DEAL_INTELLIGENCE'), exportEntitlement: exportAccess('pro', 'DEAL_INTELLIGENCE') }).valid).toBe(false);
  });

  it('preserves unavailable ARV as null and rejects fabricated unavailable values', () => {
    const valid = schema('DEAL_INTELLIGENCE', { dealIntelligence: deal({ valuationIntelligence: { status: 'ARV_UNAVAILABLE', range: { low: 1, high: 2 }, centralReference: 1, compsUsed: 0 } }) });
    expect(valid.sections.valuationEvidence.data).toMatchObject({ status: 'ARV_UNAVAILABLE', range: null, centralReference: null });
    expect(validateIntelligenceConsistency({ schema: valid }).valid).toBe(true);
  });

  it('rejects invalid USED comps and preserves required report grouping', () => {
    const invalid = schema('DEAL_INTELLIGENCE', { dealIntelligence: deal({ comparableEvidence: { used: [{ compIdentifier: 'bad', salePrice: null, saleDate: 'UNKNOWN', role: 'PRIMARY' }], supporting: [], excluded: [] } }) });
    const result = validateIntelligenceConsistency({ schema: invalid });
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'COMP_RULES', valid: false })]));
  });

  it('allows KPI scenarios only with minimum inputs and keeps insufficient values null', () => {
    const valid = schema('DEAL_INTELLIGENCE');
    expect(validateIntelligenceConsistency({ schema: valid }).findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'KPI_RULES', valid: true })]));
    const insufficient = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property: { ...property, rehab: null }, dealIntelligence: deal() });
    expect(insufficient.presentation.kpiScenarios).toMatchObject({ available: false, potentialSpread: null, projectedRoi: null });
    expect(validateIntelligenceConsistency({ schema: insufficient }).valid).toBe(true);
  });

  it('blocks prohibited certainty and sales language', () => {
    const unsafe = schema('MAXXIS_ANALYSIS', { maxxisAnalysis: { executiveSummary: 'Guaranteed certain profit.', profileAlignment: { score: 70 }, provenance } });
    expect(validateIntelligenceConsistency({ schema: unsafe }).findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'LANGUAGE_SAFETY', valid: false })]));
  });

  it('enforces level content and page caps for Free, Pro and Enterprise schemas', () => {
    for (const reportType of ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']) {
      const findings = validateIntelligenceConsistency({ schema: schema(reportType) }).findings;
      expect(findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'REPORT_LEVEL', valid: true }), expect.objectContaining({ code: 'EXPORT_PAGE_LIMIT', valid: true })]));
    }
    expect(schema('PROPERTY_RELEASE').sections.valuationEvidence.available).toBe(false);
    expect(schema('MAXXIS_ANALYSIS').sections.comparableEvidence.available).toBe(false);
  });

  it('records zero provider calls and reusable cached dependencies without executing anything', () => {
    expect(buildMaxxisCostAudit({ reportType: 'DEAL_INTELLIGENCE' })).toMatchObject({ externalCallsPerformed: 0, rentCastCallsPerformed: 0, mutation: null,
      providerDependencies: ['PROPERTY_INTELLIGENCE_CACHE', 'RECORDED_SOLD_EVIDENCE_CACHE'] });
  });

  it('marks commercial activation NOT READY while backend report-level enforcement is not wired', () => {
    const backendRuntime = readFileSync(new URL('../../../../supabase/functions/maxxis-chat/index.ts', import.meta.url), 'utf8');
    const backendContract = readFileSync(new URL('../../../../supabase/functions/_shared/maxxis/intelligenceAccess.ts', import.meta.url), 'utf8');
    const migration = readFileSync(new URL('../../../../supabase/migrations/20260910120000_property_intelligence_entitlements.sql', import.meta.url), 'utf8');
    expect(backendContract).toContain('resolveIntelligenceReportAccess');
    expect(backendRuntime).not.toMatch(/from ['"].*maxxis\/intelligenceAccess\.ts/);
    expect(migration).toMatch(/enable row level security/i);
    const reportSchema = schema('DEAL_INTELLIGENCE');
    const integrity = validateReportIntegrity({ schema: reportSchema, exportEntitlement: exportAccess('enterprise', 'DEAL_INTELLIGENCE') });
    const consistency = validateIntelligenceConsistency({ schema: reportSchema });
    const readiness = assessMaxxisProductionReadiness({ integrity, consistency, costAudit: buildMaxxisCostAudit({ reportType: 'DEAL_INTELLIGENCE' }), security: {
      rlsVerified: true, payloadFilteringVerified: true, frontendProtectionVerified: true,
      backendReportEntitlementEnforced: false, serverAuthoritativeCommercialAccess: false,
    } });
    expect(readiness).toMatchObject({ status: 'NOT_READY', blockers: expect.arrayContaining(['Security', 'MonetizationReadiness']) });
  });

  it('returns READY only when every validation and server-authoritative security gate passes', () => {
    const reportSchema = schema('DEAL_INTELLIGENCE');
    const readiness = assessMaxxisProductionReadiness({
      integrity: validateReportIntegrity({ schema: reportSchema, exportEntitlement: exportAccess('enterprise', 'DEAL_INTELLIGENCE') }),
      consistency: validateIntelligenceConsistency({ schema: reportSchema }), costAudit: buildMaxxisCostAudit({ reportType: 'DEAL_INTELLIGENCE' }),
      security: { rlsVerified: true, payloadFilteringVerified: true, frontendProtectionVerified: true, backendReportEntitlementEnforced: true, serverAuthoritativeCommercialAccess: true },
    });
    expect(readiness).toMatchObject({ status: 'READY', blockers: [] });
  });
});
