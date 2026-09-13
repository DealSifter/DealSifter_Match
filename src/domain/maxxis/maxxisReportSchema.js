import { INTELLIGENCE_REPORT_TYPES } from '../intelligenceAccess';

export const MAXXIS_REPORT_SCHEMA_VERSION = 'MAXXIS_REPORT_SCHEMA_V1';
export const MAXXIS_REPORT_SOURCE_TYPES = Object.freeze([
  'USER_PROVIDED', 'VERIFIED_RECORD', 'CALCULATED', 'ESTIMATED', 'UNKNOWN',
]);

const REPORT_SECTIONS = Object.freeze([
  'propertySummary', 'executiveSummary', 'investmentProfile', 'propertyEvidence',
  'comparableEvidence', 'valuationEvidence', 'riskAssessment', 'limitations',
  'verificationChecklist', 'provenance',
]);

const LEVEL_SECTIONS = Object.freeze({
  PROPERTY_RELEASE: new Set(['propertySummary', 'provenance']),
  MAXXIS_ANALYSIS: new Set(['propertySummary', 'executiveSummary', 'investmentProfile', 'riskAssessment', 'limitations', 'verificationChecklist', 'provenance']),
  DEAL_INTELLIGENCE: new Set(REPORT_SECTIONS),
});

const PROPERTY_KEYS = Object.freeze([
  'id', 'title', 'address', 'city', 'state', 'zip', 'description', 'type', 'beds',
  'baths', 'sqft', 'lot', 'price', 'images',
]);
const COMPARABLE_KEYS = Object.freeze([
  'compIdentifier', 'address', 'salePrice', 'saleDate', 'distanceMiles', 'similarity',
  'conditionStatus', 'transactionQuality', 'role', 'inclusionReason', 'exclusionReason',
  'sourceType', 'provenance',
]);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sourceType = (value, fallback = 'UNKNOWN') => MAXXIS_REPORT_SOURCE_TYPES.includes(value) ? value : fallback;
const emptySection = () => Object.freeze({ available: false, sourceType: 'UNKNOWN', data: null });
const section = (data, source, available = data !== null && data !== undefined) => available
  ? Object.freeze({ available: true, sourceType: sourceType(source), data })
  : emptySection();

function propertySummary(property) {
  if (!isObject(property)) return null;
  const data = Object.fromEntries(PROPERTY_KEYS
    .filter((key) => Object.hasOwn(property, key))
    .map((key) => [key, property[key] === undefined ? null : property[key]]));
  return Object.keys(data).length ? Object.freeze(data) : null;
}

function comparableEvidence(value) {
  if (!isObject(value)) return null;
  const select = (items) => Object.freeze((Array.isArray(items) ? items : []).map((item) => Object.freeze(
    Object.fromEntries(COMPARABLE_KEYS.filter((key) => Object.hasOwn(item || {}, key)).map((key) => [key, item[key]])),
  )));
  return Object.freeze({ used: select(value.used), supporting: select(value.supporting), excluded: select(value.excluded) });
}

function valuationEvidence(value) {
  if (!isObject(value)) return null;
  const status = ['ARV_AVAILABLE', 'ARV_LIMITED', 'ARV_UNAVAILABLE'].includes(value.status)
    ? value.status : 'ARV_UNAVAILABLE';
  const available = status !== 'ARV_UNAVAILABLE';
  return Object.freeze({
    status,
    range: available && isObject(value.range) ? Object.freeze({ low: value.range.low ?? null, high: value.range.high ?? null }) : null,
    centralReference: available ? (value.centralReference ?? null) : null,
    confidence: ['LOW', 'MODERATE', 'HIGH'].includes(value.confidence) ? value.confidence : 'LOW',
    compsUsed: Number.isFinite(Number(value.compsUsed)) ? Math.max(0, Number(value.compsUsed)) : 0,
    methodology: value.methodology || null,
    warnings: Object.freeze(Array.isArray(value.warnings) ? [...value.warnings] : []),
    source: available ? 'CALCULATED' : 'UNKNOWN',
  });
}

function pagesFor(reportType) {
  if (reportType !== INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE) return Object.freeze([]);
  return Object.freeze([
    Object.freeze({ page: 1, code: 'EXECUTIVE_INVESTMENT_BRIEF', sections: ['propertySummary', 'executiveSummary', 'investmentProfile'] }),
    Object.freeze({ page: 2, code: 'PROPERTY_EVIDENCE_SUMMARY', sections: ['propertySummary', 'propertyEvidence', 'provenance'] }),
    Object.freeze({ page: 3, code: 'COMPARABLE_ANALYSIS', sections: ['comparableEvidence'] }),
    Object.freeze({ page: 4, code: 'VALUATION_INTELLIGENCE', sections: ['valuationEvidence', 'limitations'] }),
    Object.freeze({ page: 5, code: 'INVESTOR_REVIEW', sections: ['investmentProfile', 'riskAssessment'] }),
    Object.freeze({ page: 6, code: 'RISKS_AND_VERIFICATION', sections: ['riskAssessment', 'limitations', 'verificationChecklist'] }),
  ]);
}

