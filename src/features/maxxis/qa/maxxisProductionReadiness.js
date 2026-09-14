import { INTELLIGENCE_REPORT_TYPES } from '../../../domain/intelligenceAccess';
import { isMatchingReportExportEntitlement } from '../export/reportExportEntitlement';

export const MAXXIS_READINESS_VERSION = 'MAXXIS_PRODUCTION_READINESS_V1';

const BANNED_LANGUAGE = /\b(?:guaranteed|best investment|buy now|certain profit|risk[ -]?free|will make money)\b/i;
const list = (value) => Array.isArray(value) ? value : [];
const available = (schema, key) => Boolean(schema?.sections?.[key]?.available);
const data = (schema, key) => available(schema, key) ? schema.sections[key].data : null;
const finding = (code, valid, detail) => Object.freeze({ code, valid, detail });

export function validateReportIntegrity({ schema, exportEntitlement, channel = 'PDF' } = {}) {
  const reportType = String(schema?.reportType || '').toUpperCase();
  const property = data(schema, 'propertySummary');
  const findings = [
    finding('VALID_SCHEMA', schema?.type === 'maxxis_report_schema', 'A recognized MaxxisReportSchema is required.'),
    finding('PROPERTY_EXISTS', Boolean(property?.id), 'A persisted property identifier is required.'),
    finding('BASIC_PROPERTY_INFORMATION', Boolean(property?.type && (property?.address || property?.title)), 'Property type and address or title are required.'),
    finding('PROVENANCE_AVAILABLE', available(schema, 'provenance'), 'Report provenance is required.'),
    finding('EXPORT_ENTITLEMENT_MATCH', isMatchingReportExportEntitlement(exportEntitlement, reportType, channel), 'Export entitlement must match report type and channel.'),
  ];
  if (reportType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS) {
    findings.push(finding('MAXXIS_CONTEXT_AVAILABLE', available(schema, 'executiveSummary') || available(schema, 'investmentProfile'), 'Maxxis analysis context is required.'));
  }
  if (reportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE) {
    findings.push(finding('EVIDENCE_AVAILABLE', available(schema, 'propertyEvidence'), 'Deal Intelligence requires evidence.'));
    findings.push(finding('VALUATION_HANDLED', available(schema, 'valuationEvidence'), 'Valuation must be explicitly available or unavailable.'));
    findings.push(finding('COMPARABLES_HANDLED', available(schema, 'comparableEvidence'), 'Comparables must be explicitly grouped.'));
  }
  return Object.freeze({ validator: 'ReportIntegrityValidator', valid: findings.every((item) => item.valid), findings: Object.freeze(findings) });
}

function validateArv(schema) {
  const valuation = data(schema, 'valuationEvidence');
  if (!valuation) return finding('ARV_RULES', schema.reportType !== 'DEAL_INTELLIGENCE', 'Valuation is absent outside Deal Intelligence.');
  if (valuation.status === 'ARV_UNAVAILABLE') return finding('ARV_RULES', valuation.range === null && valuation.centralReference === null, 'Unavailable ARV must preserve null values.');
  const rangeValid = Number(valuation.range?.low) > 0 && Number(valuation.range?.high) >= Number(valuation.range?.low);
  return finding('ARV_RULES', rangeValid && Number(valuation.compsUsed) > 0 && ['LOW', 'MODERATE', 'HIGH'].includes(valuation.confidence), 'Displayed ARV requires a valid range, comps and engine confidence.');
}

function validateComps(schema) {
  const comps = data(schema, 'comparableEvidence');
  if (!comps) return finding('COMP_RULES', schema.reportType !== 'DEAL_INTELLIGENCE', 'Comparables are absent outside Deal Intelligence.');
  const used = list(comps.used);
  const supporting = list(comps.supporting);
  const excluded = list(comps.excluded);
  const validRecordedSale = (comp) => Number(comp?.salePrice) > 0 && comp?.saleDate && comp.saleDate !== 'UNKNOWN';
  const identities = (items) => new Set(items.map((item) => item.compIdentifier).filter(Boolean));
  const usedIds = identities(used);
  const crossListed = [...supporting, ...excluded].some((item) => item.compIdentifier && usedIds.has(item.compIdentifier));
  const rolesValid = used.every((item) => item.role === 'PRIMARY' && validRecordedSale(item))
    && supporting.every((item) => item.role === 'SUPPORTING')
    && excluded.every((item) => item.role === 'EXCLUDED');
  return finding('COMP_RULES', rolesValid && !crossListed, 'USED, SUPPORT and EXCLUDED groups must remain valid and disjoint.');
}

