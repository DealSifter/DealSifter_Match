import { fetchUnlockedContacts } from './unlockedContactService';

const normalizeText = (value) => String(value || '').trim();

const getUnlockedPropertyIds = (entry = {}) => {
  const ids = Array.isArray(entry.unlockedPropertyIds)
    ? entry.unlockedPropertyIds
    : (Array.isArray(entry.unlocked_property_ids) ? entry.unlocked_property_ids : []);
  return ids.map(normalizeText).filter(Boolean);
};

const toPropertyUnlockRows = (entry, buyerId) => {
  const ownerId = normalizeText(entry?.ownerId || entry?.owner_id);
  if (!ownerId) return [];
  const scope = normalizeText(entry?.unlockScope || entry?.unlock_scope);
  const exclusive = scope === 'exclusive';
  return getUnlockedPropertyIds(entry).map((propertyId) => ({
    id: `canonical:${buyerId}:${ownerId}:${propertyId}`,
    propertyId,
    ownerId,
    buyerId,
    mode: exclusive ? 'total' : 'normal',
    cost: 0,
    createdAt: entry.unlockedAt || entry.unlocked_at || null,
    expiresAt: entry.exclusiveExpiresAt || entry.exclusive_expires_at || null,
    status: 'active',
    source: 'canonical_unlocked_contact_cards',
  }));
};

export async function hydrateUnlockState(userId) {
  const cleanUserId = normalizeText(userId);
  if (!cleanUserId) {
    return {
      unlockedContactMap: new Map(),
      unlockedOwnerIds: new Set(),
      unlockedPropertyIds: new Set(),
      exclusiveStatusByOwner: new Map(),
      propertyUnlockRows: [],
      purchaseRows: [],
    };
  }

  const unlockedContactMap = await fetchUnlockedContacts(cleanUserId);
  const entries = Array.from(unlockedContactMap.values());
  const unlockedOwnerIds = new Set();
  const unlockedPropertyIds = new Set();
  const exclusiveStatusByOwner = new Map();
  const propertyUnlockRows = [];
  const purchaseRows = [];

  entries.forEach((entry) => {
    const ownerId = normalizeText(entry?.ownerId || entry?.owner_id);
    if (!ownerId || ownerId === cleanUserId) return;
    unlockedOwnerIds.add(ownerId);
    purchaseRows.push({ sellerId: ownerId });
    const exclusiveStatus = entry?.exclusiveStatus || entry?.exclusive_status || 'none';
    exclusiveStatusByOwner.set(ownerId, {
      status: exclusiveStatus,
      expiresAt: entry?.exclusiveExpiresAt || entry?.exclusive_expires_at || null,
    });
    getUnlockedPropertyIds(entry).forEach((propertyId) => unlockedPropertyIds.add(propertyId));
    propertyUnlockRows.push(...toPropertyUnlockRows(entry, cleanUserId));
  });

  return {
    unlockedContactMap,
    unlockedOwnerIds,
    unlockedPropertyIds,
    exclusiveStatusByOwner,
    propertyUnlockRows,
    purchaseRows,
  };
}
