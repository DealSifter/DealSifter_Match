export const MAXXIS_ANALYSIS_CONFIDENCE_VERSION = 'MAXXIS_ANALYSIS_CONFIDENCE_V1';
export const MAXXIS_INVESTOR_PERSONA_VERSION = 'MAXXIS_INVESTOR_PERSONA_V1';

const list = (value) => Array.isArray(value) ? value : [];
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
const unique = (values) => [...new Set(values.filter(Boolean))];

const PERSONAS = Object.freeze({
  WHOLESALER: Object.freeze({ priorities: ['ARV', 'Potential spread', 'Valuation confidence', 'Verification'], message: 'Focus on potential margin and validation requirements.' }),
  FLIPPER: Object.freeze({ priorities: ['Property condition', 'Rehab assumptions', 'ARV', 'Resale risk'], message: 'Focus on renovation assumptions and exit value uncertainty.' }),
  BUY_AND_HOLD: Object.freeze({ priorities: ['Rental evidence', 'NOI', 'Cap rate', 'Long-term factors'], message: 'Focus on income assumptions and operating performance.' }),
  TAX_DEED_INVESTOR: Object.freeze({ priorities: ['Ownership', 'Taxes', 'Title', 'Legal verification'], message: 'Focus on ownership validation and legal due diligence.' }),
  GENERAL_INVESTOR: Object.freeze({ priorities: ['Evidence', 'Profile compatibility', 'Risk', 'Verification'], message: 'Focus on available evidence, uncertainty and verification requirements.' }),
});

