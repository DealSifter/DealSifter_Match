function hashFeedString(value = '') {
  const input = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getFeedPseudoRandomRank(id, seed) {
  return hashFeedString(`${seed || 'feed'}:${String(id || '')}`);
}

function getComparableName(record) {
  return String(record?.name || record?.title || record?.address || '').trim().toLowerCase();
}

function getComparableTime(record) {
  const time = Date.parse(record?.createdAt || record?.created_at || record?.updatedAt || record?.updated_at || '');
  return Number.isFinite(time) ? time : 0;
}

function getComparablePrice(record) {
  const price = Number(record?.price || record?.value || 0);
  return Number.isFinite(price) ? price : 0;
}

export function sortFeedRecords(records, {
  sortOrder = 'random',
  seed = 'feed',
  selfOwnerIds = new Set(),
  ownPlacement = 'last',
  getId = (item) => item?.id,
  getOwnerId = (item) => item?.ownerId || item?.id,
  fallbackRank = () => 0,
} = {}) {
  return [...(records || [])].sort((a, b) => {
    const aOwner = String(getOwnerId(a) || '');
    const bOwner = String(getOwnerId(b) || '');
    const aSelf = selfOwnerIds.has(aOwner) || selfOwnerIds.has(String(getId(a) || ''));
    const bSelf = selfOwnerIds.has(bOwner) || selfOwnerIds.has(String(getId(b) || ''));
    if (aSelf !== bSelf) return ownPlacement === 'first' ? (aSelf ? -1 : 1) : (aSelf ? 1 : -1);

    if (sortOrder === 'name_asc') {
      const byName = getComparableName(a).localeCompare(getComparableName(b));
      if (byName !== 0) return byName;
    } else if (sortOrder === 'price_asc') {
      const byPrice = getComparablePrice(a) - getComparablePrice(b);
      if (byPrice !== 0) return byPrice;
    } else if (sortOrder === 'price_desc') {
      const byPrice = getComparablePrice(b) - getComparablePrice(a);
      if (byPrice !== 0) return byPrice;
    } else if (sortOrder === 'recent') {
      const byRecent = getComparableTime(b) - getComparableTime(a);
      if (byRecent !== 0) return byRecent;
    } else if (sortOrder === 'my_cards_first') {
      const byRank = fallbackRank(b) - fallbackRank(a);
      if (byRank !== 0) return byRank;
    } else {
      const byRandom = getFeedPseudoRandomRank(getId(a), seed) - getFeedPseudoRandomRank(getId(b), seed);
      if (byRandom !== 0) return byRandom;
    }

    const byRank = fallbackRank(b) - fallbackRank(a);
    if (byRank !== 0) return byRank;
    return String(getId(a) || '').localeCompare(String(getId(b) || ''));
  });
}

export function placeOwnFeedIds(ids, {
  findRecord,
  getOwnerId = (record) => record?.ownerId || record?.id,
  selfOwnerIds = new Set(),
  ownPlacement = 'last',
  skip = false,
} = {}) {
  if (!Array.isArray(ids) || skip) return ids;
  const own = [];
  const other = [];

  ids.forEach((id) => {
    const record = typeof findRecord === 'function' ? findRecord(id) : null;
    const ownerId = String(getOwnerId(record) || id || '');
    const isSelf = selfOwnerIds.has(ownerId) || selfOwnerIds.has(String(id || ''));
    (isSelf ? own : other).push(id);
  });

  return ownPlacement === 'first' ? [...own, ...other] : [...other, ...own];
}
