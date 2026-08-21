import { supabase, isSupabaseConfigured } from './supabaseClient';

export async function trackAppEvent(eventType, options = {}) {
  if (!isSupabaseConfigured || !supabase || !eventType) return false;

  const metadata = options.metadata && typeof options.metadata === 'object'
    ? options.metadata
    : {};

  try {
      const { error } = await supabase.rpc('track_app_event', {
        p_event_type: String(eventType),
        p_entity_type: options.entityType ? String(options.entityType) : null,
        p_entity_id: options.entityId ? String(options.entityId) : null,
        p_value_nuggets: Number.isFinite(Number(options.valueNuggets)) ? Number(options.valueNuggets) : 0,
        p_value_usd_cents: Number.isFinite(Number(options.valueUsdCents)) ? Number(options.valueUsdCents) : 0,
        p_metadata: metadata,
      });
      return !error;
  } catch {
    // Analytics should never interrupt the user flow.
    return false;
  }
}
