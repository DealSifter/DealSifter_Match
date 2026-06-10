export const EXCLUSIVITY_TOTAL_COST = 20;
export const EXCLUSIVITY_PARTIAL_DISCOUNT = 0.1;
export const EXCLUSIVITY_PARTIAL_COST = Math.round(EXCLUSIVITY_TOTAL_COST * (1 - EXCLUSIVITY_PARTIAL_DISCOUNT));
export const EXCLUSIVITY_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function getPropertyUnlockRows(rows, propertyId, now = Date.now()) {
  const id = String(propertyId || '');
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (String(row?.propertyId || '') !== id) return false;
    const mode = String(row?.mode || 'normal');
    if (mode === 'normal') return true;
    const expiresAt = Number(row?.expiresAt || 0);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

export function pruneExpiredPropertyUnlocks(rows, now = Date.now()) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    const mode = String(row?.mode || 'normal');
    if (mode === 'normal') return true;
    const expiresAt = Number(row?.expiresAt || 0);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}

export function getPropertyExclusivityStatus(rows, propertyId, currentUserId = 'local-user', now = Date.now()) {
  const activeRows = getPropertyUnlockRows(rows, propertyId, now);
  const normalRows = activeRows.filter((row) => String(row?.mode || 'normal') === 'normal');
  const exclusiveRows = activeRows.filter((row) => String(row?.mode || '') === 'total' || String(row?.mode || '') === 'partial');
  const activeExclusive = exclusiveRows.find((row) => Number(row?.expiresAt || 0) > now) || null;
  const activeExclusiveByCurrentUser = activeExclusive && String(activeExclusive.buyerId || '') === String(currentUserId || '');
  const normalUnlockCount = normalRows.length;

  if (activeExclusive && !activeExclusiveByCurrentUser) {
    return {
      kind: 'blocked',
      badge: String(activeExclusive.mode) === 'partial' ? 'Partial exclusivity' : 'Exclusive',
      unlockCount: normalUnlockCount,
      activeExclusive,
      canUnlockNormal: false,
      canBuyExclusivity: false,
      exclusiveCost: 0,
    };
  }

  if (normalUnlockCount === 0 && !activeExclusive) {
    return {
      kind: 'new',
      badge: 'New',
      unlockCount: 0,
      activeExclusive: null,
      canUnlockNormal: true,
      canBuyExclusivity: true,
      exclusivityMode: 'total',
      exclusiveCost: EXCLUSIVITY_TOTAL_COST,
    };
  }

  if (normalUnlockCount > 0 && normalUnlockCount <= 2 && !activeExclusive) {
    return {
      kind: 'partial',
      badge: `Only ${normalUnlockCount} unlock${normalUnlockCount === 1 ? '' : 's'}`,
      unlockCount: normalUnlockCount,
      activeExclusive: null,
      canUnlockNormal: true,
      canBuyExclusivity: true,
      exclusivityMode: 'partial',
      exclusiveCost: EXCLUSIVITY_PARTIAL_COST,
    };
  }

  return {
    kind: 'standard',
    badge: '',
    unlockCount: normalUnlockCount,
    activeExclusive: activeExclusive || null,
    canUnlockNormal: !activeExclusive || Boolean(activeExclusiveByCurrentUser),
    canBuyExclusivity: false,
    exclusiveCost: 0,
  };
}

export function buildPropertyUnlockRecord({ propertyId, buyerId, mode = 'normal', now = Date.now() }) {
  const cleanMode = mode === 'total' || mode === 'partial' ? mode : 'normal';
  return {
    id: `${propertyId || 'property'}-${cleanMode}-${now}`,
    propertyId: String(propertyId || ''),
    buyerId: String(buyerId || 'local-user'),
    mode: cleanMode,
    createdAt: now,
    expiresAt: cleanMode === 'normal' ? null : now + EXCLUSIVITY_DURATION_MS,
  };
}
