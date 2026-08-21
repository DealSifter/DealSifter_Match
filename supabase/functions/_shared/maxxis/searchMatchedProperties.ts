import { getMyInvestmentProfile, getMyInvestmentProfileWithClient } from './getMyInvestmentProfile.ts';
import { getUserPropertyBehavior, getUserPropertyBehaviorWithClient } from './getUserPropertyBehavior.ts';
import { orchestratePropertySearch } from './propertySearchOrchestrator.ts';
import { searchProperties, validateSearchPropertiesInput } from './searchProperties.ts';

export async function searchMatchedProperties(
  input: unknown,
  authHeader: string,
  authenticated?: { client: Parameters<typeof getMyInvestmentProfileWithClient>[1]; userId: string },
) {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const personalized = raw.personalized === true;
  const filters = validateSearchPropertiesInput(raw);
  return orchestratePropertySearch(filters, personalized, {
    getProfile: async () => {
      try {
        return authenticated
          ? await getMyInvestmentProfileWithClient(authenticated.userId, authenticated.client)
          : await getMyInvestmentProfile(authHeader);
      } catch (error) {
        if (personalized) throw error;
        return { profile: null, exists: false, complete: false };
      }
    },
    search: (queryFilters) => searchProperties(queryFilters, authHeader),
    getBehavior: () => authenticated
      ? getUserPropertyBehaviorWithClient(authenticated.userId, authenticated.client)
      : getUserPropertyBehavior(authHeader),
  });
}
