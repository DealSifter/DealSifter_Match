// TTL controls refresh, not retention. A retained reference has no invented
// freshness extension: staleUntil is null until explicitly invalidated.
export type EvidenceFreshnessState = 'FRESH' | 'STALE_USABLE' | 'EXPIRED_UNUSABLE' | 'IDENTITY_MISMATCH' | 'ABSENT' | 'CORRUPT';
export type CacheReadPolicy = { allowStale?: boolean; validatedAddressAlias?: string; legacyQueryFingerprint?: string };
export type EvidenceFreshness = {
  state: EvidenceFreshnessState; retrievedAt: string | null; freshUntil: string | null;
  staleUntil: null; staleUsable: boolean; provider: 'rentcast'; identityFingerprint: string | null;
};
export function cacheFreshness(entry: { retrievedAt: string; expiresAt: string; addressFingerprint?: string | null } | null,
  options: { now?: number; identityMatches?: boolean; structurallyValid?: boolean; invalidated?: boolean } = {}): EvidenceFreshness {
  let state: EvidenceFreshnessState = 'ABSENT';
  if (entry) {
    const retrieved = Date.parse(entry.retrievedAt), expiry = Date.parse(entry.expiresAt);
    const valid = options.structurallyValid !== false && Number.isFinite(retrieved) && Number.isFinite(expiry)
      && expiry > retrieved && retrieved <= (options.now ?? Date.now()) + 60_000;
    state = !valid ? 'CORRUPT' : options.identityMatches === false ? 'IDENTITY_MISMATCH'
      : options.invalidated ? 'EXPIRED_UNUSABLE' : expiry > (options.now ?? Date.now()) ? 'FRESH' : 'STALE_USABLE';
  }
  return { state, retrievedAt: entry?.retrievedAt || null, freshUntil: entry?.expiresAt || null,
    staleUntil: null, staleUsable: state === 'STALE_USABLE', provider: 'rentcast', identityFingerprint: entry?.addressFingerprint || null };
}
export function canReadRetained(entry: { retrievedAt: string; expiresAt: string }, policy: CacheReadPolicy = {}, now = Date.now()) {
  const state = cacheFreshness(entry, { now }).state;
  return state === 'FRESH' || (policy.allowStale === true && state === 'STALE_USABLE');
}
