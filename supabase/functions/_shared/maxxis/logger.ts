export function logMaxxisEvent(event: string, details: Record<string, unknown>) {
  if (event === 'maxxis_compare_properties') {
    console.log(JSON.stringify({
      event,
      property_count: Number(details.property_count || 0),
      duration_ms: Number(details.duration_ms || 0),
      success: Boolean(details.success),
    }));
    return;
  }
  const safe = {
    event,
    request_id: String(details.request_id || ''),
    user_id: String(details.user_id || ''),
    model: details.model ? String(details.model) : undefined,
    duration_ms: Number(details.duration_ms || 0),
    success: Boolean(details.success),
    fallback_count: Number(details.fallback_count || 0),
    tool: details.tool ? String(details.tool) : undefined,
    result_count: Number(details.result_count || 0),
    profile_exists: typeof details.profile_exists === 'boolean' ? details.profile_exists : undefined,
    search_mode: details.search_mode ? String(details.search_mode) : undefined,
    evaluated_count: Number(details.evaluated_count || 0),
    scored_count: Number(details.scored_count || 0),
    ranking_duration_ms: Number(details.ranking_duration_ms || 0),
    behavior_history_available: typeof details.behavior_history_available === 'boolean' ? details.behavior_history_available : undefined,
    behavior_action_count: Number(details.behavior_action_count || 0),
    behavior_signal_applied: typeof details.behavior_signal_applied === 'boolean' ? details.behavior_signal_applied : undefined,
    behavior_duration_ms: Number(details.behavior_duration_ms || 0),
    profile_drift_detected: typeof details.profile_drift_detected === 'boolean' ? details.profile_drift_detected : undefined,
    profile_suggestion_count: Number(details.profile_suggestion_count || 0),
    profile_suggestion_dimensions: Array.isArray(details.profile_suggestion_dimensions)
      ? details.profile_suggestion_dimensions.map((item) => String(item || '')).filter(Boolean).slice(0, 3)
      : undefined,
    profile_drift_duration_ms: Number(details.profile_drift_duration_ms || 0),
    operation: details.operation ? String(details.operation) : undefined,
    action_status: details.action_status ? String(details.action_status) : undefined,
    workflow_item_count: Number(details.workflow_item_count || 0),
    workflow_system_completed: Number(details.workflow_system_completed || 0),
    capabilities_loaded: Array.isArray(details.capabilities_loaded)
      ? details.capabilities_loaded.map((item) => String(item || '')).filter(Boolean).slice(0, 12)
      : undefined,
    capabilities_unavailable: Array.isArray(details.capabilities_unavailable)
      ? details.capabilities_unavailable.map((item) => String(item || '')).filter(Boolean).slice(0, 12)
      : undefined,
    query_count: Number(details.query_count || 0),
    error_code: details.error_code ? String(details.error_code) : undefined,
  };
  console.log(JSON.stringify(safe));
}
