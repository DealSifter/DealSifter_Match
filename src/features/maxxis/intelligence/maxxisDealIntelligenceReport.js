import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildMaxxisAnalysisConfidence, buildMaxxisExecutiveSummaryIntelligence, resolveMaxxisInvestorPersona } from './maxxisReportConfidencePersona';

export const MAXXIS_DEAL_INTELLIGENCE_REPORT_VERSION = 'MAXXIS_DEAL_INTELLIGENCE_REPORT_V1';

const RECOMMENDATION_PATTERN = /\b(?:good deal|great opportunity|strong investment|buy this|should buy|recommend(?:ed|ing)? (?:a )?purchase|guaranteed? return)\b/i;
const VALID_SOURCES = new Set(['VERIFIED_RECORD', 'USER_PROVIDED', 'CALCULATED']);
const VALID_RISKS = new Set(['DATA_RISK', 'MARKET_RISK', 'VALUATION_RISK', 'EXECUTION_RISK']);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const list = (value) => Array.isArray(value) ? value : [];
const safeText = (value) => {
  const text = String(value || '').trim();
  return text && !RECOMMENDATION_PATTERN.test(text) ? text : '';
};
const nullableNumber = (value) => value === null || value === undefined || value === ''
  ? null
  : Number.isFinite(Number(value)) ? Number(value) : null;
const unique = (values) => [...new Set(values.filter(Boolean))];

function signalSource(code) {
  if (String(code).startsWith('VERIFIED_')) return 'VERIFIED_RECORD';
  if (String(code).startsWith('PROFILE_') || String(code).includes('VALUATION')) return 'CALCULATED';
  return 'USER_PROVIDED';
}

function standoutSignals(context) {
  return Object.freeze(list(context?.opportunities).map((signal) => ({
    code: safeText(signal?.code),
    explanation: safeText(signal?.explanation),
    source: signalSource(signal?.code),
  })).filter((signal) => signal.code && signal.explanation && VALID_SOURCES.has(signal.source)).slice(0, 6).map(Object.freeze));
}

function propertyEvidence(context) {
  const fields = isObject(context?.propertyContext?.fields) ? context.propertyContext.fields : {};
  const evidenceField = (name) => Object.freeze({
    field: name,
    value: fields[name]?.value ?? null,
    sourceType: ['VERIFIED_RECORD', 'USER_PROVIDED', 'UNKNOWN'].includes(fields[name]?.status)
      ? fields[name].status
      : 'UNKNOWN',
    source: safeText(fields[name]?.source) || null,
  });
  return Object.freeze({
    strength: safeText(context?.evidenceSummary?.strength) || 'LOW',
    verifiedRecords: Object.freeze(list(context?.propertyContext?.verifiedFields).map(evidenceField)),
    userProvided: Object.freeze(list(context?.propertyContext?.userProvidedFields).map(evidenceField)),
    unknown: Object.freeze(list(context?.propertyContext?.unknownFields).map(evidenceField)),
    conflicts: Object.freeze(list(context?.evidenceSummary?.conflicts).map((conflict) => Object.freeze({
      field: safeText(conflict?.field) || 'UNKNOWN',
      severity: safeText(conflict?.severity) || 'UNKNOWN',
    }))),
  });
}

function investmentFit(context) {
  const match = isObject(context?.matchContext) ? context.matchContext : null;
  const reason = (key) => {
    const item = list(match?.reasons).find((candidate) => candidate?.key === key);
    return Object.freeze({
      status: ['matched', 'not_matched', 'not_evaluated'].includes(item?.status) ? item.status : 'not_evaluated',
      explanation: safeText(item?.detail) || 'UNKNOWN',
      source: 'CALCULATED',
    });
  };
  return Object.freeze({
    score: nullableNumber(match?.score),
    classification: safeText(match?.classification) || 'unavailable',
    calculable: Boolean(match?.calculable),
    semantics: 'PROFILE_FIT_ONLY',
    requiredMessage: 'Match Score indicates profile compatibility, not investment quality.',
    targetMarket: reason('market'),
    strategy: reason('strategy'),
    propertyType: reason('property_type'),
  });
}

