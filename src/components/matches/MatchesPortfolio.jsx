/* eslint-disable react-refresh/only-export-components -- portfolio capability module exports renderers and stable chat/domain helpers */
import React, { useState, useEffect, useMemo } from 'react';
import { C } from '../../theme/colors';
import { getLang, translations, useT } from '../../i18n/translations';
import { PROPERTIES as _MOCK_PROPERTIES, CATEGORIES, SERVICE_PORTFOLIO as _MOCK_SERVICE_PORTFOLIO } from '../../data/mockData';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';
import { PlanGateModal } from '../modals/PlanGateModal';
import { PropertyCard } from '../cards/PropertyCard';
import { SwipeCard } from '../cards/SwipeCard';
import { SmartImage } from '../ui/SmartImage';
import { ExclusivityBadge } from '../ui/ExclusivityBadge';
import { CardStatusIcon } from '../ui/CardStatusIndicators';
import { PortfolioContactPanel } from './PortfolioContactPanel';
import { CARD_STATUS } from '../ui/cardStatusTokens';
import { buildDisplayContacts } from '../../lib/contactPriority';
import { normalizeProfileScope, resolveScopedProfile } from '../../lib/profileScopeResolver';
import { formatPropertyLocation } from '../../lib/formatPropertyLocation';
import { getSafeLang } from '../../services/chatTranslation';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { formatCompactUsd } from '../../lib/formatMoney';
import { PropertyIntelligenceGate } from '../property-intelligence/PropertyIntelligenceGate';
import { ReportExperienceSelector } from '../../features/maxxis/access/ReportExperienceSelector';
import { buildPropertyAnalysisHandoff } from '../../features/maxxis/context/propertyAnalysisHandoff';
import { buildMaxxisReportSchema } from '../../domain/maxxis/maxxisReportSchema';
import { resolveReportExportEntitlement } from '../../features/maxxis/export/reportExportEntitlement';
import { downloadMaxxisReportPdf, renderMaxxisReportPdf } from '../../features/maxxis/export/maxxisReportPdf';
import {
  INTELLIGENCE_REPORT_TYPES,
} from '../../domain/intelligenceAccess';

export const PROPERTIES = import.meta.env.DEV ? (_MOCK_PROPERTIES || []) : [];
export const SERVICE_PORTFOLIO = import.meta.env.DEV ? (_MOCK_SERVICE_PORTFOLIO || []) : [];

