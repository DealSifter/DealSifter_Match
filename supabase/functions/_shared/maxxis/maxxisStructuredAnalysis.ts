export const MAXXIS_STRUCTURED_ANALYSIS_VERSION = 'MAXXIS_STRUCTURED_ANALYSIS_V1' as const;

type ReportType = 'MAXXIS_ANALYSIS' | 'DEAL_INTELLIGENCE';
type AnyRecord = Record<string, any>;

const record = (value: unknown): AnyRecord => value && typeof value === 'object' && !Array.isArray(value)
  ? value as AnyRecord : {};
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
const finite = (value: unknown) => value !== null && value !== '' && Number.isFinite(Number(value))
  ? Number(value) : null;
const unique = (values: string[]) => [...new Set(values.map(text).filter(Boolean))];

const STATE_COPY: Record<string, string> = Object.freeze({
  analysis_depends_on_submitted_data: 'The analysis depends partly on submitted property information that should be independently verified.',
  property_data_not_independently_verified: 'Some property information comes from submitted records and should still be independently verified.',
  arv_not_structured: 'A defensible ARV cannot be calculated with the evidence currently available.',
  ARV_EVALUATION_NOT_LOADED: 'A defensible ARV cannot be calculated with the evidence currently available.',
  roi_not_calculated: 'ROI cannot yet be calculated because one or more required investment inputs are unavailable.',
  cap_rate_not_independently_verified: 'The reported capitalization rate has not yet been independently validated.',
  MISSING_REHAB: 'Rehabilitation scope and cost have not yet been confirmed.',
  MISSING_REHAB_INFORMATION: 'Rehabilitation scope and cost have not yet been confirmed.',
  rehab_not_provided: 'Rehabilitation scope and cost have not yet been confirmed.',
  property_condition_unknown: 'The current property condition has not yet been verified.',
  INSUFFICIENT_COMPS: 'There are not enough condition-compatible recorded sales to support a defensible ARV.',
  VALUATION_DISPERSION_WARNING: 'The available comparable values vary materially, which limits valuation confidence.',
});

