import { normalizeCard } from '../lib/normalizeFeedCard';
import { orderDeck } from '../lib/orderFeedDeck';
import {
  extractScopedProfileLegacy,
  inferRecordProfileScope,
  normalizeProfileScope,
  pickIdentityName,
} from '../lib/profileScopeResolver';

const FEED_SESSION_SEED_KEY = 'ds_feed_session_seed';

const truthyFlag = (value, defaultValue = true) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'sim', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'nao', 'não', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeStringArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeImages = (value) => Array.from(new Set(
  (Array.isArray(value) ? value : []).map((item) => String(item || '').trim()).filter(Boolean)
)).slice(0, 10);

const pickFirstString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const isLikelyNonIdentityName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'd4$'
    || normalized === 'drive4$'
    || normalized === 'new user'
    || normalized === 'owner'
    || normalized === 'select';
};

const isDemoSeedMockRecord = (record) => String(record?.source || '').trim() === 'demo_seed_mock';

const getProfilePayloadScope = (profilePayload, scope) => {
  const payload = profilePayload && typeof profilePayload === 'object' ? profilePayload : {};
  const normalizedScope = normalizeProfileScope(scope);
  const resolved = payload.resolved && typeof payload.resolved === 'object' ? payload.resolved : {};
  const profiles = payload.profiles && typeof payload.profiles === 'object' ? payload.profiles : {};
  if (profiles[normalizedScope] && typeof profiles[normalizedScope] === 'object') return profiles[normalizedScope];
  if (resolved[normalizedScope] && typeof resolved[normalizedScope] === 'object') return resolved[normalizedScope];
  return {};
};

