export type ProviderAvailabilityState = 'AVAILABLE' | 'QUOTA_EXHAUSTED' | 'BUDGET_BLOCKED' | 'TEMPORARILY_UNAVAILABLE' | 'UNKNOWN';
export function providerAvailabilityFromError(error: unknown): ProviderAvailabilityState {
  const code = String(error instanceof Error ? error.message : error);
  if (/MONTHLY_PROVIDER_LIMIT_REACHED|PROVIDER_RATE_LIMIT|PROVIDER_SUBSCRIPTION_ERROR/.test(code)) return 'QUOTA_EXHAUSTED';
  if (/BUDGET|COOLDOWN|CREDITS|USAGE_GUARD/.test(code)) return 'BUDGET_BLOCKED';
  if (/PROVIDER_(?:DISABLED|TIMEOUT|NETWORK_ERROR|UPSTREAM_ERROR|AUTH_ERROR|NOT_CONFIGURED)/.test(code)) return 'TEMPORARILY_UNAVAILABLE';
  return 'UNKNOWN';
}
export function isProviderUnavailableError(error: unknown) { return providerAvailabilityFromError(error) !== 'UNKNOWN'; }
const unavailable = new Map<string, { state: ProviderAvailabilityState; until: number; error: Error }>();
export function assertProviderAvailable(key: string, now = Date.now()) {
  const entry = unavailable.get(key);
  if (entry && entry.until > now) throw entry.error;
  unavailable.delete(key);
}
export function rememberProviderFailure(key: string, error: unknown, now = Date.now()) {
  const state = providerAvailabilityFromError(error);
  if (state !== 'UNKNOWN') unavailable.set(key, { state, until: now + (state === 'QUOTA_EXHAUSTED' ? 300_000 : 60_000), error: error instanceof Error ? error : new Error(String(error)) });
}
export function getProviderAvailability(key: string, now = Date.now()): ProviderAvailabilityState {
  const entry = unavailable.get(key);
  return entry && entry.until > now ? entry.state : 'UNKNOWN';
}
