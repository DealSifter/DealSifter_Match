import type {
  DealAdvisorAnalysis,
  MaxxisPropertyDetails,
  PropertyServiceMatch,
  PropertyServiceNeed,
  ProviderContactAccessStatus,
} from './types.ts';

export type NextBestActionCode =
  | 'review_missing_property_data'
  | 'search_service_provider'
  | 'review_service_matches'
  | 'unlock_provider_contact'
  | 'draft_provider_message'
  | 'review_provider_reply'
  | 'send_reviewed_reply'
  | 'review_deal_progress'
  | 'review_property_details'
  | 'action_pending';

export type NextBestActionPriority = 'high' | 'medium' | 'low';
export type NextBestActionConversationState =
  | 'no_conversation'
  | 'message_sent_waiting_reply'
  | 'provider_replied'
  | 'reply_pending_review'
  | 'conversation_active';

export type NextBestAction = {
  code: NextBestActionCode;
  priority: NextBestActionPriority;
  reasonCode: string;
  reason: string;
  actionable: boolean;
  requiresConfirmation: boolean;
  target?: {
    propertyId?: string;
    serviceId?: string;
    serviceTitle?: string;
    serviceType?: string;
    workflowCode?: string;
  };
};

export type NextBestActionResult = {
  nextBestAction: NextBestAction | null;
  alternativeActions: NextBestAction[];
  conversationState: NextBestActionConversationState;
};

export type NextBestActionInput = {
  property?: (Partial<MaxxisPropertyDetails> & { id?: string | null }) | null;
  missingFields?: string[] | null;
  analysis?: Partial<DealAdvisorAnalysis> | null;
  serviceNeeds?: PropertyServiceNeed[] | null;
  serviceMatches?: PropertyServiceMatch[] | null;
  pendingActions?: Array<{
    actionType?: string | null;
    serviceId?: string | null;
    propertyId?: string | null;
    status?: string | null;
  }> | null;
  conversationState?: NextBestActionConversationState | null;
  providerReplyFound?: boolean | null;
  providerOpenItems?: string[] | null;
  suggestedReply?: string | null;
  workflowItems?: Array<{
    code?: string | null;
    status?: string | null;
    source?: string | null;
  }> | null;
};

const CRITICAL_MISSING_FIELDS = new Set(['type', 'city', 'state', 'price', 'objective']);
const MAX_ALTERNATIVES = 2;

function cleanText(value: unknown, max = 180) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function isActivePending(action: unknown) {
  const item = action && typeof action === 'object' ? action as Record<string, unknown> : {};
  const status = cleanText(item.status || 'pending', 40).toLowerCase();
  return !status || status === 'pending';
}

function hasPendingAction(input: NextBestActionInput, actionTypes: string[], serviceId = '') {
  const pending = Array.isArray(input.pendingActions) ? input.pendingActions : [];
  const normalizedTypes = new Set(actionTypes.map((item) => cleanText(item, 80)));
  return pending.some((action) => {
    if (!isActivePending(action)) return false;
    const actionType = cleanText(action?.actionType, 80);
    if (!normalizedTypes.has(actionType)) return false;
    if (!serviceId) return true;
    return cleanText(action?.serviceId, 80) === serviceId;
  });
}

function inferConversationState(input: NextBestActionInput): NextBestActionConversationState {
  const explicit = cleanText(input.conversationState, 40) as NextBestActionConversationState;
  if (['no_conversation', 'message_sent_waiting_reply', 'provider_replied', 'reply_pending_review', 'conversation_active'].includes(explicit)) {
    return explicit;
  }
  const openItems = Array.isArray(input.providerOpenItems) ? input.providerOpenItems.filter(Boolean) : [];
  if (input.providerReplyFound && cleanText(input.suggestedReply)) return 'reply_pending_review';
  if (input.providerReplyFound || openItems.length) return 'provider_replied';
  return 'no_conversation';
}

function makeAction(action: NextBestAction): NextBestAction {
  return action;
}

