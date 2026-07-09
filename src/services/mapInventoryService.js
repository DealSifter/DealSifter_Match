import { normalizeCard } from '../lib/normalizeFeedCard';
import { orderDeck } from '../lib/orderFeedDeck';
import { normalizeProfileScope } from '../lib/profileScopeResolver';

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

const normalizeText = (value) => String(value || '').trim();

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

const hasActiveSpotlightKey = (activeSpotlightKeys, key) => {
  if (!key) return false;
  if (activeSpotlightKeys instanceof Set) return activeSpotlightKeys.has(key);
  if (Array.isArray(activeSpotlightKeys)) return activeSpotlightKeys.includes(key);
  return false;
};

const getFeaturePayload = (feature, currentUserId, getRecordProfileScope, servicePortfolio, activeSpotlightKeys) => {
  const id = String(feature?.payload?.id ?? feature?.properties?.featureKey ?? '');
  const itemType = feature?.properties?.itemType || feature?.payload?.cardKind;
  const payload = {
    ...(feature?.payload || {}),
    id: id || feature?.payload?.id,
    cardKind: itemType,
    isOwnCard: feature?.payload?.isOwnCard === true
      || feature?.properties?.isOwn === true
      || String(feature?.payload?.ownerId || '') === String(currentUserId || ''),
  };
  if (payload.isSpotlight !== true) {
    if (itemType === 'property') {
      payload.isSpotlight = Boolean(payload?.id) && hasActiveSpotlightKey(activeSpotlightKeys, `property:${payload.id}`);
    } else {
      const ownerId = String(payload.ownerId || payload.id || '').trim();
      const scope = getRecordProfileScope(payload);
      payload.isSpotlight = Boolean(ownerId && scope) && (
        hasActiveSpotlightKey(activeSpotlightKeys, `profile:${scope}:${ownerId}`)
        || (servicePortfolio || []).some((service) => (
          String(service?.ownerId || '') === ownerId
          && getRecordProfileScope(service) === scope
          && hasActiveSpotlightKey(activeSpotlightKeys, `service:${service.id}`)
        ))
      );
    }
  }
  return payload;
};

const makeFeature = ({ key, itemType, itemId, title, subtitle, lat, lng, payload, isUnlocked = false, isOwn = false }) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!key || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !payload) return null;
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [longitude, latitude] },
    properties: {
      featureKey: key,
      itemType,
      itemId,
      title,
      subtitle,
      locked: !isUnlocked,
      isUnlocked,
      isOwn,
    },
    payload,
  };
};