export function explainMaxxisInternalState(value: unknown) {
  const raw = text(value);
  if (!raw) return '';
  if (STATE_COPY[raw]) return STATE_COPY[raw];
  if (!/^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+$/.test(raw)) return raw;
  const readable = raw.replaceAll('_', ' ').toLowerCase();
  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}.`;
}

function fieldValue(context: AnyRecord, name: string) {
  return record(record(context.propertyContext).fields)[name]?.value ?? null;
}

function propertyInterpretation(snapshot: AnyRecord, context: AnyRecord) {
  const property = record(snapshot.propertyFacts);
  const facts = [
    text(property.type || fieldValue(context, 'propertyType')),
    finite(property.beds ?? fieldValue(context, 'bedrooms')) !== null
      ? `${finite(property.beds ?? fieldValue(context, 'bedrooms'))} bedrooms` : '',
    finite(property.baths ?? fieldValue(context, 'bathrooms')) !== null
      ? `${finite(property.baths ?? fieldValue(context, 'bathrooms'))} bathrooms` : '',
    finite(property.sqft ?? fieldValue(context, 'livingAreaSqft')) !== null
      ? `${finite(property.sqft ?? fieldValue(context, 'livingAreaSqft'))?.toLocaleString('en-US')} sqft` : '',
  ].filter(Boolean);
  const location = [property.city, property.state].map(text).filter(Boolean).join(', ');
  return facts.length
    ? `The subject is recorded as ${facts.join(', ')}${location ? ` in ${location}` : ''}. These facts establish the structural context for the profile and risk review.`
    : 'The available property record is too limited to establish a complete structural context; core property facts should be verified.';
}

function fitAnalysis(context: AnyRecord) {
  const match = record(context.matchContext);
  const reasons = list(match.reasons);
  const strengths = unique(reasons.filter((item) => item?.status === 'matched').map((item) => text(item?.detail)));
  const mismatches = unique(reasons.filter((item) => item?.status !== 'matched').map((item) => text(item?.detail)));
  const score = finite(match.score);
  const overallAssessment = score === null
    ? 'Investment Profile alignment cannot be fully evaluated from the available criteria.'
    : `The property has ${score}% alignment with the configured Investment Profile; this is a profile-fit measure, not a deal-quality score.`;
  const rationaleParts = [...strengths.slice(0, 2), ...mismatches.slice(0, 2)];
  return {
    overallAssessment,
    fitRationale: rationaleParts.length
      ? `${overallAssessment} ${rationaleParts.join(' ')}` : overallAssessment,
    strengths,
    mismatches,
  };
}

function marketContext(context: AnyRecord) {
  const match = record(context.matchContext);
  const marketReason = list(match.reasons).find((item) => item?.key === 'market');
  const evidenceUsed = unique([
    text(marketReason?.detail),
    ...list(record(context.investorContext).targetMarkets).map((item) => `Configured target market: ${text(item)}.`),
  ]);
  const limitations = marketReason?.status === 'matched'
    ? ['Market alignment reflects the configured Investment Profile and does not independently establish market demand or liquidity.']
    : ['The property location is not confirmed as aligned with the configured target markets.'];
  return {
    interpretation: evidenceUsed[0] || 'Market alignment cannot be determined from the current profile and property data.',
    evidenceUsed,
    limitations,
  };
}

function comparativeAnalysis(context: AnyRecord) {
  const comps = list(context.comparableEvidence);
  const selected = comps.filter((item) => item?.valuationRole === 'PRIMARY' || item?.valuationEligibility === 'INCLUDED');
  const supporting = comps.filter((item) => item?.valuationRole === 'SUPPORTING' || item?.valuationEligibility === 'SUPPORTING_ONLY');
  const excluded = comps.filter((item) => item?.valuationRole === 'EXCLUDED' || item?.valuationEligibility === 'EXCLUDED');
  const limitations = selected.length
    ? unique(excluded.map((item) => explainMaxxisInternalState(item?.exclusionReason)).filter(Boolean))
    : ['No condition-compatible recorded sale is currently available to support a defensible comparable conclusion.'];
  return {
    interpretation: selected.length
      ? `${selected.length} recorded sale${selected.length === 1 ? '' : 's'} met the current structural and condition gates; ${supporting.length} additional sale${supporting.length === 1 ? '' : 's'} provide supporting context.`
      : 'The current evidence set does not contain a recorded sale that passed all comparable-selection gates.',
    selectedCompSummary: selected.slice(0, 5).map((item) => ({
      address: text(item.address) || 'Address unavailable',
      salePrice: finite(item.recordedSalePrice),
      similarity: finite(item.structuralComparabilityScore),
      rationale: explainMaxxisInternalState(item.inclusionReason) || 'Selected by the existing comparable engine.',
    })),
    supportingEvidence: supporting.slice(0, 5).map((item) => explainMaxxisInternalState(item.inclusionReason || item.exclusionReason)),
    limitations,
  };
}

function valuationAnalysis(context: AnyRecord) {
  const valuation = record(context.valuationContext);
  const metrics = record(record(context.dealMetrics).metrics);
  const status = text(valuation.status) || 'ARV_UNAVAILABLE';
  const providerEstimate = finite(record(valuation.providerEstimate).value);
  const arvAvailable = status !== 'ARV_UNAVAILABLE' && record(valuation.range).low != null && record(valuation.range).high != null;
  const limitations = unique([
    ...list(valuation.warnings).map(explainMaxxisInternalState),
    ...(!arvAvailable ? ['A defensible ARV cannot be calculated with the evidence currently available.'] : []),
    ...(!record(metrics.acquisitionPlusRehab).calculable ? ['ROI and spread scenarios remain limited until acquisition and rehabilitation inputs are complete.'] : []),
  ]);
  return {
    currentPositioning: record(metrics.pricePerSqft).calculable
      ? `The stored asking price equates to ${Number(record(metrics.pricePerSqft).value).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} per square foot; this is a deterministic positioning metric, not a valuation conclusion.`
      : 'Price-per-square-foot positioning cannot be calculated from the currently available facts.',
    arvInterpretation: arvAvailable
      ? `The existing deterministic engine produced an ARV range of $${Number(valuation.range.low).toLocaleString('en-US')} to $${Number(valuation.range.high).toLocaleString('en-US')} with ${text(valuation.confidence).toLowerCase()} confidence.`
      : 'A defensible DealSifter ARV is unavailable under the current evidence gates.',
    confidenceInterpretation: arvAvailable
      ? `Confidence is ${text(valuation.confidence).toLowerCase()} because the result depends on ${finite(valuation.compsUsed) ?? 0} eligible comparable sale${Number(valuation.compsUsed) === 1 ? '' : 's'} and the recorded evidence quality.`
      : 'Valuation confidence is limited because no eligible deterministic ARV set is available.',
    scenarioInterpretation: providerEstimate !== null
      ? `The provider AVM is ${providerEstimate.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}; it is supporting estimated evidence and is not the DealSifter ARV.`
      : 'No provider AVM is available as supporting valuation evidence.',
    limitations,
  };
}

function riskAnalysis(context: AnyRecord) {
  const byCategory = (category: string) => list(context.risks)
    .filter((risk) => risk?.category === category).map((risk) => text(risk?.explanation)).filter(Boolean);
  const data = byCategory('DATA_RISK');
  const market = byCategory('MARKET_RISK');
  const valuation = byCategory('VALUATION_RISK');
  const execution = byCategory('EXECUTION_RISK');
  return {
    dataRisk: data[0] || 'No additional data-risk signal was identified from the available evidence.',
    marketRisk: market[0] || 'No additional market-risk signal was identified from the available profile comparison.',
    valuationRisk: valuation[0] || 'No additional valuation-risk signal was identified by the existing deterministic engine.',
    executionRisk: execution[0] || 'Execution risk still depends on property condition, title, scope and operating assumptions being verified.',
    rationale: unique([...data, ...market, ...valuation, ...execution]),
  };
}

function strategyInsights(context: AnyRecord) {
  const strategies = list(record(context.investorContext).strategies).map(text).filter(Boolean);
  const capRate = record(record(context.dealMetrics).metrics).capRate;
  return unique(strategies.map((strategy) => {
    const normalized = strategy.toLowerCase();
    if (/hold|rental|rent/.test(normalized)) {
      return capRate?.calculable
        ? `For the ${strategy} strategy, the stored ${Number(capRate.value)}% cap rate is relevant but should be validated against current income and operating expenses.`
        : `For the ${strategy} strategy, rent, occupancy and operating expenses must be verified before income performance can be assessed.`;
    }
    if (/flip|rehab/.test(normalized)) return `For the ${strategy} strategy, property condition, rehabilitation scope and exit-value evidence are the primary unresolved execution inputs.`;
    if (/wholesale/.test(normalized)) return `For the ${strategy} strategy, disposition demand, assignability and a verified buyer margin remain essential validation points.`;
    return `For the ${strategy} strategy, confirm that the available property facts and unresolved risks remain compatible with the configured objective.`;
  }));
}

export function buildMaxxisStructuredAnalysis(snapshotInput: unknown, reportTypeInput: unknown) {
  const snapshot = record(snapshotInput);
  const context = record(snapshot.dealIntelligence);
  const reportType: ReportType = reportTypeInput === 'DEAL_INTELLIGENCE' ? 'DEAL_INTELLIGENCE' : 'MAXXIS_ANALYSIS';
  const fit = fitAnalysis(context);
  const market = marketContext(context);
  const comparative = comparativeAnalysis(context);
  const valuation = valuationAnalysis(context);
  const risks = riskAnalysis(context);
  const positiveSignals = unique([
    ...list(context.opportunities).map((item) => text(item?.explanation)),
    ...fit.strengths,
  ]);
  const concerns = unique([...risks.rationale, ...fit.mismatches]);
  const missingEvidence = unique([
    ...list(context.limitations).map(explainMaxxisInternalState),
    ...valuation.limitations,
  ]);
  const recommendedVerificationSteps = unique([
    ...list(context.recommendedActions).map(explainMaxxisInternalState),
    ...missingEvidence.slice(0, 3).map((item) => `Verify the evidence behind this limitation: ${item}`),
  ]).slice(0, 8);
  const strategySpecificInsights = strategyInsights(context);
  const executiveSummary = `${fit.overallAssessment} ${propertyInterpretation(snapshot, context)}`;
  const opportunityAssessment = positiveSignals.length
    ? `${positiveSignals.slice(0, 2).join(' ')} The unresolved evidence should be verified before relying on this analysis for an investment decision.`
    : 'The current record supports a structured review, but it does not yet provide enough verified evidence for a positive investment conclusion.';
  const profileAdaptedConclusion = `${fit.fitRationale}${strategySpecificInsights[0] ? ` ${strategySpecificInsights[0]}` : ''} ${missingEvidence[0] ? `Priority limitation: ${missingEvidence[0]}` : ''}`.trim();
  return Object.freeze({
    type: 'maxxis_structured_analysis',
    version: MAXXIS_STRUCTURED_ANALYSIS_VERSION,
    reportType,
    executiveSummary,
    opportunityAssessment,
    propertyContextInterpretation: propertyInterpretation(snapshot, context),
    investorFit: Object.freeze(fit),
    marketContext: Object.freeze(market),
    comparativeAnalysis: Object.freeze(comparative),
    valuationAnalysis: Object.freeze(valuation),
    riskAnalysis: Object.freeze(risks),
    positiveSignals: Object.freeze(positiveSignals.slice(0, 8)),
    concerns: Object.freeze(concerns.slice(0, 8)),
    missingEvidence: Object.freeze(missingEvidence.slice(0, 12)),
    recommendedVerificationSteps: Object.freeze(recommendedVerificationSteps),
    recommendedActions: Object.freeze(unique(list(context.recommendedActions).map(explainMaxxisInternalState)).slice(0, 8)),
    strategySpecificInsights: Object.freeze(strategySpecificInsights.slice(0, 6)),
    profileAdaptedConclusion,
    userFacingDisclaimers: Object.freeze([
      'This analysis is evidence-based decision support, not an appraisal, offer recommendation or return guarantee.',
      'Provider AVM evidence, when present, is not a DealSifter ARV.',
    ]),
  });
}
