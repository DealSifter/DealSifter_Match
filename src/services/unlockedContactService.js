import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const CACHE_PREFIX = 'ds_unlocked_contact_cards:';

const toStringId = (value) => String(value || '').trim();

const cacheKeyForUser = (userId) => `${CACHE_PREFIX}${toStringId(userId)}`;

const normalizePortfolioItem = (item = {}) => ({
  itemId: item.item_id || item.itemId || '',
  itemType: item.item_type || item.itemType || '',
  title: item.title || '',
  isUnlocked: item.is_unlocked === true || item.isUnlocked === true,
  isExclusive: item.is_exclusive === true || item.isExclusive === true,
});

const normalizeCanonicalContact = (row = {}) => {
  const ownerId = toStringId(row.owner_id || row.ownerId);
  if (!ownerId) return null;
  const contact = row.contact && typeof row.contact === 'object' ? row.contact : {};
  const unlockedPropertyIds = Array.isArray(row.unlocked_property_ids)
    ? row.unlocked_property_ids.map(toStringId).filter(Boolean)
    : (Array.isArray(row.unlockedPropertyIds) ? row.unlockedPropertyIds.map(toStringId).filter(Boolean) : []);
  return {
    ownerId,
    owner_id: ownerId,
    primaryProfile: row.primary_profile || row.primaryProfile || 'personal',
    primary_profile: row.primary_profile || row.primaryProfile || 'personal',
    unlockScope: row.unlock_scope || row.unlockScope || 'contact',
    unlock_scope: row.unlock_scope || row.unlockScope || 'contact',
    unlockedAt: row.unlocked_at || row.unlockedAt || null,
    unlocked_at: row.unlocked_at || row.unlockedAt || null,
    exclusiveExpiresAt: row.exclusive_expires_at || row.exclusiveExpiresAt || null,
    exclusive_expires_at: row.exclusive_expires_at || row.exclusiveExpiresAt || null,
    exclusiveStatus: row.exclusive_status || row.exclusiveStatus || 'none',
    exclusive_status: row.exclusive_status || row.exclusiveStatus || 'none',
    unlockedPropertyIds,
    unlocked_property_ids: unlockedPropertyIds,
    contact: {
      name: contact.name || '',
      avatarUrl: contact.avatar_url || contact.avatarUrl || '',
      avatar_url: contact.avatar_url || contact.avatarUrl || '',
      category: contact.category || '',
      location: contact.location || '',
      email: contact.email || null,
      phonePrimary: contact.phone_primary || contact.phonePrimary || null,
      phone_primary: contact.phone_primary || contact.phonePrimary || null,
      phoneSecondary: contact.phone_secondary || contact.phoneSecondary || null,
      phone_secondary: contact.phone_secondary || contact.phoneSecondary || null,
      whatsapp: contact.whatsapp || null,
      contactMethods: Array.isArray(contact.contact_methods)
        ? contact.contact_methods
        : (Array.isArray(contact.contactMethods) ? contact.contactMethods : []),
      contact_methods: Array.isArray(contact.contact_methods)
        ? contact.contact_methods
        : (Array.isArray(contact.contactMethods) ? contact.contactMethods : []),
    },
    portfolio: Array.isArray(row.portfolio) ? row.portfolio.map(normalizePortfolioItem) : [],
  };
};

const writeCache = (userId, contacts) => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(cacheKeyForUser(userId), JSON.stringify(contacts));
  } catch (error) {
    console.warn('Failed to cache unlocked contacts.', error);
  }
};

export async function fetchUnlockedContacts(userId) {
  const cleanUserId = toStringId(userId);
  const empty = new Map();
  if (!cleanUserId || !isSupabaseConfigured || !supabase) return empty;
  try {
    const { data, error } = await supabase.rpc('ds_get_unlocked_contact_cards', { p_user_id: cleanUserId });
    if (error) throw error;
    const contacts = (Array.isArray(data) ? data : [])
      .map(normalizeCanonicalContact)
      .filter(Boolean);
    writeCache(cleanUserId, contacts);
    return new Map(contacts.map((contact) => [contact.ownerId, contact]));
  } catch (error) {
    console.error('Failed to fetch unlocked contacts.', error);
    return empty;
  }
}

export function getContactByOwnerId(map, ownerId) {
  if (!(map instanceof Map)) return null;
  const key = toStringId(ownerId);
  return key ? (map.get(key) || null) : null;
}

export function isOwnerUnlocked(map, ownerId) {
  return Boolean(getContactByOwnerId(map, ownerId));
}

export function hasOwnerPortfolioEntitlement(map, ownerId) {
  const contact = getContactByOwnerId(map, ownerId);
  if (!contact) return false;
  return ['contact', 'reciprocal'].includes(toStringId(contact.unlockScope || contact.unlock_scope).toLowerCase());
}

export function isPropertyUnlocked(map, ownerId, propertyId) {
  const contact = getContactByOwnerId(map, ownerId);
  const cleanPropertyId = toStringId(propertyId);
  if (!contact || !cleanPropertyId) return false;
  if (hasOwnerPortfolioEntitlement(map, ownerId)) return true;
  if ((contact.unlockedPropertyIds || []).some((id) => id === cleanPropertyId)) return true;
  return (contact.portfolio || []).some((item) => (
    toStringId(item.itemId || item.item_id) === cleanPropertyId
    && item.itemType === 'property'
    && item.isUnlocked === true
  ));
}

export function invalidateCache(userId) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(cacheKeyForUser(userId));
  } catch (error) {
    console.warn('Failed to invalidate unlocked contacts cache.', error);
  }
}
