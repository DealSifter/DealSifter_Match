export const PENDING_DEAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const toTime = (value) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const getPendingDealExpiry = (startedAt = Date.now()) => {
  const startTime = typeof startedAt === 'number' ? startedAt : (toTime(startedAt) || Date.now());
  return new Date(startTime + PENDING_DEAL_DURATION_MS).toISOString();
};

export const isPendingDealActive = (property, now = Date.now()) => {
  if (!property || property.dealClosed === true || property.pendingDeal !== true) return false;
  const expiresAt = toTime(property.pendingDealExpiresAt);
  return Boolean(expiresAt && expiresAt > now);
};

export const isPendingDealExpired = (property, now = Date.now()) => {
  if (!property || property.dealClosed === true || property.pendingDeal !== true) return false;
  const expiresAt = toTime(property.pendingDealExpiresAt);
  return Boolean(expiresAt && expiresAt <= now);
};

export const getPendingDealRemainingDays = (property, now = Date.now()) => {
  const expiresAt = toTime(property?.pendingDealExpiresAt);
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000)));
};

export const markPendingDeal = (property, now = Date.now()) => {
  const startedAt = new Date(now).toISOString();
  return {
    ...(property || {}),
    pendingDeal: true,
    pendingDealStartedAt: startedAt,
    pendingDealExpiresAt: getPendingDealExpiry(now),
  };
};

export const clearPendingDeal = (property) => ({
  ...(property || {}),
  pendingDeal: false,
  pendingDealStartedAt: null,
  pendingDealExpiresAt: null,
});
