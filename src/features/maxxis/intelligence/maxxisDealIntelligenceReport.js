import { buildMaxxisReportSchema, mergeMaxxisReportProperty } from '../../../domain/maxxis/maxxisReportSchema';
import { buildMaxxisAnalysisConfidence, buildMaxxisExecutiveSummaryIntelligence, resolveMaxxisInvestorPersona } from './maxxisReportConfidencePersona';
import { explainMaxxisEvidenceList, explainMaxxisEvidenceState } from './maxxisUserFacingEvidence';
import { buildCanonicalInvestmentAnalysis } from './canonicalInvestmentAnalysis';
import { describeStoredMarketReference } from '../presentation/evidenceFreshnessPresentation';

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

function valuationIntelligence(context, language = 'en') {
  const valuation = isObject(context?.valuationContext) ? context.valuationContext : {};
  const market = isObject(context?.providerMarketContext) ? context.providerMarketContext : {};
  const recent = isObject(market.recentSalesMarketEstimate) ? market.recentSalesMarketEstimate : null;
  const status = ['ARV_AVAILABLE', 'ARV_LIMITED', 'ARV_UNAVAILABLE', 'NOT_APPLICABLE'].includes(valuation.status)
    ? valuation.status
    : 'ARV_UNAVAILABLE';
  const range = !['ARV_UNAVAILABLE', 'NOT_APPLICABLE'].includes(status) && isObject(valuation.range)
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
    evidenceFreshness: market.evidenceFreshness || null,
    savedRecentSalesReference: market.savedRecentSalesReference || null,
    range,
    centralReference: ['ARV_UNAVAILABLE', 'NOT_APPLICABLE'].includes(status) ? null : nullableNumber(valuation.centralReference),
    confidence: ['LOW', 'MODERATE', 'HIGH'].includes(valuation.confidence) ? valuation.confidence : 'LOW',
    compsUsed: Math.max(0, nullableNumber(valuation.compsUsed) ?? 0),
    methodology: safeText(valuation.methodologyVersion) || null,
    warnings: Object.freeze(unique([describeStoredMarketReference(market.savedRecentSalesReference, language), ...list(valuation.warnings).map(explainMaxxisEvidenceState).map(safeText)]).slice(0, 8)),
    source: status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : status === 'ARV_UNAVAILABLE' ? 'UNKNOWN' : 'CALCULATED',
    providerEstimate,
    recentSalesMarketEstimate: recent ? Object.freeze({
      methodology: 'RECENT_SALES_MARKET_ESTIMATE', status: recent.status,
      referenceState: market.evidenceFreshness?.sold?.state === 'STALE_USABLE' ? 'STALE_CALCULATED_REFERENCE' : 'CURRENT_CALCULATED_REFERENCE',
      retrievedAt: market.evidenceFreshness?.sold?.retrievedAt || null,
      centralEstimate: nullableNumber(recent.centralEstimate),
      range: isObject(recent.range) ? Object.freeze({ low: nullableNumber(recent.range.low), high: nullableNumber(recent.range.high) }) : null,
      weightedUnitValue: nullableNumber(recent.weightedUnitValue),
      weightedLotPricePerSqft: nullableNumber(recent.weightedLotPricePerSqft),
      unitMetric: safeText(recent.unitMetric) || null,
      qualifyingSalesCount: Math.max(0, nullableNumber(recent.qualifyingSalesCount) || 0),
      valuationCompCount: Math.max(0, nullableNumber(recent.valuationCompCount) || 0),
      confidence: ['LOW', 'MODERATE', 'HIGH'].includes(recent.confidence) ? recent.confidence : 'LOW',
      confidenceReasons: Object.freeze(list(recent.confidenceReasons).map(safeText).filter(Boolean)),
      dispersion: isObject(recent.dispersion) ? Object.freeze({ ...recent.dispersion }) : null,
      conditionAdjustmentStatus: 'CONDITION_NOT_ADJUSTED',
      providerAvmCompatibility: safeText(recent.providerAvmCompatibility) || 'UNKNOWN',
      valuationComps: Object.freeze(list(recent.valuationComps).slice(0, 5).map((item) => Object.freeze({ ...item }))),
      marketReferenceOutliers: Object.freeze(list(recent.marketReferenceOutliers).slice(0, 5).map((item) => Object.freeze({ ...item }))),
    }) : null,
    providerEstimateDivergence: nullableNumber(market.providerEstimateDivergence),
    activeSaleListings: Object.freeze(list(market.saleListings?.records).slice(0, 10).map((item) => Object.freeze({ ...item }))),
    marketData: isObject(market.market) ? Object.freeze({ ...market.market }) : null,
    rentalEvidence: Object.freeze({
      rentEstimate: isObject(market.rentEstimate) ? Object.freeze({ ...market.rentEstimate }) : null,
      rentalListings: Object.freeze(list(market.rentalListings?.records).slice(0, 10).map((item) => Object.freeze({ ...item }))),
    }),
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
    candidateCondition: safeText(comp?.candidateCondition) || 'UNKNOWN',
    conditionEvidenceSource: safeText(comp?.conditionEvidenceSource) || null,
    promotionBlockers: Object.freeze(list(comp?.promotionBlockers).map(safeText).filter(Boolean)),
    transactionQuality: safeText(comp?.transactionQuality) || 'UNKNOWN',
    role: safeText(comp?.valuationRole) || (comp?.valuationEligibility === 'INCLUDED' ? 'PRIMARY'
      : comp?.valuationEligibility === 'SUPPORTING_ONLY' ? 'SUPPORTING' : 'EXCLUDED'),
    inclusionReason: safeText(comp?.inclusionReason) || null,
    exclusionReason: safeText(comp?.exclusionReason) || null,
    beds: nullableNumber(comp?.beds),
    baths: nullableNumber(comp?.baths),
    sqft: nullableNumber(comp?.sqft),
    lotSizeSqft: nullableNumber(comp?.lotSizeSqft),
    yearBuilt: nullableNumber(comp?.yearBuilt),
    providerCorrelation: nullableNumber(comp?.providerCorrelation),
    saleAgeDays: nullableNumber(comp?.saleAgeDays),
    compClass: comp?.valuationEligibility === 'INCLUDED' ? 'CONFIRMED'
      : comp?.valuationEligibility === 'SUPPORTING_ONLY' ? 'SUPPORTING' : 'MARKET_REFERENCE',
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
    supporting: Object.freeze(items.filter((item) => item.role === 'SUPPORTING').slice(0, 5)),
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
  const values = explainMaxxisEvidenceList(context?.limitations).map(safeText);
  list(context?.propertyContext?.unknownFields).forEach((field) => values.push(`${field}: UNKNOWN`));
  if (valuation.status === 'ARV_UNAVAILABLE') values.push('ARV: UNKNOWN — the existing engine did not produce a value.');
  if (!comps.used.length && comps.supporting.length) values.push(`No comparable sale currently meets all ARV eligibility criteria. ${comps.supporting.length} structurally relevant sale${comps.supporting.length === 1 ? '' : 's'} are retained as supporting market evidence.`);
  else if (!comps.used.length) values.push('Verified sold comparables used by the existing evaluation: NONE.');
  values.push('This analysis is limited to the evidence and deterministic engine outputs currently available in DealSifter.');
  return Object.freeze(unique(values).slice(0, 12));
}

