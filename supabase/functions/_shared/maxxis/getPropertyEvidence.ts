import type {ProviderTrace} from '../property-data/providerTrace.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createBackendPropertyEvidenceService, type PropertyEvidenceBackendClient } from '../property-data/backendFactory.ts';
import { SupabasePropertyIntelligenceCache } from '../property-data/cache.ts';
import { PropertyEvidenceService } from '../property-data/propertyEvidenceService.ts';
import { SupabasePropertyEvidenceRepository } from '../property-data/propertyRepository.ts';
import type { PropertyDataProvider } from '../property-data/types.ts';
import { resolvePropertyDetailsInput } from './propertyDetails.ts';
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from './config.ts';
import { getPropertyEvidenceWithDependencies } from './propertyEvidence.ts';
import type { ProviderBudgetBucket, ProviderBudgetPlan } from '../property-data/providerBudget.ts';
import { trackedProviderFetch, type ProviderExecution } from '../property-data/providerExecution.ts';

export async function getPropertyEvidenceForAuthenticatedUser(
  input: unknown,
  authHeader: string,
  userId: string,
  contextPropertyId?: string,
  allowProviderFallback = false,
  providerBudget?: { plan: ProviderBudgetPlan; bucket: ProviderBudgetBucket; trace?: ProviderTrace },
  execution?: ProviderExecution,
) {
  const validated = resolvePropertyDetailsInput(input, contextPropertyId);
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  if (execution) execution.recorded = true;
  const result = await getPropertyEvidenceWithDependencies({
    propertyId: validated.propertyId,
    contextPropertyId,
    userId,
    hasEntitlement: async (propertyId) => {
      if (providerBudget?.plan === 'PRO' || providerBudget?.plan === 'ENTERPRISE') return true;
      const { data, error } = await userClient.rpc('ds_has_property_intelligence_entitlement', {
        p_property_id: propertyId,
        p_unlock_type: 'property_record',
      });
      if (error) throw new Error('PROPERTY_INTELLIGENCE_ENTITLEMENT_CHECK_FAILED');
      return data === true;
    },
    loadCachedEvidence: async (propertyId, authenticatedUserId) => {
      if (!supabaseServiceRoleKey) throw new Error('PROPERTY_INTELLIGENCE_BACKEND_UNAVAILABLE');
      const admin = createClient(supabaseUrl, supabaseServiceRoleKey) as unknown as PropertyEvidenceBackendClient;
      if (allowProviderFallback) {
        return createBackendPropertyEvidenceService({
          supabaseAdmin: admin,
          getEnv: (name) => Deno.env.get(name),
          fetchImpl: execution ? trackedProviderFetch(execution) : undefined,
          providerBudgetContext: providerBudget ? {
            userId: authenticatedUserId,
            propertyId,
            ...providerBudget,
          } : undefined,
        }).getPropertyEvidence({ propertyId, userId: authenticatedUserId });
      }
      const provider: PropertyDataProvider = {
        getPropertyRecord: async () => { throw new Error('MAXXIS_EVIDENCE_PROVIDER_FORBIDDEN'); },
      };
      const service = new PropertyEvidenceService({
        repository: new SupabasePropertyEvidenceRepository(admin),
        cache: new SupabasePropertyIntelligenceCache(admin),
        provider,
      });
      return service.getCachedPropertyEvidence({ propertyId, userId: authenticatedUserId });
    },
  });
  return execution ? { ...result, providerAttempted: execution.providerCalls > 0,
    providerCalls: execution.providerCalls, executionPhase: execution.phase } : result;
}