const buildMapFeaturesFromSources = (sources = {}, currentUserId = '') => {
  const mapById = new Map();
  const seenPersonVisualKeys = new Set();
  const {
    mockCards = [],
    mockProperties = [],
    enableMockMapData = false,
    showcaseProperties = [],
    servicePortfolio = [],
    accountType = 'professional',
    userProfile = null,
    personalProfile = null,
    professionalProfile = null,
    publishedLocalProfileScopes = new Set(),
    activeSpotlightKeys = new Set(),
    getRecordProfileScope = () => '',
    isLocalPublishedRecord = () => true,
    getPortfolioPartsForOwner = () => ({ properties: [], services: [] }),
    getStateCodeFromMarket = () => '',
    resolvePropertyDisplayCoords = () => null,
    resolveScopedProfile = () => null,
    isUnlockedId = () => false,
  } = sources || {};

  const addFeature = (feature) => {
    if (!feature?.properties?.featureKey || !feature?.payload) return;
    mapById.set(feature.properties.featureKey, feature);
  };

  const addPersonFeature = (feature) => {
    const payload = feature?.payload || {};
    const ownerId = String(payload.ownerId || payload.unlockOwnerId || payload.id || feature?.properties?.itemId || '').trim();
    const name = normalizeText(payload.name || feature?.properties?.title || '');
    const loc = normalizeText(payload.loc || '');
    const type = normalizeText(payload.type || payload.cat || '');
    const visualKey = [ownerId, name, loc, type].filter(Boolean).join('|');
    if (visualKey && seenPersonVisualKeys.has(visualKey)) return;
    if (visualKey) seenPersonVisualKeys.add(visualKey);
    addFeature(feature);
  };

  if (enableMockMapData) {
    (mockCards || [])
      .filter((card) => card?.verified && Number.isFinite(card.lat) && Number.isFinite(card.lng))
      .forEach((card) => {
        addPersonFeature(makeFeature({
          key: `person-${card.id}`,
          itemType: 'person',
          itemId: card.id,
          title: card.name,
          subtitle: `${card.type} - ${card.loc}`,
          lat: card.lat,
          lng: card.lng,
          payload: card,
          isUnlocked: isUnlockedId(card.id),
        }));
      });

    (mockProperties || [])
      .filter((property) => Number.isFinite(property.lat) && Number.isFinite(property.lng))
      .forEach((property) => {
        addFeature(makeFeature({
          key: `property-${property.id}`,
          itemType: 'property',
          itemId: property.id,
          title: property.address,
          subtitle: `${property.type} - ${property.city}`,
          lat: property.lat,
          lng: property.lng,
          payload: property,
          isUnlocked: isUnlockedId(property.ownerId),
        }));
      });
  }

  const addOwnerPerson = ({ ownerId, normalizedScope, ownerPreview, coords, stateCode, service = null }) => {
    const key = `person-${ownerId}-${normalizedScope}`;
    if (mapById.has(key)) return;
    const linkedPortfolio = getPortfolioPartsForOwner(ownerId, normalizedScope);
    const payload = normalizeCard({
      cardKind: 'person',
      ...ownerPreview,
      id: ownerId,
      ownerId,
      primaryProfile: normalizedScope,
      lat: coords.lat,
      lng: coords.lng,
      geocodePending: false,
      loc: stateCode || ownerPreview?.loc || '',
      portfolioCount: linkedPortfolio.properties.length + linkedPortfolio.services.length,
      ownerPreview: { ...(ownerPreview || {}), primaryProfile: normalizedScope },
      linkedProperties: linkedPortfolio.properties,
      linkedServices: linkedPortfolio.services,
    }, currentUserId);
    if (!payload) return;
    addPersonFeature(makeFeature({
      key,
      itemType: 'person',
      itemId: ownerId,
      title: ownerPreview.name,
      subtitle: `${ownerPreview.type || ownerPreview.cat || service?.category || 'Contact'} - ${stateCode || ownerPreview.loc || ''}`,
      lat: coords.lat,
      lng: coords.lng,
      payload,
      isUnlocked: isUnlockedId(ownerId),
    }));
  };

  const ownersFromProperties = new Map();
  (showcaseProperties || []).forEach((property) => {
    if (!truthyFlag(property?.publishToShowcase, true)) return;
    if (!isLocalPublishedRecord(property)) return;
    const ownerId = String(property?.ownerId || '').trim();
    const normalizedScope = getRecordProfileScope(property);
    const ownerPreview = property?.ownerPreview && typeof property.ownerPreview === 'object' ? property.ownerPreview : null;
    if (!ownerId || !normalizedScope || !ownerPreview?.name) return;
    const ownerKey = `${ownerId}:${normalizedScope}`;
    if (ownersFromProperties.has(ownerKey)) return;
    const stateCode = getStateCodeFromMarket(ownerPreview?.loc);
    const coords = stateCode ? sources.stateCenters?.[stateCode] : null;
    if (!coords) return;
    ownersFromProperties.set(ownerKey, { ownerId, normalizedScope, ownerPreview, coords, stateCode });
  });
  ownersFromProperties.forEach(addOwnerPerson);

  const ownersFromServices = new Map();
  (servicePortfolio || []).forEach((service) => {
    if (!isLocalPublishedRecord(service)) return;
    if (!truthyFlag(service?.publishToConnections, true)) return;
    const ownerId = String(service?.ownerId || '').trim();
    const normalizedScope = getRecordProfileScope(service);
    const ownerPreview = service?.ownerPreview && typeof service.ownerPreview === 'object' ? service.ownerPreview : null;
    if (!ownerId || !normalizedScope || !ownerPreview?.name) return;
    const ownerKey = `${ownerId}:${normalizedScope}`;
    if (mapById.has(`person-${ownerId}-${normalizedScope}`) || ownersFromServices.has(ownerKey)) return;
    const stateCode = [ownerPreview?.loc, service?.state, ...(Array.isArray(service?.markets) ? service.markets : [])]
      .map(getStateCodeFromMarket)
      .find(Boolean);
    const coords = sources.stateCenters?.[stateCode];
    if (!coords) return;
    ownersFromServices.set(ownerKey, { ownerId, normalizedScope, ownerPreview, coords, stateCode, service });
  });
  ownersFromServices.forEach(addOwnerPerson);

  const ownerId = String(currentUserId || '').trim();
  if (ownerId) {
    ['personal', 'professional', 'fsbo'].forEach((scope) => {
      const normalizedScope = normalizeProfileScope(scope);
      if (!publishedLocalProfileScopes.has(normalizedScope)) return;
      const linkedPropertyCount = (showcaseProperties || []).filter((property) => (
        String(property?.ownerId || '') === ownerId
        && getRecordProfileScope(property) === normalizedScope
        && truthyFlag(property?.publishToShowcase, true)
      )).length;
      const linkedServiceCount = (servicePortfolio || []).filter((service) => (
        String(service?.ownerId || '') === ownerId
        && getRecordProfileScope(service) === normalizedScope
        && truthyFlag(service?.publishToConnections, true)
      )).length;
      if (linkedPropertyCount + linkedServiceCount <= 0) return;
      const ownerPreview = resolveScopedProfile(normalizedScope, {
        accountType,
        userProfile,
        personalProfile,
        professionalProfile,
      });
      const name = String(ownerPreview?.name || '').trim();
      const stateCode = getStateCodeFromMarket(ownerPreview?.loc);
      const coords = sources.stateCenters?.[stateCode];
      if (!name || !coords) return;
      addOwnerPerson({ ownerId, normalizedScope, ownerPreview, coords, stateCode });
    });
  }

  (showcaseProperties || []).forEach((property) => {
    if (!truthyFlag(property?.publishToShowcase, true)) return;
    if (!isLocalPublishedRecord(property)) return;
    const owner = String(property?.ownerId || property?.owner_id || '').trim();
    const coords = resolvePropertyDisplayCoords(property);
    if (!coords) return;
    let payload = normalizeCard({
      ...property,
      cardKind: 'property',
      lat: coords.lat,
      lng: coords.lng,
      geocodePending: Boolean(coords.isApproximate),
    }, currentUserId);
    if (!payload) {
      payload = {
        ...property,
        id: property.id ?? property.portfolioId,
        portfolioId: property.portfolioId || property.id,
        cardKind: 'property',
        ownerId: owner,
        unlockOwnerId: owner,
        primaryProfile: getRecordProfileScope(property),
        type: property.type || 'Property',
        address: property.address || 'Property',
        city: property.city || '',
        state: property.state || '',
        zip: property.zip || '',
        images: Array.isArray(property.images) ? property.images : [],
        lat: coords.lat,
        lng: coords.lng,
        geocodePending: Boolean(coords.isApproximate),
        publishToShowcase: true,
        isActive: true,
        isOwnCard: String(owner) === String(currentUserId || ''),
      };
    }
    if (!payload) return;
    const isOwnProperty = String(owner) === String(currentUserId || '') || String(owner) === '999999';
    addFeature(makeFeature({
      key: `user-property-${property.id}`,
      itemType: 'property',
      itemId: property.id,
      title: property.address || 'Property',
      subtitle: `${property.type || 'Property'} - ${property.city || ''}`,
      lat: coords.lat,
      lng: coords.lng,
      payload,
      isUnlocked: isOwnProperty || isUnlockedId(property.ownerId),
      isOwn: isOwnProperty,
    }));
  });

  const features = Array.from(mapById.values());
  const byPayloadId = new Map();
  const payloads = features.map((feature, index) => {
    const payload = getFeaturePayload(feature, currentUserId, getRecordProfileScope, servicePortfolio, activeSpotlightKeys);
    const id = String(payload?.id ?? feature?.properties?.featureKey ?? index);
    byPayloadId.set(id, { ...feature, payload });
    return payload;
  });
  return orderDeck(payloads, {
    currentUserId,
    activeFilters: { type: 'all' },
    sessionSeed: `${String(currentUserId || 'anon')}:map:all`,
    sortPreference: 'default',
  }).map((payload) => byPayloadId.get(String(payload.id))).filter(Boolean);
};

const normalizeSourceInputToCards = (sourceInput, currentUserId) => {
  if (Array.isArray(sourceInput)) return sourceInput;
  if (!sourceInput || typeof sourceInput !== 'object') return [];
  return buildMapFeaturesFromSources(sourceInput, currentUserId).map((feature) => ({
    ...(feature.payload || {}),
    lat: feature.payload?.lat ?? feature.geometry?.coordinates?.[1],
    lng: feature.payload?.lng ?? feature.geometry?.coordinates?.[0],
    __mapFeature: feature,
  }));
};

export function buildMapInventory(normalizedCards = [], currentUserId = '', filters = {}) {
  const byPinId = new Map();

  normalizeSourceInputToCards(normalizedCards, currentUserId).forEach((card) => {
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
