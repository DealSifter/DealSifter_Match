import React, { Activity, useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import './App.css';
import loaderMark from './assets/logo.png';
import { ThemeProvider } from './theme/theme';
import { Navbar } from './components/layout/Navbar';
import { AppMobileBottomNav } from './components/layout/AppMobileBottomNav';
import { GuideTipsProvider } from './components/guidetips/GuideTipsProvider';
import { GuideTipOverlay } from './components/guidetips/GuideTipOverlay';
const safeSessionGet = (key) => {
  try { return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null; } catch { return null; }
};
const safeSessionSet = (key, value) => {
  try { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value); } catch { /* noop */ }
};
const safeSessionRemove = (key) => {
  try { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); } catch { /* noop */ }
};

const ChunkRecoveryScreen = () => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b0f0e', color: '#e6f0ed', padding: 24 }}>
    <div style={{ width: 'min(92vw, 520px)', border: '1px solid rgba(120,140,135,.35)', borderRadius: 14, padding: 20, background: 'rgba(10,16,14,.88)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Atualização em andamento</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9, marginBottom: 14 }}>
        O app detectou arquivos antigos em cache. Recarregue para sincronizar a versão mais recente.
      </div>
      <button
        type="button"
        onClick={() => {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('refresh', String(Date.now()));
            window.location.replace(url.toString());
          } catch {
            window.location.reload();
          }
        }}
        style={{ border: '1px solid rgba(56,189,175,.55)', background: 'rgba(56,189,175,.14)', color: '#69ece0', borderRadius: 10, padding: '10px 14px', fontWeight: 800, cursor: 'pointer' }}
      >
        Recarregar app
      </button>
    </div>
  </div>
);

const lazyWithRetry = (importer, key) => lazy(async () => {
  try {
    safeSessionRemove(`ds_lazy_retry_${key}`);
    return await importer();
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    const recoverable = msg.includes('failed to fetch dynamically imported module')
      || msg.includes('importing a module script failed')
      || msg.includes('chunkloaderror');
    if (recoverable && typeof window !== 'undefined') {
      const retryKey = `ds_lazy_retry_${key}`;
      if (!safeSessionGet(retryKey)) {
        safeSessionSet(retryKey, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      return { default: ChunkRecoveryScreen };
    }
    return { default: ChunkRecoveryScreen };
  }
});

const Landing = lazyWithRetry(() => import('./pages/Landing').then((m) => ({ default: m.Landing })), 'landing');
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })), 'dashboard');
const MatchesPage = lazyWithRetry(() => import('./pages/MatchesPage').then((m) => ({ default: m.MatchesPage })), 'matches');
const Onboarding = lazyWithRetry(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })), 'onboarding');
const Pricing = lazyWithRetry(() => import('./pages/Pricing').then((m) => ({ default: m.Pricing })), 'pricing');
const MapView = lazyWithRetry(() => import('./pages/MapView').then((m) => ({ default: m.MapView })), 'mapview');
const Settings = lazyWithRetry(() => import('./pages/Settings').then((m) => ({ default: m.Settings })), 'settings');
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })), 'admin');
const TermsPage = lazyWithRetry(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })), 'terms');
const PrivacyPolicyPage = lazyWithRetry(() => import('./pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })), 'privacy');
import { UnlockModal } from './components/modals/UnlockModal';
import { SpotlightModal } from './components/modals/SpotlightModal';
const AuthAccessModal = lazyWithRetry(() => import('./components/modals/AuthAccessModal').then((m) => ({ default: m.AuthAccessModal })), 'auth-access');
const AdminLoginModal = lazyWithRetry(() => import('./components/modals/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal })), 'admin-login');
const EmbeddedCheckoutModal = lazyWithRetry(() => import('./components/modals/EmbeddedCheckoutModal').then((m) => ({ default: m.EmbeddedCheckoutModal })), 'embedded-checkout');
import { ToastContainer } from './components/ui/Toast';
const ConsentBanner = lazyWithRetry(() => import('./components/ui/ConsentBanner').then((m) => ({ default: m.ConsentBanner })), 'consent');
const CookieBanner = lazyWithRetry(() => import('./components/ui/CookieBanner').then((m) => ({ default: m.CookieBanner })), 'cookie');
import { getT } from './i18n/translations';
import { CATEGORIES, CARDS as _MOCK_CARDS, PLANS, PROPERTIES as _MOCK_PROPERTIES, SERVICE_PORTFOLIO as _MOCK_SERVICES } from './data/mockData';
import { supabase, isSupabaseConfigured, supabaseConfigHint } from './lib/supabaseClient';
import { buildScopedProfilePayload, extractScopedProfileLegacy, normalizeProfileScope } from './lib/profileScopeResolver';
import { getPortfolioFull, setPortfolioFull, clearAllUserData, uploadDataUrlToStorage } from './lib/localforageHelper';
import { useAuthSession, mapSupabaseUserToSession } from './hooks/useAuthSession';
import { useProfileSync } from './hooks/useProfileSync';
import { usePortfolioSync } from './hooks/usePortfolioSync';
import { useCheckoutFlow } from './hooks/useCheckoutFlow';
import { useMediaQuery } from './hooks/useMediaQuery';
import { canUsePlanAction, getPlanGateCopy, incrementPlanUsage, readPlanUsage } from './lib/planAccess';
import { trackAppEvent } from './lib/adminEventTracking';
import { createPropertyUnlockRecord, getPortfolioUnlockCost, getPropertyExclusivityStatus, resolveUnlockOwnerId } from './lib/unlockRules';
import { isPendingDealExpired } from './lib/pendingDeal';

// Safe error logger — strips Supabase error details that may contain personal data
const safeLogError = (label, error) => {
  if (import.meta.env.DEV) {
    console.error(label, error);
    return;
  }
  const code = error?.code || error?.status || '';
  const hint = error?.hint || '';
  console.error(`${label} [code=${code}]${hint ? ` hint=${hint}` : ''}`);
};

const isMissingColumnError = (error, columnName) => {
  const msg = String(error?.message || error?.details || '').toLowerCase();
  return msg.includes(`column ${String(columnName || '').toLowerCase()} does not exist`);
};

const isPropertiesOptionalColumnMissingError = (error) => {
  const optionalColumns = [
    'properties.video',
    'properties.lat',
    'properties.lng',
    'properties.geocode_status',
    'properties.geocode_source',
    'properties.geocode_confidence',
    'properties.geocode_input',
    'properties.geocoded_at',
    'properties.deal_closed',
    'properties.pending_deal',
    'properties.pending_deal_started_at',
    'properties.pending_deal_expires_at',
  ];
  return optionalColumns.some((column) => isMissingColumnError(error, column));
};

const isMissingFunctionError = (error, functionName) => {
  const msg = String(error?.message || error?.details || '').toLowerCase();
  const fn = String(functionName || '').toLowerCase();
  if (!fn) return false;
  return msg.includes('function') && msg.includes('does not exist') && msg.includes(fn);
};

const LOCAL_REALTIME_IGNORE_MS = 2200;
const REALTIME_REFRESH_MIN_INTERVAL_MS = 2500;

// Global unhandled error capture — hooks into window.__DS_REPORT_ERROR for Sentry/external service
if (typeof window !== 'undefined') {
  const report = (error, context) => {
    if (typeof window.__DS_REPORT_ERROR === 'function') {
      try { window.__DS_REPORT_ERROR(error, context); } catch { /* no-op */ }
    }
  };
  window.addEventListener('error', (event) => {
    report(event.error || event.message, { type: 'uncaught', filename: event.filename, lineno: event.lineno });
  });
  window.addEventListener('unhandledrejection', (event) => {
    report(event.reason, { type: 'unhandledrejection' });
  });
}

// Production must use real DB/user-owned records only. Mock metadata is dev-only
// so portfolio counts, unlock pricing, and feeds cannot be polluted by test data.
const CARDS = import.meta.env.DEV ? _MOCK_CARDS : [];
const MOCK_PROPERTIES = import.meta.env.DEV ? (_MOCK_PROPERTIES || []) : [];
const MOCK_SERVICES = import.meta.env.DEV ? (_MOCK_SERVICES || []) : [];

// DevInspector: lazy-loaded, only rendered in dev
const DevInspector = import.meta.env.DEV
  ? lazy(() => import('./components/dev/DevInspector').then((m) => ({ default: m.DevInspector })))
  : () => null;

const PLAN_BONUS_BY_TIER = {
  free: 0,
  pro: 3,
  enterprise: 20,
};

const SECURITY_AUDIT_KEY = 'ds_security_audit';
const SECURITY_SESSIONS_KEY = 'ds_security_sessions';
const SECURITY_ACTIVE_SESSION_KEY = 'ds_security_active_session_id';
const APP_SESSION_TOKEN_KEY = 'ds_app_session_token';
const APP_LAST_ACTIVITY_KEY = 'ds_app_last_activity_at';
const APP_IDLE_SIGNOUT_MS = 60 * 60 * 1000;
const USER_PREFERENCES_KEY = 'ds_user_preferences';
const COOKIE_CONSENT_KEY = 'ds_cookie_consent';
const COOKIE_CONSENT_VERSION = '2026-06';
const COOKIE_CONSENT_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const LGPD_CONSENT_KEY = 'ds_lgpd_consent';
const LGPD_CONSENT_VERSION = '1.0';

const appendSecurityAuditEvent = (event) => {
  try {
    const current = JSON.parse(localStorage.getItem(SECURITY_AUDIT_KEY) || '[]');
    const next = Array.isArray(current) ? current : [];
    next.unshift({
      id: `sec-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      at: Date.now(),
      ...event,
    });
    localStorage.setItem(SECURITY_AUDIT_KEY, JSON.stringify(next.slice(0, 200)));
  } catch { /* no-op */ }
};

const consumeRateLimit = (key, maxAttempts, windowMs, lockMs = windowMs) => {
  try {
    const now = Date.now();
    const store = JSON.parse(localStorage.getItem('ds_security_rate_limits') || '{}');
    const entry = store?.[key] || { attempts: [], lockedUntil: 0 };
    if (Number(entry.lockedUntil || 0) > now) {
      return { allowed: false, retryAfterMs: Number(entry.lockedUntil) - now };
    }
    const attempts = (Array.isArray(entry.attempts) ? entry.attempts : []).filter((ts) => now - Number(ts) <= windowMs);
    attempts.push(now);
    if (attempts.length > maxAttempts) {
      const lockedUntil = now + lockMs;
      store[key] = { attempts, lockedUntil };
      localStorage.setItem('ds_security_rate_limits', JSON.stringify(store));
      return { allowed: false, retryAfterMs: lockMs };
    }
    store[key] = { attempts, lockedUntil: 0 };
    localStorage.setItem('ds_security_rate_limits', JSON.stringify(store));
    return { allowed: true, retryAfterMs: 0 };
  } catch {
    return { allowed: true, retryAfterMs: 0 };
  }
};

const getAppSessionToken = (userId = '') => {
  try {
    const normalizedUserId = String(userId || '').trim();
    const tokenKey = normalizedUserId ? `${APP_SESSION_TOKEN_KEY}:${normalizedUserId}` : APP_SESSION_TOKEN_KEY;
    let token = safeSessionGet(tokenKey);
    if (!token) {
      token = (crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      safeSessionSet(tokenKey, token);
    }
    return token;
  } catch {
    return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const getDeviceLabel = () => {
  try {
    return String(navigator.userAgent || 'Unknown device').slice(0, 180);
  } catch {
    return 'Unknown device';
  }
};

const readCookieConsent = () => {
  const isValidPayload = (raw) => {
    if (raw === '1') return true; // legacy acceptance
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return false;
    if (!['accepted', 'essential'].includes(String(parsed.choice || ''))) return false;
    const expiresAt = Number(parsed.expiresAt || 0);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  };
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (isValidPayload(raw)) return true;
  } catch { /* no-op */ }
  try {
    const cookie = document.cookie
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${COOKIE_CONSENT_KEY}=`));
    if (!cookie) return false;
    return isValidPayload(decodeURIComponent(cookie.split('=').slice(1).join('=')));
  } catch { /* no-op */ }
  return false;
};

const writeCookieConsent = (choice = 'accepted') => {
  const payload = JSON.stringify({
    version: COOKIE_CONSENT_VERSION,
    choice: choice === 'essential' ? 'essential' : 'accepted',
    acceptedAt: Date.now(),
    expiresAt: Date.now() + COOKIE_CONSENT_TTL_MS,
  });
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, payload);
  } catch { /* no-op */ }
  try {
    document.cookie = `${COOKIE_CONSENT_KEY}=${encodeURIComponent(payload)}; Max-Age=${Math.floor(COOKIE_CONSENT_TTL_MS / 1000)}; Path=/; SameSite=Lax; Secure`;
  } catch { /* no-op */ }
};

const readLgpdConsent = (userId = '') => {
  const keys = [
    userId ? `${LGPD_CONSENT_KEY}:${userId}` : '',
    LGPD_CONSENT_KEY,
  ].filter(Boolean);
  try {
    return keys.some((key) => {
      const raw = localStorage.getItem(key);
      if (raw === '1') return true;
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.accepted === true && String(parsed?.version || '') === LGPD_CONSENT_VERSION;
    });
  } catch {
    return false;
  }
};

const writeLgpdConsent = (userId = '') => {
  const payload = JSON.stringify({
    accepted: true,
    version: LGPD_CONSENT_VERSION,
    acceptedAt: Date.now(),
  });
  try {
    localStorage.setItem(LGPD_CONSENT_KEY, payload);
    if (userId) localStorage.setItem(`${LGPD_CONSENT_KEY}:${userId}`, payload);
  } catch { /* no-op */ }
};

const clearLgpdConsent = (userId = '') => {
  try {
    localStorage.removeItem(LGPD_CONSENT_KEY);
    if (userId) localStorage.removeItem(`${LGPD_CONSENT_KEY}:${userId}`);
  } catch { /* no-op */ }
};

const DEFAULT_USER_PREFERENCES = {
  map: {
    initialZoom: 4,
    defaultStyle: 'simple',
    clusterBehavior: 'pins_city',
    defaultFilters: {
      showPeople: true,
      showProperties: true,
      showOnlyUnlocked: false,
      showOnlyMyPins: false,
    },
  },
  feedMatches: {
    sortOrder: 'random',
    autoplayMedia: false,
  },
  chatLanguage: {
    input: 'pt',
    output: 'en',
  },
  privacy: {
    presenceStatus: 'online',
    readReceipts: true,
    messagePreview: true,
  },
};

const normalizeUserPreferences = (value) => {
  const input = value && typeof value === 'object' ? value : {};
  const map = input.map && typeof input.map === 'object' ? input.map : {};
  const defaultFilters = map.defaultFilters && typeof map.defaultFilters === 'object' ? map.defaultFilters : {};
  const feedMatches = input.feedMatches && typeof input.feedMatches === 'object' ? input.feedMatches : {};
  const chatLanguage = input.chatLanguage && typeof input.chatLanguage === 'object' ? input.chatLanguage : {};
  const privacy = input.privacy && typeof input.privacy === 'object' ? input.privacy : {};
  const initialZoomRaw = Number(map.initialZoom);
  const initialZoom = Number.isFinite(initialZoomRaw) ? Math.max(3, Math.min(13, initialZoomRaw)) : DEFAULT_USER_PREFERENCES.map.initialZoom;
  const rawDefaultStyle = String(map.defaultStyle || '').trim();
  const defaultStyle = ['simple', 'satellite_streets', 'topo'].includes(rawDefaultStyle)
    ? rawDefaultStyle
    : (rawDefaultStyle === 'flood' ? 'satellite_streets' : DEFAULT_USER_PREFERENCES.map.defaultStyle);
  const clusterBehavior = ['pins_city', 'mixed'].includes(String(map.clusterBehavior || '').trim())
    ? String(map.clusterBehavior).trim()
    : DEFAULT_USER_PREFERENCES.map.clusterBehavior;
  const sortOrder = ['random', 'recent', 'name_asc', 'price_asc', 'price_desc', 'my_cards_first'].includes(String(feedMatches.sortOrder || '').trim())
    ? String(feedMatches.sortOrder).trim()
    : DEFAULT_USER_PREFERENCES.feedMatches.sortOrder;
  const presenceStatus = ['online', 'standby', 'offline'].includes(String(privacy.presenceStatus || '').trim())
    ? String(privacy.presenceStatus).trim()
    : DEFAULT_USER_PREFERENCES.privacy.presenceStatus;

  return {
    map: {
      initialZoom,
      defaultStyle,
      clusterBehavior,
      defaultFilters: {
        showPeople: Boolean(defaultFilters.showPeople ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showPeople),
        showProperties: Boolean(defaultFilters.showProperties ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showProperties),
        showOnlyUnlocked: Boolean(defaultFilters.showOnlyUnlocked ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showOnlyUnlocked),
        showOnlyMyPins: Boolean(defaultFilters.showOnlyMyPins ?? DEFAULT_USER_PREFERENCES.map.defaultFilters.showOnlyMyPins),
      },
    },
    feedMatches: {
      sortOrder,
      autoplayMedia: Boolean(feedMatches.autoplayMedia ?? DEFAULT_USER_PREFERENCES.feedMatches.autoplayMedia),
    },
    chatLanguage: {
      input: ['pt', 'en', 'es'].includes(String(chatLanguage.input || '').trim()) ? String(chatLanguage.input).trim() : DEFAULT_USER_PREFERENCES.chatLanguage.input,
      output: ['pt', 'en', 'es'].includes(String(chatLanguage.output || '').trim()) ? String(chatLanguage.output).trim() : DEFAULT_USER_PREFERENCES.chatLanguage.output,
    },
    privacy: {
      presenceStatus,
      readReceipts: Boolean(privacy.readReceipts ?? DEFAULT_USER_PREFERENCES.privacy.readReceipts),
      messagePreview: Boolean(privacy.messagePreview ?? DEFAULT_USER_PREFERENCES.privacy.messagePreview),
    },
  };
};

// Keys whose full (media-inclusive) version is stored in localforage (IndexedDB)
// instead of localStorage to avoid the ~5MB quota limit.
const LOCALFORAGE_FULL_KEYS = new Set(['propertyPortfolio', 'servicePortfolio']);

const persistJsonSafely = (key, value, fallbackValue) => {
  try {
    // Always persist a lightweight fallback to localStorage for fast sync reads.
    if (fallbackValue !== undefined) {
      try { localStorage.setItem(key, JSON.stringify(fallbackValue)); } catch { /* ignore quota */ }
    }

    if (LOCALFORAGE_FULL_KEYS.has(key)) {
      // Store full payload (images included) in localforage (IndexedDB - no 5MB limit).
      setPortfolioFull(key, value); // async, fire-and-forget
      if (fallbackValue === undefined) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore quota */ }
      }
      return true;
    }

    // For other keys, attempt to save full payload under `key_full` in localStorage.
    try {
      localStorage.setItem(key + '_full', JSON.stringify(value));
      if (fallbackValue !== undefined) {
        localStorage.setItem(key, JSON.stringify(fallbackValue));
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    } catch (error) {
      if (error?.name !== 'QuotaExceededError') {
        console.error(`Failed to persist ${key}.`, error);
        return false;
      }
      console.warn(`Storage quota exceeded for ${key}; kept media-light fallback.`);
      return false;
    }
  } catch (outer) {
    console.error(`Failed to persist ${key} (outer).`, outer);
    return false;
  }
};

const stripServicePortfolioMedia = (portfolio) =>
  (portfolio || []).map((service) => ({
    ...service,
    media: {
      ...(service.media || {}),
      images: [],
    },
  }));

const stripPropertyPortfolioMedia = (portfolio) =>
  (portfolio || []).map((property) => ({
    ...property,
    images: [],
    video: '',
  }));

const _stripPersonalProfileMedia = (profile) => {
  if (!profile) return { fullName: '', photo: '', bio: '', visibility: 'hidden' };
  return {
    ...profile,
    photo: '',
  };
};

const DEFAULT_PERSONAL_PROFILE = { fullName: '', photo: '', bio: '', visibility: 'hidden' };

const DEFAULT_PROFESSIONAL_PROFILE = (fallbackCategory = '') => ({
  category: fallbackCategory,
  subcategory: '',
  markets: [],
  skills: [],
  services: [],
  pitch: '',
});

const normalizeStringArray = (value) =>
  Array.from(new Set((Array.isArray(value) ? value : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean)));

const isInlineMediaUrl = (value) => /^data:(image|video|audio|application)\//i.test(String(value || '').trim());
const MAX_PROFILE_PAYLOAD_BYTES = 64 * 1024;

const normalizePersistableMediaUrls = (value) =>
  normalizePortfolioImages(value).filter((item) => !isInlineMediaUrl(item));

const getUtf8ByteSize = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? {});
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
};

const normalizePersistableProfilePayload = (value) => {
  const stripped = stripInlineMediaFromObject(value || {});
  return getUtf8ByteSize(stripped) <= MAX_PROFILE_PAYLOAD_BYTES ? stripped : {};
};

const stripInlineMediaFromObject = (value) => {
  if (typeof value === 'string') return isInlineMediaUrl(value) ? '' : value;
  if (Array.isArray(value)) return value.map(stripInlineMediaFromObject).filter((item) => {
    if (item == null) return false;
    if (typeof item === 'string') return item.trim().length > 0;
    return true;
  });
  if (!value || typeof value !== 'object') return value;

  return Object.entries(value).reduce((next, [key, raw]) => {
    const normalizedKey = String(key || '').toLowerCase();
    if (normalizedKey === 'video' && isInlineMediaUrl(raw)) {
      next[key] = '';
      return next;
    }
    next[key] = stripInlineMediaFromObject(raw);
    return next;
  }, {});
};

const normalizePersonalProfile = (value) => ({
  ...DEFAULT_PERSONAL_PROFILE,
  ...(value || {}),
  fullName: String(value?.fullName || '').trim(),
  photo: String(value?.photo || '').trim(),
  bio: String(value?.bio || '').trim(),
  visibility: ['hidden', 'public', 'network'].includes(String(value?.visibility || '').trim())
    ? String(value.visibility).trim()
    : 'hidden',
});

const normalizeProfessionalProfile = (value, fallbackCategory = '') => {
  const base = {
    ...DEFAULT_PROFESSIONAL_PROFILE(fallbackCategory),
    ...(value || {}),
  };
  return {
    ...base,
    category: String(base.category || fallbackCategory || '').trim(),
    subcategory: String(base.subcategory || '').trim(),
    markets: normalizeStringArray(base.markets),
    skills: normalizeStringArray(base.skills),
    services: normalizeStringArray(base.services),
    pitch: String(base.pitch || '').trim(),
  };
};

const pruneEmptyProfileFields = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  const next = {};
  Object.entries(source).forEach(([key, raw]) => {
    if (raw == null) return;
    if (typeof raw === 'string' && !raw.trim()) return;
    if (Array.isArray(raw) && raw.length === 0) return;
    next[key] = raw;
  });
  return next;
};

const mergeProfilePayloadNonEmpty = (...sources) => {
  const next = {};
  sources.forEach((source) => {
    const input = source && typeof source === 'object' ? source : {};
    Object.entries(input).forEach(([key, raw]) => {
      if (raw == null) return;
      if (typeof raw === 'string' && !raw.trim()) return;
      if (Array.isArray(raw) && raw.length === 0) return;
      next[key] = raw;
    });
  });
  return next;
};

const LOCAL_OWNER_ID = 999999;

// All localStorage keys that are scoped to a specific authenticated user.
// These must be wiped whenever the authenticated user changes (logout, session
// expiry, or account switch) so that the next user never reads stale data.
const USER_DATA_KEYS = [
  'propertyPortfolio', 'propertyPortfolio_full',
  'servicePortfolio', 'servicePortfolio_full',
  'personalProfile', 'personalProfile_full',
  'professionalProfile',
  'userProfile',
  'accountType',
  'ds_matched', 'ds_interested', 'ds_unlocked', 'ds_purchases',
  'ds_nuggets', 'ds_subscription_mock', 'ds_system_notifications',
  'profileOwnerMap', 'publishingProfileKey',
  'ds_last_page', 'categoryOrder',
];

const clearUserSpecificLocalStorage = () => {
  USER_DATA_KEYS.forEach((key) => {
    try { localStorage.removeItem(key); } catch (e) { void e; }
  });
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const isMockPropertyId = (propertyId) => (
  (MOCK_PROPERTIES || []).some((property) => String(property?.id || '') === String(propertyId || ''))
);

const toNumberOrZero = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toNumberOrNull = (value) => {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toIntegerOrZero = (value) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
};

const toIsoDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
};

const normalizeGeocodeStatus = (value, fallback = 'pending') => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'pending' || raw === 'resolved' || raw === 'failed' || raw === 'manual') return raw;
  return fallback;
};

const isTruthyFlag = (value, defaultValue = true) => {
  if (value == null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'false' || raw === '0' || raw === 'off' || raw === 'no') return false;
  if (raw === 'true' || raw === '1' || raw === 'on' || raw === 'yes') return true;
  return Boolean(value);
};

// Normaliza e remove duplicatas, garantindo máximo de 10 imagens
const normalizePortfolioImages = (value) => {
  const arr = Array.isArray(value) ? value : [];
  const norm = arr.map((x) => String(x || '').trim()).filter(Boolean);
  // Remove duplicatas mantendo ordem
  return Array.from(new Set(norm)).slice(0, 10);
};

const isSeededPropertyRecord = (property) => String(property?.portfolioId || '').startsWith('seed-');
const isDemoSeedMockRecord = (record) => String(record?.source || '').trim() === 'demo_seed_mock';

