const DRAFT_PREFIX = 'ds_onboarding_draft_v1';
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const getStorage = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

export const buildOnboardingDraftKey = (userId, accountType) => {
  const safeUserId = String(userId || 'guest').trim() || 'guest';
  const safeAccountType = String(accountType || 'professional').trim() || 'professional';
  return `${DRAFT_PREFIX}:${safeUserId}:${safeAccountType}`;
};

export const readOnboardingDraft = (userId, accountType) => {
  const storage = getStorage();
  if (!storage) return null;
  const key = buildOnboardingDraftKey(userId, accountType);
  try {
    const record = JSON.parse(storage.getItem(key) || 'null');
    if (!record || record.version !== 1 || !record.payload) return null;
    if (Date.now() - Number(record.updatedAt || 0) > DRAFT_TTL_MS) {
      storage.removeItem(key);
      return null;
    }
    return record.payload;
  } catch {
    storage.removeItem(key);
    return null;
  }
};

export const writeOnboardingDraft = (userId, accountType, payload) => {
  const storage = getStorage();
  if (!storage || !payload || typeof payload !== 'object') return false;
  try {
    storage.setItem(buildOnboardingDraftKey(userId, accountType), JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      payload,
    }));
    return true;
  } catch {
    return false;
  }
};

export const clearOnboardingDraft = (userId, accountType) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(buildOnboardingDraftKey(userId, accountType));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
};
