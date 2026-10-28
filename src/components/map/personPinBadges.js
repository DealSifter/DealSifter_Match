const CONTACT_KEYS = new Set([
  'email', 'phone', 'whatsapp', 'telegram', 'contact', 'contacts',
  'primaryphone', 'secondaryphone', 'tertiaryphone', 'emailfsbo',
  'contactmethods', 'contactmethod',
]);

const cleanText = (value) => String(value ?? '').trim();

const addBadge = (list, seen, value) => {
  const text = cleanText(value);
  if (!text || text.length > 28) return;
  const key = text.toLowerCase();
  if (CONTACT_KEYS.has(key.replace(/[\s_-]/g, '')) || seen.has(key)) return;
  seen.add(key);
  list.push(text);
};

const addValues = (list, seen, value) => {
  if (Array.isArray(value)) {
    value.forEach((item) => addValues(list, seen, item));
    return;
  }
  if (value && typeof value === 'object') {
    addValues(list, seen, value.label || value.name || value.title || value.category || value.type);
    return;
  }
  addBadge(list, seen, value);
};

export function getPersonMapBadges(payload, labels = {}) {
  const badges = [];
  const seen = new Set();
  const dealsLabel = labels.deals || 'deals';
  const verifiedLabel = labels.verified || 'Verified';
  const scope = cleanText(payload?.primaryProfile || payload?.scope).toLowerCase();

  addValues(badges, seen, [
    payload?.type,
    payload?.cat,
    payload?.category,
    payload?.badge,
    payload?.loc,
    scope === 'fsbo' ? (labels.fsbo || 'FSBO') : '',
    scope === 'professional' ? (labels.business || 'Business') : '',
    payload?.investorRoles,
    payload?.investmentProfile?.investorRoles,
    payload?.tags,
    payload?.strategies,
    payload?.interests,
    payload?.segmentations,
    payload?.markets,
    payload?.selectedMarkets,
    payload?.investmentProfile?.markets,
    payload?.investmentProfile?.strategies,
  ]);

  const deals = Number(payload?.deals);
  if (Number.isFinite(deals) && deals > 0) addBadge(badges, seen, `${deals} ${dealsLabel}`);
  if (payload?.isVerified || payload?.verified) addBadge(badges, seen, verifiedLabel);
  if (payload?.isHot) addBadge(badges, seen, labels.hot || 'Hot');
  if (payload?.isTrending) addBadge(badges, seen, labels.trending || 'Trending');
  if (payload?.isNew) addBadge(badges, seen, labels.isNew || 'New');
  if (payload?.isExclusive) addBadge(badges, seen, labels.exclusive || 'Exclusive');
  if (payload?.isSpotlight) addBadge(badges, seen, labels.spotlight || 'Spotlight');

  (Array.isArray(payload?.linkedProperties) ? payload.linkedProperties : []).forEach((property) => {
    addValues(badges, seen, [property?.type, property?.objective, property?.strategy, property?.dealTag, property?.state]);
  });
  (Array.isArray(payload?.linkedServices) ? payload.linkedServices : []).forEach((service) => {
    addValues(badges, seen, [service?.category, service?.title]);
  });

  return badges.slice(0, 8);
}
