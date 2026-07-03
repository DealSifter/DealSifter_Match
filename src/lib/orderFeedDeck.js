const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeString = (value) => String(value || '').trim().toLowerCase();

const getCardId = (card) => String(card?.id ?? card?.cardId ?? card?.propertyId ?? '');

const getCardKind = (card) => {
  const raw = normalizeString(card?.cardKind || card?.kind || card?.itemType || card?._itemType);
  if (raw === 'profile' || raw === 'contact') return 'person';
  if (raw === 'deal') return 'property';
  if (raw) return raw;
  if (card?.address || card?.price) return 'property';
  if (card?.title && !card?.name) return 'service';
  return 'person';
};

const getCardTime = (card) => {
  const time = Date.parse(card?.createdAt || card?.created_at || card?.updatedAt || card?.updated_at || '');
  return Number.isFinite(time) ? time : 0;
};

const getNumericScore = (card, keys) => {
  for (const key of keys) {
    const number = Number(card?.[key]);
    if (Number.isFinite(number) && number !== 0) return number;
  }
  return 0;
};

const getStates = (card) => [
  card?.state,
  card?.stateCode,
  card?.loc,
  card?.location,
  card?.city,
  card?.markets,
].flatMap((value) => {
  if (Array.isArray(value)) return value;
  return [value];
}).map((value) => String(value || '').trim().toUpperCase()).filter(Boolean);

const getCategories = (card) => [
  card?.cat,
  card?.category,
  card?.categoryId,
  card?.type,
  card?.primaryCategory,
  card?.primary_category,
].map(normalizeString).filter(Boolean);

const hasPublishedPortfolio = (card) => {
  if (!card) return false;
  if (getCardKind(card) === 'person') return Number(card.portfolioCount || 0) > 0;
  return true;
};

const normalizeSeed = (seed) => {
  const raw = String(seed ?? '1');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seed) => {
  let state = normalizeSeed(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const seededShuffle = (cards, seed) => {
  const next = [...cards];
  const random = createSeededRandom(seed);
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const sortByPreference = (cards, preference, seed) => {
  const sortPreference = normalizeString(preference || 'default');
  if (sortPreference === 'default' || sortPreference === 'random') return seededShuffle(cards, seed);
  return [...cards].sort((a, b) => {
    if (sortPreference === 'hot') {
      const byHot = getNumericScore(b, ['hotScore', 'hot_score', 'hotPressure', 'unlockCount', 'unlock_count'])
        - getNumericScore(a, ['hotScore', 'hot_score', 'hotPressure', 'unlockCount', 'unlock_count']);
      if (byHot !== 0) return byHot;
    }
    if (sortPreference === 'trending') {
      const byTrending = getNumericScore(b, ['trendingScore', 'trending_score', 'favoriteCount', 'favorite_count'])
        - getNumericScore(a, ['trendingScore', 'trending_score', 'favoriteCount', 'favorite_count']);
      if (byTrending !== 0) return byTrending;
    }
    if (sortPreference === 'newest') {
      const byNewest = getCardTime(b) - getCardTime(a);
      if (byNewest !== 0) return byNewest;
    }
    if (sortPreference === 'my_cards_first') {
      if (a.isOwnCard !== b.isOwnCard) return a.isOwnCard ? -1 : 1;
    }
    return getCardId(a).localeCompare(getCardId(b));
  });
};

const matchesCategory = (card, category) => {
  const filter = normalizeString(category);
  if (!filter || filter === 'all') return true;
  return getCategories(card).includes(filter);
};

const matchesState = (card, stateFilter) => {
  const states = toArray(stateFilter).length ? toArray(stateFilter) : [stateFilter];
  const normalized = states.map((state) => String(state || '').trim().toUpperCase()).filter((state) => state && state !== 'ALL');
  if (!normalized.length) return true;
  const cardStates = getStates(card);
  return cardStates.some((state) => normalized.includes(state));
};

const matchesType = (card, type) => {
  const filter = normalizeString(type);
  if (!filter || filter === 'all') return true;
  const kind = getCardKind(card);
  if (filter === 'people') return kind === 'person';
  if (filter === 'deals' || filter === 'properties') return kind === 'property';
  return kind === filter;
};

const applyFilters = (card, activeFilters = {}) => (
  matchesCategory(card, activeFilters.category ?? activeFilters.cat)
  && matchesState(card, activeFilters.state ?? activeFilters.states)
  && matchesType(card, activeFilters.type ?? activeFilters.cardType ?? activeFilters.kind)
);

const placeSpotlightsWithinOthers = (cards) => {
  const spotlight = [];
  const regular = [];
  cards.forEach((card) => {
    (card?.isSpotlight ? spotlight : regular).push(card);
  });
  return [...spotlight, ...regular];
};

export function orderDeck(normalizedCards, context = {}) {
  const {
    currentUserId = '',
    activeFilters = {},
    sessionSeed = 1,
    sortPreference = 'default',
  } = context || {};

  const validCards = toArray(normalizedCards)
    .filter(Boolean)
    .filter(hasPublishedPortfolio)
    .filter((card) => applyFilters(card, activeFilters))
    .map((card) => ({
      ...card,
      isOwnCard: card.isOwnCard === true || String(card.ownerId || '') === String(currentUserId || ''),
    }));

  const others = validCards.filter((card) => !card.isOwnCard);
  const own = validCards.filter((card) => card.isOwnCard);
  const sortedOthers = placeSpotlightsWithinOthers(sortByPreference(others, sortPreference, `${sessionSeed}:others`));
  const sortedOwn = sortByPreference(own, sortPreference, `${sessionSeed}:own`);
  return [...sortedOthers, ...sortedOwn];
}

export default orderDeck;
