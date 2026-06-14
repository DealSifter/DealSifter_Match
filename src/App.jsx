import React, { Activity, useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import './App.css';
import loaderMark from './assets/logo.png';
import { ThemeProvider } from './theme/theme';
import { Navbar } from './components/layout/Navbar';
import { AppMobileBottomNav } from './components/layout/AppMobileBottomNav';
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
const AuthAccessModal = lazyWithRetry(() => import('./components/modals/AuthAccessModal').then((m) => ({ default: m.AuthAccessModal })), 'auth-access');
const AdminLoginModal = lazyWithRetry(() => import('./components/modals/AdminLoginModal').then((m) => ({ default: m.AdminLoginModal })), 'admin-login');
const EmbeddedCheckoutModal = lazyWithRetry(() => import('./components/modals/EmbeddedCheckoutModal').then((m) => ({ default: m.EmbeddedCheckoutModal })), 'embedded-checkout');
import { ToastContainer } from './components/ui/Toast';
const ConsentBanner = lazyWithRetry(() => import('./components/ui/ConsentBanner').then((m) => ({ default: m.ConsentBanner })), 'consent');
const CookieBanner = lazyWithRetry(() => import('./components/ui/CookieBanner').then((m) => ({ default: m.CookieBanner })), 'cookie');
import { getT } from './i18n/translations';
import { CATEGORIES, CARDS as _MOCK_CARDS, PLANS, PROPERTIES as _MOCK_PROPERTIES, SERVICE_PORTFOLIO as _MOCK_SERVICES } from './data/mockData';
import { supabase, isSupabaseConfigured, supabaseConfigHint } from './lib/supabaseClient';
import { buildScopedProfilePayload, extractScopedProfileLegacy } from './lib/profileScopeResolver';
import { getPortfolioFull, setPortfolioFull, clearAllUserData, uploadDataUrlToStorage } from './lib/localforageHelper';
import { useAuthSession, mapSupabaseUserToSession } from './hooks/useAuthSession';
import { useProfileSync } from './hooks/useProfileSync';
import { usePortfolioSync } from './hooks/usePortfolioSync';
import { useCheckoutFlow } from './hooks/useCheckoutFlow';
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

// In production, keep mock portfolio metadata available for demo cards and unlock pricing; only standalone mock contact cards stay disabled here.
const CARDS = import.meta.env.DEV ? _MOCK_CARDS : [];
const MOCK_PROPERTIES = _MOCK_PROPERTIES || [];
const MOCK_SERVICES = _MOCK_SERVICES || [];

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

const getAppSessionToken = () => {
  try {
    let token = safeSessionGet(APP_SESSION_TOKEN_KEY);
    if (!token) {
      token = (crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      safeSessionSet(APP_SESSION_TOKEN_KEY, token);
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
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (raw === '1') return true; // legacy acceptance
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return false;
    if (!['accepted', 'essential'].includes(String(parsed.choice || ''))) return false;
    const expiresAt = Number(parsed.expiresAt || 0);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
  } catch {
    return false;
  }
};

const writeCookieConsent = (choice = 'accepted') => {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({
      version: COOKIE_CONSENT_VERSION,
      choice: choice === 'essential' ? 'essential' : 'accepted',
      acceptedAt: Date.now(),
      expiresAt: Date.now() + COOKIE_CONSENT_TTL_MS,
    }));
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
    sortOrder: 'recent',
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
  const sortOrder = ['recent', 'name_asc', 'price_desc'].includes(String(feedMatches.sortOrder || '').trim())
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

const DEFAULT_PROFESSIONAL_PROFILE = (fallbackCategory = 'wholesaler') => ({
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

const normalizeProfessionalProfile = (value, fallbackCategory = 'wholesaler') => {
  const base = {
    ...DEFAULT_PROFESSIONAL_PROFILE(fallbackCategory),
    ...(value || {}),
  };
  return {
    ...base,
    category: String(base.category || fallbackCategory || 'wholesaler').trim(),
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
const mapDbPropertyToLocal = (row, images = []) => ({
  id: row.id,
  portfolioId: row.id,
  ownerId: LOCAL_OWNER_ID,
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
  primaryProfile: row.primary_profile || 'personal',
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

const mapDbServiceToLocal = (row) => ({
  id: row.id,
  ownerId: LOCAL_OWNER_ID,
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
  source: 'supabase',
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const sanitizeLegacyName = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized === 'Alex Johnson' || normalized === 'New User' || normalized === 'User') return '';
  return normalized;
};

export default function App() {
  const profileSyncStateRef = useRef({ userId: null, loaded: false, hydrating: false, personalLoadedFromRemote: false, professionalLoadedFromRemote: false });
  const profileHydrationRetryRef = useRef({ timer: null, attempts: 0 });
  const profileHydrationInputRef = useRef({ accountType: 'professional', userCategory: 'wholesaler' });
  const {
    portfolioSyncStateRef,
    portfolioHydrationRetryRef,
    isHydratingPortfolio,
    setIsHydratingPortfolio,
    portfolioHydrationCycle,
    refreshPortfolioHydration,
    resetPortfolioSync,
  } = usePortfolioSync();
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
  }, [portfolioHydrationRetryRef]);

  // Keep first-load hydration blocking short; continue syncing in background afterwards.
  useEffect(() => {
    const hydrating = isHydratingProfiles || isHydratingPortfolio;
    if (!hydrating) {
      setShowHydrationBlocking(false);
      return;
    }
    setShowHydrationBlocking(true);
    const timer = setTimeout(() => setShowHydrationBlocking(false), 4500);
    return () => clearTimeout(timer);
  }, [isHydratingProfiles, isHydratingPortfolio]);

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
  const [sessionVersion, setSessionVersion] = useState(0);
  const [systemAccount, setSystemAccount] = useState(() => {
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
      setSessionVersion((v) => v + 1);
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
    const token = getAppSessionToken();
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
    try {
      return localStorage.getItem('ds_lgpd_consent') === '1';
    } catch {
      return false;
    }
  });

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
    // Record consent server-side FIRST as proof (Art. 8) before updating local state
    const anonId = `anon-${Date.now()}`;
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = authSession?.userId || null;
        await supabase.from('consent_records').insert({
          user_id: userId,
          anonymous_id: userId ? null : anonId,
          consent_type: 'data_processing',
          version: '1.0',
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
    try { localStorage.setItem('ds_lgpd_consent', '1'); } catch { /* no-op */ }
    setIsConsentProcessing(false);
  };

  // After login, link any anonymous consent record to the authenticated user_id
  const consentLinkedRef = useRef(false);
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
      try { localStorage.removeItem('ds_lgpd_consent'); } catch { /* no-op */ }
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
    try {
      const saved = localStorage.getItem('ds_matched');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [interested, setInterested] = useState(() => {
    try {
      const saved = localStorage.getItem('ds_interested');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [unlocked, setUnlocked] = useState(() => {
    try {
      const saved = localStorage.getItem('ds_unlocked');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [propertyUnlocks, setPropertyUnlocks] = useState(() => {
    try {
      const saved = localStorage.getItem('ds_property_unlocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [purchases, setPurchases] = useState(() => {
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
  const lastActivityRef = useRef(Date.now());
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
  const [accountType, setAccountType] = useState(() => localStorage.getItem('accountType') || 'professional');

  useEffect(() => {
    profileHydrationInputRef.current.accountType = accountType || 'professional';
  }, [accountType]);

  const openAuthModal = useCallback((tab = 'signup') => {
    setAuthModalTab(tab === 'login' ? 'login' : 'signup');
    setModal('auth');
  }, []);

  // Wrapper for setPage that tracks previous page
  const setPage = useCallback((newPage) => {
    const protectedPages = new Set(['dashboard', 'matches', 'mapview', 'onboarding', 'settings']);
    if (!authSession && protectedPages.has(newPage)) {
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
      category: 'wholesaler',
      type: '',
      location: '',
      badge: '',
    };
  });

  const [personalProfile, setPersonalProfile] = useState(() => {
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
    const saved = localStorage.getItem('professionalProfile');
    if (!saved) {
      return DEFAULT_PROFESSIONAL_PROFILE(userProfile.category || 'wholesaler');
    }
    try {
      return normalizeProfessionalProfile(JSON.parse(saved), userProfile.category || 'wholesaler');
    } catch {
      return DEFAULT_PROFESSIONAL_PROFILE(userProfile.category || 'wholesaler');
    }
  });

  useEffect(() => {
    profileHydrationInputRef.current.userCategory = String(userProfile?.category || 'wholesaler').trim() || 'wholesaler';
  }, [userProfile]);

  const supabaseUserId = authSession?.userId || null;

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

  const [servicePortfolio, setServicePortfolio] = useState(() => {
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

      if (Array.isArray(cleanedServiceFull)) setServicePortfolio(cleanedServiceFull);
      else if (Array.isArray(cleanedService)) setServicePortfolio(cleanedService);

      if (Array.isArray(cleanedPropertyFull)) setPropertyPortfolio(cleanedPropertyFull);
      else if (Array.isArray(cleanedProperty)) setPropertyPortfolio(cleanedProperty);

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
          setUserProfile((prev) => ({ ...(prev || {}), ...next }));
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
          setPersonalProfile((prev) => ({ ...(prev || {}), ...next }));
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
          setProfessionalProfile((prev) => ({ ...(prev || {}), ...next }));
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

  const showcaseProperties = useMemo(() => {
    return propertyPortfolio
      .filter((p) => (
        isTruthyFlag(p?.isActive, true)
        && isTruthyFlag(p?.publishToShowcase, true)
        && p?.dealClosed !== true
        && !isPendingDealExpired(p)
      ))
      .map((p, idx) => ({
        ...p,
        id: p.id ?? p.portfolioId ?? `portfolio-${idx}`,
      }));
  }, [propertyPortfolio]);

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
    [...(servicePortfolio || []), ...(MOCK_SERVICES || [])].forEach((service, idx) => {
      if (!service) return;
      const key = String(service.id || `${service.ownerId || 'owner'}:${idx}`);
      if (!byId.has(key)) byId.set(key, service);
    });
    return [...byId.values()];
  }, [servicePortfolio]);

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
      setUserProfile({ name: '', category: 'wholesaler', type: '', location: '', badge: '' });
      setPersonalProfile(DEFAULT_PERSONAL_PROFILE);
      setProfessionalProfile(DEFAULT_PROFESSIONAL_PROFILE('wholesaler'));
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
        !row?.expiresAt || Number(row.expiresAt) > now
      )).slice(-500);
      localStorage.setItem('ds_property_unlocks', JSON.stringify(cleaned));
      if (cleaned.length !== (propertyUnlocks || []).length) setPropertyUnlocks(cleaned);
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
      setIsHydratingProfiles(false);
      resetProfileSync();
      resetPortfolioSync();
      if (profileHydrationRetryRef.current.timer) {
        clearTimeout(profileHydrationRetryRef.current.timer);
        profileHydrationRetryRef.current.timer = null;
      }
      profileHydrationRetryRef.current.attempts = 0;
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
              fullName: String(payloadSystem.fullName || userRow.data.full_name || prev?.fullName || ''),
              email: String(payloadSystem.email || prev?.email || ''),
              phone: String(payloadSystem.phone || userRow.data.phone || prev?.phone || ''),
              phoneCountryCode: String(payloadSystem.phoneCountryCode || prev?.phoneCountryCode || '+1'),
              marketAreas: String(payloadSystem.marketAreas || prev?.marketAreas || ''),
              accountType: String(payloadSystem.accountType || prev?.accountType || 'individual'),
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
          const {
            personalFromPayload,
            professionalFromPayload,
            personalProfileFromPayload,
            professionalProfileFromPayload,
            fsboProfileFromPayload,
          } = extractScopedProfileLegacy(professionalResult.data.profile_payload);

          const activeAccountType = profileHydrationInputRef.current.accountType;
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
          if (fullyLoadedFromRemote) {
            profileHydrationRetryRef.current.attempts = 0;
          } else if (profileHydrationRetryRef.current.attempts < 6) {
            profileHydrationRetryRef.current.attempts += 1;
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
      }
      setIsHydratingProfiles(false);
    };
  }, [supabaseUserId, profileHydrationCycle, resetProfileSync, resetPortfolioSync]);

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
        photo_url: photoUrl,
        bio: normalized.bio || null,
        visibility: normalized.visibility || 'hidden',
      };

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
      const normalized = normalizeProfessionalProfile(professionalProfile, userProfile.category || 'wholesaler');
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
        photo_b_url: photoBUrl,
      };

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

        const hydratedProperties = propertyRows.map((row) => mapDbPropertyToLocal(row, imagesByProperty[row.id] || []));
        const hydratedServices = serviceRows.map((row) => mapDbServiceToLocal(row));

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
              ownerId: LOCAL_OWNER_ID,
            };
          });
          // Inclui registros locais ainda não sincronizados
          const hydratedIds = new Set(hydratedProperties.map((h) => String(h.id)));
          const additionalLocal = prior.filter((item) => isUserOwnedPropertyRecord(item) && !hydratedIds.has(String(item.id)));
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
                ownerId: LOCAL_OWNER_ID,
              };
            }
            return hs;
          });

          // Include any local user-owned items that don't exist on server yet (newly created)
          const hydratedIds = new Set(hydratedServices.map((h) => String(h.id)));
          const additionalLocal = prior.filter((item) => isUserOwnedServiceRecord(item) && !hydratedIds.has(String(item.id)));

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

          if (fullyLoadedFromRemote) {
            portfolioHydrationRetryRef.current.attempts = 0;
          } else if (portfolioHydrationRetryRef.current.attempts < 6) {
            portfolioHydrationRetryRef.current.attempts += 1;
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
  }, [supabaseUserId, portfolioHydrationCycle, portfolioHydrationRetryRef, portfolioSyncStateRef, refreshPortfolioHydration, setIsHydratingPortfolio]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (!portfolioSyncStateRef.current.loaded || portfolioSyncStateRef.current.hydrating) return;

    const userOwnedServices = (servicePortfolio || []).filter((service) => isUserOwnedServiceRecord(service));
    const missingUuid = userOwnedServices.filter((service) => !isUuid(service?.id));

    if (missingUuid.length > 0) {
      const replacements = new Map(missingUuid.map((service) => [String(service.id), crypto.randomUUID()]));
      setServicePortfolio((prev) => (prev || []).map((service) => {
        const key = String(service?.id);
        if (!replacements.has(key)) return service;
        return {
          ...service,
          id: replacements.get(key),
          source: service?.source || 'portfolio',
          ownerId: LOCAL_OWNER_ID,
        };
      }));
      return;
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
      setPropertyPortfolio((prev) => (prev || []).map((property) => {
        const key = String(property?.id);
        if (!replacements.has(key)) return property;
        return {
          ...property,
          id: replacements.get(key),
          portfolioId: replacements.get(key),
          source: property?.source || 'portfolio',
          ownerId: LOCAL_OWNER_ID,
        };
      }));
      return;
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
        String(property?.ownerId || '') === String(unlockOwnerId)
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
    const unlockGate = canUsePlanAction(subscription, 'unlock', {
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
      addToast({ type: 'warning', title: copy.title, message: copy.message });
      setModal(null);
      setUnlockQuote(null);
      openPricingHub();
      return;
    }
    if (nuggets >= unlockCost && card) {
      let remoteUnlockRow = null;
      if (
        card.unlockScope === 'property'
        && card.propertyId
        && isUuid(card.propertyId)
        && isSupabaseConfigured
        && supabase
        && supabaseUserId
      ) {
        try {
          const { data, error } = await supabase.rpc('ds_purchase_property_unlock', {
            p_property_id: card.propertyId,
            p_mode: unlockMode,
            p_metadata: {
              source: 'unlock_modal',
              ownerId: String(card.unlockOwnerId || card.ownerId || card.id || ''),
              displayedBaseCost: baseUnlockCost,
              displayedCost: unlockCost,
            },
          });
          if (error) throw error;
          remoteUnlockRow = Array.isArray(data) ? data[0] : data;
          const remoteTotalCost = Number(remoteUnlockRow?.total_cost);
          if (
            remoteUnlockRow
            && Number.isFinite(Number(remoteUnlockRow.remaining_nuggets))
            && Number.isFinite(remoteTotalCost)
            && remoteTotalCost === unlockCost
          ) {
            setNuggets(Number(remoteUnlockRow.remaining_nuggets));
          } else {
            setNuggets(n => n - unlockCost);
          }
        } catch (error) {
          const message = String(error?.message || '').toLowerCase();
          const missingRpc = message.includes('function') && message.includes('ds_purchase_property_unlock');
          if (!missingRpc) {
            addToast({
              type: 'warning',
              title: 'Unlock unavailable',
              message: error?.message || 'This property could not be unlocked right now. Please try again.',
            });
            setModal(null);
            setUnlockQuote(null);
            return;
          }
          setNuggets(n => n - unlockCost);
        }
      } else {
        setNuggets(n => n - unlockCost);
      }
      setUnlocked(u => u.includes(card.id) ? u : [...u, card.id]);
      incrementPlanUsage('month', 'unlocks');
      if (card.unlockScope === 'property' && card.propertyId) {
        setPropertyUnlocks((prev) => {
          const alreadyNormal = unlockMode === 'normal' && prev.some((row) => (
            String(row?.propertyId) === String(card.propertyId)
            && String(row?.buyerId) === String(supabaseUserId || 'local-user')
            && row?.mode === 'normal'
          ));
          if (alreadyNormal) return prev;
          return [
            ...prev,
            createPropertyUnlockRecord({
              propertyId: card.propertyId,
              ownerId: card.unlockOwnerId || card.ownerId || card.id,
              buyerId: supabaseUserId || 'local-user',
              mode: unlockMode,
              cost: Number(remoteUnlockRow?.total_cost || unlockCost),
            }),
          ];
        });
      }
      // Ensure unlocked contact stays available in Matches module.
      setMatched(prev => prev.some(x => x.id === card.id) ? prev : [...prev, card]);
      // Auto-add ALL active properties of this contact to `interested` so the
      // full portfolio appears in the Interests column immediately after unlock.
      const allProps = unlockPortfolioProperties || [];
      const contactProps = allProps.filter(
        (p) => String(p.ownerId) === String(card.unlockOwnerId || card.ownerId || card.id) && isTruthyFlag(p?.isActive, true)
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
        prev.some(p => p.sellerId === (card.unlockOwnerId || card.ownerId || card.id))
          ? prev 
          : [...prev, { sellerId: card.unlockOwnerId || card.ownerId || card.id }]
      );
      setModal(null);
      setUnlockQuote(null);
      // Navegar para Matches para visualizar o contato
      setPage('matches');
    } else {
      addToast({ type: 'warning', title: 'Nuggets insuficientes', message: `Você precisa de ${unlockCost} nugget(s) para desbloquear este contato. Vá para Pricing para escolher um upgrade de plano ou pacote extra de nuggets.` });
      setModal(null);
      setUnlockQuote(null);
      openPricingHub();
    }
  };

  const portfolioSyncStatus = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUserId) return 'idle';
    if (isHydratingPortfolio) return 'syncing';
    const state = portfolioSyncStateRef.current || {};
    if (!state.loaded) return 'syncing';
    if (state.servicesLoadedFromRemote && state.propertiesLoadedFromRemote && state.propertyImagesLoadedFromRemote) {
      return 'synced';
    }
    return 'degraded';
  }, [isHydratingPortfolio, supabaseUserId, portfolioSyncStateRef]);

  const profileHydrationReady = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUserId) return true;
    const state = profileSyncStateRef.current || {};
    const loaded = Boolean(state.loaded && state.personalLoadedFromRemote && state.professionalLoadedFromRemote);
    if (loaded) return true;
    if (!isHydratingProfiles && profileHydrationRetryRef.current.attempts >= 6) return true;
    return false;
  }, [isHydratingProfiles, supabaseUserId]);

  const portfolioHydrationReady = useMemo(() => {
    if (!isSupabaseConfigured || !supabaseUserId) return true;
    const state = portfolioSyncStateRef.current || {};
    const loaded = Boolean(state.loaded && state.servicesLoadedFromRemote && state.propertiesLoadedFromRemote && state.propertyImagesLoadedFromRemote);
    if (loaded) return true;
    if (!isHydratingPortfolio && portfolioHydrationRetryRef.current.attempts >= 6) return true;
    return false;
  }, [isHydratingPortfolio, supabaseUserId, portfolioHydrationRetryRef, portfolioSyncStateRef]);

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
            servicePortfolio={servicePortfolio}
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
            subscription={subscription}
            propertyUnlocks={propertyUnlocks}
            currentUserId={supabaseUserId || 'local-user'}
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
            servicePortfolio={servicePortfolio}
            userProfile={userProfile}
            personalProfile={personalProfile}
            professionalProfile={professionalProfile}
            mobileBottomNavCollapsed={mobileBottomNavCollapsed}
            userPreferences={userPreferences}
            subscription={subscription}
            setPage={setPage}
            addToast={addToast}
            onOpenChatLanguageConfig={() => openSettingsTab('preferences')}
            propertyUnlocks={propertyUnlocks}
            currentUserId={supabaseUserId || 'local-user'}
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
            servicePortfolio={servicePortfolio}
            userProfile={userProfile}
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
            subscription={subscription}
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

  return (
    <ThemeProvider forcedTheme={(page === 'landing' || isPublicPricingPage) ? 'light' : null}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--t1)' }}>
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
        {!lgpdConsent && authSession && (
          <Suspense fallback={null}>
            <ConsentBanner onAccept={handleLgpdAccept} onReject={() => { const t = getT(); setPage('landing'); addToast({ type: 'info', title: t.consent.requiredTitle, message: t.consent.requiredMessage }); }} onOpenTerms={() => setPage('terms')} onOpenPrivacy={() => setPage('privacy')} />
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

        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    </ThemeProvider>
  );
}
