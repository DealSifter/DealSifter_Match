import { getContactByOwnerId } from '../services/unlockedContactService';

const normalizeId = (value) => String(value || '').trim();

export const canonicalContactToDisplayCard = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const ownerId = normalizeId(entry.ownerId || entry.owner_id);
  if (!ownerId) return null;
  const contact = entry.contact && typeof entry.contact === 'object' ? entry.contact : {};
  const contactMethods = Array.isArray(contact.contactMethods)
    ? contact.contactMethods
    : (Array.isArray(contact.contact_methods) ? contact.contact_methods : []);
  const unlockedPropertyIds = Array.isArray(entry.unlockedPropertyIds)
    ? entry.unlockedPropertyIds
    : (Array.isArray(entry.unlocked_property_ids) ? entry.unlocked_property_ids : []);
  return {
    id: ownerId,
    ownerId,
    unlockOwnerId: ownerId,
    source: 'remote-unlock',
    primaryProfile: entry.primaryProfile || entry.primary_profile || 'personal',
    unlockScope: entry.unlockScope || entry.unlock_scope || 'contact',
    name: contact.name || 'Unlocked contact',
    title: contact.name || 'Unlocked contact',
    type: contact.category || 'Contact',
    category: contact.category || '',
    cat: contact.category || '',
    loc: contact.location || '',
    photo: contact.avatarUrl || contact.avatar_url || '',
    avatar: contact.avatarUrl || contact.avatar_url || '',
    email: contact.email || '',
    primaryPhone: contact.phonePrimary || contact.phone_primary || '',
    phone: contact.phonePrimary || contact.phone_primary || '',
    secondaryPhone: contact.phoneSecondary || contact.phone_secondary || '',
    whatsapp: contact.whatsapp || '',
    contactMethods,
    portfolioCount: Array.isArray(entry.portfolio) ? entry.portfolio.length : 0,
    unlockedPropertyIds: unlockedPropertyIds.map(normalizeId).filter(Boolean),
    exclusiveStatus: entry.exclusiveStatus || entry.exclusive_status || 'none',
    exclusiveExpiresAt: entry.exclusiveExpiresAt || entry.exclusive_expires_at || null,
    unlockedAt: entry.unlockedAt || entry.unlocked_at || null,
    canonicalContact: entry,
  };
};

export const resolveCanonicalContactCardFromMap = (unlockedContactMap, contactLike) => {
  if (!contactLike) return null;
  const ownerId = normalizeId(contactLike.ownerId || contactLike.unlockOwnerId || contactLike.id);
  if (!ownerId) return null;
  const canonicalEntry = getContactByOwnerId(unlockedContactMap, ownerId);
  return canonicalEntry ? canonicalContactToDisplayCard(canonicalEntry) : null;
};
