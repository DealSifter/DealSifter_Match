import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  createBackendValuationEvidenceService,
  createBackendSoldEvidenceService,
  createBackendSupplementalEvidenceService,
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
import {
  buildStructuralCandidatePromotionDiagnostic,
  finalizeCompPromotionDiagnostic,
} from '../property-data/compPromotion.ts';
import {
  estimateRehabBenchmark2026,
  sanityCheckRehabAgainstBenchmark2026,
} from './rehabCostBenchmarks2026.ts';
import { classifyAnalysisApplicability } from './analysisApplicability.ts';
import { resolvePropertyEvidenceAccess } from './propertyEvidenceAccess.ts';
import { mergeVerifiedPropertyEvidenceIntoFacts } from './propertyEvidenceProjection.ts';
import { buildDealDecisionContext } from './dealDecisionContext.ts';
import { buildProviderEvidencePlan, type ProviderEvidencePlan, type ProviderReportLevel } from './providerEvidencePlan.ts';
import type { ValuationEvidenceResult } from '../property-data/valuationTypes.ts';
import type { SoldEvidenceResult } from '../property-data/soldTypes.ts';
import { buildRecentSalesMarketEstimate, providerEstimateDivergence } from '../property-data/recentSalesMarketEstimate.ts';
import type { SupplementalEvidenceBundle } from '../property-data/supplementalEvidenceService.ts';
import type { SupplementalEvidenceFamily } from '../property-data/supplementalEvidenceTypes.ts';
import { parseCanonicalLotArea } from './landMetrics.ts';
import { findRetainedRecentSalesReference } from './retainedReportReference.ts';

const finiteNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const medianNumber = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
function listingSummary(value: any) {
  if (!value || !Array.isArray(value.records)) return null;
  const prices = value.records.map((item: any) => finiteNumber(item.price)).filter((item: number | null): item is number => item !== null);
  const dom = value.records.map((item: any) => finiteNumber(item.daysOnMarket)).filter((item: number | null): item is number => item !== null);
  return { evidenceType: value.evidenceType, provider: value.provider, retrievedAt: value.retrievedAt,
    status: value.status, provenance: value.provenance, totalListings: value.records.length,
    medianAskingPrice: medianNumber(prices), medianDaysOnMarket: medianNumber(dom),
    records: value.records.slice(0, 10) };
}
function rentSummary(value: any) {
  if (!value) return null;
  return { evidenceType: value.evidenceType, provider: value.provider, retrievedAt: value.retrievedAt,
    status: value.status, provenance: value.provenance, rent: value.rent, rangeLow: value.rangeLow,
    rangeHigh: value.rangeHigh, subjectProperty: value.subjectProperty,
    comparableCount: Array.isArray(value.comparables) ? value.comparables.length : 0,
    comparables: Array.isArray(value.comparables) ? value.comparables.slice(0, 5) : [] };
}

