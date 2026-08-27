import { logOperationalEvent } from '../observability.ts';

function functionNameForEvent(event: string) {
  if (event.startsWith('provider_contact_unlock_')) {
    return `maxxis-provider-unlock-${event.replace('provider_contact_unlock_', '')}`;
  }
  if (event.startsWith('provider_message_send_')) {
    return `maxxis-provider-message-${event.replace('provider_message_send_', '')}`;
  }
  if (event.startsWith('deal_workflow')) return 'maxxis-deal-workflow';
  return 'maxxis-chat';
}

export function logMaxxisEvent(event: string, details: Record<string, unknown>) {
  const success = details.success !== false && !details.error_code;
  return logOperationalEvent({
    functionName: String(details.function_name || functionNameForEvent(event)),
    operation: event,
    requestId: String(details.request_id || ''),
    userId: String(details.user_id || ''),
    durationMs: Number(details.duration_ms || 0),
    success,
    errorCode: details.error_code,
    provider: details.model ? 'gemini' : String(details.provider || ''),
    status: details.status || details.action_status,
    metrics: {
      fallback_count: Number(details.fallback_count || 0),
      result_count: Number(details.result_count || 0),
      property_count: Number(details.property_count || 0),
      profile_exists: details.profile_exists,
      search_mode: details.search_mode,
      evaluated_count: Number(details.evaluated_count || 0),
      scored_count: Number(details.scored_count || 0),
      ranking_duration_ms: Number(details.ranking_duration_ms || 0),
      provider_duration_ms: Number(details.provider_duration_ms || 0),
      db_duration_ms: Number(details.db_duration_ms || 0),
      tool_duration_ms: Number(details.tool_duration_ms || 0),
      app_duration_ms: Number(details.app_duration_ms || 0),
      request_payload_bytes: Number(details.request_payload_bytes || 0),
      system_prompt_bytes: Number(details.system_prompt_bytes || 0),
      tool_declaration_bytes: Number(details.tool_declaration_bytes || 0),
      tool_payload_bytes: Number(details.tool_payload_bytes || 0),
      history_count: Number(details.history_count || 0),
      behavior_history_available: details.behavior_history_available,
      behavior_action_count: Number(details.behavior_action_count || 0),
      behavior_signal_applied: details.behavior_signal_applied,
      behavior_duration_ms: Number(details.behavior_duration_ms || 0),
      profile_drift_detected: details.profile_drift_detected,
      profile_suggestion_count: Number(details.profile_suggestion_count || 0),
      profile_suggestion_dimensions: details.profile_suggestion_dimensions,
      profile_drift_duration_ms: Number(details.profile_drift_duration_ms || 0),
      workflow_item_count: Number(details.workflow_item_count || 0),
      workflow_system_completed: Number(details.workflow_system_completed || 0),
      capabilities_loaded: details.capabilities_loaded,
      capabilities_unavailable: details.capabilities_unavailable,
      query_count: Number(details.query_count || 0),
      tool: details.tool,
      llm_call_count: Number(details.llm_call_count || 0),
      tool_call_count: Number(details.tool_call_count || 0),
      tool_rounds: Number(details.tool_rounds || 0),
      timeout: Boolean(details.timeout),
      budget_exhausted: Boolean(details.budget_exhausted),
      degraded_reason: details.degraded_reason,
      provider_status: Number(details.provider_status || 0),
      model_attempts: Number(details.model_attempts || 0),
    },
  });
}
