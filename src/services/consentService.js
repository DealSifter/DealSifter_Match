import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export const COOKIE_CONSENT_KEY = 'ds_cookie_consent';
export const COOKIE_CONSENT_VERSION = '2026-06';
export const COOKIE_CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export const PRIVACY_CONSENT_KEY = 'ds_lgpd_consent';
export const PRIVACY_CONSENT_VERSION = '1.0';
export const PRIVACY_CONSENT_TYPE = 'data_processing';

export const TERMS_CONSENT_KEY = 'ds_terms_consent';
export const TERMS_CONSENT_VERSION = '2026-06';
export const TERMS_CONSENT_TYPE = 'terms_of_use';

const ANON_PRIVACY_CONSENT_ID_KEY = 'ds_lgpd_consent_anon_id';

const canUseBrowserStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeJsonParse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const safeLocalGet = (key) => {
  try {
    return canUseBrowserStorage() ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeLocalSet = (key, value) => {
  try {
    if (canUseBrowserStorage()) window.localStorage.setItem(key, value);
  } catch {
    // no-op
  }
};

const safeLocalRemove = (key) => {
  try {
    if (canUseBrowserStorage()) window.localStorage.removeItem(key);
  } catch {
    // no-op
  }
};

const getUserAgent = () => {
  try {
    return String(window.navigator?.userAgent || '').slice(0, 200) || null;
  } catch {
    return null;
  }
};

const scopedConsentKey = (baseKey, userId = '') => {
  const normalized = String(userId || '').trim();
  return normalized ? `${baseKey}:${normalized}` : baseKey;
};

const readVersionedLocalConsent = (baseKey, userId, version) => {
  const keys = userId ? [scopedConsentKey(baseKey, userId)] : [baseKey];
  return keys.some((key) => {
    const raw = safeLocalGet(key);
    if (raw === '1') return true;
    const parsed = safeJsonParse(raw);
    return parsed?.accepted === true && String(parsed?.version || '') === String(version || '');
  });
};

const writeVersionedLocalConsent = (baseKey, userId, version) => {
  const payload = JSON.stringify({
    accepted: true,
    version,
    acceptedAt: Date.now(),
  });
  safeLocalSet(baseKey, payload);
  if (userId) safeLocalSet(scopedConsentKey(baseKey, userId), payload);
  return payload;
};

const clearVersionedLocalConsent = (baseKey, userId) => {
  safeLocalRemove(baseKey);
  if (userId) safeLocalRemove(scopedConsentKey(baseKey, userId));
};

const isCookieConsentPayloadValid = (raw) => {
  if (raw === '1') return true;
  const parsed = safeJsonParse(raw);
  if (!parsed || typeof parsed !== 'object') return false;
  if (parsed.version !== COOKIE_CONSENT_VERSION) return false;
  if (!['accepted', 'essential'].includes(String(parsed.choice || ''))) return false;
  const expiresAt = Number(parsed.expiresAt || 0);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const queryConsentRecord = async ({ userId, consentType, version }) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId || !isSupabaseConfigured || !supabase) return false;

  const { data, error } = await supabase
    .from('consent_records')
    .select('id, accepted_at')
    .eq('user_id', normalizedUserId)
    .eq('consent_type', consentType)
    .eq('version', version)
    .is('revoked_at', null)
    .order('accepted_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
};

const insertConsentRecord = async ({ userId = null, anonymousId = null, consentType, version }) => {
  if (!isSupabaseConfigured || !supabase) return { ok: false, skipped: true };
  const normalizedUserId = userId ? String(userId).trim() : null;
  const normalizedAnonymousId = anonymousId ? String(anonymousId).trim() : null;
  const { error } = await supabase.from('consent_records').insert({
    user_id: normalizedUserId || null,
    anonymous_id: normalizedUserId ? null : normalizedAnonymousId,
    consent_type: consentType,
    version,
    user_agent: getUserAgent(),
  });
  if (error) throw error;
  return { ok: true };
};

export const hasAcceptedCookies = () => {
  const localPayload = safeLocalGet(COOKIE_CONSENT_KEY);
  if (isCookieConsentPayloadValid(localPayload)) return true;

  try {
    if (typeof document === 'undefined') return false;
    const cookie = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${COOKIE_CONSENT_KEY}=`));
    if (!cookie) return false;
    return isCookieConsentPayloadValid(decodeURIComponent(cookie.split('=').slice(1).join('=')));
  } catch {
    return false;
  }
};

export const acceptCookies = async (choice = 'accepted') => {
  const payload = JSON.stringify({
    version: COOKIE_CONSENT_VERSION,
    choice: choice === 'essential' ? 'essential' : 'accepted',
    acceptedAt: Date.now(),
    expiresAt: Date.now() + COOKIE_CONSENT_TTL_MS,
  });
  safeLocalSet(COOKIE_CONSENT_KEY, payload);
  try {
    if (typeof document !== 'undefined') {
      document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(payload)}; Max-Age=${Math.floor(COOKIE_CONSENT_TTL_MS / 1000)}; Path=/; SameSite=Lax; Secure`;
    }
  } catch {
    // no-op
  }
  return safeJsonParse(payload);
};

export const hasAcceptedTerms = async (userId, currentVersion = TERMS_CONSENT_VERSION) => {
  const normalizedUserId = String(userId || '').trim();
  if (readVersionedLocalConsent(TERMS_CONSENT_KEY, normalizedUserId, currentVersion)) return true;
  const accepted = await queryConsentRecord({
    userId: normalizedUserId,
    consentType: TERMS_CONSENT_TYPE,
    version: currentVersion,
  });
  if (accepted) writeVersionedLocalConsent(TERMS_CONSENT_KEY, normalizedUserId, currentVersion);
  return accepted;
};

export const recordTermsAcceptance = async (userId, version = TERMS_CONSENT_VERSION) => {
  const normalizedUserId = String(userId || '').trim();
  let insertError = null;
  if (normalizedUserId) {
    try {
      await insertConsentRecord({
        userId: normalizedUserId,
        consentType: TERMS_CONSENT_TYPE,
        version,
      });
    } catch (error) {
      insertError = error;
    }
  }
  writeVersionedLocalConsent(TERMS_CONSENT_KEY, normalizedUserId, version);
  if (insertError) throw insertError;
  return { ok: true };
};

export const hasAcceptedPrivacy = async (userId, currentVersion = PRIVACY_CONSENT_VERSION) => {
  const normalizedUserId = String(userId || '').trim();
  if (readVersionedLocalConsent(PRIVACY_CONSENT_KEY, normalizedUserId, currentVersion)) return true;
  const accepted = await queryConsentRecord({
    userId: normalizedUserId,
    consentType: PRIVACY_CONSENT_TYPE,
    version: currentVersion,
  });
  if (accepted) writeVersionedLocalConsent(PRIVACY_CONSENT_KEY, normalizedUserId, currentVersion);
  return accepted;
};

export const recordPrivacyAcceptance = async (userId, version = PRIVACY_CONSENT_VERSION) => {
  const normalizedUserId = String(userId || '').trim();
  const anonymousId = normalizedUserId ? null : `anon-${Date.now()}`;
  let insertError = null;
  if (isSupabaseConfigured && supabase) {
    try {
      await insertConsentRecord({
        userId: normalizedUserId || null,
        anonymousId,
        consentType: PRIVACY_CONSENT_TYPE,
        version,
      });
      if (anonymousId) safeLocalSet(ANON_PRIVACY_CONSENT_ID_KEY, anonymousId);
    } catch (error) {
      insertError = error;
    }
  }
  writeVersionedLocalConsent(PRIVACY_CONSENT_KEY, normalizedUserId, version);
  if (insertError) throw insertError;
  return { ok: true, anonymousId };
};

export const clearLocalPrivacyConsent = (userId = '') => {
  clearVersionedLocalConsent(PRIVACY_CONSENT_KEY, userId);
};

export const getConsentStatus = async (userId) => {
  const normalizedUserId = String(userId || '').trim();
  const [terms, privacy] = await Promise.all([
    hasAcceptedTerms(normalizedUserId, TERMS_CONSENT_VERSION).catch(() => (
      readVersionedLocalConsent(TERMS_CONSENT_KEY, normalizedUserId, TERMS_CONSENT_VERSION)
    )),
    hasAcceptedPrivacy(normalizedUserId, PRIVACY_CONSENT_VERSION).catch(() => (
      readVersionedLocalConsent(PRIVACY_CONSENT_KEY, normalizedUserId, PRIVACY_CONSENT_VERSION)
    )),
  ]);
  return {
    cookies: hasAcceptedCookies(),
    terms,
    privacy,
  };
};

export const backfillLocalPrivacyConsent = async (userId) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId || !readVersionedLocalConsent(PRIVACY_CONSENT_KEY, normalizedUserId, PRIVACY_CONSENT_VERSION)) {
    return { ok: false, skipped: true };
  }
  await insertConsentRecord({
    userId: normalizedUserId,
    consentType: PRIVACY_CONSENT_TYPE,
    version: PRIVACY_CONSENT_VERSION,
  });
  return { ok: true };
};

