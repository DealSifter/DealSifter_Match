const asArray = (value) => (
  Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
);

const pickString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const pickArray = (...values) => {
  for (const value of values) {
    const normalized = asArray(value);
    if (normalized.length) return normalized;
  }
  return [];
};

const toPersonalProfileShape = (resolved = {}, fallback = {}) => ({
  ...fallback,
  fullName: pickString(resolved?.name, fallback.fullName),
  photo: pickString(resolved?.photo, fallback.photo),
  bio: pickString(fallback.bio),
  visibility: pickString(fallback.visibility, 'hidden'),
  loc: pickString(resolved?.loc, fallback.loc),
  contactMethods: pickArray(resolved?.contactMethods, fallback.contactMethods),
  primaryPhone: pickString(resolved?.primaryPhone, fallback.primaryPhone, fallback.phone),
  secondaryPhone: pickString(resolved?.secondaryPhone, fallback.secondaryPhone),
  tertiaryPhone: pickString(resolved?.tertiaryPhone, fallback.tertiaryPhone),
  email: pickString(resolved?.email, fallback.email),
  cardPriorityA: resolved?.scope === 'personal'
    ? pickString(resolved?.cardPriority, fallback.cardPriorityA)
    : pickString(fallback.cardPriorityA),
  cardPriorityC: resolved?.scope === 'fsbo'
    ? pickString(resolved?.cardPriority, fallback.cardPriorityC)
    : pickString(fallback.cardPriorityC),
});

const toProfessionalProfileShape = (resolved = {}, fallback = {}) => ({
  ...fallback,
  fullName: pickString(resolved?.name, fallback.fullName),
  locB: pickString(resolved?.loc, fallback.locB),
  photoB: pickString(resolved?.photo, fallback.photoB, fallback.photoBUrl),
  photoBUrl: pickString(resolved?.photo, fallback.photoBUrl, fallback.photoB),
  contactMethodsB: pickArray(resolved?.contactMethods, fallback.contactMethodsB),
  primaryPhoneB: pickString(resolved?.primaryPhone, fallback.primaryPhoneB, fallback.phoneB),
  secondaryPhoneB: pickString(resolved?.secondaryPhone, fallback.secondaryPhoneB),
  tertiaryPhoneB: pickString(resolved?.tertiaryPhone, fallback.tertiaryPhoneB),
  emailB: pickString(resolved?.email, fallback.emailB),
  cardPriorityB: pickString(resolved?.cardPriority, fallback.cardPriorityB),
  pitchB: pickString(resolved?.pitch, fallback.pitchB, fallback.pitch),
});

export const normalizeProfileScope = (scope, fallback = '') => {
  const normalized = String(scope || '').trim().toLowerCase();
  if (
    normalized === 'professional'
    || normalized === 'secondary'
    || normalized === 'business'
    || normalized === 'operation'
    || normalized === 'operations'
    || normalized === 'b'
  ) return 'professional';
  if (normalized === 'fsbo' || normalized === 'c') return 'fsbo';
  if (normalized === 'personal' || normalized === 'primary' || normalized === 'a') return 'personal';
  return fallback ? normalizeProfileScope(fallback, '') : '';
};

export const profileScopeToOwnerKey = (scope) => {
  const normalizedScope = normalizeProfileScope(scope);
  if (normalizedScope === 'professional') return 'secondary';
  if (normalizedScope === 'fsbo') return 'fsbo';
  if (normalizedScope === 'personal') return 'personal';
  return '';
};

export const isLikelyNonIdentityName = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized === 'd4$'
    || normalized === 'drive4$'
    || normalized === 'new user'
    || normalized === 'owner'
    || normalized === 'select';
};

export const pickIdentityName = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized && !isLikelyNonIdentityName(normalized)) return normalized;
  }
  return '';
};

export const inferRecordProfileScope = (record, fallbackScope = '') => {
  const ownerAccountType = String(record?.ownerAccountType || record?.owner_account_type || '').trim().toLowerCase();
  const dealTag = String(record?.dealTag || record?.deal_tag || '').trim().toUpperCase();
  const source = String(record?.source || '').trim().toLowerCase();
  if (ownerAccountType === 'fsbo_owner' || source === 'fsbo') return 'fsbo';

  const explicitScope = String(
    record?.primaryProfile
    || record?.primary_profile
    || record?.ownerPreview?.primaryProfile
    || record?.owner_preview?.primaryProfile
    || ''
  ).trim();
  if (explicitScope) return normalizeProfileScope(explicitScope);

  if (dealTag === 'FSBO') return 'fsbo';
  return normalizeProfileScope(fallbackScope);
};

