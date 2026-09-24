import type { ArvEvaluationResult } from '../property-data/arvEngine.ts';
import type { DealMetricsResult } from './dealMetrics.ts';
import type { NormalizedInvestmentProfileResult } from './normalizeInvestmentProfile.ts';
import type { MaxxisPropertyEvidenceResult } from './propertyEvidence.ts';
import type { DealAdvisorAnalysis, MaxxisPropertyDetails, PropertyMatchResult } from './types.ts';

export type EvidenceStatus = 'VERIFIED_RECORD' | 'USER_PROVIDED' | 'UNKNOWN';
export type EvidenceStrength = 'HIGH' | 'MEDIUM' | 'LOW';
export type DealRiskCategory = 'DATA_RISK' | 'MARKET_RISK' | 'VALUATION_RISK' | 'EXECUTION_RISK';
export type DealRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type DealContextField = {
  value: string | number | boolean | null;
  status: EvidenceStatus;
  source: string | null;
};

export type DealIntelligenceRisk = {
  code: string;
  category: DealRiskCategory;
  severity: DealRiskSeverity;
  explanation: string;
};

export type DealIntelligenceContext = {
  type: 'deal_intelligence_context';
  version: 'MAXXIS_DEAL_INTELLIGENCE_CONTEXT_V1';
  propertyId: string;
  propertyContext: {
    fields: Record<string, DealContextField>;
    verifiedFields: string[];
    userProvidedFields: string[];
    unknownFields: string[];
  };
  investorContext: {
    exists: boolean;
    complete: boolean;
    provenance: 'USER_PROVIDED' | 'UNKNOWN';
    targetMarkets: string[] | null;
    propertyTypes: string[] | null;
    strategies: string[] | null;
    priceRange: string | null;
    preferences: string[] | null;
  };
  evidenceSummary: {
    strength: EvidenceStrength;
    verifiedFieldCount: number;
    userProvidedFieldCount: number;
    unknownFieldCount: number;
    conflictCount: number;
    conflicts: Array<{ field: string; severity: string }>;
  };
  valuationContext: {
    status: 'ARV_AVAILABLE' | 'ARV_LIMITED' | 'ARV_UNAVAILABLE';
    range: { low: number; high: number } | null;
    centralReference: number | null;
    confidence: 'LOW' | 'MODERATE' | 'HIGH';
    compsUsed: number;
    warnings: string[];
    provenance: 'CALCULATED' | 'UNAVAILABLE';
    methodologyVersion: string | null;
    providerEstimate: {
      value: number;
      status: string;
      provenance: 'ESTIMATED';
    } | null;
  };
  comparableEvidence: Array<{
    compIdentifier: string | null;
    address: string | null;
    valuationEligibility: string;
    recordedSalePrice: number | null;
    recordedSaleDate: string | null;
    distanceMiles: number | null;
    transactionQuality: string;
    conditionCompatibility: string;
    structuralComparabilityScore: number;
    dataCompletenessScore: number;
    valuationWeight: number;
    valuationRole: string;
    inclusionReason: string | null;
    exclusionReason: string | null;
    beds: number | null | undefined;
    baths: number | null | undefined;
    sqft: number | null;
    latitude: number | null | undefined;
    longitude: number | null | undefined;
  }>;
  matchContext: {
    score: number | null;
    classification: string;
    calculable: boolean;
    semantics: 'PROFILE_FIT_ONLY';
    reasons: PropertyMatchResult['reasons'];
  } | null;
  dealMetrics: DealMetricsResult | null;
  fitAnalysis: { positiveFactors: string[]; negativeFactors: string[] };
  risks: DealIntelligenceRisk[];
  opportunities: Array<{ code: string; explanation: string }>;
  limitations: string[];
  recommendedActions: string[];
  response: {
    initialAssessment: string;
    why: string[];
    mainRisks: string[];
    nextSteps: string[];
  };
  reportCompatibility: {
    executiveSummary: true;
    propertyAnalysis: true;
    valuationEvidence: true;
    investorFit: true;
    riskAssessment: true;
    actionPlan: true;
  };
};