const isUserOwnedPropertyRecord = (property) => {
  if (!property) return false;
  if (String(property?.ownerId) === String(LOCAL_OWNER_ID)) return true;
  if (isSeededPropertyRecord(property)) return false;
  const source = String(property?.source || '').trim();
  return source === 'fsbo' || source === 'supabase' || source === 'portfolio';
};

const isUserOwnedServiceRecord = (service) => (
  String(service?.ownerId) === String(LOCAL_OWNER_ID)
  || String(service?.source || '').trim() === 'portfolio'
  || String(service?.source || '').trim() === 'supabase'
);

const mapLocalPropertyToDb = (property, userId) => {
  const markets = normalizeStringArray(property?.markets);
  const lat = toNumberOrNull(property?.lat);
  const lng = toNumberOrNull(property?.lng);
  const geocodeStatusFallback = (Number.isFinite(lat) && Number.isFinite(lng)) ? 'resolved' : 'pending';
  return {
    id: String(property?.id || '').trim(),
    owner_id: userId,
    type: String(property?.type || 'SFR').trim() || 'SFR',
    address: String(property?.address || '').trim() || null,
    city: String(property?.city || '').trim() || null,
    state: String(property?.state || '').trim() || (markets[0] ? String(markets[0]).trim() : null),
    zip: String(property?.zip || '').trim() || null,
    price: toNumberOrZero(property?.price),
    beds: toIntegerOrZero(property?.beds),
    baths: toIntegerOrZero(property?.baths),
    sqft: String(property?.sqft || '').trim() || null,
    improvement: String(property?.improvement || '').trim() || null,
    lot: String(property?.lot || '').trim() || null,
    deal_tag: String(property?.dealTag || '').trim() || null,
    objective: String(property?.objective || '').trim() || null,
    rehab: toNumberOrZero(property?.rehab),
    cap_rate: toNumberOrNull(property?.capRate),
    description: String(property?.description || '').trim() || null,
    markets,
    is_active: isTruthyFlag(property?.isActive, true),
    deal_closed: isTruthyFlag(property?.dealClosed, false),
    pending_deal: isTruthyFlag(property?.pendingDeal, false),
    pending_deal_started_at: toIsoDateOrNull(property?.pendingDealStartedAt),
    pending_deal_expires_at: toIsoDateOrNull(property?.pendingDealExpiresAt),
    publish_to_showcase: isTruthyFlag(property?.publishToShowcase, true),
    include_in_preview: isTruthyFlag(property?.includeInPreview, true),
    source: String(property?.source || 'portfolio').trim() || 'portfolio',
    owner_account_type: String(property?.ownerAccountType || '').trim() || null,
    primary_profile: String(property?.primaryProfile || 'personal').trim() || 'personal',
    video: isInlineMediaUrl(property?.video) ? null : (String(property?.video || '').trim() || null),
    lat,
    lng,
    geocode_status: normalizeGeocodeStatus(property?.geocodeStatus, geocodeStatusFallback),
    geocode_source: String(property?.geocodeSource || '').trim() || null,
    geocode_confidence: toNumberOrNull(property?.geocodeConfidence),
    geocode_input: String(property?.geocodeInput || '').trim() || null,
    geocoded_at: toIsoDateOrNull(property?.geocodedAt),
  };
};

// Sempre normaliza imagens apenas aqui
const mapDbPropertyToLocal = (row, images = [], options = {}) => ({
  id: row.id,
  portfolioId: row.id,
  ownerId: options.ownerId || LOCAL_OWNER_ID,
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
  isActive: isTruthyFlag(row.is_active, true),
  dealClosed: isTruthyFlag(row.deal_closed, false),
  pendingDeal: isTruthyFlag(row.pending_deal, false),
  pendingDealStartedAt: row.pending_deal_started_at || null,
  pendingDealExpiresAt: row.pending_deal_expires_at || null,
  dealUnavailable: isTruthyFlag(row.is_active, true) === false,
  publishToShowcase: isTruthyFlag(row.publish_to_showcase, true),
  includeInPreview: isTruthyFlag(row.include_in_preview, true),
  source: 'supabase',
  ownerAccountType: row.owner_account_type || '',
  primaryProfile: options.primaryProfile || row.primary_profile || 'personal',
  ownerPreview: options.ownerPreview || null,
  images: normalizePortfolioImages(images),
  video: row.video || '',
  lat: toNumberOrNull(row.lat),
  lng: toNumberOrNull(row.lng),
  geocodeStatus: normalizeGeocodeStatus(row.geocode_status, (Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))) ? 'resolved' : 'pending'),
  geocodeSource: row.geocode_source || '',
  geocodeConfidence: toNumberOrNull(row.geocode_confidence),
  geocodeInput: row.geocode_input || '',
  geocodedAt: row.geocoded_at || null,
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const mapLocalServiceToDb = (service, userId) => ({
  id: String(service?.id || '').trim(),
  owner_id: userId,
  title: String(service?.title || '').trim() || 'Untitled Service',
  category: String(service?.category || '').trim() || null,
  description: String(service?.description || '').trim() || null,
  price: toNumberOrNull(service?.price),
  media_images: normalizePersistableMediaUrls(getLocalServiceMediaImages(service)),
  publish_to_connections: isTruthyFlag(service?.publishToConnections, true),
  markets: normalizeStringArray(service?.markets),
  primary_profile: String(service?.primaryProfile || 'personal').trim() || 'personal',
});

const getLocalServiceMediaImages = (service) => normalizePortfolioImages([
  ...(Array.isArray(service?.media?.images) ? service.media.images : []),
  ...(Array.isArray(service?.media?.archivedImages) ? service.media.archivedImages : []),
]);

const mapDbServiceToLocal = (row, options = {}) => ({
  id: row.id,
  ownerId: options.ownerId || LOCAL_OWNER_ID,
  title: row.title || '',
  category: row.category || '',
  description: row.description || '',
  price: row.price ?? null,
  media: { images: normalizePortfolioImages(row.media_images), archivedImages: [] },
  dealUnavailable: false,
  publishToConnections: isTruthyFlag(row.publish_to_connections, true),
  includeInPreview: true,
  dealClosed: false,
  markets: normalizeStringArray(row.markets),
  primaryProfile: row.primary_profile || 'personal',
  ownerPreview: options.ownerPreview || null,
  source: 'supabase',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const pickFirstString = (...values) => {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) return normalized;
  }
  return '';
};

const getEmailHandle = (email = '') => {
  const handle = String(email || '').split('@')[0] || '';
  return handle.trim();
};

const getProfilePayloadScope = (profilePayload, scope) => {
  const payload = profilePayload && typeof profilePayload === 'object' ? profilePayload : {};
  const normalizedScope = normalizeProfileScope(scope);
  const resolved = payload.resolved && typeof payload.resolved === 'object' ? payload.resolved : {};
  const profiles = payload.profiles && typeof payload.profiles === 'object' ? payload.profiles : {};
  if (resolved[normalizedScope] && typeof resolved[normalizedScope] === 'object') return resolved[normalizedScope];
  if (profiles[normalizedScope] && typeof profiles[normalizedScope] === 'object') return profiles[normalizedScope];
  return {};
};

const inferDbPropertyProfileScope = (row) => {
  const ownerAccountType = String(row?.owner_account_type || row?.ownerAccountType || '').trim().toLowerCase();
  const dealTag = String(row?.deal_tag || row?.dealTag || '').trim().toUpperCase();
  const source = String(row?.source || '').trim().toLowerCase();
  if (ownerAccountType === 'fsbo_owner' || dealTag === 'FSBO' || source === 'fsbo') return 'fsbo';
  return normalizeProfileScope(row?.primary_profile || row?.primaryProfile || 'personal');
};

const buildDbOwnerPreview = ({ ownerId, scope, userRow, personalRow, professionalRow }) => {
  const id = String(ownerId || '').trim();
  if (!id) return null;

  const normalizedScope = normalizeProfileScope(scope || 'personal');
  const profilePayload = professionalRow?.profile_payload && typeof professionalRow.profile_payload === 'object'
    ? professionalRow.profile_payload
    : null;
  const payloadScope = getProfilePayloadScope(profilePayload, normalizedScope);
  const extracted = profilePayload ? extractScopedProfileLegacy(profilePayload) : {};
  const payloadPersonal = normalizedScope === 'fsbo'
    ? (extracted.fsboProfileFromPayload || extracted.personalProfileFromPayload || {})
    : (extracted.personalProfileFromPayload || {});
  const payloadProfessional = extracted.professionalProfileFromPayload || {};
  const payloadProfile = normalizedScope === 'professional' ? payloadProfessional : payloadPersonal;
  const isProfessional = normalizedScope === 'professional';
  const userEmail = pickFirstString(userRow?.email);

  const name = pickFirstString(
    payloadScope?.name,
    payloadProfile?.fullName,
    payloadProfile?.fullNameB,
    isProfessional ? professionalRow?.full_name : '',
    personalRow?.full_name,
    userRow?.full_name,
    getEmailHandle(userEmail)
  );

  if (!name) return null;

  const photo = pickFirstString(
    payloadScope?.photo,
    payloadProfile?.photo,
    payloadProfile?.photoB,
    payloadProfile?.photoBUrl,
    isProfessional ? professionalRow?.photo_b_url : '',
    personalRow?.photo_url
  );

  const type = pickFirstString(
    payloadScope?.pitch,
    payloadScope?.categoryLabelFallback,
    payloadProfile?.pitchB,
    payloadProfile?.pitch,
    professionalRow?.subcategory,
    professionalRow?.category,
    professionalRow?.primary_category_b,
    professionalRow?.primary_category,
    userRow?.account_type,
    normalizedScope === 'fsbo' ? 'FSBO' : ''
  );

  const badge = pickFirstString(
    payloadScope?.badge,
    normalizedScope === 'professional' ? 'Business' : '',
    normalizedScope === 'fsbo' ? 'FSBO' : ''
  );

  const loc = pickFirstString(payloadScope?.loc, payloadProfile?.loc, payloadProfile?.locB);
  const email = pickFirstString(payloadScope?.email, payloadProfile?.email, payloadProfile?.emailB, userEmail);
  const primaryPhone = pickFirstString(payloadScope?.primaryPhone, payloadProfile?.primaryPhone, payloadProfile?.primaryPhoneB, userRow?.phone);

  return {
    id,
    ownerId: id,
    name,
    type,
    badge,
    loc,
    photo,
    cat: pickFirstString(professionalRow?.primary_category_b, professionalRow?.primary_category, professionalRow?.category),
    desc: pickFirstString(payloadScope?.pitch, payloadProfile?.pitchB, payloadProfile?.pitch, professionalRow?.pitch),
    email,
    primaryPhone,
    contactMethods: Array.isArray(payloadScope?.contactMethods) ? payloadScope.contactMethods : [],
    primaryProfile: normalizedScope,
    verified: payloadScope?.verified === true || payloadProfile?.verified === true,
  };
};

const sanitizeLegacyName = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized === 'Alex Johnson' || normalized === 'New User' || normalized === 'User') return '';
  return normalized;
};

const FEED_ACTION_SYNC_DEBOUNCE_MS = 700;
const FEED_ACTION_MAX_ROWS = 240;

