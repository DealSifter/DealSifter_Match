import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';

export const MAXXIS_ANALYSIS_REPORT_VERSION = 'MAXXIS_ANALYSIS_REPORT_V1';

const ALLOWED_RISK_CATEGORIES = new Set(['DATA_RISK', 'MARKET_RISK', 'EXECUTION_RISK']);
const LEVEL_THREE_PATTERN = /\b(?:arv|comps?|comparables?|valuation|mao|roi)\b/i;
const FIELD_LABELS = Object.freeze({
  address: 'Address',
  city: 'City',
  state: 'State',
  zipCode: 'ZIP code',
  propertyType: 'Property type',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  livingAreaSqft: 'Living area (sqft)',
  lotSizeSqft: 'Lot size (sqft)',
  yearBuilt: 'Year built',
  askingPrice: 'Asking price',
});

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const list = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(values.filter(Boolean))];
const safeText = (value) => {
  const text = String(value || '').trim();
  return text && !LEVEL_THREE_PATTERN.test(text) ? text : '';
};

function highlightEntry(key, rawField = {}) {
  const status = ['VERIFIED_RECORD', 'USER_PROVIDED', 'UNKNOWN'].includes(rawField?.status)
    ? rawField.status
    : 'UNKNOWN';
  const hasValue = rawField?.value !== null && rawField?.value !== undefined && rawField?.value !== '';
  return Object.freeze({
    field: key,
    label: FIELD_LABELS[key] || key,
    value: status === 'UNKNOWN' || !hasValue ? null : rawField.value,
    status: status === 'UNKNOWN' || !hasValue ? 'UNKNOWN' : status,
    source: status === 'UNKNOWN' || !hasValue ? null : (safeText(rawField?.source) || null),
  });
}

function propertyHighlights(context) {
  const fields = isObject(context?.propertyContext?.fields) ? context.propertyContext.fields : {};
  const entries = Object.keys(FIELD_LABELS).map((key) => highlightEntry(key, fields[key]));
  return Object.freeze({
    verified: Object.freeze(entries.filter((entry) => entry.status === 'VERIFIED_RECORD')),
    userProvided: Object.freeze(entries.filter((entry) => entry.status === 'USER_PROVIDED')),
    unknown: Object.freeze(entries.filter((entry) => entry.status === 'UNKNOWN')),
  });
}

function alignmentItem(match, key, label) {
  const reason = list(match?.reasons).find((item) => item?.key === key);
  const status = reason?.status === 'matched'
    ? 'ALIGNED'
    : reason?.status === 'not_matched' ? 'NOT_ALIGNED' : 'UNKNOWN';
  return Object.freeze({
    label,
    status,
    explanation: safeText(reason?.detail) || (status === 'UNKNOWN' ? 'This alignment could not be evaluated from the available information.' : null),
  });
}

function profileAlignment(context) {
  const match = isObject(context?.matchContext) ? context.matchContext : null;
  return Object.freeze({
    semantics: 'PROFILE_FIT_ONLY',
    score: Number.isFinite(Number(match?.score)) ? Number(match.score) : null,
    profileFitClassification: safeText(match?.classification) || 'unavailable',
    targetMarket: alignmentItem(match, 'market', 'Target market'),
    propertyType: alignmentItem(match, 'property_type', 'Property type'),
    strategy: alignmentItem(match, 'strategy', 'Strategy'),
  });
}

function metricObservations(context) {
  const metrics = isObject(context?.dealMetrics?.metrics) ? context.dealMetrics.metrics : {};
  const observations = [];
  const pricePerSqft = metrics.pricePerSqft;
  const acquisitionPlusRehab = metrics.acquisitionPlusRehab;
  const capRate = metrics.capRate;
  if (pricePerSqft?.calculable && Number.isFinite(Number(pricePerSqft.value))) {
    observations.push(`Existing deterministic price per square foot: $${Number(pricePerSqft.value).toLocaleString('en-US')}.`);
  }
  if (acquisitionPlusRehab?.calculable && Number.isFinite(Number(acquisitionPlusRehab.value))) {
    observations.push(`Existing deterministic acquisition plus rehabilitation amount: $${Number(acquisitionPlusRehab.value).toLocaleString('en-US')}.`);
  }
  if (capRate?.calculable && Number.isFinite(Number(capRate.value))) {
    observations.push(`Stored capitalization rate: ${Number(capRate.value).toLocaleString('en-US')}%.`);
  }
  return observations;
}

function keyObservations(context, highlights) {
  const positive = unique([
    ...list(context?.fitAnalysis?.positiveFactors).map(safeText),
    ...metricObservations(context),
  ]).slice(0, 6);
  const attention = unique([
    ...list(context?.fitAnalysis?.negativeFactors).map(safeText),
    ...highlights.unknown.map((entry) => `${entry.label} is unknown.`),
  ]).slice(0, 8);
  return Object.freeze({
    positives: Object.freeze(unique(positive).slice(0, 6)),
    attention: Object.freeze(attention),
  });
}

