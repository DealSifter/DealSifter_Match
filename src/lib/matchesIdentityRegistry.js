import { buildProfileEntitlementKey, getRecordProfileScope } from './profileScope';

const normalizeId = (value) => String(value || '').trim();
const normalizeLabel = (value) => String(value || '')
  .trim()
  .toLocaleLowerCase()
  .replace(/\s+/g, ' ');

export const getOwnerIdentityKey = (record) => normalizeId(
  record?.ownerId
  || record?.owner_id
  || record?.unlockOwnerId
  || record?.unlock_owner_id
  || record?.sellerId
  || record?.seller_id
  || record?.contactId
  || record?.contact_id
);

export const getContactProfileIdentityKey = (record) => {
  const ownerId = getOwnerIdentityKey(record);
  return ownerId ? buildProfileEntitlementKey(ownerId, getRecordProfileScope(record)) : '';
};

export const hasSameOwnerIdentity = (left, right) => {
  const leftOwnerId = getOwnerIdentityKey(left);
  return Boolean(leftOwnerId && leftOwnerId === getOwnerIdentityKey(right));
};

const mergeAuthority = (base, incoming) => ({ ...(base || {}), ...(incoming || {}) });

export function createMatchesIdentityRegistry(authoritativeContacts = []) {
  const profilesByKey = new Map();
  const profilesByOwner = new Map();

  (Array.isArray(authoritativeContacts) ? authoritativeContacts : []).forEach((contact) => {
    const ownerId = getOwnerIdentityKey(contact);
    const profileKey = getContactProfileIdentityKey(contact);
    if (!ownerId || !profileKey) return;
    profilesByKey.set(profileKey, mergeAuthority(profilesByKey.get(profileKey), contact));
  });

  profilesByKey.forEach((contact) => {
    const ownerId = getOwnerIdentityKey(contact);
    const current = profilesByOwner.get(ownerId) || [];
    current.push(contact);
    profilesByOwner.set(ownerId, current);
  });

  const resolveSnapshot = (snapshot) => {
    const ownerId = getOwnerIdentityKey(snapshot);
    if (!ownerId) return null;
    const candidates = profilesByOwner.get(ownerId) || [];
    if (!candidates.length) return null;

    const exactProfile = profilesByKey.get(getContactProfileIdentityKey(snapshot));
    if (exactProfile) return exactProfile;

    const snapshotName = normalizeLabel(snapshot?.name || snapshot?.title);
    const sameName = snapshotName
      ? candidates.find((contact) => normalizeLabel(contact?.name || contact?.title) === snapshotName)
      : null;
    if (sameName) return sameName;

    return [...candidates].sort((left, right) => (
      Number(right?.portfolioCount || right?.linkedPortfolioCount || 0)
      - Number(left?.portfolioCount || left?.linkedPortfolioCount || 0)
    ))[0];
  };

  const attachSnapshots = (snapshots = []) => {
    const result = new Map(profilesByKey);
    (Array.isArray(snapshots) ? snapshots : []).forEach((snapshot) => {
      const authority = resolveSnapshot(snapshot);
      if (!authority) {
        const snapshotKey = getContactProfileIdentityKey(snapshot);
        if (snapshotKey) result.set(snapshotKey, mergeAuthority(result.get(snapshotKey), snapshot));
        return;
      }

      const authorityKey = getContactProfileIdentityKey(authority);
      result.set(authorityKey, {
        ...authority,
        // Historical systems may carry stale names, avatars, categories and
        // scopes. Only relationship state is allowed to cross this boundary.
        chatLinked: Boolean(authority?.chatLinked || snapshot?.chatLinked),
        chatUnreadSource: Boolean(authority?.chatUnreadSource || snapshot?.chatUnreadSource),
      });
    });
    return [...result.values()];
  };

  return {
    profilesByKey,
    profilesByOwner,
    resolveSnapshot,
    attachSnapshots,
  };
}