function valuationIntelligence(context) {
  const valuation = isObject(context?.valuationContext) ? context.valuationContext : {};
  const status = ['ARV_AVAILABLE', 'ARV_LIMITED', 'ARV_UNAVAILABLE'].includes(valuation.status)
    ? valuation.status
    : 'ARV_UNAVAILABLE';
  const range = status !== 'ARV_UNAVAILABLE' && isObject(valuation.range)
    && nullableNumber(valuation.range.low) !== null && nullableNumber(valuation.range.high) !== null
    ? Object.freeze({ low: Number(valuation.range.low), high: Number(valuation.range.high) })
    : null;
  const providerEstimate = isObject(valuation.providerEstimate)
    && nullableNumber(valuation.providerEstimate.value) !== null
    ? Object.freeze({
        value: Number(valuation.providerEstimate.value),
        status: safeText(valuation.providerEstimate.status) || 'PROVIDER_ESTIMATE_UNVALIDATED',
        provenance: 'ESTIMATED',
      })
    : null;
  return Object.freeze({
    status,
    range,
    centralReference: status === 'ARV_UNAVAILABLE' ? null : nullableNumber(valuation.centralReference),
    confidence: ['LOW', 'MODERATE', 'HIGH'].includes(valuation.confidence) ? valuation.confidence : 'LOW',
    compsUsed: Math.max(0, nullableNumber(valuation.compsUsed) ?? 0),
    methodology: safeText(valuation.methodologyVersion) || null,
    warnings: Object.freeze(unique(list(valuation.warnings).map(safeText)).slice(0, 8)),
    source: status === 'ARV_UNAVAILABLE' ? 'UNKNOWN' : 'CALCULATED',
    providerEstimate,
  });
}

function comparableItem(comp) {
  return Object.freeze({
    compIdentifier: safeText(comp?.compIdentifier) || null,
    address: safeText(comp?.address) || 'UNKNOWN',
    salePrice: nullableNumber(comp?.recordedSalePrice),
    saleDate: safeText(comp?.recordedSaleDate) || 'UNKNOWN',
    distanceMiles: nullableNumber(comp?.distanceMiles),
    similarity: nullableNumber(comp?.structuralComparabilityScore),
    conditionStatus: safeText(comp?.conditionCompatibility) || 'UNKNOWN',
    transactionQuality: safeText(comp?.transactionQuality) || 'UNKNOWN',
    role: safeText(comp?.valuationRole) || (comp?.valuationEligibility === 'INCLUDED' ? 'PRIMARY'
      : comp?.valuationEligibility === 'SUPPORTING_ONLY' ? 'SUPPORTING' : 'EXCLUDED'),
    inclusionReason: safeText(comp?.inclusionReason) || null,
    exclusionReason: safeText(comp?.exclusionReason) || null,
    beds: nullableNumber(comp?.beds),
    baths: nullableNumber(comp?.baths),
    sqft: nullableNumber(comp?.sqft),
    latitude: nullableNumber(comp?.latitude),
    longitude: nullableNumber(comp?.longitude),
    sourceType: 'VERIFIED_RECORD',
    provenance: 'VERIFIED_RECORD',
  });
}

function comparableEvidence(context) {
  const items = list(context?.comparableEvidence).map(comparableItem);
  return Object.freeze({
    used: Object.freeze(items.filter((item) => item.role === 'PRIMARY').slice(0, 5)),
    supporting: Object.freeze(items.filter((item) => item.role === 'SUPPORTING').slice(0, 3)),
    excluded: Object.freeze(items.filter((item) => item.role === 'EXCLUDED').slice(0, 3)),
  });
}

function riskAnalysis(context) {
  return Object.freeze(list(context?.risks).map((risk) => ({
    code: safeText(risk?.code),
    category: String(risk?.category || ''),
    severity: ['LOW', 'MEDIUM', 'HIGH'].includes(risk?.severity) ? risk.severity : 'MEDIUM',
    reason: safeText(risk?.explanation),
  })).filter((risk) => risk.code && risk.reason && VALID_RISKS.has(risk.category)).slice(0, 8).map(Object.freeze));
}