export function ServiceImageCarousel({ images = [], title = '', compact = false }) {
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
export const CHAT_REPLY_TEMPLATES = {
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

export const CHAT_INTEREST_PREFIX = {
  pt: 'Tenho interesse neste imóvel',
  en: 'I am interested in this property',
  es: 'Tengo interés en esta propiedad',
};

export const CHAT_INTEREST_SERVICE_PREFIX = {
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

export function getMatchesTranslation(lang, key, params = {}) {
  const normalizedLang = getSafeLang(lang || 'en');
  const matches = translations?.[normalizedLang]?.matches || translations.en.matches || {};
  const fallback = translations.en.matches || {};
  return interpolateText(matches[key] || fallback[key] || '', params);
}

export function getChatSystemTextByCode(messageCode, lang, params = {}) {
  const key = CHAT_SYSTEM_MESSAGE_KEYS[messageCode];
  return key ? getMatchesTranslation(lang, key, params) : '';
}

export const DEFAULT_PEER_LANGS = { input: 'en', output: 'en' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function methodAllowsDealSifterChat(method) {
  const normalized = String(method || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  return ['chat', 'dealsifterchat', 'dealsifter'].includes(normalized);
}

export function contactAllowsDealSifterChat(contact) {
  return Array.isArray(contact?.contactMethods) && contact.contactMethods.some(methodAllowsDealSifterChat);
}

export function compactChatPreview(card) {
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

export const PortfolioItem = ({ p, onOpen, exclusivityStatus = null, ownerVerified = false, isHot = false, openUnlock = null, getUnlockCost = null, nuggets = 0, isAdmin = false, setModal = null }) => {
  const [idx, setIdx] = useState(0);
  const imgs = p.images || [p.image];
  const hasAdminAccess = Boolean(isAdmin);
  const handleLockClick = (e) => {
    e.stopPropagation();
    try {
      const cost = (typeof getUnlockCost === 'function') ? getUnlockCost(p.ownerId) : 1;
      if (typeof openUnlock === 'function') {
        if (!hasAdminAccess && Number.isFinite(nuggets) && Number(nuggets) < Number(cost)) {
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

export const mergeContactForDisplay = (base, incoming) => {
  const merged = { ...(base || {}), ...(incoming || {}) };
  [
    'name',
    'title',
    'type',
    'category',
    'cat',
    'loc',
    'photo',
    'avatar',
    'avatarUrl',
    'avatar_url',
    'primaryProfile',
    'primary_profile',
    'portfolioCount',
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

export function getLocalOwnerId(scopeKey) {
  if (isSupabaseConfigured && !import.meta.env.DEV) return '';
  try {
    const map = JSON.parse(localStorage.getItem('profileOwnerMap') || 'null');
    if (map && typeof map[scopeKey] !== 'undefined') return map[scopeKey];
  } catch (e) { void e; }
  return '';
}

export function ExclusiveBlockedBadge({ status, onUnlockOwner = null }) {
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

export function PortfolioDetail({ item, owner, ownerContact = null, isOwnerUnlocked = false, onUnlockRequest = null, contactPanelVariant = 'desktop', ownerDesc, onBack, autoplayMedia = false, imageSources = [], onStartChat = null, canUseChat = true, chatInterestLabel = CHAT_INTEREST_PREFIX.en, exclusiveStatus = null, onAnalyzeWithMaxxis = null, intelligencePlan = 'free', reportEntitlements = [], onRequestIntelligenceUnlock = null }) {
  const scopedReportEntitlements = useMemo(() => reportEntitlements.filter((entitlement) => (
    !entitlement?.propertyId || String(entitlement.propertyId) === String(item?.id || '')
  )), [item?.id, reportEntitlements]);
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
  const [exportMode, setExportMode] = useState('');
  const [isPreparingExport, setIsPreparingExport] = useState(false);

  useEffect(() => {
    const openRequestedReport = (event) => {
      const requestedPropertyId = String(event?.detail?.propertyId || '').trim();
      if (requestedPropertyId && requestedPropertyId !== String(item?.id || '')) return;
      if (!String(emailTo || '').trim()) setEmailTo(getProfileEmailFallback());
      setExportMode('');
      setEmailComposeOpen(true);
    };
    window.addEventListener('dealsifter.openReportExport', openRequestedReport);
    return () => window.removeEventListener('dealsifter.openReportExport', openRequestedReport);
  }, [emailTo, item?.id]);

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

    const field = (label, value, fallbackLabel) => {
      const cleanValue = normalizeExportText(value);
      if (!cleanValue || cleanValue === '-' || cleanValue.toLowerCase() === 'undefined') return null;
      return `${normalizeExportText(label || fallbackLabel)}: ${cleanValue}`;
    };
    const cardsDescription = [
      `TITLE: ${title}`,
      '',
      'DESCRIPTION:',
      field(matchesT.price, fmtMoney(item?.price), 'Price'), field(matchesT.type, item?.type, 'Type'),
      field(matchesT.strategy, item?.objective, 'Strategy'), field(matchesT.capRate, item?.capRate ? `${item.capRate}%` : '', 'Cap Rate'),
      field(matchesT.beds, item?.beds > 0 ? item.beds : '', 'Beds'), field(matchesT.baths, item?.baths > 0 ? item.baths : '', 'Baths'),
      field(matchesT.size, item?.sqft, 'Size'), field(matchesT.lot, item?.lot, 'Lot'), field(matchesT.rehab, item?.rehab ? fmtMoney(item.rehab) : '', 'Rehab'),
      field(matchesT.zip, zip, 'ZIP'), field(matchesT.dealTag, item?.dealTag, 'Deal Tag'), field(matchesT.source, item?.source, 'Source'),
      field(matchesT.isActive, item?.isActive == null ? '' : (item.isActive ? (matchesT.active || 'Active') : (matchesT.inactive || 'Inactive')), 'Status'),
      field('LOCATION', [city, state].filter((value) => value && value !== '-').join(', '), 'LOCATION'),
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
    ].filter((line) => line !== null && line !== undefined).map((line) => normalizeExportText(line)).join('\n');

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
    const imageIdentity = (value) => {
      const normalized = normalizeExportImageUrl(value);
      if (!normalized || typeof normalized !== 'string') return '';
      if (normalized.startsWith('data:')) return normalized;
      try {
        const parsed = new URL(normalized, window.location.origin);
        return decodeURIComponent(parsed.pathname).toLowerCase();
      } catch {
        return String(normalized).split(/[?#]/)[0].toLowerCase();
      }
    };
    const ownerAvatarKeys = new Set([
      owner?.photo,
      owner?.avatar,
      owner?.avatarUrl,
      owner?.avatar_url,
      owner?.image,
      owner?.imageUrl,
      owner?.image_url,
      owner?.thumbnail,
      owner?.thumbnailUrl,
      owner?.thumbnail_url,
    ].map(imageIdentity).filter(Boolean));
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
      const identity = imageIdentity(entry);
      const isProfileAsset = identity.includes('/profile-images/')
        || /(^|[/_-])(avatar|profile-avatar)([./_-]|$)/i.test(identity);
      if (isProfileAsset || ownerAvatarKeys.has(identity)) return false;
      const key = typeof entry === 'string' ? entry : `${entry?.type || 'blob'}:${entry?.size || ''}:${entry?.name || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };


  const generateReleasePdf = async ({ title, imageUrls }) => {
    const safeName = String(title || 'property-release').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 64);
    const imageSources = (Array.isArray(imageUrls) ? imageUrls : getExportImageUrls()).slice(0, 4);
    const reportImages = (await Promise.all(imageSources.map((source) => {
      if (typeof source === 'string') return Promise.resolve(source);
      if (!(source instanceof Blob)) return Promise.resolve(null);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(source);
      });
    }))).filter(Boolean);
    const shouldUseSavedProfile = !isSupabaseConfigured
      && (!owner?.id || owner?.id === 999999 || owner?.ownerId === 999999 || owner?.id === 'preview-personal');
    const savedProfile = shouldUseSavedProfile
      ? readScopedProfileFallback(normalizeProfileScope(owner?.primaryProfile || item?.primaryProfile || ''))
      : null;
    const contacts = buildDisplayContacts(owner || {}, savedProfile, {
      call: modalsT.contactPhone,
      sms: modalsT.contactSms,
      whatsapp: modalsT.contactWhatsApp,
      telegram: modalsT.contactTelegram,
      email: modalsT.contactEmail,
    }).sort((a, b) => (a.priority || 99) - (b.priority || 99));
    const property = {
      ...item,
      address: item?.address || title,
      images: reportImages,
      notes: ownerDesc || owner?.desc || item?.notes || item?.description || null,
      published: Boolean(item?.isActive),
      portfolio: Boolean(item?.includeInPreview),
      owner: {
        name: owner?.name || null,
        type: owner?.type || null,
        status: item?.isActive ? matchesT.active : matchesT.inactive,
        allowedContacts: contacts.map((contact) => ({
          type: contact.type || null,
          label: contact.label || null,
          value: contact.val || null,
        })),
      },
    };
    const schema = buildMaxxisReportSchema({ reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE, property });
    const exportEntitlement = resolveReportExportEntitlement({
      plan: 'free', reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE, channel: 'PDF',
    });
    const rendered = await renderMaxxisReportPdf({ schema, exportEntitlement, language: getSafeLang(getLang()) });
    if (rendered.state !== 'RENDERED' || rendered.document.pageCount !== 1) throw new Error('PROPERTY_RELEASE_RENDER_FAILED');
    const fileName = `${safeName || 'property_release'}.pdf`;
    if (!downloadMaxxisReportPdf(rendered.document, fileName)) throw new Error('PROPERTY_RELEASE_DOWNLOAD_FAILED');
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
    if (!String(emailTo || '').trim()) setEmailTo(getProfileEmailFallback());
    setExportMode('');
    setEmailComposeOpen(true);
  };

  const buildMaxxisAnalysisPrompt = (reportType) => {
    if (reportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE) {
      return 'Build the full Deal Intelligence view for the property currently selected on screen. Use only authorized stored facts, cached evidence, and existing deterministic engine outputs. Explain provenance, conflicts, sold comps, the existing ARV result and confidence, warnings, limitations, opportunity signals, and verification actions. Do not make new provider calls, recalculate metrics, guarantee returns, recommend buying, or state a definitive value.';
    }
    return 'Create a Maxxis Analysis for the property currently selected on screen. Use only factual published details and the active Investment Profile. Provide an analytical summary, positive points, attention points, important questions, compatibility context, and practical next steps. Identify missing fields. Do not provide professional ARV, sold comps, valuation evidence, appraisal analysis, calculate new financial metrics, guarantee returns, judge deal quality, or recommend buying.';
  };

  const startMaxxisAnalysis = (accessDecision) => {
    if (typeof onAnalyzeWithMaxxis !== 'function') return;
    const source = buildExportPayload();
    const propertyAnalysisContext = buildPropertyAnalysisHandoff({
      property: item,
      reportType: accessDecision.reportType,
      accessDecision,
      userPlan: intelligencePlan,
    });
    onAnalyzeWithMaxxis({
      id: `maxxis-property-analysis-${item?.id || item?.address || Date.now()}-${Date.now()}`,
      title: source.title,
      prompt: buildMaxxisAnalysisPrompt(accessDecision.reportType),
      visibleMessage: `${matchesT.exportAnalyzeWithMaxxis || 'Analyze with Maxxis Deal AI'}: ${source.title}`,
      propertyId: item?.id,
      reportType: accessDecision.reportType,
      accessDecision,
      propertyAnalysisContext,
      // The chat exports the authorized structured MaxxisReportSchema, never a Basic PDF with analysis text appended.
      onExportPdf: async () => { throw new Error('MAXXIS_REPORT_SCHEMA_REQUIRED'); },
      onEmail: () => {
        setExportMode('email'); setExportPdfWithEmail(true); setEmailComposeOpen(true);
      },
    });
    setEmailComposeOpen(false);
  };

  const handleAnalysisSelection = async (accessDecision) => {
    if (accessDecision?.reportType === INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE) {
      return;
    }
    if (accessDecision?.allowed) {
      startMaxxisAnalysis(accessDecision);
      return;
    }
    const result = await onRequestIntelligenceUnlock?.({ ...accessDecision, propertyId: item?.id || null });
    if (result) {
      startMaxxisAnalysis({
        ...accessDecision,
        allowed: true,
        state: result.already_owned ? 'ENTITLED' : 'UNLOCKED',
        accessSource: result.access_source || accessDecision.accessSource,
      });
    }
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
    <div data-guide="matches-property-detail" style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
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
          <button data-guide="matches-export" type="button" onClick={handleOpenEmailCompose}
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

          <div data-testid="matches-property-detail-grid" style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"10px 12px", background:C.alpha(C.bg, 0.38), display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", columnGap:14, rowGap:6 }}>
            {detailGroups.flat().map(([k, v]) => (
              <div key={k} style={{ minWidth:0, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, paddingBottom:5, borderBottom:`1px solid ${C.alpha(C.border, 0.5)}` }}
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

      <PropertyIntelligenceGate propertyId={item.id} />

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
        <Modal
          onClose={() => setEmailComposeOpen(false)}
          maxWidth={720}
          contentClassName={`report-export-modal ${exportMode ? 'is-scrollable' : 'is-fitted'}`}
          scrollable={Boolean(exportMode)}
          showCloseButton={false}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{matchesT.exportModalTitle || 'Export portfolio release'}</div>

            <div className="report-export-panel" style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display: 'grid', gap: 8, background: C.alpha(C.accent, 0.04) }}>
              <ReportExperienceSelector
                plan={intelligencePlan}
                entitlements={scopedReportEntitlements}
                language={getLang()}
                onSelect={handleAnalysisSelection}
                onCancel={() => setEmailComposeOpen(false)}
                onContinue={handleConfirmEmailExport}
                continueDisabled={!exportMode}
                isPreparing={isPreparingExport}
                cancelLabel={modalsT.cancel || 'Cancel'}
                continueLabel={matchesT.exportContinue || 'Continue'}
                preparingLabel={matchesT.exportPreparing || 'Preparing...'}
                onBasicDownload={() => {
                  setExportMode('download'); setExportPdfLocal(true);
                  setExportPdfWithEmail(false); setExportPhotosWithEmail(false);
                }}
                onBasicEmail={() => {
                  setExportMode('email'); setExportPdfWithEmail(true); setExportPdfLocal(false);
                  if (!String(emailTo || '').trim()) setEmailTo(getProfileEmailFallback());
                }}
              />

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
              ) : exportMode === 'email' ? (
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
              ) : null}
            </div>

            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: exportMode === 'email' ? 'grid' : 'none', gap: 8 }}>
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
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