export function resolveScopedProfile(scope, {
  accountType,
  userProfile,
  personalProfile,
  professionalProfile,
} = {}) {
  const normalizedScope = normalizeProfileScope(scope);
  const user = userProfile || {};
  const personal = personalProfile || {};
  const professional = professionalProfile || {};
  const isProfessionalScope = normalizedScope === 'professional';
  const isFsboScope = normalizedScope === 'fsbo';
  const isVerifiedA = professional.verifiedA === true || professional?.verificationA?.verified === true || personal.verifiedPersonal === true || personal?.verificationPersonal?.verified === true;
  const isVerifiedB = professional.verifiedB === true || professional?.verificationB?.verified === true;
  const isVerifiedFsbo = personal.verifiedFsbo === true || personal?.verificationFsbo?.verified === true || professional.verifiedC === true || professional?.verificationC?.verified === true;

  if (isProfessionalScope) {
    return {
      scope: normalizedScope,
      name: pickIdentityName(
        professional.fullNameB,
        professional.fullName
      ),
      loc: pickString(
        professional.locB
      ),
      photo: pickString(
        professional.photoB,
        professional.photoBUrl,
        professional.photo
      ),
      categoryId: pickString(
        professional.primaryCategoryB,
        professional.categoryB
      ),
      categoryLabelFallback: pickString(
        professional.categoryB,
        professional.primaryCategoryB
      ),
      badge: pickString(professional.badgeB),
      pitch: pickString(
        professional.pitchB,
        professional.pitch,
        user.type
      ),
      contactMethods: pickArray(professional.contactMethodsB),
      primaryPhone: pickString(
        professional.primaryPhoneB,
        professional.phoneB
      ),
      secondaryPhone: pickString(professional.secondaryPhoneB),
      tertiaryPhone: pickString(professional.tertiaryPhoneB),
      email: pickString(professional.emailB),
      cardPriority: pickString(professional.cardPriorityB),
      verified: isVerifiedB,
      accountType: String(accountType || ''),
    };
  }

  return {
    scope: normalizedScope,
    name: isFsboScope
      ? pickIdentityName(personal.fullName)
      : pickIdentityName(professional.fullNameA),
    loc: isFsboScope
      ? pickString(personal.loc)
      : pickString(professional.locA),
    photo: isFsboScope
      ? pickString(personal.photo)
      : pickString(professional.photoA),
    categoryId: isFsboScope
      ? 'fsbo'
      : pickString(professional.primaryCategory, professional.category),
    categoryLabelFallback: isFsboScope
      ? 'FSBO'
      : pickString(professional.category),
    badge: isFsboScope ? 'FSBO' : pickString(user.badge),
    pitch: isFsboScope
      ? pickString(personal.bio, personal.pitch)
      : pickString(professional.pitch),
    contactMethods: isFsboScope
      ? pickArray(personal.contactMethods)
      : pickArray(professional.contactMethodsA),
    primaryPhone: isFsboScope
      ? pickString(personal.primaryPhone, personal.phone)
      : pickString(professional.primaryPhoneA, professional.phoneA),
    secondaryPhone: isFsboScope
      ? pickString(personal.secondaryPhone)
      : pickString(professional.secondaryPhoneA),
    tertiaryPhone: isFsboScope
      ? pickString(personal.tertiaryPhone)
      : pickString(professional.tertiaryPhoneA),
    email: isFsboScope
      ? pickString(personal.email)
      : pickString(professional.emailA),
    cardPriority: isFsboScope
      ? pickString(personal.cardPriorityC)
      : pickString(
          professional.cardPriorityA
        ),
    verified: isFsboScope ? isVerifiedFsbo : isVerifiedA,
    accountType: String(accountType || ''),
  };
}

export function buildScopedProfilePayload({
  accountType,
  userProfile,
  personalProfile,
  professionalProfile,
} = {}) {
  return {
    version: 1,
    accountType: String(accountType || ''),
    resolved: {
      personal: resolveScopedProfile('personal', { accountType, userProfile, personalProfile, professionalProfile }),
      professional: resolveScopedProfile('professional', { accountType, userProfile, personalProfile, professionalProfile }),
      fsbo: resolveScopedProfile('fsbo', { accountType, userProfile, personalProfile, professionalProfile }),
    },
    profiles: {
      personal: toPersonalProfileShape(resolveScopedProfile('personal', { accountType, userProfile, personalProfile, professionalProfile }), {}),
      professional: toProfessionalProfileShape(resolveScopedProfile('professional', { accountType, userProfile, personalProfile, professionalProfile }), professionalProfile || {}),
      fsbo: toPersonalProfileShape(resolveScopedProfile('fsbo', { accountType, userProfile, personalProfile, professionalProfile }), personalProfile || {}),
    },
    legacy: {
      personalProfile: personalProfile || {},
      professionalProfile: professionalProfile || {},
    },
  };
}

export function extractScopedProfileLegacy(profilePayload) {
  const payload = profilePayload && typeof profilePayload === 'object' ? profilePayload : {};
  const legacy = payload.legacy && typeof payload.legacy === 'object' ? payload.legacy : {};
  const profiles = payload.profiles && typeof payload.profiles === 'object' ? payload.profiles : {};
  const resolved = payload.resolved && typeof payload.resolved === 'object' ? payload.resolved : {};
  const personalFromPayload = legacy.personalProfile && typeof legacy.personalProfile === 'object'
    ? legacy.personalProfile
    : null;
  const professionalFromPayload = legacy.professionalProfile && typeof legacy.professionalProfile === 'object'
    ? legacy.professionalProfile
    : null;
  const personalProfileFromPayload = profiles.personal && typeof profiles.personal === 'object'
    ? profiles.personal
    : (resolved.personal && typeof resolved.personal === 'object'
      ? toPersonalProfileShape(resolved.personal, personalFromPayload || {})
      : null);
  const professionalProfileFromPayload = profiles.professional && typeof profiles.professional === 'object'
    ? profiles.professional
    : (resolved.professional && typeof resolved.professional === 'object'
      ? toProfessionalProfileShape(resolved.professional, professionalFromPayload || {})
      : null);
  const fsboProfileFromPayload = profiles.fsbo && typeof profiles.fsbo === 'object'
    ? profiles.fsbo
    : (resolved.fsbo && typeof resolved.fsbo === 'object'
      ? toPersonalProfileShape(resolved.fsbo, personalFromPayload || {})
      : null);
  return {
    personalFromPayload,
    professionalFromPayload,
    personalProfileFromPayload,
    professionalProfileFromPayload,
    fsboProfileFromPayload,
  };
}

