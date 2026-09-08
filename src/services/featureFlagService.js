import { invokeSupabaseFunction, isSupabaseConfigured, supabaseUrl } from '../lib/supabaseClient';

export const FEATURE_FLAG_NAMES = Object.freeze([
  'platform_readiness_probe',
  'maxxis_next_generation',
  'maxxis_proactive_insights',
  'maxxis_deal_memory',
  'new_feed_experience',
  'advanced_deal_analysis',
  'experimental_provider_flow',
]);

export const OFF_FEATURE_FLAGS = Object.freeze(Object.fromEntries(FEATURE_FLAG_NAMES.map((name) => [name, false])));

export function normalizeFeatureFlagResponse(payload) {
  const source = payload?.source === 'server' ? 'server' : 'fallback';
  const rawFlags = source === 'server' && payload?.flags && typeof payload.flags === 'object' ? payload.flags : {};
  return {
    flags: Object.freeze(Object.fromEntries(FEATURE_FLAG_NAMES.map((name) => [name, rawFlags[name] === true]))),
    environment: ['development', 'staging', 'production'].includes(payload?.environment) ? payload.environment : 'production',
    source,
  };
}

export async function fetchFeatureFlags({ overrides = null } = {}) {
  if (!isSupabaseConfigured) return normalizeFeatureFlagResponse(null);
  const isAdminReviewBuild = import.meta.env.VITE_MAXXIS_PROACTIVE_REVIEW === 'true';
  const isSafeOverrideEnvironment = import.meta.env.DEV
    || isAdminReviewBuild
    || supabaseUrl.includes('oqdcnjupquhybwdbeeew');
  const body = isSafeOverrideEnvironment && overrides && typeof overrides === 'object' ? { overrides } : {};
  try {
    const { data, error } = await invokeSupabaseFunction('feature-flags', { body });
    if (error) return normalizeFeatureFlagResponse(null);
    return normalizeFeatureFlagResponse(data);
  } catch {
    return normalizeFeatureFlagResponse(null);
  }
}

export async function fetchFeatureFlagsWithRetry({
  overrides = null,
  attempts = 3,
  retryDelayMs = 350,
  fetcher = fetchFeatureFlags,
} = {}) {
  const maxAttempts = Math.max(1, Number(attempts) || 1);
  let snapshot = normalizeFeatureFlagResponse(null);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    snapshot = await fetcher({ overrides });
    if (snapshot?.source === 'server' || attempt === maxAttempts) return snapshot;
    await new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(0, retryDelayMs)));
  }

  return snapshot;
}

export const isFeatureEnabled = (snapshot, flagName) => (
  FEATURE_FLAG_NAMES.includes(flagName) && snapshot?.source === 'server' && snapshot?.flags?.[flagName] === true
);
