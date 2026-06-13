export const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const toInt = (value) => {
  const next = Number.parseInt(value, 10);
  return Number.isFinite(next) ? next : 0;
};

export function normalizePropertyHotMetric(row = {}) {
  const propertyId = String(row.property_id || row.propertyId || '');
  if (!propertyId) return null;
  const unlockCount = toInt(row.unlock_count ?? row.unlockCount);
  const normalUnlockCount = toInt(row.normal_unlock_count ?? row.normalUnlockCount);
  const favoriteCount = toInt(row.favorite_count ?? row.favoriteCount);
  const matchCount = toInt(row.match_count ?? row.matchCount);
  const totalCount = toInt(row.total_count ?? row.totalCount ?? (unlockCount + favoriteCount + matchCount));
  const unlockPct = toInt(row.unlock_pct ?? row.unlockPct);
  const favoritePct = toInt(row.favorite_pct ?? row.favoritePct);
  const matchPct = toInt(row.match_pct ?? row.matchPct);
  const exclusivityKind = String(row.exclusivity_kind || row.exclusivityKind || '').trim().toLowerCase();
  const exclusivityMode = String(row.exclusivity_mode || row.exclusivityMode || '').trim().toLowerCase();
  const exclusiveCost = toInt(row.exclusive_cost ?? row.exclusiveCost);
  const expiresAtRaw = row.expires_at ?? row.expiresAt;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw).getTime() : null;

  return {
    propertyId,
    unlockCount,
    normalUnlockCount,
    favoriteCount,
    matchCount,
    totalCount,
    unlockPct,
    favoritePct,
    matchPct,
    hotScore: toInt(row.hot_score ?? row.hotScore),
    exclusivityStatus: {
      kind: exclusivityKind || 'regular',
      mode: exclusivityMode || null,
      badge: exclusivityKind === 'partial'
        ? `Only ${normalUnlockCount} unlock${normalUnlockCount === 1 ? '' : 's'}`
        : (exclusivityKind === 'new' ? 'New' : ''),
      unlockCount: normalUnlockCount,
      canBuyExclusivity: exclusivityKind === 'new' || exclusivityKind === 'partial',
      exclusivityMode: exclusivityKind === 'new' ? 'total' : (exclusivityKind === 'partial' ? 'partial' : null),
      exclusiveCost,
      expiresAt,
    },
  };
}

export function mapPropertyHotMetrics(rows = []) {
  return (rows || []).reduce((acc, row) => {
    const normalized = normalizePropertyHotMetric(row);
    if (normalized?.propertyId) acc[normalized.propertyId] = normalized;
    return acc;
  }, {});
}
