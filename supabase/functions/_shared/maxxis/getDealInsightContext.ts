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
import { getPropertyDetailsWithClient, resolvePropertyDetailsInput } from './propertyDetails.ts';

export async function getDealInsightContextForAuthenticatedUser(
  input: unknown,
  authHeader: string,
  client: Parameters<typeof getPropertyDetailsWithClient>[1] & Parameters<typeof getMyInvestmentProfileWithClient>[1],
  userId: string,
  contextPropertyId?: string,
) {
  const validated = resolvePropertyDetailsInput(input, contextPropertyId);
  const requestedReportType = input && typeof input === 'object'
    ? String((input as Record<string, unknown>).reportType || '').trim().toUpperCase()
    : '';
  const maxxisAnalysisOnly = requestedReportType === 'MAXXIS_ANALYSIS';
  const providerEnabled = Deno.env.get('PROPERTY_DATA_MODE') === 'live';
  const runtimeTrace = {
    reportType: maxxisAnalysisOnly ? 'MAXXIS_ANALYSIS' : 'DEAL_INTELLIGENCE',
    propertyEvidence: 'UNKNOWN',
    valuationEvidence: maxxisAnalysisOnly ? 'NOT_REQUIRED' : 'UNKNOWN',
    soldEvidence: maxxisAnalysisOnly ? 'NOT_REQUIRED' : 'UNKNOWN',
    providerEnabled,
    providerAllowedByCapability: !maxxisAnalysisOnly,
    providerAttempted: false,
    providerResult: maxxisAnalysisOnly ? 'NOT_REQUIRED' : 'NOT_ATTEMPTED',
    addressValidation: 'NOT_RUN',
    candidateCount: 0,
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
    const valuationService = createBackendValuationEvidenceService({ supabaseAdmin: admin, getEnv });
    const soldService = createBackendSoldEvidenceService({
      supabaseAdmin: admin,
      getEnv,
    });
    try {
      const valuation = await valuationService.getValuationEvidence({ propertyId, userId });
      runtimeTrace.valuationEvidence = valuation.cacheHit ? 'HIT' : 'MISS_REFRESHED';
      runtimeTrace.providerAttempted ||= !valuation.cacheHit;
      const sold = await soldService.getSoldEvidence({ propertyId, userId });
      runtimeTrace.soldEvidence = sold.cacheHit ? 'HIT' : 'MISS_REFRESHED';
      runtimeTrace.providerAttempted ||= !sold.cacheHit;
      runtimeTrace.candidateCount = sold.soldPool.records.length;
      runtimeTrace.structuralCandidateCount = sold.recordedSoldCompSelection.primaryStructuralCandidates.length;
      runtimeTrace.usableCandidateCount = sold.recordedSoldCompSelection.conditionVerifiedArvComps.length;
      runtimeTrace.providerResult = runtimeTrace.providerAttempted ? 'ACCEPTED' : 'CACHE_HIT';
      runtimeTrace.addressValidation = 'ACCEPTED';
      const evaluation = await loadCachedArvEvaluation({
        propertyId,
        userId,
        hasEntitlement: async (subjectPropertyId) => {
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
      return evaluation;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'PROPERTY_INTELLIGENCE_FAILED';
      runtimeTrace.stopReason = code;
      runtimeTrace.providerAttempted = providerEnabled;
      runtimeTrace.providerResult = code;
      runtimeTrace.addressValidation = code === 'ADDRESS_MISMATCH' ? 'REJECTED' : 'NOT_CONFIRMED';
      throw error;
    }
  };
  const result = await orchestrateDealInsightContext({
    propertyId: validated.propertyId,
    loadPropertyDetails: (propertyId) => getPropertyDetailsWithClient({ propertyId }, client),
    loadInvestmentProfile: () => getMyInvestmentProfileWithClient(userId, client),
    calculateMatch: (profile, property) => calculatePropertyMatch(profile, property),
    loadPropertyEvidence: async (propertyId) => {
      const evidence = await getPropertyEvidenceForAuthenticatedUser(
        { propertyId }, authHeader, userId, propertyId, !maxxisAnalysisOnly,
      );
      runtimeTrace.propertyEvidence = evidence.cacheState.toUpperCase();
      if (evidence.state === 'available' && evidence.evidence?.cacheHit === false) {
        runtimeTrace.providerAttempted = true;
        runtimeTrace.providerResult = 'ACCEPTED';
      }
      return evidence;
    },
    loadArvEvaluation: maxxisAnalysisOnly ? undefined : loadArvEvaluation,
  });
  if (!runtimeTrace.stopReason) runtimeTrace.stopReason = result.state === 'available' ? 'NONE' : 'PROPERTY_NOT_FOUND';
  return { ...result, runtimeTrace };
}