const present = (value: unknown) => value !== null && value !== undefined && value !== '';
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, any> : {};
const unique = <T>(values: T[]) => [...new Set(values)];

function field(publicField: unknown, internalField: unknown, fallback: unknown, fallbackSource = 'DealSifter'):
DealContextField {
  const external = record(publicField);
  if (external.status === 'VERIFIED_RECORD' && present(external.value)) {
    return { value: external.value, status: 'VERIFIED_RECORD', source: String(external.source || 'public_record') };
  }
  const internal = record(internalField);
  if (present(internal.value)) {
    return { value: internal.value, status: 'USER_PROVIDED', source: String(internal.source || fallbackSource) };
  }
  if (present(fallback)) return { value: fallback as string | number | boolean, status: 'USER_PROVIDED', source: fallbackSource };
  return { value: null, status: 'UNKNOWN', source: null };
}

function propertyContext(property: MaxxisPropertyDetails, evidence: MaxxisPropertyEvidenceResult) {
  const publicFields = evidence.state === 'available' ? record(evidence.evidence?.fields) : {};
  const internalFields = evidence.state === 'available' ? record(evidence.evidence?.internalFields) : {};
  const fields: Record<string, DealContextField> = {
    address: field(null, null, property.address),
    city: field(null, null, property.city),
    state: field(null, null, property.state),
    zipCode: field(null, null, property.zip),
    propertyType: field(publicFields.propertyType, internalFields.propertyType, property.type),
    bedrooms: field(publicFields.bedrooms, internalFields.bedrooms, property.beds),
    bathrooms: field(publicFields.bathrooms, internalFields.bathrooms, property.baths),
    livingAreaSqft: field(publicFields.livingAreaSqft, internalFields.livingAreaSqft, property.sqft),
    lotSizeSqft: field(publicFields.lotSizeSqft, internalFields.lotSizeSqft, property.lot),
    yearBuilt: field(publicFields.yearBuilt, internalFields.yearBuilt, null),
    askingPrice: field(null, internalFields.askingPrice, property.price),
    county: field(publicFields.county, null, null),
    latitude: field(publicFields.latitude, null, property.latitude),
    longitude: field(publicFields.longitude, null, property.longitude),
    assessedValue: field(publicFields.assessedValue, null, null),
    assessmentYear: field(publicFields.assessmentYear, null, null),
    annualPropertyTax: field(publicFields.annualPropertyTax, null, null),
    propertyTaxYear: field(publicFields.propertyTaxYear, null, null),
    latestSalePrice: field(publicFields.latestSalePrice, null, null),
    latestSaleDate: field(publicFields.latestSaleDate, null, null),
    ownerOccupied: field(publicFields.ownerOccupied, null, null),
    ownershipRecordPresent: field(publicFields.ownershipRecordPresent, null, null),
  };
  return {
    fields,
    verifiedFields: Object.keys(fields).filter((key) => fields[key].status === 'VERIFIED_RECORD'),
    userProvidedFields: Object.keys(fields).filter((key) => fields[key].status === 'USER_PROVIDED'),
    unknownFields: Object.keys(fields).filter((key) => fields[key].status === 'UNKNOWN'),
  };
}

function evidenceStrength(verified: number, unknown: number, conflicts: number): EvidenceStrength {
  if (verified >= 5 && unknown <= 1 && conflicts === 0) return 'HIGH';
  if (verified >= 2 && unknown <= 4 && conflicts <= 1) return 'MEDIUM';
  return 'LOW';
}

