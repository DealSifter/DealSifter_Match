import type { DealAdvisorAnalysis } from './types.ts';
import type { DealMetricsResult } from './dealMetrics.ts';
import type { NormalizedInvestmentProfileResult } from './normalizeInvestmentProfile.ts';
import type { PropertyDetailsLookupResult } from './propertyDetails.ts';
import type { PropertyMatchResult } from './types.ts';
import type { MaxxisPropertyEvidenceResult } from './propertyEvidence.ts';

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
  capabilities: {
    canDiscussPricePerSqft: boolean;
    canDiscussAcquisitionPlusRehab: boolean;
    hasReportedCapRate: boolean;
    canCalculateARV: false;
    canCalculateMAO: false;
    canCalculateROI: false;
    canCalculateCashFlow: false;
  };
};

export async function orchestrateDealInsightContext(input: {
  propertyId: string;
  loadPropertyDetails: (propertyId: string) => Promise<PropertyDetailsLookupResult>;
  loadInvestmentProfile: () => Promise<NormalizedInvestmentProfileResult>;
  calculateMatch: (profile: NormalizedInvestmentProfileResult['profile'], property: PropertyDetailsLookupResult['property']) => PropertyMatchResult;
  loadPropertyEvidence: (propertyId: string) => Promise<MaxxisPropertyEvidenceResult>;
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
      evidence: unavailableEvidence, metrics: null, analysis: null,
      capabilities: {
        canDiscussPricePerSqft: false, canDiscussAcquisitionPlusRehab: false, hasReportedCapRate: false,
        canCalculateARV: false, canCalculateMAO: false, canCalculateROI: false, canCalculateCashFlow: false,
      },
    };
  }
  const [investmentProfile, evidence] = await Promise.all([
    input.loadInvestmentProfile().catch(() => ({ profile: null, exists: false, complete: false })),
    input.loadPropertyEvidence(input.propertyId).catch(() => unavailableEvidence),
  ]);
  const match = investmentProfile.profile
    ? { ...input.calculateMatch(investmentProfile.profile, details.property), semantics: 'profile_fit_only' as const }
    : null;
  const metrics = details.metrics;
  return {
    type: 'deal_insight', propertyId: input.propertyId, state: 'available', property: details.property,
    investmentProfile, match, evidence, metrics, analysis: details.analysis,
    capabilities: {
      canDiscussPricePerSqft: Boolean(metrics?.metrics.pricePerSqft.calculable),
      canDiscussAcquisitionPlusRehab: Boolean(metrics?.metrics.acquisitionPlusRehab.calculable),
      hasReportedCapRate: Boolean(metrics?.metrics.capRate.calculable && metrics.metrics.capRate.source === 'stored'),
      canCalculateARV: false,
      canCalculateMAO: false,
      canCalculateROI: false,
      canCalculateCashFlow: false,
    },
  };
}
