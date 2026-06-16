import { supabase, isSupabaseConfigured } from './supabaseClient';

export function trackAppEvent(eventType, options = {}) {
  if (!isSupabaseConfigured || !supabase || !eventType) return;

  const metadata = options.metadata && typeof options.metadata === 'object'
    ? options.metadata
    : {};

  void (async () => {
    try {
      await supabase.rpc('track_app_event', {
        p_event_type: String(eventType),
        p_entity_type: options.entityType ? String(options.entityType) : null,
        p_entity_id: options.entityId ? String(options.entityId) : null,
        p_value_nuggets: Number.isFinite(Number(options.valueNuggets)) ? Number(options.valueNuggets) : 0,
        p_value_usd_cents: Number.isFinite(Number(options.valueUsdCents)) ? Number(options.valueUsdCents) : 0,
        p_metadata: metadata,
      });
    } catch {
      // Analytics should never interrupt the user flow.
    }
  })();
}
