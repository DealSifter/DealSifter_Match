import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import './App.css';
import { ThemeProvider } from './theme/theme';
import { Navbar } from './components/layout/Navbar';
import { AppMobileBottomNav } from './components/layout/AppMobileBottomNav';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { MatchesPage } from './pages/MatchesPage';
import { Onboarding } from './pages/Onboarding';
import { Pricing } from './pages/Pricing';
import { MapView } from './pages/MapView';
import { Settings } from './pages/Settings';
import { AdminDashboard } from './pages/AdminDashboard';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { NuggetStore } from './components/modals/NuggetStore';
import { UnlockModal } from './components/modals/UnlockModal';
import { AuthAccessModal } from './components/modals/AuthAccessModal';
import { AdminLoginModal } from './components/modals/AdminLoginModal';
import { ToastContainer } from './components/ui/Toast';
import { ConsentBanner } from './components/ui/ConsentBanner';
import { CookieBanner } from './components/ui/CookieBanner';
import { getT } from './i18n/translations';
import { CATEGORIES, CARDS as _MOCK_CARDS, SERVICE_PORTFOLIO as _MOCK_SERVICE_PORTFOLIO } from './data/mockData';
import { supabase, isSupabaseConfigured } from './lib/supabaseClient';
import { buildScopedProfilePayload, extractScopedProfileLegacy } from './lib/profileScopeResolver';
import { getPortfolioFull, setPortfolioFull, clearAllUserData, uploadDataUrlToStorage } from './lib/localforageHelper';
import { redirectToCheckout, redirectToPortal } from './lib/stripeClient';
import { getMatchPressure, setDealAlert, shouldSendDealAlert } from './lib/matchPressure';
import loaderMark from './assets/logo.png';

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
  ];
  return optionalColumns.some((column) => isMissingColumnError(error, column));
};

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

// In production, disable mock feed cards — real data comes from Supabase
const CARDS = import.meta.env.DEV ? _MOCK_CARDS : [];

// DevInspector: lazy-loaded, only rendered in dev
const DevInspector = import.meta.env.DEV
  ? lazy(() => import('./components/dev/DevInspector').then((m) => ({ default: m.DevInspector })))
  : () => null;