const stripFeedActionValue = (value) => {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:')) return '';
    return value.length > 420 ? `${value.slice(0, 420)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 8).map(stripFeedActionValue).filter((item) => item !== '');
  if (typeof value === 'object') {
    const next = {};
    Object.entries(value).forEach(([key, raw]) => {
      const lower = key.toLowerCase();
      if (lower.includes('base64') || lower.includes('file') || lower.includes('blob')) return;
      if (lower.includes('archived')) return;
      const cleaned = stripFeedActionValue(raw);
      if (cleaned == null || cleaned === '') return;
      next[key] = cleaned;
    });
    return next;
  }
  return null;
};

const buildFeedActionPayload = (item) => {
  if (!item || typeof item !== 'object') return {};
  const allowedKeys = [
    'id', 'ownerId', 'unlockOwnerId', 'name', 'title', 'category', 'sub', 'role', 'badge',
    'avatar', 'photo', 'photoUrl', 'image', 'img', 'address', 'street', 'city', 'state',
    'zip', 'zipcode', 'price', 'type', 'beds', 'baths', 'cap', 'portfolioCount',
    'portfolioSize', 'createdAt', 'source', 'primaryProfile', 'contactMethods',
    'phone', 'primaryPhone', 'secondaryPhone', 'tertiaryPhone', 'whatsapp', 'email',
  ];
  const compact = {};
  allowedKeys.forEach((key) => {
    if (item[key] != null) compact[key] = item[key];
  });
  return stripFeedActionValue(compact) || {};
};

const makeFeedActionRows = ({ matched = [], interested = [], unlocked = [] }) => {
  const rows = [];
  const pushRow = (action, entityType, entityId, payload = {}) => {
    const id = String(entityId || '').trim();
    if (!id) return;
    rows.push({
      action,
      entity_type: entityType,
      entity_id: id,
      payload,
    });
  };

  (Array.isArray(matched) ? matched : []).slice(-FEED_ACTION_MAX_ROWS).forEach((item) => {
    pushRow('matched', 'person', item?.ownerId || item?.unlockOwnerId || item?.sellerId || item?.contactId || item?.id, buildFeedActionPayload(item));
  });
  (Array.isArray(interested) ? interested : []).slice(-FEED_ACTION_MAX_ROWS).forEach((item) => {
    pushRow('interested', 'property', item?.id, buildFeedActionPayload(item));
  });
  (Array.isArray(unlocked) ? unlocked : []).slice(-FEED_ACTION_MAX_ROWS).forEach((id) => {
    pushRow('unlocked', 'person', id, { id: String(id) });
  });

  return rows;
};

const getFeedActionMergeKey = (item) => {
  if (!item || typeof item !== 'object') return '';
  const hasContactIdentity = Boolean(item.name || item.cat || item.role || item.primaryProfile || item.contactMethods || item.phone || item.primaryPhone || item.email);
  const hasPropertyIdentity = Boolean(item.propertyId || item.property_id || item.portfolioId || ((item.address || item.street) && (item.price != null || !hasContactIdentity)));
  if (hasPropertyIdentity) {
    return `property:${String(item.id || item.propertyId || item.property_id || item.portfolioId || '').trim()}`;
  }
  return `person:${String(item.ownerId || item.unlockOwnerId || item.sellerId || item.contactId || item.id || '').trim()}`;
};

const scoreContactPayloadRichness = (item) => {
  if (!item || typeof item !== 'object') return 0;
  const keys = [
    'name', 'title', 'type', 'category', 'sub', 'badge', 'photo', 'avatar',
    'email', 'phone', 'primaryPhone', 'secondaryPhone', 'whatsapp', 'loc',
    'address', 'city', 'state', 'zip',
  ];
  return keys.reduce((score, key) => (
    String(item?.[key] || '').trim() ? score + 1 : score
  ), 0);
};

const mergeFeedActionItems = (prev, incoming) => {
  const next = Array.isArray(prev) ? [...prev] : [];
  const indexById = new Map(next.map((item, index) => [getFeedActionMergeKey(item), index]).filter(([key]) => key && !key.endsWith(':')));
  (Array.isArray(incoming) ? incoming : []).forEach((item) => {
    const id = getFeedActionMergeKey(item);
    if (!id) return;
    if (!indexById.has(id)) {
      indexById.set(id, next.length);
      next.push(item);
      return;
    }
    const existingIndex = indexById.get(id);
    const existing = next[existingIndex];
    if (scoreContactPayloadRichness(item) >= scoreContactPayloadRichness(existing)) {
      next[existingIndex] = { ...(existing || {}), ...(item || {}) };
    }
  });
  return next;
};

const MobilePortraitGuard = ({ copy }) => (
  <div
    role="dialog"
    aria-modal="true"
    aria-live="polite"
    aria-label={copy?.title || 'Portrait mode required'}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 2147483000,
      display: 'grid',
      placeItems: 'center',
      padding: 'max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))',
      background: 'radial-gradient(circle at 50% 24%, rgba(53,202,201,0.24), transparent 34%), rgba(7, 13, 12, 0.96)',
      color: '#f8fffd',
      textAlign: 'center',
      boxSizing: 'border-box',
    }}
  >
    <div style={{ width: 'min(88vw, 420px)', border: '1px solid rgba(53,202,201,0.42)', borderRadius: 24, padding: '24px 22px', background: 'rgba(12, 22, 20, 0.9)', boxShadow: '0 26px 80px rgba(0,0,0,0.42)' }}>
      <img src={loaderMark} alt="DealSifter" style={{ width: 62, height: 62, objectFit: 'contain', marginBottom: 14, filter: 'drop-shadow(0 0 18px rgba(53,202,201,0.38))' }} />
      <div style={{ fontSize: 22, lineHeight: 1.08, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 9 }}>
        {copy?.title || 'Rotate your phone'}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(232, 249, 246, 0.82)', fontWeight: 650, marginBottom: 18 }}>
        {copy?.body || 'DealSifter mobile is optimized for portrait mode. Turn your phone upright to continue.'}
      </div>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, border: '1px solid rgba(53,202,201,0.54)', background: 'rgba(53,202,201,0.12)', color: '#6ff4ec', borderRadius: 999, padding: '9px 14px', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>↻</span>
        {copy?.action || 'Portrait mode'}
      </div>
    </div>
  </div>
);

export default function App() {
  const blockMobileLandscape = useMediaQuery('(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 520px)');
  const profileSyncStateRef = useRef({ userId: null, loaded: false, hydrating: false, personalLoadedFromRemote: false, professionalLoadedFromRemote: false });
  const [profileSyncSnapshot, setProfileSyncSnapshot] = useState({ userId: null, loaded: false, hydrating: false, personalLoadedFromRemote: false, professionalLoadedFromRemote: false });
  const [profileHydrationAttempts, setProfileHydrationAttempts] = useState(0);
  const profileHydrationRetryRef = useRef({ timer: null, attempts: 0 });
  const profileHydrationInputRef = useRef({ accountType: 'professional', userCategory: '' });
  const {
    portfolioSyncStateRef,
    portfolioHydrationRetryRef,
    isHydratingPortfolio,
    setIsHydratingPortfolio,
    portfolioHydrationCycle,
    refreshPortfolioHydration,
    resetPortfolioSync,
  } = usePortfolioSync();
  const [portfolioSyncSnapshot, setPortfolioSyncSnapshot] = useState({ userId: null, loaded: false, hydrating: false, servicesLoadedFromRemote: false, propertiesLoadedFromRemote: false, propertyImagesLoadedFromRemote: false });
  const [portfolioHydrationAttempts, setPortfolioHydrationAttempts] = useState(0);
  const scheduleProfileSyncSnapshot = useCallback(() => {
    const next = { ...(profileSyncStateRef.current || {}) };
    window.setTimeout(() => setProfileSyncSnapshot(next), 0);
  }, []);
  const schedulePortfolioSyncSnapshot = useCallback(() => {
    const next = { ...(portfolioSyncStateRef.current || {}) };
    window.setTimeout(() => setPortfolioSyncSnapshot(next), 0);
  }, [portfolioSyncStateRef]);
  const authRedirectUrl = useMemo(() => {
    const envUrl = String(import.meta.env.VITE_APP_URL || '').trim();
    if (envUrl) return envUrl;
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return 'https://dealsiftermatch.vercel.app';
  }, []);
  const realtimeRefreshDebounceRef = useRef({ profiles: null, portfolio: null });
  const lastRealtimeRefreshAtRef = useRef({ profiles: 0, portfolio: 0 });
  const lastLocalSupabaseWriteAtRef = useRef(0);
  const prevUserIdRef = useRef(null); // tracks userId across renders to detect user change
  const feedActionHydratingRef = useRef(false);
  const feedActionLoadedUserRef = useRef(null);
  const feedActionSyncTimerRef = useRef(null);
  const feedActionLastSignatureRef = useRef('');
  const hydrationBlockShownUserRef = useRef(null);
  const [isHydratingProfiles, setIsHydratingProfiles] = useState(false);
  const [showHydrationBlocking, setShowHydrationBlocking] = useState(false);
  const [profileHydrationCycle, setProfileHydrationCycle] = useState(0);

  useEffect(() => () => {
    if (profileHydrationRetryRef.current.timer) {
      clearTimeout(profileHydrationRetryRef.current.timer);
      profileHydrationRetryRef.current.timer = null;
    }
    if (portfolioHydrationRetryRef.current.timer) {
      clearTimeout(portfolioHydrationRetryRef.current.timer);
      portfolioHydrationRetryRef.current.timer = null;
    }
    if (realtimeRefreshDebounceRef.current.profiles) {
      clearTimeout(realtimeRefreshDebounceRef.current.profiles);
      realtimeRefreshDebounceRef.current.profiles = null;
    }
    if (realtimeRefreshDebounceRef.current.portfolio) {
      clearTimeout(realtimeRefreshDebounceRef.current.portfolio);
      realtimeRefreshDebounceRef.current.portfolio = null;
    }
    if (feedActionSyncTimerRef.current) {
      clearTimeout(feedActionSyncTimerRef.current);
      feedActionSyncTimerRef.current = null;
    }
  }, [portfolioHydrationRetryRef]);

  const [isAdminAuthProcessing, setIsAdminAuthProcessing] = useState(false);
  const [isConsentProcessing, setIsConsentProcessing] = useState(false);
  const [isAccountProcessing, setIsAccountProcessing] = useState(false);
  const [page, _setPage] = useState(() => {
    try {
      const raw = localStorage.getItem('authSession');
      if (raw && JSON.parse(raw)) {
        const last = localStorage.getItem('ds_last_page');
        const safe = ['dashboard', 'matches', 'mapview', 'onboarding', 'settings'];
        return (last && safe.includes(last)) ? last : 'dashboard';
      }
    } catch { /* ignore */ }
    return 'landing';
  });
  const [mobileBottomNavCollapsed, setMobileBottomNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ds_mobile_bottom_nav_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [prevPage, setPrevPage] = useState('landing');
  const [nuggets, setNuggets] = useState(() => {
    if (isSupabaseConfigured) return 0;
    try {
      const raw = localStorage.getItem('ds_nuggets');
      const parsed = raw ? Number(raw) : 5;
      return Number.isFinite(parsed) ? parsed : 5;
    } catch {
      return 5;
    }
  });
  const [modal, setModal] = useState(null);
  const [authModalTab, setAuthModalTab] = useState('signup');
  const openAuthModal = useCallback((tab = 'signup') => {
    setAuthModalTab(tab === 'login' ? 'login' : 'signup');
    setModal('auth');
  }, []);
  const [unlockTarget, setUnlockTarget] = useState(null);
  const [unlockQuote, setUnlockQuote] = useState(null);
  const unlockQuoteRequestRef = useRef(0);
  const [settingsInitialTab, setSettingsInitialTab] = useState('profile');
  const [onboardingInitialTab, setOnboardingInitialTab] = useState('personal');
  const [authSession, setAuthSession] = useState(() => {
    try {
      const raw = localStorage.getItem('authSession');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isAuthCallbackSettling, setIsAuthCallbackSettling] = useState(() => {
    if (!isSupabaseConfigured || !supabase || typeof window === 'undefined') return false;
    try {
      const search = new URLSearchParams(window.location.search || '');
      const hash = String(window.location.hash || '');
      return search.has('code') || search.has('error') || hash.includes('access_token=');
    } catch {
      return false;
    }
  });
  const authBootstrappingRef = useRef(Boolean(isSupabaseConfigured && supabase));
  const [sessionVersion, setSessionVersion] = useState(0);
  const [systemAccount, setSystemAccount] = useState(() => {
    if (isSupabaseConfigured) {
      return { fullName: '', email: '', phone: '', phoneCountryCode: '+1', marketAreas: '', accountType: 'individual', paymentSetupComplete: false };
    }
    try {
      const raw = localStorage.getItem('systemAccount');
      return raw
        ? JSON.parse(raw)
        : { fullName: '', email: '', phone: '', paymentSetupComplete: false };
    } catch {
      return { fullName: '', email: '', phone: '', paymentSetupComplete: false };
    }
  });
  const [userPreferences, setUserPreferences] = useState(() => {
    if (isSupabaseConfigured) return normalizeUserPreferences(null);
    try {
      const raw = localStorage.getItem(USER_PREFERENCES_KEY);
      return normalizeUserPreferences(raw ? JSON.parse(raw) : null);
    } catch {
      return normalizeUserPreferences(null);
    }
  });
  const handleChangeUserPreferences = useCallback((updater) => {
    setUserPreferences((prev) => {
      const base = normalizeUserPreferences(prev);
      const nextRaw = typeof updater === 'function' ? updater(base) : updater;
      return normalizeUserPreferences(nextRaw);
    });
  }, []);
  const [isAdmin, setIsAdmin] = useState(false);
  const handleUserLogoutRef = useRef(null);
  void sessionVersion;

  useEffect(() => {
    try {
      localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(normalizeUserPreferences(userPreferences)));
    } catch { /* no-op */ }
  }, [userPreferences]);

  useEffect(() => {
    if (!authSession?.id) return;
    try {
      const now = Date.now();
      const currentId = localStorage.getItem(SECURITY_ACTIVE_SESSION_KEY) || `sess-${now}-${Math.random().toString(16).slice(2, 7)}`;
      localStorage.setItem(SECURITY_ACTIVE_SESSION_KEY, currentId);
      const all = JSON.parse(localStorage.getItem(SECURITY_SESSIONS_KEY) || '[]');
      const rows = Array.isArray(all) ? all : [];
      const nextRows = rows
        .filter((row) => row && String(row.userId || '') === String(authSession.id))
        .map((row) => ({ ...row, current: String(row.id) === String(currentId) }));
      const hasCurrent = nextRows.some((row) => String(row.id) === String(currentId));
      if (!hasCurrent) {
        nextRows.unshift({
          id: currentId,
          userId: authSession.id,
          email: authSession.email || '',
          createdAt: now,
          lastSeenAt: now,
          current: true,
          device: String(navigator.userAgent || 'Unknown device').slice(0, 120),
        });
        appendSecurityAuditEvent({ type: 'session', status: 'created', message: 'New active session started.' });
      }
      localStorage.setItem(SECURITY_SESSIONS_KEY, JSON.stringify(nextRows.slice(0, 20)));
      window.setTimeout(() => setSessionVersion((v) => v + 1), 0);
    } catch { /* no-op */ }
  }, [authSession?.id, authSession?.email]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authSession?.userId) return undefined;
    let cancelled = false;
    const sendHeartbeat = async () => {
      if (cancelled) return;
      try {
        await supabase.rpc('track_user_heartbeat', { p_page: String(page || 'app').slice(0, 48) });
      } catch {
        // Analytics must never interrupt app navigation.
      }
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authSession?.userId, page]);

  useEffect(() => {
    if (!authSession?.id) return undefined;
    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      try { localStorage.setItem(APP_LAST_ACTIVITY_KEY, String(now)); } catch { /* no-op */ }
      try {
        const currentId = localStorage.getItem(SECURITY_ACTIVE_SESSION_KEY);
        if (!currentId) return;
        const all = JSON.parse(localStorage.getItem(SECURITY_SESSIONS_KEY) || '[]');
        const rows = Array.isArray(all) ? all : [];
        let changed = false;
        const next = rows.map((row) => {
          if (String(row?.id || '') !== String(currentId)) return row;
          changed = true;
          return { ...row, lastSeenAt: now };
        });
        if (changed) localStorage.setItem(SECURITY_SESSIONS_KEY, JSON.stringify(next));
      } catch { /* no-op */ }
    };
    const getLastActivityAt = () => {
      try {
        const stored = Number(localStorage.getItem(APP_LAST_ACTIVITY_KEY) || '0');
        if (Number.isFinite(stored) && stored > 0) return stored;
      } catch { /* no-op */ }
      return Number(lastActivityRef.current || Date.now());
    };
    const checkIdleTimeout = () => {
      const inactiveMs = Date.now() - getLastActivityAt();
      if (inactiveMs > APP_IDLE_SIGNOUT_MS) {
        appendSecurityAuditEvent({ type: 'session', status: 'timeout', message: 'Session ended after 1 hour without activity.' });
        handleUserLogoutRef.current?.();
      }
    };
    updateActivity();
    const events = ['pointerdown', 'keydown', 'mousemove', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') checkIdleTimeout();
    };
    window.addEventListener('focus', checkIdleTimeout);
    document.addEventListener('visibilitychange', visibilityHandler);
    const timer = window.setInterval(checkIdleTimeout, 60 * 1000);
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
      window.removeEventListener('focus', checkIdleTimeout);
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.clearInterval(timer);
    };
  }, [authSession?.id]);

  // Toast notification system
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [showInstallAppButton, setShowInstallAppButton] = useState(false);
  const addToast = useCallback(({ type = 'info', title, message, duration = 4500 }) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message, duration }]);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !authSession?.userId) return undefined;

    let cancelled = false;
    const token = getAppSessionToken(authSession.userId);
    const pageLabel = String(page || 'app').slice(0, 64);

    const endReplacedSession = async () => {
      if (cancelled) return;
      appendSecurityAuditEvent({ type: 'session', status: 'replaced', message: 'Session replaced by another device or browser tab.' });
      addToast({
        type: 'warning',
        title: 'Session ended',
        message: 'This account was opened in another device or tab. Please sign in again to continue here.',
        duration: 8000,
      });
      try { await supabase.auth.signOut(); } catch { /* no-op */ }
      setAuthSession(null);
      safeSessionRemove(APP_SESSION_TOKEN_KEY);
      safeSessionRemove(`${APP_SESSION_TOKEN_KEY}:${authSession.userId}`);
      setModal(null);
      _setPage('landing');
      try { localStorage.removeItem('ds_last_page'); } catch { /* no-op */ }
    };

    const register = async () => {
      try {
        const { data, error } = await supabase.rpc('ds_register_app_session', {
          p_session_token: token,
          p_device_label: getDeviceLabel(),
          p_page: pageLabel,
        });
        if (error) {
          if (isMissingFunctionError(error, 'ds_register_app_session')) return;
          throw error;
        }
        if (data && data.ok === false && data.reason === 'session_replaced') {
          await endReplacedSession();
        }
      } catch (error) {
        safeLogError('App session registration failed.', error);
      }
    };

    const touch = async () => {
      if (cancelled) return;
      try {
        const { data, error } = await supabase.rpc('ds_touch_app_session', {
          p_session_token: token,
          p_page: String(page || 'app').slice(0, 64),
        });
        if (error) {
          if (isMissingFunctionError(error, 'ds_touch_app_session')) return;
          throw error;
        }
        if (data && data.ok === false && data.reason === 'session_replaced') {
          await endReplacedSession();
        }
      } catch (error) {
        safeLogError('App session heartbeat failed.', error);
      }
    };

    register();
    const timer = window.setInterval(touch, 30000);
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') touch();
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [addToast, authSession?.userId, page]);

  const handleAuthenticatedNavigation = useCallback((_session, options = {}) => {
    setModal(null);
    if (options?.closeOnly) return;
    _setPage('dashboard');
    try { localStorage.setItem('ds_last_page', 'dashboard'); } catch { /* no-op */ }
  }, []);

  const handleSessionRestored = useCallback(() => {
    setModal(null);
    _setPage((prev) => prev === 'landing' || !prev ? 'dashboard' : prev);
  }, []);

  const {
    isAuthBootstrapping,
    isAuthProcessing,
    isForgotPasswordProcessing,
    handleAuthSubmit,
    handleForgotPassword,
    refreshAuthSessionSnapshot,
  } = useAuthSession({
    authSession,
    setAuthSession,
    setSystemAccount,
    setIsAdmin,
    authRedirectUrl,
    addToast,
    appendSecurityAuditEvent,
    consumeRateLimit,
    safeLogError,
    onAuthenticated: handleAuthenticatedNavigation,
    onSessionRestored: handleSessionRestored,
  });

  useEffect(() => {
    authBootstrappingRef.current = Boolean(isAuthBootstrapping);
  }, [isAuthBootstrapping]);

  useEffect(() => {
    if (!isAuthCallbackSettling) return undefined;

    const cleanupAuthCallbackUrl = () => {
      if (typeof window === 'undefined') return;
      try {
        const url = new URL(window.location.href);
        let changed = false;
        ['code', 'error', 'error_code', 'error_description', 'state'].forEach((key) => {
          if (url.searchParams.has(key)) {
            url.searchParams.delete(key);
            changed = true;
          }
        });
        if (String(url.hash || '').includes('access_token=')) {
          url.hash = '';
          changed = true;
        }
        if (changed) {
          const next = `${url.pathname}${url.search}${url.hash}`;
          window.history.replaceState(window.history.state || {}, document.title, next || '/');
        }
      } catch { /* no-op */ }
    };

    if (authSession?.userId) {
      cleanupAuthCallbackUrl();
      setIsAuthCallbackSettling(false);
      return undefined;
    }

    if (isAuthBootstrapping) return undefined;

    // Give Supabase one paint cycle after getSession() to emit the OAuth
    // SIGNED_IN event. Without this, the app briefly renders Landing before
    // the restored Google session is applied.
    const timer = window.setTimeout(() => {
      cleanupAuthCallbackUrl();
      setIsAuthCallbackSettling(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [authSession?.userId, isAuthBootstrapping, isAuthCallbackSettling]);

  useEffect(() => {
    const protectedPages = new Set(['dashboard', 'matches', 'mapview', 'onboarding', 'settings']);
    if (isAuthBootstrapping || authSession || !protectedPages.has(page)) return;
    const timer = window.setTimeout(() => openAuthModal('login'), 0);
    return () => window.clearTimeout(timer);
  }, [authSession, isAuthBootstrapping, openAuthModal, page]);

  const markLocalSupabaseWrite = useCallback(() => {
    lastLocalSupabaseWriteAtRef.current = Date.now();
  }, []);

  const {
    profileSaveDebounceRef,
    pendingFlushRef,
    profileSyncStatus,
    beginProfileSync,
    endProfileSync,
    resetProfileSync,
  } = useProfileSync({
    addToast,
    markLocalWrite: markLocalSupabaseWrite,
  });

  useEffect(() => {
    const setViewportHeightVar = () => {
      const vh = (window.visualViewport?.height || window.innerHeight) * 0.01;
      document.documentElement.style.setProperty('--app-vh', `${vh}px`);
    };

    setViewportHeightVar();
    window.addEventListener('resize', setViewportHeightVar);
    window.visualViewport?.addEventListener?.('resize', setViewportHeightVar);

    return () => {
      window.removeEventListener('resize', setViewportHeightVar);
      window.visualViewport?.removeEventListener?.('resize', setViewportHeightVar);
    };
  }, []);

  useEffect(() => {
    const isStandalone = () => {
      try {
        return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
      } catch {
        return false;
      }
    };

    const isIOS = () => {
      const ua = String(window.navigator?.userAgent || '').toLowerCase();
      const iOSDevice = /iphone|ipad|ipod/.test(ua);
      const iPadOS13Plus = /macintosh/.test(ua) && 'ontouchend' in document;
      return iOSDevice || iPadOS13Plus;
    };

    const updateVisibility = (hasDeferredPrompt = Boolean(deferredInstallPrompt)) => {
      setShowInstallAppButton(!isStandalone() && (hasDeferredPrompt || isIOS()));
    };

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
      updateVisibility(true);
    };

    const onAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setShowInstallAppButton(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    updateVisibility();

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [deferredInstallPrompt]);

  const handleInstallApp = useCallback(async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      setDeferredInstallPrompt(null);
      if (choice?.outcome === 'accepted') {
        setShowInstallAppButton(false);
      }
      return;
    }

    addToast({
      type: 'info',
      title: 'Adicionar à Tela',
      message: 'No Safari: Compartilhar > Adicionar à Tela de Início.',
      duration: 6500,
    });
  }, [deferredInstallPrompt, addToast]);
  const dismissToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // LGPD consent state
  const [lgpdConsent, setLgpdConsent] = useState(() => {
    return readLgpdConsent();
  });
  const [lgpdConsentChecked, setLgpdConsentChecked] = useState(false);

  // Cookie consent state (landing page banner)
  const [cookieConsent, setCookieConsent] = useState(() => {
    return readCookieConsent();
  });
  const handleCookieAccept = (choice = 'accepted') => {
    setCookieConsent(true);
    writeCookieConsent(choice);
  };

  const handleLgpdAccept = async () => {
    setIsConsentProcessing(true);
    try {
      // Record consent server-side FIRST as proof (Art. 8) before updating local state
      const anonId = `anon-${Date.now()}`;
      if (isSupabaseConfigured && supabase) {
        try {
          const userId = authSession?.userId || null;
          await supabase.from('consent_records').insert({
            user_id: userId,
            anonymous_id: userId ? null : anonId,
            consent_type: 'data_processing',
            version: LGPD_CONSENT_VERSION,
            user_agent: navigator.userAgent?.slice(0, 200) || null,
          });
          // Persist anonymous_id so we can link it after login
          if (!userId) {
            try { localStorage.setItem('ds_lgpd_consent_anon_id', anonId); } catch { /* no-op */ }
          }
        } catch { /* best-effort */ }
      }
      // Update local state only after server-side record attempt
      setLgpdConsent(true);
      setLgpdConsentChecked(true);
      setModal(null);
      writeLgpdConsent(authSession?.userId || '');
      if (authSession && ['landing', 'terms', 'privacy'].includes(page)) {
        _setPage('dashboard');
        try { localStorage.setItem('ds_last_page', 'dashboard'); } catch { /* no-op */ }
      }
    } finally {
      setIsConsentProcessing(false);
    }
  };

  // After login, link any anonymous consent record to the authenticated user_id
  const consentLinkedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const userId = authSession?.userId || '';
    consentLinkedRef.current = false;
    if (!userId) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        setLgpdConsent(readLgpdConsent());
        setLgpdConsentChecked(true);
      }, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const localAccepted = readLgpdConsent(userId);
      if (localAccepted) setLgpdConsent(true);
      setLgpdConsentChecked(false);

      if (!isSupabaseConfigured || !supabase) {
        setLgpdConsent(localAccepted);
        setLgpdConsentChecked(true);
        return;
      }

      (async () => {
        try {
          const { data, error } = await supabase
            .from('consent_records')
            .select('id, accepted_at')
            .eq('user_id', userId)
            .eq('consent_type', 'data_processing')
            .is('revoked_at', null)
            .order('accepted_at', { ascending: false })
            .limit(1);
          if (error) throw error;
          if (cancelled) return;

          const hasRemoteConsent = Array.isArray(data) && data.length > 0;
          if (hasRemoteConsent) {
            writeLgpdConsent(userId);
            setLgpdConsent(true);
            return;
          }

          if (localAccepted) {
            try {
              await supabase.from('consent_records').insert({
                user_id: userId,
                anonymous_id: null,
                consent_type: 'data_processing',
                version: LGPD_CONSENT_VERSION,
                user_agent: navigator.userAgent?.slice(0, 200) || null,
              });
              writeLgpdConsent(userId);
              setLgpdConsent(true);
              return;
            } catch (insertError) {
              safeLogError('Failed to backfill local consent record.', insertError);
            }
          }

          setLgpdConsent(false);
        } catch (error) {
          safeLogError('Failed to verify data-processing consent.', error);
          setLgpdConsent(localAccepted);
        } finally {
          if (!cancelled) setLgpdConsentChecked(true);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authSession?.userId]);

  useEffect(() => {
    if (!authSession?.userId || consentLinkedRef.current) return;
    if (!isSupabaseConfigured || !supabase || !lgpdConsent) return;
    consentLinkedRef.current = true;
    (async () => {
      try {
        // Check if user already has a linked consent record
        const { data: existing } = await supabase
          .from('consent_records')
          .select('id')
          .eq('user_id', authSession.userId)
          .eq('consent_type', 'data_processing')
          .limit(1);
        if (existing?.length) return; // already linked
        // Try to find and claim the anonymous record using the stored anon_id
        const storedAnonId = (() => { try { return localStorage.getItem('ds_lgpd_consent_anon_id'); } catch { return null; } })();
        if (!storedAnonId) return;
        const { data: anon } = await supabase
          .from('consent_records')
          .select('id')
          .is('user_id', null)
          .eq('anonymous_id', storedAnonId)
          .eq('consent_type', 'data_processing')
          .limit(1);
        if (anon?.[0]) {
          await supabase
            .from('consent_records')
            .update({ user_id: authSession.userId, anonymous_id: null })
            .eq('id', anon[0].id);
          try { localStorage.removeItem('ds_lgpd_consent_anon_id'); } catch { /* no-op */ }
        }
      } catch { /* best-effort */ }
    })();
  }, [authSession?.userId, lgpdConsent]);

  const handleRevokeConsent = async () => {
    if (!isSupabaseConfigured || !supabase || !authSession?.userId) return;
    setIsConsentProcessing(true);
    try {
      await supabase
        .from('consent_records')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', authSession.userId)
        .eq('consent_type', 'data_processing')
        .is('revoked_at', null);
      setLgpdConsent(false);
      clearLgpdConsent(authSession.userId);
      consentLinkedRef.current = false;
      addToast({ type: 'success', title: 'Consentimento revogado', message: 'Seu consentimento foi revogado. Você será redirecionado.' });
      setPage('landing');
    } catch (err) {
      addToast({ type: 'error', message: String(err?.message || 'Falha ao revogar consentimento.') });
    } finally {
      setIsConsentProcessing(false);
    }
  };

  const [subscription, setSubscription] = useState(() => {
    if (isSupabaseConfigured) {
      return {
        planId: 'free',
        planName: 'Free',
        price: 0,
        status: 'active',
        nextBillingAt: null,
      };
    }
    try {
      const raw = localStorage.getItem('ds_subscription_mock');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object' && parsed.planId) return parsed;
    } catch {
      // no-op
    }
    return {
      planId: 'free',
      planName: 'Free',
      price: 0,
      status: 'active',
      nextBillingAt: null,
    };
  });
  const [matched, setMatched] = useState(() => {
    if (isSupabaseConfigured) return [];
    try {
      const saved = localStorage.getItem('ds_matched');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [interested, setInterested] = useState(() => {
    if (isSupabaseConfigured) return [];
    try {
      const saved = localStorage.getItem('ds_interested');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [unlocked, setUnlocked] = useState(() => {
    if (isSupabaseConfigured) return [];
    try {
      const saved = localStorage.getItem('ds_unlocked');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [propertyUnlocks, setPropertyUnlocks] = useState(() => {
    if (isSupabaseConfigured) return [];
    try {
      const saved = localStorage.getItem('ds_property_unlocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [purchases, setPurchases] = useState(() => {
    if (isSupabaseConfigured) return [];
    try {
      const saved = localStorage.getItem('ds_purchases');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }); // Track {buyerId, sellerId} for bought contacts
  const [convos, setConvos] = useState({});
  const [chatSeenVersion, setChatSeenVersion] = useState(0);
  void chatSeenVersion;
  const [chatFocusTarget, setChatFocusTarget] = useState(null);
  const [chatFocusToken, setChatFocusToken] = useState(0);
  const lastActivityRef = useRef(0);
  const [systemNotifications, setSystemNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('ds_system_notifications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore parsing errors and use default
    }
    return [];
  });
  const [editMode, setEditMode] = useState(false);
  const [accountType, setAccountType] = useState(() => {
    if (isSupabaseConfigured) return 'professional';
    return localStorage.getItem('accountType') || 'professional';
  });

  useEffect(() => {
    profileHydrationInputRef.current.accountType = accountType || 'professional';
  }, [accountType]);

  // Wrapper for setPage that tracks previous page
  const setPage = useCallback((newPage) => {
    const protectedPages = new Set(['dashboard', 'matches', 'mapview', 'onboarding', 'settings']);
    if (!authSession && protectedPages.has(newPage)) {
      if (authBootstrappingRef.current) {
        setPrevPage(page);
        _setPage(newPage);
        return;
      }
      setPrevPage(page);
      openAuthModal('login');
      return;
    }
    setPrevPage(page);
    _setPage(newPage);
    if (typeof newPage === 'string') {
      const persistable = new Set(['dashboard', 'matches', 'mapview', 'onboarding', 'settings']);
      if (persistable.has(newPage)) {
        try { localStorage.setItem('ds_last_page', newPage); } catch { /* no-op */ }
      } else {
        try { localStorage.removeItem('ds_last_page'); } catch { /* no-op */ }
      }
    }
  }, [authSession, openAuthModal, page]);

  const [userProfile, setUserProfile] = useState(() => {
    if (isSupabaseConfigured) {
      return {
        name: '',
        category: '',
        type: '',
        location: '',
        badge: '',
      };
    }
    const saved = localStorage.getItem('userProfile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall back to defaults when stored JSON is invalid.
      }
    }
    return {
      name: '',
      category: '',
      type: '',
      location: '',
      badge: '',
    };
  });

  const [personalProfile, setPersonalProfile] = useState(() => {
    if (isSupabaseConfigured) return DEFAULT_PERSONAL_PROFILE;
    const savedFull = localStorage.getItem('personalProfile_full');
    if (savedFull) {
      try {
        return normalizePersonalProfile(JSON.parse(savedFull));
      } catch {
        // fall through to canonical key
      }
    }
    const saved = localStorage.getItem('personalProfile');
    if (!saved) {
      return DEFAULT_PERSONAL_PROFILE;
    }
    try {
      return normalizePersonalProfile(JSON.parse(saved));
    } catch {
      return DEFAULT_PERSONAL_PROFILE;
    }
  });

  const [professionalProfile, setProfessionalProfile] = useState(() => {
    if (isSupabaseConfigured) return DEFAULT_PROFESSIONAL_PROFILE('');
    const saved = localStorage.getItem('professionalProfile');
    if (!saved) {
      return DEFAULT_PROFESSIONAL_PROFILE(userProfile.category || '');
    }
    try {
      return normalizeProfessionalProfile(JSON.parse(saved), userProfile.category || '');
    } catch {
      return DEFAULT_PROFESSIONAL_PROFILE(userProfile.category || '');
    }
  });

  useEffect(() => {
    profileHydrationInputRef.current.userCategory = String(userProfile?.category || '').trim();
  }, [userProfile]);

  const supabaseUserId = authSession?.userId || null;

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    const email = String(authSession?.email || '').trim();
    const fullName = String(authSession?.fullName || '').trim();
    let cancelled = false;

    const ensurePublicUserRow = async () => {
      try {
        const payload = {
          id: supabaseUserId,
          email: email || `${supabaseUserId}@auth.local`,
        };
        if (fullName) payload.full_name = fullName;

        const { error } = await supabase
          .from('users')
          .upsert(payload, { onConflict: 'id', ignoreDuplicates: false });

        if (error && !cancelled) {
          safeLogError('Supabase public user bootstrap failed.', error);
        }
      } catch (error) {
        if (!cancelled) safeLogError('Supabase public user bootstrap failed.', error);
      }
    };

    ensurePublicUserRow();

    return () => {
      cancelled = true;
    };
  }, [authSession?.email, authSession?.fullName, supabaseUserId]);

  // Keep first-load hydration blocking short; continue syncing in background afterwards.
  useEffect(() => {
    const hydrating = isHydratingProfiles || isHydratingPortfolio;
    if (!supabaseUserId) {
      hydrationBlockShownUserRef.current = null;
      window.setTimeout(() => setShowHydrationBlocking(false), 0);
      return undefined;
    }
    if (!hydrating) {
      window.setTimeout(() => setShowHydrationBlocking(false), 0);
      return undefined;
    }
    if (hydrationBlockShownUserRef.current === supabaseUserId) {
      window.setTimeout(() => setShowHydrationBlocking(false), 0);
      return undefined;
    }
    hydrationBlockShownUserRef.current = supabaseUserId;
    window.setTimeout(() => setShowHydrationBlocking(true), 0);
    const timer = window.setTimeout(() => setShowHydrationBlocking(false), 1600);
    return () => clearTimeout(timer);
  }, [isHydratingProfiles, isHydratingPortfolio, supabaseUserId]);

  const refreshProfileHydration = useCallback(() => {
    setProfileHydrationCycle((prev) => prev + 1);
  }, []);

  const {
    checkoutError,
    checkoutModalIntent,
    checkoutSubmitting,
    pendingCheckoutIntent,
    closeCheckoutModal,
    handleContinuePendingCheckout,
    handleEmbeddedCheckoutComplete,
    handleHostedCheckoutFallback,
    handlePricingCheckoutSelection,
    openCheckoutPrivacy,
    openCheckoutTerms,
    openPricingHub,
    returnToPendingCheckoutFromLegal,
  } = useCheckoutFlow({
    addToast,
    refreshProfileHydration,
    setModal,
    setPage,
    setSettingsInitialTab,
    setSystemAccount,
    supabaseUserId,
  });

  // Keep profileOwnerMap in localStorage so Dashboard/MatchesPage can resolve
  // which ownerId belongs to each profile scope (personal / secondary / fsbo).
  // For a single-user MVP all three scopes share the same Supabase user id.
  useEffect(() => {
    if (!supabaseUserId) return;
    try {
      const ownerMap = {
        personal: supabaseUserId,
        secondary: supabaseUserId,
        fsbo: supabaseUserId,
      };
      localStorage.setItem('profileOwnerMap', JSON.stringify(ownerMap));
    } catch (e) { void e; }
  }, [supabaseUserId]);

  const applyRemoteFeedActions = useCallback((rows = []) => {
    const matchedItems = [];
    const interestedItems = [];
    const unlockedIds = [];

    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
      const entityId = String(row?.entity_id || payload?.id || '').trim();
      if (!entityId) return;

      if (row.action === 'matched') {
        const ownerKey = String(payload?.ownerId || payload?.unlockOwnerId || payload?.sellerId || payload?.contactId || entityId || payload?.id || '').trim();
        const sourceCardId = payload?.id && String(payload.id) !== ownerKey
          ? (payload.sourceCardId || payload.id)
          : payload?.sourceCardId;
        matchedItems.push({
          ...payload,
          id: ownerKey || payload?.id || entityId,
          ownerId: ownerKey || payload?.ownerId || entityId,
          unlockOwnerId: ownerKey || payload?.unlockOwnerId || entityId,
          ...(sourceCardId ? { sourceCardId } : {}),
        });
      } else if (row.action === 'interested') {
        interestedItems.push({ ...payload, id: payload?.id || entityId });
      } else if (row.action === 'unlocked') {
        unlockedIds.push(entityId);
      }
    });

    feedActionHydratingRef.current = true;
    if (matchedItems.length) setMatched((prev) => mergeFeedActionItems(prev, matchedItems));
    if (interestedItems.length) setInterested((prev) => mergeFeedActionItems(prev, interestedItems));
    if (unlockedIds.length) {
      setUnlocked((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        const seen = new Set(next.map((id) => String(id)));
        unlockedIds.forEach((id) => {
          if (!seen.has(String(id))) {
            seen.add(String(id));
            next.push(id);
          }
        });
        return next;
      });
    }
    window.setTimeout(() => { feedActionHydratingRef.current = false; }, 0);
  }, [setInterested, setMatched, setUnlocked]);

  const fetchRemoteFeedActions = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    const { data, error } = await supabase
      .from('user_feed_actions')
      .select('action, entity_type, entity_id, payload, updated_at')
      .eq('user_id', supabaseUserId)
      .order('updated_at', { ascending: false })
      .limit(FEED_ACTION_MAX_ROWS * 3);
    if (error) {
      safeLogError('Failed to hydrate feed actions', error);
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) {
      feedActionHydratingRef.current = true;
      setMatched([]);
      setInterested([]);
      setUnlocked([]);
      try { localStorage.removeItem('ds_matched'); } catch { /* no-op */ }
      try { localStorage.removeItem('ds_interested'); } catch { /* no-op */ }
      try { localStorage.removeItem('ds_unlocked'); } catch { /* no-op */ }
      feedActionLastSignatureRef.current = '[]';
      window.setTimeout(() => { feedActionHydratingRef.current = false; }, 0);
      feedActionLoadedUserRef.current = supabaseUserId;
      return;
    }
    applyRemoteFeedActions(rows);
    feedActionLoadedUserRef.current = supabaseUserId;
  }, [applyRemoteFeedActions, supabaseUserId, setInterested, setMatched, setUnlocked]);

  useEffect(() => {
    feedActionLoadedUserRef.current = null;
    feedActionLastSignatureRef.current = '';
    if (!supabaseUserId) return;
    const timer = window.setTimeout(fetchRemoteFeedActions, 0);
    return () => clearTimeout(timer);
  }, [fetchRemoteFeedActions, supabaseUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return undefined;
    const channel = supabase
      .channel(`user-feed-actions-${supabaseUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_feed_actions',
          filter: `user_id=eq.${supabaseUserId}`,
        },
        (payload) => {
          if (payload?.eventType === 'DELETE') return;
          if (payload?.new) applyRemoteFeedActions([payload.new]);
        }
      )
      .subscribe();

    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') fetchRemoteFeedActions();
    };
    window.addEventListener('focus', fetchRemoteFeedActions);
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      window.removeEventListener('focus', fetchRemoteFeedActions);
      document.removeEventListener('visibilitychange', refreshOnFocus);
      supabase.removeChannel(channel);
    };
  }, [applyRemoteFeedActions, fetchRemoteFeedActions, supabaseUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (feedActionLoadedUserRef.current !== supabaseUserId) return;
    if (feedActionHydratingRef.current) return;

    const rows = makeFeedActionRows({ matched, interested, unlocked });
    if (!rows.length) return;
    const signature = JSON.stringify(rows.map((row) => [
      row.action,
      row.entity_type,
      row.entity_id,
      row.payload?.updatedAt || row.payload?.createdAt || '',
    ]));
    if (signature === feedActionLastSignatureRef.current) return;

    if (feedActionSyncTimerRef.current) clearTimeout(feedActionSyncTimerRef.current);
    feedActionSyncTimerRef.current = window.setTimeout(async () => {
      feedActionLastSignatureRef.current = signature;
      try {
        const { error } = await supabase.rpc('ds_upsert_user_feed_actions', { p_actions: rows });
        if (error) safeLogError('Failed to sync feed actions', error);
      } catch (error) {
        safeLogError('Failed to sync feed actions', error);
      }
    }, FEED_ACTION_SYNC_DEBOUNCE_MS);
  }, [interested, matched, supabaseUserId, unlocked]);

  const [servicePortfolio, setServicePortfolio] = useState(() => {
    if (isSupabaseConfigured) return [];
    // On initial synchronous render, load from localStorage (lightweight, no images).
    // A useEffect below will rehydrate from localforage (IndexedDB) with full images.
    const saved = localStorage.getItem('servicePortfolio');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((item) => isUserOwnedServiceRecord(item)) : [];
    } catch {
      return [];
    }
  });

  const [propertyPortfolio, setPropertyPortfolio] = useState(() => {
    if (isSupabaseConfigured) return [];
    // On initial synchronous render, load from localStorage (lightweight, no images).
    // A useEffect below will rehydrate from localforage (IndexedDB) with full images.
    const saved = localStorage.getItem('propertyPortfolio');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => isUserOwnedPropertyRecord(item) && !isSeededPropertyRecord(item));
        }
      } catch { /* ignore */ }
    }
    return [];
  });

  useEffect(() => {
    const cleanupKey = 'ds_runtime_cleanup_v2_done';
    try {
      if (localStorage.getItem(cleanupKey) === '1') return;
      const allowLocalRuntimeHydration = !isSupabaseConfigured;

      const cleanupArrayKey = (key, filterFn) => {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            localStorage.removeItem(key);
            return [];
          }
          const next = parsed.filter(filterFn);
          localStorage.setItem(key, JSON.stringify(next));
          return next;
        } catch {
          localStorage.removeItem(key);
          return [];
        }
      };

      const cleanedServiceFull = cleanupArrayKey('servicePortfolio_full', (item) => isUserOwnedServiceRecord(item));
      const cleanedService = cleanupArrayKey('servicePortfolio', (item) => isUserOwnedServiceRecord(item));
      const cleanedPropertyFull = cleanupArrayKey('propertyPortfolio_full', (item) => isUserOwnedPropertyRecord(item) && !isSeededPropertyRecord(item));
      const cleanedProperty = cleanupArrayKey('propertyPortfolio', (item) => isUserOwnedPropertyRecord(item) && !isSeededPropertyRecord(item));

      const nextServices = Array.isArray(cleanedServiceFull) ? cleanedServiceFull : (Array.isArray(cleanedService) ? cleanedService : null);
      const nextProperties = Array.isArray(cleanedPropertyFull) ? cleanedPropertyFull : (Array.isArray(cleanedProperty) ? cleanedProperty : null);
      if (allowLocalRuntimeHydration && (nextServices || nextProperties)) {
        window.setTimeout(() => {
          if (nextServices) setServicePortfolio(nextServices);
          if (nextProperties) setPropertyPortfolio(nextProperties);
        }, 0);
      }

      const userProfileRaw = localStorage.getItem('userProfile');
      if (userProfileRaw) {
        try {
          const parsed = JSON.parse(userProfileRaw);
          const next = {
            ...(parsed || {}),
            name: sanitizeLegacyName(parsed?.name),
            location: String(parsed?.location || '').trim(),
            badge: String(parsed?.badge || '').trim(),
          };
          localStorage.setItem('userProfile', JSON.stringify(next));
          if (allowLocalRuntimeHydration) {
            window.setTimeout(() => setUserProfile((prev) => ({ ...(prev || {}), ...next })), 0);
          }
        } catch {
          localStorage.removeItem('userProfile');
        }
      }

      const personalProfileRaw = localStorage.getItem('personalProfile');
      if (personalProfileRaw) {
        try {
          const parsed = JSON.parse(personalProfileRaw);
          const next = {
            ...(parsed || {}),
            fullName: sanitizeLegacyName(parsed?.fullName),
          };
          localStorage.setItem('personalProfile', JSON.stringify(next));
          if (allowLocalRuntimeHydration) {
            window.setTimeout(() => setPersonalProfile((prev) => ({ ...(prev || {}), ...next })), 0);
          }
        } catch {
          localStorage.removeItem('personalProfile');
        }
      }

      const professionalProfileRaw = localStorage.getItem('professionalProfile');
      if (professionalProfileRaw) {
        try {
          const parsed = JSON.parse(professionalProfileRaw);
          const next = {
            ...(parsed || {}),
            fullName: sanitizeLegacyName(parsed?.fullName),
            fullNameA: sanitizeLegacyName(parsed?.fullNameA),
          };
          localStorage.setItem('professionalProfile', JSON.stringify(next));
          if (allowLocalRuntimeHydration) {
            window.setTimeout(() => setProfessionalProfile((prev) => ({ ...(prev || {}), ...next })), 0);
          }
        } catch {
          localStorage.removeItem('professionalProfile');
        }
      }

      // Legacy owner routing and temporary upload caches from pre-Supabase flow.
      localStorage.removeItem('publishingOwnerId');
      localStorage.removeItem('tempUploads_professional');
      localStorage.removeItem('tempUploads_fsbo');
      // LGPD: remove sensitive mock data that should never be in localStorage
      localStorage.removeItem('ds_payment_methods_mock');
      localStorage.removeItem('ds_billing_history_mock');
      localStorage.removeItem('ds_comm_prefs_mock');
      localStorage.removeItem('ds_export_mail_defaults');

      localStorage.setItem(cleanupKey, '1');
    } catch (error) {
      console.warn('Runtime cleanup skipped.', error);
    }
  }, []);

  const [globalShowcaseProperties, setGlobalShowcaseProperties] = useState([]);
  const [globalConnectionServices, setGlobalConnectionServices] = useState([]);
  const [activeSpotlights, setActiveSpotlights] = useState([]);
  const [globalFeedRefreshTick, setGlobalFeedRefreshTick] = useState(0);
  const [spotlightDbCandidates, setSpotlightDbCandidates] = useState([]);
  const [isSpotlightCandidatesLoading, setIsSpotlightCandidatesLoading] = useState(false);
  const [isSpotlightProcessing, setIsSpotlightProcessing] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      const timer = window.setTimeout(() => {
        setGlobalShowcaseProperties([]);
        setGlobalConnectionServices([]);
        setActiveSpotlights([]);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;

    const hydrateGlobalShowcase = async () => {
      try {
        let propertiesResult = await supabase
          .from('properties')
          .select('id, owner_id, type, address, city, state, zip, price, beds, baths, sqft, improvement, lot, deal_tag, objective, rehab, cap_rate, description, markets, is_active, deal_closed, pending_deal, pending_deal_started_at, pending_deal_expires_at, publish_to_showcase, include_in_preview, source, owner_account_type, primary_profile, video, lat, lng, geocode_status, geocode_source, geocode_confidence, geocode_input, geocoded_at, created_at, updated_at')
          .eq('is_active', true)
          .eq('publish_to_showcase', true)
          .order('created_at', { ascending: false })
          .limit(250);

        if (propertiesResult?.error && isPropertiesOptionalColumnMissingError(propertiesResult.error)) {
          propertiesResult = await supabase
            .from('properties')
            .select('id, owner_id, type, address, city, state, zip, price, beds, baths, sqft, improvement, lot, deal_tag, objective, rehab, cap_rate, description, markets, is_active, publish_to_showcase, include_in_preview, source, owner_account_type, primary_profile, created_at, updated_at')
            .eq('is_active', true)
            .eq('publish_to_showcase', true)
            .order('created_at', { ascending: false })
            .limit(250);
        }

        let servicesResult = await supabase
          .from('services')
          .select('id, owner_id, title, category, description, price, media_images, publish_to_connections, markets, primary_profile, created_at, updated_at')
          .eq('publish_to_connections', true)
          .order('created_at', { ascending: false })
          .limit(250);

        let spotlightsResult = await supabase
          .from('card_spotlights')
          .select('id, user_id, owner_id, card_kind, card_id, scope, starts_at, expires_at, nuggets_spent')
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(500);

        if (cancelled) return;
        if (propertiesResult.error) {
          safeLogError('Supabase global showcase hydration failed.', propertiesResult.error);
          setGlobalShowcaseProperties([]);
        }
        if (servicesResult.error) {
          safeLogError('Supabase global connections hydration failed.', servicesResult.error);
          servicesResult = { data: [] };
        }
        if (spotlightsResult.error) {
          safeLogError('Supabase card spotlights hydration failed.', spotlightsResult.error);
          spotlightsResult = { data: [] };
        }

        const propertyRows = Array.isArray(propertiesResult.data) ? propertiesResult.data : [];
        const serviceRows = Array.isArray(servicesResult.data) ? servicesResult.data : [];
        const spotlightRows = Array.isArray(spotlightsResult.data) ? spotlightsResult.data : [];
        const ownerIds = Array.from(new Set([
          ...propertyRows.map((row) => String(row.owner_id || '').trim()),
          ...serviceRows.map((row) => String(row.owner_id || '').trim()),
        ].filter(Boolean)));
        let userRows = [];
        let personalRows = [];
        let professionalRows = [];

        if (ownerIds.length > 0) {
          const [usersResult, userProfilesResult, professionalProfilesResult] = await Promise.all([
            supabase
              .from('users')
              .select('id, email, full_name, phone, account_type, is_admin')
              .in('id', ownerIds),
            supabase
              .from('user_profiles')
              .select('user_id, full_name, photo_url, bio, visibility')
              .in('user_id', ownerIds),
            supabase
              .from('professional_profiles')
              .select('user_id, category, subcategory, markets, skills, services, pitch, primary_category, category_b, primary_category_b, photo_b_url, profile_payload')
              .in('user_id', ownerIds),
          ]);

          if (usersResult.error) safeLogError('Supabase owner users hydration failed.', usersResult.error);
          if (userProfilesResult.error) safeLogError('Supabase owner personal profiles hydration failed.', userProfilesResult.error);
          if (professionalProfilesResult.error) safeLogError('Supabase owner professional profiles hydration failed.', professionalProfilesResult.error);

          userRows = usersResult.error ? [] : (Array.isArray(usersResult.data) ? usersResult.data : []);
          personalRows = userProfilesResult.error ? [] : (Array.isArray(userProfilesResult.data) ? userProfilesResult.data : []);
          professionalRows = professionalProfilesResult.error ? [] : (Array.isArray(professionalProfilesResult.data) ? professionalProfilesResult.data : []);
        }

        const usersById = new Map(userRows.map((row) => [String(row.id), row]));
        const personalByOwnerId = new Map(personalRows.map((row) => [String(row.user_id), row]));
        const professionalByOwnerId = new Map(professionalRows.map((row) => [String(row.user_id), row]));
        const getOwnerPreviewForRow = (row) => {
          const ownerId = String(row?.owner_id || row?.ownerId || '').trim();
          if (!ownerId) return null;
          const resolvedScope = Object.prototype.hasOwnProperty.call(row || {}, 'deal_tag')
            || Object.prototype.hasOwnProperty.call(row || {}, 'owner_account_type')
            ? inferDbPropertyProfileScope(row)
            : normalizeProfileScope(row?.primary_profile || 'personal');
          return buildDbOwnerPreview({
            ownerId,
            scope: resolvedScope,
            userRow: usersById.get(ownerId),
            personalRow: personalByOwnerId.get(ownerId),
            professionalRow: professionalByOwnerId.get(ownerId),
          });
        };

        let imageRows = [];
        if (propertyRows.length > 0) {
          const imageResult = await supabase
            .from('property_images')
            .select('property_id, image_url, sort_order')
            .in('property_id', propertyRows.map((row) => row.id))
            .order('sort_order', { ascending: true });

          if (imageResult.error) {
            safeLogError('Supabase global showcase images hydration failed.', imageResult.error);
          } else {
            imageRows = Array.isArray(imageResult.data) ? imageResult.data : [];
          }
        }

        if (cancelled) return;

        const imagesByProperty = imageRows.reduce((acc, row) => {
          const key = String(row.property_id || '');
          if (!key) return acc;
          if (!acc[key]) acc[key] = [];
          acc[key].push(String(row.image_url || '').trim());
          return acc;
        }, {});

        setGlobalShowcaseProperties(propertiesResult.error ? [] : propertyRows.map((row) => mapDbPropertyToLocal(row, imagesByProperty[row.id] || [], {
          ownerId: row.owner_id || row.ownerId || '',
          ownerPreview: getOwnerPreviewForRow(row),
          primaryProfile: inferDbPropertyProfileScope(row),
        })));
        setGlobalConnectionServices(serviceRows.map((row) => mapDbServiceToLocal(row, {
          ownerId: row.owner_id || row.ownerId || '',
          ownerPreview: getOwnerPreviewForRow(row),
        })));
        setActiveSpotlights(spotlightRows.map((row) => ({
          id: row.id,
          userId: row.user_id,
          ownerId: row.owner_id,
          cardKind: row.card_kind,
          cardId: row.card_id,
          scope: row.scope || '',
          expiresAt: row.expires_at,
          nuggetsSpent: row.nuggets_spent,
        })));
      } catch (error) {
        if (!cancelled) {
          safeLogError('Global showcase hydration failed.', error);
          setGlobalShowcaseProperties([]);
          setGlobalConnectionServices([]);
          setActiveSpotlights([]);
        }
      }
    };

    hydrateGlobalShowcase();
    return () => {
      cancelled = true;
    };
  }, [supabaseUserId]);

  const globalServicePortfolio = useMemo(() => {
    const byId = new Map();
    [...(globalConnectionServices || []), ...(servicePortfolio || [])]
      .filter((service) => isTruthyFlag(service?.publishToConnections, true))
      .forEach((service, idx) => {
        const id = service?.id || `${service?.ownerId || 'service'}:${idx}`;
        if (!id) return;
        byId.set(String(id), { ...service, id });
      });
    return [...byId.values()];
  }, [globalConnectionServices, servicePortfolio]);

  const [spotlightNow, setSpotlightNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setSpotlightNow(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeSpotlightKeys = useMemo(() => {
    const now = spotlightNow;
    const keys = new Set();
    (activeSpotlights || []).forEach((row) => {
      if (!row?.cardKind || !row?.cardId) return;
      if (row.expiresAt && Date.parse(row.expiresAt) <= now) return;
      keys.add(`${row.cardKind}:${row.cardId}`);
      if (row.cardKind === 'profile' && String(row.cardId).startsWith('profile:')) {
        keys.add(String(row.cardId));
      }
    });
    return keys;
  }, [activeSpotlights, spotlightNow]);

  useEffect(() => {
    if (modal !== 'spotlight' || !isSupabaseConfigured || !supabase || !supabaseUserId) {
      if (modal !== 'spotlight') {
        const timer = window.setTimeout(() => setSpotlightDbCandidates([]), 0);
        return () => window.clearTimeout(timer);
      }
      return undefined;
    }

    let cancelled = false;
    const loadSpotlightCandidates = async () => {
      setIsSpotlightCandidatesLoading(true);
      try {
        const [propertiesResult, servicesResult] = await Promise.all([
          supabase
            .from('properties')
            .select('id, type, address, city, state, is_active, publish_to_showcase, deal_closed, pending_deal_expires_at, primary_profile, updated_at, created_at')
            .eq('owner_id', supabaseUserId)
            .eq('is_active', true)
            .eq('publish_to_showcase', true)
            .or('deal_closed.is.false,deal_closed.is.null')
            .order('updated_at', { ascending: false })
            .limit(80),
          supabase
            .from('services')
            .select('id, title, category, publish_to_connections, primary_profile, updated_at, created_at')
            .eq('owner_id', supabaseUserId)
            .eq('publish_to_connections', true)
            .order('updated_at', { ascending: false })
            .limit(80),
        ]);

        if (cancelled) return;
        if (propertiesResult.error) throw propertiesResult.error;
        if (servicesResult.error) throw servicesResult.error;

        const properties = (Array.isArray(propertiesResult.data) ? propertiesResult.data : [])
          .filter((row) => row?.id && !isPendingDealExpired({
            pendingDealExpiresAt: row.pending_deal_expires_at,
          }))
          .map((row) => ({
            key: `property:${row.id}`,
            cardKind: 'property',
            cardId: String(row.id),
            ownerId: supabaseUserId,
            scope: row.primary_profile || '',
            title: row.address || 'Property card',
            label: [row.type || 'Property', row.city, row.state].filter(Boolean).join(' - '),
          }));

        const services = (Array.isArray(servicesResult.data) ? servicesResult.data : [])
          .filter((row) => row?.id)
          .map((row) => ({
            key: `service:${row.id}`,
            cardKind: 'service',
            cardId: String(row.id),
            ownerId: supabaseUserId,
            scope: row.primary_profile || '',
            title: row.title || 'Service card',
            label: row.category || 'Service',
          }));

        setSpotlightDbCandidates([...properties, ...services]);
      } catch (error) {
        safeLogError('Spotlight candidate hydration failed.', error);
        if (!cancelled) {
          setSpotlightDbCandidates([]);
          addToast({ type: 'error', title: 'Spotlight unavailable', message: 'Could not load your active cards for spotlight.' });
        }
      } finally {
        if (!cancelled) setIsSpotlightCandidatesLoading(false);
      }
    };

    loadSpotlightCandidates();
    return () => {
      cancelled = true;
    };
  }, [addToast, modal, supabaseUserId]);

  const spotlightCandidates = useMemo(() => {
    if (!supabaseUserId) return [];
    const candidates = [];
    const addProfile = (scope, title, enabled = true) => {
      if (!enabled) return;
      candidates.push({
        key: `profile:${scope}:${supabaseUserId}`,
        cardKind: 'profile',
        cardId: `profile:${scope}:${supabaseUserId}`,
        ownerId: supabaseUserId,
        scope,
        title,
        label: `${scope === 'professional' ? 'Business' : scope === 'fsbo' ? 'FSBO' : 'Personal'} profile`,
      });
    };

    const hasPersonalName = Boolean(String(professionalProfile?.fullNameA || personalProfile?.fullName || userProfile?.name || '').trim());
    const hasBusinessName = Boolean(String(professionalProfile?.fullNameB || '').trim());
    const hasFsbo = accountType === 'fsbo_owner'
      || Boolean((propertyPortfolio || []).some((p) => String(p?.primaryProfile || '').toLowerCase() === 'fsbo'));
    addProfile('personal', professionalProfile?.fullNameA || personalProfile?.fullName || userProfile?.name || 'Personal profile', hasPersonalName);
    addProfile('professional', professionalProfile?.fullNameB || 'Business profile', hasBusinessName);
    addProfile('fsbo', personalProfile?.fullName || userProfile?.name || 'FSBO profile', hasFsbo);
    candidates.push(...spotlightDbCandidates);

    const byKey = new Map();
    candidates.forEach((item) => {
      if (!item?.cardKind || !item?.cardId) return;
      if (activeSpotlightKeys.has(`${item.cardKind}:${item.cardId}`)) return;
      byKey.set(`${item.cardKind}:${item.cardId}`, item);
    });
    return [...byKey.values()];
  }, [accountType, activeSpotlightKeys, personalProfile, professionalProfile, propertyPortfolio, spotlightDbCandidates, supabaseUserId, userProfile]);

  const showcaseProperties = useMemo(() => {
    const byId = new Map();
    [...(globalShowcaseProperties || []), ...(propertyPortfolio || [])]
      .filter((p) => (
        isTruthyFlag(p?.isActive, true)
        && isTruthyFlag(p?.publishToShowcase, true)
        && p?.dealClosed !== true
        && (import.meta.env.DEV || !isDemoSeedMockRecord(p))
        && !isPendingDealExpired(p)
      ))
      .forEach((p, idx) => {
        const id = p.id ?? p.portfolioId ?? `portfolio-${idx}`;
        if (!id) return;
        byId.set(String(id), { ...p, id });
      });
    return [...byId.values()];
  }, [globalShowcaseProperties, propertyPortfolio]);

  const unlockPortfolioProperties = useMemo(() => {
    const byId = new Map();
    [...(propertyPortfolio || []), ...(showcaseProperties || []), ...(MOCK_PROPERTIES || [])].forEach((property, idx) => {
      if (!property) return;
      const key = String(property.id || property.portfolioId || `${property.ownerId || 'owner'}:${idx}`);
      if (!byId.has(key)) byId.set(key, property);
    });
    return [...byId.values()];
  }, [propertyPortfolio, showcaseProperties]);

  const unlockPortfolioServices = useMemo(() => {
    const byId = new Map();
    [...(globalServicePortfolio || []), ...(MOCK_SERVICES || [])].forEach((service, idx) => {
      if (!service) return;
      const key = String(service.id || `${service.ownerId || 'owner'}:${idx}`);
      if (!byId.has(key)) byId.set(key, service);
    });
    return [...byId.values()];
  }, [globalServicePortfolio]);

  const buildUnlockedContactSnapshot = useCallback((ownerId) => {
    const rawOwnerId = String(ownerId || '').trim();
    if (!rawOwnerId) return null;

    const exactMock = import.meta.env.DEV ? (CARDS || []).find((card) => String(card?.id || '') === rawOwnerId) : null;
    if (exactMock) {
      return {
        ...exactMock,
        id: rawOwnerId,
        ownerId: rawOwnerId,
      };
    }

    const linkedService = (unlockPortfolioServices || []).find((service) => String(service?.ownerId || '') === rawOwnerId);
    const linkedProperty = (unlockPortfolioProperties || []).find((property) => String(property?.ownerId || '') === rawOwnerId);
    const ownerPreview = linkedService?.ownerPreview || linkedProperty?.ownerPreview || null;
    const ownerName = String(ownerPreview?.name || '').trim();
    if (!ownerName) return null;

    return {
      id: rawOwnerId,
      ownerId: rawOwnerId,
      unlockOwnerId: rawOwnerId,
      name: ownerName,
      title: ownerName,
      type: String(ownerPreview?.type || ownerPreview?.cat || '').trim(),
      category: String(ownerPreview?.cat || linkedService?.category || '').trim(),
      badge: ownerPreview?.badge || '',
      loc: ownerPreview?.loc || '',
      photo: String(ownerPreview?.photo || '').trim(),
      email: ownerPreview?.email || '',
      primaryPhone: ownerPreview?.primaryPhone || '',
      contactMethods: Array.isArray(ownerPreview?.contactMethods) ? ownerPreview.contactMethods : [],
      primaryProfile: ownerPreview?.primaryProfile || linkedService?.primaryProfile || linkedProperty?.primaryProfile || 'personal',
      portfolioCount: [linkedService, linkedProperty].filter(Boolean).length,
      verified: ownerPreview?.verified === true,
      source: 'remote-unlock',
    };
  }, [unlockPortfolioProperties, unlockPortfolioServices]);

  const fetchRemoteUnlockState = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    try {
      const [contactSnapshotsResult, unlocksResult, propertyUnlocksResult] = await Promise.all([
        supabase.rpc('ds_get_unlocked_contact_snapshots'),
        supabase
          .from('unlocks')
          .select('seller_id, nuggets_spent, created_at')
          .eq('buyer_id', supabaseUserId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase
          .from('property_unlocks')
          .select('id, property_id, owner_id, buyer_id, mode, total_cost, created_at, expires_at, status')
          .or(`buyer_id.eq.${supabaseUserId},owner_id.eq.${supabaseUserId}`)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      const snapshotMissing = contactSnapshotsResult.error
        && String(contactSnapshotsResult.error?.message || '').toLowerCase().includes('ds_get_unlocked_contact_snapshots');
      if (contactSnapshotsResult.error && !snapshotMissing) {
        safeLogError('Failed to hydrate unlocked contact snapshots.', contactSnapshotsResult.error);
      }
      if (unlocksResult.error) {
        safeLogError('Failed to hydrate remote unlocks.', unlocksResult.error);
      }
      if (propertyUnlocksResult.error) {
        safeLogError('Failed to hydrate remote property unlocks.', propertyUnlocksResult.error);
      }

      const unlockRows = Array.isArray(unlocksResult.data) ? unlocksResult.data : [];
      const propertyUnlockRows = Array.isArray(propertyUnlocksResult.data) ? propertyUnlocksResult.data : [];
      const snapshotRows = Array.isArray(contactSnapshotsResult.data) ? contactSnapshotsResult.data : [];
      const buyerPropertyUnlockRows = propertyUnlockRows.filter((row) => (
        String(row?.buyer_id || '').trim() === String(supabaseUserId || '').trim()
      ));
      const unlockedOwnerIds = unlockRows
        .map((row) => String(row?.seller_id || '').trim())
        .filter(Boolean);
      snapshotRows.forEach((row) => {
        const ownerId = String(row?.seller_id || row?.contact?.ownerId || row?.contact?.id || '').trim();
        if (ownerId && !unlockedOwnerIds.includes(ownerId)) unlockedOwnerIds.push(ownerId);
      });
      buyerPropertyUnlockRows.forEach((row) => {
        const ownerId = String(row?.owner_id || '').trim();
        if (ownerId && !unlockedOwnerIds.includes(ownerId)) unlockedOwnerIds.push(ownerId);
      });

      if (unlockedOwnerIds.length) {
        setUnlocked((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          const seen = new Set(next.map((value) => String(value || '').trim()).filter(Boolean));
          unlockedOwnerIds.forEach((ownerId) => {
            if (!seen.has(ownerId)) {
              seen.add(ownerId);
              next.push(ownerId);
            }
          });
          return next;
        });

        setPurchases((prev) => {
          const current = Array.isArray(prev) ? [...prev] : [];
          const seen = new Set(current.map((row) => String(row?.sellerId || '').trim()).filter(Boolean));
          unlockedOwnerIds.forEach((ownerId) => {
            if (!seen.has(ownerId)) {
              seen.add(ownerId);
              current.push({ sellerId: ownerId });
            }
          });
          return current;
        });

        const hydratedContacts = [
          ...snapshotRows
            .map((row) => row?.contact)
            .filter((contact) => contact && typeof contact === 'object'),
          ...unlockedOwnerIds
            .map((ownerId) => buildUnlockedContactSnapshot(ownerId))
            .filter(Boolean),
        ];

        if (hydratedContacts.length) {
          setMatched((prev) => mergeFeedActionItems(prev, hydratedContacts));
        }
      }

      if (buyerPropertyUnlockRows.length) {
        const unlockedPropertyIds = new Set(
          buyerPropertyUnlockRows
            .map((row) => String(row?.property_id || '').trim())
            .filter(Boolean)
        );
        const hydratedUnlockedProperties = (unlockPortfolioProperties || []).filter((property) => {
          const ids = [
            property?.id,
            property?.propertyId,
            property?.property_id,
            property?.portfolioId,
          ].map((value) => String(value || '').trim()).filter(Boolean);
          return ids.some((id) => unlockedPropertyIds.has(id));
        });
        if (hydratedUnlockedProperties.length) {
          setInterested((prev) => mergeFeedActionItems(prev, hydratedUnlockedProperties));
        }
      }

      if (propertyUnlockRows.length) {
        setPropertyUnlocks((prev) => {
          const current = Array.isArray(prev) ? [...prev] : [];
          const byId = new Map(current.map((row) => [String(row?.id || ''), row]));
          propertyUnlockRows.forEach((row) => {
            const key = String(row?.id || '').trim();
            if (!key) return;
            byId.set(key, {
              ...(byId.get(key) || {}),
              id: key,
              propertyId: row.property_id,
              ownerId: row.owner_id,
              buyerId: row.buyer_id,
              mode: row.mode || 'normal',
              cost: Number(row.total_cost || 0),
              createdAt: row.created_at || null,
              expiresAt: row.expires_at || null,
              status: row.status || 'active',
            });
          });
          return [...byId.values()];
        });
      }
    } catch (error) {
      safeLogError('Remote unlock hydration failed.', error);
    }
  }, [buildUnlockedContactSnapshot, setInterested, setMatched, setPropertyUnlocks, setPurchases, setUnlocked, supabaseUserId, unlockPortfolioProperties]);

  useEffect(() => {
    if (!supabaseUserId) return;
    const timer = window.setTimeout(() => { void fetchRemoteUnlockState(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchRemoteUnlockState, supabaseUserId]);

  const handleMapPropertyCoordsUpdate = useCallback((propertyId, coordsMeta = {}) => {
    if (!propertyId) return;
    const nextLat = toNumberOrNull(coordsMeta?.lat);
    const nextLng = toNumberOrNull(coordsMeta?.lng);
    const geocodeStatusFallback = (Number.isFinite(nextLat) && Number.isFinite(nextLng)) ? 'resolved' : 'pending';

    setPropertyPortfolio((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      let changed = false;
      const next = list.map((property) => {
        if (String(property?.id) !== String(propertyId)) return property;
        const draft = {
          ...property,
          lat: nextLat,
          lng: nextLng,
          geocodeStatus: normalizeGeocodeStatus(coordsMeta?.geocodeStatus, geocodeStatusFallback),
          geocodeSource: String(coordsMeta?.geocodeSource || '').trim() || property?.geocodeSource || '',
          geocodeConfidence: toNumberOrNull(coordsMeta?.geocodeConfidence),
          geocodeInput: String(coordsMeta?.geocodeInput || '').trim() || property?.geocodeInput || '',
          geocodedAt: toIsoDateOrNull(coordsMeta?.geocodedAt || new Date().toISOString()),
        };

        const same = (
          Number(property?.lat) === Number(draft.lat)
          && Number(property?.lng) === Number(draft.lng)
          && String(property?.geocodeStatus || '') === String(draft.geocodeStatus || '')
          && String(property?.geocodeSource || '') === String(draft.geocodeSource || '')
          && Number(property?.geocodeConfidence ?? NaN) === Number(draft.geocodeConfidence ?? NaN)
          && String(property?.geocodeInput || '') === String(draft.geocodeInput || '')
          && String(property?.geocodedAt || '') === String(draft.geocodedAt || '')
        );

        if (!same) {
          changed = true;
          return draft;
        }
        return property;
      });

      return changed ? next : prev;
    });
  }, []);

  // Category order state with localStorage persistence
  const [categoryOrder, setCategoryOrder] = useState(() => {
    const saved = localStorage.getItem('categoryOrder');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return CATEGORIES.map(c => c.id);
      }
    }
    return CATEGORIES.map(c => c.id);
  });

  // ── Reset all user-specific state on logout, session expiry, or user switch ─
  // useState initializers only run once on mount, so when a different user
  // logs in during the same session the previous user's data would bleed in.
  // This effect detects any userId transition and wipes all user-scoped state
  // including localStorage, so the next user never reads stale data after a
  // page refresh.
  useEffect(() => {
    const previousUserId = prevUserIdRef.current;
    prevUserIdRef.current = supabaseUserId;

    if (previousUserId === supabaseUserId) return;
    if (previousUserId === null && supabaseUserId === null) return;

    let lastStoredUserId = null;
    try { lastStoredUserId = localStorage.getItem('ds_last_auth_user_id'); } catch { /* no-op */ }

    const isSwitchingToDifferentUser = Boolean(
      supabaseUserId
      && lastStoredUserId
      && String(lastStoredUserId) !== String(supabaseUserId)
    );
    const isInAppAccountSwitch = Boolean(
      previousUserId
      && supabaseUserId
      && String(previousUserId) !== String(supabaseUserId)
    );

    if (supabaseUserId) {
      try { localStorage.setItem('ds_last_auth_user_id', String(supabaseUserId)); } catch { /* no-op */ }
    }

    if (!(isSwitchingToDifferentUser || isInAppAccountSwitch)) return;

    clearUserSpecificLocalStorage();

    if (previousUserId !== null || isSwitchingToDifferentUser) {
      setMatched([]);
      setInterested([]);
      setUnlocked([]);
      setPurchases([]);
      setConvos({});
      setNuggets(5);
      setSubscription({ planId: 'free', planName: 'Free', price: 0, status: 'active', nextBillingAt: null });
      setSystemNotifications([]);
      setUserProfile({ name: '', category: '', type: '', location: '', badge: '' });
      setPersonalProfile(DEFAULT_PERSONAL_PROFILE);
      setProfessionalProfile(DEFAULT_PROFESSIONAL_PROFILE(''));
      setServicePortfolio([]);
      setPropertyPortfolio([]);
      clearAllUserData(); // clears IndexedDB portfolioStore + tempUploads
    }
  }, [supabaseUserId]);

  // Persist category order to localStorage
  useEffect(() => {
    localStorage.setItem('categoryOrder', JSON.stringify(categoryOrder));
  }, [categoryOrder]);

  useEffect(() => {
    persistJsonSafely('userProfile', userProfile);
  }, [userProfile]);

  useEffect(() => {
    try {
      localStorage.setItem('accountType', accountType);
    } catch (error) {
      console.error('Failed to persist accountType.', error);
    }
  }, [accountType]);

  useEffect(() => {
    persistJsonSafely('personalProfile', personalProfile, _stripPersonalProfileMedia(personalProfile));
  }, [personalProfile]);

  useEffect(() => {
    persistJsonSafely('professionalProfile', professionalProfile);
  }, [professionalProfile]);

  useEffect(() => {
    persistJsonSafely('servicePortfolio', servicePortfolio, stripServicePortfolioMedia(servicePortfolio));
  }, [servicePortfolio]);

  useEffect(() => {
    persistJsonSafely('propertyPortfolio', propertyPortfolio, stripPropertyPortfolioMedia(propertyPortfolio));
  }, [propertyPortfolio]);

  // ── Rehydrate portfolios from localforage (IndexedDB) on mount ─────────
  // The synchronous useState init above loads the lightweight localStorage version (no images).
  // These effects fire on mount and load the full version (with images) from localforage.
  useEffect(() => {
    if (isSupabaseConfigured) return;
    getPortfolioFull('propertyPortfolio').then((full) => {
      if (!Array.isArray(full) || !full.length) return;
      const filtered = full.filter((item) => isUserOwnedPropertyRecord(item) && !isSeededPropertyRecord(item));
      if (!filtered.length) return;
      // Merge media/full payload from localforage into current state.
      // Publication flags are resolved later by Supabase hydration (server-canonical).
      setPropertyPortfolio((prev) => {
        const prevById = (prev || []).reduce((m, p) => { m[String(p.id)] = p; return m; }, {});
        return filtered.map((item) => {
          const cur = prevById[String(item.id)];
          if (!cur) return item;
          return { ...cur, ...item };
        });
      });
    });
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    getPortfolioFull('servicePortfolio').then((full) => {
      if (!Array.isArray(full) || !full.length) return;
      const filtered = full.filter((item) => isUserOwnedServiceRecord(item));
      if (!filtered.length) return;
      // Merge media/full payload from localforage into current state.
      // Connection flags are resolved later by Supabase hydration (server-canonical).
      setServicePortfolio((prev) => {
        const prevById = (prev || []).reduce((m, s) => { m[String(s.id)] = s; return m; }, {});
        return filtered.map((item) => {
          const cur = prevById[String(item.id)];
          if (!cur) return item;
          return { ...cur, ...item };
        });
      });
    });
  }, []);

  // ── Flush pending Supabase debounces on tab close / background ──
  useEffect(() => {
    const flushPending = () => {
      for (const key of ['personal', 'professional', 'services', 'properties']) {
        const fn = pendingFlushRef.current[key];
        if (fn) {
          // Clear the debounce timer and execute immediately
          if (profileSaveDebounceRef.current[key]) {
            clearTimeout(profileSaveDebounceRef.current[key]);
            profileSaveDebounceRef.current[key] = null;
          }
          try { fn(); } catch { /* best-effort */ }
          pendingFlushRef.current[key] = null;
        }
      }
    };
    const handleBeforeUnload = () => flushPending();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushPending();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pendingFlushRef, profileSaveDebounceRef]);

  useEffect(() => {
    try {
      localStorage.setItem('ds_unlocked', JSON.stringify(unlocked || []));
    } catch (error) {
      console.error('Failed to persist unlocked contacts.', error);
    }
  }, [unlocked]);

  useEffect(() => {
    try {
      const now = Date.now();
      const cleaned = (propertyUnlocks || []).filter((row) => (
        !row?.expiresAt || Number(new Date(row.expiresAt).getTime()) > now
      )).slice(-500);
      localStorage.setItem('ds_property_unlocks', JSON.stringify(cleaned));
      if (cleaned.length !== (propertyUnlocks || []).length) {
        window.setTimeout(() => setPropertyUnlocks(cleaned), 0);
      }
    } catch {
      // Local exclusivity cache is best-effort.
    }
  }, [propertyUnlocks]);

  useEffect(() => {
    try {
      localStorage.setItem('ds_purchases', JSON.stringify(purchases || []));
    } catch (error) {
      console.error('Failed to persist purchases.', error);
    }
  }, [purchases]);

  useEffect(() => {
    try {
      localStorage.setItem('ds_system_notifications', JSON.stringify(systemNotifications || []));
    } catch (error) {
      console.error('Failed to persist system notifications.', error);
    }
  }, [systemNotifications]);

  useEffect(() => {
    try {
      localStorage.setItem('ds_mobile_bottom_nav_collapsed', mobileBottomNavCollapsed ? '1' : '0');
    } catch {
      // ignore storage write failures
    }
  }, [mobileBottomNavCollapsed]);

  // Email verification warning — shown once per session when user hasn't confirmed email
  const emailVerifyWarnedRef = useRef(false);
  useEffect(() => {
    if (authSession && authSession.emailVerified === false && !emailVerifyWarnedRef.current) {
      emailVerifyWarnedRef.current = true;
      addToast({
        type: 'warning',
        title: 'Email não verificado',
        message: 'Confirme seu email para garantir acesso completo à plataforma. Verifique sua caixa de entrada.',
        duration: 8000,
      });
    }
    if (!authSession) emailVerifyWarnedRef.current = false;
  }, [authSession, addToast]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      profileSyncStateRef.current = { userId: null, loaded: false, hydrating: false, personalLoadedFromRemote: false, professionalLoadedFromRemote: false };
      scheduleProfileSyncSnapshot();
      window.setTimeout(() => setIsHydratingProfiles(false), 0);
      resetProfileSync();
      resetPortfolioSync();
      if (profileHydrationRetryRef.current.timer) {
        clearTimeout(profileHydrationRetryRef.current.timer);
        profileHydrationRetryRef.current.timer = null;
      }
      profileHydrationRetryRef.current.attempts = 0;
      window.setTimeout(() => setProfileHydrationAttempts(0), 0);
      return;
    }

    if (
      profileSyncStateRef.current.userId === supabaseUserId
      && profileSyncStateRef.current.loaded
      && profileSyncStateRef.current.personalLoadedFromRemote
      && profileSyncStateRef.current.professionalLoadedFromRemote
    ) return;

    let cancelled = false;
    if (profileHydrationRetryRef.current.timer) {
      clearTimeout(profileHydrationRetryRef.current.timer);
      profileHydrationRetryRef.current.timer = null;
    }
    profileSyncStateRef.current = { userId: supabaseUserId, loaded: false, hydrating: true, personalLoadedFromRemote: false, professionalLoadedFromRemote: false };
    scheduleProfileSyncSnapshot();
    setIsHydratingProfiles(true);

    const hydrateProfilesFromSupabase = async () => {
      let personalLoadedFromRemote = false;
      let professionalLoadedFromRemote = false;
      try {
        const [personalResult, professionalResultInitial, userRowInitial, subscriptionRow] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('full_name, photo_url, bio, visibility')
            .eq('user_id', supabaseUserId)
            .maybeSingle(),
          supabase
            .from('professional_profiles')
            .select('category, subcategory, markets, skills, services, pitch, primary_category, category_b, primary_category_b, photo_b_url, profile_payload')
            .eq('user_id', supabaseUserId)
            .maybeSingle(),
          supabase
            .from('users')
            .select('nuggets, plan_id, full_name, phone, settings_payload')
            .eq('id', supabaseUserId)
            .maybeSingle(),
          supabase
            .from('subscriptions')
            .select('plan_id, plan_name, price_cents, status, current_period_end')
            .eq('user_id', supabaseUserId)
            .maybeSingle(),
        ]);

        let userRow = userRowInitial;
        if (userRow?.error && isMissingColumnError(userRow.error, 'users.settings_payload')) {
          userRow = await supabase
            .from('users')
            .select('nuggets, plan_id, full_name, phone')
            .eq('id', supabaseUserId)
            .maybeSingle();
        }

        // Sync nuggets from Supabase (source of truth after webhook credits)
        if (!cancelled && userRow?.data?.nuggets != null) {
          setNuggets(userRow.data.nuggets);
        }
        if (!cancelled && userRow?.data) {
          const settingsPayload = userRow.data.settings_payload && typeof userRow.data.settings_payload === 'object'
            ? userRow.data.settings_payload
            : null;

          setSystemAccount((prev) => {
            const payloadSystem = settingsPayload?.systemAccount && typeof settingsPayload.systemAccount === 'object'
              ? settingsPayload.systemAccount
              : {};
            return {
              ...(prev || {}),
              fullName: String(payloadSystem.fullName || userRow.data.full_name || ''),
              email: String(payloadSystem.email || ''),
              phone: String(payloadSystem.phone || userRow.data.phone || ''),
              phoneCountryCode: String(payloadSystem.phoneCountryCode || '+1'),
              marketAreas: String(payloadSystem.marketAreas || ''),
              accountType: String(payloadSystem.accountType || 'individual'),
            };
          });

          if (settingsPayload?.userPreferences && typeof settingsPayload.userPreferences === 'object') {
            setUserPreferences(normalizeUserPreferences(settingsPayload.userPreferences));
          }
          if (settingsPayload?.commPrefs && typeof settingsPayload.commPrefs === 'object') {
            try { localStorage.setItem('ds_comm_prefs', JSON.stringify(settingsPayload.commPrefs)); } catch { /* no-op */ }
          }
          if (Array.isArray(settingsPayload?.supportMessages)) {
            try { localStorage.setItem('ds_support_chat_thread', JSON.stringify(settingsPayload.supportMessages)); } catch { /* no-op */ }
          }
          if (settingsPayload?.privacyControls && typeof settingsPayload.privacyControls === 'object') {
            try { localStorage.setItem('ds_privacy_controls', JSON.stringify(settingsPayload.privacyControls)); } catch { /* no-op */ }
          }
          if (Array.isArray(settingsPayload?.billingHistory)) {
            try { localStorage.setItem('ds_billing_history_mock', JSON.stringify(settingsPayload.billingHistory)); } catch { /* no-op */ }
          }
        }
        if (!cancelled) {
          const planId = String(subscriptionRow?.data?.plan_id || userRow?.data?.plan_id || 'free').toLowerCase();
          const planDef = PLANS.find((plan) => String(plan.id).toLowerCase() === planId);
          setSubscription({
            planId,
            planName: subscriptionRow?.data?.plan_name || planDef?.name || (planId === 'free' ? 'Free' : planId),
            price: Number(subscriptionRow?.data?.price_cents || 0) / 100,
            status: subscriptionRow?.data?.status || (planId === 'free' ? 'active' : 'active'),
            nextBillingAt: subscriptionRow?.data?.current_period_end || null,
          });
        }

        let professionalResult = professionalResultInitial;

        if (professionalResult?.error && isMissingColumnError(professionalResult.error, 'professional_profiles.profile_payload')) {
          professionalResult = await supabase
            .from('professional_profiles')
            .select('category, subcategory, markets, skills, services, pitch, primary_category, category_b, primary_category_b, photo_b_url')
            .eq('user_id', supabaseUserId)
            .maybeSingle();
        }

        if (cancelled) return;

        personalLoadedFromRemote = !personalResult.error;
        professionalLoadedFromRemote = !professionalResult.error;

        if (personalResult.error) {
          safeLogError('Supabase personal profile hydration failed.', personalResult.error);
        }
        if (professionalResult.error) {
          safeLogError('Supabase professional profile hydration failed.', professionalResult.error);
        }

        const hasAnyInitialProfileRecord = Boolean(personalResult.data || professionalResult.data);
        if (!hasAnyInitialProfileRecord) {
          feedActionHydratingRef.current = true;
          setMatched([]);
          setInterested([]);
          setUnlocked([]);
          setUserProfile((prev) => ({
            ...(prev || {}),
            name: '',
            category: '',
            type: '',
            location: '',
            badge: '',
          }));
          setPersonalProfile(DEFAULT_PERSONAL_PROFILE);
          setProfessionalProfile(DEFAULT_PROFESSIONAL_PROFILE(''));
          try { localStorage.removeItem('ds_matched'); } catch { /* no-op */ }
          try { localStorage.removeItem('ds_interested'); } catch { /* no-op */ }
          try { localStorage.removeItem('ds_unlocked'); } catch { /* no-op */ }
          feedActionLastSignatureRef.current = '[]';
          feedActionLoadedUserRef.current = supabaseUserId;
          try {
            await supabase
              .from('user_feed_actions')
              .delete()
              .eq('user_id', supabaseUserId);
          } catch (deleteError) {
            safeLogError('Failed to clear stale feed actions for empty profile.', deleteError);
          }
          window.setTimeout(() => { feedActionHydratingRef.current = false; }, 0);
          return;
        }

        if (personalResult.data) {
          const hydratedPersonal = normalizePersonalProfile({
            fullName: personalResult.data.full_name,
            photo: personalResult.data.photo_url,
            bio: personalResult.data.bio,
            visibility: personalResult.data.visibility,
          });
          setPersonalProfile((prev) => normalizePersonalProfile({
            ...(prev || {}),
            ...pruneEmptyProfileFields(hydratedPersonal),
          }));

          if (hydratedPersonal.fullName) {
            setUserProfile((prev) => ({
              ...(prev || {}),
              name: hydratedPersonal.fullName,
            }));
          }
        }

        if (professionalResult.data) {
          const profilePayload = professionalResult.data.profile_payload && typeof professionalResult.data.profile_payload === 'object'
            ? professionalResult.data.profile_payload
            : null;
          const persistedAccountType = String(profilePayload?.accountType || '').trim();
          const resolvedAccountType = ['professional', 'fsbo_owner'].includes(persistedAccountType)
            ? persistedAccountType
            : profileHydrationInputRef.current.accountType;
          if (['professional', 'fsbo_owner'].includes(persistedAccountType)) {
            setAccountType(persistedAccountType);
          }

          const {
            personalFromPayload,
            professionalFromPayload,
            personalProfileFromPayload,
            professionalProfileFromPayload,
            fsboProfileFromPayload,
          } = extractScopedProfileLegacy(professionalResult.data.profile_payload);

          const activeAccountType = resolvedAccountType;
          const activeUserCategory = profileHydrationInputRef.current.userCategory;

          const scopedPersonalPayload = activeAccountType === 'fsbo_owner'
            ? (fsboProfileFromPayload || personalProfileFromPayload || personalFromPayload)
            : (personalProfileFromPayload || personalFromPayload);

          // Prefer legacy payload values when present to avoid sparse/derived
          // profile_payload snapshots wiping persisted primary-profile fields.
          const effectivePersonalPayload = mergeProfilePayloadNonEmpty(
            scopedPersonalPayload,
            personalFromPayload
          );

          if (Object.keys(effectivePersonalPayload).length > 0) {
            setPersonalProfile((prev) => normalizePersonalProfile({
              ...(prev || {}),
              ...effectivePersonalPayload,
            }));
          }

          const mergedProfessionalPayload = mergeProfilePayloadNonEmpty(
            professionalProfileFromPayload,
            professionalFromPayload
          );

          const hydratedProfessional = normalizeProfessionalProfile({
            ...mergedProfessionalPayload,
            category: professionalResult.data.category,
            subcategory: professionalResult.data.subcategory,
            markets: professionalResult.data.markets,
            skills: professionalResult.data.skills,
            services: professionalResult.data.services,
            pitch: professionalResult.data.pitch,
            primaryCategory: professionalResult.data.primary_category,
            categoryB: professionalResult.data.category_b,
            primaryCategoryB: professionalResult.data.primary_category_b,
            photoBUrl: professionalResult.data.photo_b_url,
            photoB: professionalResult.data.photo_b_url,
          }, activeUserCategory);
          setProfessionalProfile((prev) => normalizeProfessionalProfile({
            ...(prev || {}),
            ...pruneEmptyProfileFields(hydratedProfessional),
          }, activeUserCategory));

          if (hydratedProfessional.category) {
            setUserProfile((prev) => ({
              ...(prev || {}),
              category: hydratedProfessional.category,
            }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          safeLogError('Supabase profile hydration failed.', error);
        }
      } finally {
        if (!cancelled) {
          const fullyLoadedFromRemote = personalLoadedFromRemote && professionalLoadedFromRemote;
          profileSyncStateRef.current = {
            userId: supabaseUserId,
            loaded: true,
            hydrating: false,
            personalLoadedFromRemote,
            professionalLoadedFromRemote,
          };
          scheduleProfileSyncSnapshot();
          if (fullyLoadedFromRemote) {
            profileHydrationRetryRef.current.attempts = 0;
            setProfileHydrationAttempts(0);
          } else if (profileHydrationRetryRef.current.attempts < 6) {
            profileHydrationRetryRef.current.attempts += 1;
            setProfileHydrationAttempts(profileHydrationRetryRef.current.attempts);
            profileHydrationRetryRef.current.timer = setTimeout(() => {
              profileHydrationRetryRef.current.timer = null;
              setProfileHydrationCycle((prev) => prev + 1);
            }, 2500);
          }
          setIsHydratingProfiles(false);
        }
      }
    };

    hydrateProfilesFromSupabase();

    return () => {
      cancelled = true;
      if (
        profileSyncStateRef.current.userId === supabaseUserId
        && profileSyncStateRef.current.hydrating
      ) {
        profileSyncStateRef.current = {
          ...profileSyncStateRef.current,
          loaded: false,
          hydrating: false,
        };
        scheduleProfileSyncSnapshot();
      }
      setIsHydratingProfiles(false);
    };
  }, [supabaseUserId, profileHydrationCycle, resetProfileSync, resetPortfolioSync, scheduleProfileSyncSnapshot]);

  const scheduleProfileRealtimeRefresh = useCallback((delayMs = 350) => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (Date.now() - lastLocalSupabaseWriteAtRef.current < LOCAL_REALTIME_IGNORE_MS) return;
    const elapsed = Date.now() - lastRealtimeRefreshAtRef.current.profiles;
    const nextDelay = Math.max(delayMs, REALTIME_REFRESH_MIN_INTERVAL_MS - elapsed, 0);
    if (realtimeRefreshDebounceRef.current.profiles) {
      clearTimeout(realtimeRefreshDebounceRef.current.profiles);
      realtimeRefreshDebounceRef.current.profiles = null;
    }
    realtimeRefreshDebounceRef.current.profiles = setTimeout(() => {
      realtimeRefreshDebounceRef.current.profiles = null;
      lastRealtimeRefreshAtRef.current.profiles = Date.now();
      setProfileHydrationCycle((prev) => prev + 1);
    }, nextDelay);
  }, [supabaseUserId]);

  const schedulePortfolioRealtimeRefresh = useCallback((delayMs = 350) => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (Date.now() - lastLocalSupabaseWriteAtRef.current < LOCAL_REALTIME_IGNORE_MS) return;
    const elapsed = Date.now() - lastRealtimeRefreshAtRef.current.portfolio;
    const nextDelay = Math.max(delayMs, REALTIME_REFRESH_MIN_INTERVAL_MS - elapsed, 0);
    if (realtimeRefreshDebounceRef.current.portfolio) {
      clearTimeout(realtimeRefreshDebounceRef.current.portfolio);
      realtimeRefreshDebounceRef.current.portfolio = null;
    }
    realtimeRefreshDebounceRef.current.portfolio = setTimeout(() => {
      realtimeRefreshDebounceRef.current.portfolio = null;
      lastRealtimeRefreshAtRef.current.portfolio = Date.now();
      refreshPortfolioHydration();
    }, nextDelay);
  }, [supabaseUserId, refreshPortfolioHydration]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return undefined;

    const channel = supabase
      .channel(`ds-live-sync:${supabaseUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_profiles',
        filter: `user_id=eq.${supabaseUserId}`,
      }, () => {
        scheduleProfileRealtimeRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'professional_profiles',
        filter: `user_id=eq.${supabaseUserId}`,
      }, () => {
        scheduleProfileRealtimeRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `id=eq.${supabaseUserId}`,
      }, () => {
        scheduleProfileRealtimeRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'properties',
        filter: `owner_id=eq.${supabaseUserId}`,
      }, () => {
        schedulePortfolioRealtimeRefresh();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'services',
        filter: `owner_id=eq.${supabaseUserId}`,
      }, () => {
        schedulePortfolioRealtimeRefresh();
      });
    // property_images cannot be filtered by owner_id, so listening to it here
    // causes unrelated image edits to rehydrate every user's portfolio.

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabaseUserId, scheduleProfileRealtimeRefresh, schedulePortfolioRealtimeRefresh]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (!profileSyncStateRef.current.loaded || profileSyncStateRef.current.hydrating || !profileSyncStateRef.current.personalLoadedFromRemote) return;

    if (profileSaveDebounceRef.current.personal) clearTimeout(profileSaveDebounceRef.current.personal);
    const syncPersonal = async () => {
      pendingFlushRef.current.personal = null;
      const normalized = normalizePersonalProfile(personalProfile);

      // Upload avatar to Supabase Storage if it's a local data URL
      let photoUrl = normalized.photo || null;
      if (photoUrl && photoUrl.startsWith('data:image')) {
        try {
          photoUrl = await uploadDataUrlToStorage(
            photoUrl, 'profile-images', `${supabaseUserId}/avatar.jpg`, supabase
          );
        } catch (uploadErr) {
          safeLogError('Avatar upload to Storage failed; skipping inline media persistence.', uploadErr);
          photoUrl = null;
        }
      }

      const payload = {
        user_id: supabaseUserId,
        full_name: normalized.fullName || null,
        bio: normalized.bio || null,
        visibility: normalized.visibility || 'hidden',
      };
      // Do not wipe a persisted avatar when the current form state is empty.
      // Production identity must prefer DB/Storage records over transient gaps.
      if (photoUrl) payload.photo_url = photoUrl;

      beginProfileSync();
      try {
        const { error } = await supabase
          .from('user_profiles')
          .upsert(payload, { onConflict: 'user_id' });

        if (error) {
          safeLogError('Supabase personal profile persistence failed.', error);
          endProfileSync(true);
          return;
        }
        endProfileSync(false);
      } catch (error) {
        safeLogError('Supabase personal profile persistence failed.', error);
        endProfileSync(true);
      }
    };
    pendingFlushRef.current.personal = syncPersonal;
    profileSaveDebounceRef.current.personal = setTimeout(syncPersonal, 700);
    const personalDebounceTimer = profileSaveDebounceRef.current.personal;

    return () => {
      if (personalDebounceTimer) clearTimeout(personalDebounceTimer);
    };
  }, [supabaseUserId, personalProfile, beginProfileSync, endProfileSync, pendingFlushRef, profileSaveDebounceRef]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (!profileSyncStateRef.current.loaded || profileSyncStateRef.current.hydrating || !profileSyncStateRef.current.professionalLoadedFromRemote) return;

    if (profileSaveDebounceRef.current.professional) clearTimeout(profileSaveDebounceRef.current.professional);
    const syncProfessional = async () => {
      pendingFlushRef.current.professional = null;
      const normalized = normalizeProfessionalProfile(professionalProfile, userProfile.category || '');
      const profilePayload = normalizePersistableProfilePayload(buildScopedProfilePayload({
        accountType,
        userProfile: stripInlineMediaFromObject(userProfile),
        personalProfile: stripInlineMediaFromObject(personalProfile),
        professionalProfile: stripInlineMediaFromObject(normalized),
      }));

      // Upload professional photo to Supabase Storage if it's a local data URL
      let photoBUrl = normalized.photoBUrl || normalized.photoB || null;
      if (photoBUrl && photoBUrl.startsWith('data:image')) {
        try {
          photoBUrl = await uploadDataUrlToStorage(
            photoBUrl, 'profile-images', `${supabaseUserId}/photo-b.jpg`, supabase
          );
        } catch (uploadErr) {
          safeLogError('Professional photo upload to Storage failed; skipping inline media persistence.', uploadErr);
          photoBUrl = null;
        }
      }

      const payload = {
        user_id: supabaseUserId,
        category: normalized.category || null,
        subcategory: normalized.subcategory || null,
        markets: normalizeStringArray(normalized.markets),
        skills: normalizeStringArray(normalized.skills),
        services: normalizeStringArray(normalized.services),
        pitch: normalized.pitch || null,
        primary_category: normalized.primaryCategory || null,
        category_b: normalized.categoryB || null,
        primary_category_b: normalized.primaryCategoryB || null,
      };
      // Same rule for the secondary/professional avatar: never replace a real
      // stored URL with null just because the local draft did not carry media.
      if (photoBUrl) payload.photo_b_url = photoBUrl;

      let writePayload = {
        ...payload,
        profile_payload: profilePayload,
      };

      beginProfileSync();
      try {
        let result = await supabase
          .from('professional_profiles')
          .upsert(writePayload, { onConflict: 'user_id' });

        if (result?.error && isMissingColumnError(result.error, 'professional_profiles.profile_payload')) {
          result = await supabase
            .from('professional_profiles')
            .upsert(payload, { onConflict: 'user_id' });
        }

        if (result?.error) {
          safeLogError('Supabase professional profile persistence failed.', result.error);
          endProfileSync(true);
          return;
        }
        endProfileSync(false);
      } catch (error) {
        safeLogError('Supabase professional profile persistence failed.', error);
        endProfileSync(true);
      }
    };
    pendingFlushRef.current.professional = syncProfessional;
    profileSaveDebounceRef.current.professional = setTimeout(syncProfessional, 700);
    const professionalDebounceTimer = profileSaveDebounceRef.current.professional;

    return () => {
      if (professionalDebounceTimer) clearTimeout(professionalDebounceTimer);
    };
  }, [supabaseUserId, accountType, professionalProfile, personalProfile, userProfile, beginProfileSync, endProfileSync, pendingFlushRef, profileSaveDebounceRef]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      setIsHydratingPortfolio(false);
      return;
    }
    if (
      portfolioSyncStateRef.current.userId === supabaseUserId
      && portfolioSyncStateRef.current.loaded
      && portfolioSyncStateRef.current.servicesLoadedFromRemote
      && portfolioSyncStateRef.current.propertiesLoadedFromRemote
      && portfolioSyncStateRef.current.propertyImagesLoadedFromRemote
    ) return;

    let cancelled = false;
    if (portfolioHydrationRetryRef.current.timer) {
      clearTimeout(portfolioHydrationRetryRef.current.timer);
      portfolioHydrationRetryRef.current.timer = null;
    }
    portfolioSyncStateRef.current = { userId: supabaseUserId, loaded: false, hydrating: true, servicesLoadedFromRemote: false, propertiesLoadedFromRemote: false, propertyImagesLoadedFromRemote: false };
    schedulePortfolioSyncSnapshot();
    setIsHydratingPortfolio(true);

    const hydratePortfolioFromSupabase = async () => {
      let propertiesLoadedFromRemote = false;
      let servicesLoadedFromRemote = false;
      let propertyImagesLoadedFromRemote = false;
      try {
        let propertiesResult = await supabase
          .from('properties')
          .select('id, type, address, city, state, zip, price, beds, baths, sqft, improvement, lot, deal_tag, objective, rehab, cap_rate, description, markets, is_active, deal_closed, pending_deal, pending_deal_started_at, pending_deal_expires_at, publish_to_showcase, include_in_preview, source, owner_account_type, primary_profile, video, lat, lng, geocode_status, geocode_source, geocode_confidence, geocode_input, geocoded_at, created_at, updated_at')
          .eq('owner_id', supabaseUserId)
          .order('created_at', { ascending: false });

        if (propertiesResult?.error && isPropertiesOptionalColumnMissingError(propertiesResult.error)) {
          propertiesResult = await supabase
            .from('properties')
            .select('id, type, address, city, state, zip, price, beds, baths, sqft, improvement, lot, deal_tag, objective, rehab, cap_rate, description, markets, is_active, publish_to_showcase, include_in_preview, source, owner_account_type, primary_profile, created_at, updated_at')
            .eq('owner_id', supabaseUserId)
            .order('created_at', { ascending: false });
        }

        const servicesResult = await supabase
          .from('services')
          .select('id, title, category, description, price, media_images, publish_to_connections, markets, primary_profile, created_at, updated_at')
          .eq('owner_id', supabaseUserId)
          .order('created_at', { ascending: false });

        if (cancelled) return;

        propertiesLoadedFromRemote = !propertiesResult.error;
        servicesLoadedFromRemote = !servicesResult.error;

        if (propertiesResult.error) {
          safeLogError('Supabase properties hydration failed.', propertiesResult.error);
        }
        if (servicesResult.error) {
          safeLogError('Supabase services hydration failed.', servicesResult.error);
        }

        const propertyRows = Array.isArray(propertiesResult.data) ? propertiesResult.data : [];
        const serviceRows = Array.isArray(servicesResult.data) ? servicesResult.data : [];

        let imageRows = [];
        propertyImagesLoadedFromRemote = propertyRows.length === 0;
        if (propertyRows.length > 0) {
          const imageResult = await supabase
            .from('property_images')
            .select('property_id, image_url, sort_order')
            .in('property_id', propertyRows.map((row) => row.id))
            .order('sort_order', { ascending: true });

          if (imageResult.error) {
            safeLogError('Supabase property images hydration failed.', imageResult.error);
          } else {
            imageRows = Array.isArray(imageResult.data) ? imageResult.data : [];
            propertyImagesLoadedFromRemote = true;
          }
        }

        if (cancelled) return;

        const imagesByProperty = imageRows.reduce((acc, row) => {
          const key = String(row.property_id || '');
          if (!key) return acc;
          if (!acc[key]) acc[key] = [];
          acc[key].push(String(row.image_url || '').trim());
          return acc;
        }, {});

        const hydratedProperties = propertyRows.map((row) => mapDbPropertyToLocal(row, imagesByProperty[row.id] || [], {
          ownerId: row.owner_id || supabaseUserId,
        }));
        const hydratedServices = serviceRows.map((row) => mapDbServiceToLocal(row, {
          ownerId: row.owner_id || supabaseUserId,
        }));

        setPropertyPortfolio((prev) => {
          const prior = Array.isArray(prev) ? prev : [];
          const preservedNonUser = prior.filter((item) => !isUserOwnedPropertyRecord(item));
          const prevById = prior.reduce((m, it) => { m[String(it.id)] = it; return m; }, {});
          const merged = hydratedProperties.map((hp) => {
            const local = prevById[String(hp.id)];
            const localImages = normalizePortfolioImages(local?.images);
            const serverImages = normalizePortfolioImages(hp.images);
            // Nunca permitir que uma leitura remota vazia apague imagens locais em memória.
            const resolvedImages = propertyImagesLoadedFromRemote
              ? (serverImages.length > 0 ? serverImages : localImages)
              : localImages;
            return {
              ...local,
              ...hp,
              images: resolvedImages,
              ownerId: hp.ownerId || supabaseUserId,
            };
          });
          // Inclui registros locais ainda não sincronizados
          const hydratedIds = new Set(hydratedProperties.map((h) => String(h.id)));
          const additionalLocal = prior
            .filter((item) => isUserOwnedPropertyRecord(item) && !hydratedIds.has(String(item.id)))
            .map((item) => ({
              ...item,
              ownerId: String(item?.ownerId || '') === String(LOCAL_OWNER_ID) ? supabaseUserId : item.ownerId,
            }));
          return [...preservedNonUser, ...merged, ...additionalLocal];
        });

        setServicePortfolio((prev) => {
          const prior = Array.isArray(prev) ? prev : [];
          const preserved = prior.filter((item) => !isUserOwnedServiceRecord(item));

          const prevById = prior.reduce((m, it) => { m[String(it.id)] = it; return m; }, {});

          const merged = hydratedServices.map((hs) => {
            const local = prevById[String(hs.id)];
            if (local) {
              // Server is canonical for synced records; local is used only for keys
              // not present in DB payload.
              return {
                ...local,
                ...hs,
                ownerId: hs.ownerId || supabaseUserId,
              };
            }
            return hs;
          });

          // Include any local user-owned items that don't exist on server yet (newly created)
          const hydratedIds = new Set(hydratedServices.map((h) => String(h.id)));
          const additionalLocal = prior
            .filter((item) => isUserOwnedServiceRecord(item) && !hydratedIds.has(String(item.id)))
            .map((item) => ({
              ...item,
              ownerId: String(item?.ownerId || '') === String(LOCAL_OWNER_ID) ? supabaseUserId : item.ownerId,
            }));

          return [...preserved, ...merged, ...additionalLocal];
        });
      } catch (error) {
        if (!cancelled) {
          safeLogError('Supabase portfolio hydration failed.', error);
        }
      } finally {
        if (!cancelled) {
          const fullyLoadedFromRemote = servicesLoadedFromRemote && propertiesLoadedFromRemote && propertyImagesLoadedFromRemote;
          portfolioSyncStateRef.current = {
            userId: supabaseUserId,
            loaded: true,
            hydrating: false,
            servicesLoadedFromRemote,
            propertiesLoadedFromRemote,
            propertyImagesLoadedFromRemote,
          };
          schedulePortfolioSyncSnapshot();

          if (fullyLoadedFromRemote) {
            portfolioHydrationRetryRef.current.attempts = 0;
            setPortfolioHydrationAttempts(0);
          } else if (portfolioHydrationRetryRef.current.attempts < 6) {
            portfolioHydrationRetryRef.current.attempts += 1;
            setPortfolioHydrationAttempts(portfolioHydrationRetryRef.current.attempts);
            portfolioHydrationRetryRef.current.timer = setTimeout(() => {
              portfolioHydrationRetryRef.current.timer = null;
              refreshPortfolioHydration();
            }, 2500);
          }

          setIsHydratingPortfolio(false);
        }
      }
    };

    hydratePortfolioFromSupabase();

    return () => {
      cancelled = true;
      setIsHydratingPortfolio(false);
    };
  }, [supabaseUserId, portfolioHydrationCycle, portfolioHydrationRetryRef, portfolioSyncStateRef, refreshPortfolioHydration, schedulePortfolioSyncSnapshot, setIsHydratingPortfolio]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (!portfolioSyncStateRef.current.loaded || portfolioSyncStateRef.current.hydrating) return;

    const userOwnedServices = (servicePortfolio || []).filter((service) => isUserOwnedServiceRecord(service));
    const missingUuid = userOwnedServices.filter((service) => !isUuid(service?.id));

    if (missingUuid.length > 0) {
      const replacements = new Map(missingUuid.map((service) => [String(service.id), crypto.randomUUID()]));
      const timer = window.setTimeout(() => {
        setServicePortfolio((prev) => (prev || []).map((service) => {
          const key = String(service?.id);
          if (!replacements.has(key)) return service;
          return {
            ...service,
            id: replacements.get(key),
            source: service?.source || 'portfolio',
            ownerId: supabaseUserId,
          };
        }));
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (profileSaveDebounceRef.current.services) clearTimeout(profileSaveDebounceRef.current.services);
    const syncServices = async () => {
      pendingFlushRef.current.services = null;
      try {
        if (userOwnedServices.length === 0) return;

        const payload = await Promise.all(userOwnedServices.map(async (service) => {
          const row = mapLocalServiceToDb(service, supabaseUserId);
          const uploadedImages = await Promise.all(getLocalServiceMediaImages(service).map(async (imageUrl, index) => {
            let finalUrl = imageUrl;
            if (finalUrl && isInlineMediaUrl(finalUrl)) {
              try {
                finalUrl = await uploadDataUrlToStorage(
                  finalUrl,
                  'property-images',
                  `${supabaseUserId}/services/${row.id}/${index}.jpg`,
                  supabase
                );
              } catch (uploadErr) {
                safeLogError('Service image upload to Storage failed; skipping inline media persistence.', uploadErr);
                finalUrl = '';
              }
            }
            return String(finalUrl || '').trim();
          }));
          return {
            ...row,
            media_images: normalizePersistableMediaUrls(uploadedImages),
          };
        }));
        lastLocalSupabaseWriteAtRef.current = Date.now();
        const { error: upsertError } = await supabase
          .from('services')
          .upsert(payload, { onConflict: 'id' });
        if (upsertError) {
          safeLogError('Supabase services persistence failed.', upsertError);
          return;
        }
      } catch (error) {
        safeLogError('Supabase services persistence failed.', error);
      }
    };
    pendingFlushRef.current.services = syncServices;
    profileSaveDebounceRef.current.services = setTimeout(syncServices, 900);
    const servicesDebounceTimer = profileSaveDebounceRef.current.services;

    return () => {
      if (servicesDebounceTimer) clearTimeout(servicesDebounceTimer);
    };
  }, [supabaseUserId, servicePortfolio, pendingFlushRef, profileSaveDebounceRef, portfolioSyncStateRef]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (!portfolioSyncStateRef.current.loaded || portfolioSyncStateRef.current.hydrating) return;

    const userOwnedProperties = (propertyPortfolio || []).filter((property) => isUserOwnedPropertyRecord(property));
    const missingUuid = userOwnedProperties.filter((property) => !isUuid(property?.id));

    if (missingUuid.length > 0) {
      const replacements = new Map(missingUuid.map((property) => [String(property.id), crypto.randomUUID()]));
      const timer = window.setTimeout(() => {
        setPropertyPortfolio((prev) => (prev || []).map((property) => {
          const key = String(property?.id);
          if (!replacements.has(key)) return property;
          return {
            ...property,
            id: replacements.get(key),
            portfolioId: replacements.get(key),
            source: property?.source || 'portfolio',
            ownerId: supabaseUserId,
          };
        }));
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (profileSaveDebounceRef.current.properties) clearTimeout(profileSaveDebounceRef.current.properties);

    const syncProperties = async () => {
      try {
        if (userOwnedProperties.length === 0) return;

        const payload = userOwnedProperties.map((property) => mapLocalPropertyToDb(property, supabaseUserId));
        lastLocalSupabaseWriteAtRef.current = Date.now();
        let { error: upsertError } = await supabase
          .from('properties')
          .upsert(payload, { onConflict: 'id' });

        if (upsertError && isPropertiesOptionalColumnMissingError(upsertError)) {
          const payloadWithoutOptionalColumns = payload.map((row) => {
            const rest = { ...row };
            delete rest.video;
            delete rest.lat;
            delete rest.lng;
            delete rest.geocode_status;
            delete rest.geocode_source;
            delete rest.geocode_confidence;
            delete rest.geocode_input;
            delete rest.geocoded_at;
            return rest;
          });
          const retry = await supabase
            .from('properties')
            .upsert(payloadWithoutOptionalColumns, { onConflict: 'id' });
          upsertError = retry.error;
        }

        if (upsertError) {
          safeLogError('Supabase properties persistence failed.', upsertError);
          return;
        }

        for (const row of payload) {
          const localProperty = userOwnedProperties.find((item) => String(item.id) === String(row.id));
          const images = normalizePortfolioImages(localProperty?.images);

          // Protecao anti-perda: nunca apagar imagens remotas quando estado local vier vazio.
          if (!images.length) continue;

          const uploadedImages = await Promise.all(
            images.map(async (imageUrl, index) => {
              let finalUrl = imageUrl;
              if (finalUrl && finalUrl.startsWith('data:image')) {
                try {
                  finalUrl = await uploadDataUrlToStorage(
                    finalUrl,
                    'property-images',
                    `${supabaseUserId}/${row.id}/${index}.jpg`,
                    supabase
                  );
                } catch (uploadErr) {
                  safeLogError('Property image upload to Storage failed; skipping inline media persistence.', uploadErr);
                  finalUrl = '';
                }
              }
              return String(finalUrl || '').trim();
            })
          );

          const sanitizedImages = uploadedImages.filter(Boolean);

          // Preferred path: atomic DB replace (delete + insert in one transaction).
          lastLocalSupabaseWriteAtRef.current = Date.now();
          let { error: replaceImagesError } = await supabase.rpc('replace_property_images', {
            p_property_id: row.id,
            p_image_urls: sanitizedImages,
          });

          // Backward-compatible fallback for environments that have not applied the migration yet.
          if (replaceImagesError && isMissingFunctionError(replaceImagesError, 'replace_property_images')) {
            const fallbackRows = sanitizedImages.map((imageUrl, index) => ({
              property_id: row.id,
              image_url: imageUrl,
              sort_order: index,
            }));

            const { error: deleteImagesError } = await supabase
              .from('property_images')
              .delete()
              .eq('property_id', row.id);

            if (deleteImagesError) {
              safeLogError('Supabase property images cleanup failed for property.', deleteImagesError);
              continue;
            }

            lastLocalSupabaseWriteAtRef.current = Date.now();
            const { error: insertImagesError } = await supabase
              .from('property_images')
              .insert(fallbackRows);

            if (insertImagesError) {
              safeLogError('Supabase property images persistence failed.', insertImagesError);
            }
            continue;
          }

          if (replaceImagesError) {
            safeLogError('Supabase property images replace RPC failed.', replaceImagesError);
          }
        }
      } catch (error) {
        safeLogError('Supabase properties persistence failed.', error);
      }
    };

    pendingFlushRef.current.properties = syncProperties;
    profileSaveDebounceRef.current.properties = setTimeout(syncProperties, 900);
    const propertiesDebounceTimer = profileSaveDebounceRef.current.properties;

    return () => {
      if (propertiesDebounceTimer) clearTimeout(propertiesDebounceTimer);
    };
  }, [supabaseUserId, propertyPortfolio, pendingFlushRef, profileSaveDebounceRef, portfolioSyncStateRef]);

  useEffect(() => {
    try {
      localStorage.setItem('systemAccount', JSON.stringify(systemAccount || {}));
    } catch (error) {
      console.error('Failed to persist system account.', error);
    }
  }, [systemAccount]);

  useEffect(() => {
    try {
      localStorage.setItem('ds_nuggets', String(nuggets));
    } catch (error) {
      console.error('Failed to persist nuggets.', error);
    }
  }, [nuggets]);

  useEffect(() => {
    try {
      localStorage.setItem('ds_subscription_mock', JSON.stringify(subscription || {}));
    } catch (error) {
      console.error('Failed to persist subscription.', error);
    }
  }, [subscription]);

  const accessSubscription = useMemo(() => (
    isAdmin
      ? { planId: 'admin', id: 'admin', planName: 'Admin', status: 'active' }
      : subscription
  ), [isAdmin, subscription]);

  const chatNotifications = useMemo(() => {
    const entries = Object.entries(convos || {});
    let seenIncomingByContact = {};
    try {
      const saved = localStorage.getItem('chatSeenIncomingByContact');
      const parsed = saved ? JSON.parse(saved) : {};
      seenIncomingByContact = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      seenIncomingByContact = {};
    }

    return entries
      .filter(([ownerId, msgs]) => {
        if (!Array.isArray(msgs) || msgs.length === 0) return false;
        const isUnlocked = (unlocked || []).some((id) => String(id) === String(ownerId));
        if (!isUnlocked) return false;
        const incomingCount = msgs.filter((m) => m?.from !== 'me').length;
        const seenCount = Number(seenIncomingByContact?.[ownerId] || 0);
        const unreadCount = Math.max(0, incomingCount - seenCount);
        return unreadCount > 0;
      })
      .map(([ownerId, msgs]) => {
        const incomingMessages = msgs.filter((m) => m?.from !== 'me');
        const lastIncoming = incomingMessages[incomingMessages.length - 1] || msgs[msgs.length - 1];
        const ownerIdStr = String(ownerId);
        const target =
          (matched || []).find((m) => String(m.id) === ownerIdStr)
          || (CARDS || []).find((c) => String(c.id) === ownerIdStr)
          || null;
        const incomingCount = incomingMessages.length;
        const seenCount = Number(seenIncomingByContact?.[ownerId] || 0);
        const unreadCount = Math.max(0, incomingCount - seenCount);
        return {
          id: `chat-${ownerId}`,
          ownerId,
          target,
          title: target?.name ? `Chat ${target.name}` : `Chat ${ownerId}`,
          message: String(lastIncoming?.text || '').slice(0, 90) || 'Nova atividade no chat',
          count: unreadCount,
        };
      })
      .sort((a, b) => (b.count || 0) - (a.count || 0));
  }, [convos, unlocked, matched]);

  const markChatNotificationAsRead = (notification) => {
    const ownerIdRaw = notification?.ownerId;
    if (ownerIdRaw == null) return;
    const ownerId = String(ownerIdRaw);
    const msgs = Array.isArray(convos?.[ownerId]) ? convos[ownerId] : [];
    const incomingCount = msgs.filter((m) => m?.from !== 'me').length;
    try {
      const saved = localStorage.getItem('chatSeenIncomingByContact');
      const parsed = saved ? JSON.parse(saved) : {};
      const next = parsed && typeof parsed === 'object' ? { ...parsed } : {};
      next[ownerId] = incomingCount;
      localStorage.setItem('chatSeenIncomingByContact', JSON.stringify(next));
      setChatSeenVersion((v) => v + 1);
    } catch (error) {
      console.error('Failed to mark chat notification as read.', error);
    }
  };

  const openChatFromNotification = (notification) => {
    const ownerIdRaw = notification?.ownerId;
    if (ownerIdRaw == null) return;
    const ownerId = String(ownerIdRaw);
    const target =
      notification?.target
      || (matched || []).find((m) => String(m.id) === ownerId)
      || (CARDS || []).find((c) => String(c.id) === ownerId)
      || { id: ownerIdRaw, ownerId: ownerIdRaw, name: `Chat ${ownerId}` };

    setMatched((prev) => (prev.some((m) => String(m.id) === ownerId) ? prev : [...prev, target]));
    setChatFocusTarget(target);
    setChatFocusToken((v) => v + 1);
    setPage('matches');
  };

  const appendChatMessageToState = useCallback((messageRow) => {
    if (!messageRow || !supabaseUserId) return;
    const senderId = String(messageRow.sender_id || '').trim();
    const recipientId = String(messageRow.recipient_id || '').trim();
    if (!senderId || !recipientId) return;
    const peerId = senderId === String(supabaseUserId) ? recipientId : senderId;
    const metadata = messageRow.metadata && typeof messageRow.metadata === 'object' ? messageRow.metadata : {};
    const mapped = {
      id: messageRow.id,
      from: senderId === String(supabaseUserId) ? 'me' : 'them',
      text: messageRow.body || '',
      type: messageRow.message_type || metadata.type || 'text',
      refData: metadata.refData || null,
      originalText: metadata.originalText || messageRow.body || '',
      originalLang: metadata.originalLang || '',
      translatedText: messageRow.body || '',
      translatedLang: metadata.translatedLang || '',
      createdAt: messageRow.created_at || null,
    };
    setConvos((prev) => {
      const current = Array.isArray(prev?.[peerId]) ? prev[peerId] : [];
      if (mapped.id && current.some((msg) => String(msg?.id || '') === String(mapped.id))) return prev;
      return {
        ...(prev || {}),
        [peerId]: [...current, mapped].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
      };
    });
  }, [supabaseUserId, globalFeedRefreshTick]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return undefined;
    let timer = null;
    const scheduleGlobalRefresh = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        setGlobalFeedRefreshTick((value) => value + 1);
      }, 1400);
    };

    const channel = supabase
      .channel(`global-feed-refresh-${supabaseUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, scheduleGlobalRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_images' }, scheduleGlobalRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, scheduleGlobalRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, scheduleGlobalRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'professional_profiles' }, scheduleGlobalRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'card_spotlights' }, scheduleGlobalRefresh)
      .subscribe();

    return () => {
      if (timer) window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [supabaseUserId]);

  const sendChatMessage = useCallback(async (payload = {}) => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    const recipientId = String(payload.recipientId || '').trim();
    const text = String(payload.text || '').trim();
    if (!recipientId || !text) return;

    const optimisticId = `pending:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: optimisticId,
      sender_id: supabaseUserId,
      recipient_id: recipientId,
      contact_owner_id: payload.contactOwnerId || recipientId,
      body: text,
      message_type: payload.type || 'text',
      metadata: {
        refData: payload.refData || null,
        originalText: payload.originalText || text,
        originalLang: payload.originalLang || '',
        translatedLang: payload.translatedLang || '',
      },
      created_at: new Date().toISOString(),
    };
    appendChatMessageToState(optimistic);

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        sender_id: supabaseUserId,
        recipient_id: recipientId,
        contact_owner_id: payload.contactOwnerId || recipientId,
        body: text,
        message_type: payload.type || 'text',
        metadata: optimistic.metadata,
      })
      .select('id, sender_id, recipient_id, contact_owner_id, body, message_type, metadata, created_at')
      .single();

    if (error) {
      safeLogError('Chat message persistence failed.', error);
      addToast({ type: 'error', message: 'Chat message could not be sent.' });
      return;
    }

    setConvos((prev) => {
      const current = Array.isArray(prev?.[recipientId]) ? prev[recipientId] : [];
      return {
        ...(prev || {}),
        [recipientId]: current.filter((msg) => String(msg?.id || '') !== optimisticId),
      };
    });
    appendChatMessageToState(data);
  }, [addToast, appendChatMessageToState, supabase, supabaseUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      window.setTimeout(() => setConvos({}), 0);
      return undefined;
    }

    let cancelled = false;
    const hydrateChatMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, sender_id, recipient_id, contact_owner_id, body, message_type, metadata, created_at')
        .or(`sender_id.eq.${supabaseUserId},recipient_id.eq.${supabaseUserId}`)
        .order('created_at', { ascending: true })
        .limit(500);
      if (cancelled) return;
      if (error) {
        safeLogError('Chat message hydration failed.', error);
        return;
      }
      const grouped = {};
      (Array.isArray(data) ? data : []).forEach((row) => {
        const senderId = String(row.sender_id || '').trim();
        const recipientId = String(row.recipient_id || '').trim();
        const peerId = senderId === String(supabaseUserId) ? recipientId : senderId;
        if (!peerId) return;
        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        if (!grouped[peerId]) grouped[peerId] = [];
        grouped[peerId].push({
          id: row.id,
          from: senderId === String(supabaseUserId) ? 'me' : 'them',
          text: row.body || '',
          type: row.message_type || metadata.type || 'text',
          refData: metadata.refData || null,
          originalText: metadata.originalText || row.body || '',
          originalLang: metadata.originalLang || '',
          translatedText: row.body || '',
          translatedLang: metadata.translatedLang || '',
          createdAt: row.created_at || null,
        });
      });
      setConvos(grouped);
    };

    hydrateChatMessages();
    const channel = supabase
      .channel(`chat-messages-${supabaseUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `recipient_id=eq.${supabaseUserId}` }, (payload) => appendChatMessageToState(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `sender_id=eq.${supabaseUserId}` }, (payload) => appendChatMessageToState(payload.new))
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [appendChatMessageToState, supabase, supabaseUserId]);

  const openSettingsTab = (tab = 'profile') => {
    setSettingsInitialTab(tab);
    setPage('settings');
  };

  const openOnboardingTab = (tab = 'personal') => {
    const normalized = String(tab || '').trim().toLowerCase();
    const professionalTabs = new Set(['professional', 'business', 'secondary', 'operation', 'operations']);
    const fsboTabs = new Set(['fsbo', 'fsbo_owner']);
    const nextTab = professionalTabs.has(normalized)
      ? (normalized === 'operation' || normalized === 'operations' ? 'operation' : 'professional')
      : (normalized === 'skills' ? 'skills' : 'personal');

    // Ao abrir onboarding para escopos profissionais, garante o contexto correto da conta.
    if (nextTab === 'professional' || nextTab === 'operation' || nextTab === 'skills') {
      setAccountType('professional');
    } else if (fsboTabs.has(normalized)) {
      setAccountType('fsbo_owner');
    }

    setOnboardingInitialTab(nextTab);
    setPage('onboarding');
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    if (page === 'admin') setPage('dashboard');
  };

  const handleUserLogout = useCallback(async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        void e;
      }
    }

    setAuthSession(null);
    try { localStorage.removeItem('authSession'); } catch { /* no-op */ }
    safeSessionRemove(APP_SESSION_TOKEN_KEY);
    appendSecurityAuditEvent({ type: 'logout', status: 'success', message: 'User signed out from current device.' });
    setModal(null);
    setPage('landing');
  }, [setPage]);

  useEffect(() => {
    handleUserLogoutRef.current = handleUserLogout;
  }, [handleUserLogout]);

  const handleOpenModal = (nextModal) => {
    if (nextModal === 'store') {
      openPricingHub();
      return;
    }
    setModal(nextModal);
  };

  const handleAdminAuthSubmit = async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      addToast({ type: 'error', message: supabaseConfigHint || 'Supabase nao configurado.' });
      return false;
    }
    setIsAdminAuthProcessing(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: String(email || '').trim(),
        password: String(password || ''),
      });
      if (error) throw error;
      const userId = data?.session?.user?.id;
      if (!userId) { addToast({ type: 'error', message: 'Falha ao obter sessão.' }); return false; }
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', userId)
        .single();
      if (userError || !userRow?.is_admin) {
        addToast({ type: 'error', message: 'Acesso admin não autorizado para esta conta.' });
        return false;
      }
      const next = mapSupabaseUserToSession(data.session.user, 'login', 'credentials');
      setAuthSession(next);
      setIsAdmin(true);
      setModal(null);
      setPage('admin');
      return true;
    } catch (err) {
      addToast({ type: 'error', title: 'Erro admin', message: String(err?.message || 'Falha na autenticação admin.') });
      return false;
    } finally {
      setIsAdminAuthProcessing(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      addToast({ type: 'error', message: 'Faça login para excluir sua conta.' });
      return;
    }
    setIsAccountProcessing(true);
    try {
      const { error } = await supabase.rpc('delete_user_account', { target_user_id: supabaseUserId });
      if (error) throw error;
      // Sign out and clear all local data
      try { await supabase.auth.signOut(); } catch { /* no-op */ }
      try { await clearAllUserData(); } catch { /* no-op */ }
      setAuthSession(null);
      const keysToKeep = ['theme'];
      const allKeys = [];
      for (let i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
      allKeys.forEach((key) => {
        if (key && !keysToKeep.includes(key)) {
          try { localStorage.removeItem(key); } catch { /* no-op */ }
        }
      });
      addToast({ type: 'success', title: 'Conta excluída', message: 'Todos os seus dados foram removidos.', duration: 6000 });
      setPage('landing');
    } catch (err) {
      addToast({ type: 'error', title: 'Erro ao excluir', message: String(err?.message || 'Falha ao excluir conta.') });
    } finally {
      setIsAccountProcessing(false);
    }
  };

  const blockingProcessingMessage = useMemo(() => {
    const t = getT();
    if (isAuthProcessing) return 'Autenticando conta...';
    if (isAdminAuthProcessing) return 'Validando acesso administrativo...';
    if (isForgotPasswordProcessing) return 'Enviando recuperação de senha...';
    if (isConsentProcessing) return 'Processando consentimento...';
    if (isAccountProcessing) return 'Processando sua conta...';
    if (checkoutSubmitting) return t.modals?.checkoutRedirecting || t.modals?.checkoutPreparing || 'Preparando checkout seguro...';
    if ((isHydratingProfiles || isHydratingPortfolio) && showHydrationBlocking) return 'Carregando dados do app...';
    return '';
  }, [isAuthProcessing, isAdminAuthProcessing, isForgotPasswordProcessing, isConsentProcessing, isAccountProcessing, checkoutSubmitting, isHydratingProfiles, isHydratingPortfolio, showHydrationBlocking]);

  const showBlockingProcessing = Boolean(blockingProcessingMessage);
  const showHydrationBackgroundSync = (isHydratingProfiles || isHydratingPortfolio) && !showBlockingProcessing;
  const showSyncProcessing = (profileSyncStatus === 'syncing' || showHydrationBackgroundSync) && !showBlockingProcessing;
  const syncProcessingLabel = showHydrationBackgroundSync
    ? 'Sincronizando dados em segundo plano...'
    : 'Salvando dados...';

  const handleSubscriptionChanged = (nextSubscription) => {
    if (!nextSubscription?.planId) return;
    const prevPlanId = subscription?.planId || 'free';
    const nextPlanId = nextSubscription.planId;
    const prevBonus = PLAN_BONUS_BY_TIER[prevPlanId] || 0;
    const nextBonus = PLAN_BONUS_BY_TIER[nextPlanId] || 0;
    const bonusDelta = Math.max(0, nextBonus - prevBonus);

    setSubscription(nextSubscription);

    if (bonusDelta > 0) {
      setNuggets((current) => current + bonusDelta);
      setSystemNotifications((prev) => ([
        {
          id: `sys-plan-bonus-${Date.now()}`,
          title: 'Bonus de Plano Aplicado',
          message: `+${bonusDelta} nuggets adicionados ao migrar para ${nextSubscription.planName || nextPlanId}.`,
          createdAt: Date.now(),
          read: false,
        },
        ...(prev || []),
      ]).slice(0, 60));
    }
  };

  const resendEmailVerificationForAccount = async ({ email } = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, message: 'Supabase nao configurado para reenviar confirmacao.' };
    }

    const target = String(email || authSession?.email || '').trim().toLowerCase();
    if (!target.includes('@')) {
      return { ok: false, message: 'Email invalido para reenviar confirmacao.' };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: target,
        options: { emailRedirectTo: authRedirectUrl },
      });
      if (error) throw error;

      addToast({
        type: 'success',
        title: 'Email enviado',
        message: 'Enviamos um novo email de confirmacao para sua conta. Depois, volte ao onboarding e atualize o status do perfil.',
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: String(err?.message || 'Falha ao reenviar email de confirmacao.') };
    }
  };

  const fetchPropertyUnlockQuote = useCallback(async (propertyId) => {
    if (!propertyId || !isUuid(propertyId) || !isSupabaseConfigured || !supabase || !supabaseUserId) return null;
    const requestId = ++unlockQuoteRequestRef.current;
    try {
      const { data, error } = await supabase.rpc('ds_get_property_unlock_quote', {
        p_property_id: propertyId,
      });
      if (error) throw error;
      if (requestId !== unlockQuoteRequestRef.current) return null;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      const quote = {
        propertyId: row.property_id || propertyId,
        ownerId: row.owner_id || null,
        baseCost: Math.max(1, Number(row.base_cost || 1)),
        normalUnlockCount: Number(row.normal_unlock_count || 0),
        exclusivityKind: String(row.exclusivity_kind || 'regular'),
        exclusivityCost: Math.max(0, Number(row.exclusivity_cost || 0)),
        blocked: row.blocked === true,
        expiresAt: row.expires_at || null,
      };
      setUnlockQuote(quote);
      return quote;
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[Unlock] Failed to fetch property quote.', error);
      return null;
    }
  }, [supabaseUserId]);

  const openUnlock = (card, context = {}) => {
    const unlockOwnerId = resolveUnlockOwnerId(
      context.owner || context.ownerId || context.property || card,
      unlockPortfolioProperties || [],
      unlockPortfolioServices || []
    );
    const nextTarget = {
      ...(card || {}),
      unlockOwnerId,
      unlockScope: context.unlockScope || card?.unlockScope || 'contact',
      propertyId: context.propertyId || context.property?.id || card?.propertyId || null,
      propertyAddress: context.propertyAddress || context.property?.address || card?.propertyAddress || '',
    };
    setUnlockQuote(null);
    setUnlockTarget(nextTarget);
    setModal('unlock');
    if (nextTarget.unlockScope === 'property' && nextTarget.propertyId) {
      void fetchPropertyUnlockQuote(nextTarget.propertyId);
    } else {
      const linkedOwnerId = resolveUnlockOwnerId(nextTarget, unlockPortfolioProperties || [], unlockPortfolioServices || []);
      const linkedProperty = (unlockPortfolioProperties || []).find((property) => (
        String(property?.ownerId || '') === String(linkedOwnerId)
        && isTruthyFlag(property?.isActive, true)
        && isTruthyFlag(property?.publishToShowcase, true)
        && property?.dealClosed !== true
      ));
      if (linkedProperty?.id && isUuid(linkedProperty.id)) {
        void fetchPropertyUnlockQuote(linkedProperty.id);
      }
    }
  };

  const getUnlockCost = (card) => {
    if (!card?.id && !card?.ownerId && !card?.unlockOwnerId) return 1;
    const localPortfolioCost = getPortfolioUnlockCost(card, unlockPortfolioProperties || [], unlockPortfolioServices || []);
    if (
      card?.unlockScope === 'property'
      && unlockQuote?.propertyId
      && String(unlockQuote.propertyId) === String(card?.propertyId)
    ) {
      return Math.max(1, localPortfolioCost, Number(unlockQuote.baseCost || 1));
    }
    return localPortfolioCost;
  };

  const getUnlockExclusivityStatus = (card) => {
    if (!card?.propertyId || card?.unlockScope !== 'property') return null;
    if (!isUuid(card.propertyId) && !(isAdmin && isMockPropertyId(card.propertyId))) return null;
    if (unlockQuote?.propertyId && String(unlockQuote.propertyId) === String(card.propertyId)) {
      if (unlockQuote.blocked) {
        return {
          kind: 'blocked',
          badge: 'Exclusive',
          unlockCount: unlockQuote.normalUnlockCount,
          canBuyExclusivity: false,
          exclusiveCost: 0,
          expiresAt: unlockQuote.expiresAt,
        };
      }
      if (unlockQuote.exclusivityKind === 'new') {
        return {
          kind: 'new',
          badge: 'New',
          unlockCount: 0,
          canBuyExclusivity: true,
          exclusivityMode: 'total',
          exclusiveCost: unlockQuote.exclusivityCost,
        };
      }
      if (unlockQuote.exclusivityKind === 'partial') {
        return {
          kind: 'partial',
          badge: `Only ${unlockQuote.normalUnlockCount} unlock${unlockQuote.normalUnlockCount === 1 ? '' : 's'}`,
          unlockCount: unlockQuote.normalUnlockCount,
          canBuyExclusivity: true,
          exclusivityMode: 'partial',
          exclusiveCost: unlockQuote.exclusivityCost,
        };
      }
    }
    return getPropertyExclusivityStatus(propertyUnlocks, card.propertyId, supabaseUserId || 'local-user');
  };

  const getContactExclusivityOption = (card) => {
    if (!card || card.unlockScope === 'property') return null;
    const unlockOwnerId = resolveUnlockOwnerId(card, unlockPortfolioProperties || [], unlockPortfolioServices || []);
    if (!unlockOwnerId) return null;

    const baseCost = getPortfolioUnlockCost(card, unlockPortfolioProperties || [], unlockPortfolioServices || []);
    const candidates = (unlockPortfolioProperties || [])
      .filter((property) => (
        (isUuid(property?.id) || (isAdmin && isMockPropertyId(property?.id)))
        && String(property?.ownerId || '') === String(unlockOwnerId)
        && isTruthyFlag(property?.isActive, true)
        && isTruthyFlag(property?.publishToShowcase, true)
        && property?.dealClosed !== true
      ))
      .map((property) => ({
        property,
        status: getPropertyExclusivityStatus(propertyUnlocks, property.id, supabaseUserId || 'local-user'),
      }))
      .filter(({ status }) => status?.canBuyExclusivity && Number(status?.exclusiveCost || 0) > 0)
      .sort((a, b) => {
        if (a.status.kind === b.status.kind) return 0;
        if (a.status.kind === 'new') return -1;
        if (b.status.kind === 'new') return 1;
        return 0;
      });

    const selected = candidates[0];
    if (!selected) return null;
    const quoteStatus = unlockQuote?.propertyId && String(unlockQuote.propertyId) === String(selected.property.id)
      ? (() => {
        if (unlockQuote.blocked) {
          return {
            kind: 'blocked',
            canBuyExclusivity: false,
            exclusiveCost: 0,
            unlockCount: unlockQuote.normalUnlockCount,
            expiresAt: unlockQuote.expiresAt,
          };
        }
        if (unlockQuote.exclusivityKind === 'new') {
          return {
            kind: 'new',
            canBuyExclusivity: true,
            exclusivityMode: 'total',
            exclusiveCost: unlockQuote.exclusivityCost,
            unlockCount: 0,
          };
        }
        if (unlockQuote.exclusivityKind === 'partial') {
          return {
            kind: 'partial',
            canBuyExclusivity: true,
            exclusivityMode: 'partial',
            exclusiveCost: unlockQuote.exclusivityCost,
            unlockCount: unlockQuote.normalUnlockCount,
          };
        }
        return { kind: 'regular', canBuyExclusivity: false, exclusiveCost: 0 };
      })()
      : selected.status;

    if (!quoteStatus?.canBuyExclusivity || Number(quoteStatus?.exclusiveCost || 0) <= 0) return null;

    const images = selected.property?.images || selected.property?.media?.images || [];
    return {
      property: selected.property,
      status: quoteStatus,
      baseCost,
      exclusiveCost: baseCost + Number(quoteStatus.exclusiveCost || 0),
      mode: quoteStatus.exclusivityMode || (quoteStatus.kind === 'partial' ? 'partial' : 'total'),
      title: selected.property?.address || selected.property?.title || selected.property?.name || 'Showcase property',
      location: [selected.property?.city, selected.property?.state, selected.property?.zip].filter(Boolean).join(', '),
      image: images[0] || selected.property?.image || selected.property?.photo || '',
    };
  };

  const handleUnlock = async (card, options = {}) => {
    const unlockMode = options?.mode || 'normal';
    const unlockOwnerId = card?.unlockOwnerId || card?.ownerId || card?.id;
    const contactUnlockId = card?.unlockContactId || card?.contactId || card?.id || unlockOwnerId;
    let quoteForUnlock = (
      card?.unlockScope === 'property'
      && unlockQuote?.propertyId
      && String(unlockQuote.propertyId) === String(card?.propertyId)
    ) ? unlockQuote : null;
    if (!quoteForUnlock && card?.unlockScope === 'property' && card?.propertyId) {
      quoteForUnlock = await fetchPropertyUnlockQuote(card.propertyId);
    }
    const baseUnlockCost = quoteForUnlock?.baseCost
      ? Math.max(
        1,
        Number(quoteForUnlock.baseCost),
        getPortfolioUnlockCost(card, unlockPortfolioProperties || [], unlockPortfolioServices || [])
      )
      : getUnlockCost(card);
    const quoteExclusiveCost = quoteForUnlock?.exclusivityCost != null
      ? Math.max(0, Number(quoteForUnlock.exclusivityCost || 0))
      : null;
    const unlockCost = unlockMode !== 'normal' && quoteExclusiveCost != null
      ? baseUnlockCost + quoteExclusiveCost
      : Number(options?.cost || baseUnlockCost);
    const isPropertyUnlock = card?.unlockScope === 'property';
    const isMockSandboxPropertyUnlock = Boolean(
      isPropertyUnlock
      && !isUuid(card?.propertyId)
      && isAdmin
      && isMockPropertyId(card?.propertyId)
    );
    if (isPropertyUnlock) {
      if (!card?.propertyId || (!isUuid(card.propertyId) && !isMockSandboxPropertyUnlock)) {
        addToast({
          type: 'error',
          title: 'Unlock unavailable',
          message: 'This property cannot be unlocked because it is not linked to a saved database record yet.',
        });
        setModal(null);
        setUnlockQuote(null);
        return;
      }
      if (!isMockSandboxPropertyUnlock && (!isSupabaseConfigured || !supabase || !supabaseUserId)) {
        addToast({
          type: 'error',
          title: 'Unlock unavailable',
          message: 'Sign in and wait for the app to sync before unlocking this property.',
        });
        setModal(null);
        setUnlockQuote(null);
        return;
      }
    }
    const unlockGate = canUsePlanAction(accessSubscription, 'unlock', {
      unlocksThisMonth: readPlanUsage('month')?.unlocks || 0,
    });
    if (!unlockGate.allowed) {
      const copy = getPlanGateCopy('unlock');
      trackAppEvent('plan_gate_shown', {
        entityType: 'feature',
        entityId: 'unlock',
        metadata: { feature: 'unlock', source: 'unlock_modal' },
      });
      trackAppEvent('plan_gate_upgrade_clicked', {
        entityType: 'feature',
        entityId: 'unlock',
        metadata: { feature: 'unlock', source: 'unlock_modal_auto_redirect' },
      });
      addToast({ type: 'warning', title: copy.title, message: copy.message, duration: 6500 });
      setModal(null);
      setUnlockQuote(null);
      openPricingHub();
      return;
    }
    if (nuggets >= unlockCost && card) {
        // Snapshot local state so we can rollback if a later step fails
        const prevStateSnapshot = {
          nuggets,
          unlocked: Array.isArray(unlocked) ? [...unlocked] : [],
          propertyUnlocks: Array.isArray(propertyUnlocks) ? [...propertyUnlocks] : [],
          matched: Array.isArray(matched) ? [...matched] : [],
          interested: Array.isArray(interested) ? [...interested] : [],
          purchases: Array.isArray(purchases) ? [...purchases] : [],
        };

        const restorePrevState = () => {
          try {
            setNuggets(prevStateSnapshot.nuggets);
          } catch (e) { void e; }
          try { setUnlocked(prevStateSnapshot.unlocked); } catch (e) { void e; }
          try { setPropertyUnlocks(prevStateSnapshot.propertyUnlocks); } catch (e) { void e; }
          try { setMatched(prevStateSnapshot.matched); } catch (e) { void e; }
          try { setInterested(prevStateSnapshot.interested); } catch (e) { void e; }
          try { setPurchases(prevStateSnapshot.purchases); } catch (e) { void e; }
        };

        let remoteUnlockRow = null;
      if (
        isPropertyUnlock
        && !isMockSandboxPropertyUnlock
      ) {
        try {
          const { data, error } = await supabase.rpc('ds_purchase_property_unlock', {
            p_property_id: card.propertyId,
            p_mode: unlockMode,
            p_metadata: {
              source: 'unlock_modal',
              ownerId: String(unlockOwnerId || ''),
              contactId: String(contactUnlockId || ''),
              displayedBaseCost: baseUnlockCost,
              displayedCost: unlockCost,
            },
          });
          if (error) throw error;
          remoteUnlockRow = Array.isArray(data) ? data[0] : data;
          if (!remoteUnlockRow?.unlock_id && !remoteUnlockRow?.id) {
            throw new Error('Property unlock did not return a persisted record.');
          }
          const persistedUnlockId = remoteUnlockRow.unlock_id || remoteUnlockRow.id;
          const { data: confirmedUnlock, error: confirmError } = await supabase
            .from('property_unlocks')
            .select('id, property_id, owner_id, buyer_id, mode, base_cost, exclusivity_cost, total_cost, created_at, expires_at, status')
            .eq('id', persistedUnlockId)
            .eq('buyer_id', supabaseUserId)
            .maybeSingle();
          if (confirmError) throw confirmError;
          if (!confirmedUnlock?.id) {
            throw new Error('Property unlock was not confirmed in the database.');
          }
          remoteUnlockRow = {
            ...remoteUnlockRow,
            ...confirmedUnlock,
            unlock_id: confirmedUnlock.id,
          };
          const remoteTotalCost = Number(remoteUnlockRow?.total_cost);
          if (
            remoteUnlockRow
            && Number.isFinite(Number(remoteUnlockRow.remaining_nuggets))
            && Number.isFinite(remoteTotalCost)
          ) {
            setNuggets(Number(remoteUnlockRow.remaining_nuggets));
          } else {
            throw new Error('Property unlock did not return a confirmed balance.');
          }
        } catch (error) {
          addToast({
            type: 'warning',
            title: 'Unlock unavailable',
            message: error?.message || 'This property could not be unlocked right now. Please try again.',
          });
          setModal(null);
          setUnlockQuote(null);
          return;
        }
      } else if (isMockSandboxPropertyUnlock) {
        addToast({
          type: 'info',
          title: 'Mock sandbox',
          message: 'Test unlock simulated locally for this mock card. No real nuggets, KPI, or Supabase history were changed.',
          duration: 6500,
        });
      } else {
        setNuggets(n => n - unlockCost);
      }
      try {
        setUnlocked((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          const candidates = [contactUnlockId, unlockOwnerId]
            .map((value) => String(value || '').trim())
            .filter(Boolean);
          candidates.forEach((candidate) => {
            if (!next.some((id) => String(id) === candidate)) next.push(candidate);
          });
          return next;
        });
        incrementPlanUsage('month', 'unlocks');
        if (card.unlockScope === 'property' && card.propertyId) {
          setPropertyUnlocks((prev) => {
            const alreadyNormal = unlockMode === 'normal' && prev.some((row) => (
              String(row?.propertyId) === String(card.propertyId)
              && String(row?.buyerId) === String(supabaseUserId || 'local-user')
              && row?.mode === 'normal'
            ));
            if (alreadyNormal) return prev;
            const baseRecord = createPropertyUnlockRecord({
              propertyId: card.propertyId,
              ownerId: unlockOwnerId,
              buyerId: supabaseUserId || 'local-user',
              mode: unlockMode,
              cost: Number(remoteUnlockRow?.total_cost || unlockCost),
            });
            const merged = { ...baseRecord };
            if (remoteUnlockRow) {
              merged.id = remoteUnlockRow.unlock_id || remoteUnlockRow.id || merged.id;
              try {
                if (remoteUnlockRow.created_at) merged.createdAt = Number(Date.parse(String(remoteUnlockRow.created_at)));
              } catch { /* noop */ }
              try {
                if (remoteUnlockRow.expires_at) merged.expiresAt = Number(Date.parse(String(remoteUnlockRow.expires_at)));
              } catch { /* noop */ }
            }
            return [
              ...prev,
              merged,
            ];
          });
        }

        // Ensure unlocked contact stays available in Matches module.
        const matchedCard = { ...card, id: contactUnlockId, ownerId: unlockOwnerId || card.ownerId || contactUnlockId };
        setMatched((prev) => {
          const current = Array.isArray(prev) ? prev : [];
          const filtered = current.filter((item) => {
            const itemId = String(item?.id || '');
            const itemOwnerId = String(item?.ownerId || '');
            return itemId !== String(contactUnlockId) && itemOwnerId !== String(unlockOwnerId || '');
          });
          return [...filtered, matchedCard];
        });
        // Auto-add ALL active properties of this contact to `interested` so the
        // full portfolio appears in the Interests column immediately after unlock.
        const allProps = unlockPortfolioProperties || [];
        const contactProps = allProps.filter(
          (p) => String(p.ownerId) === String(unlockOwnerId) && isTruthyFlag(p?.isActive, true)
        );
        if (contactProps.length > 0) {
          setInterested(prev => {
            const existingIds = new Set(prev.map((x) => String(x.id)));
            const newItems = contactProps.filter((p) => !existingIds.has(String(p.id)));
            return newItems.length ? [...prev, ...newItems] : prev;
          });
        }
        // Record purchase: current user buys this contact
        setPurchases(prev => 
          prev.some(p => String(p.sellerId) === String(unlockOwnerId))
            ? prev 
            : [...prev, { sellerId: unlockOwnerId }]
        );
        setModal(null);
        setUnlockQuote(null);
        window.setTimeout(() => { void fetchRemoteUnlockState(); }, 0);
        // Retry remote state hydration shortly after to cover eventual consistency delays
        window.setTimeout(() => { void fetchRemoteUnlockState(); }, 2000);
        // Trigger a portfolio refresh to ensure UI reflects server-side unlocks
        try { schedulePortfolioRealtimeRefresh(120); } catch (e) { void e; }
        // Navegar para Matches para visualizar o contato
        setChatFocusTarget(matchedCard);
        setChatFocusToken((v) => v + 1);
        setPage('matches');
      } catch {
        // Rollback any optimistic updates
        restorePrevState();
        addToast({ type: 'error', title: 'Unlock failed', message: 'Could not complete unlock. Your balance has been restored.' });
        setModal(null);
        setUnlockQuote(null);
        return;
      }
    } else {
      addToast({ type: 'warning', title: 'Nuggets insuficientes', message: `Você precisa de ${unlockCost} nugget(s) para desbloquear este contato. Vá para Pricing para escolher um upgrade de plano ou pacote extra de nuggets.` });
      setModal(null);
      setUnlockQuote(null);
      openPricingHub();
    }
  };

  const handlePurchaseSpotlights = async (items = []) => {
    const selected = (items || []).filter((item) => item?.cardKind && item?.cardId);
    const totalCost = selected.length * 10;
    if (!selected.length) return;
    if (nuggets < totalCost) {
      addToast({ type: 'warning', title: 'Not enough nuggets', message: `You need ${totalCost} nuggets to activate these spotlights.` });
      openPricingHub();
      return;
    }
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      addToast({ type: 'error', title: 'Spotlight unavailable', message: 'Supabase is required to activate paid spotlights.' });
      return;
    }

    setIsSpotlightProcessing(true);
    try {
      const payload = selected.map((item) => ({
        cardKind: item.cardKind,
        cardId: item.cardId,
        ownerId: supabaseUserId,
        scope: item.scope || '',
        metadata: { source: 'spotlight_modal', title: String(item.title || '').slice(0, 120) },
      }));
      const { data, error } = await supabase.rpc('ds_purchase_card_spotlights', { p_items: payload });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const firstRow = rows[0] || null;
      if (Number.isFinite(Number(firstRow?.remaining_nuggets))) {
        setNuggets(Number(firstRow.remaining_nuggets));
      } else {
        setNuggets((current) => current - totalCost);
      }
      const nextRows = rows.map((row) => ({
        id: row.spotlight_id || `${row.card_kind}:${row.card_id}:${Date.now()}`,
        userId: supabaseUserId,
        ownerId: supabaseUserId,
        cardKind: row.card_kind,
        cardId: row.card_id,
        scope: selected.find((item) => item.cardId === row.card_id)?.scope || '',
        expiresAt: row.expires_at,
        nuggetsSpent: 10,
      }));
      setActiveSpotlights((prev) => [...nextRows, ...(prev || [])]);
      addToast({ type: 'success', title: 'Spotlight activated', message: `${selected.length} card(s) will be featured for 30 days.` });
      setModal(null);
    } catch (error) {
      addToast({ type: 'error', title: 'Spotlight failed', message: String(error?.message || 'Could not activate spotlight right now.') });
    } finally {
      setIsSpotlightProcessing(false);
    }
  };

  const portfolioSyncStatus = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUserId) return 'idle';
    if (isHydratingPortfolio) return 'syncing';
    const state = portfolioSyncSnapshot || {};
    if (!state.loaded) return 'syncing';
    if (state.servicesLoadedFromRemote && state.propertiesLoadedFromRemote && state.propertyImagesLoadedFromRemote) {
      return 'synced';
    }
    return 'degraded';
  }, [isHydratingPortfolio, portfolioSyncSnapshot, supabaseUserId]);

  const profileHydrationReady = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUserId) return true;
    const state = profileSyncSnapshot || {};
    const loaded = Boolean(state.loaded && state.personalLoadedFromRemote && state.professionalLoadedFromRemote);
    if (loaded) return true;
    if (!isHydratingProfiles && profileHydrationAttempts >= 6) return true;
    return false;
  }, [isHydratingProfiles, profileHydrationAttempts, profileSyncSnapshot, supabaseUserId]);

  const portfolioHydrationReady = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUserId) return true;
    const state = portfolioSyncSnapshot || {};
    const loaded = Boolean(state.loaded && state.servicesLoadedFromRemote && state.propertiesLoadedFromRemote && state.propertyImagesLoadedFromRemote);
    if (loaded) return true;
    if (!isHydratingPortfolio && portfolioHydrationAttempts >= 6) return true;
    return false;
  }, [isHydratingPortfolio, portfolioHydrationAttempts, portfolioSyncSnapshot, supabaseUserId]);

  const dashboardHydrationReady = profileHydrationReady && portfolioHydrationReady;
  const dashboardHydrationSyncing = isHydratingProfiles || isHydratingPortfolio;
  const hasPrimaryProfileRegistered = useMemo(() => {
    const hasValue = (value) => String(value ?? '').trim().length > 0;
    return (
      hasValue(personalProfile?.fullName)
      || hasValue(personalProfile?.primaryPhone)
      || hasValue(personalProfile?.email)
      || hasValue(professionalProfile?.fullNameA)
      || hasValue(professionalProfile?.primaryPhoneA)
      || hasValue(professionalProfile?.emailA)
    );
  }, [personalProfile, professionalProfile]);

  const renderPageContent = (pageKey = page) => {
    switch (pageKey) {
      case 'landing':
        return <Landing setPage={setPage} onOpenAuthModal={openAuthModal} />;
      case 'dashboard':
        return (
          <Dashboard
            page={page}
            nuggets={nuggets}
            setModal={handleOpenModal}
            setPage={setPage}
            onOpenOnboardingTab={openOnboardingTab}
            openUnlock={openUnlock}
            unlocked={unlocked}
            matched={matched}
            setMatched={setMatched}
            interested={interested}
            setInterested={setInterested}
            purchases={purchases}
            setPurchases={setPurchases}
            userProfile={userProfile}
            personalProfile={personalProfile}
            professionalProfile={professionalProfile}
            propertyPortfolio={propertyPortfolio}
            servicePortfolio={globalServicePortfolio}
            accountType={accountType}
            showcaseProperties={showcaseProperties}
            categoryOrder={categoryOrder}
            setCategoryOrder={setCategoryOrder}
            editMode={editMode}
            setEditMode={setEditMode}
            mobileBottomNavCollapsed={mobileBottomNavCollapsed}
            addToast={addToast}
            setSystemNotifications={setSystemNotifications}
            isHydrationReady={dashboardHydrationReady}
            isHydrationSyncing={dashboardHydrationSyncing}
            userPreferences={userPreferences}
            subscription={accessSubscription}
            propertyUnlocks={propertyUnlocks}
            currentUserId={supabaseUserId || 'local-user'}
            activeSpotlightKeys={activeSpotlightKeys}
            onOpenSpotlight={() => setModal('spotlight')}
          />
        );
      case 'matches':
        return (
          <MatchesPage
            nuggets={nuggets}
            setModal={handleOpenModal}
            openUnlock={openUnlock}
            unlocked={unlocked}
            initialChat={chatFocusTarget}
            chatFocusToken={chatFocusToken}
            interested={interested}
            matched={matched}
            setInterested={setInterested}
            setMatched={setMatched}
            convos={convos}
            setConvos={setConvos}
            categoryOrder={categoryOrder}
            setCategoryOrder={setCategoryOrder}
            showcaseProperties={showcaseProperties}
            propertyPortfolio={propertyPortfolio}
            servicePortfolio={globalServicePortfolio}
            userProfile={userProfile}
            personalProfile={personalProfile}
            professionalProfile={professionalProfile}
            mobileBottomNavCollapsed={mobileBottomNavCollapsed}
            userPreferences={userPreferences}
            subscription={accessSubscription}
            setPage={setPage}
            addToast={addToast}
            onOpenChatLanguageConfig={() => openSettingsTab('preferences')}
            onSendChatMessage={sendChatMessage}
            propertyUnlocks={propertyUnlocks}
            currentUserId={supabaseUserId || 'local-user'}
            activeSpotlightKeys={activeSpotlightKeys}
          />
        );
      case 'mapview':
        return (
          <MapView
            nuggets={nuggets}
            setModal={handleOpenModal}
            openUnlock={openUnlock}
            unlocked={unlocked}
            setPage={setPage}
            showcaseProperties={showcaseProperties}
            propertyPortfolio={propertyPortfolio}
            propertyUnlocks={propertyUnlocks}
            servicePortfolio={globalServicePortfolio}
            userProfile={userProfile}
            currentUserId={supabaseUserId || 'local-user'}
            onUpdatePropertyCoords={handleMapPropertyCoordsUpdate}
            userPreferences={userPreferences}
          />
        );
      case 'onboarding':
        return (
          <Onboarding
            setPage={setPage}
            initialProfileTab={onboardingInitialTab}
            authSession={authSession}
            profileSyncStatus={profileSyncStatus}
            portfolioSyncStatus={portfolioSyncStatus}
            onResendVerificationEmail={resendEmailVerificationForAccount}
            onRefreshAuthSession={refreshAuthSessionSnapshot}
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            accountType={accountType}
            setAccountType={setAccountType}
            personalProfile={personalProfile}
            setPersonalProfile={setPersonalProfile}
            professionalProfile={professionalProfile}
            setProfessionalProfile={setProfessionalProfile}
            servicePortfolio={servicePortfolio}
            setServicePortfolio={setServicePortfolio}
            propertyPortfolio={propertyPortfolio}
            setPropertyPortfolio={setPropertyPortfolio}
          />
        );
      case 'pricing':
        return (
          <Pricing
            setPage={setPage}
            setModal={handleOpenModal}
            prevPage={prevPage}
            addToast={addToast}
            onRequestCheckoutIntent={handlePricingCheckoutSelection}
          />
        );
      case 'settings':
        return (
          <Settings
            setPage={setPage}
            prevPage={prevPage}
            initialTab={settingsInitialTab}
            systemAccount={systemAccount}
            setSystemAccount={setSystemAccount}
            authSession={authSession}
            setAuthSession={setAuthSession}
            subscription={accessSubscription}
            onSubscriptionChanged={handleSubscriptionChanged}
            addToast={addToast}
            supabaseUserId={supabaseUserId}
            onDeleteAccount={handleDeleteAccount}
            onRevokeConsent={handleRevokeConsent}
            pendingCheckoutIntent={pendingCheckoutIntent}
            onContinuePendingCheckout={handleContinuePendingCheckout}
            userPreferences={userPreferences}
            onChangeUserPreferences={handleChangeUserPreferences}
          />
        );
      case 'admin':
        return isAdmin ? <AdminDashboard setPage={setPage} prevPage={prevPage} logoutAdmin={logoutAdmin} /> : <Landing setPage={setPage} onOpenAuthModal={openAuthModal} />;
      case 'terms':
        return <TermsPage setPage={setPage} onReturnToCheckout={pendingCheckoutIntent ? returnToPendingCheckoutFromLegal : null} />;
      case 'privacy':
        return <PrivacyPolicyPage setPage={setPage} onReturnToCheckout={pendingCheckoutIntent ? returnToPendingCheckoutFromLegal : null} />;
      default:
        return <Landing setPage={setPage} onOpenAuthModal={openAuthModal} />;
    }
  };

  const isPublicPricingPage = page === 'pricing' && (!authSession || prevPage === 'landing');
  const orientationGuardCopy = getT().orientationGuard;
  const isAppShellBooting = Boolean(isAuthBootstrapping || isAuthCallbackSettling);
  const shellForcedTheme = isAppShellBooting ? null : ((page === 'landing' || isPublicPricingPage) ? 'light' : null);

  return (
    <ThemeProvider forcedTheme={shellForcedTheme}>
      <GuideTipsProvider>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--t1)' }}>
        {isAppShellBooting ? (
          <div className="ds-app-boot-screen" role="status" aria-live="polite" aria-label="Loading DealSifter">
            <div className="ds-processing-card">
              <img src={loaderMark} alt="DealSifter" className="ds-processing-logo" />
              <div className="ds-processing-text">Loading DealSifter...</div>
            </div>
          </div>
        ) : (
          <>
            <Navbar
              page={page}
              prevPage={prevPage}
              setPage={setPage}
              nuggets={nuggets}
              setModal={handleOpenModal}
              chatNotifications={chatNotifications}
              systemNotifications={systemNotifications}
              setSystemNotifications={setSystemNotifications}
              onOpenChatNotification={openChatFromNotification}
              onMarkChatNotificationRead={markChatNotificationAsRead}
              onOpenAuthModal={openAuthModal}
              onOpenSettings={() => openSettingsTab('profile')}
              onOpenAdmin={() => setPage('admin')}
              onLogoutUser={handleUserLogout}
              isAdmin={isAdmin}
              userProfile={userProfile}
              editMode={editMode}
              setEditMode={setEditMode}
              showInstallAppButton={showInstallAppButton}
              onInstallApp={handleInstallApp}
              userPreferences={userPreferences}
            />
            <GuideTipOverlay key={page} page={page} />
            <Suspense fallback={<div style={{ minHeight: '60vh' }} />}>
              {(() => {
                const keepAlivePages = new Set(['dashboard', 'mapview', 'matches', 'onboarding']);
                if (!keepAlivePages.has(page)) return renderPageContent(page);

                return (
                  <>
                    <Activity mode={page === 'dashboard' ? 'visible' : 'hidden'}>
                      {renderPageContent('dashboard')}
                    </Activity>
                    <Activity mode={page === 'mapview' ? 'visible' : 'hidden'}>
                      {renderPageContent('mapview')}
                    </Activity>
                    <Activity mode={page === 'matches' ? 'visible' : 'hidden'}>
                      {renderPageContent('matches')}
                    </Activity>
                    <Activity mode={page === 'onboarding' ? 'visible' : 'hidden'}>
                      {renderPageContent('onboarding')}
                    </Activity>
                  </>
                );
              })()}
            </Suspense>
            <AppMobileBottomNav
              page={page}
              setPage={setPage}
              collapsed={mobileBottomNavCollapsed}
              onCollapsedChange={setMobileBottomNavCollapsed}
              needsPrimaryProfileAttention={!hasPrimaryProfileRegistered}
            />
          </>
        )}

        {/* REMOVIDO: imagens de processamento para evitar bug visual de imagem gigante no feed */}
        {showSyncProcessing && (
          <div className="ds-processing-sync-pill" role="status" aria-live="polite">
            <span>{syncProcessingLabel}</span>
          </div>
        )}

        {showBlockingProcessing && (
          <div className="ds-processing-overlay" role="status" aria-live="polite" aria-label={blockingProcessingMessage}>
            <div className="ds-processing-card">
              <img src={loaderMark} alt="DealSifter" className="ds-processing-logo" />
              <div className="ds-processing-text">{blockingProcessingMessage}</div>
            </div>
          </div>
        )}

        {/* Cookie banner — landing page only, before login */}
        {!cookieConsent && !authSession && (
          <Suspense fallback={null}>
            <CookieBanner
              onAccept={() => handleCookieAccept('accepted')}
              onEssential={() => handleCookieAccept('essential')}
              onLearnMore={() => setPage('privacy')}
            />
          </Suspense>
        )}

        {/* LGPD consent — after login only */}
        {lgpdConsentChecked && !lgpdConsent && authSession && !['terms', 'privacy'].includes(page) && (
          <Suspense fallback={null}>
            <ConsentBanner processing={isConsentProcessing} onAccept={handleLgpdAccept} onReject={() => { const t = getT(); setPage('landing'); addToast({ type: 'info', title: t.consent.requiredTitle, message: t.consent.requiredMessage }); }} onOpenTerms={() => setPage('terms')} onOpenPrivacy={() => setPage('privacy')} />
          </Suspense>
        )}

        {modal === 'unlock' && unlockTarget && (
          <Suspense fallback={null}>
            <UnlockModal
              match={unlockTarget}
              nuggets={nuggets}
              unlockCost={getUnlockCost(unlockTarget)}
              exclusivityStatus={getUnlockExclusivityStatus(unlockTarget)}
              contactExclusivityOption={getContactExclusivityOption(unlockTarget)}
              onUnlock={handleUnlock}
              onBuyMore={openPricingHub}
              onClose={() => { setUnlockQuote(null); setModal(null); }}
            />
          </Suspense>
        )}

        {modal === 'spotlight' && (
          <SpotlightModal
            open
            items={spotlightCandidates}
            nuggets={nuggets}
            isLoading={isSpotlightCandidatesLoading}
            isProcessing={isSpotlightProcessing}
            onConfirm={handlePurchaseSpotlights}
            onClose={() => setModal(null)}
          />
        )}

        {modal === 'auth' && (
          <Suspense fallback={null}>
            <AuthAccessModal
              initialTab={authModalTab}
              onClose={() => setModal(null)}
              onSubmit={handleAuthSubmit}
              onForgotPassword={handleForgotPassword}
            />
          </Suspense>
        )}

        {modal === 'adminAuth' && (
          <Suspense fallback={null}>
            <AdminLoginModal
              onClose={() => setModal(null)}
              onSubmit={handleAdminAuthSubmit}
            />
          </Suspense>
        )}

        {checkoutModalIntent && (
          <Suspense fallback={null}>
            <EmbeddedCheckoutModal
              intent={checkoutModalIntent}
              checkoutError={checkoutError}
              isSubmitting={checkoutSubmitting}
              onClose={closeCheckoutModal}
              onHostedFallback={handleHostedCheckoutFallback}
              onComplete={handleEmbeddedCheckoutComplete}
              onOpenTerms={openCheckoutTerms}
              onOpenPrivacy={openCheckoutPrivacy}
            />
          </Suspense>
        )}

        {/* ── Dev-only element inspector (Alt+I to toggle) ── */}
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <DevInspector />
          </Suspense>
        )}

        {blockMobileLandscape && <MobilePortraitGuard copy={orientationGuardCopy} />}

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
      </GuideTipsProvider>
    </ThemeProvider>
  );
}