function nextVerificationSteps(context) {
  const steps = unique(list(context?.recommendedActions).map(explainMaxxisEvidenceState).map(safeText));
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

export function buildMaxxisDealIntelligenceReport(context, structuredAnalysis = null, snapshotOrFacts = null) {
  if (!isObject(context) || context.type !== 'deal_intelligence_context') return null;
  const canonical = isObject(structuredAnalysis) && structuredAnalysis.type === 'maxxis_structured_analysis'
    ? structuredAnalysis : null;
  const valuation = valuationIntelligence(context, canonical?.language || 'en');
  const comps = comparableEvidence(context);
  const reportLanguage = canonical?.language || 'en';
  const analysisConfidence = buildMaxxisAnalysisConfidence(context, { language: reportLanguage });
  const snapshot = isObject(snapshotOrFacts?.propertyFacts) ? snapshotOrFacts : { propertyFacts: snapshotOrFacts };
  const canonicalInvestmentAnalysis = buildCanonicalInvestmentAnalysis({
    ...context,
    propertyFacts: isObject(snapshot.propertyFacts) ? snapshot.propertyFacts : {},
    dealDecisionContext: isObject(snapshot.dealDecisionContext) ? snapshot.dealDecisionContext : {},
    dealAssumptions: isObject(snapshot.dealAssumptions) ? snapshot.dealAssumptions : {},
    sellerFinancingScenario: isObject(snapshot.sellerFinancingScenario) ? snapshot.sellerFinancingScenario : null,
  }, reportLanguage);
  const savedSellerFinancingScenario = isObject(snapshot.dealAssumptions?.sellerFinancingScenario)
    && snapshot.dealAssumptions.sellerFinancingScenario.confirmed === true
    ? Object.freeze({ ...snapshot.dealAssumptions.sellerFinancingScenario }) : null;
  const savedActiveScenario = isObject(snapshot.dealAssumptions?.activeScenario)
    && snapshot.dealAssumptions.activeScenario.confirmed === true
    ? Object.freeze({ ...snapshot.dealAssumptions.activeScenario }) : savedSellerFinancingScenario;
  const narrativePersona = resolveMaxxisInvestorPersona(context.investorContext, reportLanguage);
  const investorPerspective = Object.freeze({
    version: 'STRATEGY_FOCUS_MAP_V1',
    persona: narrativePersona.persona,
    priorities: canonicalInvestmentAnalysis.focusMap.dimensions.map((item) => item.dimension),
    focusMap: canonicalInvestmentAnalysis.focusMap,
    sourceType: 'CALCULATED', narrativeOnly: true,
  });
  const executiveSummaryIntelligence = buildMaxxisExecutiveSummaryIntelligence(context, analysisConfidence, investorPerspective, canonical);
  const sourceRisks = riskAnalysis(context);
  const sourceRiskByCategory = new Map(sourceRisks.map((risk) => [risk.category, risk]));
  return Object.freeze({
    type: 'maxxis_deal_intelligence_report',
    version: MAXXIS_DEAL_INTELLIGENCE_REPORT_VERSION,
    reportType: 'DEAL_INTELLIGENCE',
    propertyId: String(context.propertyId || '').trim() || null,
    executiveDealOverview: safeText(canonical?.opportunityAssessment || canonical?.executiveSummary) || overview(context, valuation),
    whyThisPropertyStandsOut: canonical
      ? Object.freeze(list(canonical.positiveSignals).map((explanation, index) => Object.freeze({
        code: `STRUCTURED_SIGNAL_${index + 1}`, explanation: safeText(explanation), source: 'CALCULATED',
      })).filter((signal) => signal.explanation).slice(0, 6))
      : standoutSignals(context),
    propertyEvidence: propertyEvidence(context),
    investmentFit: canonicalInvestmentAnalysis.profileFit,
    canonicalInvestmentAnalysis,
    sellerFinancingScenario: savedSellerFinancingScenario,
    activeScenario: savedActiveScenario,
    valuationIntelligence: valuation,
    comparableEvidence: comps,
    riskAnalysis: canonical ? Object.freeze([
      ['DATA_RISK', canonical.riskAnalysis?.dataRisk],
      ['MARKET_RISK', canonical.riskAnalysis?.marketRisk],
      ['VALUATION_RISK', canonical.riskAnalysis?.valuationRisk],
      ['EXECUTION_RISK', canonical.riskAnalysis?.executionRisk],
    ].filter(([, reason]) => safeText(reason)).map(([category, reason]) => Object.freeze({
      code: sourceRiskByCategory.get(category)?.code || category,
      category,
      severity: sourceRiskByCategory.get(category)?.severity || 'MEDIUM',
      reason: safeText(reason),
    }))) : sourceRisks,
    limitations: canonical
      ? Object.freeze(unique([
        ...(list(canonical.fullMissingEvidenceAudit).length
          ? list(canonical.fullMissingEvidenceAudit) : list(canonical.missingEvidence)),
        ...list(canonical.userFacingDisclaimers),
      ].map(safeText)).slice(0, 12))
      : limitations(context, valuation, comps),
    nextVerificationSteps: canonical
      ? Object.freeze(unique([...list(canonical.recommendedVerificationSteps), ...list(canonical.recommendedActions)].map(safeText)).slice(0, 8))
      : nextVerificationSteps(context),
    structuredAnalysis: canonical,
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

export function projectMaxxisDealIntelligenceResponse(result = {}, { reportProperty = null } = {}) {
  const structuredAnalysis = result?.data?.structuredAnalysis;
  const intelligenceSnapshot = isObject(result?.data?.intelligenceSnapshot)
    ? result.data.intelligenceSnapshot : null;
  const evidenceProperty = isObject(intelligenceSnapshot?.propertyFacts)
    ? intelligenceSnapshot.propertyFacts : result?.data?.property;
  const report = buildMaxxisDealIntelligenceReport(result?.data?.dealIntelligence, structuredAnalysis, intelligenceSnapshot || evidenceProperty);
  if (!report) return null;
  const property = mergeMaxxisReportProperty(evidenceProperty, reportProperty);
  const maxxisReport = buildMaxxisReportSchema({
    reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: report,
    dealMetrics: result?.data?.metrics, structuredAnalysis,
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