const PLAN_BONUS_BY_TIER = {
  free: 0,
  pro: 10,
  enterprise: 25,
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
      // Store full payload (images included) in localforage (IndexedDB — no 5MB limit).
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

const toIntegerOrNull = (value) => {
  if (value === '' || value == null) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
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
    publish_to_showcase: isTruthyFlag(property?.publishToShowcase, true),
    include_in_preview: isTruthyFlag(property?.includeInPreview, true),
    source: String(property?.source || 'portfolio').trim() || 'portfolio',
    owner_account_type: String(property?.ownerAccountType || '').trim() || null,
    primary_profile: String(property?.primaryProfile || 'personal').trim() || 'personal',
    video: String(property?.video || '').trim() || null,
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
  media_images: normalizePortfolioImages([
    ...(Array.isArray(service?.media?.images) ? service.media.images : []),
    ...(Array.isArray(service?.media?.archivedImages) ? service.media.archivedImages : []),
  ]),
  publish_to_connections: isTruthyFlag(service?.publishToConnections, true),
  markets: normalizeStringArray(service?.markets),
  primary_profile: String(service?.primaryProfile || 'personal').trim() || 'personal',
});

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
  const profileSaveDebounceRef = useRef({ personal: null, professional: null, services: null, properties: null });
  const pendingFlushRef = useRef({ personal: null, professional: null, services: null, properties: null });
  const portfolioSyncStateRef = useRef({ userId: null, loaded: false, hydrating: false, servicesLoadedFromRemote: false, propertiesLoadedFromRemote: false, propertyImagesLoadedFromRemote: false });
  const profileHydrationRetryRef = useRef({ timer: null, attempts: 0 });
  const portfolioHydrationRetryRef = useRef({ timer: null, attempts: 0 });
  const profileSyncPendingRef = useRef(0);
  const prevUserIdRef = useRef(null); // tracks userId across renders to detect user change
  const [profileSyncStatus, setProfileSyncStatus] = useState('idle');
  const [isHydratingProfiles, setIsHydratingProfiles] = useState(false);
  const [isHydratingPortfolio, setIsHydratingPortfolio] = useState(false);
  const [profileHydrationCycle, setProfileHydrationCycle] = useState(0);
  const [portfolioHydrationCycle, setPortfolioHydrationCycle] = useState(0);

  useEffect(() => () => {
    if (profileHydrationRetryRef.current.timer) {
      clearTimeout(profileHydrationRetryRef.current.timer);
      profileHydrationRetryRef.current.timer = null;
    }
    if (portfolioHydrationRetryRef.current.timer) {
      clearTimeout(portfolioHydrationRetryRef.current.timer);
      portfolioHydrationRetryRef.current.timer = null;
    }
  }, []);

  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [isAdminAuthProcessing, setIsAdminAuthProcessing] = useState(false);
  const [isForgotPasswordProcessing, setIsForgotPasswordProcessing] = useState(false);
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
  const [systemAccount, setSystemAccount] = useState(() => {
    try {
      const raw = localStorage.getItem('systemAccount');
      return raw
        ? JSON.parse(raw)
        : { fullName: '', email: '', phone: '' };
    } catch {
      return { fullName: '', email: '', phone: '' };
    }
  });
  const [isAdmin, setIsAdmin] = useState(false);

  // Toast notification system
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const addToast = ({ type = 'info', title, message, duration = 4500 }) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message, duration }]);
  };
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
    try {
      return localStorage.getItem('ds_cookie_consent') === '1';
    } catch {
      return false;
    }
  });
  const handleCookieAccept = () => {
    setCookieConsent(true);
    try { localStorage.setItem('ds_cookie_consent', '1'); } catch { /* no-op */ }
  };

  const handleLgpdAccept = async () => {
    setIsConsentProcessing(true);
    setLgpdConsent(true);
    try { localStorage.setItem('ds_lgpd_consent', '1'); } catch { /* no-op */ }
    // Record consent server-side as proof (Art. 8)
    if (isSupabaseConfigured && supabase) {
      try {
        const userId = authSession?.userId || null;
        await supabase.from('consent_records').insert({
          user_id: userId,
          anonymous_id: userId ? null : `anon-${Date.now()}`,
          consent_type: 'data_processing',
          version: '1.0',
          user_agent: navigator.userAgent?.slice(0, 200) || null,
        });
      } catch { /* best-effort */ }
    }
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
        // Try to find and claim an anonymous record from this browser
        const { data: anon } = await supabase
          .from('consent_records')
          .select('id')
          .is('user_id', null)
          .eq('consent_type', 'data_processing')
          .order('accepted_at', { ascending: false })
          .limit(1);
        if (anon?.[0]) {
          await supabase
            .from('consent_records')
            .update({ user_id: authSession.userId, anonymous_id: null })
            .eq('id', anon[0].id);
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
  const [chatFocusTarget, setChatFocusTarget] = useState(null);
  const [chatFocusToken, setChatFocusToken] = useState(0);
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

  const mapSupabaseUserToSession = (user, mode = 'login', provider = 'supabase') => ({
    mode,
    provider,
    email: String(user?.email || '').trim(),
    fullName: String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '').trim(),
    loginAt: Date.now(),
    userId: user?.id || null,
    emailVerified: !!user?.email_confirmed_at,
  });
  
  // Wrapper for setPage that tracks previous page
  const setPage = (newPage) => {
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
  };
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

  const supabaseUserId = authSession?.userId || null;

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

  const beginProfileSync = () => {
    profileSyncPendingRef.current += 1;
    setProfileSyncStatus('syncing');
  };

  const syncErrorThrottleRef = useRef(0);
  const endProfileSync = (withError = false) => {
    profileSyncPendingRef.current = Math.max(0, profileSyncPendingRef.current - 1);
    if (withError) {
      setProfileSyncStatus('error');
      const now = Date.now();
      if (now - syncErrorThrottleRef.current > 30000) {
        syncErrorThrottleRef.current = now;
        addToast({ type: 'error', title: 'Falha na sincronização', message: 'Seus dados locais estão salvos, mas houve um erro ao sincronizar com o servidor. Tentaremos novamente.' });
      }
      return;
    }
    if (profileSyncPendingRef.current === 0) {
      setProfileSyncStatus('synced');
    }
  };

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
      .filter((p) => isTruthyFlag(p?.isActive, true) && isTruthyFlag(p?.publishToShowcase, true))
      .map((p, idx) => ({
        ...p,
        id: p.id ?? p.portfolioId ?? `portfolio-${idx}`,
      }));
  }, [propertyPortfolio]);

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

    // Fire on any real transition (ignore the very first mount when both are null)
    if (previousUserId === supabaseUserId) return;
    if (previousUserId === null && supabaseUserId === null) return;

    // Always clear user-specific localStorage on any user transition.
    // This covers: logout, session expiry, and login (to flush stale data from
    // a previous user that may have been left behind by an incomplete logout).
    clearUserSpecificLocalStorage();

    // Also reset React state and IndexedDB when leaving a logged-in state
    if (previousUserId !== null) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ds_unlocked', JSON.stringify(unlocked || []));
    } catch (error) {
      console.error('Failed to persist unlocked contacts.', error);
    }
  }, [unlocked]);

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

  useEffect(() => {
    try {
      if (authSession) localStorage.setItem('authSession', JSON.stringify(authSession));
      else localStorage.removeItem('authSession');
    } catch (error) {
      console.error('Failed to persist auth session.', error);
    }
  }, [authSession]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let active = true;
    const applySession = async (session) => {
      if (!active) return;
      const user = session?.user;
      if (!user) {
        setAuthSession(null);
        setIsAdmin(false);
        return;
      }
      const next = mapSupabaseUserToSession(user, 'login', 'supabase');
      setAuthSession(next);
      setSystemAccount((prev) => ({
        ...(prev || {}),
        fullName: next.fullName || prev?.fullName || '',
        email: next.email || prev?.email || '',
      }));
      // Re-validate admin status from Supabase on every session restore
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        setIsAdmin(!!userRow?.is_admin);
      } catch {
        setIsAdmin(false);
      }
      setModal(null);
      setPage((prev) => prev === 'landing' || !prev ? 'dashboard' : prev);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) applySession(data.session);
    }).catch((error) => {
      safeLogError('Supabase session bootstrap failed.', error);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

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
  }, [authSession]);

  // ── Stripe checkout return handler ───────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (!checkout) return;
    // Clean URL immediately to prevent re-trigger on refresh
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    if (checkout === 'success') {
      addToast({
        type: 'success',
        title: 'Pagamento confirmado!',
        message: 'Seus nuggets serão creditados em instantes via webhook.',
        duration: 7000,
      });
    } else if (checkout === 'cancelled') {
      addToast({
        type: 'info',
        title: 'Compra cancelada',
        message: 'O pagamento foi cancelado. Seus nuggets não foram alterados.',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Periodic deal-alert notifications (every 3 days per property) ──
  // Fires for each owner property that has active market pressure and is not yet deal-closed.
  // Keep this active for both authenticated and local-only sessions.
  useEffect(() => {
    const ownedProps = (propertyPortfolio || []).filter((p) => !p.dealClosed);
    if (!ownedProps.length) return;
    ownedProps.forEach((p) => {
      const pressure = getMatchPressure(p.id);
      if (pressure > 0 && shouldSendDealAlert(p.id)) {
        setDealAlert(p.id);
        const shortAddr = String(p.address || 'Imóvel').split(',')[0].trim();
        setSystemNotifications((prev) => [
          ...prev,
          {
            id: `deal-alert-${p.id}-${Date.now()}`,
            title: '📢 Seu imóvel está atraindo interesse!',
            message: `"${shortAddr}": ${pressure}% dos usuários ativos já acessaram este imóvel. Não perca o timing — entre em contato com os interessados!`,
            createdAt: Date.now(),
            read: false,
          },
        ]);
        addToast({
          type: 'warning',
          title: '🔥 Imóvel com demanda!',
          message: `"${shortAddr}": ${pressure}% já acessaram. Acesse Onboarding e feche o deal ($).`,
          duration: 8000,
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyPortfolio]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      profileSyncStateRef.current = { userId: null, loaded: false, hydrating: false, personalLoadedFromRemote: false, professionalLoadedFromRemote: false };
      setIsHydratingProfiles(false);
      profileSyncPendingRef.current = 0;
      setProfileSyncStatus('idle');
      if (profileSaveDebounceRef.current.personal) clearTimeout(profileSaveDebounceRef.current.personal);
      if (profileSaveDebounceRef.current.professional) clearTimeout(profileSaveDebounceRef.current.professional);
      if (profileSaveDebounceRef.current.services) clearTimeout(profileSaveDebounceRef.current.services);
      if (profileSaveDebounceRef.current.properties) clearTimeout(profileSaveDebounceRef.current.properties);
      portfolioSyncStateRef.current = { userId: null, loaded: false, hydrating: false, servicesLoadedFromRemote: false, propertiesLoadedFromRemote: false, propertyImagesLoadedFromRemote: false };
      if (profileHydrationRetryRef.current.timer) {
        clearTimeout(profileHydrationRetryRef.current.timer);
        profileHydrationRetryRef.current.timer = null;
      }
      profileHydrationRetryRef.current.attempts = 0;
      if (portfolioHydrationRetryRef.current.timer) {
        clearTimeout(portfolioHydrationRetryRef.current.timer);
        portfolioHydrationRetryRef.current.timer = null;
      }
      portfolioHydrationRetryRef.current.attempts = 0;
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
        const [personalResult, professionalResultInitial, userRow] = await Promise.all([
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
            .select('nuggets, plan_id')
            .eq('id', supabaseUserId)
            .maybeSingle(),
        ]);

        // Sync nuggets from Supabase (source of truth after webhook credits)
        if (!cancelled && userRow?.data?.nuggets != null) {
          setNuggets(userRow.data.nuggets);
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

          const effectivePersonalPayload = accountType === 'fsbo_owner'
            ? (fsboProfileFromPayload || personalProfileFromPayload || personalFromPayload)
            : (personalProfileFromPayload || personalFromPayload);

          if (effectivePersonalPayload) {
            setPersonalProfile((prev) => normalizePersonalProfile({
              ...(prev || {}),
              ...effectivePersonalPayload,
            }));
          }

          const hydratedProfessional = normalizeProfessionalProfile({
            ...professionalProfile,
            ...(professionalFromPayload || {}),
            ...(professionalProfileFromPayload || {}),
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
          }, userProfile.category || 'wholesaler');
          setProfessionalProfile((prev) => normalizeProfessionalProfile({
            ...(prev || {}),
            ...pruneEmptyProfileFields(hydratedProfessional),
          }, userProfile.category || 'wholesaler'));

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
      setIsHydratingProfiles(false);
    };
  }, [supabaseUserId, accountType, userProfile.category, profileHydrationCycle]);

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
          safeLogError('Avatar upload to Storage failed, using data URL fallback.', uploadErr);
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

    return () => {
      if (profileSaveDebounceRef.current.personal) clearTimeout(profileSaveDebounceRef.current.personal);
    };
  }, [supabaseUserId, personalProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    if (!profileSyncStateRef.current.loaded || profileSyncStateRef.current.hydrating || !profileSyncStateRef.current.professionalLoadedFromRemote) return;

    if (profileSaveDebounceRef.current.professional) clearTimeout(profileSaveDebounceRef.current.professional);
    const syncProfessional = async () => {
      pendingFlushRef.current.professional = null;
      const normalized = normalizeProfessionalProfile(professionalProfile, userProfile.category || 'wholesaler');
      const profilePayload = buildScopedProfilePayload({
        accountType,
        userProfile,
        personalProfile,
        professionalProfile: normalized,
      });

      // Upload professional photo to Supabase Storage if it's a local data URL
      let photoBUrl = normalized.photoBUrl || normalized.photoB || null;
      if (photoBUrl && photoBUrl.startsWith('data:image')) {
        try {
          photoBUrl = await uploadDataUrlToStorage(
            photoBUrl, 'profile-images', `${supabaseUserId}/photo-b.jpg`, supabase
          );
        } catch (uploadErr) {
          safeLogError('Professional photo upload to Storage failed, using data URL fallback.', uploadErr);
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

    return () => {
      if (profileSaveDebounceRef.current.professional) clearTimeout(profileSaveDebounceRef.current.professional);
    };
  }, [supabaseUserId, accountType, professionalProfile, personalProfile, userProfile]);

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
          .select('id, type, address, city, state, zip, price, beds, baths, sqft, improvement, lot, deal_tag, objective, rehab, cap_rate, description, markets, is_active, publish_to_showcase, include_in_preview, source, owner_account_type, primary_profile, video, lat, lng, geocode_status, geocode_source, geocode_confidence, geocode_input, geocoded_at, created_at, updated_at')
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
            // Sempre prioriza imagens do servidor se carregadas, nunca concatena
            return {
              ...local,
              ...hp,
              images: propertyImagesLoadedFromRemote ? hp.images : (local?.images || []),
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
              setPortfolioHydrationCycle((prev) => prev + 1);
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
  }, [supabaseUserId, portfolioHydrationCycle]);

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

        const payload = userOwnedServices.map((service) => mapLocalServiceToDb(service, supabaseUserId));
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

    return () => {
      if (profileSaveDebounceRef.current.services) clearTimeout(profileSaveDebounceRef.current.services);
    };
  }, [supabaseUserId, servicePortfolio]);

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
        let { error: upsertError } = await supabase
          .from('properties')
          .upsert(payload, { onConflict: 'id' });

        if (upsertError && isPropertiesOptionalColumnMissingError(upsertError)) {
          const payloadWithoutOptionalColumns = payload.map(({
            video,
            lat,
            lng,
            geocode_status,
            geocode_source,
            geocode_confidence,
            geocode_input,
            geocoded_at,
            ...rest
          }) => rest);
          const retry = await supabase
            .from('properties')
            .upsert(payloadWithoutOptionalColumns, { onConflict: 'id' });
          upsertError = retry.error;
        }

        if (upsertError) {
          safeLogError('Supabase properties persistence failed.', upsertError);
          return;
        }

        if (portfolioSyncStateRef.current.propertyImagesLoadedFromRemote) {
          const payload2 = userOwnedProperties.map((property) => mapLocalPropertyToDb(property, supabaseUserId));
          const localIds2 = payload2.map((item) => item.id);

          // Upload any local data URLs to Supabase Storage before persisting
          const rawImageEntries = payload2.flatMap((row) => {
            const localProperty = userOwnedProperties.find((item) => String(item.id) === String(row.id));
            const images = normalizePortfolioImages(localProperty?.images);
            return images.map((imageUrl, index) => ({ property_id: row.id, imageUrl, index }));
          });

          const imageRows = await Promise.all(
            rawImageEntries.map(async ({ property_id, imageUrl, index }) => {
              let finalUrl = imageUrl;
              if (finalUrl && finalUrl.startsWith('data:image')) {
                try {
                  finalUrl = await uploadDataUrlToStorage(
                    finalUrl,
                    'property-images',
                    `${supabaseUserId}/${property_id}/${index}.jpg`,
                    supabase
                  );
                } catch (uploadErr) {
                  safeLogError('Property image upload to Storage failed, using data URL fallback.', uploadErr);
                }
              }
              return { property_id, image_url: finalUrl, sort_order: index };
            })
          );

          const { error: deleteImagesError } = await supabase
            .from('property_images')
            .delete()
            .in('property_id', localIds2);
          if (deleteImagesError) {
            safeLogError('Supabase property images cleanup failed, will attempt insert anyway.', deleteImagesError);
          }

          if (imageRows.length > 0) {
            const { error: insertImagesError } = await supabase
              .from('property_images')
              .insert(imageRows);
            if (insertImagesError) {
              safeLogError('Supabase property images persistence failed.', insertImagesError);
            }
          }
        }
      } catch (error) {
        safeLogError('Supabase properties persistence failed.', error);
      }
    };

    pendingFlushRef.current.properties = syncProperties;
    profileSaveDebounceRef.current.properties = setTimeout(syncProperties, 900);

    return () => {
      if (profileSaveDebounceRef.current.properties) clearTimeout(profileSaveDebounceRef.current.properties);
    };
  }, [supabaseUserId, propertyPortfolio]);

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

  const openAuthModal = (tab = 'signup') => {
    setAuthModalTab(tab === 'login' ? 'login' : 'signup');
    setModal('auth');
  };

  const openAdminAuthModal = () => {
    setModal('adminAuth');
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    if (page === 'admin') setPage('dashboard');
  };

  const handleUserLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        void e;
      }
    }

    setAuthSession(null);

    const keysToKeep = ['theme', 'ds_lgpd_consent'];
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      allKeys.push(localStorage.key(i));
    }
    allKeys.forEach((key) => {
      if (key && !keysToKeep.includes(key)) {
        try { localStorage.removeItem(key); } catch (e) { void e; }
      }
    });

    clearAllUserData();
    setModal(null);
    setPage('landing');
  };

  const handleOpenModal = (nextModal) => {
    if (nextModal === 'store') {
      openSettingsTab('payments');
      return;
    }
    setModal(nextModal);
  };

  const handleAuthSubmit = async (payload) => {
    if (isSupabaseConfigured && supabase) {
      setIsAuthProcessing(true);
      const mode = payload?.mode === 'signup' ? 'signup' : 'login';
      const email = String(payload?.email || '').trim();
      const password = String(payload?.password || '');
      const fullName = String(payload?.fullName || '').trim();
      const provider = payload?.provider === 'google' ? 'google' : 'credentials';

      try {
        if (provider === 'google') {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin },
          });
          if (error) throw error;
          return;
        }

        if (mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: fullName || undefined },
            },
          });
          if (error) throw error;
          if (data?.session?.user) {
            const next = mapSupabaseUserToSession(data.session.user, 'signup', 'credentials');
            setAuthSession(next);
            setSystemAccount((prev) => ({
              ...(prev || {}),
              fullName: next.fullName || prev?.fullName || '',
              email: next.email || prev?.email || '',
            }));
            setModal(null);
            setPage('dashboard');
            return;
          }
          addToast({ type: 'success', title: 'Conta criada', message: 'Confira seu email para confirmar o acesso.' });
          setModal(null);
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data?.session?.user) {
          const next = mapSupabaseUserToSession(data.session.user, 'login', 'credentials');
          setAuthSession(next);
          setSystemAccount((prev) => ({
            ...(prev || {}),
            fullName: next.fullName || prev?.fullName || '',
            email: next.email || prev?.email || '',
          }));
          setModal(null);
          setPage('dashboard');
        }
        return;
      } catch (error) {
        safeLogError('Supabase auth submit failed.', error);
        addToast({ type: 'error', title: 'Erro de autenticação', message: String(error?.message || 'Falha na autenticação com Supabase.') });
        return;
      } finally {
        setIsAuthProcessing(false);
      }
    }

    addToast({ type: 'error', title: 'Supabase não configurado', message: 'Configure as variáveis de ambiente do Supabase para continuar.' });
  };

  const handleAdminAuthSubmit = async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      addToast({ type: 'error', message: 'Supabase não configurado.' });
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

  const handleForgotPassword = async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      addToast({ type: 'error', message: 'Supabase não configurado.' });
      return;
    }
    const trimmed = String(email || '').trim();
    if (!trimmed.includes('@')) {
      addToast({ type: 'warning', message: 'Informe um email válido.' });
      return;
    }
    setIsForgotPasswordProcessing(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}`,
      });
      if (error) throw error;
      addToast({ type: 'success', title: 'Email enviado', message: 'Confira sua caixa de entrada para redefinir a senha.' });
    } catch (err) {
      addToast({ type: 'error', message: String(err?.message || 'Falha ao enviar email de redefinição.') });
    } finally {
      setIsForgotPasswordProcessing(false);
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
    if (isAuthProcessing) return 'Autenticando conta...';
    if (isAdminAuthProcessing) return 'Validando acesso administrativo...';
    if (isForgotPasswordProcessing) return 'Enviando recuperação de senha...';
    if (isConsentProcessing) return 'Processando consentimento...';
    if (isAccountProcessing) return 'Processando sua conta...';
    if (isHydratingProfiles || isHydratingPortfolio) return 'Carregando dados do app...';
    return '';
  }, [isAuthProcessing, isAdminAuthProcessing, isForgotPasswordProcessing, isConsentProcessing, isAccountProcessing, isHydratingProfiles, isHydratingPortfolio]);

  const showBlockingProcessing = Boolean(blockingProcessingMessage);
  const showSyncProcessing = profileSyncStatus === 'syncing' && !showBlockingProcessing;

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
        options: { emailRedirectTo: window.location.origin },
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

  const refreshAuthSessionSnapshot = async () => {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, session: authSession || null };
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const user = data?.session?.user;
      if (!user) {
        setAuthSession(null);
        return { ok: false, session: null };
      }

      const next = mapSupabaseUserToSession(user, 'login', 'supabase');
      setAuthSession(next);
      return { ok: true, session: next };
    } catch (err) {
      safeLogError('Supabase auth session refresh failed.', err);
      return { ok: false, session: authSession || null, message: String(err?.message || 'Falha ao atualizar sessao.') };
    }
  };

  const openUnlock = (card) => {
    setUnlockTarget(card);
    setModal('unlock');
  };

  const getUnlockCost = (card) => {
    if (!card?.id) return 1;
    const allProps = showcaseProperties || [];
    const portfolioCount = allProps.filter((p) => String(p.ownerId) === String(card.id)).length;
    return Math.max(1, portfolioCount);
  };

  const handleUnlock = (card) => {
    const unlockCost = getUnlockCost(card);
    if (nuggets >= unlockCost && card) {
      setNuggets(n => n - unlockCost);
      setUnlocked(u => u.includes(card.id) ? u : [...u, card.id]);
      // Ensure unlocked contact stays available in Matches module.
      setMatched(prev => prev.some(x => x.id === card.id) ? prev : [...prev, card]);
      // Auto-add ALL active properties of this contact to `interested` so the
      // full portfolio appears in the Interests column immediately after unlock.
      const allProps = showcaseProperties || [];
      const contactProps = allProps.filter(
        (p) => String(p.ownerId) === String(card.id) && isTruthyFlag(p?.isActive, true)
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
        prev.some(p => p.sellerId === card.id)
          ? prev 
          : [...prev, { sellerId: card.id }]
      );
      setModal(null);
      // Navegar para Matches para visualizar o contato
      setPage('matches');
    } else {
      setModal(null);
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
  }, [isHydratingPortfolio, supabaseUserId, isSupabaseConfigured, portfolioHydrationCycle]);

  const renderPage = () => {
    switch (page) {
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
            userProfile={userProfile}
            onUpdatePropertyCoords={handleMapPropertyCoordsUpdate}
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
        return <Pricing setPage={setPage} setModal={handleOpenModal} prevPage={prevPage} />;
      case 'settings':
        return (
          <Settings
            setPage={setPage}
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
          />
        );
      case 'admin':
        return isAdmin ? <AdminDashboard setPage={setPage} logoutAdmin={logoutAdmin} /> : <Landing setPage={setPage} onOpenAuthModal={openAuthModal} />;
      case 'terms':
        return <TermsPage setPage={setPage} />;
      case 'privacy':
        return <PrivacyPolicyPage setPage={setPage} />;
      default:
        return <Landing setPage={setPage} onOpenAuthModal={openAuthModal} />;
    }
  };

  return (
    <ThemeProvider forcedTheme={page === 'landing' ? 'light' : null}>
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
          onOpenAuthModal={openAuthModal}
          onOpenSettings={() => openSettingsTab('profile')}
          onOpenAdmin={() => setPage('admin')}
          onLogoutUser={handleUserLogout}
          isAdmin={isAdmin}
          userProfile={userProfile}
          editMode={editMode}
          setEditMode={setEditMode}
        />
        {renderPage()}
        <AppMobileBottomNav
          page={page}
          setPage={setPage}
          collapsed={mobileBottomNavCollapsed}
          onCollapsedChange={setMobileBottomNavCollapsed}
        />

        {/* REMOVIDO: imagens de processamento para evitar bug visual de imagem gigante no feed */}
        {showSyncProcessing && (
          <div className="ds-processing-sync-pill" role="status" aria-live="polite">
            <span>Salvando dados...</span>
          </div>
        )}

        {showBlockingProcessing && (
          <div className="ds-processing-overlay" role="status" aria-live="polite" aria-label={blockingProcessingMessage}>
            <div className="ds-processing-card">
              <div className="ds-processing-spinner" />
              <div className="ds-processing-text">{blockingProcessingMessage}</div>
            </div>
          </div>
        )}

        {/* Cookie banner — landing page only, before login */}
        {!cookieConsent && !authSession && <CookieBanner onAccept={handleCookieAccept} onLearnMore={() => setPage('privacy')} />}

        {/* LGPD consent — after login only */}
        {!lgpdConsent && authSession && <ConsentBanner onAccept={handleLgpdAccept} onReject={() => { const t = getT(); setPage('landing'); addToast({ type: 'info', title: t.consent.requiredTitle, message: t.consent.requiredMessage }); }} onOpenTerms={() => setPage('terms')} onOpenPrivacy={() => setPage('privacy')} />}

        {modal === 'store' && (
          <NuggetStore
            onClose={() => setModal(null)}
            onBuy={async (pkg) => {
              await redirectToCheckout(pkg);
              // Page will redirect to Stripe. If it returns here, checkout was cancelled.
            }}
            nuggets={nuggets}
          />
        )}

        {modal === 'unlock' && unlockTarget && (
          <UnlockModal
            match={unlockTarget}
            nuggets={nuggets}
            unlockCost={getUnlockCost(unlockTarget)}
            onUnlock={handleUnlock}
            onBuyMore={() => openSettingsTab('payments')}
            onClose={() => setModal(null)}
          />
        )}

        {modal === 'auth' && (
          <AuthAccessModal
            initialTab={authModalTab}
            onClose={() => setModal(null)}
            onSubmit={handleAuthSubmit}
            onForgotPassword={handleForgotPassword}
            onOpenAdminAuth={openAdminAuthModal}
          />
        )}

        {modal === 'adminAuth' && (
          <AdminLoginModal
            onClose={() => setModal(null)}
            onSubmit={handleAdminAuthSubmit}
          />
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