const getProfileStorageOwnerFromUrl = (value) => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/\/profile-images\/([^/?#]+)\//i);
  return match?.[1] || '';
};

const sanitizeOwnerProfilePhoto = (value, ownerId) => {
  const photo = String(value || '').trim();
  if (!photo) return '';
  const storageOwnerId = getProfileStorageOwnerFromUrl(photo);
  if (storageOwnerId && String(storageOwnerId) !== String(ownerId || '')) return '';
  return photo;
};

const getScopedProfilePhoto = ({ payloadScope, payloadProfile, scope }) => {
  const normalizedScope = normalizeProfileScope(scope);
  if (normalizedScope === 'professional') {
    return pickFirstString(payloadScope?.photo, payloadProfile?.photo, payloadProfile?.photoB, payloadProfile?.photoBUrl);
  }
  if (normalizedScope === 'fsbo') return pickFirstString(payloadScope?.photo, payloadProfile?.photoFsbo, payloadProfile?.fsboPhoto);
  return pickFirstString(payloadScope?.photo, payloadProfile?.photo, payloadProfile?.photoA);
};

const buildOwnerPreview = ({ ownerId, scope, userRow, professionalRow }) => {
  const id = String(ownerId || '').trim();
  const normalizedScope = normalizeProfileScope(scope);
  if (!id || !normalizedScope) return null;

  const profilePayload = professionalRow?.profile_payload && typeof professionalRow.profile_payload === 'object'
    ? professionalRow.profile_payload
    : null;
  const payloadScope = getProfilePayloadScope(profilePayload, normalizedScope);
  const extracted = profilePayload ? extractScopedProfileLegacy(profilePayload) : {};
  const payloadPersonal = normalizedScope === 'fsbo'
    ? (extracted.fsboProfileFromPayload || {})
    : (extracted.personalProfileFromPayload || {});
  const payloadProfessional = extracted.professionalProfileFromPayload || {};
  const payloadProfile = normalizedScope === 'professional' ? payloadProfessional : payloadPersonal;
  const isProfessional = normalizedScope === 'professional';
  const isFsbo = normalizedScope === 'fsbo';

  const name = isProfessional
    ? pickIdentityName(payloadScope?.name, payloadProfile?.fullName, payloadProfile?.fullNameB, professionalRow?.full_name)
    : isFsbo
      ? pickIdentityName(payloadScope?.name, payloadScope?.fullName, payloadProfile?.fullNameFsbo, payloadProfile?.fsboFullName)
      : pickIdentityName(payloadProfile?.fullName, payloadScope?.name);
  if (!name || isLikelyNonIdentityName(name)) return null;

  const photo = sanitizeOwnerProfilePhoto(getScopedProfilePhoto({
    payloadScope,
    payloadProfile,
    scope: normalizedScope,
  }), id);

  return {
    id,
    ownerId: id,
    name,
    type: isFsbo
      ? 'FSBO'
      : pickFirstString(
        payloadScope?.categoryLabelFallback,
        professionalRow?.primary_category_b,
        professionalRow?.primary_category,
        professionalRow?.subcategory,
        professionalRow?.category,
        payloadProfile?.categoryLabelFallback,
        payloadProfile?.categoryB,
        payloadProfile?.category,
        payloadProfile?.primaryCategoryB,
        payloadProfile?.primaryCategory,
        userRow?.account_type
      ),
    badge: pickFirstString(payloadScope?.badge, normalizedScope === 'professional' ? 'Business' : '', normalizedScope === 'fsbo' ? 'FSBO' : ''),
    loc: isFsbo
      ? pickFirstString(payloadScope?.loc, payloadProfile?.loc)
      : pickFirstString(payloadScope?.loc, payloadProfile?.loc, payloadProfile?.locB),
    photo,
    cat: isFsbo
      ? 'seller'
      : pickFirstString(professionalRow?.primary_category_b, professionalRow?.primary_category, professionalRow?.category),
    desc: isFsbo ? '' : pickFirstString(payloadScope?.pitch, payloadProfile?.pitchB, payloadProfile?.pitch, professionalRow?.pitch),
    email: '',
    primaryPhone: '',
    contactMethods: Array.isArray(payloadScope?.contactMethods) ? payloadScope.contactMethods : [],
    primaryProfile: normalizedScope,
    verified: payloadScope?.verified === true || payloadProfile?.verified === true,
  };
};

const inferDbPropertyProfileScope = (row) => inferRecordProfileScope(row, '');

const mapDbPropertyToLocal = (row, images = [], options = {}) => ({
  id: row.id,
  portfolioId: row.id,
  ownerId: options.ownerId || row.owner_id || '',
  type: row.type || 'SFR',
  address: row.address || '',
  city: row.city || '',
  state: row.state || '',
  zip: row.zip || '',
  price: row.price ?? 0,
  beds: row.beds ?? 0,
  baths: row.baths ?? 0,
  sqft: row.sqft || '',
  improvement: row.improvement || '',
  lot: row.lot || '',
  dealTag: row.deal_tag || '',
  objective: row.objective || '',
  rehab: row.rehab ?? 0,
  capRate: row.cap_rate ?? null,
  description: row.description || '',
  markets: normalizeStringArray(row.markets),
  isActive: truthyFlag(row.is_active, true),
  dealClosed: truthyFlag(row.deal_closed, false),
  pendingDeal: truthyFlag(row.pending_deal, false),
  pendingDealStartedAt: row.pending_deal_started_at || null,
  pendingDealExpiresAt: row.pending_deal_expires_at || null,
  dealUnavailable: truthyFlag(row.is_active, true) === false,
  publishToShowcase: truthyFlag(row.publish_to_showcase, true),
  includeInPreview: truthyFlag(row.include_in_preview, true),
  source: 'supabase',
  ownerAccountType: row.owner_account_type || '',
  primaryProfile: options.primaryProfile || inferRecordProfileScope(row, ''),
  ownerPreview: options.ownerPreview || null,
  images: normalizeImages(images),
  video: row.video || '',
  lat: toNumberOrNull(row.lat),
  lng: toNumberOrNull(row.lng),
  geocodeStatus: row.geocode_status || '',
  geocodeSource: row.geocode_source || '',
  geocodeConfidence: toNumberOrNull(row.geocode_confidence),
  geocodeInput: row.geocode_input || '',
  geocodedAt: row.geocoded_at || null,
  hideStreetAddressOnCard: truthyFlag(row.hide_street_address_on_card, false),
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const mapDbServiceToLocal = (row, options = {}) => ({
  id: row.id,
  ownerId: options.ownerId || row.owner_id || '',
  title: row.title || '',
  category: row.category || '',
  description: row.description || '',
  price: row.price ?? null,
  media: { images: normalizeImages(row.media_images), archivedImages: [] },
  dealUnavailable: false,
  publishToConnections: truthyFlag(row.publish_to_connections, true),
  includeInPreview: true,
  dealClosed: false,
  markets: normalizeStringArray(row.markets),
  primaryProfile: options.primaryProfile || inferRecordProfileScope(row, ''),
  ownerPreview: options.ownerPreview || null,
  source: 'supabase',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const hasResolvedOwnerPreview = (item) => {
  const ownerId = String(item?.ownerId || item?.owner_id || '').trim();
  const scope = inferRecordProfileScope(item, '');
  const ownerPreview = item?.ownerPreview || item?.owner_preview || null;
  const ownerName = String(ownerPreview?.name || '').trim();
  return Boolean(ownerId && scope && ownerName && !isLikelyNonIdentityName(ownerName));
};

const isValidGlobalShowcaseProperty = (property) => (
  Boolean(property)
  && truthyFlag(property?.isActive, true)
  && truthyFlag(property?.publishToShowcase, true)
  && property?.dealClosed !== true
  && !isDemoSeedMockRecord(property)
);

const isValidGlobalConnectionService = (service) => (
  Boolean(service)
  && truthyFlag(service?.publishToConnections, true)
  && !isDemoSeedMockRecord(service)
  && hasResolvedOwnerPreview(service)
);

const mapSpotlights = (spotlightRows = []) => spotlightRows.map((row) => ({
  id: row.id,
  userId: row.user_id,
  ownerId: row.owner_id,
  cardKind: row.card_kind,
  cardId: row.card_id,
  scope: row.scope || '',
  expiresAt: row.expires_at,
  nuggetsSpent: row.nuggets_spent,
}));

export async function fetchGlobalInventory(supabaseClient) {
  if (!supabaseClient) throw new Error('Supabase client is required.');
  const result = await supabaseClient.rpc('ds_get_global_feed_inventory');
  if (result?.error) {
    const error = new Error('Global feed inventory is unavailable.');
    error.code = result.error.code || result.error.status || 'GLOBAL_FEED_RPC_FAILED';
    error.cause = result.error;
    throw error;
  }
  return result?.data && typeof result.data === 'object' ? result.data : {};
}

export function buildFeedDeck(rawCards, currentUserId = '', filters = {}, sessionSeed = getSessionSeed()) {
  const rawList = Array.isArray(rawCards)
    ? rawCards
    : [
      ...(Array.isArray(rawCards?.properties) ? rawCards.properties.map((row) => ({ ...row, cardKind: 'property' })) : []),
      ...(Array.isArray(rawCards?.services) ? rawCards.services.map((row) => ({ ...row, cardKind: 'service' })) : []),
    ];

  const normalized = rawList
    .map((card) => normalizeCard(card, currentUserId))
    .filter(Boolean);

  return orderDeck(normalized, {
    currentUserId,
    activeFilters: filters,
    sessionSeed,
    sortPreference: filters?.sortPreference || filters?.sortOrder || 'default',
  });
}

export function buildGlobalFeedState(rawInventory, currentUserId = '', filters = {}, sessionSeed = getSessionSeed()) {
  const inventory = rawInventory && typeof rawInventory === 'object' ? rawInventory : {};
  const propertyRows = Array.isArray(inventory.properties) ? inventory.properties : [];
  const serviceRows = Array.isArray(inventory.services) ? inventory.services : [];
  const spotlightRows = Array.isArray(inventory.spotlights) ? inventory.spotlights : [];
  const userRows = Array.isArray(inventory.users) ? inventory.users : [];
  const professionalRows = Array.isArray(inventory.professionalProfiles) ? inventory.professionalProfiles : [];
  const imageRows = Array.isArray(inventory.propertyImages) ? inventory.propertyImages : [];

  const usersById = new Map(userRows.map((row) => [String(row.id), row]));
  const professionalByOwnerId = new Map(professionalRows.map((row) => [String(row.user_id), row]));
  const imagesByProperty = imageRows.reduce((acc, row) => {
    const key = String(row.property_id || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(String(row.image_url || '').trim());
    return acc;
  }, {});

  const getOwnerPreviewForRow = (row) => {
    const ownerId = String(row?.owner_id || row?.ownerId || '').trim();
    if (!ownerId) return null;
    return buildOwnerPreview({
      ownerId,
      scope: inferRecordProfileScope(row, ''),
      userRow: usersById.get(ownerId),
      professionalRow: professionalByOwnerId.get(ownerId),
    });
  };

  const showcaseProperties = propertyRows
    .map((row) => mapDbPropertyToLocal(row, imagesByProperty[row.id] || [], {
      ownerId: row.owner_id || row.ownerId || '',
      ownerPreview: getOwnerPreviewForRow(row),
      primaryProfile: inferDbPropertyProfileScope(row),
    }))
    .map((property) => normalizeCard({ ...property, cardKind: 'property' }, currentUserId) || {
      ...property,
      cardKind: 'property',
      unlockOwnerId: property.ownerId,
      primaryProfile: inferRecordProfileScope(property, ''),
      publishToShowcase: true,
      isActive: true,
    })
    .filter(isValidGlobalShowcaseProperty);

  const connectionServices = serviceRows
    .map((row) => {
      const primaryProfile = inferRecordProfileScope(row, '');
      return mapDbServiceToLocal(row, {
        ownerId: row.owner_id || row.ownerId || '',
        ownerPreview: getOwnerPreviewForRow(row),
        primaryProfile,
      });
    })
    .map((service) => normalizeCard({ ...service, cardKind: 'service' }, currentUserId))
    .filter(isValidGlobalConnectionService);

  return {
    showcaseProperties,
    connectionServices,
    activeSpotlights: mapSpotlights(spotlightRows),
    deck: buildFeedDeck([...showcaseProperties, ...connectionServices], currentUserId, filters, sessionSeed),
  };
}

export function getSessionSeed() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return 1;
    const existing = window.sessionStorage.getItem(FEED_SESSION_SEED_KEY);
    if (existing) return Number(existing) || existing;
    const seed = String(globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    window.sessionStorage.setItem(FEED_SESSION_SEED_KEY, seed);
    return seed;
  } catch {
    return 1;
  }
}

export default {
  fetchGlobalInventory,
  buildFeedDeck,
  buildGlobalFeedState,
  getSessionSeed,
};
