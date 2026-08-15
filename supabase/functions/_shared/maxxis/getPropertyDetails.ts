import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import {
  findServicesForPropertyNeeds,
  type PropertyServiceMatchingSummary,
} from './findServicesForPropertyNeeds.ts';
import {
  getPropertyDetailsWithClient,
  validateGetPropertyDetailsInput,
  type PropertyDetailsLookupResult,
} from './propertyDetails.ts';
import { determineNextBestAction, type NextBestActionResult } from './nextBestAction.ts';
import {
  reconcileDealWorkflowForProperty,
  type DealWorkflowView,
} from './dealWorkflow.ts';

export type GetPropertyDetailsResult = PropertyDetailsLookupResult & {
  serviceMatchingSummary: PropertyServiceMatchingSummary | null;
  nextBestAction: NextBestActionResult | null;
  workflow: DealWorkflowView | null;
};

export async function getPropertyDetailsForAuthenticatedUser(
  input: unknown,
  authHeader: string,
  client: ReturnType<typeof createClient>,
  userId: string,
): Promise<GetPropertyDetailsResult> {
  const validated = validateGetPropertyDetailsInput(input);
  const details = await getPropertyDetailsWithClient(validated, client);
  if (!validated.includeServiceMatches || !details.found || !details.property) {
    if (!validated.includeOperationalContext || !details.found || !details.property) {
      return {
        ...details,
        serviceMatchingSummary: null,
        workflow: null,
        nextBestAction: null,
      };
    }
    const operational = details.found && details.property
      ? await reconcileDealWorkflowForProperty({
        client,
        userId,
        property: details.property,
        serviceNeeds: details.serviceNeeds,
        serviceMatches: null,
      })
      : null;
    return {
      ...details,
      serviceMatchingSummary: null,
      workflow: operational?.workflow || null,
      nextBestAction: details.found && details.property
        ? determineNextBestAction({
          property: details.property,
          missingFields: details.missingFields,
          analysis: details.analysis,
          serviceNeeds: details.serviceNeeds,
          serviceMatches: null,
          workflowItems: operational?.workflow.items || [],
          pendingActions: operational?.pendingActions || [],
          conversationState: operational?.conversationState,
          providerReplyFound: operational?.providerReplyFound,
        })
        : null,
    };
  }

  const matching = await findServicesForPropertyNeeds({
    property: details.property,
    serviceNeeds: details.serviceNeeds,
    authHeader,
  });
  const operational = await reconcileDealWorkflowForProperty({
    client,
    userId,
    property: details.property,
    serviceNeeds: details.serviceNeeds,
    serviceMatches: matching.serviceMatches,
  });
  return {
    ...details,
    serviceMatches: matching.serviceMatches,
    serviceMatchingSummary: matching.summary,
    workflow: operational.workflow,
    nextBestAction: determineNextBestAction({
      property: details.property,
      missingFields: details.missingFields,
      analysis: details.analysis,
      serviceNeeds: details.serviceNeeds,
      serviceMatches: matching.serviceMatches,
      workflowItems: operational.workflow.items,
      pendingActions: operational.pendingActions,
      conversationState: operational.conversationState,
      providerReplyFound: operational.providerReplyFound,
    }),
  };
}

export async function getPropertyDetails(input: unknown, authHeader: string): Promise<GetPropertyDetailsResult> {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) throw new Error('UNAUTHORIZED');
  return getPropertyDetailsForAuthenticatedUser(input, authHeader, client, user.id);
}
