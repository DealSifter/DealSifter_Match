import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { C } from '../theme/colors';
import { translations, useT } from '../i18n/translations';
import { PROPERTIES as _MOCK_PROPERTIES, CATEGORIES, SERVICE_PORTFOLIO as _MOCK_SERVICE_PORTFOLIO } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { PlanGateModal } from '../components/modals/PlanGateModal';
import { PropertyCard } from '../components/cards/PropertyCard';
import { SwipeCard } from '../components/cards/SwipeCard';
import { SmartImage } from '../components/ui/SmartImage';
import { ExclusivityBadge } from '../components/ui/ExclusivityBadge';
import { CardStatusIcon } from '../components/ui/CardStatusIndicators';
import { PortfolioContactPanel } from '../components/matches/PortfolioContactPanel';
import { MatchesPeopleList } from '../components/matches/MatchesPeopleList';
import { MatchesInterestsList } from '../components/matches/MatchesInterestsList';
import { CARD_STATUS } from '../components/ui/cardStatusTokens';
import { catIcon } from '../lib/catIcon';
import { buildDisplayContacts } from '../lib/contactPriority';
import { inferRecordProfileScope, normalizeProfileScope, resolveScopedProfile } from '../lib/profileScopeResolver';
import { formatPropertyLocation } from '../lib/formatPropertyLocation';
import { translateChatText, getSafeLang } from '../services/chatTranslation';
import { getPlanGateCopy, isFeatureAllowed } from '../services/planUsageService';
import { trackAppEvent } from '../lib/adminEventTracking';
import { getPortfolioUnlockCost, getPropertyExclusivityStatus } from '../lib/unlockRules';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { normalizeCard } from '../lib/normalizeFeedCard';
import { formatCompactUsd } from '../lib/formatMoney';
import { captureEntitlementAlert, hashForTelemetry } from '../lib/observability';
import { canonicalContactToDisplayCard, resolveCanonicalContactCardFromMap } from '../lib/matchesEntitlement';
import { getActiveExclusivities } from '../services/unlockService';
import {
  getContactByOwnerId,
  hasOwnerPortfolioEntitlement,
  isOwnerUnlocked as isCanonicalOwnerUnlocked,
  isPropertyUnlocked as isCanonicalPropertyUnlocked,
} from '../services/unlockedContactService';
import { useUnlockNotifications } from '../hooks/useUnlockNotifications';
import appLogo from '../assets/logo-dark-theme.png';

const PROPERTIES = import.meta.env.DEV ? (_MOCK_PROPERTIES || []) : [];
const SERVICE_PORTFOLIO = import.meta.env.DEV ? (_MOCK_SERVICE_PORTFOLIO || []) : [];

function readLocalStringSet(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : []);
  } catch (e) {
    void e;
    return new Set();
  }
}

function writeLocalStringSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify([...value].map((item) => String(item || '').trim()).filter(Boolean)));
  } catch (e) {
    void e;
  }
}

function getUserScopedStorageKey(baseKey, userId) {
  const normalizedUserId = String(userId || '').trim();
  if (isSupabaseConfigured && normalizedUserId && normalizedUserId !== 'local-user') {
    return `${baseKey}:${normalizedUserId}`;
  }
  return baseKey;
}

