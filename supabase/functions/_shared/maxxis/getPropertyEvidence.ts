import { createClient } from 'npm:@supabase/supabase-js@2';
import type { PropertyEvidenceBackendClient } from '../property-data/backendFactory.ts';
import { SupabasePropertyIntelligenceCache } from '../property-data/cache.ts';
import { PropertyEvidenceService } from '../property-data/propertyEvidenceService.ts';
import { SupabasePropertyEvidenceRepository } from '../property-data/propertyRepository.ts';
import type { PropertyDataProvider } from '../property-data/types.ts';
import { resolvePropertyDetailsInput } from './propertyDetails.ts';
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from './config.ts';
import { getPropertyEvidenceWithDependencies } from './propertyEvidence.ts';

export async function getPropertyEvidenceForAuthenticatedUser(input: unknown, authHeader: string, userId: string, contextPropertyId?: string) {
  const validated = resolvePropertyDetailsInput(input, contextPropertyId);
  const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  return getPropertyEvidenceWithDependencies({
    propertyId: validated.propertyId,
    contextPropertyId,
    userId,
    hasEntitlement: async (propertyId) => {
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
}
