import type { DealAdvisorAnalysis } from './types.ts';
import type { DealMetricsResult } from './dealMetrics.ts';
import type { NormalizedInvestmentProfileResult } from './normalizeInvestmentProfile.ts';
import type { PropertyDetailsLookupResult } from './propertyDetails.ts';
import type { PropertyMatchResult } from './types.ts';
import type { MaxxisPropertyEvidenceResult } from './propertyEvidence.ts';
import type { ArvEvaluationResult } from '../property-data/arvEngine.ts';
import { buildDealIntelligenceContext, type DealIntelligenceContext } from './dealIntelligenceContext.ts';

export type DealInsightContext = {
  type: 'deal_insight';
  propertyId: string;
  state: 'available' | 'not_found';
  property: PropertyDetailsLookupResult['property'];
  investmentProfile: NormalizedInvestmentProfileResult;
  match: (PropertyMatchResult & { semantics: 'profile_fit_only' }) | null;
  evidence: MaxxisPropertyEvidenceResult;
  metrics: DealMetricsResult | null;
  analysis: DealAdvisorAnalysis | null;
  dealIntelligence: DealIntelligenceContext | null;
  capabilities: {
    canDiscussPricePerSqft: boolean;
    canDiscussAcquisitionPlusRehab: boolean;
    hasReportedCapRate: boolean;
    canCalculateARV: false;
    canCalculateMAO: false;
    canCalculateROI: false;
    canCalculateCashFlow: false;
    hasArvEvaluation: boolean;
  };
};

export async function orchestrateDealInsightContext(input: {
  propertyId: string;
  loadPropertyDetails: (propertyId: string) => Promise<PropertyDetailsLookupResult>;
  loadInvestmentProfile: () => Promise<NormalizedInvestmentProfileResult>;
  calculateMatch: (profile: NormalizedInvestmentProfileResult['profile'], property: PropertyDetailsLookupResult['property']) => PropertyMatchResult;
  loadPropertyEvidence: (propertyId: string) => Promise<MaxxisPropertyEvidenceResult>;
  loadArvEvaluation?: (propertyId: string) => Promise<ArvEvaluationResult | null>;
}): Promise<DealInsightContext> {
  const details = await input.loadPropertyDetails(input.propertyId);
  const unavailableEvidence: MaxxisPropertyEvidenceResult = {
    type: 'property_evidence', propertyId: input.propertyId, state: 'unavailable',
    entitlementState: 'not_authorized', cacheState: 'unknown',
  };
  if (!details.found || !details.property || details.property.id !== input.propertyId) {
    return {
      type: 'deal_insight', propertyId: input.propertyId, state: 'not_found', property: null,
      investmentProfile: { profile: null, exists: false, complete: false }, match: null,
      evidence: unavailableEvidence, metrics: null, analysis: null, dealIntelligence: null,
      capabilities: {
        canDiscussPricePerSqft: false, canDiscussAcquisitionPlusRehab: false, hasReportedCapRate: false,
        canCalculateARV: false, canCalculateMAO: false, canCalculateROI: false, canCalculateCashFlow: false,
        hasArvEvaluation: false,
      },
    };
  }
  const [investmentProfile, evidence] = await Promise.all([
    input.loadInvestmentProfile().catch(() => ({ profile: null, exists: false, complete: false })),
    input.loadPropertyEvidence(input.propertyId).catch(() => unavailableEvidence),
  ]);
  // Provider services share a property-scoped lease. Do not race valuation against
  // the property record, and do not request valuation after evidence failed closed.
  const arvEvaluation = evidence.state === 'available'
    ? await input.loadArvEvaluation?.(input.propertyId).catch(() => null) ?? null
    : null;
  const match = investmentProfile.profile
    ? { ...input.calculateMatch(investmentProfile.profile, details.property), semantics: 'profile_fit_only' as const }
    : null;
  const metrics = details.metrics;
  const dealIntelligence = buildDealIntelligenceContext({
    property: details.property,
    investmentProfile,
    match,
    propertyEvidence: evidence,
    dealMetrics: metrics,
    analysis: details.analysis,
    arvEvaluation,
  });
  return {
    type: 'deal_insight', propertyId: input.propertyId, state: 'available', property: details.property,
    investmentProfile, match, evidence, metrics, analysis: details.analysis, dealIntelligence,
    capabilities: {
      canDiscussPricePerSqft: Boolean(metrics?.metrics.pricePerSqft.calculable),
      canDiscussAcquisitionPlusRehab: Boolean(metrics?.metrics.acquisitionPlusRehab.calculable),
      hasReportedCapRate: Boolean(metrics?.metrics.capRate.calculable && metrics.metrics.capRate.source === 'stored'),
      canCalculateARV: false,
      canCalculateMAO: false,
      canCalculateROI: false,
      canCalculateCashFlow: false,
      hasArvEvaluation: arvEvaluation !== null,
    },
  };
}
