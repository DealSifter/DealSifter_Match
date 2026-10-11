import { inferRecordProfileScope } from './profileScopeResolver';
import { isOwnerUnlocked, isPropertyUnlocked } from '../services/unlockedContactService';

const id = value => String(value ?? '').trim();

export function getContactUnlockKeys(item) {
  if (item == null) return [];
  if (typeof item !== 'object') return id(item) ? [id(item)] : [];
  return [...new Set([
    item.ownerId, item.owner_id, item.unlockOwnerId, item.sellerId,
    item.contactId, item.unlockContactId, item.id, item.sourceCardId,
  ].map(id).filter(Boolean))];
}

// Map and Matches must read the same contact/asset grants. An unlocked contact
// alone is not a portfolio grant when only a specific property was purchased.
export function resolveContactUnlockState(item, contactMap, unlockedIds, scope = inferRecordProfileScope(item)) {
  if (item && typeof item === 'object') {
    const ownerId = item.ownerId || item.owner_id || item.unlockOwnerId || item.sellerId || item.id;
    if (isOwnerUnlocked(contactMap, ownerId, scope)) return true;
  }
  return getContactUnlockKeys(item).some(key => unlockedIds?.has(key));
}

export function resolvePropertyUnlockState(property, contactMap, scope = inferRecordProfileScope(property)) {
  if (!property) return false;
  const ownerId = id(property.ownerId || property.owner_id);
  const propertyId = id(property.id || property.propertyId || property.property_id || property.portfolioId);
  return Boolean(ownerId && propertyId && isPropertyUnlocked(contactMap, ownerId, propertyId, scope));
}
