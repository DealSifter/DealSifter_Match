import type {
  DealAdvisorAnalysis,
  DealWorkflowView,
  MaxxisNextBestActionResult,
  MaxxisPropertyDetails,
  PropertyServiceNeed,
} from './types.ts';
import type { DealMetricsResult } from './dealMetrics.ts';

export type DealCopilotProviderSummary = {
  serviceId: string;
  title: string;
  serviceType: string;
};

export type DealCopilotConversationSummary = {
  summary: string;
  facts: string[];
  openItems: string[];
  providerReplyFound: boolean;
  messageCount: number;
};

export type DealCopilotOverview = {
  propertySummary: Pick<MaxxisPropertyDetails, 'id' | 'type' | 'city' | 'state' | 'zip' | 'price' | 'beds' | 'baths' | 'sqft' | 'objective' | 'rehab'>;
  match?: unknown;
  metricsSummary: DealMetricsResult | null;
  advisorSummary: DealAdvisorAnalysis | null;
  workflow: DealWorkflowView | null;
  nextBestAction: MaxxisNextBestActionResult | null;
  serviceSummary: {
    needs: PropertyServiceNeed[];
    providers: DealCopilotProviderSummary[];
  } | null;
  conversationSummary: DealCopilotConversationSummary | null;
  capabilitiesLoaded: string[];
  capabilitiesUnavailable: string[];
  queryCount: number;
};

export type DealCopilotDetails = {
  found: boolean;
  property: MaxxisPropertyDetails | null;
  metrics: DealMetricsResult | null;
  analysis: DealAdvisorAnalysis | null;
  serviceNeeds: PropertyServiceNeed[];
  workflow: DealWorkflowView | null;
  nextBestAction: MaxxisNextBestActionResult | null;
  match?: unknown;
};

export type OptionalCopilotContext = {
  conversationSummary: DealCopilotConversationSummary | null;
  providers: DealCopilotProviderSummary[];
  capabilitiesLoaded?: string[];
  capabilitiesUnavailable?: string[];
  queryCount?: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Existing property/workflow orchestration performs: property, images, pending actions,
// workflow lookup, workflow upsert, and final workflow read. Auth checks are not DB queries.
const CORE_OVERVIEW_QUERY_COUNT = 6;

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

export function composeDealCopilotOverview(
  details: DealCopilotDetails,
  optional: OptionalCopilotContext = { conversationSummary: null, providers: [] },
): DealCopilotOverview | null {
  if (!details?.found || !details.property) return null;
  const property = details.property;
  const providers = Array.isArray(optional.providers) ? optional.providers : [];
  const needs = Array.isArray(details.serviceNeeds) ? details.serviceNeeds : [];
  const capabilitiesLoaded = uniqueStrings([
    'property_details',
    details.match ? 'property_match' : '',
    details.metrics ? 'deal_metrics' : '',
    details.analysis ? 'deal_advisor' : '',
    details.workflow ? 'deal_workflow' : '',
    details.nextBestAction ? 'next_best_action' : '',
    needs.length ? 'property_service_needs' : '',
    providers.length ? 'provider_summary' : '',
    optional.conversationSummary ? 'provider_conversation_analysis' : '',
    ...(optional.capabilitiesLoaded || []),
  ]);
  return {
    propertySummary: {
      id: property.id,
      type: property.type,
      city: property.city,
      state: property.state,
      zip: property.zip,
      price: property.price,
      beds: property.beds,
      baths: property.baths,
      sqft: property.sqft,
      objective: property.objective,
      rehab: property.rehab,
    },
    ...(details.match ? { match: details.match } : {}),
    metricsSummary: details.metrics || null,
    advisorSummary: details.analysis || null,
    workflow: details.workflow || null,
    nextBestAction: details.nextBestAction || null,
    serviceSummary: needs.length || providers.length ? { needs, providers } : null,
    conversationSummary: optional.conversationSummary || null,
    capabilitiesLoaded,
    capabilitiesUnavailable: uniqueStrings(optional.capabilitiesUnavailable || []),
    queryCount: CORE_OVERVIEW_QUERY_COUNT + Math.max(0, Number(optional.queryCount || 0)),
  };
}

export async function orchestrateDealCopilotOverview(input: {
  propertyId: string;
  loadDetails: (propertyId: string) => Promise<DealCopilotDetails>;
  loadOptionalContext?: (propertyId: string) => Promise<OptionalCopilotContext>;
}) {
  const propertyId = String(input.propertyId || '').trim();
  if (!UUID_PATTERN.test(propertyId)) throw new Error('INVALID_PROPERTY_ID');
  const details = await input.loadDetails(propertyId);
  if (!details?.found || !details.property || details.property.id !== propertyId) return null;
  let optional: OptionalCopilotContext = { conversationSummary: null, providers: [] };
  if (input.loadOptionalContext) {
    try {
      optional = await input.loadOptionalContext(propertyId);
    } catch {
      optional = {
        conversationSummary: null,
        providers: [],
        capabilitiesUnavailable: ['provider_conversation_analysis'],
        queryCount: 1,
      };
    }
  }
  return composeDealCopilotOverview(details, optional);
}