function validateKpis(schema) {
  const kpis = schema?.presentation?.kpiScenarios;
  if (schema.reportType !== 'DEAL_INTELLIGENCE') return finding('KPI_RULES', kpis === null, 'KPIs are unavailable outside Deal Intelligence.');
  if (!kpis?.available) return finding('KPI_RULES', Boolean(kpis?.reason) && kpis?.potentialSpread === null && kpis?.projectedRoi === null, 'Insufficient data must remain explicit and null.');
  const inputs = kpis.inputs || {};
  return finding('KPI_RULES', Number(inputs.purchasePrice) > 0 && Number(inputs.rehab) > 0
    && Number(inputs.arvRange?.low) > 0 && Number(inputs.arvRange?.high) >= Number(inputs.arvRange?.low)
    && list(kpis.potentialSpread).length === 3 && list(kpis.projectedRoi).length === 3, 'Scenario KPIs require every minimum input.');
}

function validateLevel(schema) {
  const forbidden = schema.reportType === 'PROPERTY_RELEASE'
    ? ['executiveSummary', 'investmentProfile', 'propertyEvidence', 'comparableEvidence', 'valuationEvidence', 'riskAssessment', 'limitations', 'verificationChecklist']
    : schema.reportType === 'MAXXIS_ANALYSIS' ? ['propertyEvidence', 'comparableEvidence', 'valuationEvidence'] : [];
  return finding('REPORT_LEVEL', forbidden.every((key) => !available(schema, key)), 'Content must not exceed the authorized report level.');
}

function validatePages(schema) {
  const cap = { PROPERTY_RELEASE: 1, MAXXIS_ANALYSIS: 3, DEAL_INTELLIGENCE: 6 }[schema.reportType] || 0;
  return finding('EXPORT_PAGE_LIMIT', schema.pages?.length > 0 && schema.pages.length <= cap, 'Report page count must match its commercial level.');
}

export function validateIntelligenceConsistency({ schema } = {}) {
  if (!schema || schema.type !== 'maxxis_report_schema') return Object.freeze({ validator: 'IntelligenceConsistencyValidator', valid: false, findings: Object.freeze([finding('VALID_SCHEMA', false, 'Schema is required.')]) });
  const languageSafe = !BANNED_LANGUAGE.test(JSON.stringify(schema));
  const findings = [validateArv(schema), validateComps(schema), validateKpis(schema), validateLevel(schema), validatePages(schema), finding('LANGUAGE_SAFETY', languageSafe, 'Prohibited certainty, profit and recommendation language is rejected.')];
  return Object.freeze({ validator: 'IntelligenceConsistencyValidator', valid: findings.every((item) => item.valid), findings: Object.freeze(findings) });
}

export function buildMaxxisCostAudit({ reportType } = {}) {
  const type = String(reportType || '').toUpperCase();
  const deal = type === 'DEAL_INTELLIGENCE';
  return Object.freeze({ type: 'maxxis_cost_audit', reportType: type || null, externalCallsPerformed: 0,
    rentCastCallsPerformed: 0, cacheHitsObserved: null,
    providerDependencies: Object.freeze(deal ? ['PROPERTY_INTELLIGENCE_CACHE', 'RECORDED_SOLD_EVIDENCE_CACHE'] : []),
    reusableSources: Object.freeze(deal ? ['PROPERTY_EVIDENCE', 'ARV_EVALUATION', 'COMPARABLE_SELECTION'] : ['REPORT_SCHEMA']),
    futureNuggetCandidates: Object.freeze(deal ? ['ONE_TIME_REPORT_UNLOCK'] : []), mutation: null });
}

export function assessMaxxisProductionReadiness({ integrity, consistency, security = {}, costAudit } = {}) {
  const categories = Object.freeze({
    Architecture: Boolean(integrity && consistency),
    Security: Boolean(security.rlsVerified && security.payloadFilteringVerified && security.frontendProtectionVerified && security.backendReportEntitlementEnforced),
    DataQuality: Boolean(integrity?.valid && consistency?.valid),
    ReportQuality: Boolean(consistency?.valid),
    CostControl: Boolean(costAudit?.externalCallsPerformed === 0 && costAudit?.rentCastCallsPerformed === 0),
    MonetizationReadiness: Boolean(security.backendReportEntitlementEnforced && security.serverAuthoritativeCommercialAccess),
  });
  const blockers = Object.freeze(Object.entries(categories).filter(([, valid]) => !valid).map(([name]) => name));
  return Object.freeze({ type: 'maxxis_production_readiness', version: MAXXIS_READINESS_VERSION,
    status: blockers.length ? 'NOT_READY' : 'READY', categories, blockers });
}
