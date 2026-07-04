import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import { Icon } from '../components/ui/Icon';
import { getSupabaseFunctionUrl, supabase, isSupabaseConfigured, supabaseAnonKey } from '../lib/supabaseClient';
import { redirectToPortal } from '../lib/stripeClient';
import { CHAT_LANGUAGE_OPTIONS, translateChatText, getSafeLang } from '../services/chatTranslation';

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        border: `1px solid ${active ? C.accent : C.border}`,
        background: active ? C.alpha(C.accent, 0.12) : 'transparent',
        color: active ? C.accent : C.t2,
        borderRadius: 10,
        padding: '8px 10px',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{title}</div>
        {subtitle ? <div style={{ marginTop: 4, fontSize: 11, color: C.t3 }}>{subtitle}</div> : null}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </section>
  );
}

const PHONE_COUNTRY_OPTIONS = [
  { code: '+1', label: 'US/CA (+1)' },
  { code: '+55', label: 'BR (+55)' },
  { code: '+52', label: 'MX (+52)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+34', label: 'ES (+34)' },
  { code: '+351', label: 'PT (+351)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+33', label: 'FR (+33)' },
  { code: '+39', label: 'IT (+39)' },
  { code: '+61', label: 'AU (+61)' },
];

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const target = String(columnName || '').toLowerCase();
  if (!target) return false;
  return message.includes(target) || hint.includes(target);
};

const createSecuritySessionTerminatedAudit = (sessionId) => {
  const now = Date.now();
  return {
    id: `sec-${now}-${Math.random().toString(16).slice(2, 7)}`,
    at: now,
    type: 'session',
    status: 'terminated',
    message: `Session ${sessionId} terminated from Security Center.`,
  };
};

const SHOW_SUPPORT_CHAT_PLACEHOLDER = !import.meta.env.PROD;
const SHOW_DEV_BILLING_PLACEHOLDER = !import.meta.env.PROD;
const SUPPORT_EMAIL = 'contato.dealsifter@gmail.com';