function limitations(context, valuation, comps) {
  const values = list(context?.limitations).map(safeText);
  list(context?.propertyContext?.unknownFields).forEach((field) => values.push(`${field}: UNKNOWN`));
  if (valuation.status === 'ARV_UNAVAILABLE') values.push('ARV: UNKNOWN — the existing engine did not produce a value.');
  if (!comps.used.length) values.push('Verified sold comparables used by the existing evaluation: NONE.');
  values.push('This analysis is limited to the evidence and deterministic engine outputs currently available in DealSifter.');
  return Object.freeze(unique(values).slice(0, 12));
}

function nextVerificationSteps(context) {
  const steps = unique(list(context?.recommendedActions).map(safeText));
  if (!steps.length) steps.push('Review the underlying evidence and confirm that the available inputs are current.');
  return Object.freeze(steps.slice(0, 6));
}

function overview(context, valuation) {
  const existing = safeText(context?.response?.initialAssessment);
  if (existing) return existing;
  const evidence = safeText(context?.evidenceSummary?.strength) || 'LOW';
  return valuation.status === 'ARV_UNAVAILABLE'
    ? `Based on available evidence, the evidence strength is ${evidence} and the existing ARV result is unavailable.`
    : `Based on available evidence, the evidence strength is ${evidence} and the existing ARV result has ${valuation.confidence.toLowerCase()} confidence.`;
}

export function buildMaxxisDealIntelligenceReport(context) {
  if (!isObject(context) || context.type !== 'deal_intelligence_context') return null;
  const valuation = valuationIntelligence(context);
  const comps = comparableEvidence(context);
  const analysisConfidence = buildMaxxisAnalysisConfidence(context);
  const investorPerspective = resolveMaxxisInvestorPersona(context.investorContext);
  const executiveSummaryIntelligence = buildMaxxisExecutiveSummaryIntelligence(context, analysisConfidence, investorPerspective);
  return Object.freeze({
    type: 'maxxis_deal_intelligence_report',
    version: MAXXIS_DEAL_INTELLIGENCE_REPORT_VERSION,
    reportType: 'DEAL_INTELLIGENCE',
    propertyId: String(context.propertyId || '').trim() || null,
    executiveDealOverview: overview(context, valuation),
    whyThisPropertyStandsOut: standoutSignals(context),
    propertyEvidence: propertyEvidence(context),
    investmentFit: investmentFit(context),
    valuationIntelligence: valuation,
    comparableEvidence: comps,
    riskAnalysis: riskAnalysis(context),
    limitations: limitations(context, valuation, comps),
    nextVerificationSteps: nextVerificationSteps(context),
    analysisConfidence,
    investorPerspective,
    executiveSummaryIntelligence,
    provenance: Object.freeze({
      propertyEvidence: 'PROPERTY_INTELLIGENCE',
      comparableEvidence: 'COMP_ENGINE',
      arvEvaluation: 'ARV_ENGINE',
      investmentProfile: 'INVESTMENT_PROFILE',
      matchContext: 'EXISTING_MATCH_ENGINE',
      dealMetrics: 'EXISTING_DEAL_METRICS',
      riskContext: 'EXISTING_RISK_CONTEXT',
      analyticalPolicy: 'MAXXIS_ANALYTICAL_INTERACTION',
    }),
    exportCompatibility: Object.freeze({ structured: true, pdfRendered: false, emailRendered: false }),
  });
}

export function projectMaxxisDealIntelligenceResponse(result = {}) {
  const report = buildMaxxisDealIntelligenceReport(result?.data?.dealIntelligence);
  if (!report) return null;
  const intelligenceSnapshot = isObject(result?.data?.intelligenceSnapshot)
    ? result.data.intelligenceSnapshot : null;
  const property = isObject(intelligenceSnapshot?.propertyFacts)
    ? intelligenceSnapshot.propertyFacts : result?.data?.property;
  const maxxisReport = buildMaxxisReportSchema({
    reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: report,
    dealMetrics: result?.data?.metrics,
  });
  return Object.freeze({
    type: 'maxxis_deal_intelligence',
    content: report.executiveDealOverview,
    data: Object.freeze({
      maxxisDealIntelligence: report,
      maxxisReport,
      intelligenceSnapshot,
      runtimeTrace: isObject(result?.data?.runtimeTrace) ? result.data.runtimeTrace : null,
    }),
    analysisExport: null,
  });
}
