export const LOCAL_STORAGE_CATEGORY = {
  UI_ONLY: 'ui-only',
  REMOTE_CACHE: 'remote-cache',
  SENSITIVE_FORBIDDEN: 'sensitive-forbidden',
};

export const MAXXIS_WIDGET_POSITION_KEY = 'ds_maxxis_widget_position';

// UI-only keys never authorize paid access and can safely persist per device.
export const UI_ONLY_LOCAL_STORAGE_KEYS = Object.freeze([
  'theme',
  'lang',
  'authSession',
  'ds_last_page',
  'ds_mobile_bottom_nav_collapsed',
  'categoryOrder',
  'accountType',
  'ds_activeCat',
  'ds_selectedStates',
  'focusCard',
  'mapViewport',
  'mapViewPanelCollapsed',
  'mapViewPanelWidth',
  'ds_mapview_ui_state_v1',
  'ds_map_panel_toggle_offset_y',
  'ds_map_return_viewport',
  'chatMainTextSize',
  'chatSeenIncomingByContact',
  'chatPeerLangPrefs',
  'ds_guidetips_enabled',
  'ds_remember_login_email',
  MAXXIS_WIDGET_POSITION_KEY,
]);

// Remote-cache keys are allowed only as UX cache. The database/RPC must overwrite
// them after login, refresh, realtime update, or server mutation confirmation.
export const REMOTE_CACHE_LOCAL_STORAGE_KEYS = Object.freeze([
  'userProfile',
  'personalProfile',
  'personalProfile_full',
  'professionalProfile',
  'propertyPortfolio',
  'propertyPortfolio_full',
  'servicePortfolio',
  'servicePortfolio_full',
  'systemAccount',
  'profileOwnerMap',
  'publishingProfileKey',
  'ds_feed_hidden_contacts',
  'ds_feed_hidden_interests',
  'dealsifter.hiddenCardIds',
  'ds_matches_archived_contacts',
  'ds_matches_archived_interests',
  'ds_matches_deleted_contacts',
  'ds_matches_deleted_interests',
  'ds_system_notifications',
  'ds_user_preferences',
  'ds_plan_usage_cache',
  'ds_geocode_cache',
  'ds_geocode_cache_v',
  'ds_pin_overrides',
  'ds_pin_overrides_by_user',
  'ds_notif_deferred_chat',
  'ds_notif_deferred_system',
  'ds_unlock_notifications_seen',
  'ds_trending_notification_seen',
  'ds_pending_checkout_intent',
  'ds_export_mail_defaults',
  'ds_comm_prefs',
  'ds_support_chat_thread',
  'ds_privacy_controls',
  'ds_billing_history_mock',
  'ds_security_audit',
  'ds_security_sessions',
  'ds_security_active_session_id',
  'ds_security_rate_limits',
  'ds_security_otp_fail_count',
  'ds_security_otp_lock_until',
  'ds_app_last_activity_at',
  'ds_app_session_token',
  'ds_admin_kpi_order_v1',
  'ds_admin_kpi_view_v1',
  'ds_match_pressure',
  'ds_deal_alerts',
  'ds_cookie_consent',
  'ds_lgpd_consent',
  'ds_lgpd_consent_anon_id',
  'ds_terms_consent',
]);

// These keys must not be read as source of truth in production. They can grant
// stale access if they diverge from Supabase after login on another device.
export const SENSITIVE_FORBIDDEN_LOCAL_STORAGE_KEYS = Object.freeze([
  'ds_nuggets',
  'ds_subscription_mock',
  'ds_plan_snapshot_cache',
  'ds_matched',
  'ds_interested',
  'ds_unlocked',
  'ds_property_unlocks',
  'ds_purchases',
  'ds_payment_methods_mock',
  'ds_comm_prefs_mock',
]);

export const LOCAL_STORAGE_POLICY = Object.freeze({
  [LOCAL_STORAGE_CATEGORY.UI_ONLY]: UI_ONLY_LOCAL_STORAGE_KEYS,
  [LOCAL_STORAGE_CATEGORY.REMOTE_CACHE]: REMOTE_CACHE_LOCAL_STORAGE_KEYS,
  [LOCAL_STORAGE_CATEGORY.SENSITIVE_FORBIDDEN]: SENSITIVE_FORBIDDEN_LOCAL_STORAGE_KEYS,
});

const SENSITIVE_PREFIXES = Object.freeze([
  'ds_matched:',
  'ds_interested:',
  'ds_unlocked:',
  'ds_property_unlocks:',
  'ds_purchases:',
  'ds_plan_snapshot_cache:',
  'ds_unlocked_contact_cards:',
]);

function removeLocalStorageKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage cleanup is best-effort.
  }
}

export function isSensitiveLocalStorageKey(key) {
  const normalized = String(key || '');
  return SENSITIVE_FORBIDDEN_LOCAL_STORAGE_KEYS.includes(normalized)
    || SENSITIVE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function clearSensitiveCache(userId) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  SENSITIVE_FORBIDDEN_LOCAL_STORAGE_KEYS.forEach(removeLocalStorageKey);
  const suffix = userId ? `:${String(userId)}` : '';
  if (suffix) {
    SENSITIVE_FORBIDDEN_LOCAL_STORAGE_KEYS.forEach((key) => removeLocalStorageKey(`${key}${suffix}`));
  }
  const keys = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && isSensitiveLocalStorageKey(key)) keys.push(key);
    }
  } catch {
    return;
  }
  keys.forEach(removeLocalStorageKey);
}
