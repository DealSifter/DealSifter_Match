import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  createBackendValuationEvidenceService,
  createBackendSoldEvidenceService,
  type PropertyEvidenceBackendClient,
} from '../property-data/backendFactory.ts';
import { calculatePropertyMatch } from './calculatePropertyMatch.ts';
import { loadCachedArvEvaluation } from './cachedArvEvaluation.ts';
import { supabaseServiceRoleKey, supabaseUrl } from './config.ts';
import { getPropertyEvidenceForAuthenticatedUser } from './getPropertyEvidence.ts';
import { getMyInvestmentProfileWithClient } from './getMyInvestmentProfile.ts';
import { orchestrateDealInsightContext } from './dealInsightContext.ts';
import { getPropertyDetailsWithClient } from './propertyDetails.ts';
import { resolveDealInsightInput } from './dealInsightInput.ts';
import type { ProviderBudgetPlan } from '../property-data/providerBudget.ts';
import { buildEvidenceCompleteness } from './evidenceCompleteness.ts';
import { buildMaxxisStructuredAnalysis } from './maxxisStructuredAnalysis.ts';
import { buildEvidenceCompletenessGate } from './analysisGapResolver.ts';
import { calculateDealMetrics } from './dealMetrics.ts';
import { analyzeDealFacts } from './dealAdvisor.ts';
import { DEALSIFTER_ARV_ENGINE_POLICY_V1 } from '../property-data/arvEngine.ts';