function personaText(investorContext) {
  return [
    ...list(investorContext?.strategies), ...list(investorContext?.investorRoles),
    ...list(investorContext?.lookingFor), ...list(investorContext?.taxDealObjectives),
  ].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function resolveMaxxisInvestorPersona(investorContext = {}, language = 'en') {
  const value = personaText(investorContext);
  const persona = /tax deed|tax lien|leilao fiscal|subasta fiscal/.test(value) ? 'TAX_DEED_INVESTOR'
    : /wholesal|atacad/.test(value) ? 'WHOLESALER'
      : /fix\s*(?:and|&)\s*flip|flipp|reabilit/.test(value) ? 'FLIPPER'
        : /buy\s*(?:and|&)\s*hold|rental|rent|loca[cç][aã]o/.test(value) ? 'BUY_AND_HOLD'
          : 'GENERAL_INVESTOR';
  const translatedMessage = language === 'pt'
    ? ({ WHOLESALER: 'Foco na margem potencial e nas verificações necessárias.', FLIPPER: 'Foco nas premissas de reforma e na incerteza do valor de saída.', BUY_AND_HOLD: 'Foco nas premissas de renda e no desempenho operacional.', TAX_DEED_INVESTOR: 'Foco na validação de titularidade e na diligência jurídica.', GENERAL_INVESTOR: 'Foco nas evidências disponíveis, incertezas e verificações necessárias.' }[persona])
    : language === 'es'
      ? ({ WHOLESALER: 'Enfoque en el margen potencial y las verificaciones necesarias.', FLIPPER: 'Enfoque en los supuestos de reforma y la incertidumbre del valor de salida.', BUY_AND_HOLD: 'Enfoque en los supuestos de renta y el desempeño operativo.', TAX_DEED_INVESTOR: 'Enfoque en la validación de titularidad y la diligencia legal.', GENERAL_INVESTOR: 'Enfoque en la evidencia disponible, las incertidumbres y las verificaciones necesarias.' }[persona])
      : PERSONAS[persona].message;
  return Object.freeze({
    version: MAXXIS_INVESTOR_PERSONA_VERSION, persona,
    priorities: PERSONAS[persona].priorities, message: translatedMessage,
    sourceType: value ? 'USER_PROVIDED' : 'UNKNOWN', narrativeOnly: true,
  });
}

function evidenceComponent(context) {
  const summary = context?.evidenceSummary || {};
  const verified = finite(summary.verifiedFieldCount) ?? list(context?.propertyContext?.verifiedFields).length;
  const provided = finite(summary.userProvidedFieldCount) ?? list(context?.propertyContext?.userProvidedFields).length;
  const unknown = finite(summary.unknownFieldCount) ?? list(context?.propertyContext?.unknownFields).length;
  const total = verified + provided + unknown;
  return Object.freeze({
    code: 'EVIDENCE_COMPLETENESS', score: total ? clamp(((verified + (provided * 0.55)) / total) * 100) : null,
    status: total ? 'CALCULATED' : 'UNKNOWN', sourceType: total ? 'CALCULATED' : 'UNKNOWN',
    inputs: Object.freeze({ verified, userProvided: provided, unknown }),
  });
}

function comparableComponent(context, now) {
  const comps = list(context?.comparableEvidence).filter((comp) => ['PRIMARY', 'SUPPORTING'].includes(comp?.valuationRole));
  if (!comps.length) return Object.freeze({ code: 'COMPARABLE_STRENGTH', score: null, status: 'UNKNOWN', sourceType: 'UNKNOWN', inputs: Object.freeze({ count: 0 }) });
  const averageSimilarity = comps.reduce((sum, comp) => sum + (finite(comp?.structuralComparabilityScore) || 0), 0) / comps.length;
  const averageDistance = comps.reduce((sum, comp) => sum + (finite(comp?.distanceMiles) ?? 5), 0) / comps.length;
  const verifiedTransactions = comps.filter((comp) => /VERIFIED|ARMS_LENGTH/.test(String(comp?.transactionQuality || ''))).length;
  const quantityScore = Math.min(100, comps.length * 25);
  const distanceScore = Math.max(0, 100 - (averageDistance * 20));
  const transactionScore = (verifiedTransactions / comps.length) * 100;
  const score = clamp((quantityScore * 0.25) + (averageSimilarity * 0.35) + (distanceScore * 0.2) + (transactionScore * 0.2));
  const recentCount = comps.filter((comp) => {
    const timestamp = Date.parse(comp?.recordedSaleDate || '');
    return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 365 * 24 * 60 * 60 * 1000;
  }).length;
  const datedCount = comps.filter((comp) => Number.isFinite(Date.parse(comp?.recordedSaleDate || ''))).length;
  return Object.freeze({ code: 'COMPARABLE_STRENGTH', score, status: 'CALCULATED', sourceType: 'CALCULATED',
    inputs: Object.freeze({ count: comps.length, averageSimilarity: Math.round(averageSimilarity), averageDistance: Math.round(averageDistance * 10) / 10, verifiedTransactions, datedCount, recentCount }) });
}

function valuationComponent(context) {
  const valuation = context?.valuationContext || {};
  if (valuation.status === 'ARV_UNAVAILABLE') return Object.freeze({ code: 'VALUATION_CONFIDENCE', score: null, status: 'UNKNOWN', sourceType: 'UNKNOWN', inputs: Object.freeze({ arvStatus: 'ARV_UNAVAILABLE' }) });
  const confidence = { HIGH: 90, MODERATE: 70, LOW: 40 }[valuation.confidence] ?? 40;
  const statusAdjustment = valuation.status === 'ARV_LIMITED' ? -15 : 0;
  const warningAdjustment = Math.min(20, list(valuation.warnings).length * 5);
  return Object.freeze({ code: 'VALUATION_CONFIDENCE', score: clamp(confidence + statusAdjustment - warningAdjustment), status: 'CALCULATED', sourceType: 'CALCULATED', inputs: Object.freeze({ arvStatus: valuation.status, engineConfidence: valuation.confidence || 'LOW', warnings: list(valuation.warnings).length }) });
}

function freshnessComponent(comparable) {
  const count = finite(comparable?.inputs?.datedCount) || 0;
  const recent = finite(comparable?.inputs?.recentCount) || 0;
  return count ? Object.freeze({ code: 'DATA_FRESHNESS', score: clamp((recent / count) * 100), status: 'CALCULATED', sourceType: 'CALCULATED', inputs: Object.freeze({ datedComparableRecords: count, recentComparableRecords: recent }) })
    : Object.freeze({ code: 'DATA_FRESHNESS', score: null, status: 'UNKNOWN', sourceType: 'UNKNOWN', inputs: Object.freeze({ datedComparableRecords: 0, recentComparableRecords: 0 }) });
}

function missingImpactComponent(context) {
  const unknownFields = list(context?.propertyContext?.unknownFields);
  const limitations = list(context?.limitations);
  const material = unique([...unknownFields, ...limitations].filter((item) => /condition|rehab|rental|rent|cost|title|tax|ownership|unknown|missing/i.test(String(item))));
  if (!unknownFields.length && !limitations.length) return Object.freeze({ code: 'MISSING_INFORMATION_IMPACT', score: null, status: 'UNKNOWN', sourceType: 'UNKNOWN', inputs: Object.freeze({ materialMissingItems: [] }) });
  return Object.freeze({ code: 'MISSING_INFORMATION_IMPACT', score: clamp(100 - (material.length * 12)), status: 'CALCULATED', sourceType: 'CALCULATED', inputs: Object.freeze({ materialMissingItems: material }) });
}

function classification(score) {
  if (score === null) return 'LIMITED';
  if (score >= 80) return 'HIGH';
  if (score >= 60) return 'MODERATE';
  return 'LIMITED';
}

export function buildMaxxisAnalysisConfidence(context, { now = Date.now() } = {}) {
  const evidence = evidenceComponent(context);
  const comparables = comparableComponent(context, now);
  const valuation = valuationComponent(context);
  const freshness = freshnessComponent(comparables);
  const missing = missingImpactComponent(context);
  const components = Object.freeze([evidence, comparables, valuation, freshness, missing]);
  const weights = [0.3, 0.25, 0.25, 0.1, 0.1];
  const availableWeight = components.reduce((sum, item, index) => sum + (item.score === null ? 0 : weights[index]), 0);
  const weighted = components.reduce((sum, item, index) => sum + (item.score === null ? 0 : item.score * weights[index]), 0);
  const score = availableWeight ? clamp(weighted / availableWeight) : null;
  const contributors = unique([
    evidence.inputs.verified > 0 ? 'Verified property records' : null,
    comparables.inputs.recentCount > 0 ? 'Recent comparable sales' : null,
    context?.matchContext?.reasons?.some((item) => item?.key === 'market' && item?.status === 'matched') ? 'Strong location match' : null,
  ]);
  const limitations = unique([
    ...missing.inputs.materialMissingItems.map((item) => String(item).replaceAll('_', ' ')),
    freshness.score === null ? 'Data freshness unavailable' : null,
    valuation.score === null ? 'Valuation confidence unavailable' : null,
    comparables.inputs.verifiedTransactions < comparables.inputs.count ? 'Transaction quality unavailable for one or more comparables' : null,
  ]).slice(0, 8);
  return Object.freeze({
    version: MAXXIS_ANALYSIS_CONFIDENCE_VERSION, label: 'MAXXIS ANALYSIS CONFIDENCE',
    score, classification: classification(score),
    semantics: 'ANALYSIS_COMPLETENESS_AND_RELIABILITY_ONLY', notPropertyScore: true,
    evidenceCompletenessScore: evidence.score,
    valuationConfidence: context?.valuationContext?.confidence || 'UNAVAILABLE',
    components, contributors: Object.freeze(contributors), limitations: Object.freeze(limitations),
    coverage: Math.round(availableWeight * 100), sourceType: 'CALCULATED',
  });
}

export function buildMaxxisExecutiveSummaryIntelligence(context, confidence, persona, structuredAnalysis = null) {
  if (structuredAnalysis?.type === 'maxxis_structured_analysis') {
    return Object.freeze({ sourceType: 'CALCULATED', lines: Object.freeze(unique([
      structuredAnalysis.executiveSummary,
      structuredAnalysis.opportunityAssessment,
      structuredAnalysis.comparablesAnalysis?.interpretation || structuredAnalysis.comparativeAnalysis?.interpretation,
      structuredAnalysis.valuationAnalysis?.confidenceInterpretation,
      structuredAnalysis.riskAnalysis?.rationale?.[0],
      structuredAnalysis.recommendedVerificationSteps?.[0],
    ].map((item) => String(item || '').trim())).slice(0, 6)) });
  }
  const evidence = context?.evidenceSummary || {};
  const fit = context?.matchContext;
  const valuation = context?.valuationContext || {};
  const profileFit = finite(fit?.score);
  const limitation = confidence?.limitations?.[0] || 'No material limitation was identified from the available structured inputs.';
  const next = list(context?.recommendedActions)
    .map((item) => String(item || '').trim())
    .find((item) => item && !/\b(?:good deal|great opportunity|strong investment|buy this|should buy|sell this|should sell|guaranteed? return)\b/i.test(item))
    || 'Review the underlying evidence before relying on the analysis.';
  return Object.freeze({
    sourceType: 'CALCULATED', lines: Object.freeze([
      `Based on available evidence, the analysis has ${String(confidence?.classification || 'LIMITED').toLowerCase()} confidence and ${profileFit === null ? 'UNKNOWN profile compatibility' : `${profileFit}% profile compatibility`}.`,
      `The assessment reflects ${evidence.verifiedFieldCount ?? 0} verified property field(s) and ${evidence.conflictCount ?? 0} recorded conflict(s).`,
      `Comparable and valuation support is ${valuation.status || 'UNKNOWN'} with ${valuation.compsUsed ?? 0} comparable(s) used by the existing engine.`,
      `The principal uncertainty currently identified is: ${limitation}.`,
      `${persona?.message || PERSONAS.GENERAL_INVESTOR.message}`,
      `Next verification priority: ${next}`,
    ]),
  });
}