function firstServiceCandidate(serviceMatches: PropertyServiceMatch[] | null | undefined) {
  const matches = Array.isArray(serviceMatches) ? serviceMatches : [];
  for (const match of matches) {
    const services = Array.isArray(match?.services) ? match.services : [];
    for (const service of services) {
      const serviceId = cleanText(service?.id, 80);
      if (!serviceId) continue;
      return {
        service,
        match,
        serviceId,
        serviceTitle: cleanText(service?.title || service?.serviceType || match?.serviceType || 'Provider'),
        serviceType: cleanText(service?.serviceType || match?.serviceType),
        accessStatus: cleanText(service?.contactAccess?.status, 40) as ProviderContactAccessStatus | '',
      };
    }
  }
  return null;
}

function actionsWithAlternatives(actions: NextBestAction[], conversationState: NextBestActionConversationState): NextBestActionResult {
  const deduped: NextBestAction[] = [];
  const seen = new Set<string>();
  for (const action of actions) {
    const key = `${action.code}:${action.target?.serviceId || ''}:${action.target?.propertyId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(action);
  }
  const priorityWeight: Record<NextBestActionPriority, number> = { high: 3, medium: 2, low: 1 };
  const prioritized = deduped
    .map((action, index) => ({ action, index }))
    .sort((left, right) => priorityWeight[right.action.priority] - priorityWeight[left.action.priority] || left.index - right.index)
    .map(({ action }) => action);
  return {
    nextBestAction: prioritized[0] || null,
    alternativeActions: prioritized.slice(1, 1 + MAX_ALTERNATIVES),
    conversationState,
  };
}

export function determineNextBestAction(input: NextBestActionInput): NextBestActionResult {
  const property = input.property || null;
  const propertyId = cleanText(property?.id, 80);
  const published = property?.published !== false;
  const dealClosed = property?.dealClosed === true;
  const conversationState = inferConversationState(input);

  if (!property || !propertyId || !published || dealClosed) {
    return { nextBestAction: null, alternativeActions: [], conversationState };
  }

  const actions: NextBestAction[] = [];
  const missingFields = Array.from(new Set([
    ...(Array.isArray(input.missingFields) ? input.missingFields : []),
    ...(Array.isArray(input.analysis?.missingInformation) ? input.analysis?.missingInformation || [] : []),
  ].map((item) => cleanText(item, 60)).filter(Boolean)));
  const hasCriticalMissing = missingFields.some((field) => CRITICAL_MISSING_FIELDS.has(field));
  const serviceNeeds = Array.isArray(input.serviceNeeds) ? input.serviceNeeds : [];
  const serviceMatches = Array.isArray(input.serviceMatches) ? input.serviceMatches : null;
  const provider = firstServiceCandidate(serviceMatches);

  if (conversationState === 'reply_pending_review' && cleanText(input.suggestedReply)) {
    actions.push(makeAction({
      code: 'send_reviewed_reply',
      priority: 'high',
      reasonCode: 'suggested_reply_ready',
      reason: 'A provider reply was analyzed and an editable suggested reply is ready for review.',
      actionable: true,
      requiresConfirmation: true,
      target: { propertyId, ...(provider?.serviceId ? { serviceId: provider.serviceId, serviceTitle: provider.serviceTitle, serviceType: provider.serviceType } : {}) },
    }));
  }

  if (conversationState === 'provider_replied' || (input.providerReplyFound && !cleanText(input.suggestedReply))) {
    actions.push(makeAction({
      code: 'review_provider_reply',
      priority: 'high',
      reasonCode: 'provider_reply_detected',
      reason: 'The provider has replied, and the next safe step is to review the response and open items.',
      actionable: true,
      requiresConfirmation: false,
      target: { propertyId, ...(provider?.serviceId ? { serviceId: provider.serviceId, serviceTitle: provider.serviceTitle, serviceType: provider.serviceType } : {}) },
    }));
  }

  if (conversationState === 'message_sent_waiting_reply') {
    actions.push(makeAction({
      code: 'review_property_details',
      priority: 'low',
      reasonCode: 'waiting_for_provider_reply',
      reason: 'A message was sent and no provider reply is detectable yet.',
      actionable: false,
      requiresConfirmation: false,
      target: { propertyId },
    }));
  }

  if (hasCriticalMissing) {
    actions.push(makeAction({
      code: 'review_missing_property_data',
      priority: 'high',
      reasonCode: 'critical_property_data_missing',
      reason: `Critical property fields are missing: ${missingFields.filter((field) => CRITICAL_MISSING_FIELDS.has(field)).slice(0, 4).join(', ')}.`,
      actionable: false,
      requiresConfirmation: false,
      target: { propertyId },
    }));
  }

  if (serviceNeeds.length && serviceMatches === null) {
    actions.push(makeAction({
      code: 'search_service_provider',
      priority: 'medium',
      reasonCode: 'service_needs_without_provider_search',
      reason: 'The property has contextual service needs, but provider matches have not been searched in this context.',
      actionable: true,
      requiresConfirmation: false,
      target: { propertyId },
    }));
  }

  if (serviceMatches && serviceMatches.length && !provider) {
    actions.push(makeAction({
      code: 'review_service_matches',
      priority: 'medium',
      reasonCode: 'service_matches_no_available_provider',
      reason: 'Service categories were evaluated, but no available provider card is attached to the current results.',
      actionable: false,
      requiresConfirmation: false,
      target: { propertyId },
    }));
  }

  if (provider) {
    if (hasPendingAction(input, ['unlock_provider_contact'], provider.serviceId)) {
      actions.push(makeAction({
        code: 'action_pending',
        priority: 'medium',
        reasonCode: 'unlock_provider_contact_pending',
        reason: 'A provider contact unlock is already pending, so a duplicate unlock should not be suggested.',
        actionable: false,
        requiresConfirmation: false,
        target: { propertyId, serviceId: provider.serviceId, serviceTitle: provider.serviceTitle, serviceType: provider.serviceType },
      }));
    } else if (provider.accessStatus === 'locked') {
      actions.push(makeAction({
        code: 'unlock_provider_contact',
        priority: 'medium',
        reasonCode: 'matched_provider_contact_locked',
        reason: 'A matched provider is available, but contact access is still locked.',
        actionable: true,
        requiresConfirmation: true,
        target: { propertyId, serviceId: provider.serviceId, serviceTitle: provider.serviceTitle, serviceType: provider.serviceType },
      }));
    } else if (provider.accessStatus === 'already_unlocked' && conversationState === 'no_conversation') {
      actions.push(makeAction({
        code: 'draft_provider_message',
        priority: 'medium',
        reasonCode: 'provider_unlocked_no_conversation',
        reason: 'A matched provider is already unlocked and no conversation is detectable in this Maxxis flow.',
        actionable: true,
        requiresConfirmation: false,
        target: { propertyId, serviceId: provider.serviceId, serviceTitle: provider.serviceTitle, serviceType: provider.serviceType },
      }));
    } else if (serviceMatches?.length) {
      actions.push(makeAction({
        code: 'review_service_matches',
        priority: 'medium',
        reasonCode: 'service_matches_available',
        reason: 'Service matches are available for review.',
        actionable: false,
        requiresConfirmation: false,
        target: { propertyId, serviceId: provider.serviceId, serviceTitle: provider.serviceTitle, serviceType: provider.serviceType },
      }));
    }
  }

  const pendingManualWorkflowItem = (Array.isArray(input.workflowItems) ? input.workflowItems : [])
    .find((entry) => cleanText(entry?.source, 20) === 'user' && cleanText(entry?.status, 20) === 'pending' && cleanText(entry?.code, 80));
  if (pendingManualWorkflowItem) {
    actions.push(makeAction({
      code: 'review_deal_progress',
      priority: 'low',
      reasonCode: 'manual_workflow_item_pending',
      reason: 'A relevant manual Deal Progress item is still pending.',
      actionable: true,
      requiresConfirmation: false,
      target: { propertyId, workflowCode: cleanText(pendingManualWorkflowItem.code, 80) },
    }));
  }

  if (!actions.length) {
    actions.push(makeAction({
      code: 'review_property_details',
      priority: 'low',
      reasonCode: 'property_details_available',
      reason: 'Published property details are available for review.',
      actionable: false,
      requiresConfirmation: false,
      target: { propertyId },
    }));
  }

  return actionsWithAlternatives(actions, conversationState);
}