function levelData(reportType, input) {
  const property = propertySummary(input.property);
  if (reportType === INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE) {
    return {
      propertySummary: section(property, 'USER_PROVIDED'),
      provenance: section({ propertySummary: 'USER_PROVIDED' }, 'USER_PROVIDED'),
    };
  }
  if (reportType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS) {
    const analysis = isObject(input.maxxisAnalysis) ? input.maxxisAnalysis : {};
    const executive = analysis.executiveSummary || analysis.keyObservations
      ? Object.freeze({ summary: analysis.executiveSummary || null, observations: analysis.keyObservations || null })
      : null;
    return {
      propertySummary: section(property, 'USER_PROVIDED'),
      executiveSummary: section(executive, 'CALCULATED'),
      investmentProfile: section(analysis.profileAlignment || null, 'CALCULATED'),
      riskAssessment: section(analysis.riskAwareness || null, 'CALCULATED'),
      limitations: section(analysis.limitations || null, 'CALCULATED'),
      verificationChecklist: section(analysis.nextSteps || null, 'CALCULATED'),
      provenance: section(analysis.provenance || null, 'CALCULATED'),
    };
  }
  const intelligence = isObject(input.dealIntelligence) ? input.dealIntelligence : {};
  const valuation = valuationEvidence(intelligence.valuationIntelligence);
  const executive = intelligence.executiveDealOverview || intelligence.whyThisPropertyStandsOut
    ? Object.freeze({
      summary: intelligence.executiveDealOverview || null,
      observations: Array.isArray(intelligence.whyThisPropertyStandsOut) ? intelligence.whyThisPropertyStandsOut : [],
    }) : null;
  const checklist = Object.freeze([
    ...(Array.isArray(intelligence.nextVerificationSteps) ? intelligence.nextVerificationSteps : []),
    'Validate property condition.',
    'Verify title and encumbrances.',
    ...(intelligence.comparableEvidence?.used?.length ? ['Inspect the comparable evidence.'] : []),
    'Confirm all user-provided assumptions.',
  ].filter((item, index, items) => item && items.indexOf(item) === index));
  return {
    propertySummary: section(property, 'USER_PROVIDED'),
    executiveSummary: section(executive, 'CALCULATED'),
    investmentProfile: section(intelligence.investmentFit || null, 'CALCULATED'),
    propertyEvidence: section(intelligence.propertyEvidence || null, 'VERIFIED_RECORD'),
    comparableEvidence: section(comparableEvidence(intelligence.comparableEvidence), 'VERIFIED_RECORD'),
    valuationEvidence: section(valuation, valuation?.status === 'ARV_UNAVAILABLE' ? 'UNKNOWN' : 'CALCULATED'),
    riskAssessment: section(intelligence.riskAnalysis || null, 'CALCULATED'),
    limitations: section(intelligence.limitations || null, 'CALCULATED'),
    verificationChecklist: section(checklist, 'CALCULATED'),
    provenance: section(intelligence.provenance || null, 'CALCULATED'),
  };
}

export function buildMaxxisReportSchema({ reportType, property = null, maxxisAnalysis = null, dealIntelligence = null } = {}) {
  const normalizedType = String(reportType || '').trim().toUpperCase();
  const allowed = LEVEL_SECTIONS[normalizedType];
  if (!allowed) return null;
  const populated = levelData(normalizedType, { property, maxxisAnalysis, dealIntelligence });
  const sections = Object.freeze(Object.fromEntries(REPORT_SECTIONS.map((key) => [
    key,
    allowed.has(key) ? (populated[key] || emptySection()) : emptySection(),
  ])));
  return Object.freeze({
    type: 'maxxis_report_schema',
    version: MAXXIS_REPORT_SCHEMA_VERSION,
    reportType: normalizedType,
    sections,
    pages: pagesFor(normalizedType),
    exportFoundation: Object.freeze({
      pdf: 'PREPARED_NOT_RENDERED',
      email: 'PREPARED_NOT_RENDERED',
      share: 'PREPARED_NOT_RENDERED',
    }),
  });
}

export function buildAuthorizedMaxxisReport(input = {}) {
  const reportType = String(input.reportType || '').trim().toUpperCase();
  const decision = input.accessDecision;
  if (!decision?.allowed || decision.reportType !== reportType) {
    return Object.freeze({ state: 'LOCKED', reportType: reportType || null, report: null });
  }
  const report = buildMaxxisReportSchema(input);
  return Object.freeze({ state: report ? 'AVAILABLE' : 'LOCKED', reportType: reportType || null, report });
}
