export const PRODUCT_EVENT_TAXONOMY_VERSION = 1;

export const PRODUCT_EVENTS = Object.freeze({
  session_started: { stage: 'session' },
  auth_signed_in: { stage: 'auth' },
  profile_completed: { stage: 'activation' },
  property_viewed: { stage: 'property' },
  property_interested: { stage: 'property' },
  maxxis_opened: { stage: 'assistant' },
  maxxis_property_search: { stage: 'assistant' },
  deal_copilot_opened: { stage: 'assistant' },
  provider_suggested: { stage: 'provider' },
  provider_unlock_started: { stage: 'provider' },
  provider_unlocked: { stage: 'provider' },
  provider_message_drafted: { stage: 'conversation' },
  provider_message_sent: { stage: 'conversation' },
  provider_reply_received: { stage: 'conversation' },
  next_best_action_seen: { stage: 'workflow' },
  next_best_action_clicked: { stage: 'workflow' },
  workflow_item_completed: { stage: 'workflow' },
});

export const MAXXIS_DEAL_FUNNEL = Object.freeze([
  'property_viewed',
  'deal_copilot_opened',
  'provider_suggested',
  'provider_unlock_started',
  'provider_unlocked',
  'provider_message_sent',
  'provider_reply_received',
]);

export const SAFE_PRODUCT_PROPERTY_KEYS = Object.freeze([
  'source',
  'response_type',
  'workflow_code',
  'status',
  'funnel_step',
  'provider_count',
  'taxonomy_version',
  'auth_provider',
]);