function ServiceImageCarousel({ images = [], title = '', compact = false }) {
  const safeImages = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const [index, setIndex] = useState(0);

  if (!safeImages.length) {
    return (
      <div style={{ width: '100%', padding: compact ? 28 : 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="chat" size={28} color={C.t3} />
      </div>
    );
  }

  const safeIndex = Math.max(0, Math.min(index, safeImages.length - 1));
  const showControls = safeImages.length > 1;
  const goPrev = (event) => {
    event.stopPropagation();
    setIndex((prev) => (prev <= 0 ? safeImages.length - 1 : prev - 1));
  };
  const goNext = (event) => {
    event.stopPropagation();
    setIndex((prev) => (prev >= safeImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.alpha(C.t1, 0.02), borderRadius: compact ? 12 : 8, overflow: 'hidden', marginBottom: compact ? 12 : 8 }}>
      <SmartImage
        src={safeImages[safeIndex]}
        alt={title}
        style={{ width: '100%', height: 'auto', maxHeight: compact ? 220 : '60vh', objectFit: 'contain', display: 'block' }}
      />
      {showControls ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous image"
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 999, border: 'none', background: C.alpha(C.bg, 0.72), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Icon name="chevronLeft" size={18} color={C.t1} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next image"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 999, border: 'none', background: C.alpha(C.bg, 0.72), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <Icon name="chevronRight" size={18} color={C.t1} />
          </button>
          <div style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
            {safeImages.map((_, dotIdx) => (
              <button
                key={`service-image-dot-${dotIdx}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIndex(dotIdx);
                }}
                aria-label={`Image ${dotIdx + 1}`}
                style={{ width: dotIdx === safeIndex ? 16 : 7, height: 7, borderRadius: 999, border: 'none', background: dotIdx === safeIndex ? C.accent : C.alpha(C.t1, 0.22), cursor: 'pointer', padding: 0 }}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// Move chat templates and defaults to module scope so they are stable references
const CHAT_REPLY_TEMPLATES = {
  pt: [
    'Perfeito. Vou verificar e te retornar em breve.',
    'Obrigado pelas informações. Quer fechar em breve?',
    'Excelente. Vamos conversar com mais detalhes.',
    'Recebi sua solicitação. Vou enviar o material agora.',
    'Interessante. Vou revisar os números por aqui.',
  ],
  en: [
    "Got it! I'll check and get back to you!",
    'Thanks for the info. Are you looking to close soon?',
    "That sounds great. Let's talk more details.",
    "I've received your inquiry. Sending package now.",
    'Interesting. Let me run numbers on my end.',
  ],
  es: [
    'Entendido. Lo reviso y te respondo en breve.',
    'Gracias por la info. ¿Buscas cerrar pronto?',
    'Suena bien. Hablemos de más detalles.',
    'Recibí tu consulta. Te envío el paquete ahora.',
    'Interesante. Voy a revisar los números de mi lado.',
  ],
};

const CHAT_INTEREST_PREFIX = {
  pt: 'Tenho interesse neste imóvel',
  en: 'I am interested in this property',
  es: 'Tengo interés en esta propiedad',
};

const CHAT_INTEREST_SERVICE_PREFIX = {
  pt: 'Tenho interesse neste serviço',
  en: 'I am interested in this Service',
  es: 'Tengo interés en este servicio',
};

const CHAT_SYSTEM_MESSAGE_KEYS = {
  recipient_plan_recipient: 'chatSystemRecipientPlanRecipient',
  recipient_plan_sender: 'chatSystemRecipientPlanSender',
  contact_method_recipient: 'chatSystemContactMethodRecipient',
  contact_method_sender: 'chatSystemContactMethodSender',
};

function interpolateText(template, params = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => String(params?.[key] ?? ''));
}

function getMatchesTranslation(lang, key, params = {}) {
  const normalizedLang = getSafeLang(lang || 'en');
  const matches = translations?.[normalizedLang]?.matches || translations.en.matches || {};
  const fallback = translations.en.matches || {};
  return interpolateText(matches[key] || fallback[key] || '', params);
}

function getChatSystemTextByCode(messageCode, lang, params = {}) {
  const key = CHAT_SYSTEM_MESSAGE_KEYS[messageCode];
  return key ? getMatchesTranslation(lang, key, params) : '';
}

const DEFAULT_PEER_LANGS = { input: 'en', output: 'en' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function methodAllowsDealSifterChat(method) {
  const normalized = String(method || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return ['chat', 'dealsifterchat', 'dealsifter'].includes(normalized);
}

function contactAllowsDealSifterChat(contact) {
  return Array.isArray(contact?.contactMethods) && contact.contactMethods.some(methodAllowsDealSifterChat);
}

function compactChatPreview(card) {
  if (!card) return null;
  return {
    id: card.id || card.ownerId || '',
    ownerId: card.ownerId || card.id || '',
    unlockOwnerId: card.unlockOwnerId || card.ownerId || card.id || '',
    name: card.name || '',
    title: card.title || card.name || '',
    type: card.type || '',
    badge: card.badge || '',
    cat: card.cat || '',
    loc: card.loc || '',
    photo: card.photo || card.avatar || '',
    primaryProfile: card.primaryProfile || '',
    contactMethods: Array.isArray(card.contactMethods) ? card.contactMethods : [],
  };
}

function readScopedProfileFallback(scope = 'personal') {
  if (isSupabaseConfigured && !import.meta.env.DEV) return null;
  try {
    const personalRaw = localStorage.getItem('personalProfile');
    const professionalRaw = localStorage.getItem('professionalProfile');
    const userRaw = localStorage.getItem('userProfile');
    const accountTypeRaw = localStorage.getItem('accountType');
    const personal = personalRaw ? JSON.parse(personalRaw) : null;
    const professional = professionalRaw ? JSON.parse(professionalRaw) : null;
    const user = userRaw ? JSON.parse(userRaw) : null;
    const identity = resolveScopedProfile(scope, {
      accountType: accountTypeRaw || '',
      userProfile: user || {},
      personalProfile: personal || {},
      professionalProfile: professional || {},
    });
    return {
      contactMethods: identity?.contactMethods || [],
      primaryPhone: identity?.primaryPhone || '',
      secondaryPhone: identity?.secondaryPhone || '',
      tertiaryPhone: identity?.tertiaryPhone || '',
      email: identity?.email || '',
    };
  } catch (e) {
    void e;
    return null;
  }
}

const PortfolioItem = ({ p, onOpen, exclusivityStatus = null, ownerVerified = false, isHot = false, openUnlock = null, getUnlockCost = null, nuggets = 0, setModal = null }) => {
  const [idx, setIdx] = useState(0);
  const imgs = p.images || [p.image];
  const handleLockClick = (e) => {
    e.stopPropagation();
    try {
      const cost = (typeof getUnlockCost === 'function') ? getUnlockCost(p.ownerId) : 1;
      if (typeof openUnlock === 'function') {
        if (Number.isFinite(nuggets) && Number(nuggets) < Number(cost)) {
          if (typeof setModal === 'function') setModal('store');
          return;
        }
        openUnlock(p, { unlockScope: 'property', property: p, propertyId: p.id, propertyAddress: p.address });
      }
    } catch (err) { void err; }
  };
  return (
    <div 
      draggable 
      onDragStart={e => { e.dataTransfer.setData("property", JSON.stringify(p)); }} 
      onClick={() => onOpen?.(p)}
      onMouseMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newIdx = Math.floor((x / rect.width) * imgs.length);
        if (newIdx !== idx && newIdx >= 0 && newIdx < imgs.length) setIdx(newIdx);
      }}
      onMouseLeave={() => setIdx(0)}
      style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", cursor:"pointer", transition:"transform .2s", position:"relative" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
    >
      <div style={{ height:80, position:"relative", overflow:"hidden" }}>
        {imgs.map((im, i) => (
          <SmartImage key={i} src={im} alt={p.address} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity: i === 0 || idx===i ? 1 : 0, transition:"opacity 0.2s" }} />
        ))}
        <div style={{ position:"absolute", top:4, left:4, right:4, display:"flex", gap:2 }}>
           {imgs.map((_, i) => (
             <div key={i} style={{ flex:1, height:2, background: idx===i?"#fff":"rgba(255,255,255,0.4)", borderRadius:10 }} />
           ))}
        </div>
        {/* Inline icons area (top-right): HOT, Verified, Exclusive lock */}
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'inline-flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
          {isHot ? (
            <CardStatusIcon type={CARD_STATUS.hot} size={20} iconSize={12} />
          ) : null}
          {ownerVerified ? (
            <CardStatusIcon type={CARD_STATUS.verified} size={20} iconSize={12} />
          ) : null}
          {exclusivityStatus ? (
            <button type="button" onClick={handleLockClick} aria-label={exclusivityStatus.kind === 'blocked' ? 'Locked' : 'Exclusive owned'} style={{ background:'transparent', border:'none', padding:0, cursor:'pointer', display:'inline-flex' }}>
              <CardStatusIcon type={CARD_STATUS.exclusive} size={20} iconSize={12} />
            </button>
          ) : null}
        </div>
      </div>
      <div style={{ padding:8 }}>
        <div style={{ fontSize:10, fontWeight:800, color:C.t1, marginBottom:2, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap" }}>{p.address}</div>
        {p.publishToShowcase === false ? (
          <div style={{ fontSize:9, fontWeight:800, color:C.danger, marginBottom:2, textTransform:'uppercase' }}>
            Stand By
          </div>
        ) : null}
        <div style={{ fontSize:10, color:C.gold, fontWeight:700 }}>{formatCompactUsd(p.price || 0)}</div>
      </div>
    </div>
  );
};

// â”€â”€ Always-visible contact chips â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const hasContactDisplayValue = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return String(value || '').trim().length > 0;
};

const mergeContactForDisplay = (base, incoming) => {
  const merged = { ...(base || {}), ...(incoming || {}) };
  [
    'email',
    'phone',
    'primaryPhone',
    'secondaryPhone',
    'tertiaryPhone',
    'whatsapp',
    'contactMethods',
  ].forEach((key) => {
    if (!hasContactDisplayValue(incoming?.[key]) && hasContactDisplayValue(base?.[key])) {
      merged[key] = base[key];
    }
  });
  return merged;
};

function getLocalOwnerId(scopeKey) {
  if (isSupabaseConfigured && !import.meta.env.DEV) return '';
  try {
    const map = JSON.parse(localStorage.getItem('profileOwnerMap') || 'null');
    if (map && typeof map[scopeKey] !== 'undefined') return map[scopeKey];
  } catch (e) { void e; }
  return '';
}

function ExclusiveBlockedBadge({ status, onUnlockOwner = null }) {
  const allT = useT('matches');
  const t = allT.matches || {};
  const expiresAt = status?.expiresAt || null;
  const [nowMs, setNowMs] = useState(null);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setNowMs(Date.now());
    const start = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60000);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(interval);
    };
  }, [expiresAt]);

  const daysLeft = (() => {
    if (!expiresAt || !nowMs) return null;
    const diff = new Date(expiresAt).getTime() - nowMs;
    if (!Number.isFinite(diff)) return null;
    return Math.max(1, Math.ceil(diff / 86400000));
  })();

  return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:32, textAlign:'center' }}>
      <div style={{ maxWidth:460, border:`1px solid ${C.alpha(C.gold, 0.42)}`, background:C.alpha(C.gold, 0.1), borderRadius:18, padding:'22px 24px', boxShadow:`0 16px 42px ${C.alpha(C.gold, 0.16)}` }}>
        <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:54, height:54, borderRadius:'50%', background:C.alpha(C.gold, 0.16), marginBottom:14 }}>
          <Icon name="lock" size={26} color={C.gold} />
        </div>
        <div style={{ fontSize:20, fontWeight:950, color:C.t1, marginBottom:8 }}>
          {t.exclusiveBlockedTitle || 'Exclusive property'}
        </div>
        <div style={{ fontSize:14, lineHeight:1.55, color:C.t2, fontWeight:700, marginBottom:14 }}>
          {String(t.exclusiveBlockedMessage || 'Exclusive - available in {count} {unit}.')
            .replace('{count}', String(daysLeft || '-'))
            .replace('{unit}', daysLeft === 1 ? (t.dayOne || 'day') : (t.dayOther || 'days'))}
        </div>
        {expiresAt ? (
          <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
            <ExclusivityBadge expiresAt={expiresAt} />
          </div>
        ) : null}
        {typeof onUnlockOwner === 'function' ? (
          <button
            type="button"
            onClick={onUnlockOwner}
            style={{ padding:'11px 16px', borderRadius:12, border:`1px solid ${C.accent}`, background:C.alpha(C.accent, 0.12), color:C.accent, fontWeight:900, cursor:'pointer' }}
          >
            {t.unlockOwnerContactOnly || 'Unlock owner contact only'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PortfolioDetail({ item, owner, ownerContact = null, isOwnerUnlocked = false, onUnlockRequest = null, contactPanelVariant = 'desktop', ownerDesc, onBack, autoplayMedia = false, onBlockedExport = null, imageSources = [], onStartChat = null, canUseChat = true, chatInterestLabel = CHAT_INTEREST_PREFIX.en, exclusiveStatus = null }) {
  const allT = useT('matches');
  const matchesT = allT.matches;
  const modalsT = allT.modals;
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = item?.images?.length ? item.images : [item?.image].filter(Boolean);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 767;
  const getProfileEmailFallback = () => {
    try {
      const personalRaw = localStorage.getItem('personalProfile');
      const professionalRaw = localStorage.getItem('professionalProfile');
      const userRaw = localStorage.getItem('userProfile');
      const personal = personalRaw ? JSON.parse(personalRaw) : null;
      const professional = professionalRaw ? JSON.parse(professionalRaw) : null;
      const user = userRaw ? JSON.parse(userRaw) : null;
      return String(personal?.email || professional?.email || user?.email || '').trim();
    } catch (e) { void e; return ''; }
  };
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      if (saved && typeof saved.to === 'string' && saved.to.trim()) return saved.to.trim();
    } catch (e) { void e; }
    return getProfileEmailFallback();
  });
  const [emailCc, setEmailCc] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      if (saved && typeof saved.cc === 'string') return saved.cc;
    } catch (e) { void e; }
    return '';
  });
  const [emailBcc, setEmailBcc] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      if (saved && typeof saved.bcc === 'string') return saved.bcc;
    } catch (e) { void e; }
    return '';
  });
  const [exportPdfLocal, setExportPdfLocal] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      return saved?.exportPdfLocal !== false;
    } catch (e) { void e; return true; }
  });
  const [exportPhotosLocal, setExportPhotosLocal] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      return Boolean(saved?.exportPhotosLocal);
    } catch (e) { void e; return false; }
  });
  const [exportPdfWithEmail, setExportPdfWithEmail] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      return Boolean(saved?.exportPdfWithEmail);
    } catch (e) { void e; return false; }
  });
  const [exportPhotosWithEmail, setExportPhotosWithEmail] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      return Boolean(saved?.exportPhotosWithEmail);
    } catch (e) { void e; return false; }
  });
  const [exportMode, setExportMode] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
      return saved?.exportMode === 'email' ? 'email' : 'download';
    } catch (e) { void e; return 'download'; }
  });
  const [isPreparingExport, setIsPreparingExport] = useState(false);

  useEffect(() => {
    // Reset image index when item changes; defer to next tick to avoid
    // triggering a cascading render within the effect body.
    const t = setTimeout(() => setImgIdx(0), 0);
    return () => clearTimeout(t);
  }, [item?.id]);

  useEffect(() => {
    // Reset email fields when the selected item changes, restoring saved defaults.
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
        setEmailTo(saved?.to?.trim() || getProfileEmailFallback());
        setEmailCc(saved?.cc || '');
        setEmailBcc(saved?.bcc || '');
      } catch (e) {
        void e;
        setEmailTo(getProfileEmailFallback());
        setEmailCc('');
        setEmailBcc('');
      }
    }, 0);
    return () => clearTimeout(t);
  }, [item?.id]);

  const fmtMoney = (v) => {
    if (typeof v !== "number") return "-";
    return `$${Number(v || 0).toLocaleString('en-US')}`;
  };
  const fmtCompactMoney = (v) => {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return "-";
    return formatCompactUsd(n);
  };

  const normalizeExportText = (value) => {
    const raw = String(value ?? '');
    const plusAsSpace = raw.replace(/\+/g, ' ');
    try {
      return decodeURIComponent(plusAsSpace).replace(/\s+/g, ' ').trim();
    } catch (e) {
      void e;
      return plusAsSpace.replace(/\s+/g, ' ').trim();
    }
  };

  const buildExportPayload = () => {
    const title = normalizeExportText(item?.address || item?.name || 'DealSifter Export');
    const ownerName = normalizeExportText(owner?.name || '-');
    const ownerType = normalizeExportText(owner?.type || '-');
    const city = normalizeExportText(item?.city || '-');
    const state = normalizeExportText(item?.state || '-');
    const zip = normalizeExportText(item?.zip || '-');
    const shouldUseSavedProfile = !isSupabaseConfigured
      && (!owner?.id || owner?.id === 999999 || owner?.ownerId === 999999 || owner?.id === 'preview-personal');
    let savedProfile = null;
    if (shouldUseSavedProfile) savedProfile = readScopedProfileFallback(normalizeProfileScope(owner?.primaryProfile || item?.primaryProfile || ''));
    const ownerContacts = buildDisplayContacts(owner || {}, savedProfile, {
      call: modalsT.contactPhone,
      sms: modalsT.contactSms,
      whatsapp: modalsT.contactWhatsApp,
      telegram: modalsT.contactTelegram,
      email: modalsT.contactEmail,
    }).sort((a, b) => {
      const aPriority = a.priority || 99;
      const bPriority = b.priority || 99;
      return aPriority - bPriority;
    });
    const ownerContactLines = ownerContacts.length
      ? ownerContacts.map(({ label, val, priority }) => `- ${normalizeExportText(label || 'Contact')}: ${normalizeExportText(val || '-')}${priority ? ` (${priority===1 ? modalsT.contactPriorityFirst : `P${priority}`})` : ''}`)
      : ['- No unlocked contact modes'];

    const cardsDescription = [
      `TITLE: ${title}`,
      '',
      'DESCRIPTION:',
      `${matchesT.price}: ${fmtMoney(item?.price)}`,
      `${matchesT.type}: ${normalizeExportText(item?.type || '-')}`,
      `${matchesT.strategy}: ${normalizeExportText(item?.objective || '-')}`,
      `${matchesT.capRate}: ${item?.capRate ? `${item.capRate}%` : '-'}`,
      `${matchesT.beds}: ${item?.beds > 0 ? item.beds : '-'}`,
      `${matchesT.baths}: ${item?.baths > 0 ? item.baths : '-'}`,
      `${matchesT.size}: ${item?.sqft || '-'}`,
      `${matchesT.lot}: ${item?.lot || '-'}`,
      `${matchesT.rehab}: ${fmtMoney(item?.rehab || 0)}`,
      `${matchesT.zip}: ${zip}`,
      `${matchesT.dealTag}: ${normalizeExportText(item?.dealTag || '-')}`,
      `${matchesT.source}: ${normalizeExportText(item?.source || '-')}`,
      `${matchesT.isActive}: ${item?.isActive ? matchesT.active : matchesT.inactive}`,
      `LOCATION: ${city}, ${state}`,
      '',
      'OWNER:',
      `Name: ${ownerName}`,
      `Type: ${ownerType}`,
      `Notes: ${normalizeExportText(ownerDesc || owner?.desc || matchesT.noOwnerNotes)}`,
      'Contact Modes:',
      ...ownerContactLines,
      '',
      'TRELLO LABEL SUGGESTIONS:',
      `${normalizeExportText(item?.objective || 'General')}`,
      `${normalizeExportText(item?.dealTag || 'No DealTag')}`,
      `${normalizeExportText(item?.source || 'No Source')}`,
    ].map((line) => normalizeExportText(line)).join('\n');

    return { title, cardsDescription };
  };

  const downloadUrlToFile = async (url, fileName) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 8000);
      return blob;
    } catch (e) {
      void e;
      return null;
    }
  };

  const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsDataURL(blob);
    } catch (e) {
      reject(e);
    }
  });

  const fetchImageData = async (url) => {
    if (!url) return null;
    try {
      if (url instanceof Blob || (typeof File !== 'undefined' && url instanceof File)) {
        const dataUrl = await blobToDataUrl(url);
        const format = String(url.type || '').includes('png') ? 'PNG' : 'JPEG';
        return { dataUrl, format };
      }
      if (typeof url === 'object' && url?.blob instanceof Blob) {
        const dataUrl = await blobToDataUrl(url.blob);
        const format = String(url.blob.type || '').includes('png') ? 'PNG' : 'JPEG';
        return { dataUrl, format };
      }
      if (String(url).startsWith('data:image/')) {
        const format = String(url).slice(0, 30).toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        return { dataUrl: url, format };
      }
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      const format = String(blob.type || '').includes('png') ? 'PNG' : 'JPEG';
      return { dataUrl, format };
    } catch (e) {
      void e;
      return null;
    }
  };

  const loadCanvasImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = src;
  });

  const makeOsmTileMapImage = async ({ lat, lng, zoom = 12, width = 1200, height = 520 }) => {
    try {
      const tileSize = 256;
      const scale = 2 ** zoom;
      const latRad = lat * Math.PI / 180;
      const centerX = ((lng + 180) / 360) * scale * tileSize;
      const centerY = (0.5 - Math.log((1 + Math.sin(latRad)) / (1 - Math.sin(latRad))) / (4 * Math.PI)) * scale * tileSize;
      const startX = centerX - width / 2;
      const startY = centerY - height / 2;
      const endX = centerX + width / 2;
      const endY = centerY + height / 2;
      const minTileX = Math.floor(startX / tileSize);
      const maxTileX = Math.floor(endX / tileSize);
      const minTileY = Math.floor(startY / tileSize);
      const maxTileY = Math.floor(endY / tileSize);
      const maxTileIndex = scale - 1;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#eef4f4';
      ctx.fillRect(0, 0, width, height);

      for (let tx = minTileX; tx <= maxTileX; tx += 1) {
        for (let ty = minTileY; ty <= maxTileY; ty += 1) {
          if (ty < 0 || ty > maxTileIndex) continue;
          const wrappedX = ((tx % scale) + scale) % scale;
          const tileUrl = `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`;
          try {
            const tile = await loadCanvasImage(tileUrl);
            const dx = Math.round((tx * tileSize) - startX);
            const dy = Math.round((ty * tileSize) - startY);
            ctx.drawImage(tile, dx, dy, tileSize, tileSize);
          } catch (e) {
            void e;
          }
        }
      }

      const pinX = width / 2;
      const pinY = height / 2 - 22;
      ctx.shadowColor = 'rgba(0,0,0,0.34)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 7;
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.arc(pinX, pinY, 30, 0, Math.PI * 2);
      ctx.lineTo(pinX, pinY + 74);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(pinX, pinY, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      ctx.fillRect(10, height - 28, 178, 18);
      ctx.fillStyle = '#4f5f6f';
      ctx.font = '12px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('© OpenStreetMap contributors', 16, height - 15);
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch (e) {
      void e;
      return null;
    }
  };

  const normalizeExportImageUrl = (value) => {
    if (!value) return '';
    if (value instanceof Blob || (typeof File !== 'undefined' && value instanceof File)) return value;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(normalizeExportImageUrl).find(Boolean) || '';
    if (typeof value === 'object') {
      return value.url
        || value.src
        || value.href
        || value.publicUrl
        || value.publicURL
        || value.signedUrl
        || value.signedURL
        || value.image_url
        || value.imageUrl
        || value.photo_url
        || value.photoUrl
        || value.thumbnail_url
        || value.thumbnailUrl
        || value.dataUrl
        || value.dataURL
        || value.preview
        || value.blob
        || '';
    }
    return '';
  };

  const resolveFullExportItem = () => {
    const itemIds = new Set([
      item?.id,
      item?.portfolioId,
      item?.propertyId,
    ].map((v) => String(v || '').trim()).filter(Boolean));
    const address = normalizeExportText(item?.address || '').toLowerCase();
    const candidates = [
      item,
      ...(Array.isArray(imageSources) ? imageSources : []),
      ...(import.meta.env.DEV && Array.isArray(PROPERTIES) ? PROPERTIES : []),
    ].filter(Boolean);

    const found = candidates.find((candidate) => {
      const candidateIds = [candidate?.id, candidate?.portfolioId, candidate?.propertyId]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
      if (candidateIds.some((id) => itemIds.has(id))) return true;
      return address && normalizeExportText(candidate?.address || '').toLowerCase() === address;
    });
    const itemImages = Array.isArray(item?.images) ? item.images : (typeof item?.images === 'string' ? [item.images] : []);
    return found ? { ...found, ...item, images: (itemImages.length ? itemImages : found.images) } : item;
  };

  const getExportImageUrls = () => {
    const fullItem = resolveFullExportItem();
    const raw = [
      fullItem?.coverImage,
      fullItem?.cover_image,
      fullItem?.mainImage,
      fullItem?.main_image,
      fullItem?.propertyImage,
      fullItem?.property_image,
      fullItem?.primaryImage,
      fullItem?.primary_image,
      fullItem?.heroImage,
      fullItem?.hero_image,
      ...(Array.isArray(fullItem?.images) ? fullItem.images : []),
      ...(typeof fullItem?.images === 'string' ? [fullItem.images] : []),
      ...(Array.isArray(fullItem?.photos) ? fullItem.photos : []),
      ...(typeof fullItem?.photos === 'string' ? [fullItem.photos] : []),
      ...(Array.isArray(fullItem?.media?.images) ? fullItem.media.images : []),
      ...(Array.isArray(fullItem?.media?.photos) ? fullItem.media.photos : []),
      fullItem?.media?.coverImage,
      fullItem?.media?.cover_image,
      fullItem?.media?.mainImage,
      fullItem?.media?.main_image,
      fullItem?.image,
      fullItem?.imageUrl,
      fullItem?.image_url,
      fullItem?.photo,
      fullItem?.photoUrl,
      fullItem?.photo_url,
      fullItem?.thumbnail,
      fullItem?.thumbnailUrl,
      fullItem?.thumbnail_url,
      fullItem?.thumb,
    ];
    const seen = new Set();
    return raw.map(normalizeExportImageUrl).filter(Boolean).filter((entry) => {
      const key = typeof entry === 'string' ? entry : `${entry?.type || 'blob'}:${entry?.size || ''}:${entry?.name || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getPropertyCoordinates = () => {
    const lat = Number(item?.lat ?? item?.latitude ?? item?.geo?.lat ?? item?.location?.lat);
    const lng = Number(item?.lng ?? item?.longitude ?? item?.geo?.lng ?? item?.location?.lng);
    return {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  };

  const makeFallbackMapImage = ({ lat, lng, label }) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 520;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const w = canvas.width;
      const h = canvas.height;
      const grd = ctx.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#e9f5f4');
      grd.addColorStop(0.55, '#f7fafc');
      grd.addColorStop(1, '#dce8f3');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(88, 106, 126, 0.2)';
      ctx.lineWidth = 4;
      for (let x = -120; x < w + 160; x += 145) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 90, h * 0.28, x - 60, h * 0.62, x + 120, h);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(53, 202, 201, 0.32)';
      ctx.lineWidth = 7;
      for (let yLine = 58; yLine < h; yLine += 112) {
        ctx.beginPath();
        ctx.moveTo(0, yLine);
        ctx.bezierCurveTo(w * 0.27, yLine - 54, w * 0.68, yLine + 52, w, yLine - 22);
        ctx.stroke();
      }

      const pinX = w / 2;
      const pinY = h / 2 - 26;
      ctx.shadowColor = 'rgba(0,0,0,0.28)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      ctx.fillStyle = '#f5a623';
      ctx.beginPath();
      ctx.arc(pinX, pinY, 42, 0, Math.PI * 2);
      ctx.lineTo(pinX, pinY + 96);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pinX, pinY, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#101827';
      ctx.font = 'bold 38px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label || 'Property location', pinX, h - 92);
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillStyle = '#526174';
      ctx.fillText(`${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`, pinX, h - 52);
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch (e) {
      void e;
      return null;
    }
  };

  const drawImageContain = (doc, dataUrl, format, x, y, boxW, boxH) => {
    try {
      const props = doc.getImageProperties(dataUrl);
      const imgW = Number(props?.width || 1);
      const imgH = Number(props?.height || 1);
      const scale = Math.min(boxW / imgW, boxH / imgH);
      const drawW = Math.max(1, imgW * scale);
      const drawH = Math.max(1, imgH * scale);
      const dx = x + (boxW - drawW) / 2;
      const dy = y + (boxH - drawH) / 2;
      doc.addImage(dataUrl, format, dx, dy, drawW, drawH, undefined, 'FAST');
      return true;
    } catch (e) {
      void e;
      return false;
    }
  };

  const drawImageCover = (doc, dataUrl, format, x, y, boxW, boxH) => {
    try {
      const props = doc.getImageProperties(dataUrl);
      const imgW = Number(props?.width || 1);
      const imgH = Number(props?.height || 1);
      const scale = Math.max(boxW / imgW, boxH / imgH);
      const drawW = Math.max(1, imgW * scale);
      const drawH = Math.max(1, imgH * scale);
      const dx = x + (boxW - drawW) / 2;
      const dy = y + (boxH - drawH) / 2;
      doc.addImage(dataUrl, format, dx, dy, drawW, drawH, undefined, 'FAST');
      return true;
    } catch (e) {
      void e;
      return false;
    }
  };

  const renderFittedImageDataUrl = async ({ sourceDataUrl, targetW, targetH, mode = 'contain', radius = 0, background = '#ffffff' }) => {
    try {
      if (!sourceDataUrl || !targetW || !targetH) return null;
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Image load failed'));
        image.src = sourceDataUrl;
      });

      const w = Math.max(1, Math.round(targetW));
      const h = Math.max(1, Math.round(targetH));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = background;
      ctx.fillRect(0, 0, w, h);

      if (radius > 0) {
        const r = Math.min(radius, w / 2, h / 2);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(w - r, 0);
        ctx.quadraticCurveTo(w, 0, w, r);
        ctx.lineTo(w, h - r);
        ctx.quadraticCurveTo(w, h, w - r, h);
        ctx.lineTo(r, h);
        ctx.quadraticCurveTo(0, h, 0, h - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.clip();
      }

      const imgW = Number(img.naturalWidth || img.width || 1);
      const imgH = Number(img.naturalHeight || img.height || 1);
      const scale = mode === 'cover'
        ? Math.max(w / imgW, h / imgH)
        : Math.min(w / imgW, h / imgH);
      const drawW = Math.max(1, imgW * scale);
      const drawH = Math.max(1, imgH * scale);
      const dx = (w - drawW) / 2;
      const dy = (h - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);

      if (radius > 0) ctx.restore();
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (e) {
      void e;
      return null;
    }
  };

  const generateReleasePdf = async ({ title, imageUrls }) => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 24;
    const maxTextWidth = pageWidth - margin * 2;
    let y = margin;

    const logo = await fetchImageData(appLogo);
    const normalizedImageUrls = Array.isArray(imageUrls) && imageUrls.length ? imageUrls : getExportImageUrls();
    const mainImage = await fetchImageData(normalizedImageUrls?.[0]);

    const safe = (v, fallback = '-') => {
      const s = normalizeExportText(v);
      return s && s !== '-' ? s : fallback;
    };
    const pdfLabel = (key, fallback) => matchesT[key] || fallback;

    const shouldUseSavedProfile = !isSupabaseConfigured
      && (!owner?.id || owner?.id === 999999 || owner?.ownerId === 999999 || owner?.id === 'preview-personal');
    let savedProfile = null;
    if (shouldUseSavedProfile) savedProfile = readScopedProfileFallback(normalizeProfileScope(owner?.primaryProfile || item?.primaryProfile || ''));

    const ownerName = safe(owner?.name);
    const ownerType = safe(owner?.type);
    const ownerAddress = safe(`${item?.address || '-'}, ${item?.city || '-'}, ${item?.state || '-'} ${item?.zip || ''}`);
    const ownerStatus = safe(item?.isActive ? matchesT.active : matchesT.inactive);
    const ownerContacts = buildDisplayContacts(owner || {}, savedProfile, {
      call: modalsT.contactPhone,
      sms: modalsT.contactSms,
      whatsapp: modalsT.contactWhatsApp,
      telegram: modalsT.contactTelegram,
      email: modalsT.contactEmail,
    }).sort((a, b) => (a.priority || 99) - (b.priority || 99));
    const ownerNotes = safe(ownerDesc || owner?.desc || item?.description || '-');
    const labelSuggestions = [safe(item?.objective || 'General'), safe(item?.dealTag || 'No DealTag'), safe(item?.source || 'No Source')].join(' | ');

    const panelRowsOwner = [
      [pdfLabel('exportOwnerName', 'Owner Name'), ownerName],
      [pdfLabel('type', 'Type'), ownerType],
      [pdfLabel('address', 'Address'), ownerAddress],
      [pdfLabel('exportOwnerStatus', 'Owner Status'), ownerStatus],
      ['Contact 1', ownerContacts[0] ? `${safe(ownerContacts[0].label)}: ${safe(ownerContacts[0].val)}` : 'No unlocked contacts'],
      ['Contact 2', ownerContacts[1] ? `${safe(ownerContacts[1].label)}: ${safe(ownerContacts[1].val)}` : '-'],
      ['Contact 3', ownerContacts[2] ? `${safe(ownerContacts[2].label)}: ${safe(ownerContacts[2].val)}` : '-'],
    ];

    const panelRowsProperty = [
      [pdfLabel('exportTitle', 'Title'), safe(item?.address || title)],
      [pdfLabel('price', 'Price'), fmtMoney(item?.price)],
      [pdfLabel('type', 'Type'), safe(item?.type)],
      [pdfLabel('strategy', 'Strategy'), safe(item?.objective)],
      ['Cap Rate', item?.capRate ? `${item.capRate}%` : '-'],
      ['Beds', `${item?.beds > 0 ? item.beds : '-'}`],
      ['Baths', `${item?.baths > 0 ? item.baths : '-'}`],
      ['Living Area', safe(item?.sqft)],
      ['Rehab', fmtMoney(item?.rehab || 0)],
      ['ZIP', safe(item?.zip)],
    ];

    const panelRowsLand = [
      [pdfLabel('location', 'Location'), `${safe(item?.city)}, ${safe(item?.state)} ${safe(item?.zip, '')}`.trim()],
      [pdfLabel('dealTag', 'Deal Tag'), safe(item?.dealTag)],
      [pdfLabel('source', 'Source'), safe(item?.source)],
      [pdfLabel('lot', 'Lot Size'), safe(item?.lot)],
      ['Improvement', safe(item?.improvement || '-')],
      ['Portfolio', safe(item?.includeInPreview ? 'Yes' : 'No')],
      ['Labels', labelSuggestions],
      ['Record ID', safe(item?.id)],
    ];

    const drawPanel = (titleText, rows, x, yy, w, h) => {
      doc.setFillColor(249, 250, 252);
      doc.setDrawColor(208, 216, 229);
      doc.roundedRect(x, yy, w, h, 6, 6, 'FD');

      doc.setFillColor(234, 238, 244);
      doc.roundedRect(x + 1, yy + 1, w - 2, 22, 5, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 56, 72);
      doc.setFontSize(10.5);
      doc.text(titleText, x + 8, yy + 15);

      let rowY = yy + 34;
      for (let i = 0; i < rows.length; i += 1) {
        if (rowY > yy + h - 12) break;
        const [k, v] = rows[i];
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.4);
        doc.setTextColor(108, 117, 128);
        doc.text(String(k), x + 8, rowY);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(52, 60, 74);
        doc.setFontSize(8.6);
        const valueX = x + 88;
        let vText = doc.splitTextToSize(String(v), w - 96);
        let lineH = 9.8;
        let rowHeight = Math.max(14, vText.length * lineH + 4);

        if (String(k) === 'Notes') {
          let notesFont = 8.6;
          const availableH = Math.max(20, yy + h - rowY - 6);
          while (notesFont >= 5.6) {
            doc.setFontSize(notesFont);
            vText = doc.splitTextToSize(String(v), w - 96);
            lineH = Math.max(6.2, notesFont + 1);
            rowHeight = Math.max(16, vText.length * lineH + 4);
            if (rowHeight <= availableH) break;
            notesFont -= 0.4;
          }
          doc.setFontSize(Math.max(5.6, notesFont));
        } else {
          if (rowY + rowHeight > yy + h - 10) break;
        }

        if (rowY + rowHeight > yy + h - 10 && String(k) !== 'Notes') break;
        for (let j = 0; j < vText.length; j += 1) {
          doc.text(vText[j] || '-', valueX, rowY + (j * lineH));
        }
        doc.setDrawColor(234, 238, 244);
        doc.line(x + 8, rowY + rowHeight - 3, x + w - 8, rowY + rowHeight - 3);
        rowY += rowHeight;
      }
    };

    // Branded header using the same complete logo image used in the app header.
    doc.setFillColor(13, 24, 21);
    doc.roundedRect(margin, y, maxTextWidth, 54, 10, 10, 'F');
    if (logo) {
      drawImageContain(doc, logo.dataUrl, logo.format, margin + 12, y + 7, 170, 40);
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(53, 202, 201);
    doc.setFontSize(12);
    doc.text(matchesT.exportPdfHeader || 'Investor-ready property release', pageWidth - margin - 10, y + 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(187, 202, 214);
    doc.setFontSize(8.5);
    doc.text(`${matchesT.generated || 'Generated'}: ${new Date().toLocaleString()}`, pageWidth - margin - 10, y + 38, { align: 'right' });
    y += 68;

    const heroH = 138;
    const heroGap = 14;
    const heroLeftW = Math.floor((maxTextWidth - heroGap) * 0.52);
    const heroRightW = maxTextWidth - heroLeftW - heroGap;
    const heroRightX = margin + heroLeftW + heroGap;
    doc.setFillColor(246, 251, 251);
    doc.setDrawColor(159, 231, 229);
    doc.roundedRect(margin, y, heroLeftW, heroH, 10, 10, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(8, 18, 34);
    doc.setFontSize(18);
    const heroTitle = doc.splitTextToSize(safe(item?.address || title), heroLeftW - 16);
    doc.text(heroTitle[0] || '-', margin + 8, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(73, 86, 105);
    doc.setFontSize(11.5);
    doc.text(`${safe(item?.city)}, ${safe(item?.state)} ${safe(item?.zip, '')}`.trim(), margin + 8, y + 44);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 166, 35);
    doc.setFontSize(22);
    doc.text(fmtMoney(item?.price), margin + 8, y + 70);

    doc.setDrawColor(120, 130, 142);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin + 8, y + 55, margin + heroLeftW - 8, y + 55);
    doc.setLineDashPattern([], 0);

    const chips = [
      `${item?.beds > 0 ? item.beds : '-'} bd`,
      `${item?.baths > 0 ? item.baths : '-'} ba`,
      `${safe(item?.sqft)} sqft`,
      `${item?.capRate ? `${item.capRate}% cap` : 'cap N/A'}`,
    ];
    let chipX = margin + 8;
    for (const chip of chips) {
      const chipW = Math.min(116, doc.getTextWidth(chip) + 12);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(187, 229, 229);
      doc.roundedRect(chipX, y + 86, chipW, 18, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(43, 68, 88);
      doc.setFontSize(8.5);
      doc.text(chip, chipX + 6, y + 98);
      chipX += chipW + 6;
      if (chipX > margin + heroLeftW - 80) break;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(72, 84, 102);
    const noteSnippet = safe(item?.description || ownerNotes || '-', '-');
    const noteLines = doc.splitTextToSize(noteSnippet, heroLeftW - 16);
    doc.text((noteLines[0] || '-') + (noteLines[1] ? '...' : ''), margin + 8, y + 124);

    doc.setFillColor(244, 247, 250);
    doc.setDrawColor(205, 216, 232);
    doc.roundedRect(heroRightX, y, heroRightW, heroH, 10, 10, 'FD');
    if (mainImage) {
      // Single image occupying the full right hero element (no nested inner image container).
      doc.setDrawColor(205, 216, 232);
      doc.roundedRect(heroRightX, y, heroRightW, heroH, 10, 10);
      const fitted = await renderFittedImageDataUrl({
        sourceDataUrl: mainImage.dataUrl,
        targetW: heroRightW,
        targetH: heroH,
        mode: 'cover',
        radius: 10,
        background: '#ffffff',
      });
      if (fitted) {
        doc.addImage(fitted, 'JPEG', heroRightX, y, heroRightW, heroH, undefined, 'FAST');
      } else {
        drawImageCover(doc, mainImage.dataUrl, mainImage.format, heroRightX, y, heroRightW, heroH);
      }
    } else {
      doc.setFillColor(238, 244, 247);
      doc.roundedRect(heroRightX + 8, y + 8, heroRightW - 16, heroH - 16, 8, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(91, 107, 124);
      doc.setFontSize(10);
      doc.text(matchesT.exportImageUnavailable || 'PROPERTY IMAGE UNAVAILABLE', heroRightX + 14, y + 30);
    }
    y += heroH + 12;

    const panelGap = 10;
    const panelW = Math.floor((maxTextWidth - panelGap * 2) / 3);
    const panelH = 198;
    drawPanel(pdfLabel('exportOwnerInfo', 'Owner Information'), panelRowsOwner, margin, y, panelW, panelH);
    drawPanel(pdfLabel('exportPropertyInfo', 'Property Characteristics'), panelRowsProperty, margin + panelW + panelGap, y, panelW, panelH);
    drawPanel(pdfLabel('exportLandInfo', 'Land Information'), panelRowsLand, margin + (panelW + panelGap) * 2, y, panelW, panelH);
    y += panelH + 10;

    // Full-width intermediate Notes block between the 3 columns and the map section.
    const notesBlockH = 72;
    doc.setFillColor(249, 250, 252);
    doc.setDrawColor(208, 216, 229);
    doc.roundedRect(margin, y, maxTextWidth, notesBlockH, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 56, 72);
    doc.setFontSize(10.5);
    doc.text(pdfLabel('notes', 'Notes'), margin + 8, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 84, 96);
    doc.setFontSize(8.8);
    const notesLines = doc.splitTextToSize(ownerNotes || '-', maxTextWidth - 16);
    const maxNotesLines = 4;
    for (let i = 0; i < Math.min(maxNotesLines, notesLines.length); i += 1) {
      doc.text(notesLines[i], margin + 8, y + 30 + (i * 10));
    }
    y += notesBlockH + 10;

    // Map snapshot replaces old Additional Notes block.
    const mapH = pageHeight - y - margin;
    if (mapH > 90) {
      const coords = getPropertyCoordinates();
      const lat = coords.lat;
      const lng = coords.lng;
      const canRenderMap = Number.isFinite(lat) && Number.isFinite(lng);
      doc.setFillColor(249, 250, 252);
      doc.setDrawColor(208, 216, 229);
      doc.roundedRect(margin, y, maxTextWidth, mapH, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 56, 72);
      doc.setFontSize(10.5);
      doc.text(pdfLabel('exportMapSnapshot', 'Property Map Snapshot'), margin + 8, y + 16);

      const mapX = margin + 8;
      const mapY = y + 24;
      const mapW = maxTextWidth - 16;
      const mapInnerH = mapH - 32;
      doc.setDrawColor(205, 216, 232);
      doc.roundedRect(mapX, mapY, mapW, mapInnerH, 5, 5);

      if (canRenderMap) {
        const cityZoom = 12;
        const mapUrls = [
          `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${cityZoom}&size=1200x520&markers=${lat},${lng},red-pushpin`,
          `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${cityZoom}&size=1200x520&maptype=mapnik&markers=${lat},${lng},red-pushpin`,
          `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=13&size=1200x520&markers=${lat},${lng},red-pushpin`,
          `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=12&size=1200x520`,
          `https://staticmap.openstreetmap.de/staticmap.php?bbox=${lng - 0.09},${lat - 0.06},${lng + 0.09},${lat + 0.06}&size=1200x520&markers=${lat},${lng},red-pushpin`,
        ];
        let mapImage = null;
        for (const mapUrl of mapUrls) {
          mapImage = await fetchImageData(mapUrl);
          if (mapImage) break;
        }
        if (!mapImage) {
          const tileSnapshot = await makeOsmTileMapImage({ lat, lng, zoom: cityZoom, width: 1200, height: 520 });
          if (tileSnapshot) mapImage = { dataUrl: tileSnapshot, format: 'JPEG' };
        }
        if (mapImage) {
          drawImageContain(doc, mapImage.dataUrl, mapImage.format, mapX + 1, mapY + 1, mapW - 2, mapInnerH - 2);
        } else {
          const fallbackMap = makeFallbackMapImage({
            lat,
            lng,
            label: `${safe(item?.city)}, ${safe(item?.state)} ${safe(item?.zip, '')}`.trim(),
          });
          if (fallbackMap) {
            drawImageContain(doc, fallbackMap, 'JPEG', mapX + 1, mapY + 1, mapW - 2, mapInnerH - 2);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(110, 120, 132);
            doc.text(pdfLabel('exportMapUnavailable', 'Map preview unavailable at the moment.'), mapX + 10, mapY + 20);
          }
        }
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(110, 120, 132);
        doc.text(pdfLabel('exportCoordinatesUnavailable', 'Coordinates unavailable for this property.'), mapX + 10, mapY + 20);
      }
    }

    const safeName = String(title || 'portfolio-release').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 64);
    const fileName = `${safeName || 'portfolio_release'}.pdf`;
    doc.save(fileName);
    return fileName;
  };

  const handleExportToEmail = (toValue, ccValue, bccValue, bodySuffix = '') => {
    const { title, cardsDescription } = buildExportPayload();

    const subject = `[DealSifter] Trello Export - ${title}`;
    const to = String(toValue || '').trim();
    const cc = String(ccValue || '').trim();
    const bcc = String(bccValue || '').trim();
    const query = [
      `subject=${encodeURIComponent(subject)}`,
      `body=${encodeURIComponent(`${cardsDescription}${bodySuffix || ''}`)}`,
      ...(cc ? [`cc=${encodeURIComponent(cc)}`] : []),
      ...(bcc ? [`bcc=${encodeURIComponent(bcc)}`] : []),
    ].join('&');
    const mailtoUrl = `mailto:${to}?${query}`;
    window.location.href = mailtoUrl;
  };

  const handleOpenEmailCompose = () => {
    if (typeof onBlockedExport === 'function' && onBlockedExport() === false) return;
    if (!String(emailTo || '').trim()) setEmailTo(getProfileEmailFallback());
    setEmailComposeOpen(true);
  };

  const handleConfirmEmailExport = async () => {
    const payload = {
      to: String(emailTo || '').trim(),
      cc: String(emailCc || '').trim(),
      bcc: String(emailBcc || '').trim(),
      exportMode,
      exportPdfLocal: exportMode === 'download' ? Boolean(exportPdfLocal) : false,
      exportPhotosLocal: exportMode === 'download' ? Boolean(exportPhotosLocal) : false,
      exportPdfWithEmail: exportMode === 'email' ? Boolean(exportPdfWithEmail) : false,
      exportPhotosWithEmail: exportMode === 'email' ? Boolean(exportPhotosWithEmail) : false,
    };
    try { localStorage.setItem('ds_export_mail_defaults', JSON.stringify(payload)); } catch (e) { void e; }

    const imageUrls = getExportImageUrls();

    setIsPreparingExport(true);
    let bodySuffix = '';
    const shouldSendEmail = payload.exportPdfWithEmail || payload.exportPhotosWithEmail;
    try {
      let pdfFileName = null;
      if (payload.exportPdfLocal || payload.exportPdfWithEmail) {
        const source = buildExportPayload();
        pdfFileName = await generateReleasePdf({
          title: source.title,
          cardsDescription: source.cardsDescription,
          imageUrls,
        });
      }

      let downloadedPhotos = 0;
      if (payload.exportPhotosLocal || payload.exportPhotosWithEmail) {
        for (let i = 0; i < imageUrls.length; i += 1) {
          const url = imageUrls[i];
          if (!url) continue;
          const ext = String(url).toLowerCase().includes('.png') ? 'png' : 'jpg';
          const photoName = `property_photo_${i + 1}.${ext}`;
          const blob = await downloadUrlToFile(url, photoName);
          if (blob) downloadedPhotos += 1;
        }
      }

      const emailAttachmentNotes = [];
      if (payload.exportPdfWithEmail) {
        emailAttachmentNotes.push(`- PDF prepared locally: ${pdfFileName || 'portfolio_release.pdf'}`);
      }
      if (payload.exportPhotosWithEmail) {
        emailAttachmentNotes.push(`- Photos prepared locally: ${downloadedPhotos}`);
      }
      if (emailAttachmentNotes.length) {
        bodySuffix = `\n\nATTACHMENTS READY TO INCLUDE IN EMAIL (manual attach):\n${emailAttachmentNotes.join('\n')}`;
      }
    } finally {
      setIsPreparingExport(false);
    }

    setEmailComposeOpen(false);
    if (shouldSendEmail) {
      handleExportToEmail(payload.to, payload.cc, payload.bcc, bodySuffix);
    }
  };

  const detailGroups = [
    [
      [matchesT.type, item.type || "-"],
      [matchesT.strategy, item.objective || "-"],
      [matchesT.capRate, item.capRate ? `${item.capRate}%` : "-"],
    ],
    [
      [matchesT.beds, item.beds > 0 ? item.beds : "-"],
      [matchesT.baths, item.baths > 0 ? item.baths : "-"],
      [matchesT.size, item.sqft || "-"],
    ],
    [
      [matchesT.rehab, fmtCompactMoney(item.rehab || 0)],
      [matchesT.zip, item.zip || "-"],
      [matchesT.lot, item.lot || "-"],
    ],
  ];

  const metaChips = [
    item.improvement ? item.improvement : null,
    item.dealTag ? item.dealTag : null,
    item.source ? item.source : null,
    item.publishToShowcase === false ? 'Stand By' : null,
    item.isActive != null ? (item.isActive ? matchesT.active : matchesT.inactive) : null,
  ].filter(Boolean);

  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
      <div style={{ padding:10, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ minWidth:0 }}>
          <div
            style={{
              display:'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: isMobile ? 'flex-start' : 'center',
              gap: isMobile ? 4 : 8,
              minWidth:0,
              flexWrap:'wrap',
            }}
          >
            {isMobile && exclusiveStatus?.expiresAt ? (
              <ExclusivityBadge expiresAt={exclusiveStatus.expiresAt} />
            ) : null}
            <div style={{ fontSize:12, fontWeight:800, color:C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.address}</div>
            {!isMobile && exclusiveStatus?.expiresAt ? (
              <ExclusivityBadge expiresAt={exclusiveStatus.expiresAt} />
            ) : null}
          </div>
          <div style={{ fontSize:10, color:C.t3 }}>{formatPropertyLocation(item)}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button type="button" onClick={handleOpenEmailCompose}
            title={matchesT.exportEmailTrello || 'Export to email (Trello format)'}
            style={{ border:`1px solid ${C.border}`, background:"transparent", color:C.t2, borderRadius:8, padding:"5px 8px", fontSize:11, cursor:"pointer" }}>
            {matchesT.export || 'Export'}
          </button>
          <button type="button" onClick={onBack} style={{ border:`1px solid ${C.border}`, background:"transparent", color:C.t2, borderRadius:8, padding:"5px 8px", fontSize:11, cursor:"pointer" }}>
            {matchesT.backToList}
          </button>
        </div>
      </div>

      {/* short description (bound to item.description) */}
      {item.description ? (
        <div style={{ padding:10, borderBottom:`1px solid ${C.border}`, color: C.t2 }}>
          <div style={{ fontSize:14, fontWeight:400, lineHeight:1.3, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', textOverflow:'ellipsis' }}>
            {item.description}
          </div>
        </div>
      ) : null}

      <div style={{ height:180, position:"relative", overflow:"hidden", background:C.alpha(C.t1, 0.03) }}>
        {imgs.length > 0 && (
          <SmartImage src={imgs[imgIdx]} alt={item.address} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        )}
        {imgs.length > 1 && (
          <>
            <button onClick={() => setImgIdx(i => i > 0 ? i - 1 : imgs.length - 1)} style={{ position:"absolute", top:"50%", left:8, transform:"translateY(-50%)", width:26, height:26, borderRadius:"50%", border:"none", background:"rgba(0,0,0,0.45)", color:"#fff", cursor:"pointer" }}>
              ‹
            </button>
            <button onClick={() => setImgIdx(i => i < imgs.length - 1 ? i + 1 : 0)} style={{ position:"absolute", top:"50%", right:8, transform:"translateY(-50%)", width:26, height:26, borderRadius:"50%", border:"none", background:"rgba(0,0,0,0.45)", color:"#fff", cursor:"pointer" }}>
              ›
            </button>
            <div style={{ position:"absolute", left:0, right:0, bottom:8, display:"flex", justifyContent:"center", gap:4 }}>
              {imgs.map((_, i) => (
                <div key={i} style={{ width:i===imgIdx?14:6, height:6, borderRadius:6, background:i===imgIdx?"#fff":"rgba(255,255,255,0.6)", transition:"all .15s" }} />
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ padding:10, display:"grid", gap:8 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:8 }}>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 10px", background:C.alpha(C.gold, 0.08) }}>
              <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.45px" }}>{matchesT.price}</div>
              <div style={{ fontSize:19, color:C.t1, fontWeight:900, lineHeight:1.1, marginTop:2 }}>{fmtCompactMoney(item.price)}</div>
            </div>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 10px", background:C.alpha(C.success, 0.08) }}>
              <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.45px" }}>{matchesT.capRate}</div>
              <div style={{ fontSize:19, color:C.t1, fontWeight:900, lineHeight:1.1, marginTop:2 }}>{item.capRate ? `${item.capRate}%` : "-"}</div>
            </div>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 10px", background:C.alpha(C.accent, 0.08) }}>
              <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.45px" }}>{matchesT.rehab}</div>
              <div style={{ fontSize:19, color:C.t1, fontWeight:900, lineHeight:1.1, marginTop:2 }}>{fmtCompactMoney(item.rehab || 0)}</div>
            </div>
          </div>

          <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", background:C.alpha(C.bg, 0.38), display:"grid", gap:6 }}>
            {detailGroups.flat().map(([k, v]) => (
              <div key={k} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, paddingBottom:5, borderBottom:`1px solid ${C.alpha(C.border, 0.5)}` }}
                onMouseEnter={e => e.currentTarget.style.background = C.alpha(C.t1, 0.03)}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ fontSize:10, color:C.t3, textTransform:"uppercase", letterSpacing:"0.4px", whiteSpace:"nowrap", flexShrink:0 }}>{k}</div>
                <div style={{ fontSize:12, color:C.t1, fontWeight:800, textAlign:"right" }}>{v}</div>
              </div>
            ))}
          </div>

          {metaChips.length ? (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {metaChips.map((chip) => (
                <div key={chip} style={{ padding:"4px 8px", borderRadius:999, border:`1px solid ${C.border}`, background:C.alpha(C.t1, 0.04), fontSize:10, color:C.t2, fontWeight:700 }}>
                  {chip}
                </div>
              ))}
            </div>
          ) : null}
        </div>

      {item.video ? (
        <div style={{ padding: '0 10px 10px' }}>
          <div style={{ fontSize:9, color:C.t3, textTransform:'uppercase', marginBottom:6 }}>{matchesT.video || 'Video'}</div>
          <video src={item.video} controls autoPlay={autoplayMedia} muted={autoplayMedia} playsInline style={{ width: '100%', borderRadius: 8 }} />
        </div>
      ) : null}

      <div style={{ padding: '0 10px 10px' }}>
        <PortfolioContactPanel
          canonicalContact={ownerContact}
          isUnlocked={isOwnerUnlocked}
          variant={contactPanelVariant}
          onUnlockRequest={onUnlockRequest}
        />
      </div>

      {typeof onStartChat === 'function' ? (
        <div style={{ padding: '0 10px 10px' }}>
          <button
            type="button"
            onClick={() => onStartChat(item)}
            style={{
              width: '100%',
              minHeight: 38,
              borderRadius: 10,
              border: 'none',
              background: C.accent,
              color: '#fff',
              fontSize: 12,
              fontWeight: 900,
              cursor: canUseChat ? 'pointer' : 'not-allowed',
              opacity: canUseChat ? 1 : 0.62,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon name="chat" size={14} color="#fff" />
            {chatInterestLabel}
          </button>
        </div>
      ) : null}

      <div style={{ padding:"0 10px 10px" }}>
        <div style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:8, background:C.alpha(C.accent, 0.04) }}>
          <div style={{ fontSize:10, color:C.t3, marginBottom:3 }}>{matchesT.ownerNotes}</div>
          <div style={{ fontSize:11, color:C.t2, lineHeight:1.45 }}>
            {ownerDesc || owner?.desc || matchesT.noOwnerNotes}
          </div>
        </div>
      </div>

      {emailComposeOpen ? (
        <Modal onClose={() => setEmailComposeOpen(false)} maxWidth={520}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{matchesT.exportModalTitle || 'Export portfolio release'}</div>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8, background: C.alpha(C.accent, 0.04) }}>
              <div style={{ fontSize: 11, color: C.t2, fontWeight: 800 }}>{matchesT.exportOptions || 'Export options'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    setExportMode('download');
                    setExportPdfLocal(true);
                    setExportPdfWithEmail(false);
                    setExportPhotosWithEmail(false);
                  }}
                  style={{
                    border: `1px solid ${exportMode === 'download' ? C.accent : C.border}`,
                    background: exportMode === 'download' ? C.alpha(C.accent, 0.12) : C.card,
                    color: exportMode === 'download' ? C.accent : C.t1,
                    borderRadius: 9,
                    padding: '9px 8px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {matchesT.exportModeDownload || 'Download to device'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportMode('email');
                    setExportPdfWithEmail(true);
                    setExportPdfLocal(false);
                    if (!String(emailTo || '').trim()) setEmailTo(getProfileEmailFallback());
                  }}
                  style={{
                    border: `1px solid ${exportMode === 'email' ? C.accent : C.border}`,
                    background: exportMode === 'email' ? C.alpha(C.accent, 0.12) : C.card,
                    color: exportMode === 'email' ? C.accent : C.t1,
                    borderRadius: 9,
                    padding: '9px 8px',
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {matchesT.exportModeEmail || 'Prepare by email'}
                </button>
              </div>

              {exportMode === 'download' ? (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                    <input type="checkbox" checked={exportPdfLocal} onChange={(e) => setExportPdfLocal(e.target.checked)} />
                    {matchesT.exportDownloadPdf || 'Download portfolio release PDF to device'}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                    <input type="checkbox" checked={exportPhotosLocal} onChange={(e) => setExportPhotosLocal(e.target.checked)} />
                    {matchesT.exportDownloadPhotos || 'Download property photos separately to device'}
                  </label>
                </>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                    <input type="checkbox" checked={exportPdfWithEmail} onChange={(e) => setExportPdfWithEmail(e.target.checked)} />
                    {matchesT.exportEmailPdf || 'Prepare PDF to include with email'}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                    <input type="checkbox" checked={exportPhotosWithEmail} onChange={(e) => setExportPhotosWithEmail(e.target.checked)} />
                    {matchesT.exportEmailPhotos || 'Prepare separate photos to include with email'}
                  </label>
                  <div style={{ fontSize: 10, color: C.t3 }}>
                    {matchesT.exportAttachmentHint || 'Email attachments are prepared locally and can be attached manually in your email client.'}
                  </div>
                </>
              )}
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'grid', gap: 8, opacity: exportMode === 'email' ? 1 : 0.48 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{matchesT.exportEmailRecipients || 'Email recipients'}</div>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{matchesT.exportRecipientTo || 'To'}</span>
                <input
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  disabled={exportMode !== 'email'}
                  placeholder={matchesT.exportRecipientPlaceholder || 'recipient@company.com'}
                  style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: exportMode === 'email' ? C.card : C.alpha(C.t1, 0.04), color: C.t1, outline: 'none' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{matchesT.exportRecipientCc || 'Cc'}</span>
                <input
                  value={emailCc}
                  onChange={(e) => setEmailCc(e.target.value)}
                  disabled={exportMode !== 'email'}
                  placeholder={matchesT.exportCcPlaceholder || 'copy@company.com'}
                  style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: exportMode === 'email' ? C.card : C.alpha(C.t1, 0.04), color: C.t1, outline: 'none' }}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{matchesT.exportRecipientBcc || 'Bcc'}</span>
                <input
                  value={emailBcc}
                  onChange={(e) => setEmailBcc(e.target.value)}
                  disabled={exportMode !== 'email'}
                  placeholder={matchesT.exportBccPlaceholder || 'hidden@company.com'}
                  style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: exportMode === 'email' ? C.card : C.alpha(C.t1, 0.04), color: C.t1, outline: 'none' }}
                />
              </label>
              <div style={{ fontSize: 10, color: C.t3 }}>
                {exportMode === 'email'
                  ? (matchesT.exportEmailSavedDefaults || 'These values are saved as your default for future exports.')
                  : (matchesT.exportEmailDisabledHint || 'Choose email delivery to edit and save recipient fields.')}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setEmailComposeOpen(false)}
                style={{ border:`1px solid ${C.border}`, background:'transparent', color:C.t2, borderRadius:8, padding:'7px 10px', fontSize:11, cursor:'pointer' }}
              >
                {modalsT.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmEmailExport}
                disabled={isPreparingExport}
                style={{ border:'none', background:C.accent, color:'#fff', borderRadius:8, padding:'7px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}
              >
                {isPreparingExport ? (matchesT.exportPreparing || 'Preparing...') : (matchesT.exportContinue || 'Continue')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function MatchesPage({ nuggets, setModal, openUnlock, unlocked, initialChat, chatFocusToken = 0, interested, matched, setInterested, setMatched, convos, setConvos, categoryOrder, setCategoryOrder, showcaseProperties, propertyPortfolio, servicePortfolio, userProfile, personalProfile, professionalProfile, mobileBottomNavCollapsed = false, userPreferences = null, subscription = null, setPage = null, addToast = null, onOpenChatLanguageConfig = null, onSendChatMessage = null, onRetryChatMessage = null, onMarkChatRead = null, onLoadMoreChatMessages = null, chatHasMore = {}, chatLoadingMore = {}, propertyUnlocks = [], unlockedContactMap = new Map(), currentUserId = 'local-user', isActive = true }) {
  const PORTFOLIO_PANEL_PADDING = 40;
  const PORTFOLIO_GRID_GAP = 12;
  const PORTFOLIO_CARD_MIN_WIDTH = 132;
  const DESKTOP_PORTFOLIO_MIN_WIDTH = 3 * PORTFOLIO_CARD_MIN_WIDTH + 2 * PORTFOLIO_GRID_GAP + PORTFOLIO_PANEL_PADDING;
  const DESKTOP_PORTFOLIO_WIDTH = 4 * PORTFOLIO_CARD_MIN_WIDTH + 3 * PORTFOLIO_GRID_GAP + PORTFOLIO_PANEL_PADDING;
  const DESKTOP_PORTFOLIO_MAX_WIDTH = 5 * PORTFOLIO_CARD_MIN_WIDTH + 4 * PORTFOLIO_GRID_GAP + PORTFOLIO_PANEL_PADDING;
  const DESKTOP_CHAT_MIN_WIDTH = 300;
  // prevent eslint unused-var warnings for props forwarded from App
  void categoryOrder;
  void setCategoryOrder;
  const [active, setActive] = useState(initialChat || null);
  const [msg, setMsg] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const chatHistoryLoadRef = useRef({ peerId: '', beforeHeight: 0, beforeTop: 0 });
  const chatInitialLoadRequestedRef = useRef(new Set());
  const entitlementAlertLogRef = useRef(new Set());
  const msgInputRef = useRef(null);
  const splitPaneRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Resizing logic
  const [portfolioWidth, setPortfolioWidth] = useState(DESKTOP_PORTFOLIO_WIDTH);
  const [tabletPortfolioPct, setTabletPortfolioPct] = useState(64);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState(null);
  const [previewCardOpen, setPreviewCardOpen] = useState(false);
  const [_previewShowcaseIdx, setPreviewShowcaseIdx] = useState(0);
  const myInputLang = getSafeLang(userPreferences?.chatLanguage?.input || 'pt');
  const myOutputLang = getSafeLang(userPreferences?.chatLanguage?.output || 'en');
  const [chatMainTextSize, setChatMainTextSize] = useState(() => {
    const raw = Number(localStorage.getItem('chatMainTextSize') || 12);
    if (!Number.isFinite(raw)) return 12;
    return Math.max(10, Math.min(18, raw));
  });
  const [seenIncomingByContact, setSeenIncomingByContact] = useState(() => {
    const saved = localStorage.getItem('chatSeenIncomingByContact');
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { void e; return {}; }
  });
  const peerLangPrefs = useMemo(() => {
    const saved = localStorage.getItem('chatPeerLangPrefs');
    if (!saved) return {};
    try {
      return JSON.parse(saved);
    } catch (e) { void e; return {}; }
  }, []);
  const isResizing = useRef(false);
  const resizingMode = useRef('horizontal');

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    resizingMode.current = 'horizontal';
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current || !splitPaneRef.current) return;
    const rect = splitPaneRef.current.getBoundingClientRect();
    if (resizingMode.current === 'vertical') {
      const rawPct = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
      setTabletPortfolioPct(Math.max(48, Math.min(rawPct, 76)));
      return;
    }
    const nextWidth = rect.right - e.clientX;
    const hardMax = Math.max(0, Math.min(DESKTOP_PORTFOLIO_MAX_WIDTH, rect.width - DESKTOP_CHAT_MIN_WIDTH - 4));
    const effectiveMin = Math.min(DESKTOP_PORTFOLIO_MIN_WIDTH, hardMax);
    const clamped = Math.max(effectiveMin, Math.min(nextWidth, hardMax));
    setPortfolioWidth(clamped);
  }, [DESKTOP_CHAT_MIN_WIDTH, DESKTOP_PORTFOLIO_MAX_WIDTH, DESKTOP_PORTFOLIO_MIN_WIDTH]);

  const startResizing = useCallback((mode = 'horizontal') => {
    isResizing.current = true;
    resizingMode.current = mode;
    document.body.style.cursor = mode === 'vertical' ? "row-resize" : "col-resize";
    document.body.style.userSelect = "none";
    const onUp = () => {
      stopResizing();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("pointermove", handleMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("pointermove", handleMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [handleMouseMove, stopResizing]);
  
  const allT = useT('matches');
  const t = allT.matches;
  const [planGate, setPlanGate] = useState(null);
  const canUseChat = isFeatureAllowed(subscription, 'chat');
  const canExportPdf = isFeatureAllowed(subscription, 'exportPdf');
  const goToPricingFromGate = useCallback(() => {
    if (planGate?.feature) {
      trackAppEvent('plan_gate_upgrade_clicked', {
        entityType: 'feature',
        entityId: planGate.feature,
        metadata: { feature: String(planGate.feature || '') },
      });
    }
    setPlanGate(null);
    if (typeof setPage === 'function') setPage('pricing');
  }, [planGate, setPage]);
  const blockFeature = useCallback((feature) => {
    const copy = getPlanGateCopy(feature);
    trackAppEvent('plan_gate_shown', {
      entityType: 'feature',
      entityId: feature,
      metadata: { feature: String(feature || '') },
    });
    addToast?.({ type: 'warning', title: copy.title, message: copy.message, duration: 6500 });
    setPlanGate({ ...copy, feature });
    return false;
  }, [addToast]);
  const guardExportPdf = useCallback(() => {
    if (canExportPdf) return true;
    return blockFeature('exportPdf');
  }, [blockFeature, canExportPdf]);
  const matchesPrefs = userPreferences?.feedMatches || {};
  const privacyPrefs = userPreferences?.privacy || {};
  const sortOrder = String(matchesPrefs.sortOrder || 'recent');
  const autoplayMedia = Boolean(matchesPrefs.autoplayMedia);
  const readReceiptsEnabled = Boolean(privacyPrefs.readReceipts ?? true);
  const dt = allT.dashboard;
  const onboardingT = allT.onboarding;
  // prevent eslint unused-var warnings for props forwarded from App
  void dt;
  void categoryOrder;
  void setCategoryOrder;
  const cardsT = allT.cards;
  const modalsT = allT.modals;
  const handleUnlockRealtimeNotify = useCallback((notification) => {
    const isPropertyUnlock = notification?.table === 'property_unlocks';
    addToast?.({
      type: 'info',
      title: t.unlockRealtimeTitle || 'New unlock',
      message: isPropertyUnlock
        ? (t.unlockRealtimePropertyMessage || 'Someone unlocked one of your properties.')
        : (t.unlockRealtimeContactMessage || 'Someone unlocked your contact.'),
      duration: 6500,
    });
  }, [addToast, t]);
  const {
    unreadCount: unlockNotificationCount,
    markAllRead: markUnlockNotificationsRead,
  } = useUnlockNotifications({
    currentUserId,
    enabled: Boolean(currentUserId && currentUserId !== 'local-user'),
    onNotify: handleUnlockRealtimeNotify,
  });

  useEffect(() => {
    if (!isActive) return;
    if (unlockNotificationCount <= 0) return;
    markUnlockNotificationsRead?.().catch?.((error) => {
      addToast?.({
        type: 'warning',
        title: t.unlockRealtimeTitle || 'New unlock',
        message: String(error?.message || 'Could not mark unlock notifications as read.'),
        duration: 5000,
      });
    });
  }, [addToast, isActive, markUnlockNotificationsRead, t.unlockRealtimeTitle, unlockNotificationCount]);
  const CONTACT_SIGNAL = C.accent;
  const PROPERTY_SIGNAL = "#4381bc";
  const getOwnerIdForScope = useCallback((scopeKey) => {
    const liveUserId = String(currentUserId || '').trim();
    if (isSupabaseConfigured && liveUserId && liveUserId !== 'local-user') return liveUserId;
    if (!isSupabaseConfigured || import.meta.env.DEV) return getLocalOwnerId(scopeKey);
    return '';
  }, [currentUserId]);
  const personalOwnerId = useMemo(() => getOwnerIdForScope('personal'), [getOwnerIdForScope]);
  const secondaryOwnerId = useMemo(() => getOwnerIdForScope('secondary'), [getOwnerIdForScope]);
  const fsboOwnerId = useMemo(() => getOwnerIdForScope('fsbo'), [getOwnerIdForScope]);
  const getRecordProfileScope = useCallback((record, fallbackScope = '') => {
    return inferRecordProfileScope(record, fallbackScope);
  }, []);
  // Use module-scope CHAT_REPLY_TEMPLATES, CHAT_INTEREST_PREFIX and DEFAULT_PEER_LANGS
  // (defined at top of file) to keep references stable for hook dependencies.
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [interestsFilter, setInterestsFilter] = useState("all");
  const [peopleCategoryDropdownOpen, setPeopleCategoryDropdownOpen] = useState(false);
  const [interestsStateDropdownOpen, setInterestsStateDropdownOpen] = useState(false);
  const [selectedPeopleCategories, setSelectedPeopleCategories] = useState([]);
  const [selectedInterestStates, setSelectedInterestStates] = useState([]);
  const matchesStorageKeys = useMemo(() => ({
    archivedContacts: getUserScopedStorageKey('ds_matches_archived_contacts', currentUserId),
    archivedInterests: getUserScopedStorageKey('ds_matches_archived_interests', currentUserId),
    deletedContacts: getUserScopedStorageKey('ds_matches_deleted_contacts', currentUserId),
    deletedInterests: getUserScopedStorageKey('ds_matches_deleted_interests', currentUserId),
  }), [currentUserId]);
  const [archivedContacts, setArchivedContacts] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_archived_contacts', currentUserId)));
  const [archivedInterests, setArchivedInterests] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_archived_interests', currentUserId)));
  const [deletedContacts, setDeletedContacts] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_deleted_contacts', currentUserId)));
  const [deletedInterests, setDeletedInterests] = useState(() => readLocalStringSet(getUserScopedStorageKey('ds_matches_deleted_interests', currentUserId)));
  const [paidContactPrompt, setPaidContactPrompt] = useState(null);
  const [remoteActiveExclusivities, setRemoteActiveExclusivities] = useState([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setArchivedContacts(readLocalStringSet(matchesStorageKeys.archivedContacts));
      setArchivedInterests(readLocalStringSet(matchesStorageKeys.archivedInterests));
      setDeletedContacts(readLocalStringSet(matchesStorageKeys.deletedContacts));
      setDeletedInterests(readLocalStringSet(matchesStorageKeys.deletedInterests));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [matchesStorageKeys]);

  useEffect(() => {
    if (!isSupabaseConfigured || !currentUserId || currentUserId === 'local-user') {
      const timer = window.setTimeout(() => setRemoteActiveExclusivities([]), 0);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    getActiveExclusivities(currentUserId)
      .then((rows) => {
        if (!cancelled) setRemoteActiveExclusivities(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setRemoteActiveExclusivities([]);
      });
    return () => { cancelled = true; };
  }, [currentUserId]);

  // Combined sources: user data merged with mock seed data for mock card owners.
  // Uses String() comparison and deduplication by id so user's own records always win.
  const allPropertiesSource = useMemo(() => {
    const byId = new Map();
    [...(showcaseProperties || []), ...(propertyPortfolio || [])].forEach((property) => {
      const key = String(property?.id || property?.portfolioId || '').trim();
      if (!key) return;
      byId.set(key, property);
    });
    const userProps = [...byId.values()];
    const userIds = new Set(userProps.map((p) => String(p.id)));
    const devMockProperties = import.meta.env.DEV ? PROPERTIES.filter((p) => !userIds.has(String(p.id))) : [];
    return [...userProps, ...devMockProperties];
  }, [propertyPortfolio, showcaseProperties]);

  const allServicesSource = useMemo(() => {
    const userSvcs = servicePortfolio || [];
    const userIds = new Set(userSvcs.map((s) => String(s.id)));
    const devMockServices = import.meta.env.DEV ? SERVICE_PORTFOLIO.filter((s) => !userIds.has(String(s.id))) : [];
    return [...userSvcs, ...devMockServices];
  }, [servicePortfolio]);

  const buildLocalOwnerCard = useCallback((scope = 'personal') => {
    const normalizedScope = normalizeProfileScope(scope);
    if (!normalizedScope) return null;
    const ownerKey = normalizedScope === 'professional'
      ? 'secondary'
      : (normalizedScope === 'fsbo' ? 'fsbo' : 'personal');
    const ownerId = getOwnerIdForScope(ownerKey);
    const scopedIdentity = resolveScopedProfile(normalizedScope, {
      accountType: userProfile?.accountType || '',
      userProfile,
      personalProfile,
      professionalProfile,
    });
    const scopedProperties = allPropertiesSource.filter((p) => (
      String(p.ownerId) === String(ownerId)
      && getRecordProfileScope(p) === normalizedScope
    ));
    const scopedServices = allServicesSource.filter((s) => (
      String(s.ownerId) === String(ownerId)
      && getRecordProfileScope(s) === normalizedScope
      && (s.publishToConnections !== false)
    ));
    const descriptions = scopedServices
      .filter((s) => s.description && String(s.description).trim().length)
      .map((s) => String(s.description).trim());
    const firstProperty = scopedProperties.find((p) => p.description && String(p.description).trim().length);
    const categoryId = scopedIdentity?.categoryId || '';
    const categoryLabel = CATEGORIES
      .filter((c) => c.id !== 'all')
      .flatMap((c) => (c.sub ? [{ ...c, sub: null }, ...c.sub] : [c]))
      .find((c) => c.id === categoryId)?.label;

    return {
      id: ownerId,
      ownerId,
      primaryProfile: normalizedScope,
      name: scopedIdentity?.name || '',
      type: normalizedScope === 'fsbo'
        ? 'FSBO'
        : (categoryLabel || scopedIdentity?.categoryLabelFallback || ''),
      badge: scopedIdentity?.badge || '',
      cat: userProfile?.category || '',
      loc: scopedIdentity?.loc || userProfile?.location || '',
      photo: scopedIdentity?.photo || '',
      desc: descriptions.length
        ? descriptions.join(' • ')
        : (firstProperty?.description || scopedIdentity?.pitch || ''),
      contactMethods: scopedIdentity?.contactMethods || [],
      primaryPhone: scopedIdentity?.primaryPhone || '',
      secondaryPhone: scopedIdentity?.secondaryPhone || '',
      tertiaryPhone: scopedIdentity?.tertiaryPhone || '',
      email: scopedIdentity?.email || '',
    };
  }, [allPropertiesSource, allServicesSource, personalProfile, professionalProfile, userProfile, getRecordProfileScope, getOwnerIdForScope]);

  const resolveContactCard = useCallback((cardLike, scopeHint = null) => {
    if (!cardLike) return null;
    const localScopeFallback = (
      String(cardLike.id) === String(secondaryOwnerId) || String(cardLike.ownerId) === String(secondaryOwnerId)
        ? 'professional'
        : (String(cardLike.id) === String(fsboOwnerId) || String(cardLike.ownerId) === String(fsboOwnerId)
          ? 'fsbo'
          : ((String(cardLike.id) === String(personalOwnerId) || String(cardLike.ownerId) === String(personalOwnerId)) ? 'personal' : ''))
    );
    const resolvedScope = normalizeProfileScope(scopeHint || cardLike.primaryProfile || localScopeFallback);
    if (!resolvedScope) return null;
    const isLocalCard =
      String(cardLike.id) === String(personalOwnerId) ||
      String(cardLike.id) === String(secondaryOwnerId) ||
      String(cardLike.id) === String(fsboOwnerId) ||
      String(cardLike.ownerId) === String(personalOwnerId) ||
      String(cardLike.ownerId) === String(secondaryOwnerId) ||
      String(cardLike.ownerId) === String(fsboOwnerId);
    if (!isLocalCard) {
      const isUnlockedSnapshot = String(cardLike?.source || '').trim() === 'remote-unlock'
        || cardLike?.chatLinked === true
        || String(cardLike?.unlockId || cardLike?.unlock_id || '').trim();
      if (isUnlockedSnapshot) return cardLike;
      return normalizeCard({ ...cardLike, cardKind: 'person' }, currentUserId) || cardLike;
    }
    const localOwnerCard = buildLocalOwnerCard(resolvedScope);
    if (!localOwnerCard) return cardLike;
    return normalizeCard({
      ...cardLike,
      ...localOwnerCard,
      primaryProfile: resolvedScope,
      cardKind: 'person',
      ownerPreview: { ...localOwnerCard, primaryProfile: resolvedScope },
      linkedProperties: allPropertiesSource.filter((p) => (
        String(p.ownerId) === String(localOwnerCard.ownerId)
        && getRecordProfileScope(p) === resolvedScope
      )),
      linkedServices: allServicesSource.filter((s) => (
        String(s.ownerId) === String(localOwnerCard.ownerId)
        && getRecordProfileScope(s) === resolvedScope
        && (s.publishToConnections !== false)
      )),
    }, currentUserId) || {
      ...cardLike,
      ...localOwnerCard,
      primaryProfile: resolvedScope,
    };
  }, [allPropertiesSource, allServicesSource, buildLocalOwnerCard, currentUserId, fsboOwnerId, getRecordProfileScope, personalOwnerId, secondaryOwnerId]);

  const getContactUnlockKeys = useCallback((itemOrId) => {
    if (itemOrId == null) return [];
    if (typeof itemOrId === 'string' || typeof itemOrId === 'number') {
      const key = String(itemOrId).trim();
      return key ? [key] : [];
    }
    const candidates = [
      itemOrId.ownerId,
      itemOrId.unlockOwnerId,
      itemOrId.sellerId,
      itemOrId.contactId,
      itemOrId.unlockContactId,
      itemOrId.id,
      itemOrId.sourceCardId,
    ];
    return Array.from(new Set(
      candidates
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));
  }, []);

  const unlockedIdSet = useMemo(() => new Set(
    (Array.isArray(unlocked) ? unlocked : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ), [unlocked]);

  const getCanonicalContact = useCallback((ownerId) => (
    getContactByOwnerId(unlockedContactMap, ownerId)
  ), [unlockedContactMap]);

  const isContactUnlockedByState = useCallback((itemOrId) => (
    getContactUnlockKeys(itemOrId).some((key) => (
      isCanonicalOwnerUnlocked(unlockedContactMap, key) || unlockedIdSet.has(key)
    ))
  ), [getContactUnlockKeys, unlockedContactMap, unlockedIdSet]);

  const isPropertyUnlockedByCanonicalState = useCallback((property) => {
    if (!property) return false;
    const ownerId = String(property.ownerId || property.owner_id || '').trim();
    const propertyId = String(property.id || property.propertyId || property.property_id || property.portfolioId || '').trim();
    if (!ownerId || !propertyId) return false;
    return isCanonicalPropertyUnlocked(unlockedContactMap, ownerId, propertyId);
  }, [unlockedContactMap]);

  const logEntitlementAlertOnce = useCallback(async (level, event, key, payloadBuilder, error = null) => {
    const dedupeKey = `${event}:${key}`;
    if (entitlementAlertLogRef.current.has(dedupeKey)) return;
    entitlementAlertLogRef.current.add(dedupeKey);
    const payload = typeof payloadBuilder === 'function' ? await payloadBuilder() : (payloadBuilder || {});
    captureEntitlementAlert(level, event, payload, error);
  }, []);

  const hasOwnerPortfolioAccessByState = useCallback((ownerId) => (
    hasOwnerPortfolioEntitlement(unlockedContactMap, ownerId)
  ), [unlockedContactMap]);

  const resolveCanonicalContactCard = useCallback((contactLike) => {
    return resolveCanonicalContactCardFromMap(unlockedContactMap, contactLike);
  }, [unlockedContactMap]);

  const getPropertyExclusiveStatus = useCallback((propertyOrId) => {
    const candidates = propertyOrId && typeof propertyOrId === 'object'
      ? [propertyOrId.id, propertyOrId.propertyId, propertyOrId.property_id, propertyOrId.portfolioId]
      : [propertyOrId];
    for (const candidate of candidates) {
      const propertyId = String(candidate || '').trim();
      if (!propertyId) continue;
      const status = getPropertyExclusivityStatus([...remoteActiveExclusivities, ...propertyUnlocks], propertyId, currentUserId);
      if ((status?.kind === 'owned' || status?.kind === 'blocked') && status?.expiresAt) return status;
    }
    return null;
  }, [currentUserId, propertyUnlocks, remoteActiveExclusivities]);

  const getOwnerExclusiveStatus = useCallback((ownerId) => {
    const ownerKey = String(ownerId || '').trim();
    if (!ownerKey) return null;
    const ownerProperties = (allPropertiesSource || []).filter((property) => String(property?.ownerId || '') === ownerKey);
    for (const property of ownerProperties) {
      const status = getPropertyExclusiveStatus(property);
      if (status?.expiresAt) return status;
    }
    return null;
  }, [allPropertiesSource, getPropertyExclusiveStatus]);

  const getInterestKey = useCallback((interest) => (
    String(interest?.id || interest?.propertyId || interest?.property_id || '').trim()
  ), []);

  const warnExclusiveLocked = useCallback(() => {
    addToast?.({
      type: 'warning',
      title: t.exclusivityActiveTitle || 'Active exclusivity',
      message: t.exclusivityActiveArchiveBlocked || 'This item has active exclusivity and cannot be archived or deleted until the exclusivity timer ends.',
      duration: 6500,
    });
  }, [addToast, t]);

  const getPaidContactWarning = useCallback((mode = 'archive') => (
    mode === 'delete'
      ? (t.deletePaidContactWarning || 'This contact was already unlocked/paid. Deleting hides it permanently from your lists and does not refund nuggets. Every unlocked/paid contact is yours by right; DealSifter strongly encourages you not to delete it so you can keep tracking future opportunities from this contact.')
      : (t.archivePaidContactWarning || 'This contact was already unlocked/paid. Archiving hides it from your active list, but you can restore it later from Archived. Every unlocked/paid contact is yours by right; DealSifter strongly encourages you not to delete it so you can keep tracking future opportunities from this contact.')
  ), [t]);

  const archiveContact = useCallback((contact, options = {}) => {
    const keys = getContactUnlockKeys(contact);
    if (!keys.length) return;
    if (getOwnerExclusiveStatus(contact?.ownerId || contact?.unlockOwnerId || contact?.id)?.expiresAt) {
      warnExclusiveLocked();
      return;
    }
    if (isContactUnlockedByState(contact) && !options.confirmed) {
      setPaidContactPrompt({ mode: 'archive', contact });
      return;
    }
    setArchivedContacts((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.add(key));
      writeLocalStringSet(matchesStorageKeys.archivedContacts, next);
      return next;
    });
    setActive((prev) => (getContactUnlockKeys(prev).some((key) => keys.includes(key)) ? null : prev));
  }, [getContactUnlockKeys, getOwnerExclusiveStatus, isContactUnlockedByState, matchesStorageKeys.archivedContacts, warnExclusiveLocked]);

  const restoreContact = useCallback((contact) => {
    const keys = getContactUnlockKeys(contact);
    setArchivedContacts((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.delete(key));
      writeLocalStringSet(matchesStorageKeys.archivedContacts, next);
      return next;
    });
  }, [getContactUnlockKeys, matchesStorageKeys.archivedContacts]);

  const deleteContactFromMatches = useCallback((contact, options = {}) => {
    const keys = getContactUnlockKeys(contact);
    if (!keys.length) return;
    if (getOwnerExclusiveStatus(contact?.ownerId || contact?.unlockOwnerId || contact?.id)?.expiresAt) {
      warnExclusiveLocked();
      return;
    }
    if (isContactUnlockedByState(contact) && !options.confirmed) {
      setPaidContactPrompt({ mode: 'delete', contact });
      return;
    }
    setDeletedContacts((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.add(key));
      writeLocalStringSet(matchesStorageKeys.deletedContacts, next);
      return next;
    });
    setArchivedContacts((prev) => {
      const next = new Set(prev);
      keys.forEach((key) => next.delete(key));
      writeLocalStringSet(matchesStorageKeys.archivedContacts, next);
      return next;
    });
    setMatched((prev) => prev.filter((item) => !getContactUnlockKeys(item).some((key) => keys.includes(key))));
    setInterested((prev) => prev.filter((item) => !keys.includes(String(item?.ownerId || '').trim())));
    setActive((prev) => (getContactUnlockKeys(prev).some((key) => keys.includes(key)) ? null : prev));
  }, [getContactUnlockKeys, getOwnerExclusiveStatus, isContactUnlockedByState, matchesStorageKeys.archivedContacts, matchesStorageKeys.deletedContacts, setInterested, setMatched, warnExclusiveLocked]);

  const archiveInterest = useCallback((interest) => {
    const key = getInterestKey(interest);
    if (!key) return;
    if (getPropertyExclusiveStatus(interest)?.expiresAt) {
      warnExclusiveLocked();
      return;
    }
    setArchivedInterests((prev) => {
      const next = new Set(prev);
      next.add(key);
      writeLocalStringSet(matchesStorageKeys.archivedInterests, next);
      return next;
    });
    setActive((prev) => (getInterestKey(prev) === key ? null : prev));
  }, [getInterestKey, getPropertyExclusiveStatus, matchesStorageKeys.archivedInterests, warnExclusiveLocked]);

  const restoreInterest = useCallback((interest) => {
    const key = getInterestKey(interest);
    setArchivedInterests((prev) => {
      const next = new Set(prev);
      next.delete(key);
      writeLocalStringSet(matchesStorageKeys.archivedInterests, next);
      return next;
    });
  }, [getInterestKey, matchesStorageKeys.archivedInterests]);

  const deleteInterestFromMatches = useCallback((interest) => {
    const key = getInterestKey(interest);
    if (!key) return;
    if (getPropertyExclusiveStatus(interest)?.expiresAt) {
      warnExclusiveLocked();
      return;
    }
    setDeletedInterests((prev) => {
      const next = new Set(prev);
      next.add(key);
      writeLocalStringSet(matchesStorageKeys.deletedInterests, next);
      return next;
    });
    setArchivedInterests((prev) => {
      const next = new Set(prev);
      next.delete(key);
      writeLocalStringSet(matchesStorageKeys.archivedInterests, next);
      return next;
    });
    setInterested((prev) => prev.filter((item) => getInterestKey(item) !== key));
    setActive((prev) => (getInterestKey(prev) === key ? null : prev));
  }, [getInterestKey, getPropertyExclusiveStatus, matchesStorageKeys.archivedInterests, matchesStorageKeys.deletedInterests, setInterested, warnExclusiveLocked]);

  const formatTemplate = useCallback((template, values) => {
    let out = String(template || '');
    Object.entries(values || {}).forEach(([key, value]) => {
      out = out.replace(`{${key}}`, String(value));
    });
    return out;
  }, []);

  const currentUserChatPreview = useMemo(() => {
    const preferredScope = normalizeProfileScope(
      userProfile?.accountType === 'professional' ? 'professional' : (userProfile?.accountType === 'fsbo_owner' ? 'fsbo' : 'personal')
    ) || 'personal';
    return compactChatPreview(
      buildLocalOwnerCard(preferredScope)
        || buildLocalOwnerCard('personal')
        || buildLocalOwnerCard('professional')
        || buildLocalOwnerCard('fsbo')
    );
  }, [buildLocalOwnerCard, userProfile?.accountType]);

  const reciprocalChatContacts = useMemo(() => {
    const rows = [];
    Object.entries(convos || {}).forEach(([peerId, messages]) => {
      const incoming = (Array.isArray(messages) ? messages : []).filter((message) => message?.from !== 'me');
      if (!incoming.length) return;
      const lastIncoming = incoming[incoming.length - 1] || {};
      const preview = lastIncoming.senderPreview && typeof lastIncoming.senderPreview === 'object'
        ? lastIncoming.senderPreview
        : {};
      rows.push({
        id: String(preview.id || preview.ownerId || peerId),
        ownerId: String(preview.ownerId || preview.id || peerId),
        unlockOwnerId: String(preview.unlockOwnerId || preview.ownerId || preview.id || peerId),
        sourceCardId: preview.sourceCardId || `chat:${peerId}`,
        name: preview.name || preview.title || 'Chat contact',
        title: preview.title || preview.name || 'Chat contact',
        type: preview.type || 'Contact',
        badge: preview.badge || '',
        cat: preview.cat || '',
        loc: preview.loc || '',
        photo: preview.photo || '',
        primaryProfile: preview.primaryProfile || 'personal',
        contactMethods: Array.isArray(preview.contactMethods) ? preview.contactMethods : ['DealSifter chat'],
        chatLinked: true,
        chatUnreadSource: true,
      });
    });
    return rows;
  }, [convos]);

  const allMatched = useMemo(() => {
    const byKey = new Map();
    if (unlockedContactMap instanceof Map) {
      Array.from(unlockedContactMap.values())
        .map(canonicalContactToDisplayCard)
        .filter(Boolean)
        .forEach((contact) => {
          const key = getContactUnlockKeys(contact)[0] || String(contact?.id || '');
          if (key) byKey.set(key, contact);
        });
    }
    [...(Array.isArray(matched) ? matched : []), ...reciprocalChatContacts]
      .map((m) => {
        const resolved = resolveCanonicalContactCard(resolveContactCard(m));
        return resolved ? { ...m, ...resolved, chatLinked: Boolean(m?.chatLinked || resolved?.chatLinked) } : null;
      })
      .filter(Boolean)
      .forEach((contact) => {
        const key = getContactUnlockKeys(contact)[0] || String(contact?.id || '');
        if (!key) return;
        byKey.set(key, mergeContactForDisplay(byKey.get(key) || {}, contact));
      });
    return [...byKey.values()];
  }, [matched, reciprocalChatContacts, resolveCanonicalContactCard, resolveContactCard, getContactUnlockKeys, unlockedContactMap]);

  const parseStateCode = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    const m = raw.match(/(?:,\s*|\b)([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
    return m ? m[1].toUpperCase() : null;
  }, []);

  const getInterestStateCode = useCallback((property) => {
    if (!property) return null;
    const directState = parseStateCode(
      property.state
      || property.stateCode
      || property.state_code
      || property.propertyState
      || property.property_state
    );
    if (directState) return directState;
    return parseStateCode(
      property.loc
      || property.location
      || property.fullAddress
      || property.full_address
      || property.address
      || ''
    );
  }, [parseStateCode]);

  const categoryLookup = useMemo(() => {
    const labelByKey = new Map();
    const aliasToKeys = new Map();
    const addAlias = (alias, ...keys) => {
      const normalizedAlias = String(alias || '').trim().toLowerCase();
      if (!normalizedAlias) return;
      const current = aliasToKeys.get(normalizedAlias) || new Set();
      keys.filter(Boolean).forEach((key) => current.add(String(key).trim().toLowerCase()));
      aliasToKeys.set(normalizedAlias, current);
    };

    CATEGORIES.forEach((category) => {
      const categoryId = String(category.id || '').trim().toLowerCase();
      if (!categoryId || categoryId === 'all') return;
      labelByKey.set(categoryId, category.label);
      addAlias(category.id, categoryId);
      addAlias(category.label, categoryId);
      (category.sub || []).forEach((subCategory) => {
        const subId = String(subCategory.id || '').trim().toLowerCase();
        if (!subId) return;
        labelByKey.set(subId, subCategory.label);
        addAlias(subCategory.id, subId, categoryId);
        addAlias(subCategory.label, subId, categoryId);
      });
    });

    return { labelByKey, aliasToKeys };
  }, []);

  const getPeopleCategoryKeys = useCallback((contact) => {
    const keys = new Set();
    [
      contact?.cat,
      contact?.category,
      contact?.type,
      contact?.role,
      contact?.sub,
      contact?.badge,
      contact?.primaryCategory,
      contact?.primary_category,
    ].forEach((value) => {
      const raw = String(value || '').trim();
      if (!raw) return;
      const normalized = raw.toLowerCase();
      keys.add(normalized);
      const mapped = categoryLookup.aliasToKeys.get(normalized);
      if (mapped) mapped.forEach((key) => keys.add(key));
    });
    return keys;
  }, [categoryLookup]);

  const peopleCategoryOptions = useMemo(() => {
    const unique = new Map();
    allMatched.forEach((m) => {
      getPeopleCategoryKeys(m).forEach((key) => {
        if (!key || key === 'all') return;
        if (!unique.has(key)) unique.set(key, categoryLookup.labelByKey.get(key) || key);
      });
    });
    return Array.from(unique.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allMatched, categoryLookup, getPeopleCategoryKeys]);

  const interestStateOptions = useMemo(() => {
    const states = Array.from(new Set(
      interested
        .map((p) => getInterestStateCode(p))
        .filter(Boolean)
    ));
    states.sort();
    return states;
  }, [interested, getInterestStateCode]);

  const filteredMatched = useMemo(() => {
    const list = allMatched.filter(m => {
      const paid = isContactUnlockedByState(m);
      const contactKeys = getContactUnlockKeys(m);
      const isArchived = contactKeys.some((key) => archivedContacts.has(key));
      const isDeleted = contactKeys.some((key) => deletedContacts.has(key));
      if (isDeleted) return false;
      if (peopleFilter === "archived") return isArchived;
      if (isArchived) return false;
      if (peopleFilter === "paid" && !paid) return false;
      if (peopleFilter === "locked" && paid) return false;
      if (selectedPeopleCategories.length > 0) {
        const categoryKeys = getPeopleCategoryKeys(m);
        if (!selectedPeopleCategories.some((cat) => categoryKeys.has(String(cat || '').trim().toLowerCase()))) return false;
      }
      return true;
    });
    if (sortOrder === 'name_asc') return [...list].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    return list;
  }, [allMatched, peopleFilter, isContactUnlockedByState, selectedPeopleCategories, sortOrder, getPeopleCategoryKeys, getContactUnlockKeys, archivedContacts, deletedContacts]);

  const isActiveProperty = active?.address !== undefined;
  const activeContactId = useMemo(() => {
    if (!active) return null;
    return isActiveProperty ? active.ownerId : (active.ownerId || active.unlockOwnerId || active.id);
  }, [active, isActiveProperty]);
  const activeContactKeys = useMemo(() => {
    const keys = new Set(getContactUnlockKeys(active));
    const ownerKey = String(activeContactId || '').trim();
    if (ownerKey) keys.add(ownerKey);
    return keys;
  }, [active, activeContactId, getContactUnlockKeys]);
  const activeContactKey = useMemo(() => [...activeContactKeys][0] || '', [activeContactKeys]);
  const isLinkedToActiveContact = useCallback((ownerId) => (
    Boolean(ownerId) && activeContactKeys.has(String(ownerId || '').trim())
  ), [activeContactKeys]);

  const interestBaseList = useMemo(() => {
    const list = Array.isArray(interested) ? [...interested] : [];
    if (activeContactKey) {
      const existingIds = new Set(list.map((item) => String(item?.id || '')));
      (allPropertiesSource || [])
        .filter((property) => isLinkedToActiveContact(property?.ownerId))
        .forEach((property) => {
          if (!existingIds.has(String(property?.id || ''))) {
            list.push(property);
            existingIds.add(String(property?.id || ''));
          }
        });
    }
    return list;
  }, [activeContactKey, allPropertiesSource, interested, isLinkedToActiveContact]);

  const filteredInterested = useMemo(() => {
    const list = interestBaseList.filter(p => {
      const interestKey = getInterestKey(p);
      const ownerKeys = getContactUnlockKeys({ ownerId: p.ownerId });
      const isArchived = archivedInterests.has(interestKey) || ownerKeys.some((key) => archivedContacts.has(key));
      const isDeleted = deletedInterests.has(interestKey) || ownerKeys.some((key) => deletedContacts.has(key));
      if (isDeleted) return false;
      if (interestsFilter === "archived") return isArchived;
      if (isArchived) return false;
      const paid = isPropertyUnlockedByCanonicalState(p);
      if (interestsFilter === "paid" && !paid) return false;
      if (interestsFilter === "locked" && paid) return false;
      if (selectedInterestStates.length > 0) {
        const state = getInterestStateCode(p);
        if (!state || !selectedInterestStates.includes(state)) return false;
      }
      return true;
    });
    const sortList = (items) => (
      sortOrder === 'price_desc'
        ? [...items].sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0))
        : items
    );
    if (!activeContactKey) return sortList(list);
    const linked = [];
    const others = [];
    list.forEach((property) => {
      if (isLinkedToActiveContact(property?.ownerId)) linked.push(property);
      else others.push(property);
    });
    return [...sortList(linked), ...sortList(others)];
  }, [activeContactKey, interestBaseList, interestsFilter, isPropertyUnlockedByCanonicalState, selectedInterestStates, getInterestStateCode, sortOrder, isLinkedToActiveContact, getInterestKey, getContactUnlockKeys, archivedInterests, archivedContacts, deletedInterests, deletedContacts]);

  const activeOwner = useMemo(() => {
    if (!active) return null;
    const activeOwnerId = String(
      isActiveProperty
        ? active.ownerId
        : (active.ownerId || active.unlockOwnerId || active.id)
    || '').trim();
    const canonical = canonicalContactToDisplayCard(getCanonicalContact(activeOwnerId));
    if (canonical) return canonical;
    if (!isActiveProperty) {
      const resolved = resolveCanonicalContactCard(resolveContactCard(active));
      if (resolved) return resolved;
      const activeKeys = getContactUnlockKeys(active);
      const hydrated = allMatched.find((contact) => getContactUnlockKeys(contact).some((key) => activeKeys.includes(key)));
      return hydrated ? resolveCanonicalContactCard(hydrated) : null;
    }
    const hydratedOwner = allMatched.find((contact) => getContactUnlockKeys(contact).includes(String(active.ownerId || '')));
    if (hydratedOwner) return resolveCanonicalContactCard(hydratedOwner);
    if (active.ownerPreview) return resolveCanonicalContactCard(active);
    const activeScope = getRecordProfileScope(active, (
      String(active.ownerId) === String(secondaryOwnerId)
        ? 'professional'
        : (String(active.ownerId) === String(fsboOwnerId) ? 'fsbo' : 'personal')
    ));
    if (
      String(active.ownerId) === String(personalOwnerId)
      || String(active.ownerId) === String(secondaryOwnerId)
      || String(active.ownerId) === String(fsboOwnerId)
    ) {
      return resolveCanonicalContactCard(buildLocalOwnerCard(activeScope));
    }
    return null;
  }, [active, isActiveProperty, getCanonicalContact, resolveContactCard, secondaryOwnerId, fsboOwnerId, personalOwnerId, buildLocalOwnerCard, resolveCanonicalContactCard, allMatched, getContactUnlockKeys, getRecordProfileScope]);

  const handleOpenActiveCardPreview = useCallback(() => {
    if (!activeOwner && !active) return;
    setPreviewShowcaseIdx(0);
    setPreviewCardOpen(true);
  }, [active, activeOwner]);

  const ownerDesc = useMemo(() => {
    if (!activeOwner) return null;
    try {
      const svcs = allServicesSource.filter(s => String(s.ownerId) === String(activeOwner.id) && (s.publishToConnections !== false) && s.description && String(s.description).trim().length);
      if (svcs && svcs.length) return svcs.map(s => String(s.description).trim()).join(' • ');
      const firstProp = allPropertiesSource.find(p => String(p.ownerId) === String(activeOwner.id) && p.description && String(p.description).trim().length);
      if (firstProp) return firstProp.description;
      return activeOwner.desc || null;
    } catch (e) { void e; return activeOwner.desc || null; }
  }, [activeOwner, allServicesSource, allPropertiesSource]);

  const activePeerLangs = useMemo(() => {
    if (!activeOwner?.id) return DEFAULT_PEER_LANGS;
    const saved = peerLangPrefs[activeOwner.id] || {};
    return {
      input: getSafeLang(saved.input || DEFAULT_PEER_LANGS.input),
      output: getSafeLang(saved.output || DEFAULT_PEER_LANGS.output),
    };
  }, [activeOwner, peerLangPrefs]);

  const isUnlocked = useMemo(() => {
    if (!activeOwner) return false;
    if (!isActiveProperty) return isContactUnlockedByState(activeOwner);
    return isPropertyUnlockedByCanonicalState(active)
      || hasOwnerPortfolioAccessByState(active?.ownerId || activeOwner?.ownerId || activeOwner?.id);
  }, [active, activeOwner, hasOwnerPortfolioAccessByState, isActiveProperty, isContactUnlockedByState, isPropertyUnlockedByCanonicalState]);

  const activeUnlockCost = useMemo(() => {
    if (!activeOwner?.id) return 1;
    return getPortfolioUnlockCost(activeOwner, allPropertiesSource, allServicesSource);
  }, [activeOwner, allPropertiesSource, allServicesSource]);

  const activeExclusiveStatus = useMemo(() => {
    if (!active || !isActiveProperty) return null;
    return getPropertyExclusiveStatus(active);
  }, [active, getPropertyExclusiveStatus, isActiveProperty]);

  const activePropertyBlockedByOther = isActiveProperty && activeExclusiveStatus?.kind === 'blocked';

  useEffect(() => {
    if (!(unlockedContactMap instanceof Map) || unlockedContactMap.size === 0) return;
    unlockedContactMap.forEach((canonicalContact, ownerId) => {
      const contact = canonicalContact?.contact && typeof canonicalContact.contact === 'object'
        ? canonicalContact.contact
        : {};
      const hasEmail = Boolean(String(contact.email || '').trim());
      const hasPhone = Boolean(
        String(contact.phone_primary || contact.phonePrimary || contact.phone_secondary || contact.phoneSecondary || contact.whatsapp || '').trim()
      );
      if (hasEmail || hasPhone) return;
      void logEntitlementAlertOnce('warning', 'unlocked_contact_missing_data', ownerId, async () => ({
        owner_id_hash: await hashForTelemetry(ownerId),
        has_email: false,
        has_phone: false,
      }));
    });
  }, [logEntitlementAlertOnce, unlockedContactMap]);

  useEffect(() => {
    if (!active || !isActiveProperty) return;
    const ownerId = String(active.ownerId || active.owner_id || activeOwner?.ownerId || activeOwner?.id || '').trim();
    const propertyId = String(active.id || active.propertyId || active.property_id || active.portfolioId || '').trim();
    if (!ownerId || !propertyId) return;
    const ownerUnlocked = isCanonicalOwnerUnlocked(unlockedContactMap, ownerId);
    const propertyUnlocked = isCanonicalPropertyUnlocked(unlockedContactMap, ownerId, propertyId);
    if (!ownerUnlocked || propertyUnlocked || activePropertyBlockedByOther) return;
    void logEntitlementAlertOnce('error', 'property_paywall_on_unlocked_owner', `${ownerId}:${propertyId}`, async () => ({
      owner_id_hash: await hashForTelemetry(ownerId),
      property_id_hash: await hashForTelemetry(propertyId),
    }));
  }, [active, activeOwner, activePropertyBlockedByOther, isActiveProperty, logEntitlementAlertOnce, unlockedContactMap]);

  const activeOwnerExclusiveStatus = useMemo(() => {
    if (!activeOwner?.id || isActiveProperty) return null;
    const status = getOwnerExclusiveStatus(activeOwner.id);
    return status?.kind === 'owned' ? status : null;
  }, [activeOwner?.id, getOwnerExclusiveStatus, isActiveProperty]);

  const getUnlockCost = useCallback((ownerId) => {
    if (!ownerId) return 1;
    return getPortfolioUnlockCost(ownerId, allPropertiesSource, allServicesSource);
  }, [allPropertiesSource, allServicesSource]);
  
  const currentMsgs = useMemo(() => {
    if (!activeOwner || !convos) return [];
    return (Array.isArray(convos[activeOwner.id]) ? convos[activeOwner.id] : []).filter(Boolean);
  }, [activeOwner, convos]);
  const activePeerId = String(activeOwner?.id || '').trim();
  const activeChatHasMore = Boolean(activePeerId && chatHasMore?.[activePeerId]);
  const activeChatLoadingMore = Boolean(activePeerId && chatLoadingMore?.[activePeerId]);

  const portfolioItems = useMemo(() => {
    if (!activeOwner) return [];
    return allPropertiesSource.filter((p) => String(p.ownerId) === String(activeOwner.id));
  }, [activeOwner, allPropertiesSource]);

  const [portfolioTab, setPortfolioTab] = useState('properties');
  const [portfolioShowAll, setPortfolioShowAll] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 767);
  const [isTabletPortrait, setIsTabletPortrait] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(min-width: 768px) and (max-width: 1080px) and (orientation: portrait)').matches
  ));
  const [mobileTab, setMobileTab] = useState('connections');
  const [mobileChatTab, setMobileChatTab] = useState('chat');
  const [mobileCardSheet, setMobileCardSheet] = useState(null);

  useEffect(() => {
    if (!initialChat) return;
    const timer = window.setTimeout(() => setActive(initialChat), 0);
    return () => window.clearTimeout(timer);
  }, [initialChat, chatFocusToken]);

  const serviceItems = useMemo(() => {
    if (!activeOwner) return [];
    return allServicesSource.filter((s) => String(s.ownerId) === String(activeOwner.id));
  }, [activeOwner, allServicesSource]);

  const _previewShowcaseItems = useMemo(() => [
    ...portfolioItems.map(p => ({ ...p, _itemType: 'property' })),
    ...serviceItems.map(s => ({ ...s, _itemType: 'service' })),
  ], [portfolioItems, serviceItems]);
  void _previewShowcaseItems;

  const propertiesCount = portfolioItems.length;
  const servicesCount = serviceItems.length;
  const _portfolioColumns = useMemo(() => {
    const contentWidth = Math.max(0, portfolioWidth - PORTFOLIO_PANEL_PADDING);
    const rawColumns = Math.floor((contentWidth + PORTFOLIO_GRID_GAP) / (PORTFOLIO_CARD_MIN_WIDTH + PORTFOLIO_GRID_GAP));
    return Math.max(3, Math.min(5, rawColumns));
  }, [PORTFOLIO_CARD_MIN_WIDTH, PORTFOLIO_GRID_GAP, PORTFOLIO_PANEL_PADDING, portfolioWidth]);
  void _portfolioColumns;

  useEffect(() => {
    // Clear selected item when active owner changes; defer to avoid
    // synchronous setState-inside-effect warnings.
    const t = setTimeout(() => setSelectedPortfolioItem(null), 0);
    return () => clearTimeout(t);
  }, [activeOwner?.id]);

  useEffect(() => {
    const syncDesktopPortfolioWidth = () => {
      if (window.innerWidth <= 767) return;
      const rect = splitPaneRef.current?.getBoundingClientRect();
      const availableWidth = rect?.width || window.innerWidth;
      const hardMax = Math.max(0, Math.min(DESKTOP_PORTFOLIO_MAX_WIDTH, availableWidth - DESKTOP_CHAT_MIN_WIDTH - 4));
      const effectiveMin = Math.min(DESKTOP_PORTFOLIO_MIN_WIDTH, hardMax);
      setPortfolioWidth((prev) => {
        if (!Number.isFinite(prev)) return Math.max(effectiveMin, Math.min(DESKTOP_PORTFOLIO_WIDTH, hardMax));
        return Math.max(effectiveMin, Math.min(prev, hardMax));
      });
    };

    syncDesktopPortfolioWidth();
    window.addEventListener('resize', syncDesktopPortfolioWidth);
    return () => window.removeEventListener('resize', syncDesktopPortfolioWidth);
  }, [DESKTOP_CHAT_MIN_WIDTH, DESKTOP_PORTFOLIO_MAX_WIDTH, DESKTOP_PORTFOLIO_MIN_WIDTH, DESKTOP_PORTFOLIO_WIDTH]);

  useEffect(() => {
    localStorage.setItem('chatMainTextSize', String(chatMainTextSize));
  }, [chatMainTextSize]);

  useEffect(() => {
    localStorage.setItem('chatSeenIncomingByContact', JSON.stringify(seenIncomingByContact));
  }, [seenIncomingByContact]);

  useEffect(() => {
    if (!readReceiptsEnabled) return;
    if (!activeContactId) return;
    const currentIncoming = Array.isArray(convos?.[activeContactId])
      ? convos[activeContactId].filter((message) => message?.from !== 'me').length
      : 0;
    const timer = window.setTimeout(() => {
      setSeenIncomingByContact((prev) => {
        if ((prev[activeContactId] || 0) >= currentIncoming) return prev;
        return {
          ...prev,
          [activeContactId]: currentIncoming,
        };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeContactId, convos, readReceiptsEnabled]);

  // Reset portfolio show-all when active contact changes
  useEffect(() => {
    const timer = window.setTimeout(() => setPortfolioShowAll(false), 0);
    return () => window.clearTimeout(timer);
  }, [activeOwner?.id]);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 767);
      setIsTabletPortrait(window.matchMedia('(min-width: 768px) and (max-width: 1080px) and (orientation: portrait)').matches);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const loadState = chatHistoryLoadRef.current;
    if (loadState.peerId && loadState.peerId === activePeerId) {
      const delta = el.scrollHeight - loadState.beforeHeight;
      el.scrollTop = Math.max(0, loadState.beforeTop + delta);
      chatHistoryLoadRef.current = { peerId: '', beforeHeight: 0, beforeTop: 0 };
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [activePeerId, currentMsgs.length, isTyping]);

  useEffect(() => {
    if (activePeerId && typeof onMarkChatRead === 'function') {
      onMarkChatRead(activePeerId);
    }
  }, [activePeerId, currentMsgs.length, onMarkChatRead]);

  useEffect(() => {
    if (!activePeerId || currentMsgs.length > 0 || activeChatLoadingMore) return;
    if (typeof onLoadMoreChatMessages !== 'function') return;
    if (chatInitialLoadRequestedRef.current.has(activePeerId)) return;
    chatInitialLoadRequestedRef.current.add(activePeerId);
    onLoadMoreChatMessages(activePeerId);
  }, [activeChatLoadingMore, activePeerId, currentMsgs.length, onLoadMoreChatMessages]);

  const handleChatScroll = useCallback(async (event) => {
    const el = event.currentTarget;
    if (!activePeerId || !activeChatHasMore || activeChatLoadingMore || el.scrollTop > 24) return;
    if (typeof onLoadMoreChatMessages !== 'function') return;
    chatHistoryLoadRef.current = {
      peerId: activePeerId,
      beforeHeight: el.scrollHeight,
      beforeTop: el.scrollTop,
    };
    await onLoadMoreChatMessages(activePeerId);
  }, [activeChatHasMore, activeChatLoadingMore, activePeerId, onLoadMoreChatMessages]);

  const resizeComposerInput = useCallback(() => {
    const el = msgInputRef.current;
    if (!el) return;
    const minHeight = isMobile ? 42 : 34;
    const maxHeight = isMobile ? 136 : 112;
    el.style.height = 'auto';
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, el.scrollHeight));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [isMobile]);

  useEffect(() => {
    resizeComposerInput();
  }, [msg, isMobile, resizeComposerInput]);

  const writeChatSystemNotice = useCallback((owner, messageCode, reason = 'chat_unavailable', options = {}) => {
    const oid = String(owner?.id || owner?.ownerId || owner?.unlockOwnerId || '').trim();
    const messageParams = options.messageParams && typeof options.messageParams === 'object' ? options.messageParams : {};
    const fallbackText = getChatSystemTextByCode(messageCode, myInputLang, messageParams);
    if (!oid || !messageCode || !fallbackText) return;
    if (typeof onSendChatMessage === 'function') {
      onSendChatMessage({
        recipientId: oid,
        contactOwnerId: oid,
        text: fallbackText,
        type: 'system',
        originalText: fallbackText,
        originalLang: myInputLang,
        translatedLang: myInputLang,
        messageCode,
        messageParams,
        contactPrimaryProfile: owner?.primaryProfile || '',
        senderPreview: currentUserChatPreview,
        suppressLocal: options.hideForSender === true,
        metadata: {
          reason,
          hideForSender: options.hideForSender === true,
          hideForRecipient: options.hideForRecipient === true,
          systemAlert: options.systemAlert === true,
          systemAudience: options.systemAudience || 'recipient',
          messageCode,
          messageParams,
        },
      });
      return;
    }
    setConvos((prev) => ({
      ...(prev || {}),
      [oid]: [
        ...((prev || {})[oid] || []),
        {
          from: 'me',
          text: fallbackText,
          type: 'system',
          originalText: fallbackText,
          originalLang: myInputLang,
          translatedText: fallbackText,
          translatedLang: myInputLang,
          senderPreview: currentUserChatPreview,
          metadata: {
            reason,
            hideForSender: options.hideForSender === true,
            hideForRecipient: options.hideForRecipient === true,
            systemAlert: options.systemAlert === true,
            systemAudience: options.systemAudience || 'local',
            messageCode,
            messageParams,
          },
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  }, [currentUserChatPreview, myInputLang, onSendChatMessage, setConvos]);

  const getActiveChatAccessStatus = useCallback(async () => {
    if (!activeOwner) return { canChat: false, reason: 'missing_contact' };
    if (!canUseChat) return { canChat: false, reason: 'sender_plan' };

    const ownerId = String(activeOwner.id || activeOwner.ownerId || activeOwner.unlockOwnerId || '').trim();
    if (isSupabaseConfigured && supabase && UUID_RE.test(ownerId)) {
      const { data, error } = await supabase.rpc('ds_get_chat_contact_status', {
        p_contact_owner_id: ownerId,
        p_primary_profile: activeOwner.primaryProfile || null,
      });
      if (error) throw error;
      const status = data && typeof data === 'object' ? data : {};
      if (status.canChat === false) {
        return {
          canChat: false,
          reason: status.acceptsChat === false
            ? 'contact_method'
            : (status.senderCanChat === false ? 'sender_plan' : 'recipient_plan'),
          ...status,
        };
      }
      return { canChat: true, reason: null, ...status };
    }

    const localAcceptsChat = contactAllowsDealSifterChat(activeOwner);
    if (!localAcceptsChat) {
      return { canChat: false, reason: 'contact_method', acceptsChat: false };
    }

    return { canChat: true, reason: null };
  }, [activeOwner, canUseChat]);

  const blockChatForActiveContact = useCallback((reason) => {
    const isRecipientPlan = reason === 'recipient_plan';
    const titleKey = isRecipientPlan ? 'chatSystemRecipientPlanTitle' : 'chatSystemContactMethodTitle';
    const toastKey = isRecipientPlan ? 'chatSystemRecipientPlanToast' : 'chatSystemContactMethodToast';
    const recipientMessageCode = isRecipientPlan ? 'recipient_plan_recipient' : 'contact_method_recipient';
    const senderMessageCode = isRecipientPlan ? 'recipient_plan_sender' : 'contact_method_sender';
    const title = t[titleKey] || getMatchesTranslation(myOutputLang, titleKey);
    const message = t[toastKey] || getMatchesTranslation(myOutputLang, toastKey);
    addToast?.({ type: 'warning', title, message, duration: 7000 });
    writeChatSystemNotice(activeOwner, recipientMessageCode, reason, {
      hideForSender: true,
      systemAlert: true,
      systemAudience: isRecipientPlan ? 'recipient_plan_upgrade' : 'recipient_contact_method',
    });
    writeChatSystemNotice(activeOwner, senderMessageCode, reason, {
      hideForRecipient: true,
      systemAlert: true,
      systemAudience: isRecipientPlan ? 'sender_recipient_plan' : 'sender_contact_method',
    });
  }, [activeOwner, addToast, myOutputLang, t, writeChatSystemNotice]);

  const handleSend = useCallback(async (customMsg, type = "text", refData = null) => {
    if (!activeOwner) return;
    if (!canUseChat) {
      blockFeature('chat');
      return;
    }
    const content = (typeof customMsg === 'string' ? customMsg : "") || msg;
    if (!content.trim() && !refData) return;

    try {
      const chatStatus = await getActiveChatAccessStatus();
      if (!chatStatus.canChat) {
        blockChatForActiveContact(chatStatus.reason);
        return;
      }
    } catch (error) {
      addToast?.({
        type: 'error',
        title: t.chatUnavailableTitle || getMatchesTranslation(myOutputLang, 'chatUnavailableTitle'),
        message: String(error?.message || t.chatValidateError || getMatchesTranslation(myOutputLang, 'chatValidateError')),
        duration: 6500,
      });
      return;
    }

    const oid = activeOwner.id;
    const sourceLang = getSafeLang(myInputLang);
    const toPeerLang = getSafeLang(activePeerLangs.output);
    const toMyReadLang = getSafeLang(myOutputLang);
    const peerInputLang = getSafeLang(activePeerLangs.input);

    let outgoingText = content;
    let outgoingMeta = null;

    if (type === 'text') {
      const translated = await translateChatText({
        text: content,
        fromLang: sourceLang,
        toLang: toPeerLang,
      });
      outgoingText = translated.text;
      outgoingMeta = translated;
    }

    if (typeof onSendChatMessage === 'function') {
      onSendChatMessage({
        recipientId: oid,
        contactOwnerId: oid,
        text: outgoingText,
        type,
        refData,
        originalText: content,
        originalLang: sourceLang,
        translatedLang: type === 'text' ? toPeerLang : sourceLang,
        contactPrimaryProfile: activeOwner.primaryProfile || '',
        senderPreview: currentUserChatPreview,
      });
    } else {
      setConvos(prev => ({
        ...prev,
        [oid]: [
          ...(prev[oid] || []),
          {
            from: "me",
            text: outgoingText,
            type,
            refData,
            originalText: content,
            originalLang: sourceLang,
            translatedText: outgoingText,
            translatedLang: type === 'text' ? toPeerLang : sourceLang,
            translationProvider: outgoingMeta?.provider || 'none',
          },
        ],
      }));
    }

    if (typeof customMsg !== 'string') setMsg("");

    if (typeof onSendChatMessage === 'function') return;

    setTimeout(() => {
      setIsTyping(true);
      setTimeout(async () => {
        setIsTyping(false);
        const replies = CHAT_REPLY_TEMPLATES[peerInputLang] || CHAT_REPLY_TEMPLATES.en;
        const randomReply = replies[Math.floor(Math.random() * replies.length)];
        const peerRawText = type === 'reference'
          ? `${CHAT_INTEREST_PREFIX[peerInputLang] || CHAT_INTEREST_PREFIX.en}: ${refData.address || refData.name || refData.title || ''}.`
          : randomReply;

        const translatedIncoming = await translateChatText({
          text: peerRawText,
          fromLang: peerInputLang,
          toLang: toMyReadLang,
        });

        setConvos(p => ({
          ...p,
          [oid]: [
            ...(p[oid] || []),
            {
              from: "them",
              text: translatedIncoming.text,
              type: 'text',
              originalText: peerRawText,
              originalLang: peerInputLang,
              translatedText: translatedIncoming.text,
              translatedLang: toMyReadLang,
              translationProvider: translatedIncoming.provider,
            },
          ],
        }));
      }, 1500);
    }, 800);
  }, [
    msg,
    activeOwner,
    setConvos,
    myInputLang,
    myOutputLang,
    activePeerLangs,
    canUseChat,
    blockFeature,
    getActiveChatAccessStatus,
    blockChatForActiveContact,
    addToast,
    t,
    currentUserChatPreview,
    onSendChatMessage,
  ]);

  const mobileBottomNavOffset = isMobile ? (mobileBottomNavCollapsed ? 4 : 88) : 0;
  const tabletBottomNavOffset = isTabletPortrait ? (mobileBottomNavCollapsed ? 4 : 88) : 0;
  const bottomNavOffset = Math.max(mobileBottomNavOffset, tabletBottomNavOffset);
  const previewFeedCardWidth = isMobile ? 340 : 654;
  const previewFeedCardHeight = isMobile ? 576 : 400;
  const previewModalMaxWidth = isMobile ? 420 : 730;

  return (
    <div style={{ paddingTop:58, paddingBottom:bottomNavOffset, height:"calc(var(--app-vh, 1vh) * 100)", boxSizing:"border-box", display:"flex", flexDirection:"column", background:C.bg }}>
      <style>{`
        .map-panel-tabs { display: flex; gap: 4px; margin-bottom: 12px; padding-bottom: 2px; border-bottom: 1px solid var(--ui-border); }
        .map-panel-tab { flex: none; white-space: nowrap; padding: 8px 14px 7px; border-top-left-radius: 10px; border-top-right-radius: 10px; border-bottom-left-radius: 0; border-bottom-right-radius: 0; border: 1px solid transparent; border-bottom: 1px solid transparent; background: var(--ui-hover); color: ${C.t2}; font-size: 12px; font-weight: 600; cursor: pointer; margin-bottom: -3px; transition: all .15s ease; }
        .map-panel-tab.active { border-color: var(--ui-border); border-bottom-color: var(--ui-surface); background: var(--ui-surface); color: ${C.t1}; box-shadow: inset 0 2px 0 var(--ui-active); }
        .map-panel-tab:hover { color: ${C.t1}; background: var(--ui-hover); }
        .matches-mobile-tabbar { display: none; }
        .matches-chat-mobile-tabs { display: none; }
        @keyframes ds-warning-triangle-pulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 0 rgba(245, 158, 11, 0)); }
          50% { transform: scale(1.08); filter: drop-shadow(0 0 12px rgba(245, 158, 11, .65)); }
        }
        .ds-warning-triangle {
          position: relative;
          width: 38px;
          height: 34px;
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          color: #0f172a;
          font-size: 16px;
          font-weight: 1000;
          line-height: 1;
          padding-bottom: 4px;
          flex: 0 0 auto;
          animation: ds-warning-triangle-pulse 1.05s ease-in-out infinite;
        }
        .ds-warning-triangle::before {
          content: "";
          position: absolute;
          inset: 0;
          background: #f5b21d;
          clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
          z-index: -1;
        }
        @media (max-width: 767px) {
          .matches-sidebar { width: ${active ? '0px' : '100%'} !important; flex-shrink: 0 !important; }
          .matches-mobile-tabbar { display: flex !important; }
          .matches-col-people { display: ${mobileTab === 'connections' ? 'flex' : 'none'} !important; }
          .matches-col-interests { display: ${mobileTab === 'interests' ? 'flex' : 'none'} !important; }
          .matches-chat-mobile-tabs { display: flex !important; }
          .matches-chat-col { display: ${mobileChatTab === 'chat' ? 'flex' : 'none'} !important; }
          .matches-portfolio-col { display: ${mobileChatTab === 'portfolio' ? 'block' : 'none'} !important; width: 100% !important; max-width: 100% !important; overflow-y: auto !important; }
          .matches-resize-handle { display: none !important; }
          .matches-lang-row { display: none !important; }
        }
        @media (min-width: 768px) and (max-width: 1080px) and (orientation: portrait) {
          .matches-sidebar {
            width: 50% !important;
            flex-shrink: 0 !important;
          }
          .matches-sidebar > div:last-child {
            min-height: 0 !important;
          }
          .matches-detail-split {
            flex-direction: column !important;
            min-width: 0 !important;
            min-height: 0 !important;
          }
          .matches-portfolio-col {
            order: 1 !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            flex: 0 0 var(--matches-portfolio-pane, 64%) !important;
            min-height: 0 !important;
            padding: 12px !important;
            border-bottom: 1px solid ${C.border} !important;
            box-sizing: border-box !important;
          }
          .matches-portfolio-col .map-panel-tabs {
            margin-bottom: 8px !important;
            overflow-x: auto !important;
          }
          .matches-resize-handle {
            order: 2 !important;
            display: block !important;
            width: 100% !important;
            height: 7px !important;
            min-height: 7px !important;
            cursor: row-resize !important;
            flex: 0 0 7px !important;
            touch-action: none !important;
          }
          .matches-chat-col {
            order: 3 !important;
            flex: 1 1 var(--matches-chat-pane, 36%) !important;
            min-height: 0 !important;
            border-right: none !important;
          }
          .matches-chat-tools {
            transform: scale(0.92);
            transform-origin: top left;
          }
          .matches-chat-scroll {
            padding-top: 46px !important;
          }
        }
        @media (max-width: 767px) {
          .matches-chat-tools {
            position: static !important;
            margin: 8px 12px 0 !important;
            width: max-content !important;
            max-width: calc(100% - 24px) !important;
            transform: none !important;
          }
          .matches-chat-scroll {
            padding-top: 12px !important;
          }
        }
      `}</style>
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        
        <div style={{ width:520, flexShrink:0, borderRight:`1px solid ${C.border}`, background:C.card, display:"flex", flexDirection:"column" }} className="matches-sidebar">
          
          <div style={{ padding:16, borderBottom:`1px solid ${C.border}` }}>
            <h2 style={{ fontWeight:800, fontSize:16, display:"flex", alignItems:"center", gap:8 }}>
              <Icon name="chat" size={16} color={C.accent} /> {t.allMatches}
              {unlockNotificationCount > 0 ? (
                <button
                  type="button"
                  onClick={markUnlockNotificationsRead}
                  title={t.unlockRealtimeMarkRead || 'Mark unlock notifications as read'}
                  style={{
                    minWidth: 20,
                    height: 20,
                    padding: '0 6px',
                    borderRadius: 999,
                    border: `1px solid ${C.alpha(C.accent, 0.48)}`,
                    background: C.alpha(C.accent, 0.16),
                    color: C.accent,
                    fontSize: 10,
                    fontWeight: 900,
                    lineHeight: 1,
                    cursor: 'pointer',
                    boxShadow: `0 0 12px ${C.alpha(C.accent, 0.22)}`,
                  }}
                >
                  {unlockNotificationCount > 99 ? '99+' : unlockNotificationCount}
                </button>
              ) : null}
            </h2>
          </div>

          {isMobile && (
            <div className="matches-mobile-tabbar" style={{ borderBottom:`1px solid ${C.border}`, background:C.card, flexShrink:0 }}>
              <button
                type="button"
                onClick={() => setMobileTab('connections')}
                style={{ flex:1, padding:'10px 4px', border:'none', borderBottom:`2px solid ${mobileTab==='connections' ? C.accent : 'transparent'}`, background:'transparent', color:mobileTab==='connections' ? C.accent : C.t2, fontWeight:700, fontSize:12, cursor:'pointer', transition:'all .15s' }}
              >
                {t.people} ({filteredMatched.length})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('interests')}
                style={{ flex:1, padding:'10px 4px', border:'none', borderBottom:`2px solid ${mobileTab==='interests' ? PROPERTY_SIGNAL : 'transparent'}`, background:'transparent', color:mobileTab==='interests' ? PROPERTY_SIGNAL : C.t2, fontWeight:700, fontSize:12, cursor:'pointer', transition:'all .15s' }}
              >
                {t.interests} ({filteredInterested.length})
              </button>
            </div>
          )}
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
            <div style={{ flex:1, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column" }} className="matches-col-people">
              <div style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:C.t3, background:C.alpha(C.bg, 0.4), textTransform:"uppercase", display:"flex", flexDirection:"column", alignItems:"stretch", gap:6 }}>
                <span style={{ color:C.t1 }}>{t.people} ({filteredMatched.length})</span>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {[
                    { id:"all", label:t.all },
                    { id:"paid", label:t.paid },
                    { id:"locked", label:cardsT.locked },
                    { id:"archived", label:t.archived || 'Archived' },
                  ].map(f => (
                    <button key={f.id} onClick={(e) => { e.stopPropagation(); setPeopleFilter(f.id); }} style={{ border:`1px solid ${peopleFilter===f.id ? C.alpha(CONTACT_SIGNAL, 0.35) : C.border}`, background:peopleFilter===f.id ? C.alpha(CONTACT_SIGNAL, 0.12) : "transparent", color:peopleFilter===f.id ? CONTACT_SIGNAL : C.t3, borderRadius:999, padding:"1px 6px", fontSize:9, lineHeight:1.3, cursor:"pointer" }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding:'6px 10px', borderBottom:`1px solid ${C.border}`, position:'relative' }}>
                <button
                  onClick={() => setPeopleCategoryDropdownOpen((v) => !v)}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', border:`1px solid ${C.border}`, background:C.alpha(C.bg, 0.35), color:C.t2, borderRadius:8, padding:'6px 8px', fontSize:10, fontWeight:700, cursor:'pointer' }}
                >
                  <span>{selectedPeopleCategories.length ? `${selectedPeopleCategories.length} ${t.selected || 'selected'}` : (t.categoryFilterAll || 'All categories')}</span>
                  <Icon name={peopleCategoryDropdownOpen ? 'chevUp' : 'chevDown'} size={10} color={C.t1} strokeWidth={2.3} />
                </button>
                {peopleCategoryDropdownOpen ? (
                  <div style={{ position:'absolute', top:'calc(100% + 6px)', left:10, right:10, maxHeight:170, overflowY:'auto', zIndex:40, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:6, boxShadow:'0 12px 24px rgba(0,0,0,0.16)' }}>
                    <button
                      onClick={() => setSelectedPeopleCategories([])}
                      style={{ width:'100%', textAlign:'left', border:'none', background:'transparent', color:C.t2, fontSize:10, padding:'6px 8px', cursor:'pointer' }}
                    >
                      {t.categoryFilterAll || 'All categories'}
                    </button>
                    {peopleCategoryOptions.map((opt) => {
                      const checked = selectedPeopleCategories.includes(opt.id);
                      return (
                        <label key={opt.id} style={{ display:'flex', alignItems:'center', gap:8, color:C.t2, fontSize:10, padding:'6px 8px', cursor:'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedPeopleCategories((prev) => checked ? prev.filter((v) => v !== opt.id) : [...prev, opt.id])}
                          />
                          <span>{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div style={{ flex:1, overflowY:"auto" }}>
                <MatchesPeopleList contacts={filteredMatched} activeOwnerId={activeContactKey} renderContact={(m) => {
                  const contactKeys = getContactUnlockKeys(m);
                  const contactRowKey = contactKeys[0] || String(m?.id || '');
                  const isLinkedContact = Boolean(activeContactKey && contactKeys.includes(activeContactKey));
                  const rowContactUnlocked = isContactUnlockedByState(m);
                  const contactUnlockCost = getUnlockCost(m.id);
                  const contactIncomingCount = Array.isArray(convos?.[m.id])
                    ? convos[m.id].filter((message) => message?.from !== 'me').length
                    : 0;
                  const ownerExclusiveStatus = getOwnerExclusiveStatus(m.ownerId || m.unlockOwnerId || m.id);
                  const showOwnedOwnerExclusiveStatus = ownerExclusiveStatus?.kind === 'owned' ? ownerExclusiveStatus : null;
                  const seenIncomingCount = seenIncomingByContact[m.id] || 0;
                  const contactUnreadCount = Math.max(0, contactIncomingCount - seenIncomingCount);
                  const isArchivedRow = contactKeys.some((key) => archivedContacts.has(key));
                  return (
                    <div key={contactRowKey} onClick={() => setActive(m)} style={{ display:"flex", alignItems:"center", gap:10, padding:12, borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:isLinkedContact?C.alpha(CONTACT_SIGNAL, 0.12):"transparent" }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", overflow:"hidden", border:`1px solid ${isLinkedContact?CONTACT_SIGNAL:C.border}` }}>
                        <SmartImage src={m.photo} alt={m.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%" }}><Icon name={catIcon(m.cat)} size={14} color={C.accent} /></div>} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:12, color:isLinkedContact?CONTACT_SIGNAL:C.t1, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap" }}>{m.name}</div>
                        <div style={{ fontSize:10, color:C.t3, display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ color:rowContactUnlocked ? C.success : C.gold, fontWeight:700 }}>{rowContactUnlocked ? cardsT.unlocked : `${cardsT.locked} · ${contactUnlockCost}★`}</span>
                          <span>{m.type}</span>
                          {rowContactUnlocked && contactUnreadCount > 0 ? (
                            <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:16, height:16, padding:'0 4px', borderRadius:999, background:C.alpha(C.danger, 0.2), border:`1px solid ${C.alpha(C.danger, 0.55)}`, color:C.danger, fontSize:9, fontWeight:800 }}>
                              {contactUnreadCount > 99 ? '99+' : contactUnreadCount}
                            </span>
                          ) : null}
                          {m.primaryProfile === 'professional' ? (
                            <span style={{ padding:"1px 6px", borderRadius:999, background:C.alpha(C.accent, 0.12), border:`1px solid ${C.alpha(C.accent, 0.25)}`, color:C.accent, fontSize:9, fontWeight:800 }}>
                              {t.professionalBadge || 'Business'}
                            </span>
                          ) : null}
                          {showOwnedOwnerExclusiveStatus?.expiresAt ? (
                            <CardStatusIcon type={CARD_STATUS.exclusive} size={20} iconSize={12} />
                          ) : null}
                        </div>
                      </div>
                      {peopleFilter === 'archived' ? (
                        <button
                          type="button"
                          title={t.restore || 'Restore'}
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); restoreContact(m); }}
                          onClick={(e) => { e.stopPropagation(); restoreContact(m); }}
                          style={{ width:18, height:18, display:'inline-flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.alpha(C.success, 0.35)}`, borderRadius:999, background:C.alpha(C.success, 0.1), padding:0, cursor:'pointer', flexShrink:0 }}
                        >
                          <Icon name="rotateCw" size={10} color={C.success} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isArchivedRow || peopleFilter === 'archived') deleteContactFromMatches(m);
                          else archiveContact(m);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isArchivedRow || peopleFilter === 'archived') deleteContactFromMatches(m);
                          else archiveContact(m);
                        }}
                        style={{
                          width: 16,
                          height: 16,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          opacity: 0.8,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'opacity .15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                      >
                        <Icon name="close" size={10} color={C.t1} />
                      </button>
                    </div>
                  );
                }} />
              </div>
            </div>
            <div style={{ flex:1, display:"flex", flexDirection:"column" }} className="matches-col-interests">
              <div style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:C.gold, background:C.alpha(C.bg, 0.4), textTransform:"uppercase", display:"flex", flexDirection:"column", alignItems:"stretch", gap:6 }}>
                <span style={{ color:C.t1 }}>{t.interests} ({filteredInterested.length})</span>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                  {[
                    { id:"all", label:t.all },
                    { id:"paid", label:t.paid },
                    { id:"locked", label:cardsT.locked },
                    { id:"archived", label:t.archived || 'Archived' },
                  ].map(f => (
                    <button key={f.id} onClick={(e) => { e.stopPropagation(); setInterestsFilter(f.id); }} style={{ border:`1px solid ${interestsFilter===f.id ? C.alpha(PROPERTY_SIGNAL, 0.35) : C.border}`, background:interestsFilter===f.id ? C.alpha(PROPERTY_SIGNAL, 0.14) : "transparent", color:interestsFilter===f.id ? PROPERTY_SIGNAL : C.t3, borderRadius:999, padding:"1px 6px", fontSize:9, lineHeight:1.3, cursor:"pointer" }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding:'6px 10px', borderBottom:`1px solid ${C.border}`, position:'relative' }}>
                <button
                  onClick={() => setInterestsStateDropdownOpen((v) => !v)}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', border:`1px solid ${C.border}`, background:C.alpha(C.bg, 0.35), color:C.t2, borderRadius:8, padding:'6px 8px', fontSize:10, fontWeight:700, cursor:'pointer' }}
                >
                  <span>{selectedInterestStates.length ? `${selectedInterestStates.length} ${t.selected || 'selected'}` : (t.stateFilterAll || 'All states')}</span>
                  <Icon name={interestsStateDropdownOpen ? 'chevUp' : 'chevDown'} size={10} color={C.t1} strokeWidth={2.3} />
                </button>
                {interestsStateDropdownOpen ? (
                  <div style={{ position:'absolute', top:'calc(100% + 6px)', left:10, right:10, maxHeight:170, overflowY:'auto', zIndex:40, background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:6, boxShadow:'0 12px 24px rgba(0,0,0,0.16)' }}>
                    <button
                      onClick={() => setSelectedInterestStates([])}
                      style={{ width:'100%', textAlign:'left', border:'none', background:'transparent', color:C.t2, fontSize:10, padding:'6px 8px', cursor:'pointer' }}
                    >
                      {t.stateFilterAll || 'All states'}
                    </button>
                    {interestStateOptions.map((state) => {
                      const checked = selectedInterestStates.includes(state);
                      return (
                        <label key={state} style={{ display:'flex', alignItems:'center', gap:8, color:C.t2, fontSize:10, padding:'6px 8px', cursor:'pointer' }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setSelectedInterestStates((prev) => checked ? prev.filter((v) => v !== state) : [...prev, state])}
                          />
                          <span>{state}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div style={{ flex:1, overflowY:"auto" }}>
                <MatchesInterestsList interests={filteredInterested} activePropertyId={active?.id || ''} renderInterest={(p) => {
                  const propertyKey = getInterestKey(p);
                  const canonicalLinkedProperty = (allPropertiesSource || []).find((property) => (
                    getInterestKey(property) === propertyKey
                    && isLinkedToActiveContact(property?.ownerId)
                  ));
                  const linkedOwnerId = canonicalLinkedProperty?.ownerId || p.ownerId;
                  const isLinkedProperty = isLinkedToActiveContact(p.ownerId) || Boolean(canonicalLinkedProperty);
                  const effectiveOwner = isLinkedProperty && activeOwner ? activeOwner : null;
                  const effectiveProperty = effectiveOwner
                    ? { ...p, ...(canonicalLinkedProperty || {}), ownerId: effectiveOwner.id }
                    : p;
                  const canonicalPropertyUnlocked = isPropertyUnlockedByCanonicalState(effectiveProperty);
                  const isPropertyEntitled = canonicalPropertyUnlocked || hasOwnerPortfolioAccessByState(linkedOwnerId);
                  const ownerUnlockCost = getUnlockCost(linkedOwnerId);
                  const propertyExclusiveStatus = getPropertyExclusiveStatus(p);
                  const isArchivedInterestRow = archivedInterests.has(getInterestKey(p));
                  const owner = effectiveOwner
                    || canonicalContactToDisplayCard(getCanonicalContact(linkedOwnerId))
                    || { id: linkedOwnerId, ownerId: linkedOwnerId, name: 'Locked contact' };
                  return (
                    <div key={p.id} onClick={() => setActive(effectiveProperty)} style={{ display:"flex", alignItems:"center", gap:10, padding:12, borderBottom:`1px solid ${C.border}`, borderLeft:isLinkedProperty?`3px solid ${C.alpha(PROPERTY_SIGNAL, 0.7)}`:'3px solid transparent', cursor:"pointer", background:isLinkedProperty?C.alpha(PROPERTY_SIGNAL, 0.14):"transparent" }}>
                      <div style={{ width:32, height:32, borderRadius:6, overflow:"hidden", border:`1px solid ${isLinkedProperty?PROPERTY_SIGNAL:C.border}` }}>
                        <SmartImage src={p.images?.[0] || p.image} alt={p.address} style={{ width:"100%", height:"100%", objectFit:"cover" }} fallback={<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:C.alpha(C.t1, 0.05) }}><Icon name="home" size={14} color={C.t3} /></div>} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:11, color:isLinkedProperty?PROPERTY_SIGNAL:C.t1, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap" }}>{p.address}</div>
                          {propertyExclusiveStatus?.expiresAt ? (
                            <CardStatusIcon type={CARD_STATUS.exclusive} size={20} iconSize={12} />
                          ) : null}
                        </div>
                        <div style={{ fontSize:9, color:C.gold }}>${(p.price/1000).toFixed(0)}K</div>
                        <div style={{ fontSize:10, color:C.t3, display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          <span style={{ color:isPropertyEntitled ? C.success : C.gold, fontWeight:700 }}>{isPropertyEntitled ? cardsT.unlocked : `${cardsT.locked} · ${ownerUnlockCost}★`}</span>
                          <span>{t.by} {owner?.name || "..."}</span>
                        </div>
                      </div>
                      {interestsFilter === 'archived' ? (
                        <button
                          type="button"
                          title={t.restore || 'Restore'}
                          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); restoreInterest(p); }}
                          onClick={(e) => { e.stopPropagation(); restoreInterest(p); }}
                          style={{ width:18, height:18, display:'inline-flex', alignItems:'center', justifyContent:'center', border:`1px solid ${C.alpha(C.success, 0.35)}`, borderRadius:999, background:C.alpha(C.success, 0.1), padding:0, cursor:'pointer', flexShrink:0 }}
                        >
                          <Icon name="rotateCw" size={10} color={C.success} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isArchivedInterestRow || interestsFilter === 'archived') deleteInterestFromMatches(p);
                          else archiveInterest(p);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isArchivedInterestRow || interestsFilter === 'archived') deleteInterestFromMatches(p);
                          else archiveInterest(p);
                        }}
                        style={{
                          width: 16,
                          height: 16,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          opacity: 0.8,
                          cursor: 'pointer',
                          flexShrink: 0,
                          transition: 'opacity .15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                      >
                        <Icon name="close" size={10} color={C.t1} />
                      </button>
                    </div>
                  );
                }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {!active ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:C.t3, gap:12 }}>
              <Icon name="chat" size={48} color={C.t3} strokeWidth={1} />
              <div>{t.selectConversation}</div>
            </div>
          ) : activePropertyBlockedByOther ? (
            <ExclusiveBlockedBadge
              status={activeExclusiveStatus}
              onUnlockOwner={!isContactUnlockedByState(activeOwner) ? () => openUnlock(activeOwner, {}) : null}
            />
          ) : !isUnlocked ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding: isMobile ? '54px 22px 30px' : 40, textAlign:"center", position:'relative' }}>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  style={{
                    position:'absolute',
                    top:12,
                    right:12,
                    display:'inline-flex',
                    alignItems:'center',
                    gap:6,
                    padding:'8px 10px',
                    borderRadius:999,
                    border:`1px solid ${C.border}`,
                    background:C.card,
                    color:C.t2,
                    fontSize:11,
                    fontWeight:800,
                    cursor:'pointer',
                    boxShadow:'0 8px 18px rgba(0,0,0,.12)',
                  }}
                >
                  <Icon name="back" size={12} color={C.t2} />
                  {t.backToMatches || 'Back to Matches'}
                </button>
              ) : null}
              <Icon name="lock" size={64} color={C.success} secondaryColor={C.gold} style={{ marginBottom:20 }} />
              <h3 style={{ fontSize:22, fontWeight:800, marginBottom:10 }}>{t.chatLocked}</h3>
              <p style={{ color:C.t3, maxWidth:360, marginBottom:30 }}>
                {formatTemplate(t.unlockCostInfo, {
                  count: activeUnlockCost,
                  unit: activeUnlockCost === 1 ? modalsT.nuggetOne : modalsT.nuggetOther,
                })}
              </p>
              {nuggets >= activeUnlockCost ? (
                <button type="button" onClick={() => openUnlock(activeOwner, isActiveProperty ? { unlockScope: 'property', property: active, propertyId: active.id, propertyAddress: active.address } : {})} style={{ padding:"16px 32px", borderRadius:12, background:C.gold, color:C.bg, fontWeight:800, border:"none", cursor:"pointer" }}>
                  {formatTemplate(t.unlockCta, {
                    count: activeUnlockCost,
                    unit: activeUnlockCost === 1 ? modalsT.nuggetOne : modalsT.nuggetOther,
                  })}
                </button>
              ) : (
                <button type="button" onClick={() => setModal('store')} style={{ padding:"16px 32px", borderRadius:12, background:C.accent, color:'#fff', fontWeight:800, border:"none", cursor:"pointer" }}>
                  {formatTemplate(t.buyNuggetsRequired, { count: activeUnlockCost })}
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ padding:"12px 20px", borderBottom:`1px solid ${C.border}`, background:C.card }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <button onClick={()=>setActive(null)} className="mobile-only" style={{ marginRight:10, background:"none", border:"none" }}><Icon name="back" size={20} color={C.t1} /></button>
                  <button
                    type="button"
                    onClick={handleOpenActiveCardPreview}
                    title={isActiveProperty ? t.viewInFeed : (t.openCardPreview || 'Open card preview')}
                    style={{ width:40, height:40, borderRadius:"50%", overflow:"hidden", border:`2px solid ${isActiveProperty?C.gold:C.accent}`, padding:0, background:"transparent", cursor:"pointer", flexShrink:0 }}
                  >
                    {isActiveProperty ? <div style={{ background:C.alpha(C.gold, 0.1), width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon name="home" size={20} color={C.gold} /></div> : <SmartImage src={activeOwner.photo} alt={activeOwner.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} fallback={<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:C.alpha(C.accent,0.1) }}><Icon name={catIcon(activeOwner.cat)} size={16} color={C.accent} /></div>} />}
                  </button>
                  <div style={{ flex:1, minWidth:0, display:"flex", alignItems:"flex-start", gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      {isActiveProperty && activeExclusiveStatus?.expiresAt ? (
                        <div style={{ marginBottom:4, display:'flex', alignItems:'center' }}>
                          <ExclusivityBadge expiresAt={activeExclusiveStatus.expiresAt} />
                        </div>
                      ) : null}
                      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flexWrap:'wrap' }}>
                        <div style={{ fontWeight:800, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:'100%' }}>{isActiveProperty ? active.address : active.name}</div>
                        {!isActiveProperty && activeOwnerExclusiveStatus?.expiresAt ? (
                          <CardStatusIcon type={CARD_STATUS.exclusive} size={20} iconSize={12} />
                        ) : null}
                      </div>
                      <div style={{ fontSize:11, color:C.success }}>{t.onlineBy} · {activeOwner.name}</div>
                    </div>
                    {!isMobile && !isTabletPortrait ? (
                      <div style={{ minWidth:0, maxWidth:'64%', display:'flex', justifyContent:'flex-end', alignSelf:'flex-start' }}>
                        <PortfolioContactPanel
                          canonicalContact={activeOwner?.canonicalContact || null}
                          isUnlocked={isUnlocked}
                          variant="desktop"
                          onUnlockRequest={() => openUnlock(activeOwner, isActiveProperty ? { unlockScope: 'property', property: active, propertyId: active.id, propertyAddress: active.address } : {})}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                {(isMobile || isTabletPortrait) ? (
                  <div style={{ marginTop:10, paddingLeft: isTabletPortrait ? 52 : 0 }}>
                    <PortfolioContactPanel
                      canonicalContact={activeOwner?.canonicalContact || null}
                      isUnlocked={isUnlocked}
                      variant="mobile"
                      onUnlockRequest={() => openUnlock(activeOwner, isActiveProperty ? { unlockScope: 'property', property: active, propertyId: active.id, propertyAddress: active.address } : {})}
                    />
                  </div>
                ) : null}
              </div>


              {isMobile && (
                <div className="matches-chat-mobile-tabs" style={{ borderBottom:`1px solid ${C.border}`, background:C.card, flexShrink:0 }}>
                  <button
                    type="button"
                    onClick={() => setMobileChatTab('chat')}
                    style={{ flex:1, padding:'10px 4px', border:'none', borderBottom:`2px solid ${mobileChatTab==='chat' ? C.accent : 'transparent'}`, background:'transparent', color:mobileChatTab==='chat' ? C.accent : C.t2, fontWeight:700, fontSize:12, cursor:'pointer', transition:'all .15s' }}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileChatTab('portfolio')}
                    style={{ flex:1, padding:'10px 4px', border:'none', borderBottom:`2px solid ${mobileChatTab==='portfolio' ? C.accent : 'transparent'}`, background:'transparent', color:mobileChatTab==='portfolio' ? C.accent : C.t2, fontWeight:700, fontSize:12, cursor:'pointer', transition:'all .15s' }}
                  >
                    {t.portfolio}
                  </button>
                </div>
              )}
              <div
                ref={splitPaneRef}
                className="matches-detail-split"
                style={{
                  flex:1,
                  display:"flex",
                  overflow:"hidden",
                  minWidth:0,
                  '--matches-portfolio-pane': `${tabletPortfolioPct}%`,
                  '--matches-chat-pane': `${Math.max(20, 100 - tabletPortfolioPct)}%`,
                }}
              >
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", borderRight:`1px solid ${C.border}`, position:'relative' }} className="matches-chat-col">
                  <div className="matches-chat-tools" style={{ position:'absolute', top:10, left:10, zIndex:3, display:'inline-flex', flexDirection:'column', alignItems:'stretch', gap:6, background:C.alpha(C.bg, 0.92), border:`1px solid ${C.border}`, borderRadius:10, padding:'4px 6px' }}>
                    <div style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    <button
                      onClick={() => setChatMainTextSize((v) => Math.max(10, v - 1))}
                      aria-label={t.decreaseText || 'Decrease text'}
                      title={t.decreaseText || 'Decrease text'}
                      style={{ width:24, height:24, borderRadius:6, border:`1px solid ${C.border}`, background:C.card, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    >
                      <Icon name="minus" size={12} color={C.t2} />
                    </button>
                    <button
                      onClick={() => setChatMainTextSize((v) => Math.min(18, v + 1))}
                      aria-label={t.increaseText || 'Increase text'}
                      title={t.increaseText || 'Increase text'}
                      style={{ width:24, height:24, borderRadius:6, border:`1px solid ${C.border}`, background:C.card, display:'inline-flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}
                    >
                      <Icon name="plus" size={12} color={C.t2} />
                    </button>
                    </div>
                    <button
                      onClick={() => onOpenChatLanguageConfig?.()}
                      title={t.chatConfig || getMatchesTranslation(myOutputLang, 'chatConfig')}
                      aria-label={t.chatConfig || getMatchesTranslation(myOutputLang, 'chatConfig')}
                      style={{ height:24, borderRadius:6, border:`1px solid ${C.border}`, background:C.card, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', padding:'0 8px', color:C.t2, fontSize:10, fontWeight:700 }}
                    >
                      <Icon name="globe" size={12} color={C.t2} />
                      <span>{t.chatConfig || getMatchesTranslation(myOutputLang, 'chatConfig')}</span>
                    </button>
                  </div>
                  <div ref={scrollRef} className="matches-chat-scroll" style={{ flex:1, overflowY:"auto", padding:"46px 20px 20px", display:"flex", flexDirection:"column", gap:12 }}
                    onScroll={handleChatScroll}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                      e.preventDefault(); setIsDragging(false);
                      const data = JSON.parse(e.dataTransfer.getData("property"));
                      handleSend("", "reference", data);
                    }}
                  >
                    {activeChatHasMore || activeChatLoadingMore ? (
                      <button
                        type="button"
                        disabled={activeChatLoadingMore}
                        onClick={() => {
                          const el = scrollRef.current;
                          if (el) {
                            chatHistoryLoadRef.current = {
                              peerId: activePeerId,
                              beforeHeight: el.scrollHeight,
                              beforeTop: el.scrollTop,
                            };
                          }
                          onLoadMoreChatMessages?.(activePeerId);
                        }}
                        style={{ alignSelf:'center', border:`1px solid ${C.border}`, background:C.card, color:C.t2, borderRadius:999, padding:'6px 10px', fontSize:11, fontWeight:800, cursor:activeChatLoadingMore?'wait':'pointer' }}
                      >
                        {activeChatLoadingMore
                          ? (t.chatLoadingMessages || getMatchesTranslation(myOutputLang, 'chatLoadingMessages'))
                          : (t.chatLoadOlder || getMatchesTranslation(myOutputLang, 'chatLoadOlder'))}
                      </button>
                    ) : null}
                    {currentMsgs.map((m, i) => {
                      const messageKey = m.id || m.clientMessageId || `${m.createdAt || 'msg'}:${i}`;
                      const isMine = m.from === 'me';
                      const statusColor = m.status === 'failed' ? C.danger : (m.status === 'sending' ? C.t3 : C.success);
                      const statusIcon = m.status === 'failed' ? 'x' : (m.status === 'sending' ? 'hourglass' : 'check');
                      const refData = m.refData && typeof m.refData === 'object' ? m.refData : {};
                      const refTitle = refData.address || refData.name || refData.title || (t.chatSharedReference || getMatchesTranslation(myOutputLang, 'chatSharedReference'));
                      const refImage = refData.images?.[0] || refData.image || refData.media?.images?.[0] || '';
                      const isSystemAlert = m.type === 'system' && m.metadata?.systemAlert === true;
                      const isRecipientPlanUpgradeAlert = isSystemAlert && m.metadata?.systemAudience === 'recipient_plan_upgrade';
                      const messageCode = m.messageCode || m.metadata?.messageCode || m.metadata?.message_code || '';
                      const messageParams = m.messageParams || m.metadata?.messageParams || m.metadata?.message_params || {};
                      const codedSystemText = messageCode ? getChatSystemTextByCode(messageCode, myOutputLang, messageParams) : '';
                      const legacyLocalizedText = isSystemAlert && m.metadata?.localizedText && typeof m.metadata.localizedText === 'object'
                        ? (m.metadata.localizedText[myOutputLang] || m.metadata.localizedText.en || '')
                        : '';
                      const localizedSystemText = isSystemAlert ? (codedSystemText || legacyLocalizedText || m.text) : m.text;
                      const receiptLabel = m.status === 'failed'
                        ? (t.chatStatusFailed || getMatchesTranslation(myOutputLang, 'chatStatusFailed'))
                        : (m.status === 'sending'
                          ? (t.chatStatusSending || getMatchesTranslation(myOutputLang, 'chatStatusSending'))
                          : (m.readStatus === 'read'
                            ? (t.chatStatusRead || getMatchesTranslation(myOutputLang, 'chatStatusRead'))
                            : (t.chatStatusUnread || getMatchesTranslation(myOutputLang, 'chatStatusUnread'))));
                      return (
                      <div key={messageKey} style={{ display:"flex", justifyContent:isSystemAlert?"center":(isMine?"flex-end":"flex-start") }}>
                        <div style={{
                          maxWidth: isSystemAlert ? '92%' : '80%',
                          padding: m.type==="reference"?8:12,
                          borderRadius:12,
                          background: isSystemAlert ? C.alpha(C.danger, 0.08) : (isMine?C.alpha(C.accent, 0.5):C.bg),
                          border:`1px solid ${isSystemAlert ? C.alpha(C.danger, 0.45) : (isMine?C.alpha(C.accent, 0.7):C.border)}`,
                          color: isSystemAlert ? C.danger : C.t1,
                          boxShadow: isSystemAlert ? `0 0 0 1px ${C.alpha(C.danger, 0.08)}` : 'none',
                        }}>
                          {m.type === "reference" ? (
                             <div style={{ width:200 }}>
                               <SmartImage src={refImage} alt={refTitle} style={{ width:"100%", height:100, borderRadius:8, objectFit:"cover" }} fallback={<div style={{ width:"100%", height:100, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", background:C.alpha(C.t1,0.05) }}><Icon name="home" size={18} color={C.t3} /></div>} />
                               <div style={{ padding:8, fontSize:12 }}>{refTitle}</div>
                             </div>
                          ) : (
                            <>
                              <div style={{ fontSize:chatMainTextSize, fontWeight: isSystemAlert ? 850 : 400, lineHeight: 1.42 }}>{localizedSystemText}</div>
                              {isRecipientPlanUpgradeAlert ? (
                                <button
                                  type="button"
                                  onClick={goToPricingFromGate}
                                  style={{
                                    marginTop: 8,
                                    border: 'none',
                                    background: C.danger,
                                    color: '#fff',
                                    borderRadius: 999,
                                    padding: '7px 12px',
                                    fontSize: 11,
                                    fontWeight: 900,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {t.chatSystemUpgradeCta || getMatchesTranslation(myOutputLang, 'chatSystemUpgradeCta')}
                                </button>
                              ) : null}
                              {m.originalText && m.originalText !== localizedSystemText && (
                                <div style={{ marginTop:6, paddingTop:6, borderTop:`1px dashed ${C.alpha(C.t1, 0.2)}`, fontSize:10, opacity:0.9 }}>
                                  {t.originalTextLabel} ({String(m.originalLang || '').toUpperCase()}): {m.originalText}
                                </div>
                              )}
                            </>
                          )}
                          {isMine ? (
                            <div style={{ marginTop:6, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, fontSize:10, color:statusColor, fontWeight:800 }}>
                              <Icon name={statusIcon} size={12} color={statusColor} strokeWidth={2} />
                              <span>{receiptLabel}</span>
                              {m.status === 'failed' ? (
                                <button
                                  type="button"
                                  onClick={() => onRetryChatMessage?.(activePeerId, m.id)}
                                  style={{ border:`1px solid ${C.alpha(C.danger, 0.45)}`, background:C.alpha(C.danger, 0.08), color:C.danger, borderRadius:999, padding:'3px 7px', fontSize:10, fontWeight:900, cursor:'pointer' }}
                                >
                                  {t.chatRetry || getMatchesTranslation(myOutputLang, 'chatRetry')}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )})}
                    {isTyping && <div style={{ fontSize:12, color:C.t3 }}>{t.typing}</div>}
                    {isDragging && <div style={{ padding:20, border:`2px dashed ${C.accent}`, borderRadius:12, textAlign:"center", color:C.accent }}>{t.dropPropertyHere}</div>}
                  </div>
                  {!canUseChat ? (
                    <div style={{
                      margin: '0 12px 10px',
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${C.alpha(C.accent, 0.45)}`,
                      background: C.alpha(C.accent, 0.08),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: C.t1 }}>{getPlanGateCopy('chat').title}</div>
                        <div style={{ fontSize: 11, color: C.t2, lineHeight: 1.35 }}>{getPlanGateCopy('chat').message}</div>
                      </div>
                      <button
                        type="button"
                        onClick={goToPricingFromGate}
                        style={{ border: 'none', background: C.accent, color: '#061412', borderRadius: 9, padding: '8px 10px', fontSize: 11, fontWeight: 900, cursor: 'pointer', flexShrink: 0 }}
                      >
                        {getPlanGateCopy('chat').cta}
                      </button>
                    </div>
                  ) : null}
                  <div style={{
                    padding: isMobile ? 12 : '8px 12px',
                    minHeight: isMobile ? 82 : 70,
                    borderTop:`1px solid ${C.border}`,
                    display:"flex",
                    alignItems:'flex-end',
                    gap: isMobile ? 10 : 8,
                    boxSizing:'border-box',
                  }}>
                    <textarea
                      ref={msgInputRef}
                      value={msg}
                      disabled={!canUseChat}
                      onChange={(e) => setMsg(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={1}
                      placeholder={canUseChat ? t.typeMsg : getPlanGateCopy('chat').title}
                      style={{
                        flex:1,
                        minHeight: isMobile ? 42 : 34,
                        maxHeight: isMobile ? 136 : 112,
                        padding: isMobile ? '10px 12px' : '8px 10px',
                        borderRadius:10,
                        border:`1px solid ${C.border}`,
                        background:C.bg,
                        color:C.t1,
                        opacity: canUseChat ? 1 : 0.62,
                        outline:"none",
                        resize:'none',
                        lineHeight: isMobile ? 1.35 : 1.3,
                        fontSize: isMobile ? 14 : 12,
                        boxSizing:'border-box',
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!canUseChat}
                      style={{
                        width: isMobile ? 45 : 40,
                        height: isMobile ? 45 : 40,
                        background:C.accent,
                        border:"none",
                        borderRadius:10,
                        cursor: canUseChat ? "pointer" : "not-allowed",
                        opacity: canUseChat ? 1 : 0.55,
                        display:"flex",
                        alignItems:"center",
                        justifyContent:"center",
                        flexShrink:0,
                      }}
                    >
                      <Icon name="send" size={isMobile ? 18 : 16} color="#fff" />
                    </button>
                  </div>
                </div>

                {!isMobile && (
                  <div 
                    className="matches-resize-handle"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startResizing(isTabletPortrait ? 'vertical' : 'horizontal');
                    }}
                    style={{ width:4, cursor:isTabletPortrait ? "row-resize" : "col-resize", background:C.border, transition:"background .2s", zIndex:10, touchAction:'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.accent}
                    onMouseLeave={e => e.currentTarget.style.background = C.border}
                  />
                )}
                
                <div style={{ width:portfolioWidth, minWidth:0, maxWidth:DESKTOP_PORTFOLIO_MAX_WIDTH, overflowY:"auto", padding:20, flexShrink:0, boxSizing:"border-box" }} className="desktop-only matches-portfolio-col">
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:800, color:C.t3, letterSpacing:"0.5px", flexShrink:0 }}>{t.portfolio.toUpperCase()}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <div className="map-panel-tabs" role="tablist" aria-label="Portfolio tabs">
                        <button
                          role="tab"
                          aria-selected={portfolioTab==='properties'}
                          aria-label={`${onboardingT.recordsPropertiesTab || 'Properties'} (${propertiesCount})`}
                          className={`map-panel-tab ${portfolioTab==='properties' ? 'active' : ''}`}
                          onClick={() => setPortfolioTab('properties')}
                        >
                          {`${onboardingT.recordsPropertiesTab || 'Properties'} (${propertiesCount})`}
                        </button>

                        <button
                          role="tab"
                          aria-selected={portfolioTab==='services'}
                          aria-label={`${onboardingT.recordsServicesTab || 'Services'} (${servicesCount})`}
                          className={`map-panel-tab ${portfolioTab==='services' ? 'active' : ''}`}
                          onClick={() => setPortfolioTab('services')}
                        >
                          {`${onboardingT.recordsServicesTab || 'Services'} (${servicesCount})`}
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedPortfolioItem ? (
                    (selectedPortfolioItem.address) ? (
                      <PortfolioDetail
                        item={selectedPortfolioItem}
                        owner={activeOwner}
                        ownerContact={activeOwner?.canonicalContact || null}
                        isOwnerUnlocked={isUnlocked}
                        onUnlockRequest={() => openUnlock(activeOwner, { unlockScope: 'property', property: selectedPortfolioItem, propertyId: selectedPortfolioItem.id, propertyAddress: selectedPortfolioItem.address })}
                        contactPanelVariant={isMobile ? 'mobile' : 'desktop'}
                        ownerDesc={ownerDesc}
                        onBack={() => setSelectedPortfolioItem(null)}
                        autoplayMedia={autoplayMedia}
                        onBlockedExport={guardExportPdf}
                        imageSources={[...(propertyPortfolio || []), ...(showcaseProperties || []), ...(allPropertiesSource || [])]}
                        exclusiveStatus={getPropertyExclusiveStatus(selectedPortfolioItem)}
                        canUseChat={canUseChat}
                        chatInterestLabel={CHAT_INTEREST_PREFIX[myInputLang] || CHAT_INTEREST_PREFIX.en}
                        onStartChat={(refItem) => {
                          if (!canUseChat) {
                            blockFeature('chat');
                            return;
                          }
                          handleSend('', 'reference', refItem);
                        }}
                      />
                    ) : (
                      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:12 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                          <div style={{ fontSize:14, fontWeight:800 }}>{selectedPortfolioItem.name || selectedPortfolioItem.title || onboardingT.serviceFallbackName}</div>
                          <button
                            onClick={() => setSelectedPortfolioItem(null)}
                            aria-label={t.backToList}
                            style={{
                              width:71,
                              height:24,
                              border:'none',
                              background:'transparent',
                              color: C.t2,
                              fontSize:11,
                              fontWeight:400,
                              borderRadius:6,
                              cursor:'pointer',
                              display:'inline-flex',
                              alignItems:'center',
                              justifyContent:'center',
                              padding:0
                            }}
                          >
                            {t.backToList}
                          </button>
                        </div>
                        <ServiceImageCarousel images={selectedPortfolioItem.media?.images || []} title={selectedPortfolioItem.name || selectedPortfolioItem.title || ''} />
                        {selectedPortfolioItem.description && <div style={{ marginBottom:8, color:C.t2 }}>{selectedPortfolioItem.description}</div>}
                        {(selectedPortfolioItem.publishToShowcase === false || selectedPortfolioItem.publishToConnections === false) ? (
                          <div style={{ marginBottom:8, display:'inline-flex', alignItems:'center', gap:6, padding:'5px 9px', borderRadius:999, border:`1px solid ${C.alpha(C.danger, 0.28)}`, background:C.alpha(C.danger, 0.08), color:C.danger, fontSize:10, fontWeight:800 }}>
                            <Icon name="slash" size={12} color={C.danger} strokeWidth={2.2} />
                            Stand By
                          </div>
                        ) : null}
                        <PortfolioContactPanel
                          canonicalContact={activeOwner?.canonicalContact || null}
                          isUnlocked={isUnlocked}
                          variant={isMobile ? 'mobile' : 'desktop'}
                          onUnlockRequest={() => openUnlock(activeOwner || selectedPortfolioItem, {})}
                        />
                      </div>
                    )
                  ) : (
                    portfolioTab === 'properties' ? (
                      (portfolioItems.length > 0) ? (
                        <>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:PORTFOLIO_GRID_GAP }}>
                            {(portfolioShowAll ? portfolioItems : portfolioItems.slice(0, 4)).map(p => {
                              const exclusivityStatus = (typeof getPropertyExclusiveStatus === 'function') ? getPropertyExclusiveStatus(p) : null;
                              const ownerCard = (allMatched || []).find(c => String(c.ownerId || c.id) === String(p.ownerId))
                                || activeOwner
                                || canonicalContactToDisplayCard(getCanonicalContact(p.ownerId))
                                || { id: p.ownerId, ownerId: p.ownerId, name: 'Locked contact' };
                              const ownerVerified = Boolean(ownerCard && (ownerCard.verified === true || String(ownerCard.verified).toLowerCase() === 'verified'));
                              const isHot = false;
                              return (
                                <PortfolioItem
                                  key={p.id}
                                  p={p}
                                  onOpen={isMobile ? setMobileCardSheet : setSelectedPortfolioItem}
                                  exclusivityStatus={exclusivityStatus}
                                  ownerVerified={ownerVerified}
                                  isHot={isHot}
                                  openUnlock={openUnlock}
                                  getUnlockCost={getUnlockCost}
                                  nuggets={nuggets}
                                  setModal={setModal}
                                />
                              );
                            })}
                          </div>
                          {portfolioItems.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setPortfolioShowAll(v => !v)}
                              style={{ width:'100%', marginTop:10, padding:'9px 0', borderRadius:10, border:`1px solid ${C.border}`, background:C.alpha(C.t1, 0.04), color:C.t2, fontSize:11, fontWeight:700, cursor:'pointer', transition:'background .15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = C.alpha(C.accent, 0.08)}
                              onMouseLeave={e => e.currentTarget.style.background = C.alpha(C.t1, 0.04)}
                            >
                              {portfolioShowAll ? `▲ Ver menos` : `▼ Ver mais (${portfolioItems.length - 4})`}
                            </button>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign:"center", padding:40, color:C.t3, fontSize:12, border:`1px dashed ${C.border}`, borderRadius:12 }}>{onboardingT.recordsNoProperty || t.portfolioEmpty}</div>
                      )
                    ) : (
                      (serviceItems.length > 0) ? (
                        <>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:PORTFOLIO_GRID_GAP }}>
                          {(portfolioShowAll ? serviceItems : serviceItems.slice(0, 4)).map(s => (
                            <div key={s.id || s.serviceId} onClick={() => isMobile ? setMobileCardSheet(s) : setSelectedPortfolioItem(s)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden", cursor:"pointer", padding:8 }}>
                              <div style={{ height:80, position:"relative", overflow:"hidden" }}>
                                <SmartImage src={s.media?.images?.[0]} alt={s.name || s.title} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                              </div>
                              <div style={{ paddingTop:8, fontSize:11, fontWeight:700, color:C.t1 }}>{s.name || s.title || onboardingT.serviceFallbackName}</div>
                              {s.publishToConnections === false ? <div style={{ fontSize:9, fontWeight:800, color:C.danger, textTransform:'uppercase', marginTop:2 }}>Stand By</div> : null}
                              {s.price && <div style={{ fontSize:10, color:C.gold, fontWeight:700 }}>${(s.price/1000).toFixed(0)}K</div>}
                            </div>
                          ))}
                        </div>
                          {serviceItems.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setPortfolioShowAll(v => !v)}
                              style={{ width:'100%', marginTop:10, padding:'9px 0', borderRadius:10, border:`1px solid ${C.border}`, background:C.alpha(C.t1, 0.04), color:C.t2, fontSize:11, fontWeight:700, cursor:'pointer', transition:'background .15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = C.alpha(C.accent, 0.08)}
                              onMouseLeave={e => e.currentTarget.style.background = C.alpha(C.t1, 0.04)}
                            >
                              {portfolioShowAll ? `▲ Ver menos` : `▼ Ver mais (${serviceItems.length - 4})`}
                            </button>
                          )}
                        </>
                      ) : (
                        <div style={{ textAlign:"center", padding:40, color:C.t3, fontSize:12, border:`1px dashed ${C.border}`, borderRadius:12 }}>{onboardingT.recordsNoService || t.portfolioEmpty}</div>
                      )
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {mobileCardSheet && isMobile && (
        <div
          style={{
            position:'fixed',
            inset:0,
            zIndex:300,
            display:'flex',
            flexDirection:'column',
            justifyContent:'flex-end',
            '--ds-sheet-bottom-offset': 'var(--ds-mobile-bottom-nav-visible-height, 0px)',
          }}
          onClick={() => setMobileCardSheet(null)}
        >
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }} />
          <div
            style={{
              position:'relative',
              background:C.card,
              borderRadius:'20px 20px 0 0',
              maxHeight:'calc((var(--app-vh, 1vh) * 100) - var(--ds-mobile-header-offset, 58px) - var(--ds-sheet-bottom-offset) - 18px)',
              overflowY:'auto',
              padding:20,
              paddingBottom:'calc(32px + var(--ds-sheet-bottom-offset) + env(safe-area-inset-bottom, 0px))',
              boxSizing:'border-box',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width:36, height:4, background:C.border, borderRadius:999, margin:'0 auto 16px' }} />
            {mobileCardSheet.address ? (
              <>
                <PortfolioDetail
                  item={mobileCardSheet}
                  owner={activeOwner}
                  ownerContact={activeOwner?.canonicalContact || null}
                  isOwnerUnlocked={isUnlocked}
                  onUnlockRequest={() => openUnlock(activeOwner, { unlockScope: 'property', property: mobileCardSheet, propertyId: mobileCardSheet.id, propertyAddress: mobileCardSheet.address })}
                  contactPanelVariant="mobile"
                  ownerDesc={ownerDesc}
                  onBack={() => setMobileCardSheet(null)}
                  autoplayMedia={autoplayMedia}
                  onBlockedExport={guardExportPdf}
                  imageSources={[...(propertyPortfolio || []), ...(showcaseProperties || []), ...(allPropertiesSource || [])]}
                  exclusiveStatus={getPropertyExclusiveStatus(mobileCardSheet)}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!canUseChat) {
                      blockFeature('chat');
                      return;
                    }
                    handleSend('', 'reference', mobileCardSheet);
                    setMobileCardSheet(null);
                    setMobileChatTab('chat');
                  }}
                  style={{ width:'100%', marginTop:16, padding:'14px', borderRadius:12, background:C.accent, color:'#fff', border:'none', fontWeight:800, fontSize:14, cursor:canUseChat ? 'pointer' : 'not-allowed', opacity:canUseChat ? 1 : 0.62 }}
                >
                  <Icon name="chat" size={16} color="#fff" /> {CHAT_INTEREST_PREFIX[myInputLang] || CHAT_INTEREST_PREFIX.pt}
                </button>
              </>
            ) : (
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.t1 }}>{mobileCardSheet.name || mobileCardSheet.title || onboardingT.serviceFallbackName}</div>
                  <button
                    type="button"
                    onClick={() => setMobileCardSheet(null)}
                    aria-label={t.backToList}
                    style={{ border:'none', background:'transparent', color:C.t2, fontSize:11, fontWeight:400, borderRadius:6, cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center', padding:'4px 8px', flexShrink:0 }}
                  >
                    {t.backToList}
                  </button>
                </div>
                <ServiceImageCarousel images={mobileCardSheet.media?.images || []} title={mobileCardSheet.name || mobileCardSheet.title || ''} compact />
                {mobileCardSheet.description && <div style={{ color:C.t2, fontSize:13, marginBottom:12 }}>{mobileCardSheet.description}</div>}
                <PortfolioContactPanel
                  canonicalContact={activeOwner?.canonicalContact || null}
                  isUnlocked={isUnlocked}
                  variant="mobile"
                  onUnlockRequest={() => openUnlock(activeOwner || mobileCardSheet, {})}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!canUseChat) {
                      blockFeature('chat');
                      return;
                    }
                    handleSend('', 'reference', mobileCardSheet);
                    setMobileCardSheet(null);
                    setMobileChatTab('chat');
                  }}
                  style={{ width:'100%', marginTop:16, padding:'14px', borderRadius:12, background:C.accent, color:'#fff', border:'none', fontWeight:800, fontSize:14, cursor:canUseChat ? 'pointer' : 'not-allowed', opacity:canUseChat ? 1 : 0.62 }}
                >
                  <Icon name="chat" size={16} color="#fff" /> {CHAT_INTEREST_SERVICE_PREFIX[myInputLang] || CHAT_INTEREST_SERVICE_PREFIX.pt}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {previewCardOpen && activeOwner ? (
        <Modal onClose={() => setPreviewCardOpen(false)} maxWidth={previewModalMaxWidth}>
          <div style={{ marginBottom:8, paddingRight:18 }}>
            <div style={{ fontSize:12, fontWeight:800, color:C.t1 }}>{activeOwner.name}</div>
            <div style={{ marginTop:4, display:'inline-flex', alignItems:'center', gap:6, padding:'4.2px 9.8px', borderRadius:999, background:C.alpha(C.success, 0.12), border:`1px solid ${C.alpha(C.success, 0.28)}`, color:C.success, fontSize:10, fontWeight:800 }}>
              <Icon name="unlock" size={11} color={C.success} />
              {cardsT.unlocked}
            </div>
            <div style={{ marginTop:10 }}>
              <PortfolioContactPanel
                canonicalContact={activeOwner?.canonicalContact || null}
                isUnlocked={isUnlocked}
                variant="modal"
                onUnlockRequest={() => openUnlock(activeOwner, {})}
              />
            </div>
          </div>
          <div style={{ width:'100%', display:'flex', justifyContent:'center' }}>
            <div style={{ pointerEvents:'none', width:`min(100%, ${previewFeedCardWidth}px)`, height:isMobile ? 'auto' : previewFeedCardHeight, minHeight:isMobile ? previewFeedCardHeight : undefined }}>
              <SwipeCard
                card={activeOwner}
                action="match"
                isUnlocked
                isSkipped={false}
                onSwipe={() => {}}
                previewOnly
              />
            </div>
          </div>
        </Modal>
      ) : null}

      {paidContactPrompt ? (
        <Modal onClose={() => setPaidContactPrompt(null)} maxWidth={520}>
          <div style={{ padding:22, borderRadius:22, background:C.card, color:C.t1 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:16 }}>
              <span className="ds-warning-triangle">!</span>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:18, fontWeight:900, color:C.t1, marginBottom:6 }}>
                  {paidContactPrompt.mode === 'delete'
                    ? (t.delete || 'Delete')
                    : (t.archived || 'Archive')}
                </div>
                <div style={{ fontSize:13, lineHeight:1.55, color:C.t2, fontWeight:650 }}>
                  {getPaidContactWarning(paidContactPrompt.mode)}
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
              <button
                type="button"
                onClick={() => setPaidContactPrompt(null)}
                style={{ minWidth:118, padding:'11px 16px', borderRadius:12, border:`1px solid ${C.border}`, background:'transparent', color:C.t1, fontWeight:800, cursor:'pointer' }}
              >
                {modalsT.cancel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const pending = paidContactPrompt;
                  setPaidContactPrompt(null);
                  if (pending.mode === 'delete') deleteContactFromMatches(pending.contact, { confirmed: true });
                  else archiveContact(pending.contact, { confirmed: true });
                }}
                style={{ minWidth:156, padding:'11px 16px', borderRadius:12, border:'none', background:paidContactPrompt.mode === 'delete' ? C.danger : C.accent, color:'#fff', fontWeight:900, cursor:'pointer', boxShadow:`0 12px 24px ${C.alpha(paidContactPrompt.mode === 'delete' ? C.danger : C.accent, 0.25)}` }}
              >
                {paidContactPrompt.mode === 'delete'
                  ? (t.delete || 'Delete')
                  : (t.archived || 'Archive')}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      <PlanGateModal
        gate={planGate}
        onClose={() => setPlanGate(null)}
        onUpgrade={goToPricingFromGate}
      />
    </div>
  );
}