function riskAwareness(context) {
  return Object.freeze(list(context?.risks)
    .filter((risk) => ALLOWED_RISK_CATEGORIES.has(String(risk?.category || '')))
    .map((risk) => ({
      code: safeText(risk?.code),
      category: String(risk?.category || ''),
      severity: ['LOW', 'MEDIUM', 'HIGH'].includes(risk?.severity) ? risk.severity : 'MEDIUM',
      explanation: safeText(risk?.explanation),
    }))
    .filter((risk) => risk.code && risk.explanation)
    .slice(0, 6)
    .map(Object.freeze));
}

function limitations(context, highlights, alignment) {
  const values = list(context?.limitations).map(safeText);
  if (highlights.unknown.length) values.push(`${highlights.unknown.length} property field(s) remain unknown.`);
  if (alignment.score === null) values.push('Investment Profile fit could not be calculated from the available information.');
  values.push('Match Score measures Investment Profile fit only; it is not a deal score or investment grade.');
  values.push('This analysis is decision support, not an appraisal, brokerage opinion, purchase recommendation, or return guarantee.');
  return Object.freeze(unique(values).slice(0, 8));
}

function nextSteps(highlights, alignment) {
  const steps = [];
  if (highlights.unknown.length) {
    steps.push(`Confirm or complete: ${highlights.unknown.slice(0, 5).map((entry) => entry.label).join(', ')}.`);
  }
  if (alignment.targetMarket.status !== 'ALIGNED') steps.push('Review the property location against the configured target markets.');
  if (alignment.propertyType.status !== 'ALIGNED') steps.push('Review the property type against the configured Investment Profile.');
  if (alignment.strategy.status !== 'ALIGNED') steps.push('Review the stated property objective against the configured strategies.');
  if (!steps.length) steps.push('Review the underlying property fields and profile criteria before deciding on any action.');
  return Object.freeze(unique(steps).slice(0, 5));
}

function executiveSummary(highlights, alignment) {
  const knownCount = highlights.verified.length + highlights.userProvided.length;
  if (alignment.score === null) {
    return `${knownCount} property field(s) are available, but Investment Profile fit cannot currently be evaluated.`;
  }
  return `The available information indicates ${alignment.score}% Investment Profile fit across the criteria that could be evaluated.`;
}

export function buildMaxxisAnalysisReport(dealIntelligence) {
  if (!isObject(dealIntelligence) || dealIntelligence.type !== 'deal_intelligence_context') return null;
  const highlights = propertyHighlights(dealIntelligence);
  const alignment = profileAlignment(dealIntelligence);
  const report = {
    type: 'maxxis_analysis_report',
    version: MAXXIS_ANALYSIS_REPORT_VERSION,
    reportType: 'MAXXIS_ANALYSIS',
    propertyId: String(dealIntelligence.propertyId || '').trim() || null,
    executiveSummary: executiveSummary(highlights, alignment),
    propertyHighlights: highlights,
    profileAlignment: alignment,
    keyObservations: keyObservations(dealIntelligence, highlights),
    riskAwareness: riskAwareness(dealIntelligence),
    limitations: limitations(dealIntelligence, highlights, alignment),
    nextSteps: nextSteps(highlights, alignment),
    provenance: Object.freeze({
      property: 'EXISTING_PROPERTY_CONTEXT',
      investmentProfile: dealIntelligence.investorContext?.provenance === 'USER_PROVIDED' ? 'USER_PROVIDED' : 'UNKNOWN',
      match: alignment.score === null ? 'UNKNOWN' : 'DETERMINISTIC_PROFILE_FIT',
      dealMetrics: dealIntelligence.dealMetrics ? 'EXISTING_DETERMINISTIC_ENGINE' : 'UNKNOWN',
      analyticalPolicy: 'MAXXIS_ANALYTICAL_INTERACTION',
    }),
    exportCompatibility: Object.freeze({ structured: true, pdfRendered: false }),
  };
  return Object.freeze(report);
}

export function projectMaxxisAnalysisResponse(result = {}) {
  const report = buildMaxxisAnalysisReport(result?.data?.dealIntelligence);
  if (!report) return null;
  const maxxisReport = buildMaxxisReportSchema({
    reportType: 'MAXXIS_ANALYSIS', property: result?.data?.property, maxxisAnalysis: report,
  });
  return Object.freeze({
    type: 'maxxis_analysis_report',
    content: report.executiveSummary,
    data: Object.freeze({ maxxisAnalysisReport: report, maxxisReport }),
    analysisExport: null,
  });
}