export async function getDealInsightContextForAuthenticatedUser(
  input: unknown,
  authHeader: string,
  client: Parameters<typeof getPropertyDetailsWithClient>[1] & Parameters<typeof getMyInvestmentProfileWithClient>[1],
  userId: string,
  contextPropertyId?: string,
  plan: ProviderBudgetPlan = 'FREE',
  languageInput: string = 'en',
) {
  const validated = resolveDealInsightInput(input, contextPropertyId);
  const requestedReportType = validated.reportType;
  const maxxisAnalysisOnly = requestedReportType === 'MAXXIS_ANALYSIS';
  const reportRequested = maxxisAnalysisOnly || requestedReportType === 'DEAL_INTELLIGENCE';
  const budgetBucket = reportRequested ? 'report' : 'chat';
  const providerAllowedByPlan = plan !== 'FREE';
  // Level 2 analysis must remain cache-only; it does not purchase or refresh evidence.
  const allowPropertyProvider = providerAllowedByPlan && !maxxisAnalysisOnly;
  const allowValuationProvider = providerAllowedByPlan && requestedReportType === 'DEAL_INTELLIGENCE';
  const providerEnabled = Deno.env.get('PROPERTY_DATA_MODE') === 'live';
  const runtimeTrace = {
    reportType: reportRequested ? requestedReportType : 'CHAT',
    propertyEvidence: 'UNKNOWN',
    propertyEvidenceReason: 'NOT_REQUESTED',
    valuationEvidence: allowValuationProvider ? 'UNKNOWN' : 'NOT_REQUIRED',
    valuationEvidenceReason: allowValuationProvider ? 'NOT_REQUESTED' : 'CAPABILITY_NOT_AUTHORIZED',
    soldEvidence: allowValuationProvider ? 'UNKNOWN' : 'NOT_REQUIRED',
    soldEvidenceReason: allowValuationProvider ? 'NOT_REQUESTED' : 'CAPABILITY_NOT_AUTHORIZED',
    providerEnabled,
    providerAllowedByCapability: allowPropertyProvider,
    providerBudgetBucket: budgetBucket,
    providerPlan: plan,
    providerAttempted: false,
    propertyProviderAttempted: false,
    soldProviderAttempted: false,
    valuationProviderAttempted: false,
    providerResult: providerAllowedByPlan ? 'NOT_ATTEMPTED' : 'PLAN_ZERO_PROVIDER',
    addressValidation: 'NOT_RUN',
    candidateCount: 0,
    valuationProviderComparableCount: 0,
    valuationNormalizedComparableCount: 0,
    valuationCompEngineReceived: 0,
    valuationCompStrong: 0,
    valuationCompUsable: 0,
    valuationCompHardRejected: 0,
    soldRawCandidateCount: 0,
    soldNormalizedCandidateCount: 0,
    hardGatePassCount: 0,
    structuralThresholdPassCount: 0,
    completenessThresholdPassCount: 0,
    excellentCandidateCount: 0,
    validCandidateCount: 0,
    supportingCandidateCount: 0,
    weakCandidateCount: 0,
    excludedCandidateCount: 0,
    arvEligibleCount: 0,
    structuralCandidateCount: 0,
    usableCandidateCount: 0,
    arvStatus: 'UNAVAILABLE',
    stopReason: '',
  };
  const queryClient = client as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    from: (table: string) => any;
  };
  const loadArvEvaluation = async (propertyId: string) => {
    if (!supabaseServiceRoleKey) {
      runtimeTrace.stopReason = 'PROPERTY_INTELLIGENCE_BACKEND_UNAVAILABLE';
      return null;
    }
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey) as unknown as PropertyEvidenceBackendClient;
    const getEnv = (name: string) => Deno.env.get(name);
    const providerBudgetContext = { userId, propertyId, plan, bucket: budgetBucket } as const;
    const valuationService = createBackendValuationEvidenceService({ supabaseAdmin: admin, getEnv, providerBudgetContext });
    const soldService = createBackendSoldEvidenceService({
      supabaseAdmin: admin,
      getEnv,
      providerBudgetContext,
    });
    try {
      runtimeTrace.addressValidation = 'ACCEPTED';
      const valuation = await valuationService.getValuationEvidence({ propertyId, userId });
      runtimeTrace.valuationEvidence = valuation.cacheHit ? 'HIT' : 'MISS_REFRESHED';
      runtimeTrace.valuationEvidenceReason = valuation.cacheHit ? 'CACHE_HIT' : 'PROVIDER_REFRESHED';
      runtimeTrace.valuationProviderAttempted = !valuation.cacheHit;
      runtimeTrace.providerAttempted ||= !valuation.cacheHit;
      runtimeTrace.valuationProviderComparableCount = valuation.valuation.providerComparableCount;
      runtimeTrace.valuationNormalizedComparableCount = valuation.valuation.comparables.length;
      runtimeTrace.valuationCompEngineReceived = valuation.comparableAnalysis.counts.total;
      runtimeTrace.valuationCompStrong = valuation.comparableAnalysis.counts.strong;
      runtimeTrace.valuationCompUsable = valuation.comparableAnalysis.counts.usable;
      runtimeTrace.valuationCompHardRejected = valuation.comparableAnalysis.counts.hardRejected;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'VALUATION_EVIDENCE_FAILED';
      runtimeTrace.valuationEvidence = code === 'ADDRESS_MISMATCH' ? 'REJECTED' : 'UNAVAILABLE';
      runtimeTrace.valuationEvidenceReason = code;
      runtimeTrace.valuationProviderAttempted = code === 'ADDRESS_MISMATCH' || /(?:RENTCAST|PROVIDER_HTTP|PROVIDER_TIMEOUT)/.test(code);
      runtimeTrace.providerAttempted ||= runtimeTrace.valuationProviderAttempted;
      if (code === 'ADDRESS_MISMATCH') {
        runtimeTrace.stopReason = code;
        runtimeTrace.providerResult = code;
        runtimeTrace.addressValidation = 'REJECTED';
        throw error;
      }
    }
    let soldEvidenceLoaded = false;
    try {
      const sold = await soldService.getSoldEvidence({ propertyId, userId });
      soldEvidenceLoaded = true;
      runtimeTrace.soldEvidence = sold.cacheHit ? 'HIT' : 'MISS_REFRESHED';
      runtimeTrace.soldEvidenceReason = sold.cacheHit ? 'CACHE_HIT' : 'PROVIDER_REFRESHED';
      runtimeTrace.soldProviderAttempted = !sold.cacheHit;
      runtimeTrace.providerAttempted ||= !sold.cacheHit;
      runtimeTrace.candidateCount = sold.soldPool.records.length;
      runtimeTrace.soldRawCandidateCount = sold.soldPool.recordsReturned;
      runtimeTrace.soldNormalizedCandidateCount = sold.soldPool.records.length;
      const directCandidates = sold.recordedSoldCompSelection.directSoldCompCandidates;
      runtimeTrace.hardGatePassCount = directCandidates.filter((candidate) => candidate.weightedAssessment?.hardGates.pass).length;
      runtimeTrace.structuralThresholdPassCount = directCandidates.filter((candidate) =>
        (candidate.weightedAssessment?.structuralComparabilityScore ?? -1) >= DEALSIFTER_ARV_ENGINE_POLICY_V1.structuralScoreFloor).length;
      runtimeTrace.completenessThresholdPassCount = directCandidates.filter((candidate) =>
        (candidate.weightedAssessment?.dataCompletenessScore ?? -1) >= DEALSIFTER_ARV_ENGINE_POLICY_V1.completenessFloor).length;
      runtimeTrace.excellentCandidateCount = directCandidates.filter((candidate) =>
        candidate.weightedAssessment?.structuralClass === 'EXCELLENT_STRUCTURAL_CANDIDATE').length;
      runtimeTrace.validCandidateCount = directCandidates.filter((candidate) =>
        candidate.weightedAssessment?.structuralClass === 'VALID_STRUCTURAL_CANDIDATE').length;
      runtimeTrace.supportingCandidateCount = directCandidates.filter((candidate) =>
        candidate.weightedAssessment?.structuralClass === 'SUPPORTING_ACCEPTABLE').length;
      runtimeTrace.weakCandidateCount = sold.recordedSoldCompSelection.weak.length;
      runtimeTrace.excludedCandidateCount = sold.recordedSoldCompSelection.hardInvalid.length;
      runtimeTrace.structuralCandidateCount = sold.recordedSoldCompSelection.primaryStructuralCandidates.length;
      runtimeTrace.usableCandidateCount = sold.recordedSoldCompSelection.conditionVerifiedArvComps.length;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'SOLD_EVIDENCE_FAILED';
      runtimeTrace.soldEvidence = code === 'ADDRESS_MISMATCH' ? 'REJECTED' : 'UNAVAILABLE';
      runtimeTrace.soldEvidenceReason = code;
      runtimeTrace.soldProviderAttempted = code === 'ADDRESS_MISMATCH' || /(?:RENTCAST|PROVIDER_HTTP|PROVIDER_TIMEOUT)/.test(code);
      runtimeTrace.providerAttempted ||= runtimeTrace.soldProviderAttempted;
      if (code === 'ADDRESS_MISMATCH') {
        runtimeTrace.stopReason = code;
        runtimeTrace.providerResult = code;
        runtimeTrace.addressValidation = 'REJECTED';
        throw error;
      }
    }
    runtimeTrace.providerResult = runtimeTrace.providerAttempted ? 'ACCEPTED'
      : runtimeTrace.valuationEvidence === 'HIT' || runtimeTrace.soldEvidence === 'HIT' ? 'CACHE_HIT'
      : runtimeTrace.valuationEvidenceReason !== 'NOT_REQUESTED' ? runtimeTrace.valuationEvidenceReason
      : runtimeTrace.soldEvidenceReason;
    if (!soldEvidenceLoaded) return null;
    try {
      const evaluation = await loadCachedArvEvaluation({
        propertyId,
        userId,
        hasEntitlement: async (subjectPropertyId) => {
          if (plan === 'PRO' || plan === 'ENTERPRISE') return true;
          const { data, error } = await queryClient.rpc('ds_has_property_intelligence_entitlement', {
            p_property_id: subjectPropertyId, p_unlock_type: 'property_record',
          });
          if (error) throw new Error('PROPERTY_INTELLIGENCE_ENTITLEMENT_CHECK_FAILED');
          return data === true;
        },
        loadCachedSoldEvidence: (subjectPropertyId, authenticatedUserId) => soldService.getCachedSoldEvidence({
          propertyId: subjectPropertyId, userId: authenticatedUserId,
        }),
        loadTargetCondition: async (subjectPropertyId, authenticatedUserId) => {
          const { data, error } = await queryClient.from('property_arv_review_contexts').select('target_condition')
            .eq('subject_property_id', subjectPropertyId).eq('reviewer_user_id', authenticatedUserId).maybeSingle();
          if (error) throw new Error('ARV_TARGET_READ_FAILED');
          return data?.target_condition;
        },
        loadReviews: async (subjectPropertyId, authenticatedUserId) => {
          const { data, error } = await queryClient.from('property_comp_condition_reviews')
            .select('comp_identifier,target_condition,observed_condition,condition_compatibility,notes,evidence_status,reviewed_at,reviewer_user_id,policy_version')
            .eq('subject_property_id', subjectPropertyId).eq('reviewer_user_id', authenticatedUserId);
          if (error) throw new Error('ARV_REVIEW_READ_FAILED');
          return Array.isArray(data) ? data : [];
        },
      });
      runtimeTrace.arvStatus = evaluation?.status || 'UNAVAILABLE';
      runtimeTrace.arvEligibleCount = evaluation?.eligibleCompCount || 0;
      runtimeTrace.supportingCandidateCount = evaluation?.supportingCompCount
        ?? runtimeTrace.supportingCandidateCount;
      runtimeTrace.excludedCandidateCount = evaluation?.excludedCompCount
        ?? runtimeTrace.excludedCandidateCount;
      return evaluation;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PROPERTY_INTELLIGENCE_FAILED';
      runtimeTrace.stopReason = code;
      runtimeTrace.providerResult = code;
      if (code === 'ADDRESS_MISMATCH') {
        runtimeTrace.addressValidation = 'REJECTED';
        throw error;
      }
      return null;
    }
  };
  const { data: analysisInputRow } = await queryClient.from('property_arv_review_contexts')
    .select('target_condition,rehab_budget,renovation_scope,declined_inputs,evidence_status')
    .eq('subject_property_id', validated.propertyId).eq('reviewer_user_id', userId).maybeSingle();
  const analysisInputs = {
    targetCondition: analysisInputRow?.target_condition ?? null,
    rehabBudget: analysisInputRow?.rehab_budget ?? null,
    renovationScope: analysisInputRow?.renovation_scope ?? null,
    declinedInputs: Array.isArray(analysisInputRow?.declined_inputs) ? analysisInputRow.declined_inputs : [],
  };
  const result = await orchestrateDealInsightContext({
    propertyId: validated.propertyId,
    loadPropertyDetails: async (propertyId) => {
      const details = await getPropertyDetailsWithClient({ propertyId }, client);
      const explicitRehab = analysisInputs.rehabBudget !== null && analysisInputs.rehabBudget !== ''
        && Number.isFinite(Number(analysisInputs.rehabBudget))
        ? Number(analysisInputs.rehabBudget) : null;
      if (!details.property || explicitRehab === null) return details;
      const property = { ...details.property, rehab: explicitRehab };
      const missingFields = details.missingFields.filter((field) => field !== 'rehab');
      const metrics = calculateDealMetrics({
        price: property.price, sqft: property.sqft, rehab: explicitRehab,
        capRate: property.capRate, rehabProvided: true,
      });
      return { ...details, property, missingFields, metrics,
        analysis: analyzeDealFacts({ property, metrics, missingFields }) };
    },
    loadInvestmentProfile: () => getMyInvestmentProfileWithClient(userId, client),
    calculateMatch: (profile, property) => calculatePropertyMatch(profile, property),
    loadPropertyEvidence: async (propertyId) => {
      const evidence = await getPropertyEvidenceForAuthenticatedUser(
        { propertyId }, authHeader, userId, propertyId, allowPropertyProvider,
        allowPropertyProvider ? { plan, bucket: budgetBucket } : undefined,
      );
      runtimeTrace.propertyEvidence = evidence.cacheState.toUpperCase();
      runtimeTrace.propertyEvidenceReason = evidence.reason || (evidence.state === 'available'
        ? evidence.cacheState === 'hit' ? 'CACHE_HIT' : 'PROVIDER_REFRESHED'
        : 'PROPERTY_EVIDENCE_UNAVAILABLE');
      runtimeTrace.propertyProviderAttempted = Boolean(evidence.providerAttempted);
      if (evidence.state === 'available' && evidence.evidence?.cacheHit === false) {
        runtimeTrace.providerAttempted = true;
        runtimeTrace.providerResult = 'ACCEPTED';
      } else if (evidence.state !== 'available' && evidence.reason) {
        runtimeTrace.providerResult = evidence.reason;
      }
      return evidence;
    },
    loadArvEvaluation: allowValuationProvider ? loadArvEvaluation : undefined,
  });
  if (!runtimeTrace.stopReason) runtimeTrace.stopReason = result.state === 'available' ? 'NONE' : 'PROPERTY_NOT_FOUND';
  const evidenceCompleteness = buildEvidenceCompleteness({
    reportType: requestedReportType,
    evidenceState: result.evidence.state,
    context: result.dealIntelligence || null,
    trace: runtimeTrace,
  });
  const evidenceCompletenessGate = buildEvidenceCompletenessGate({
    reportType: requestedReportType,
    property: result.property as unknown as Record<string, unknown> | null,
    assumptions: analysisInputs,
    language: languageInput,
  });
  const intelligenceSnapshot = {
    version: 'MAXXIS_INTELLIGENCE_SNAPSHOT_V1',
    propertyId: result.propertyId,
    propertyFacts: result.property,
    ownerLandFacts: result.dealIntelligence?.propertyContext || null,
    investmentProfile: result.investmentProfile,
    matchScore: result.match,
    propertyEvidence: result.evidence,
    providerEvidence: result.evidence.state === 'available' ? result.evidence.evidence || null : null,
    soldEvidence: result.dealIntelligence?.comparableEvidence || [],
    comps: result.dealIntelligence?.comparableEvidence || [],
    valuationEvidence: result.dealIntelligence?.valuationContext || null,
    arv: result.dealIntelligence?.valuationContext || null,
    dealMetrics: result.metrics,
    investmentKPIs: result.dealIntelligence?.dealMetrics || null,
    riskSignals: result.dealIntelligence?.risks || [],
    positiveSignals: result.dealIntelligence?.opportunities || [],
    missingEvidence: result.dealIntelligence?.limitations || [],
    recommendations: result.dealIntelligence?.recommendedActions || [],
    provenance: result.dealIntelligence?.evidenceSummary || null,
    generatedAt: new Date().toISOString(),
    cacheStatus: {
      property: runtimeTrace.propertyEvidence,
      sold: runtimeTrace.soldEvidence,
      valuation: runtimeTrace.valuationEvidence,
    },
    plan,
    capabilities: result.capabilities,
    providerBudgetStatus: {
      bucket: runtimeTrace.providerBudgetBucket,
      providerAllowed: runtimeTrace.providerAllowedByCapability,
      providerAttempted: runtimeTrace.providerAttempted,
      result: runtimeTrace.providerResult,
    },
    evidenceCompleteness,
    evidenceCompletenessGate,
    dealIntelligence: result.dealIntelligence,
  } as const;
  const structuredAnalysis = buildMaxxisStructuredAnalysis(intelligenceSnapshot, requestedReportType, languageInput);
  return { ...result, intelligenceSnapshot, structuredAnalysis, evidenceCompleteness,
    evidenceCompletenessGate, runtimeTrace };
}