export const linkAnonymousPrivacyConsent = async (userId) => {
  const normalizedUserId = String(userId || '').trim();
  const anonymousId = safeLocalGet(ANON_PRIVACY_CONSENT_ID_KEY);
  if (!normalizedUserId || !anonymousId || !isSupabaseConfigured || !supabase) return { linked: false };

  const { data: existing, error: existingError } = await supabase
    .from('consent_records')
    .select('id')
    .eq('user_id', normalizedUserId)
    .eq('consent_type', PRIVACY_CONSENT_TYPE)
    .limit(1);
  if (existingError) throw existingError;
  if (existing?.length) {
    safeLocalRemove(ANON_PRIVACY_CONSENT_ID_KEY);
    return { linked: false, alreadyLinked: true };
  }

  const { data: anonymousRows, error: anonymousError } = await supabase
    .from('consent_records')
    .select('id')
    .is('user_id', null)
    .eq('anonymous_id', anonymousId)
    .eq('consent_type', PRIVACY_CONSENT_TYPE)
    .limit(1);
  if (anonymousError) throw anonymousError;
  if (!anonymousRows?.[0]?.id) return { linked: false };

  const { error: updateError } = await supabase
    .from('consent_records')
    .update({ user_id: normalizedUserId, anonymous_id: null })
    .eq('id', anonymousRows[0].id);
  if (updateError) throw updateError;

  safeLocalRemove(ANON_PRIVACY_CONSENT_ID_KEY);
  return { linked: true };
};

export const revokePrivacyConsent = async (userId) => {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId || !isSupabaseConfigured || !supabase) return { ok: false, skipped: true };
  const { error } = await supabase
    .from('consent_records')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', normalizedUserId)
    .eq('consent_type', PRIVACY_CONSENT_TYPE)
    .is('revoked_at', null);
  if (error) throw error;
  clearLocalPrivacyConsent(normalizedUserId);
  return { ok: true };
};