export async function getDealInsightContextForAuthenticatedUser(
  input: unknown,
  authHeader: string,
  client: Parameters<typeof getPropertyDetailsWithClient>[1] & Parameters<typeof getMyInvestmentProfileWithClient>[1],
  userId: string,
  contextPropertyId?: string,
  plan: ProviderBudgetPlan = 'FREE',
  languageInput: string = 'en',
  cacheOnly = false,
) {
  const validated = resolveDealInsightInput(input, contextPropertyId);
  const requestedReportType = validated.reportType;
  const maxxisAnalysisOnly = requestedReportType === 'MAXXIS_ANALYSIS';
  const reportRequested = maxxisAnalysisOnly || requestedReportType === 'DEAL_INTELLIGENCE';
  const budgetBucket = reportRequested ? 'report' : 'chat';
  const providerAllowedByPlan = plan !== 'FREE';
  const propertyEvidenceAccess = resolvePropertyEvidenceAccess({ plan, maxxisAnalysisOnly, cacheOnly });
  // Level 2 and cache-only recomputations may consume existing evidence, but never purchase a refresh.
  const allowPropertyProvider = propertyEvidenceAccess.allowProviderFallback;
  const reportLevel = (requestedReportType === 'PROPERTY_RELEASE' || requestedReportType === 'MAXXIS_ANALYSIS'
    || requestedReportType === 'DEAL_INTELLIGENCE' ? requestedReportType : 'CHAT') as ProviderReportLevel;
  let activeProviderEvidencePlan: ProviderEvidencePlan = buildProviderEvidencePlan({
    reportLevel, plan, cacheOnly,
  });
  const shouldLoadValuationEvidence = reportLevel === 'MAXXIS_ANALYSIS' || reportLevel === 'DEAL_INTELLIGENCE';
  const providerEnabled = Deno.env.get('PROPERTY_DATA_MODE') === 'live';
  const runtimeTrace = {
    reportType: reportRequested ? requestedReportType : 'CHAT',
    propertyEvidence: 'UNKNOWN',
    propertyEvidenceReason: 'NOT_REQUESTED',
    valuationEvidence: shouldLoadValuationEvidence ? 'UNKNOWN' : 'NOT_REQUIRED',
    valuationEvidenceReason: shouldLoadValuationEvidence ? 'NOT_REQUESTED' : 'REPORT_LEVEL_NOT_REQUIRED',
    soldEvidence: shouldLoadValuationEvidence ? 'UNKNOWN' : 'NOT_REQUIRED',
    soldEvidenceReason: shouldLoadValuationEvidence ? 'NOT_REQUESTED' : 'REPORT_LEVEL_NOT_REQUIRED',
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
    compPromotionDiagnostics: [] as Array<Record<string, unknown>>,
    arvStatus: 'UNAVAILABLE',
    recomputeMode: cacheOnly ? 'GAP_UPDATE_CACHE_ONLY' : 'STANDARD',
    stopReason: '',
  };
  const queryClient = client as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    from: (table: string) => any;
  };
  let activeAnalysisApplicability: ReturnType<typeof classifyAnalysisApplicability> | null = null;
  const providerEvidenceState: { valuation: ValuationEvidenceResult | null; sold: SoldEvidenceResult | null } = {
    valuation: null,
    sold: null,
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
      const valuationProviderAllowed = activeProviderEvidencePlan.families.VALUATION.providerCallAllowed;
      const valuation = cacheOnly || !valuationProviderAllowed
        ? await valuationService.getCachedValuationEvidence({ propertyId, userId })
        : await valuationService.getValuationEvidence({ propertyId, userId });
      if (!valuation) throw new Error('VALUATION_CACHE_MISS');
      providerEvidenceState.valuation = valuation;
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
      const soldProviderAllowed = activeProviderEvidencePlan.families.RECORDED_SOLD.providerCallAllowed;
      const sold = cacheOnly || !soldProviderAllowed
        ? await soldService.getCachedSoldEvidence({ propertyId, userId })
        : await soldService.getSoldEvidence({ propertyId, userId });
      if (!sold) throw new Error('SOLD_EVIDENCE_CACHE_MISS');
      providerEvidenceState.sold = sold;
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
      runtimeTrace.structuralCandidateCount = sold.recordedSoldCompSelection.primaryStructuralCandidates.length
        + (sold.recordedSoldCompSelection.supportingStructuralCandidates?.length || 0);
      runtimeTrace.usableCandidateCount = sold.recordedSoldCompSelection.conditionVerifiedArvComps.length;
      runtimeTrace.compPromotionDiagnostics = directCandidates.filter((candidate) =>
        (candidate.weightedAssessment?.structuralComparabilityScore ?? -1) >= DEALSIFTER_ARV_ENGINE_POLICY_V1.structuralScoreFloor
        && (candidate.weightedAssessment?.dataCompletenessScore ?? -1) >= DEALSIFTER_ARV_ENGINE_POLICY_V1.completenessFloor)
        .map((candidate) => buildStructuralCandidatePromotionDiagnostic(
          candidate, sold.valuation.subjectProperty,
        ));
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
    if (activeAnalysisApplicability?.residentialArv === 'NOT_APPLICABLE') {
      runtimeTrace.arvStatus = 'NOT_APPLICABLE';
      return null;
    }
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
      if (evaluation) {
        runtimeTrace.compPromotionDiagnostics = runtimeTrace.compPromotionDiagnostics.map((diagnostic) =>
          finalizeCompPromotionDiagnostic(diagnostic as ReturnType<typeof buildStructuralCandidatePromotionDiagnostic>, evaluation));
      }
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
    .select('target_condition,rehab_budget,renovation_scope,rehab_source,declined_inputs,evidence_status,deal_assumptions')
    .eq('subject_property_id', validated.propertyId).eq('reviewer_user_id', userId).maybeSingle();
  const analysisInputs = {
    targetCondition: analysisInputRow?.target_condition ?? null,
    rehabBudget: analysisInputRow?.rehab_budget ?? null,
    renovationScope: analysisInputRow?.renovation_scope ?? null,
    rehabSource: analysisInputRow?.rehab_source ?? null,
    declinedInputs: Array.isArray(analysisInputRow?.declined_inputs) ? analysisInputRow.declined_inputs : [],
    dealAssumptions: analysisInputRow?.deal_assumptions && typeof analysisInputRow.deal_assumptions === 'object'
      ? analysisInputRow.deal_assumptions as Record<string, unknown> : {},
  };
  let activeRehabInputSource: string | null = null;
  const result = await orchestrateDealInsightContext({
    propertyId: validated.propertyId,
    loadPropertyDetails: async (propertyId) => {
      const details = await getPropertyDetailsWithClient({ propertyId }, client);
      activeAnalysisApplicability = classifyAnalysisApplicability(
        details.property as unknown as Record<string, unknown> | null,
        analysisInputs,
      );
      activeProviderEvidencePlan = buildProviderEvidencePlan({
        propertyType: details.property?.type,
        strategy: details.property?.objective,
        reportLevel,
        plan,
        cacheOnly,
      });
      const explicitRehab = analysisInputs.rehabBudget !== null && analysisInputs.rehabBudget !== ''
        && Number.isFinite(Number(analysisInputs.rehabBudget))
        ? Number(analysisInputs.rehabBudget) : null;
      const storedPropertyRehab = Number(details.property?.rehab);
      const benchmarkMayApply = analysisInputs.rehabSource !== 'USER_CURATED_REHAB_BENCHMARK_2026'
        || !Number.isFinite(storedPropertyRehab) || storedPropertyRehab <= 0;
      if (!details.property || explicitRehab === null || !benchmarkMayApply) return details;
      activeRehabInputSource = analysisInputs.rehabSource || 'USER_PROVIDED';
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
        propertyEvidenceAccess.cacheAuthorized ? { plan, bucket: budgetBucket } : undefined,
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
    loadArvEvaluation: shouldLoadValuationEvidence ? loadArvEvaluation : undefined,
    analysisAssumptions: analysisInputs,
  });
  let supplementalEvidence: SupplementalEvidenceBundle | null = null;
  if (supabaseServiceRoleKey && result.property) {
    const familyPlan: Array<[SupplementalEvidenceFamily, keyof ProviderEvidencePlan['families']]> = [
      ['saleListings', 'SALE_LISTINGS'], ['rentEstimate', 'RENT_ESTIMATE'],
      ['rentalListings', 'RENTAL_COMPS'], ['market', 'MARKET_DATA'],
    ];
    const families = familyPlan.filter(([, planFamily]) => activeProviderEvidencePlan.families[planFamily].cacheReadAllowed)
      .map(([family]) => family);
    if (families.length) {
      const admin = createClient(supabaseUrl, supabaseServiceRoleKey) as unknown as PropertyEvidenceBackendClient;
      const supplementalService = createBackendSupplementalEvidenceService({
        supabaseAdmin: admin, getEnv: (name) => Deno.env.get(name),
        providerBudgetContext: { userId, propertyId: validated.propertyId, plan, bucket: budgetBucket },
      });
      const providerFamilies = familyPlan.filter(([family, planFamily]) => families.includes(family)
        && activeProviderEvidencePlan.families[planFamily].providerCallAllowed).map(([family]) => family);
      // Cache-only levels never purchase missing market/listing/rental evidence.
      supplementalEvidence = await supplementalService.getBundle({ propertyId: validated.propertyId, userId,
        families, cacheOnly: cacheOnly || providerFamilies.length === 0 });
      // If only a subset is provider-authorized, load the remainder cache-first and then only the authorized subset.
      if (!cacheOnly && providerFamilies.length > 0 && providerFamilies.length < families.length) {
        supplementalEvidence = await supplementalService.getBundle({ propertyId: validated.propertyId, userId,
          families: providerFamilies, cacheOnly: false });
      }
    }
  }
  if (!runtimeTrace.stopReason) runtimeTrace.stopReason = result.state === 'available' ? 'NONE' : 'PROPERTY_NOT_FOUND';
  const evidenceCompleteness = buildEvidenceCompleteness({
    reportType: requestedReportType,
    evidenceState: result.evidence.state,
    context: result.dealIntelligence || null,
    trace: runtimeTrace,
  });
  const evidenceCompletenessGate = buildEvidenceCompletenessGate({
    reportType: requestedReportType || (plan === 'ENTERPRISE' ? 'DEAL_INTELLIGENCE' : ''),
    property: result.property as unknown as Record<string, unknown> | null,
    assumptions: analysisInputs,
    language: languageInput,
  });
  const analysisApplicability = activeAnalysisApplicability || classifyAnalysisApplicability(
    result.property as unknown as Record<string, unknown> | null, analysisInputs,
  );
  const rehabNotApplicable = analysisApplicability.rehab === 'NOT_APPLICABLE';
  const rehabBenchmark = rehabNotApplicable ? null : estimateRehabBenchmark2026({
    state: result.property?.state,
    livingAreaSqft: result.property?.sqft,
    condition: analysisInputs.targetCondition,
  });
  const activeRehab = Number(result.property?.rehab);
  const explicitRehab = Boolean(activeRehabInputSource);
  const rehabAnalysis = {
    applicability: analysisApplicability.rehab,
    value: rehabNotApplicable ? null : Number.isFinite(activeRehab) && activeRehab >= 0 ? activeRehab : null,
    source: rehabNotApplicable ? null : explicitRehab
      ? activeRehabInputSource || 'USER_PROVIDED'
      : Number.isFinite(activeRehab) && activeRehab > 0 ? 'PROPERTY_APP_VALUE' : null,
    provenance: rehabNotApplicable ? 'NOT_APPLICABLE' : explicitRehab && activeRehabInputSource === 'USER_CURATED_REHAB_BENCHMARK_2026'
      ? 'ESTIMATED' : explicitRehab ? 'USER_PROVIDED' : Number.isFinite(activeRehab) && activeRehab > 0 ? 'REPORTED' : 'UNAVAILABLE',
    confidence: explicitRehab && activeRehabInputSource === 'USER_CURATED_REHAB_BENCHMARK_2026' ? 'LOW' : null,
    benchmark: rehabBenchmark,
    sanityCheck: sanityCheckRehabAgainstBenchmark2026(activeRehab, rehabBenchmark),
    providerCalls: 0,
  } as const;
  const providerEstimateValue = providerEvidenceState.valuation?.valuation.providerEstimate.value.value ?? null;
  const providerEstimateLow = providerEvidenceState.valuation?.valuation.providerEstimate.rangeLow.value ?? null;
  const providerEstimateHigh = providerEvidenceState.valuation?.valuation.providerEstimate.rangeHigh.value ?? null;
  const soldStatistics = providerEvidenceState.sold?.recordedSoldCompSelection.descriptiveStatistics || null;
  const propertyConflicts = result.evidence.state === 'available' ? result.evidence.evidence?.conflicts || [] : [];
  const providerSubjectType = providerEvidenceState.valuation?.valuation.subjectProperty.propertyType.value
    ?? (result.evidence.state === 'available' ? result.evidence.evidence?.fields?.propertyType?.value : null);
  const materialIdentityConflict = propertyConflicts.some((conflict) =>
    conflict.resolution === 'UNRESOLVED' && conflict.classification === 'CRITICAL_IDENTITY');
  const recentSalesSubject = {
    propertyType: result.property?.type || null,
    livingAreaSqft: Number.isFinite(Number(result.property?.sqft)) ? Number(result.property?.sqft) : null,
    lotSizeSqft: Number(result.dealIntelligence?.propertyContext?.fields?.lotSizeSqft?.value)
      || parseCanonicalLotArea(result.property?.lot).lotSizeSqft,
    providerPropertyType: typeof providerSubjectType === 'string' ? providerSubjectType : null,
    materialIdentityConflict,
  };
  const recentSalesMarketEstimate = providerEvidenceState.sold
    ? buildRecentSalesMarketEstimate(recentSalesSubject,
      providerEvidenceState.sold.recordedSoldCompSelection.directSoldCompCandidates)
    : recentSalesSubject.providerPropertyType
      ? buildRecentSalesMarketEstimate(recentSalesSubject, [])
      : null;
  const evidenceFreshness = {
    property: result.evidence.state === 'available' ? result.evidence.evidence?.freshness || null : null,
    valuation: providerEvidenceState.valuation?.freshness || null,
    sold: providerEvidenceState.sold?.freshness || null,
    supplemental: supplementalEvidence?.freshness || {},
  };
  let savedRecentSalesReference = null;
  if (recentSalesMarketEstimate?.status !== 'AVAILABLE' && result.property && propertyEvidenceAccess.cacheAuthorized) {
    try {
      const { data: reports } = await queryClient.from('maxxis_reports').select('id,created_at,report_payload')
        .eq('property_id', validated.propertyId).eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
      savedRecentSalesReference = await findRetainedRecentSalesReference(reports || [], result.property as unknown as import('../property-data/propertyEvidenceTypes.ts').InternalPropertyRecord);
    } catch { /* failure of a historical reference never stops app-based analysis */ }
  }
  const providerMarketContext = {
    evidenceFreshness,
    providerAvailability: providerEvidenceState.valuation?.providerAvailability || providerEvidenceState.sold?.providerAvailability || 'UNKNOWN',
    savedRecentSalesReference,
    providerEstimate: Number.isFinite(Number(providerEstimateValue)) ? Number(providerEstimateValue) : null,
    providerEstimateRange: Number.isFinite(Number(providerEstimateLow)) && Number.isFinite(Number(providerEstimateHigh))
      ? { low: Number(providerEstimateLow), high: Number(providerEstimateHigh) } : null,
    providerComparableCount: providerEvidenceState.valuation?.valuation.providerComparableCount || 0,
    recordedSoldCount: providerEvidenceState.sold?.soldPool.records.length || 0,
    supportingMarketSalesCount: providerEvidenceState.sold?.recordedSoldCompSelection.directSoldCompCandidates.length || 0,
    medianRecordedSalePrice: soldStatistics?.medianRecordedSalePrice ?? null,
    minimumRecordedSalePrice: soldStatistics?.minimumRecordedSalePrice ?? null,
    maximumRecordedSalePrice: soldStatistics?.maximumRecordedSalePrice ?? null,
    recentSalesMarketEstimate,
    providerEstimateDivergence: recentSalesMarketEstimate
      ? providerEstimateDivergence(Number.isFinite(Number(providerEstimateValue)) ? Number(providerEstimateValue) : null, recentSalesMarketEstimate)
      : null,
    providerAvmCompatibility: recentSalesMarketEstimate?.providerAvmCompatibility || 'UNKNOWN',
    saleListings: listingSummary(supplementalEvidence?.saleListings),
    rentEstimate: rentSummary(supplementalEvidence?.rentEstimate),
    rentalListings: listingSummary(supplementalEvidence?.rentalListings),
    market: supplementalEvidence?.market || null,
    source: providerEvidenceState.valuation || providerEvidenceState.sold ? 'CACHED_OR_AUTHORIZED_PROVIDER_EVIDENCE' : 'UNAVAILABLE',
  } as const;
  const enrichedDealIntelligence = result.dealIntelligence ? {
    ...result.dealIntelligence,
    valuationContext: providerMarketContext.providerEstimate !== null
      && !result.dealIntelligence.valuationContext.providerEstimate
      ? {
          ...result.dealIntelligence.valuationContext,
          providerEstimate: {
            value: providerMarketContext.providerEstimate,
            status: 'PROVIDER_ESTIMATE_UNVALIDATED',
            provenance: 'ESTIMATED' as const,
          },
        }
      : result.dealIntelligence.valuationContext,
    providerMarketContext,
  } : null;
  const intelligenceSnapshotBase = {
    version: 'MAXXIS_INTELLIGENCE_SNAPSHOT_V1',
    propertyId: result.propertyId,
    propertyFacts: mergeVerifiedPropertyEvidenceIntoFacts(
      result.property as unknown as Record<string, unknown> | null,
      enrichedDealIntelligence?.propertyContext || null,
      { valuationReferences: {
        providerEstimate: providerMarketContext.providerEstimate === null ? null : {
          value: providerMarketContext.providerEstimate,
          range: providerMarketContext.providerEstimateRange,
          status: 'PROVIDER_ESTIMATE_UNVALIDATED',
        },
        recentSalesMarketEstimate,
      } },
    ),
    ownerLandFacts: result.dealIntelligence?.propertyContext || null,
    investmentProfile: result.investmentProfile,
    matchScore: result.match,
    propertyEvidence: result.evidence,
    providerEvidence: result.evidence.state === 'available' ? result.evidence.evidence || null : null,
    soldEvidence: enrichedDealIntelligence?.comparableEvidence || [],
    comps: enrichedDealIntelligence?.comparableEvidence || [],
    compPromotionDiagnostics: runtimeTrace.compPromotionDiagnostics,
    valuationEvidence: enrichedDealIntelligence?.valuationContext || null,
    providerMarketContext,
    recentSalesMarketEstimate,
    listingEvidence: listingSummary(supplementalEvidence?.saleListings),
    rentalEvidence: {
      rentEstimate: rentSummary(supplementalEvidence?.rentEstimate),
      rentalListings: listingSummary(supplementalEvidence?.rentalListings),
    },
    marketEvidence: supplementalEvidence?.market || null,
    providerEvidencePlan: activeProviderEvidencePlan,
    arv: enrichedDealIntelligence?.valuationContext || null,
    dealMetrics: result.metrics,
    investmentKPIs: enrichedDealIntelligence?.dealMetrics || null,
    rehabAnalysis,
    riskSignals: enrichedDealIntelligence?.risks || [],
    positiveSignals: enrichedDealIntelligence?.opportunities || [],
    missingEvidence: enrichedDealIntelligence?.limitations || [],
    recommendations: enrichedDealIntelligence?.recommendedActions || [],
    provenance: enrichedDealIntelligence?.evidenceSummary || null,
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
    dealAssumptions: analysisInputs.dealAssumptions,
    analysisApplicability,
    dealIntelligence: enrichedDealIntelligence,
  } as const;
  const dealDecisionContext = buildDealDecisionContext(intelligenceSnapshotBase);
  const intelligenceSnapshot = {
    ...intelligenceSnapshotBase,
    dealDecisionContext,
  } as const;
  const structuredAnalysis = buildMaxxisStructuredAnalysis(intelligenceSnapshot, requestedReportType, languageInput);
  return { ...result, dealIntelligence: enrichedDealIntelligence, intelligenceSnapshot, structuredAnalysis, evidenceCompleteness,
    evidenceCompletenessGate, runtimeTrace };
}
