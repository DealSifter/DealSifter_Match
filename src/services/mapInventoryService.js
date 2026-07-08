const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const pickString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const truthyFlag = (value, fallback = true) => {
  if (value == null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const raw = String(value).trim().toLowerCase();
  if (['false', '0', 'off', 'no', 'nao', 'não'].includes(raw)) return false;
  if (['true', '1', 'on', 'yes', 'sim'].includes(raw)) return true;
  return fallback;
};

const getLatLng = (card) => {
  const lat = toNumber(card?.lat ?? card?.latitude ?? card?.coords?.lat ?? card?.location?.lat);
  const lng = toNumber(card?.lng ?? card?.longitude ?? card?.coords?.lng ?? card?.location?.lng);
  if (lat == null || lng == null) return null;
  if (lat < -85 || lat > 85 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const getPinKind = (card) => {
  const raw = String(card?.cardKind || card?.itemType || card?._itemType || card?.kind || card?.typeKind || '').trim().toLowerCase();
  if (['person', 'profile', 'contact'].includes(raw)) return 'person';
  if (['property', 'deal'].includes(raw)) return 'property';
  if (raw === 'service') return 'service';
  if (card?.address || card?.price != null || Array.isArray(card?.images)) return 'property';
  return 'person';
};

const getState = (card) => {
  const direct = pickString(card?.state, card?.stateCode, card?.state_code);
  if (direct) return direct.toUpperCase();
  const loc = pickString(card?.loc, card?.location, card?.city);
  const match = loc.match(/\b[A-Z]{2}\b/i);
  return match ? match[0].toUpperCase() : '';
};

const isPublished = (card, kind) => {
  if (!card || typeof card !== 'object') return false;
  if (truthyFlag(card.deleted, false)) return false;
  if (!truthyFlag(card.published ?? card.isPublished ?? card.is_published, true)) return false;
  if (kind === 'property') {
    return truthyFlag(card.isActive ?? card.is_active, true)
      && truthyFlag(card.publishToShowcase ?? card.publish_to_showcase, true);
  }
  if (kind === 'service') {
    return truthyFlag(card.publishToConnections ?? card.publish_to_connections, true);
  }
  return truthyFlag(card.publishToConnections ?? card.publish_to_connections ?? card.publishToFeed, true)
    || truthyFlag(card.publishToShowcase ?? card.publish_to_showcase, true);
};

const matchesTypeFilter = (kind, filters = {}) => {
  const type = String(filters.type || filters.itemType || '').trim().toLowerCase();
  const showPeople = filters.showPeople !== false;
  const showDeals = filters.showDeals ?? filters.showProperties;
  const allowDeals = showDeals !== false;

  if (type === 'people' || type === 'person') return kind === 'person' || kind === 'service';
  if (type === 'properties' || type === 'property' || type === 'deals' || type === 'deal') return kind === 'property';
  if (kind === 'property') return allowDeals;
  return showPeople;
};

const matchesFilters = (card, kind, currentUserId, filters = {}) => {
  if (!matchesTypeFilter(kind, filters)) return false;
  const ownerId = pickString(card?.ownerId, card?.owner_id, card?.unlockOwnerId, card?.sellerId);
  const isOwnCard = card?.isOwnCard === true
    || card?.__mapFeature?.properties?.isOwn === true
    || String(ownerId) === String(currentUserId || '');
  if (filters.myPinsOnly === true || filters.showOnlyMyPins === true) {
    if (!isOwnCard) return false;
  }
  if (filters.spotlightOnly === true && card?.isSpotlight !== true) return false;

  const state = pickString(filters.state, filters.stateCode);
  if (state && state.toLowerCase() !== 'all' && getState(card) !== String(state).toUpperCase()) return false;

  const category = pickString(filters.category, filters.cat);
  if (category && category.toLowerCase() !== 'all') {
    const cardCategory = pickString(card?.category, card?.cat, card?.type, card?.primaryCategory).toLowerCase();
    if (cardCategory && !cardCategory.includes(category.toLowerCase())) return false;
  }
  return true;
};

const toPin = (card, currentUserId) => {
  const coords = getLatLng(card);
  if (!coords) return null;

  const kind = getPinKind(card);
  if (!isPublished(card, kind)) return null;

  const ownerId = pickString(card.ownerId, card.owner_id, card.unlockOwnerId, card.sellerId, kind === 'person' ? card.id : '');
  const id = pickString(card.id, card.propertyId, card.serviceId, card.cardId, ownerId);
  if (!id || !ownerId) return null;

  const isOwnCard = card?.isOwnCard === true
    || card?.__mapFeature?.properties?.isOwn === true
    || String(ownerId) === String(currentUserId || '');

  return {
    id,
    pinId: `${kind}:${card.primaryProfile || card.scope || 'any'}:${id}:${ownerId}`,
    cardId: id,
    ownerId,
    itemType: kind === 'service' ? 'person' : kind,
    rawItemType: kind,
    lat: coords.lat,
    lng: coords.lng,
    state: getState(card),
    category: pickString(card.category, card.cat, card.type),
    isSpotlight: card?.isSpotlight === true,
    isOwnCard,
    sourceCard: card,
    sourceFeature: card.__mapFeature || null,
  };
};

export function buildMapInventory(normalizedCards = [], currentUserId = '', filters = {}) {
  const byPinId = new Map();

  (Array.isArray(normalizedCards) ? normalizedCards : []).forEach((card) => {
    if (!card) return;
    const kind = getPinKind(card);
    if (!matchesFilters(card, kind, currentUserId, filters)) return;
    const pin = toPin(card, currentUserId);
    if (!pin) return;
    if (!byPinId.has(pin.pinId)) byPinId.set(pin.pinId, pin);
  });

  const allPins = [...byPinId.values()];
  const spotlightCards = allPins.filter((pin) => pin.isSpotlight);
  const myPins = allPins.filter((pin) => pin.isOwnCard);
  const clusterablePins = allPins.filter((pin) => !pin.isOwnCard);

  return {
    allPins,
    spotlightCards,
    myPins,
    clusterablePins,
  };
}

export default {
  buildMapInventory,
};
