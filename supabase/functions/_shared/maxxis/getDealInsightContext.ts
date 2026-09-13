import { createClient } from 'npm:@supabase/supabase-js@2';
import {
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
  const queryClient = client as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    from: (table: string) => any;
  };
  const loadArvEvaluation = async (propertyId: string) => {
    if (!supabaseServiceRoleKey) return null;
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey) as unknown as PropertyEvidenceBackendClient;
    const soldService = createBackendSoldEvidenceService({
      supabaseAdmin: admin,
      getEnv: (name) => name === 'PROPERTY_DATA_MODE' ? 'disabled' : undefined,
    });
    return loadCachedArvEvaluation({
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
  };
  return orchestrateDealInsightContext({
    propertyId: validated.propertyId,
    loadPropertyDetails: (propertyId) => getPropertyDetailsWithClient({ propertyId }, client),
    loadInvestmentProfile: () => getMyInvestmentProfileWithClient(userId, client),
    calculateMatch: (profile, property) => calculatePropertyMatch(profile, property),
    loadPropertyEvidence: (propertyId) => getPropertyEvidenceForAuthenticatedUser(
      { propertyId }, authHeader, userId, propertyId,
    ),
    loadArvEvaluation,
  });
}
