export const MAXXIS_RESPONSE_TYPES = Object.freeze({
  TEXT: 'text',
  PROPERTIES: 'properties',
  SERVICES: 'services',
  INVESTMENT_PROFILE: 'investment_profile',
  PROPERTY_DETAILS: 'property_details',
  PROPERTY_COMPARISON: 'property_comparison',
  PROVIDER_MESSAGE_DRAFT: 'provider_message_draft',
  PROVIDER_CONVERSATION_ANALYSIS: 'provider_conversation_analysis',
  DEAL_COPILOT_OVERVIEW: 'deal_copilot_overview',
});

const validators = {
  properties: (data) => Array.isArray(data?.properties),
  services: (data) => Array.isArray(data?.services),
  investment_profile: (data) => typeof data?.complete === 'boolean',
  property_details: (data) => Object.prototype.hasOwnProperty.call(data || {}, 'property'),
  property_comparison: (data) => Array.isArray(data?.properties),
  deal_copilot_overview: (data) => Boolean(data?.propertySummary),
};

export function normalizeMaxxisResponsePayload(type, data) {
  const normalizedType = String(type || MAXXIS_RESPONSE_TYPES.TEXT);
  const validator = validators[normalizedType];
  return validator?.(data)
    ? { type: normalizedType, data }
    : { type: MAXXIS_RESPONSE_TYPES.TEXT, data: null };
}