function valuationContext(arv: ArvEvaluationResult | null): DealIntelligenceContext['valuationContext'] {
  if (!arv) return { status: 'ARV_UNAVAILABLE', range: null, centralReference: null, confidence: 'LOW',
    compsUsed: 0, warnings: ['ARV_EVALUATION_NOT_LOADED'], provenance: 'UNAVAILABLE', methodologyVersion: null,
    providerEstimate: null };
  const available = arv.status !== 'ARV_UNAVAILABLE';
  const providerEstimate = arv.providerAvmCrossCheck?.evidenceStatus === 'ESTIMATED'
    && Number.isFinite(Number(arv.providerAvmCrossCheck.value))
    ? {
        value: Number(arv.providerAvmCrossCheck.value),
        status: arv.providerAvmCrossCheck.status,
        provenance: 'ESTIMATED' as const,
      }
    : null;
  return {
    status: arv.status,
    range: available && arv.arvRangeLow !== null && arv.arvRangeHigh !== null
      ? { low: arv.arvRangeLow, high: arv.arvRangeHigh } : null,
    centralReference: available ? arv.centralReference : null,
    confidence: arv.confidence,
    compsUsed: arv.eligibleCompCount,
    warnings: [...arv.warnings],
    provenance: arv.evidenceSummary.arv,
    methodologyVersion: arv.methodologyVersion,
    providerEstimate,
  };
}

function comparableEvidence(arv: ArvEvaluationResult | null): DealIntelligenceContext['comparableEvidence'] {
  return (arv?.valuationSet || []).map((comp) => ({
    compIdentifier: comp.compIdentifier,
    address: comp.address,
    valuationEligibility: comp.valuationEligibility,
    recordedSalePrice: comp.recordedSalePrice,
    recordedSaleDate: comp.recordedSaleDate,
    distanceMiles: comp.distanceMiles,
    transactionQuality: comp.transactionQuality,
    conditionCompatibility: comp.conditionCompatibility,
    structuralComparabilityScore: comp.structuralComparabilityScore,
    dataCompletenessScore: comp.dataCompletenessScore,
    valuationWeight: comp.valuationWeight,
    valuationRole: comp.valuationRole,
    inclusionReason: comp.inclusionReason,
    exclusionReason: comp.exclusionReason,
    beds: comp.bedrooms,
    baths: comp.bathrooms,
    sqft: comp.livingAreaSqft,
    latitude: comp.latitude,
    longitude: comp.longitude,
  }));
}

function buildRisks(input: {
  property: MaxxisPropertyDetails;
  propertyFields: ReturnType<typeof propertyContext>;
  evidence: MaxxisPropertyEvidenceResult;
  match: PropertyMatchResult | null;
  arv: ArvEvaluationResult | null;
}): DealIntelligenceRisk[] {
  const risks: DealIntelligenceRisk[] = [];
  const add = (code: string, category: DealRiskCategory, severity: DealRiskSeverity, explanation: string) => {
    if (!risks.some((risk) => risk.code === code)) risks.push({ code, category, severity, explanation });
  };
  if (input.propertyFields.unknownFields.length) add('UNKNOWN_PROPERTY_FIELDS', 'DATA_RISK',
    input.propertyFields.unknownFields.length >= 4 ? 'HIGH' : 'MEDIUM',
    `Property evidence remains unknown for: ${input.propertyFields.unknownFields.join(', ')}.`);
  if (input.evidence.state === 'available' && (input.evidence.evidence?.conflicts?.length || 0) > 0) {
    add('PROPERTY_EVIDENCE_CONFLICT', 'DATA_RISK', 'MEDIUM', 'Internal and verified property evidence contain unresolved conflicts.');
  }
  if (!present(input.property.rehab)) add('MISSING_REHAB_INFORMATION', 'DATA_RISK', 'MEDIUM',
    'Rehabilitation information is missing.');
  const market = input.match?.reasons.find((reason) => reason.key === 'market');
  const price = input.match?.reasons.find((reason) => reason.key === 'price');
  if (market?.status === 'not_matched') add('TARGET_MARKET_MISMATCH', 'MARKET_RISK', 'HIGH',
    'The property location is outside the configured target markets.');
  if (price?.status === 'not_matched') add('TARGET_PRICE_RANGE_MISMATCH', 'MARKET_RISK', 'MEDIUM',
    'The asking price is outside the configured Investment Profile range.');
  if (!input.arv || input.arv.status === 'ARV_UNAVAILABLE') add('ARV_EVIDENCE_UNAVAILABLE', 'VALUATION_RISK', 'HIGH',
    'Condition-compatible comparable evidence does not currently support an ARV range.');
  if (input.arv?.status === 'ARV_LIMITED') add('ARV_EVIDENCE_LIMITED', 'VALUATION_RISK',
    input.arv.confidence === 'LOW' ? 'HIGH' : 'MEDIUM', 'The existing ARV evaluation is limited by its evidence or confidence.');
  if (input.arv?.warnings.includes('VALUATION_DISPERSION_WARNING')) add('COMPARABLE_DISPERSION', 'VALUATION_RISK', 'HIGH',
    'The existing ARV evaluation reports material comparable dispersion.');
  if (!input.arv || input.arv.evidenceSummary.conditionReview !== 'USER_PROVIDED') add('UNKNOWN_CONDITION', 'DATA_RISK', 'HIGH',
    'Target or comparable condition evidence has not been confirmed by the user.');
  const critical = ['propertyType', 'livingAreaSqft', 'askingPrice']
    .filter((name) => input.propertyFields.fields[name]?.status === 'UNKNOWN');
  if (critical.length) add('MISSING_CRITICAL_INFORMATION', 'EXECUTION_RISK', 'HIGH',
    `Critical property information remains unknown: ${critical.join(', ')}.`);
  return risks;
}

