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

const addCandidate = (set, value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return;
  set.add(raw);
  if (raw.startsWith('local:')) {
    const parts = raw.split(':').map((part) => part.trim()).filter(Boolean);
    const tail = parts[parts.length - 1];
    if (tail) set.add(tail);
  }
};

export function getUnlockOwnerCandidates(ownerOrCard) {
  const candidates = new Set();
  if (ownerOrCard && typeof ownerOrCard === 'object') {
    addCandidate(candidates, ownerOrCard.unlockOwnerId);
    addCandidate(candidates, ownerOrCard.ownerId);
    addCandidate(candidates, ownerOrCard.sellerId);
    addCandidate(candidates, ownerOrCard.contactId);
    addCandidate(candidates, ownerOrCard.id);
  } else {
    addCandidate(candidates, ownerOrCard);
  }
  return [...candidates];
}

export function resolveUnlockOwnerId(ownerOrCard, properties = [], services = []) {
  const candidates = getUnlockOwnerCandidates(ownerOrCard);
  const allItems = [...(properties || []), ...(services || [])];
  const matched = allItems.find((item) => candidates.some((candidate) => sameId(item?.ownerId, candidate)));
  if (matched?.ownerId) return String(matched.ownerId);
  return candidates[0] || '';
}

export function getPortfolioUnlockCost(ownerOrCard, properties = [], services = []) {
  return Math.max(1, getPortfolioItemCount(ownerOrCard, properties, services));
}

export function getPortfolioItemCount(ownerOrCard, properties = [], services = []) {
  const ownerCandidates = getUnlockOwnerCandidates(ownerOrCard);
  if (!ownerCandidates.length) return 0;
  const propertyIds = new Set();
  (properties || []).forEach((property, idx) => {
    if (!ownerCandidates.some((ownerId) => sameId(property?.ownerId, ownerId))) return;
    if (!isTruthyFlag(property?.isActive, true) || property?.dealClosed === true) return;
    propertyIds.add(String(property?.id || property?.portfolioId || `property:${property?.ownerId || 'owner'}:${idx}`));
  });
  const serviceIds = new Set();
  (services || []).forEach((service, idx) => {
    if (!ownerCandidates.some((ownerId) => sameId(service?.ownerId, ownerId))) return;
    if (!isTruthyFlag(service?.publishToConnections, true)) return;
    serviceIds.add(String(service?.id || `service:${service?.ownerId || 'owner'}:${idx}`));
  });
  const propertyCount = propertyIds.size;
  const serviceCount = serviceIds.size;
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
