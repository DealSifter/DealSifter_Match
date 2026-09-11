import { calculatePropertyMatch } from './calculatePropertyMatch.ts';
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
  return orchestrateDealInsightContext({
    propertyId: validated.propertyId,
    loadPropertyDetails: (propertyId) => getPropertyDetailsWithClient({ propertyId }, client),
    loadInvestmentProfile: () => getMyInvestmentProfileWithClient(userId, client),
    calculateMatch: (profile, property) => calculatePropertyMatch(profile, property),
    loadPropertyEvidence: (propertyId) => getPropertyEvidenceForAuthenticatedUser(
      { propertyId }, authHeader, userId, propertyId,
    ),
  });
}
