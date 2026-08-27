export const MAXXIS_AVATAR_SIZE = Object.freeze({
  MIN: 1,
  MAX: 2.5,
  STEP: 0.01,
  DEFAULT: 1,
});

export function normalizeMaxxisAvatarSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return MAXXIS_AVATAR_SIZE.DEFAULT;
  return Number(Math.min(MAXXIS_AVATAR_SIZE.MAX, Math.max(MAXXIS_AVATAR_SIZE.MIN, numeric)).toFixed(2));
}

export function resolveEffectiveMaxxisAvatarSize(value, { mobileSafetyLimit = null } = {}) {
  const stored = normalizeMaxxisAvatarSize(value);
  const requestedLimit = mobileSafetyLimit == null ? Number.NaN : Number(mobileSafetyLimit);
  const effective = Number.isFinite(requestedLimit)
    ? Math.min(stored, Math.max(MAXXIS_AVATAR_SIZE.MIN, requestedLimit))
    : stored;
  return Object.freeze({ stored, effective: Number(effective.toFixed(2)) });
}