export function Settings({ setPage, prevPage, initialTab = 'profile', initialCommView = 'menu', systemAccount, setSystemAccount, authSession, setAuthSession, subscription, addToast, supabaseUserId, onDeleteAccount, onRevokeConsent, pendingCheckoutIntent = null, onContinuePendingCheckout = null, userPreferences = null, onChangeUserPreferences = null }) {
  const allT = useT('settings');
  const t = allT.settings || {};
  const [tab, setTab] = useState(initialTab);
  const [confirmPayload, setConfirmPayload] = useState(null); // { message, onConfirm, variant }
  const [profileSaveState, setProfileSaveState] = useState('saved');
  const [billingHistory, setBillingHistory] = useState(() => {
    if (isSupabaseConfigured || import.meta.env.PROD) return [];
    try {
      const raw = JSON.parse(localStorage.getItem('ds_billing_history_mock') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  });
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false);
  const [commPrefs, setCommPrefs] = useState(() => {
    if (isSupabaseConfigured) return { email: true, chat: true, marketing: false };
    try {
      const saved = JSON.parse(localStorage.getItem('ds_comm_prefs') || 'null');
      if (saved && typeof saved === 'object') return { email: true, chat: true, marketing: false, ...saved };
    } catch { /* no-op */ }
    return { email: true, chat: true, marketing: false };
  });
  const [commView, setCommView] = useState(initialTab === 'communication' ? initialCommView || 'menu' : 'menu');
  const [supportInput, setSupportInput] = useState('');
  const [supportTicket, setSupportTicket] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [securityOtpCode, setSecurityOtpCode] = useState('');
  const [securityOtpPendingAction, setSecurityOtpPendingAction] = useState('');
  const [securityOtpSending, setSecurityOtpSending] = useState(false);
  const [securityOtpVerifying, setSecurityOtpVerifying] = useState(false);
  const [securityAudit, setSecurityAudit] = useState([]);
  const [securitySessions, setSecuritySessions] = useState([]);
  const [supportMessages, setSupportMessages] = useState(() => {
    if (isSupabaseConfigured || import.meta.env.PROD) return [];
    try {
      const raw = JSON.parse(localStorage.getItem('ds_support_chat_thread') || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  });
  const [privacyControls, setPrivacyControls] = useState(() => {
    if (isSupabaseConfigured || import.meta.env.PROD) {
      return {
        doNotSellShare: false,
        targetedAdsOptOut: false,
        marketingEmails: true,
        cookieScope: 'all',
        dataProcessingConsent: true,
      };
    }
    try {
      const raw = JSON.parse(localStorage.getItem('ds_privacy_controls') || 'null');
      if (raw && typeof raw === 'object') {
        return {
          doNotSellShare: Boolean(raw.doNotSellShare),
          targetedAdsOptOut: Boolean(raw.targetedAdsOptOut),
          marketingEmails: Boolean(raw.marketingEmails ?? true),
          cookieScope: String(raw.cookieScope || 'all'),
          dataProcessingConsent: Boolean(raw.dataProcessingConsent ?? true),
        };
      }
    } catch { /* no-op */ }
    return {
      doNotSellShare: false,
      targetedAdsOptOut: false,
      marketingEmails: true,
      cookieScope: 'all',
      dataProcessingConsent: true,
    };
  });
  const [profileVisibility, setProfileVisibility] = useState('hidden');
  const [profileVisibilitySaving, setProfileVisibilitySaving] = useState(false);
  const [prefs, setPrefs] = useState(() => (userPreferences && typeof userPreferences === 'object' ? userPreferences : null));
  const settingsHydratedFromRemoteRef = useRef(false);
  const settingsSaveDebounceRef = useRef(null);
  const settingsSaveLastSerializedRef = useRef('');
  const initialZoomRaw = Number(prefs?.map?.initialZoom);
  const initialZoomValue = Number.isFinite(initialZoomRaw) ? Math.max(3, Math.min(13, initialZoomRaw)) : 4;
  const selectedDefaultMapStyle = (() => {
    const raw = String(prefs?.map?.defaultStyle || '').trim();
    if (['simple', 'satellite_streets', 'topo'].includes(raw)) return raw;
    if (raw === 'flood') return 'satellite_streets';
    return 'simple';
  })();
  const initialZoomLevelLabel = initialZoomValue <= 4
    ? (t.prefZoomLevelCountry || 'Country')
    : initialZoomValue <= 7
      ? (t.prefZoomLevelState || 'State')
      : initialZoomValue <= 10
        ? (t.prefZoomLevelCity || 'City')
        : (t.prefZoomLevelPin || 'PIN');
  const chatInputLang = getSafeLang(prefs?.chatLanguage?.input || 'pt');
  const chatOutputLang = getSafeLang(prefs?.chatLanguage?.output || 'en');
  const activeSubscription = subscription || {
    planId: 'free',
    planName: 'Free',
    price: 0,
    status: 'active',
    nextBillingAt: null,
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setTab(initialTab || 'profile'), 0);
    return () => window.clearTimeout(timer);
  }, [initialTab]);
  useEffect(() => {
    if (initialTab !== 'communication') return undefined;
    const timer = window.setTimeout(() => setCommView(initialCommView || 'menu'), 0);
    return () => window.clearTimeout(timer);
  }, [initialCommView, initialTab]);
  useEffect(() => {
    if (!userPreferences || typeof userPreferences !== 'object') return;
    const timer = window.setTimeout(() => setPrefs(userPreferences), 0);
    return () => window.clearTimeout(timer);
  }, [userPreferences]);
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      settingsHydratedFromRemoteRef.current = true;
      return;
    }

    let cancelled = false;
    settingsHydratedFromRemoteRef.current = false;

    const hydrateFromSupabase = async () => {
      try {
        let usersResult = await supabase
          .from('users')
          .select('full_name, phone, settings_payload')
          .eq('id', supabaseUserId)
          .maybeSingle();

        if (usersResult?.error && isMissingColumnError(usersResult.error, 'users.settings_payload')) {
          usersResult = await supabase
            .from('users')
            .select('full_name, phone')
            .eq('id', supabaseUserId)
            .maybeSingle();
        }

        if (cancelled) return;
        if (usersResult?.error) return;

        const userRow = usersResult?.data || null;
        if (userRow?.full_name || userRow?.phone) {
          setSystemAccount?.((prev) => ({
            ...(prev || {}),
            fullName: String(userRow?.full_name || prev?.fullName || ''),
            phone: String(userRow?.phone || prev?.phone || ''),
          }));
        }

        const payload = userRow?.settings_payload && typeof userRow.settings_payload === 'object'
          ? userRow.settings_payload
          : null;
        if (!payload) return;

        const payloadSystemAccount = payload.systemAccount && typeof payload.systemAccount === 'object'
          ? payload.systemAccount
          : {};
        const payloadPrefs = payload.userPreferences && typeof payload.userPreferences === 'object'
          ? payload.userPreferences
          : null;
        const payloadCommPrefs = payload.commPrefs && typeof payload.commPrefs === 'object'
          ? payload.commPrefs
          : null;
        const payloadPrivacyControls = payload.privacyControls && typeof payload.privacyControls === 'object'
          ? payload.privacyControls
          : null;

        setSystemAccount?.((prev) => ({
          ...(prev || {}),
          fullName: String(payloadSystemAccount.fullName || userRow?.full_name || ''),
          email: String(payloadSystemAccount.email || ''),
          phoneCountryCode: String(payloadSystemAccount.phoneCountryCode || '+1'),
          marketAreas: String(payloadSystemAccount.marketAreas || ''),
          accountType: String(payloadSystemAccount.accountType || 'individual'),
          phone: String(payloadSystemAccount.phone || userRow?.phone || ''),
        }));

        if (payloadPrefs) {
          setPrefs(payloadPrefs);
          onChangeUserPreferences?.(payloadPrefs);
        }
        if (payloadCommPrefs) {
          setCommPrefs((prev) => ({ email: true, chat: true, marketing: false, ...(prev || {}), ...payloadCommPrefs }));
        }
        if (payloadPrivacyControls) {
          setPrivacyControls((prev) => ({
            ...(prev || {}),
            doNotSellShare: Boolean(payloadPrivacyControls.doNotSellShare),
            targetedAdsOptOut: Boolean(payloadPrivacyControls.targetedAdsOptOut),
            marketingEmails: Boolean(payloadPrivacyControls.marketingEmails ?? true),
            cookieScope: String(payloadPrivacyControls.cookieScope || 'all'),
            dataProcessingConsent: Boolean(payloadPrivacyControls.dataProcessingConsent ?? true),
          }));
        }
        const { data: profileRow, error: profileError } = await supabase
          .from('user_profiles')
          .select('visibility')
          .eq('user_id', supabaseUserId)
          .maybeSingle();
        if (!profileError && profileRow?.visibility) {
          setProfileVisibility(['hidden', 'public', 'network'].includes(String(profileRow.visibility))
            ? String(profileRow.visibility)
            : 'hidden');
        }
      } catch {
        // Best effort hydration only.
      } finally {
        if (!cancelled) settingsHydratedFromRemoteRef.current = true;
      }
    };

    hydrateFromSupabase();
    return () => { cancelled = true; };
  }, [supabaseUserId, onChangeUserPreferences, setSystemAccount]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    let cancelled = false;
    const loadBillingHistory = async () => {
      setBillingHistoryLoading(true);
      try {
        let result = await supabase
          .from('nugget_purchases')
          .select('id, stripe_payment_id, stripe_checkout_session_id, pack_id, qty, bonus, price_cents, status, created_at')
          .eq('user_id', supabaseUserId)
          .order('created_at', { ascending: false })
          .limit(25);

        if (result?.error && isMissingColumnError(result.error, 'stripe_checkout_session_id')) {
          result = await supabase
            .from('nugget_purchases')
            .select('id, stripe_payment_id, pack_id, qty, bonus, price_cents, status, created_at')
            .eq('user_id', supabaseUserId)
            .order('created_at', { ascending: false })
            .limit(25);
        }

        if (cancelled) return;
        if (result?.error) throw result.error;
        const rows = Array.isArray(result?.data) ? result.data : [];
        setBillingHistory(rows.map((row) => ({
          id: row.stripe_checkout_session_id || row.stripe_payment_id || row.id,
          createdAt: row.created_at,
          amount: Number(row.price_cents || 0) / 100,
          status: row.status === 'completed' ? 'paid' : String(row.status || 'pending'),
          planName: String(row.pack_id || 'nuggets').toUpperCase(),
          source: 'nugget_purchases',
        })));
      } catch (err) {
        if (!cancelled) {
          setBillingHistory([]);
          addToast?.({ type: 'error', message: String(err?.message || 'Could not load billing history.') });
        }
      } finally {
        if (!cancelled) setBillingHistoryLoading(false);
      }
    };
    loadBillingHistory();
    return () => { cancelled = true; };
  }, [addToast, supabaseUserId]);
  useEffect(() => {
    if (tab === 'communication') return undefined;
    const timer = window.setTimeout(() => setCommView('menu'), 0);
    return () => window.clearTimeout(timer);
  }, [tab]);

  const setPaymentTab = () => setTab('payments');
  const controlStyle = { width: '100%', minWidth: 0, boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 10px', background: C.bg, color: C.t1, fontSize: 12 };
  const updatePreferences = (updater) => {
    const base = (prefs && typeof prefs === 'object') ? prefs : {};
    const nextRaw = typeof updater === 'function' ? updater(base) : updater;
    const next = (nextRaw && typeof nextRaw === 'object') ? nextRaw : base;
    setPrefs(next);
    onChangeUserPreferences?.(next);
  };

  const updateField = (field, value) => {
    setProfileSaveState('saving');
    setSystemAccount?.((prev) => ({ ...(prev || {}), [field]: value }));
  };
  const nextBillingLabel = activeSubscription?.nextBillingAt
    ? new Date(activeSubscription.nextBillingAt).toLocaleDateString('en-US')
    : (t.notApplicable || 'N/A');
  const monthlyValue = Number(activeSubscription?.price || 0);
  const hasPaidPlan = String(activeSubscription?.planId || 'free').toLowerCase() !== 'free';
  const canManageStripePortal = hasPaidPlan;
  const billingSummary = useMemo(() => {
    const paid = (billingHistory || []).filter((r) => r.status === 'paid');
    const totalPaid = paid.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      invoices: (billingHistory || []).length,
      totalPaid,
      lastInvoice: billingHistory?.[0] || null,
    };
  }, [billingHistory]);
  const profileFullName = String(systemAccount?.fullName || '').trim();
  const profileEmail = String(systemAccount?.email || '').trim();
  const profilePhone = String(systemAccount?.phone || '').trim();
  const profilePhoneCountryCode = String(systemAccount?.phoneCountryCode || '+1').trim();
  const rawProfileType = String(systemAccount?.accountType || 'individual').trim().toLowerCase();
  const profileType = ['individual', 'business', 'hybrid'].includes(rawProfileType) ? rawProfileType : 'individual';
  const profileMarkets = String(systemAccount?.marketAreas || '').trim();
  const profileCompletion = Math.round(([profileFullName, profileEmail, profilePhone, profileType, profileMarkets].filter(Boolean).length / 5) * 100);
  const sectionProgress = useMemo(() => {
    const profileDone = profileCompletion >= 60;
    const paymentsDone = Boolean(activeSubscription?.planId || billingSummary.invoices > 0);
    const communicationDone = Boolean(
      (Array.isArray(supportMessages) && supportMessages.length > 0)
      || String(systemAccount?.email || '').includes('@')
    );
    const securityDone = Boolean(authSession?.emailVerified);
    const preferencesDone = Boolean(
      prefs?.map
      && prefs?.feedMatches
      && prefs?.privacy
    );
    const privacyDone = true;
    const completed = [profileDone, paymentsDone, communicationDone, securityDone, preferencesDone, privacyDone].filter(Boolean).length;
    const total = 6;
    const percent = Math.round((completed / total) * 100);
    return { completed, total, percent };
  }, [profileCompletion, activeSubscription?.planId, billingSummary.invoices, supportMessages, systemAccount?.email, authSession?.emailVerified, prefs]);

  useEffect(() => {
    if (!settingsHydratedFromRemoteRef.current) return;
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;

    if (settingsSaveDebounceRef.current) clearTimeout(settingsSaveDebounceRef.current);

    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      systemAccount: {
        fullName: String(systemAccount?.fullName || ''),
        email: String(systemAccount?.email || ''),
        phone: String(systemAccount?.phone || ''),
        phoneCountryCode: String(systemAccount?.phoneCountryCode || '+1'),
        accountType: String(systemAccount?.accountType || 'individual'),
        marketAreas: String(systemAccount?.marketAreas || ''),
      },
      userPreferences: prefs && typeof prefs === 'object' ? prefs : {},
      commPrefs: commPrefs && typeof commPrefs === 'object' ? commPrefs : { email: true, chat: true, marketing: false },
      privacyControls: privacyControls && typeof privacyControls === 'object' ? privacyControls : {},
    };
    const serializedPayload = JSON.stringify(payload);
    if (serializedPayload === settingsSaveLastSerializedRef.current) return;

    settingsSaveDebounceRef.current = setTimeout(async () => {
      try {
        const rowUpdate = {
          full_name: String(systemAccount?.fullName || '') || null,
          phone: String(systemAccount?.phone || '') || null,
          settings_payload: payload,
        };

        let updateResult = await supabase
          .from('users')
          .update(rowUpdate)
          .eq('id', supabaseUserId);

        if (updateResult?.error && isMissingColumnError(updateResult.error, 'users.settings_payload')) {
          updateResult = await supabase
            .from('users')
            .update({
              full_name: String(systemAccount?.fullName || '') || null,
              phone: String(systemAccount?.phone || '') || null,
            })
            .eq('id', supabaseUserId);
        }

        if (!updateResult?.error) {
          settingsSaveLastSerializedRef.current = serializedPayload;
        }
      } catch {
        // Keep local state as fallback.
      }
    }, 550);

    return () => {
      if (settingsSaveDebounceRef.current) {
        clearTimeout(settingsSaveDebounceRef.current);
        settingsSaveDebounceRef.current = null;
      }
    };
  }, [
    supabaseUserId,
    systemAccount,
    prefs,
    commPrefs,
    privacyControls,
  ]);

  useEffect(() => {
    if (tab !== 'profile' || profileSaveState !== 'saving') return;
    const timer = setTimeout(() => setProfileSaveState('saved'), 450);
    return () => clearTimeout(timer);
  }, [tab, profileSaveState, systemAccount]);

  useEffect(() => {
    if (!SHOW_DEV_BILLING_PLACEHOLDER) return;
    try { localStorage.setItem('ds_billing_history_mock', JSON.stringify(billingHistory || [])); } catch { /* no-op */ }
  }, [billingHistory]);
  useEffect(() => {
    if (!SHOW_SUPPORT_CHAT_PLACEHOLDER) return;
    try { localStorage.setItem('ds_support_chat_thread', JSON.stringify(supportMessages || [])); } catch { /* no-op */ }
  }, [supportMessages]);
  useEffect(() => {
    if (import.meta.env.PROD) return;
    try { localStorage.setItem('ds_privacy_controls', JSON.stringify(privacyControls || {})); } catch { /* no-op */ }
  }, [privacyControls]);
  useEffect(() => {
    if (tab !== 'security') return;
    const refresh = () => {
      try {
        const audit = JSON.parse(localStorage.getItem('ds_security_audit') || '[]');
        setSecurityAudit(Array.isArray(audit) ? audit.slice(0, 12) : []);
      } catch { setSecurityAudit([]); }
      try {
        const sessions = JSON.parse(localStorage.getItem('ds_security_sessions') || '[]');
        const list = Array.isArray(sessions) ? sessions : [];
        const currentUser = String(authSession?.id || '');
        setSecuritySessions(list.filter((row) => String(row?.userId || '') === currentUser).slice(0, 10));
      } catch { setSecuritySessions([]); }
    };
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [tab, authSession?.id]);
  useEffect(() => {
    if (tab !== 'communication' || commView !== 'support') return;
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      if (SHOW_SUPPORT_CHAT_PLACEHOLDER) {
        setSupportMessages((prev) => {
          if ((prev || []).length) return prev;
          return [{
            id: `support-${Date.now()}`,
            from: 'admin',
            text: t.supportWelcome || 'Hello! This is DealSifter Admin/Support. How can we help?',
            createdAt: Date.now(),
          }];
        });
      }
      return;
    }
    let cancelled = false;
    const loadSupportThread = async () => {
      setSupportLoading(true);
      try {
        const { data, error } = await supabase.rpc('ds_get_my_support_thread');
        if (error) throw error;
        if (cancelled) return;
        setSupportTicket(data?.ticket || null);
        setSupportMessages((Array.isArray(data?.messages) ? data.messages : []).map((message) => ({
          id: message.id,
          from: message.senderRole === 'user' ? 'user' : 'admin',
          text: String(message.body || ''),
          createdAt: message.createdAt,
          channel: message.deliveryChannel || 'chat',
        })));
      } catch (err) {
        if (!cancelled) addToast?.({ type: 'error', message: String(err?.message || 'Could not load support chat.') });
      } finally {
        if (!cancelled) setSupportLoading(false);
      }
    };
    loadSupportThread();
    return () => { cancelled = true; };
  }, [addToast, commView, supabaseUserId, t.supportWelcome, tab]);

  const pendingCheckoutLabel = (() => {
    if (!pendingCheckoutIntent) return '';
    if (pendingCheckoutIntent.kind === 'subscription') {
      const planName = String(pendingCheckoutIntent.planId || '').toUpperCase();
      return (t.pendingCheckoutSubscription || 'Plan upgrade{plan}').replace('{plan}', planName ? ` (${planName})` : '');
    }
    if (pendingCheckoutIntent.kind === 'nuggets') {
      return t.pendingCheckoutNuggets || 'Extra nugget pack purchase';
    }
    return t.pendingCheckoutGeneric || 'Pending checkout';
  })();

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        void e;
      }
    }
    setAuthSession?.(null);
    // Clear ALL application data from localStorage
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
    setPage?.('landing');
  };

  const toggleComm = (key) => {
    setCommPrefs((prev) => {
      const next = { ...prev, [key]: !prev?.[key] };
      try { localStorage.setItem('ds_comm_prefs', JSON.stringify(next)); } catch { /* no-op */ }
      return next;
    });
  };

  const openSupportChat = useCallback(() => {
    setCommView('support');
  }, []);

  const handleSendSupportMessage = useCallback(async (channel = 'chat') => {
    const text = String(supportInput || '').trim();
    if (!text || supportSending) return;

    if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
      const now = Date.now();
      const outToSupport = await translateChatText({ text, fromLang: chatInputLang, toLang: 'en' });
      setSupportMessages((prev) => ([...(prev || []), { id: `user-${now}`, from: 'user', text: outToSupport.text, createdAt: now }]));
      setSupportInput('');
      return;
    }

    setSupportSending(true);
    try {
      const outToSupport = await translateChatText({ text, fromLang: chatInputLang, toLang: 'en' });
      const { data, error } = await supabase.rpc('ds_send_support_message', {
        p_body: outToSupport.text,
        p_subject: 'Support request',
        p_channel: channel,
      });
      if (error) throw error;
      setSupportTicket(data?.ticket || null);
      setSupportMessages((Array.isArray(data?.messages) ? data.messages : []).map((message) => ({
        id: message.id,
        from: message.senderRole === 'user' ? 'user' : 'admin',
        text: String(message.body || ''),
        createdAt: message.createdAt,
        channel: message.deliveryChannel || 'chat',
      })));
      if (channel === 'email' && data?.ticket?.id) {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = sessionData?.session?.access_token;
        const functionUrl = getSupabaseFunctionUrl('send-support-email');
        if (!accessToken || !functionUrl) throw new Error(t.supportEmailUnavailable || 'Support email service unavailable.');
        const emailResponse = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketId: data.ticket.id,
            direction: 'user_to_support',
            message: outToSupport.text,
          }),
        });
        const emailPayload = await emailResponse.json().catch(() => ({}));
        if (!emailResponse.ok) {
          addToast?.({ type: 'warning', message: String(emailPayload?.error || t.supportEmailNotSent || 'Ticket saved, but email delivery is not configured.') });
        }
      }
      setSupportInput('');
      addToast?.({ type: 'success', message: t.supportSent || 'Support message sent.' });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || t.supportSendError || 'Could not send support message.') });
    } finally {
      setSupportSending(false);
    }
  }, [
    addToast,
    chatInputLang,
    supportInput,
    supportSending,
    supabaseUserId,
    t.supportEmailNotSent,
    t.supportEmailUnavailable,
    t.supportSendError,
    t.supportSent,
  ]);

  const updateProfileVisibility = useCallback(async (visibility) => {
    const nextVisibility = ['hidden', 'public', 'network'].includes(String(visibility || ''))
      ? String(visibility)
      : 'hidden';
    setProfileVisibility(nextVisibility);
    if (!isSupabaseConfigured || !supabase || !supabaseUserId) return;
    setProfileVisibilitySaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: supabaseUserId,
          visibility: nextVisibility,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      addToast?.({ type: 'success', message: t.privacyVisibilitySaved || 'Profile visibility updated.' });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || t.privacyVisibilityError || 'Failed to update profile visibility.') });
    } finally {
      setProfileVisibilitySaving(false);
    }
  }, [addToast, supabaseUserId, t.privacyVisibilityError, t.privacyVisibilitySaved]);

  const performPasswordReset = async () => {
    const email = String(authSession?.email || systemAccount?.email || '').trim();
    if (!email) {
      addToast?.({ type: 'warning', message: t.securityNeedEmail || 'Add a valid email before requesting password reset.' });
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      addToast?.({ type: 'error', message: t.securitySupabaseUnavailable || 'Security service unavailable right now.' });
      return;
    }
    try {
      const redirectTo = `${window.location.origin}`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      addToast?.({ type: 'success', message: t.securityResetSent || 'Password reset email sent. Check your inbox.' });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || t.securityResetError || 'Failed to send password reset email.') });
    }
  };

  const performLogoutAllDevices = async () => {
    if (!isSupabaseConfigured || !supabase) {
      addToast?.({ type: 'error', message: t.securitySupabaseUnavailable || 'Security service unavailable right now.' });
      return;
    }
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || t.securityGlobalLogoutError || 'Failed to sign out from all devices.') });
      return;
    }
    setAuthSession?.(null);
    setPage?.('landing');
  };

  const requestSecurityEmailOtp = async (action) => {
    const email = String(authSession?.email || systemAccount?.email || '').trim();
    if (!email || !email.includes('@')) {
      addToast?.({ type: 'warning', message: t.securityNeedEmail || 'Add a valid email before requesting verification code.' });
      return;
    }
    if (!authSession?.emailVerified) {
      addToast?.({ type: 'warning', message: t.securityNeedVerifiedEmail || 'Verify your email before protected actions.' });
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      addToast?.({ type: 'error', message: t.securitySupabaseUnavailable || 'Security service unavailable right now.' });
      return;
    }
    try {
      const now = Date.now();
      const lockUntil = Number(localStorage.getItem('ds_security_otp_lock_until') || '0');
      if (lockUntil > now) {
        addToast?.({ type: 'warning', message: t.securityOtpLocked || 'Too many invalid codes. Please wait and try again.' });
        return;
      }
    } catch { /* no-op */ }
    setSecurityOtpSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setSecurityOtpPendingAction(action);
      setSecurityOtpCode('');
      addToast?.({ type: 'success', message: t.securityOtpSent || 'Verification code sent to your email.' });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || t.securityOtpSendError || 'Failed to send verification code.') });
    } finally {
      setSecurityOtpSending(false);
    }
  };

  const verifySecurityOtpAndRun = async () => {
    const email = String(authSession?.email || systemAccount?.email || '').trim();
    const token = String(securityOtpCode || '').trim();
    if (!email || !token) {
      addToast?.({ type: 'warning', message: t.securityOtpNeedCode || 'Enter the code sent to your email.' });
      return;
    }
    if (!securityOtpPendingAction) {
      addToast?.({ type: 'warning', message: t.securityOtpNoAction || 'No pending protected action.' });
      return;
    }
    setSecurityOtpVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (error) throw error;
      const action = securityOtpPendingAction;
      setSecurityOtpPendingAction('');
      setSecurityOtpCode('');
      if (action === 'reset-password') await performPasswordReset();
      if (action === 'logout-all') await performLogoutAllDevices();
      try {
        localStorage.removeItem('ds_security_otp_fail_count');
        localStorage.removeItem('ds_security_otp_lock_until');
      } catch { /* no-op */ }
    } catch (err) {
      try {
        const now = Date.now();
        const fails = Number(localStorage.getItem('ds_security_otp_fail_count') || '0') + 1;
        localStorage.setItem('ds_security_otp_fail_count', String(fails));
        if (fails >= 5) {
          localStorage.setItem('ds_security_otp_lock_until', String(now + 10 * 60 * 1000));
        }
      } catch { /* no-op */ }
      addToast?.({ type: 'error', message: String(err?.message || t.securityOtpInvalid || 'Invalid or expired code.') });
    } finally {
      setSecurityOtpVerifying(false);
    }
  };
  const exportSecurityAudit = (format = 'json') => {
    const rows = Array.isArray(securityAudit) ? securityAudit : [];
    if (!rows.length) {
      addToast?.({ type: 'info', message: t.securityNoAuditToExport || 'No security events to export.' });
      return;
    }
    if (format === 'csv') {
      const header = 'id,type,status,message,at';
      const body = rows.map((r) => (
        [r.id, r.type, r.status, String(r.message || '').replaceAll('"', '""'), r.at]
          .map((v) => `"${String(v ?? '')}"`)
          .join(',')
      ));
      const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dealsifter-security-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dealsifter-security-audit-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const terminateSession = (sessionId) => {
    try {
      const all = JSON.parse(localStorage.getItem('ds_security_sessions') || '[]');
      const rows = Array.isArray(all) ? all : [];
      const next = rows.filter((row) => String(row?.id || '') !== String(sessionId));
      localStorage.setItem('ds_security_sessions', JSON.stringify(next));
      setSecuritySessions((prev) => (prev || []).filter((row) => String(row?.id || '') !== String(sessionId)));
      const audit = JSON.parse(localStorage.getItem('ds_security_audit') || '[]');
      const nextAudit = Array.isArray(audit) ? audit : [];
      nextAudit.unshift(createSecuritySessionTerminatedAudit(sessionId));
      localStorage.setItem('ds_security_audit', JSON.stringify(nextAudit.slice(0, 200)));
      setSecurityAudit(nextAudit.slice(0, 12));
      addToast?.({ type: 'success', message: t.securitySessionTerminated || 'Session terminated.' });
    } catch {
      addToast?.({ type: 'error', message: t.securitySessionTerminateError || 'Failed to terminate session.' });
    }
  };
  const isSupportFullscreen = tab === 'communication' && commView === 'support';

  return (
    <div style={{ paddingTop: 58, minHeight: 'calc(var(--app-vh, 1vh) * 100)', background: C.bg, boxSizing: 'border-box', width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <style>{`
        @keyframes ds-warning-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .35; transform: scale(1.06); }
        }
      `}</style>
      {confirmPayload && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10020, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setConfirmPayload(null)}>
          <div style={{ background: C.card, border: `1px solid ${confirmPayload.variant === 'danger' ? C.danger : (C.warning || '#f59e0b')}`, borderRadius: 14, padding: '28px 28px 22px', maxWidth: 420, width: '90%', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: C.t1, lineHeight: '1.5' }}>{confirmPayload.message}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmPayload(null)} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {t.cancel || 'Cancel'}
              </button>
              <button onClick={() => { confirmPayload.onConfirm?.(); setConfirmPayload(null); }}
                style={{ border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer', background: confirmPayload.variant === 'danger' ? C.danger : (C.warning || '#f59e0b'), color: '#fff' }}>
                {t.confirm || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 18px 24px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.t1 }}>{t.title || 'System Settings'}</h2>
            <p style={{ margin: '5px 0 0', fontSize: 12, color: C.t3 }}>{t.subtitle || 'Manage account, payments and support.'}</p>
          </div>
          <button onClick={() => setPage?.(prevPage || 'dashboard')} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {t.backToApp || 'Back to app'}
          </button>
        </div>

        {!isSupportFullscreen ? (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, marginBottom: 12, background: C.alpha(C.accent, 0.04) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 12, color: C.t1 }}>
              Settings completion: {sectionProgress.percent}%
            </strong>
            <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>
              {sectionProgress.completed}/{sectionProgress.total} sections
            </span>
          </div>
          <div style={{ width: '100%', height: 7, borderRadius: 999, background: C.alpha(C.t1, 0.1), overflow: 'hidden', marginTop: 8 }}>
            <div style={{ width: `${sectionProgress.percent}%`, height: '100%', background: C.accent, transition: 'width .2s ease' }} />
          </div>
        </div>
        ) : null}

        {!isSupportFullscreen ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 8, marginBottom: 14, width: '100%', minWidth: 0 }}>
          <TabButton active={tab === 'profile'} onClick={() => setTab('profile')} label={t.tabProfile || 'User Profile'} />
          <TabButton active={tab === 'payments'} onClick={setPaymentTab} label={t.tabPayments || 'Payments (Stripe)'} />
          <TabButton active={tab === 'communication'} onClick={() => setTab('communication')} label={t.tabCommunication || 'Communication'} />
          <TabButton active={tab === 'security'} onClick={() => setTab('security')} label={t.tabSecurity || 'Security & Access'} />
          <TabButton active={tab === 'preferences'} onClick={() => setTab('preferences')} label={t.tabPreferences || 'Preferences'} />
          <TabButton active={tab === 'privacy'} onClick={() => setTab('privacy')} label={t.tabPrivacy || 'Privacy & Data'} />
        </div>
        ) : null}

        {!isSupportFullscreen ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 12, width: '100%', minWidth: 0 }}>
          {tab === 'profile' ? (
            <>
              <Panel title={t.profileTitle || 'System Account'} subtitle={t.profileSub || 'Credentials and account identity'}>
                <div style={{ display: 'grid', gap: 10, width: '100%', minWidth: 0 }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 12, color: C.t1 }}>{t.profileCompletion || 'Profile completion'}: {profileCompletion}%</strong>
                      <span style={{ fontSize: 11, color: profileSaveState === 'saving' ? C.warning || '#f59e0b' : C.accent, fontWeight: 700 }}>
                        {profileSaveState === 'saving' ? (t.saving || 'Saving...') : (t.saved || 'Saved')}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, borderRadius: 999, background: C.alpha(C.t1, 0.1), overflow: 'hidden' }}>
                      <div style={{ width: `${profileCompletion}%`, height: '100%', background: C.accent, transition: 'width .2s ease' }} />
                    </div>
                  </div>

                  <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.fullName || 'Full name'}</span>
                    <input value={systemAccount?.fullName || ''} onChange={(e) => updateField('fullName', e.target.value)} style={controlStyle} />
                  </label>
                  <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.email || 'Email'}</span>
                    <input value={systemAccount?.email || ''} onChange={(e) => updateField('email', e.target.value)} style={controlStyle} />
                  </label>
                  <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.phone || 'Phone'}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(112px, 38%) minmax(0, 1fr)', gap: 8, width: '100%', minWidth: 0 }}>
                      <select
                        value={profilePhoneCountryCode}
                        onChange={(e) => updateField('phoneCountryCode', e.target.value)}
                        style={controlStyle}
                      >
                        {PHONE_COUNTRY_OPTIONS.map((opt) => (
                          <option key={opt.code} value={opt.code}>{opt.label}</option>
                        ))}
                      </select>
                      <input
                        value={systemAccount?.phone || ''}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="(000) 000-0000"
                        style={controlStyle}
                      />
                    </div>
                  </label>
                  <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.accountType || 'Account type'}</span>
                    <select value={profileType} onChange={(e) => updateField('accountType', e.target.value)} style={controlStyle}>
                      <option value="individual">{t.individual || 'Individual'}</option>
                      <option value="business">{t.business || 'Business'}</option>
                      <option value="hybrid">{t.hybrid || 'Hybrid'}</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.marketAreas || 'Market areas'}</span>
                    <input value={profileMarkets} onChange={(e) => updateField('marketAreas', e.target.value)} placeholder={t.marketAreasPlaceholder || 'Ex: Orlando, Tampa, Miami'} style={controlStyle} />
                  </label>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 11, color: C.t2, display: 'grid', gap: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span>{t.emailVerification || 'Email verification'}</span>
                      <strong style={{ color: authSession?.emailVerified ? C.accent : C.warning || '#f59e0b' }}>
                        {authSession?.emailVerified ? (t.verified || 'Verified') : (t.pending || 'Pending')}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span>{t.phoneVerification || 'Phone verification'}</span>
                      <strong style={{ color: profilePhone ? C.accent : C.t3 }}>
                        {profilePhone ? (t.registered || 'Registered') : (t.notProvided || 'Not provided')}
                      </strong>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title={t.sessionTitle || 'Current Session'} subtitle={t.sessionSub || 'System-level session state'}>
                <div style={{ display: 'grid', gap: 10, width: '100%', minWidth: 0 }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12, color: C.t2, width: '100%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                    {t.loggedAs || 'Logged as'}: <strong style={{ color: C.t1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{authSession?.email || '-'}</strong>
                  </div>
                  <button onClick={logout} style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    {t.logout || 'Sign out'}
                  </button>
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'payments' ? (
            <>
              <Panel title={t.subscriptionTitle || 'Subscription'} subtitle={t.subscriptionSub || 'Current plan and lifecycle'}>
                <div style={{ display: 'grid', gap: 8, width: '100%', minWidth: 0 }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 6, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.currentPlan || 'Current plan'}: <strong style={{ color: C.t1 }}>{activeSubscription?.planName || 'Free'}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.planStatus || 'Status'}: <strong style={{ color: C.t1 }}>{activeSubscription?.status || 'active'}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.nextBilling || 'Next billing'}:{' '}
                      <strong style={{ color: C.t1 }}>
                        {nextBillingLabel}
                      </strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.monthlyValue || 'Monthly value'}:{' '}
                      <strong style={{ color: C.t1 }}>
                        {monthlyValue > 0 ? `$${monthlyValue.toFixed(2)}` : (t.notApplicable || 'N/A')}
                      </strong>
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12, color: C.t3, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    {t.stripeManaged || 'Plan changes and billing are managed via Stripe. Use the button below to access the Stripe Customer Portal.'}
                  </div>
                  {pendingCheckoutIntent ? (
                    <div style={{ border: `1px solid ${C.accent}`, borderRadius: 10, padding: 10, fontSize: 12, color: C.t2, background: C.alpha(C.accent, 0.06), width: '100%', minWidth: 0, boxSizing: 'border-box', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      <strong style={{ color: C.t1 }}>{pendingCheckoutLabel}</strong>
                      <div style={{ marginTop: 6 }}>
                        {t.pendingCheckoutInfo || 'Continue to Stripe Checkout to securely enter or save your payment method.'}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: 4 }}>
                  <div style={{ fontSize: 11, color: C.t3 }}>{t.billingOverview || 'Billing overview'}</div>
                    {billingHistoryLoading ? (
                      <div style={{ fontSize: 12, color: C.t2 }}>{t.loading || 'Loading...'}</div>
                    ) : null}
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.totalInvoices || 'Total invoices'}: <strong style={{ color: C.t1 }}>{billingSummary.invoices}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.totalPaid || 'Total paid'}: <strong style={{ color: C.t1 }}>${billingSummary.totalPaid.toFixed(2)}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {t.lastInvoice || 'Last invoice'}: <strong style={{ color: C.t1 }}>{billingSummary.lastInvoice?.id || (t.notApplicable || 'N/A')}</strong>
                    </div>
                  </div>
                  {canManageStripePortal ? (
                    <button
                      onClick={async () => {
                        try {
                          await redirectToPortal();
                        } catch (err) {
                          addToast?.({ type: 'error', message: String(err?.message || t.billingPortalUnavailable || 'Billing portal is unavailable right now.') });
                        }
                      }}
                      style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: C.accent, color: '#fff', borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                    >
                      {t.manageStripe || 'Manage via Stripe Portal'}
                    </button>
                  ) : (
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 12, color: C.t3 }}>
                      {t.portalAvailableAfterPayment || 'Stripe portal will be available after your first payment/subscription record.'}
                    </div>
                  )}
                  {pendingCheckoutIntent ? (
                    <button
                      onClick={() => {
                        if (typeof onContinuePendingCheckout === 'function') {
                          onContinuePendingCheckout();
                        }
                      }}
                      style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.accent}`, background: C.accent, color: '#fff', borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                    >
                      {t.continueStripeCheckout || 'Continue to Stripe Checkout'}
                    </button>
                  ) : null}
                </div>
              </Panel>

              <Panel title={t.paymentsTitle || 'Payment Methods'} subtitle={t.paymentsSub || 'Managed by Stripe'}>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, fontSize: 12, color: C.t3, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  {t.paymentsManagedInfo || 'Payment methods are securely managed by Stripe. Access the portal above to add or update cards.'}
                </div>
                <div style={{ marginTop: 10, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{t.invoiceHistory || 'Invoice history'}</div>
                  <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {(billingHistoryLoading ? [{ id: 'loading', createdAt: null, amount: 0, status: 'loading', planName: t.loading || 'Loading...' }] : (billingHistory?.length ? billingHistory : [{ id: 'empty', createdAt: null, amount: 0, status: 'none', planName: t.notApplicable || 'N/A' }])).map((row) => (
                      <div key={row.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, display: 'grid', gap: 2 }}>
                        <div style={{ fontSize: 11, color: C.t2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                          <strong style={{ color: C.t1 }}>{row.id === 'empty' ? (t.noInvoices || 'No invoices yet') : (row.id === 'loading' ? (t.loading || 'Loading...') : row.id)}</strong>
                        </div>
                        {row.id !== 'empty' && row.id !== 'loading' ? (
                          <>
                            <div style={{ fontSize: 11, color: C.t2 }}>{new Date(row.createdAt).toLocaleDateString('en-US')} • {row.planName}</div>
                            <div style={{ fontSize: 11, color: C.t2 }}>${Number(row.amount || 0).toFixed(2)} • <strong style={{ color: row.status === 'paid' ? C.accent : C.warning || '#f59e0b' }}>{row.status}</strong></div>
                          </>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'communication' ? (
            <>
              <Panel title={t.commTitle || 'Communication'} subtitle={t.commSub || 'Support and contact channels'}>
                <div style={{ display: 'grid', gap: 8, width: '100%', minWidth: 0 }}>
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent('Suport solicitation');
                      const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
                      try {
                        const opened = window.open(mailtoUrl, '_self');
                        if (!opened) window.location.href = mailtoUrl;
                      } catch {
                        window.location.href = mailtoUrl;
                      }
                    }}
                    style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="email" size={13} color={C.t2} /> {t.contactEmail || 'Contact by email'}
                  </button>
                  <button
                    onClick={openSupportChat}
                    style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="chat" size={13} color={C.t2} /> {t.contactChat || 'Open support chat'}
                    {supportTicket?.contactId ? (
                      <span style={{ color: C.accent, fontSize: 10, fontWeight: 900 }}>#{supportTicket.contactId}</span>
                    ) : null}
                  </button>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8, width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>{t.commEmailAlerts || 'Email alerts'}</span>
                      <input type="checkbox" checked={Boolean(commPrefs?.email)} onChange={() => toggleComm('email')} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>Chat notifications</span>
                      <input type="checkbox" checked={Boolean(commPrefs?.chat)} onChange={() => toggleComm('chat')} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>Marketing updates</span>
                      <input type="checkbox" checked={Boolean(commPrefs?.marketing)} onChange={() => toggleComm('marketing')} />
                    </label>
                  </div>
                </div>
              </Panel>
            </>
          ) : null}

          {tab === 'security' ? (
            <Panel title={t.securityTitle || 'Security & Access'} subtitle={t.securitySub || 'Login password and access controls'}>
              <div style={{ display: 'grid', gap: 10, width: '100%', minWidth: 0 }}>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{t.securityCenter || 'Security Center'}</div>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    {t.securityMfaStatus || 'MFA status'}: <strong style={{ color: C.accent }}>{t.securityMfaEnabled || 'Enabled (Email OTP)'}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    {t.securityEmailStatus || 'Email verification'}:{' '}
                    <strong style={{ color: authSession?.emailVerified ? C.accent : C.warning || '#f59e0b' }}>
                      {authSession?.emailVerified ? (t.verified || 'Verified') : (t.pending || 'Pending')}
                    </strong>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    {t.securityAuditEvents || 'Recent security events'}: <strong style={{ color: C.t1 }}>{securityAudit.length}</strong>
                  </div>
                </div>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    {t.securityEmail || 'Login email'}:{' '}
                    <strong style={{ color: C.t1, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                      {authSession?.email || systemAccount?.email || '-'}
                    </strong>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    {t.securityEmailStatus || 'Email verification'}:{' '}
                    <strong style={{ color: authSession?.emailVerified ? C.accent : C.warning || '#f59e0b' }}>
                      {authSession?.emailVerified ? (t.verified || 'Verified') : (t.pending || 'Pending')}
                    </strong>
                  </div>
                  <div style={{ fontSize: 12, color: C.t2 }}>
                    {t.securityMfaStatus || 'MFA status'}:{' '}
                    <strong style={{ color: C.accent }}>{t.securityMfaEnabled || 'Enabled (Email OTP)'}</strong>
                  </div>
                </div>

                <button
                  onClick={() => requestSecurityEmailOtp('reset-password')}
                  style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                >
                  {t.securityResetPassword || 'Send password reset email (protected)'}
                </button>

                <button
                  onClick={() => requestSecurityEmailOtp('logout-all')}
                  style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${C.warning || '#f59e0b'}`, background: C.alpha(C.warning || '#f59e0b', 0.08), color: C.warning || '#f59e0b', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                >
                  {t.securityLogoutAll || 'Sign out from all devices (protected)'}
                </button>

                {securityOtpPendingAction ? (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, color: C.t2 }}>
                      {t.securityOtpPrompt || 'Enter the verification code sent to your email to continue.'}
                    </div>
                    <input
                      value={securityOtpCode}
                      onChange={(e) => setSecurityOtpCode(e.target.value)}
                      placeholder={t.securityOtpPlaceholder || 'Verification code'}
                      style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', background: C.bg, color: C.t1, fontSize: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={verifySecurityOtpAndRun}
                        disabled={securityOtpVerifying}
                        style={{ flex: 1, border: 'none', background: C.accent, color: '#fff', borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: securityOtpVerifying ? 'not-allowed' : 'pointer', opacity: securityOtpVerifying ? 0.7 : 1 }}
                      >
                        {securityOtpVerifying ? (t.verifying || 'Verifying...') : (t.confirm || 'Confirm')}
                      </button>
                      <button
                        onClick={() => {
                          setSecurityOtpPendingAction('');
                          setSecurityOtpCode('');
                        }}
                        style={{ flex: 1, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      >
                        {t.cancel || 'Cancel'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {securityOtpSending ? (
                  <div style={{ fontSize: 11, color: C.t3 }}>
                    {t.securitySendingOtp || 'Sending verification code...'}
                  </div>
                ) : null}

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{t.securitySessions || 'Active sessions'}</div>
                  <div style={{ display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {(securitySessions.length ? securitySessions : [{ id: 'none', device: t.notApplicable || 'N/A', current: true, lastSeenAt: null }]).map((row) => (
                      <div key={row.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 11, color: C.t1 }}>{row.device}</div>
                        <div style={{ fontSize: 10, color: C.t3 }}>
                          {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString('en-US') : (t.notApplicable || 'N/A')}
                          {row.current ? ` • ${t.currentSession || 'Current session'}` : ''}
                        </div>
                        {!row.current && row.id !== 'none' ? (
                          <button
                            onClick={() => terminateSession(row.id)}
                            style={{ marginTop: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 6, padding: '5px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}
                          >
                            {t.securityTerminateSession || 'Terminate session'}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{t.securityAudit || 'Security audit log'}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => exportSecurityAudit('json')} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 6, padding: '5px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {t.securityExportJson || 'Export JSON'}
                    </button>
                    <button onClick={() => exportSecurityAudit('csv')} style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 6, padding: '5px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {t.securityExportCsv || 'Export CSV'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                    {(securityAudit.length ? securityAudit : [{ id: 'none', type: 'none', status: 'none', message: t.notApplicable || 'N/A', at: null }]).map((evt) => (
                      <div key={evt.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}>
                        <div style={{ fontSize: 11, color: C.t1, textTransform: 'capitalize' }}>{String(evt.type || 'event')} • {String(evt.status || '').toUpperCase()}</div>
                        <div style={{ fontSize: 10, color: C.t2 }}>{evt.message}</div>
                        <div style={{ fontSize: 10, color: C.t3 }}>{evt.at ? new Date(evt.at).toLocaleString('en-US') : ''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
          ) : null}

          {tab === 'preferences' ? (
            <Panel title={t.preferencesTitle || 'Preferences'} subtitle={t.preferencesSub || 'Interface and notification preferences'}>
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>1) Map View</div>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.prefInitialZoom || 'Initial zoom'}</span>
                    <input type="range" min={3} max={13} step={1} value={initialZoomValue} onChange={(e) => updatePreferences((prev) => ({ ...prev, map: { ...(prev?.map || {}), initialZoom: Number(e.target.value) } }))} />
                    <div style={{ fontSize: 10, color: C.t3, fontWeight: 700 }}>
                      {(t.prefTargetLevel || 'Target level')}: <span style={{ color: C.t1 }}>{initialZoomLevelLabel}</span> ({t.prefZoomLabel || 'zoom'} {initialZoomValue})
                    </div>
                  </label>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>Default style</span>
                    <select value={selectedDefaultMapStyle} onChange={(e) => updatePreferences((prev) => ({ ...prev, map: { ...(prev?.map || {}), defaultStyle: e.target.value } }))} style={controlStyle}>
                      <option value="simple">Simple</option>
                      <option value="satellite_streets">Satellite + Streets</option>
                      <option value="topo">Terrain</option>
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>Cluster behavior</span>
                    <select value={String(prefs?.map?.clusterBehavior || 'pins_city')} onChange={(e) => updatePreferences((prev) => ({ ...prev, map: { ...(prev?.map || {}), clusterBehavior: e.target.value } }))} style={controlStyle}>
                      <option value="pins_city">City level = only pins</option>
                      <option value="mixed">Keep mixed clusters/pins</option>
                    </select>
                  </label>
                </div>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{t.prefFeedMatchesTitle || '2) Feed & Matches'}</div>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.prefDefaultOrdering || 'Default ordering'}</span>
                    <select
                      value={String(prefs?.feedMatches?.sortOrder || 'random')}
                      onChange={(e) => {
                        const nextSortOrder = e.target.value;
                        if (nextSortOrder === 'my_cards_first' && !hasPaidPlan) {
                          addToast?.({ type: 'warning', message: t.prefMyCardsPaidOnly || 'My cards first is available for paid plans.' });
                          return;
                        }
                        updatePreferences((prev) => ({ ...prev, feedMatches: { ...(prev?.feedMatches || {}), sortOrder: nextSortOrder } }));
                      }}
                      style={controlStyle}
                    >
                      <option value="random">{t.prefSortRandom || 'Random on first login'}</option>
                      <option value="recent">{t.prefSortRecent || 'Most recent'}</option>
                      <option value="name_asc">{t.prefSortNameAsc || 'Name (A-Z)'}</option>
                      <option value="price_asc">{t.prefSortPriceAsc || 'Price (low to high)'}</option>
                      <option value="price_desc">{t.prefSortPriceDesc || 'Price (high to low)'}</option>
                      <option value="my_cards_first" disabled={!hasPaidPlan}>{t.prefSortMyCardsFirst || 'My cards first (paid plans)'}</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                    <span>{t.prefAutoplayMedia || 'Autoplay media'}</span>
                    <input type="checkbox" checked={Boolean(prefs?.feedMatches?.autoplayMedia)} onChange={() => updatePreferences((prev) => ({ ...prev, feedMatches: { ...(prev?.feedMatches || {}), autoplayMedia: !prev?.feedMatches?.autoplayMedia } }))} />
                  </label>
                </div>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{t.prefChatLanguageTitle || '3) Chat language config'}</div>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.prefChatInputLang || 'I type in'}</span>
                    <select value={chatInputLang} onChange={(e) => updatePreferences((prev) => ({ ...prev, chatLanguage: { ...(prev?.chatLanguage || {}), input: e.target.value } }))} style={controlStyle}>
                      {CHAT_LANGUAGE_OPTIONS.map((opt) => <option key={`pref-chat-in-${opt.code}`} value={opt.code}>{opt.label}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.prefChatOutputLang || 'I receive in'}</span>
                    <select value={chatOutputLang} onChange={(e) => updatePreferences((prev) => ({ ...prev, chatLanguage: { ...(prev?.chatLanguage || {}), output: e.target.value } }))} style={controlStyle}>
                      {CHAT_LANGUAGE_OPTIONS.map((opt) => <option key={`pref-chat-out-${opt.code}`} value={opt.code}>{opt.label}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{t.prefPrivacyTitle || '4) Privacy'}</div>
                  <label style={{ display: 'grid', gap: 5 }}>
                    <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.prefPresenceStatus || 'Presence status'}</span>
                    <select value={String(prefs?.privacy?.presenceStatus || 'online')} onChange={(e) => updatePreferences((prev) => ({ ...prev, privacy: { ...(prev?.privacy || {}), presenceStatus: e.target.value } }))} style={controlStyle}>
                      <option value="online">{t.prefPresenceOnline || 'Online (green)'}</option>
                      <option value="standby">{t.prefPresenceStandby || 'Stand by (yellow)'}</option>
                      <option value="offline">{t.prefPresenceOffline || 'Offline (red)'}</option>
                    </select>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                    <span>{t.prefReadReceipts || 'Read receipts'}</span>
                    <input type="checkbox" checked={Boolean(prefs?.privacy?.readReceipts)} onChange={() => updatePreferences((prev) => ({ ...prev, privacy: { ...(prev?.privacy || {}), readReceipts: !prev?.privacy?.readReceipts } }))} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                    <span>{t.prefMessagePreview || 'Message preview'}</span>
                    <input type="checkbox" checked={Boolean(prefs?.privacy?.messagePreview)} onChange={() => updatePreferences((prev) => ({ ...prev, privacy: { ...(prev?.privacy || {}), messagePreview: !prev?.privacy?.messagePreview } }))} />
                  </label>
                </div>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.t1 }}>{t.prefLocalStorageTitle || '5) Local Storage'}</div>
                  <button
                    onClick={() => {
                      try {
                        localStorage.removeItem('mapViewport');
                        localStorage.removeItem('mapViewPanelCollapsed');
                        localStorage.removeItem('mapViewPanelWidth');
                        localStorage.removeItem('ds_map_ui_state');
                        localStorage.removeItem('ds_mapview_ui_state_v1');
                        localStorage.removeItem('ds_geocode_cache');
                        localStorage.removeItem('ds_notif_deferred_chat');
                        localStorage.removeItem('ds_notif_deferred_system');
                        localStorage.removeItem('chatSeenIncomingByContact');
                        addToast?.({ type: 'success', message: t.prefLocalCacheCleared || 'Local cache cleared.' });
                      } catch {
                        addToast?.({ type: 'error', message: t.prefLocalCacheClearError || 'Failed to clear local cache.' });
                      }
                    }}
                    style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {t.prefClearLocalCache || 'Clear local cache'}
                  </button>
                  <button
                    onClick={() => {
                      const resetPrefs = {
                        map: { initialZoom: 4, defaultStyle: 'simple', clusterBehavior: 'pins_city', defaultFilters: { showPeople: true, showProperties: true, showOnlyUnlocked: false, showOnlyMyPins: false } },
                        feedMatches: { sortOrder: 'random', autoplayMedia: false },
                        chatLanguage: { input: 'pt', output: 'en' },
                        privacy: { presenceStatus: 'online', readReceipts: true, messagePreview: true },
                      };
                      updatePreferences(resetPrefs);
                      addToast?.({ type: 'success', message: t.prefResetSuccess || 'Preferences reset to default.' });
                    }}
                    style={{ border: `1px solid ${C.warning || '#f59e0b'}`, background: C.alpha(C.warning || '#f59e0b', 0.08), color: C.warning || '#f59e0b', borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
                  >
                    {t.prefResetPreferences || 'Reset preferences'}
                  </button>
                </div>
              </div>
            </Panel>
          ) : null}

          {tab === 'privacy' ? (
            <>
              <Panel title={t.privacyTitle || 'Privacy & Data'} subtitle={t.privacySub || 'Manage your privacy choices and data rights'}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, fontSize: 12, lineHeight: '1.5', color: C.t2 }}>
                    <div style={{ fontWeight: 700, color: C.t1, marginBottom: 4 }}>{t.privacyRightsTitle || 'Your privacy rights'}</div>
                    {t.privacyRightsText || 'You can access, correct, export, or delete your personal data, and manage consent settings at any time.'}
                  </div>

                  <button
                    onClick={async () => {
                      if (!isSupabaseConfigured || !supabase || !supabaseUserId) {
                        addToast?.({ type: 'error', message: t.privacyNeedLogin || 'Sign in to export your data.' });
                        return;
                      }
                      try {
                        const { data, error } = await supabase.rpc('export_user_data', { target_user_id: supabaseUserId });
                        if (error) throw error;
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `dealsifter-dados-${new Date().toISOString().slice(0, 10)}.json`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                        addToast?.({ type: 'success', title: t.privacyExportSuccessTitle || 'Data exported', message: t.privacyExportSuccessMessage || 'Download started successfully.' });
                      } catch (err) {
                        addToast?.({ type: 'error', message: String(err?.message || t.privacyExportError || 'Failed to export data.') });
                      }
                    }}
                    style={{
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      color: C.t1,
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="download" size={13} color={C.t1} />
                    {t.exportData || 'Export my data (JSON)'}
                  </button>

                  <button
                    onClick={() => {
                      const subject = encodeURIComponent(t.privacyCorrectionSubject || 'Data correction request');
                      const body = encodeURIComponent(t.privacyCorrectionBody || 'Hello DealSifter Team,\n\nI would like to request a correction of my account data.\n\nThank you.');
                      window.location.href = `mailto:contato.dealsifter@gmail.com?subject=${subject}&body=${body}`;
                    }}
                    style={{
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      color: C.t1,
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="edit" size={13} color={C.t1} />
                    {t.privacyCorrectionCta || 'Request data correction'}
                  </button>

                  <button
                    onClick={() => {
                      const payload = {
                        generatedAt: new Date().toISOString(),
                        accountEmail: authSession?.email || systemAccount?.email || '',
                        controls: privacyControls,
                        cookieConsent: (() => { try { return localStorage.getItem('ds_cookie_consent') === '1'; } catch { return false; } })(),
                        lgpdConsent: (() => { try { return localStorage.getItem('ds_lgpd_consent') === '1'; } catch { return false; } })(),
                      };
                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `dealsifter-consent-receipt-${new Date().toISOString().slice(0, 10)}.json`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      URL.revokeObjectURL(url);
                    }}
                    style={{
                      border: `1px solid ${C.border}`,
                      background: 'transparent',
                      color: C.t1,
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="fileText" size={13} color={C.t1} />
                    {t.privacyConsentReceipt || 'Download consent receipt'}
                  </button>

                  {onRevokeConsent && (
                    <button
                      onClick={() => {
                        setConfirmPayload({
                          message: t.privacyRevokeConfirm || 'Do you want to revoke data-processing consent? You will be redirected to home and must consent again to use the platform.',
                          variant: 'warning',
                          onConfirm: onRevokeConsent,
                        });
                      }}
                      style={{
                        border: `1px solid ${C.alpha?.(C.warning || '#f59e0b', 0.5) || '#f59e0b'}`,
                        background: C.alpha?.(C.warning || '#f59e0b', 0.08) || 'transparent',
                        color: C.warning || '#f59e0b',
                        borderRadius: 8,
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <Icon name="alertTriangle" size={13} color={C.warning || '#f59e0b'} />
                      {t.privacyRevokeCta || 'Revoke data-processing consent'}
                    </button>
                  )}

                  <div style={{ fontSize: 11, color: C.t3 }}>
                    {t.privacyContact || 'Privacy contact'}: <strong>contato.dealsifter@gmail.com</strong>
                  </div>

                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{t.privacyControlsTitle || 'US privacy controls (CCPA/CPRA style)'}</div>
                    <label style={{ display: 'grid', gap: 5 }}>
                      <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.profileVisibility || 'Profile visibility'}</span>
                      <select
                        value={profileVisibility}
                        disabled={profileVisibilitySaving}
                        onChange={(e) => updateProfileVisibility(e.target.value)}
                        style={controlStyle}
                      >
                        <option value="hidden">{t.profileVisibilityHidden || 'Hidden'}</option>
                        <option value="network">{t.profileVisibilityNetwork || 'Network only'}</option>
                        <option value="public">{t.profileVisibilityPublic || 'Public'}</option>
                      </select>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>{t.privacyDoNotSell || 'Do not sell/share my personal information'}</span>
                      <input type="checkbox" checked={Boolean(privacyControls.doNotSellShare)} onChange={() => setPrivacyControls((prev) => ({ ...prev, doNotSellShare: !prev.doNotSellShare }))} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>{t.privacyTargetAdsOptOut || 'Opt out of targeted advertising'}</span>
                      <input type="checkbox" checked={Boolean(privacyControls.targetedAdsOptOut)} onChange={() => setPrivacyControls((prev) => ({ ...prev, targetedAdsOptOut: !prev.targetedAdsOptOut }))} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.t2 }}>
                      <span>{t.privacyMarketingEmails || 'Allow marketing emails'}</span>
                      <input type="checkbox" checked={Boolean(privacyControls.marketingEmails)} onChange={() => setPrivacyControls((prev) => ({ ...prev, marketingEmails: !prev.marketingEmails }))} />
                    </label>
                    <label style={{ display: 'grid', gap: 5 }}>
                      <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.privacyCookieScope || 'Cookie scope'}</span>
                      <select value={String(privacyControls.cookieScope || 'all')} onChange={(e) => setPrivacyControls((prev) => ({ ...prev, cookieScope: e.target.value }))} style={controlStyle}>
                        <option value="all">{t.privacyCookieAll || 'All cookies'}</option>
                        <option value="essential">{t.privacyCookieEssential || 'Essential only'}</option>
                      </select>
                    </label>
                  </div>
                </div>
              </Panel>

              <Panel title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-flex', animation: 'ds-warning-blink 1s ease-in-out infinite' }}><Icon name="alertTriangle" size={13} color={C.warning || '#f59e0b'} /></span>{t.dangerZone || 'Danger Zone'}</span>} subtitle={t.dangerSub || 'Irreversible actions'}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ border: `1px solid ${C.alpha?.(C.danger || '#ef4444', 0.3) || '#ef4444'}`, borderRadius: 10, padding: 10, fontSize: 12, lineHeight: '1.5', color: C.t2 }}>
                    <div style={{ fontWeight: 700, color: C.danger || '#ef4444', marginBottom: 4 }}>{t.privacyDeleteTitle || 'Delete my account'}</div>
                    {t.privacyDeleteDesc || 'This will permanently remove profile, portfolio, matches, and related records. This action cannot be undone.'}
                  </div>
                  <button
                    onClick={() => {
                      setConfirmPayload({
                        message: t.privacyDeleteConfirm || 'Are you sure you want to delete your account and all your data? This action is irreversible.',
                        variant: 'danger',
                        onConfirm: onDeleteAccount,
                      });
                    }}
                    style={{
                      border: `1px solid ${C.danger || '#ef4444'}`,
                      background: C.alpha?.(C.danger || '#ef4444', 0.1) || 'transparent',
                      color: C.danger || '#ef4444',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Icon name="alertTriangle" size={13} color={C.danger || '#ef4444'} />
                    {t.deleteAccount || 'Delete my account permanently'}
                  </button>
                </div>
              </Panel>
            </>
          ) : null}
        </div>
        ) : null}

        {isSupportFullscreen ? (
          <section style={{ border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'grid', gridTemplateRows: 'auto 1fr auto', minHeight: 'calc(var(--app-vh, 1vh) * 100 - 170px)' }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <button
                onClick={() => setCommView('menu')}
                style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name="back" size={13} color={C.t2} />
                {t.back || 'Back'}
              </button>
              <button
                onClick={() => setTab('preferences')}
                title={t.prefChatLanguageTitle || 'Chat language settings'}
                style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name="globe" size={13} color={C.t2} />
                {t.chatSettings || 'Chat settings'}
              </button>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.t1, textAlign: 'right' }}>
                <div>{t.supportHeader || 'DealSifter Admin/Support'}</div>
                <div style={{ fontSize: 10, color: C.t3, fontWeight: 700 }}>
                  {supportTicket?.contactId
                    ? `${t.supportContactId || 'Contact ID'}: ${supportTicket.contactId} · #${supportTicket.ticketNumber || '-'}`
                    : (supportLoading ? (t.loading || 'Loading...') : (t.supportNewTicket || 'New support ticket'))}
                </div>
              </div>
            </div>

            <div style={{ padding: 12, overflowY: 'auto', display: 'grid', gap: 8, background: C.alpha(C.bg, 0.35) }}>
              {supportLoading ? (
                <div style={{ justifySelf: 'center', color: C.t3, fontSize: 12 }}>{t.loading || 'Loading...'}</div>
              ) : null}
              {!supportLoading && !(supportMessages || []).length ? (
                <div style={{ justifySelf: 'center', color: C.t3, fontSize: 12, textAlign: 'center', maxWidth: 320 }}>
                  {t.supportWelcome || 'Hello! This is DealSifter Admin/Support. How can we help?'}
                </div>
              ) : null}
              {(supportMessages || []).map((item) => (
                <div key={item.id} style={{ justifySelf: item.from === 'user' ? 'end' : 'start', width: 'fit-content', minWidth: 0, maxWidth: 'min(620px, 86%)', border: `1px solid ${item.from === 'user' ? C.accent : C.border}`, background: item.from === 'user' ? C.alpha(C.accent, 0.12) : 'transparent', borderRadius: 10, padding: '6px 8px', fontSize: 12, color: C.t1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: item.from === 'user' ? C.accent : C.t3, marginBottom: 2 }}>
                    {item.from === 'user' ? (t.supportYou || 'You') : (t.supportHeader || 'DealSifter Admin/Support')}
                  </div>
                  <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{item.text}</div>
                  <div style={{ marginTop: 3, fontSize: 9, color: C.t3 }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 6 }}>
              <input
                value={supportInput}
                onChange={(e) => setSupportInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  handleSendSupportMessage('chat');
                }}
                placeholder={t.supportInputPlaceholder || 'Write your message...'}
                disabled={supportSending}
                style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', background: C.bg, color: C.t1, fontSize: 12 }}
              />
              <button
                onClick={() => handleSendSupportMessage('chat')}
                disabled={supportSending || !String(supportInput || '').trim()}
                style={{ border: 'none', background: C.accent, color: '#fff', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 800, cursor: supportSending ? 'wait' : 'pointer', opacity: supportSending || !String(supportInput || '').trim() ? 0.7 : 1 }}
              >
                {supportSending ? (t.sending || 'Sending...') : (t.send || 'Send')}
              </button>
              <button
                onClick={() => handleSendSupportMessage('email')}
                disabled={supportSending || !String(supportInput || '').trim()}
                title={t.supportSendEmail || 'Send by email'}
                style={{ border: `1px solid ${C.border}`, background: 'transparent', color: C.t2, borderRadius: 8, padding: '9px 10px', fontSize: 12, fontWeight: 800, cursor: supportSending ? 'wait' : 'pointer', opacity: supportSending || !String(supportInput || '').trim() ? 0.7 : 1 }}
              >
                <Icon name="email" size={13} color={C.t2} />
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}



