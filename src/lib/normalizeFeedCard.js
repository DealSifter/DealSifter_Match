import {
  extractScopedProfileLegacy,
  inferRecordProfileScope,
  isLikelyNonIdentityName,
  normalizeProfileScope,
} from './profileScopeResolver';

const pickString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const pickIdentityName = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized && !isLikelyNonIdentityName(normalized)) return normalized;
  }
  return '';
};

const asArray = (value) => (
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
);

const truthyFlag = (value, fallback = true) => {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return fallback;
  if (['false', '0', 'off', 'no'].includes(raw)) return false;
  if (['true', '1', 'on', 'yes'].includes(raw)) return true;
  return Boolean(value);
};

const toNumberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeImages = (...values) => Array.from(new Set(
  values.flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value && Array.isArray(value.images)) return value.images;
    return [];
  }).map((item) => String(item || '').trim()).filter(Boolean)
)).slice(0, 10);

const getPayloadScope = (profilePayload, scope) => {
  const payload = profilePayload && typeof profilePayload === 'object' ? profilePayload : {};
  const normalizedScope = normalizeProfileScope(scope);
  const resolved = payload.resolved && typeof payload.resolved === 'object' ? payload.resolved : {};
  const profiles = payload.profiles && typeof payload.profiles === 'object' ? payload.profiles : {};
  if (profiles[normalizedScope] && typeof profiles[normalizedScope] === 'object') return profiles[normalizedScope];
  if (resolved[normalizedScope] && typeof resolved[normalizedScope] === 'object') return resolved[normalizedScope];
  return {};
};

const resolveOwnerIdentity = (rawCard, scope) => {
  const ownerPreview = rawCard?.ownerPreview || rawCard?.owner_preview || null;
  const userRow = rawCard?.userRow || rawCard?.user || rawCard?.ownerUser || {};
  const personalRow = rawCard?.personalRow || rawCard?.personalProfile || rawCard?.personal_profile || {};
  const professionalRow = rawCard?.professionalRow || rawCard?.professionalProfile || rawCard?.professional_profile || {};
  const profilePayload = rawCard?.profilePayload || rawCard?.profile_payload || professionalRow?.profile_payload || {};
  const payloadScope = getPayloadScope(profilePayload, scope);
  const extracted = profilePayload ? extractScopedProfileLegacy(profilePayload) : {};
  const payloadPersonal = scope === 'fsbo'
    ? (extracted.fsboProfileFromPayload || {})
    : (extracted.personalProfileFromPayload || {});
  const payloadProfessional = extracted.professionalProfileFromPayload || {};
  const payloadProfile = scope === 'professional' ? payloadProfessional : payloadPersonal;

  if (ownerPreview && typeof ownerPreview === 'object' && normalizeProfileScope(ownerPreview.primaryProfile || ownerPreview.scope) === scope) {
    return {
      name: pickIdentityName(ownerPreview.name),
      photo: pickString(ownerPreview.photo, ownerPreview.avatar),
      type: pickString(ownerPreview.type, ownerPreview.categoryLabelFallback, ownerPreview.cat),
      badge: pickString(ownerPreview.badge),
      loc: pickString(ownerPreview.loc, ownerPreview.location),
      cat: pickString(ownerPreview.cat, ownerPreview.categoryId),
      desc: scope === 'fsbo' ? '' : pickString(ownerPreview.desc, ownerPreview.pitch),
      email: pickString(ownerPreview.email),
      primaryPhone: pickString(ownerPreview.primaryPhone, ownerPreview.phone),
      contactMethods: asArray(ownerPreview.contactMethods),
      verified: ownerPreview.verified === true,
    };
  }

  const isProfessional = scope === 'professional';
  const isFsbo = scope === 'fsbo';
  const name = isProfessional
    ? pickIdentityName(payloadScope.name, payloadProfile.fullName, payloadProfile.fullNameB)
    : isFsbo
      ? pickIdentityName(payloadScope.name, payloadScope.fullName, payloadProfile.fullName, personalRow.full_name)
      : pickIdentityName(payloadProfile.fullName, payloadScope.name);

  return {
    name,
    photo: pickString(
      payloadScope.photo,
      payloadProfile.photo,
      isFsbo ? personalRow.photo_url : '',
      isProfessional ? pickString(payloadProfile.photoB, payloadProfile.photoBUrl, professionalRow.photo_b_url) : ''
    ),
    type: isFsbo
      ? 'FSBO'
      : pickString(
        payloadScope.categoryLabelFallback,
        professionalRow.primary_category_b,
        professionalRow.primary_category,
        professionalRow.subcategory,
        professionalRow.category,
        payloadProfile.categoryLabelFallback,
        payloadProfile.categoryB,
        payloadProfile.category,
        payloadProfile.primaryCategoryB,
        payloadProfile.primaryCategory,
        userRow.account_type
      ),
    badge: pickString(payloadScope.badge, isProfessional ? 'Business' : '', isFsbo ? 'FSBO' : ''),
    loc: isFsbo
      ? pickString(payloadScope.loc, payloadProfile.loc)
      : pickString(payloadScope.loc, payloadProfile.loc, payloadProfile.locB),
    cat: pickString(professionalRow.primary_category_b, professionalRow.primary_category, professionalRow.category),
    desc: isFsbo ? '' : pickString(payloadScope.pitch, payloadProfile.pitchB, payloadProfile.pitch, professionalRow.pitch),
    email: isFsbo
      ? pickString(payloadScope.email, payloadProfile.email, userRow.email)
      : pickString(payloadScope.email, payloadProfile.email, payloadProfile.emailB, userRow.email),
    primaryPhone: isFsbo
      ? pickString(payloadScope.primaryPhone, payloadProfile.primaryPhone, userRow.phone)
      : pickString(payloadScope.primaryPhone, payloadProfile.primaryPhone, payloadProfile.primaryPhoneB, userRow.phone),
    contactMethods: asArray(payloadScope.contactMethods),
    verified: payloadScope.verified === true || payloadProfile.verified === true,
  };
};