function matchFactors(match: PropertyMatchResult | null) {
  if (!match) return { positiveFactors: [], negativeFactors: ['Investment Profile fit is unavailable.'] };
  return {
    positiveFactors: match.reasons.filter((reason) => reason.status === 'matched')
      .map((reason) => reason.detail || `${reason.label} matches the Investment Profile.`),
    negativeFactors: match.reasons.filter((reason) => reason.status !== 'matched')
      .map((reason) => reason.detail || `${reason.label} is not confirmed as a profile match.`),
  };
}

function opportunities(match: PropertyMatchResult | null, evidence: MaxxisPropertyEvidenceResult,
  arv: ArvEvaluationResult | null) {
  const signals = (match?.reasons || []).filter((reason) => reason.status === 'matched').map((reason) => ({
    code: `PROFILE_${reason.key.toUpperCase()}_MATCH`, explanation: reason.detail || `${reason.label} matches the configured profile.`,
  }));
  if (evidence.state === 'available') signals.push({ code: 'VERIFIED_PROPERTY_EVIDENCE_AVAILABLE',
    explanation: 'Verified property evidence is available for review.' });
  if (arv && arv.status !== 'ARV_UNAVAILABLE') signals.push({ code: 'COMPARABLE_VALUATION_EVIDENCE_AVAILABLE',
    explanation: 'Condition-compatible recorded-sale evidence supports a valuation reference.' });
  return signals;
}

function initialAssessment(match: PropertyMatchResult | null, valuation: DealIntelligenceContext['valuationContext']) {
  const profileFit = match?.calculable ? `${match.classification} Investment Profile alignment` : 'unavailable Investment Profile alignment';
  const valuationState = valuation.status === 'ARV_AVAILABLE' ? `${valuation.confidence.toLowerCase()}-confidence valuation evidence`
    : valuation.status === 'ARV_LIMITED' ? `limited ${valuation.confidence.toLowerCase()}-confidence valuation evidence`
      : 'no currently defensible ARV range';
  return `Based on available evidence, this property has ${profileFit} and ${valuationState}.`;
}

