export const EXCLUSIVITY_TOTAL_COST = 20;
export const EXCLUSIVITY_PARTIAL_DISCOUNT = 0.1;
export const EXCLUSIVITY_PARTIAL_COST = Math.round(EXCLUSIVITY_TOTAL_COST * (1 - EXCLUSIVITY_PARTIAL_DISCOUNT));
export const EXCLUSIVITY_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const sameId = (a, b) => String(a ?? '') === String(b ?? '');
const isTruthyFlag = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'active';
};

export function getPortfolioUnlockCost(ownerId, properties = [], services = []) {
  return Math.max(1, getPortfolioItemCount(ownerId, properties, services));
}

export function getPortfolioItemCount(ownerId, properties = [], services = []) {
  if (!ownerId) return 0;
  const propertyCount = (properties || []).filter((property) => (
    sameId(property?.ownerId, ownerId) && isTruthyFlag(property?.isActive, true)
  )).length;
  const serviceCount = (services || []).filter((service) => (
    sameId(service?.ownerId, ownerId) && isTruthyFlag(service?.publishToConnections, true)
  )).length;
  return propertyCount + serviceCount;
}

export function getPropertyExclusivityStatus(records = [], propertyId, currentUserId = 'local-user', now = Date.now()) {
  if (!propertyId) return { kind: 'none', canBuyExclusivity: false, exclusiveCost: 0, unlockCount: 0 };
  const rows = (records || []).filter((row) => sameId(row?.propertyId, propertyId));
  const activeExclusive = rows.find((row) => (
    (row?.mode === 'total' || row?.mode === 'partial') && Number(row?.expiresAt || 0) > now
  ));
  const normalUnlockCount = rows.filter((row) => row?.mode === 'normal').length;

  if (activeExclusive) {
    return {
      kind: sameId(activeExclusive.buyerId, currentUserId) ? 'owned' : 'blocked',
      badge: activeExclusive.mode === 'partial' ? 'Partial exclusivity' : 'Exclusive',
      unlockCount: normalUnlockCount,
      canBuyExclusivity: false,
      exclusiveCost: 0,
      expiresAt: activeExclusive.expiresAt,
      mode: activeExclusive.mode,
    };
  }

  if (normalUnlockCount === 0) {
    return {
      kind: 'new',
      badge: 'New',
      unlockCount: 0,
      canBuyExclusivity: true,
      exclusivityMode: 'total',
      exclusiveCost: EXCLUSIVITY_TOTAL_COST,
    };
  }

  if (normalUnlockCount <= 2) {
    return {
      kind: 'partial',
      badge: `Only ${normalUnlockCount} unlock${normalUnlockCount === 1 ? '' : 's'}`,
      unlockCount: normalUnlockCount,
      canBuyExclusivity: true,
      exclusivityMode: 'partial',
      exclusiveCost: EXCLUSIVITY_PARTIAL_COST,
    };
  }

  return {
    kind: 'regular',
    badge: '',
    unlockCount: normalUnlockCount,
    canBuyExclusivity: false,
    exclusiveCost: 0,
  };
}

export function createPropertyUnlockRecord({ propertyId, ownerId, buyerId = 'local-user', mode = 'normal', cost = 1 }) {
  const cleanMode = ['normal', 'total', 'partial'].includes(mode) ? mode : 'normal';
  const now = Date.now();
  return {
    id: `${propertyId || 'property'}:${buyerId}:${cleanMode}:${now}`,
    propertyId,
    ownerId,
    buyerId,
    mode: cleanMode,
    cost,
    createdAt: now,
    expiresAt: cleanMode === 'normal' ? null : now + EXCLUSIVITY_DURATION_MS,
  };
}
