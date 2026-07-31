const VALID_PROFILE_SCOPES = new Set(['personal', 'professional', 'fsbo']);

export const normalizeProfileScope = (value, fallback = 'personal') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (VALID_PROFILE_SCOPES.has(normalized)) return normalized;
  const cleanFallback = String(fallback || '').trim().toLowerCase();
  return VALID_PROFILE_SCOPES.has(cleanFallback) ? cleanFallback : 'personal';
};

export const getRecordProfileScope = (record, fallback = 'personal') => normalizeProfileScope(
  record?.primaryProfile
  || record?.primary_profile
  || record?.profileScope
  || record?.profile_scope,
  fallback,
);

export const buildProfileEntitlementKey = (ownerId, profileScope = 'personal') => {
  const cleanOwnerId = String(ownerId || '').trim();
  return cleanOwnerId ? `${cleanOwnerId}:${normalizeProfileScope(profileScope)}` : '';
};