export function buildDealIntelligenceContext(input: {
  property: MaxxisPropertyDetails;
  investmentProfile: NormalizedInvestmentProfileResult;
  match: PropertyMatchResult | null;
  propertyEvidence: MaxxisPropertyEvidenceResult;
  dealMetrics: DealMetricsResult | null;
  analysis: DealAdvisorAnalysis | null;
  arvEvaluation: ArvEvaluationResult | null;
}): DealIntelligenceContext {
  const property = propertyContext(input.property, input.propertyEvidence);
  const coreEvidenceFields = new Set([
    'address', 'city', 'state', 'zipCode', 'propertyType', 'bedrooms', 'bathrooms',
    'livingAreaSqft', 'lotSizeSqft', 'yearBuilt', 'askingPrice',
  ]);
  const coreVerifiedCount = property.verifiedFields.filter((name) => coreEvidenceFields.has(name)).length;
  const coreUnknownCount = property.unknownFields.filter((name) => coreEvidenceFields.has(name)).length;
  const conflicts = input.propertyEvidence.state === 'available'
    ? (input.propertyEvidence.evidence?.conflicts || []).map((item) => ({ field: item.field, severity: item.severity })) : [];
  const valuation = valuationContext(input.arvEvaluation);
  const fit = matchFactors(input.match);
  const risks = buildRisks({ property: input.property, propertyFields: property,
    evidence: input.propertyEvidence, match: input.match, arv: input.arvEvaluation });
  const profile = input.investmentProfile.profile;
  const limitations = unique([
    ...(input.analysis?.limitations || []),
    ...(input.analysis?.missingInformation || []).map((item) => `MISSING_${item.toUpperCase()}`),
    ...(input.arvEvaluation?.limitations || ['ARV_EVALUATION_NOT_LOADED']),
  ]);
  const recommendedActions = unique([
    ...(risks.some((risk) => risk.code === 'UNKNOWN_CONDITION') ? ['Confirm target condition and review comparable condition evidence.'] : []),
    ...(valuation.status !== 'ARV_AVAILABLE' ? ['Review additional condition-compatible recorded sales.'] : []),
    ...(conflicts.length ? ['Resolve property evidence conflicts before relying on the analysis.'] : []),
    ...(risks.some((risk) => risk.category === 'MARKET_RISK') ? ['Compare the property with the configured target market and price preferences.'] : []),
    ...(property.unknownFields.length ? ['Complete or verify the missing property fields.'] : []),
  ]).slice(0, 5);
  const matchContext = input.match ? { score: input.match.score, classification: input.match.classification,
    calculable: input.match.calculable, semantics: 'PROFILE_FIT_ONLY' as const, reasons: input.match.reasons } : null;
  return {
    type: 'deal_intelligence_context',
    version: 'MAXXIS_DEAL_INTELLIGENCE_CONTEXT_V1',
    propertyId: input.property.id,
    propertyContext: property,
    investorContext: {
      exists: input.investmentProfile.exists,
      complete: input.investmentProfile.complete,
      provenance: profile ? 'USER_PROVIDED' : 'UNKNOWN',
      targetMarkets: profile?.targetMarkets?.length ? [...profile.targetMarkets] : null,
      propertyTypes: profile?.propertyTypes?.length ? [...profile.propertyTypes] : null,
      strategies: profile?.strategies?.length ? [...profile.strategies] : null,
      priceRange: profile?.priceRange || null,
      preferences: profile?.acceptableConditions?.length ? [...profile.acceptableConditions] : null,
    },
    evidenceSummary: {
      strength: evidenceStrength(coreVerifiedCount, coreUnknownCount, conflicts.length),
      verifiedFieldCount: property.verifiedFields.length,
      userProvidedFieldCount: property.userProvidedFields.length,
      unknownFieldCount: property.unknownFields.length,
      conflictCount: conflicts.length,
      conflicts,
    },
    valuationContext: valuation,
    comparableEvidence: comparableEvidence(input.arvEvaluation),
    matchContext,
    dealMetrics: input.dealMetrics,
    fitAnalysis: fit,
    risks,
    opportunities: opportunities(input.match, input.propertyEvidence, input.arvEvaluation),
    limitations,
    recommendedActions,
    response: {
      initialAssessment: initialAssessment(input.match, valuation),
      why: unique([...fit.positiveFactors, ...fit.negativeFactors, ...opportunities(input.match, input.propertyEvidence, input.arvEvaluation)
        .map((signal) => signal.explanation)]).slice(0, 6),
      mainRisks: risks.filter((risk) => risk.severity !== 'LOW').map((risk) => risk.explanation).slice(0, 5),
      nextSteps: recommendedActions,
    },
    reportCompatibility: { executiveSummary: true, propertyAnalysis: true, valuationEvidence: true,
      investorFit: true, riskAssessment: true, actionPlan: true },
  };
}
