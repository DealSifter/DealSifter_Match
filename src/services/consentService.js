/**
 * @file Proposed public interface for the future consent/cookie service.
 *
 * Documentation only. No runtime implementation should be added until the
 * extraction step that moves consent logic out of App.jsx.
 */

/**
 * Cookie consent payload persisted in localStorage and document.cookie.
 *
 * @typedef {Object} CookieConsentPayload
 * @property {string} version
 * @property {'accepted'|'essential'} choice
 * @property {number} acceptedAt
 * @property {number} expiresAt
 */

/**
 * LGPD consent payload persisted locally.
 *
 * @typedef {Object} LgpdConsentPayload
 * @property {true} accepted
 * @property {string} version
 * @property {number} acceptedAt
 */

/**
 * Read cookie consent from localStorage/cookie and validate version + TTL.
 *
 * @function readCookieConsent
 * @param {Object} params
 * @param {string} params.key
 * @param {string} params.version
 * @returns {boolean}
 */

/**
 * Persist cookie consent in localStorage and document.cookie.
 *
 * @function writeCookieConsent
 * @param {Object} params
 * @param {string} params.key
 * @param {string} params.version
 * @param {number} params.ttlMs
 * @param {'accepted'|'essential'} params.choice
 * @returns {CookieConsentPayload}
 */

/**
 * Read LGPD data-processing consent from user-scoped localStorage keys.
 *
 * @function readLgpdConsent
 * @param {Object} params
 * @param {string} params.key
 * @param {string} params.version
 * @param {string=} params.userId
 * @returns {boolean}
 */

/**
 * Persist LGPD data-processing consent locally.
 *
 * @function writeLgpdConsent
 * @param {Object} params
 * @param {string} params.key
 * @param {string} params.version
 * @param {string=} params.userId
 * @returns {LgpdConsentPayload}
 */

/**
 * Clear LGPD consent from global and user-scoped localStorage keys.
 *
 * @function clearLgpdConsent
 * @param {Object} params
 * @param {string} params.key
 * @param {string=} params.userId
 * @returns {{ ok: boolean }}
 */

/**
 * Insert a server-side consent proof row before accepting locally.
 *
 * @function recordLgpdConsent
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string|null} params.userId
 * @param {string} params.version
 * @param {string} params.userAgent
 * @param {string=} params.anonymousId
 * @returns {Promise<{ ok: boolean, anonymousId?: string }>}
 */

/**
 * Verify whether a user has a non-revoked remote consent record.
 *
 * @function verifyRemoteLgpdConsent
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @returns {Promise<boolean>}
 */

/**
 * Backfill a local consent acceptance into consent_records.
 *
 * @function backfillLocalLgpdConsent
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {string} params.version
 * @param {string} params.userAgent
 * @returns {Promise<{ ok: boolean }>}
 */

/**
 * Link an anonymous consent record to an authenticated user.
 *
 * @function linkAnonymousConsent
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @param {string} params.anonymousId
 * @returns {Promise<{ linked: boolean }>}
 */

/**
 * Revoke active LGPD data-processing consent rows.
 *
 * @function revokeLgpdConsent
 * @param {Object} params
 * @param {import('@supabase/supabase-js').SupabaseClient} params.supabase
 * @param {string} params.userId
 * @returns {Promise<{ ok: boolean }>}
 */