const getCardKind = (rawCard) => {
  const kind = String(rawCard?.cardKind || rawCard?.card_kind || rawCard?.itemType || rawCard?._itemType || rawCard?.kind || '').trim().toLowerCase();
  if (kind === 'person' || kind === 'profile' || kind === 'contact') return 'person';
  if (kind === 'service') return 'service';
  if (kind === 'property') return 'property';
  if ('title' in (rawCard || {}) && !('address' in (rawCard || {}))) return 'service';
  if ('address' in (rawCard || {}) || 'type' in (rawCard || {})) return 'property';
  return 'person';
};

export function normalizeCard(rawCard, currentUserId = '') {
  if (!rawCard || typeof rawCard !== 'object') return null;

  const kind = getCardKind(rawCard);
  const ownerId = pickString(rawCard.ownerId, rawCard.owner_id, rawCard.unlockOwnerId, rawCard.sellerId, rawCard.id);
  const scope = normalizeProfileScope(inferRecordProfileScope(rawCard, rawCard.primaryProfile || rawCard.primary_profile || rawCard.scope || ''));
  if (!ownerId || !scope) return null;

  const primaryProfile = normalizeProfileScope(rawCard.primaryProfile || rawCard.primary_profile || rawCard.scope || scope);
  if (primaryProfile !== scope) return null;

  const linkedProperties = Array.isArray(rawCard.linkedProperties) ? rawCard.linkedProperties : [];
  const linkedServices = Array.isArray(rawCard.linkedServices) ? rawCard.linkedServices : [];
  const portfolioCount = Math.max(
    Number(rawCard.portfolioCount || 0),
    linkedProperties.filter((item) => truthyFlag(item?.publishToShowcase, truthyFlag(item?.publish_to_showcase, true))).length
      + linkedServices.filter((item) => truthyFlag(item?.publishToConnections, truthyFlag(item?.publish_to_connections, true))).length
  );

  if (kind === 'person' && portfolioCount <= 0) return null;
  if (kind === 'property' && (!truthyFlag(rawCard.isActive ?? rawCard.is_active, true) || !truthyFlag(rawCard.publishToShowcase ?? rawCard.publish_to_showcase, true))) return null;
  if (kind === 'service' && !truthyFlag(rawCard.publishToConnections ?? rawCard.publish_to_connections, true)) return null;

  const identity = resolveOwnerIdentity(rawCard, scope);
  const name = pickIdentityName(identity.name, rawCard.name);
  if (!name || isLikelyNonIdentityName(name)) return null;

  const isOwnCard = String(ownerId) === String(currentUserId || '');
  const spotlightActive = rawCard.isSpotlight === true
    || rawCard.spotlight === true
    || rawCard.activeSpotlight === true
    || Boolean(rawCard.spotlightId);
  const hotScore = Number(rawCard.hotScore || rawCard.hot_score || rawCard.hotPressure || 0);
  const favoriteCount = Number(rawCard.favoriteCount || rawCard.favorite_count || 0);
  const unlockCount = Number(rawCard.unlockCount || rawCard.unlock_count || 0);

  const common = {
    ...rawCard,
    id: kind === 'person' ? `${ownerId}:${scope}` : rawCard.id,
    ownerId,
    unlockOwnerId: ownerId,
    primaryProfile: scope,
    scopeKey: scope === 'professional' ? 'secondary' : scope,
    name,
    photo: pickString(identity.photo, rawCard.photo, rawCard.avatar),
    type: pickString(identity.type, rawCard.type, rawCard.category),
    badge: pickString(identity.badge, rawCard.badge),
    loc: pickString(identity.loc, rawCard.loc, rawCard.location, rawCard.state),
    cat: pickString(identity.cat, rawCard.cat, rawCard.category),
    desc: scope === 'fsbo' ? '' : pickString(identity.desc, rawCard.desc, rawCard.description),
    email: pickString(identity.email, rawCard.email),
    primaryPhone: pickString(identity.primaryPhone, rawCard.primaryPhone, rawCard.phone),
    contactMethods: asArray(identity.contactMethods).length ? asArray(identity.contactMethods) : asArray(rawCard.contactMethods),
    portfolioCount: kind === 'person' ? portfolioCount : Number(rawCard.portfolioCount || 0),
    isOwnCard,
    isNew: rawCard.isNew === true,
    isHot: rawCard.isHot === true || hotScore > 0 || unlockCount > 0,
    isTrending: rawCard.isTrending === true || favoriteCount >= 10,
    isExclusive: rawCard.isExclusive === true || rawCard.exclusive === true,
    isSpotlight: spotlightActive,
    isVerified: rawCard.isVerified === true || rawCard.verified === true || identity.verified === true,
    verified: rawCard.verified === true || identity.verified === true,
  };

  if (kind === 'service') {
    return {
      ...common,
      id: rawCard.id,
      title: pickString(rawCard.title, rawCard.name, identity.type, 'Service'),
      category: pickString(rawCard.category, common.cat),
      media: rawCard.media || { images: normalizeImages(rawCard.media_images, rawCard.media?.images), archivedImages: [] },
      publishToConnections: true,
      source: rawCard.source || 'supabase',
    };
  }

  if (kind === 'property') {
    return {
      ...common,
      id: rawCard.id,
      portfolioId: rawCard.portfolioId || rawCard.id,
      type: pickString(rawCard.type, rawCard.propertyType, 'Property'),
      address: pickString(rawCard.address),
      city: pickString(rawCard.city),
      state: pickString(rawCard.state),
      zip: pickString(rawCard.zip),
      price: rawCard.price ?? 0,
      description: pickString(rawCard.description, rawCard.desc),
      desc: pickString(rawCard.description, rawCard.desc),
      images: normalizeImages(rawCard.images, rawCard.media_images),
      lat: toNumberOrNull(rawCard.lat),
      lng: toNumberOrNull(rawCard.lng),
      publishToShowcase: true,
      includeInPreview: truthyFlag(rawCard.includeInPreview ?? rawCard.include_in_preview, true),
      isActive: true,
      source: rawCard.source || 'supabase',
      ownerPreview: rawCard.ownerPreview || {
        id: ownerId,
        ownerId,
        name,
        photo: common.photo,
        type: common.type,
        badge: common.badge,
        loc: common.loc,
        cat: common.cat,
        desc: common.desc,
        email: common.email,
        primaryPhone: common.primaryPhone,
        primaryProfile: scope,
        verified: common.verified,
      },
    };
  }

  return common;
}
