/* eslint-disable react-refresh/only-export-components -- portfolio capability module exports renderers and stable chat/domain helpers */
import React, { useState, useEffect, useMemo } from 'react';
import { C } from '../../theme/colors';
import { translations, useT } from '../../i18n/translations';
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

const releaseDarkLogo = '/logo%20tema%20preto.png';
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

export function PortfolioDetail({ item, owner, ownerContact = null, isOwnerUnlocked = false, onUnlockRequest = null, contactPanelVariant = 'desktop', ownerDesc, onBack, autoplayMedia = false, onBlockedExport = null, imageSources = [], onStartChat = null, canUseChat = true, chatInterestLabel = CHAT_INTEREST_PREFIX.en, exclusiveStatus = null, onAnalyzeWithMaxxis = null }) {
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

  const yieldToBrowser = () => new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    window.requestAnimationFrame(() => window.setTimeout(resolve, 0));
  });

  const compressImageBlob = async (blob, maxDimension = 960, { preserveAlpha = false } = {}) => {
    if (!blob || !String(blob.type || '').startsWith('image/') || typeof createImageBitmap !== 'function') {
      return blob;
    }
    let bitmap = null;
    try {
      bitmap = await createImageBitmap(blob);
      const sourceW = Number(bitmap.width || 1);
      const sourceH = Number(bitmap.height || 1);
      const scale = Math.min(1, maxDimension / Math.max(sourceW, sourceH));
      if (scale >= 0.98) return blob;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(sourceW * scale));
      canvas.height = Math.max(1, Math.round(sourceH * scale));
      const keepTransparency = preserveAlpha && String(blob.type || '').includes('png');
      const ctx = canvas.getContext('2d', { alpha: keepTransparency });
      if (!ctx) return blob;
      if (!keepTransparency) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise((resolve) => canvas.toBlob(
        resolve,
        keepTransparency ? 'image/png' : 'image/jpeg',
        keepTransparency ? undefined : 0.76,
      ));
      return compressed || blob;
    } catch {
      return blob;
    } finally {
      bitmap?.close?.();
    }
  };

  const fetchImageData = async (url, timeoutMs = 2800, maxDimension = 960, options = {}) => {
    if (!url) return null;
    try {
      if (url instanceof Blob || (typeof File !== 'undefined' && url instanceof File)) {
        const optimizedBlob = await compressImageBlob(url, maxDimension, options);
        const dataUrl = await blobToDataUrl(optimizedBlob);
        const format = String(optimizedBlob.type || '').includes('png') ? 'PNG' : 'JPEG';
        return { dataUrl, format };
      }
      if (typeof url === 'object' && url?.blob instanceof Blob) {
        const optimizedBlob = await compressImageBlob(url.blob, maxDimension, options);
        const dataUrl = await blobToDataUrl(optimizedBlob);
        const format = String(optimizedBlob.type || '').includes('png') ? 'PNG' : 'JPEG';
        return { dataUrl, format };
      }
      if (String(url).startsWith('data:image/')) {
        const format = String(url).slice(0, 30).toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        return { dataUrl: url, format };
      }
      let timeoutId = null;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let response = null;
      try {
        if (controller && Number(timeoutMs) > 0) {
          timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        }
        response = await fetch(url, controller ? { signal: controller.signal } : undefined);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
      if (!response.ok) return null;
      const blob = await compressImageBlob(await response.blob(), maxDimension, options);
      const dataUrl = await blobToDataUrl(blob);
      const format = String(blob.type || '').includes('png') ? 'PNG' : 'JPEG';
      return { dataUrl, format };
    } catch (e) {
      void e;
      return null;
    }
  };

  const loadCanvasImage = (src, timeoutMs = 2400) => new Promise((resolve, reject) => {
    const img = new Image();
    let timeoutId = null;
    const cleanup = () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('Image load failed'));
    };
    if (Number(timeoutMs) > 0) {
      timeoutId = window.setTimeout(() => {
        cleanup();
        img.src = '';
        reject(new Error('Image load timed out'));
      }, timeoutMs);
    }
    img.src = src;
  });

  const makeOsmTileMapImage = async ({ lat, lng, zoom = 12, width = 720, height = 320 }) => {
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

      const tileRequests = [];
      for (let tx = minTileX; tx <= maxTileX; tx += 1) {
        for (let ty = minTileY; ty <= maxTileY; ty += 1) {
          if (ty < 0 || ty > maxTileIndex) continue;
          const wrappedX = ((tx % scale) + scale) % scale;
          tileRequests.push({
            tx,
            ty,
            url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          });
        }
      }
      const loadedTiles = await Promise.all(tileRequests.map(async (request) => {
        try {
          return { ...request, image: await loadCanvasImage(request.url, 1200) };
        } catch {
          return null;
        }
      }));
      loadedTiles.filter(Boolean).forEach(({ tx, ty, image }) => {
        const dx = Math.round((tx * tileSize) - startX);
        const dy = Math.round((ty * tileSize) - startY);
        ctx.drawImage(image, dx, dy, tileSize, tileSize);
      });

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
      return canvas.toDataURL('image/jpeg', 0.76);
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

  const generateReleasePdf = async ({ title, imageUrls, maxxisAnalysis = '' }) => {
    const { jsPDF } = await import('jspdf');
    await yieldToBrowser();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const topMargin = 28;
    const maxTextWidth = pageWidth - margin * 2;
    let y = topMargin;

    const logo = await fetchImageData(releaseDarkLogo, 1200, 420, { preserveAlpha: true });
    const normalizedImageUrls = Array.isArray(imageUrls) && imageUrls.length ? imageUrls : getExportImageUrls();
    const imageResults = await Promise.all([
      fetchImageData(normalizedImageUrls?.[0], 2600, 1000),
      ...normalizedImageUrls
        .slice(1, 11)
        .map((url) => fetchImageData(url, 2600, 720)),
    ]);
    const mainImage = imageResults[0] || null;
    const galleryImages = imageResults
      .slice(1)
      .filter(Boolean);
    await yieldToBrowser();

    const safe = (v, fallback = '-') => {
      const s = normalizeExportText(v);
      return s && s !== '-' ? s : fallback;
    };
    const pdfLabel = (key, fallback) => matchesT[key] || fallback;
    const normalizeAnalysisText = (value) => {
      const raw = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw.replace(/\+/g, ' '));
      } catch {
        decoded = raw.replace(/\+/g, ' ');
      }
      return decoded
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[`*_]/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

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
    const maxxisAnalysisText = normalizeAnalysisText(maxxisAnalysis);
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

      doc.setFillColor(19, 19, 19);
      doc.roundedRect(x + 1, yy + 1, w - 2, 22, 5, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
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

    const buildAnalysisSections = (text) => {
      const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
      const sections = [];
      let current = { title: pdfLabel('maxxisAnalysisSummary', 'Opportunity Snapshot'), lines: [] };
      const pushCurrent = () => {
        if (current.lines.length || current.title) sections.push(current);
      };
      for (const rawLine of lines) {
        const cleaned = rawLine
          .replace(/^#{1,6}\s*/, '')
          .replace(/^[-*]\s*/, '')
          .replace(/^\d+[.)]\s*/, '')
          .trim();
        const isHeading = /^#{1,6}\s*/.test(rawLine)
          || (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?]{2,72}:$/.test(cleaned))
          || (/^(Quick Verdict|Verdict|Numbers|Risks|Questions|Next Steps|Perguntas|Proximos|Próximos|Riscos|Consideracoes|Considerações|Acciones|Preguntas|Riesgos)/i.test(cleaned) && cleaned.length < 80);
        if (isHeading) {
          if (current.lines.length) pushCurrent();
          current = { title: cleaned.replace(/:$/, ''), lines: [] };
        } else {
          current.lines.push(cleaned);
        }
      }
      if (current.lines.length) pushCurrent();
      if (!sections.length && text) {
        sections.push({
          title: pdfLabel('maxxisAnalysisSummary', 'Opportunity Snapshot'),
          lines: String(text).replace(/([.!?])\s+/g, '$1\n').split('\n').filter(Boolean).slice(0, 8),
        });
      }
      return sections;
    };

    const sectionMatches = (section, patterns) => {
      const titleText = String(section?.title || '').toLowerCase();
      return patterns.some((pattern) => titleText.includes(pattern));
    };

    const compactLines = (sections, fallbackSections, maxItems = 5) => {
      const source = sections.length ? sections : fallbackSections;
      const items = [];
      for (let i = 0; i < source.length; i += 1) {
        const sectionLines = source[i]?.lines || [];
        for (let j = 0; j < sectionLines.length; j += 1) {
          const line = String(sectionLines[j] || '').replace(/^[-*]\s*/, '').trim();
          if (line) items.push(line);
          if (items.length >= maxItems) return items;
        }
      }
      return items;
    };

    const drawAnalysisBox = ({ titleText, lines, x, yy, w, h, fill, stroke, titleColor, maxItems = 5 }) => {
      doc.setFillColor(...fill);
      doc.setDrawColor(...stroke);
      doc.roundedRect(x, yy, w, h, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...titleColor);
      doc.setFontSize(10.2);
      doc.text(titleText, x + 8, yy + 15);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(48, 61, 78);
      doc.setFontSize(8.1);
      let cursorY = yy + 30;
      const usableW = w - 18;
      const safeLines = lines.length ? lines : ['-'];
      for (let i = 0; i < Math.min(maxItems, safeLines.length); i += 1) {
        if (cursorY > yy + h - 12) break;
        const prefix = safeLines.length > 1 ? `${i + 1}. ` : '';
        const wrapped = doc.splitTextToSize(`${prefix}${safeLines[i]}`, usableW);
        for (let j = 0; j < wrapped.length; j += 1) {
          if (cursorY > yy + h - 10) break;
          doc.text(wrapped[j], x + 8, cursorY);
          cursorY += 8.4;
        }
        cursorY += 2;
      }
    };

    const drawMaxxisAnalysisPage = () => {
      if (!maxxisAnalysisText) return;
      doc.addPage();
      y = topMargin;

      const sections = buildAnalysisSections(maxxisAnalysisText);
      const questions = sections.filter((section) => sectionMatches(section, ['question', 'pergunta', 'duvida', 'dúvida', 'pregunta']));
      const actions = sections.filter((section) => sectionMatches(section, ['next', 'step', 'action', 'acao', 'ação', 'proximo', 'próximo', 'accion']));
      const considerations = sections.filter((section) => sectionMatches(section, ['risk', 'risco', 'consider', 'attention', 'atencao', 'atención']));
      const topicSections = sections
        .filter((section) => !questions.includes(section) && !actions.includes(section) && !considerations.includes(section))
        .slice(0, 4);
      const fallbackTopics = topicSections.length ? topicSections : sections.slice(0, 4);

      doc.setFillColor(19, 19, 19);
      doc.roundedRect(margin, y, maxTextWidth, 38, 8, 8, 'F');
      if (logo) {
        drawImageContain(doc, logo.dataUrl, logo.format, margin + 10, y + 3, 164, 32);
      }
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(53, 202, 201);
      doc.setFontSize(13);
      doc.text(pdfLabel('maxxisAiAnalysis', 'Maxxis Deal AI Analysis'), pageWidth - margin - 10, y + 17, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(187, 202, 214);
      doc.setFontSize(8);
      doc.text(safe(item?.address || title), pageWidth - margin - 10, y + 30, { align: 'right' });
      y += 50;

      const summaryRows = [
        [pdfLabel('price', 'Price'), fmtMoney(item?.price)],
        [pdfLabel('strategy', 'Strategy'), safe(item?.objective)],
        ['Cap Rate', item?.capRate ? `${item.capRate}%` : '-'],
        ['Rehab', fmtMoney(item?.rehab || 0)],
      ];
      const summaryW = (maxTextWidth - 18) / 4;
      for (let i = 0; i < summaryRows.length; i += 1) {
        const x = margin + i * (summaryW + 6);
        doc.setFillColor(247, 252, 252);
        doc.setDrawColor(177, 230, 230);
        doc.roundedRect(x, y, summaryW, 38, 5, 5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(140, 154, 174);
        doc.setFontSize(7.6);
        doc.text(summaryRows[i][0], x + 6, y + 12);
        doc.setTextColor(20, 31, 48);
        doc.setFontSize(10.6);
        doc.text(String(summaryRows[i][1] || '-').slice(0, 28), x + 6, y + 27);
      }
      y += 50;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 31, 48);
      doc.setFontSize(12);
      doc.text(pdfLabel('maxxisAnalysisTopics', 'Key Topics'), margin, y);
      y += 10;

      const colGap = 10;
      const colW = (maxTextWidth - colGap) / 2;
      const topicH = 110;
      for (let i = 0; i < Math.min(4, fallbackTopics.length); i += 1) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        drawAnalysisBox({
          titleText: fallbackTopics[i].title || pdfLabel('maxxisAnalysisSummary', 'Opportunity Snapshot'),
          lines: fallbackTopics[i].lines || [],
          x: margin + col * (colW + colGap),
          yy: y + row * (topicH + 10),
          w: colW,
          h: topicH,
          fill: [249, 250, 252],
          stroke: [208, 216, 229],
          titleColor: [23, 139, 140],
          maxItems: 4,
        });
      }
      y += (fallbackTopics.length > 2 ? 2 : 1) * (topicH + 10) + 2;

      const conclusionY = Math.min(y, pageHeight - margin - 174);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 31, 48);
      doc.setFontSize(12);
      doc.text(pdfLabel('maxxisAnalysisConclusion', 'Segmented Conclusion'), margin, conclusionY);

      const segmentY = conclusionY + 12;
      const segmentGap = 8;
      const segmentW = (maxTextWidth - segmentGap * 2) / 3;
      const segmentH = pageHeight - segmentY - margin;
      drawAnalysisBox({
        titleText: pdfLabel('maxxisAnalysisConsiderations', 'Considerations'),
        lines: compactLines(considerations, sections, 5),
        x: margin,
        yy: segmentY,
        w: segmentW,
        h: segmentH,
        fill: [255, 251, 244],
        stroke: [247, 194, 116],
        titleColor: [188, 113, 18],
        maxItems: 5,
      });
      drawAnalysisBox({
        titleText: pdfLabel('maxxisAnalysisQuestions', 'Questions'),
        lines: compactLines(questions, sections, 5),
        x: margin + segmentW + segmentGap,
        yy: segmentY,
        w: segmentW,
        h: segmentH,
        fill: [247, 250, 255],
        stroke: [185, 205, 240],
        titleColor: [58, 106, 173],
        maxItems: 5,
      });
      drawAnalysisBox({
        titleText: pdfLabel('maxxisAnalysisActions', 'Actions'),
        lines: compactLines(actions, sections, 5),
        x: margin + (segmentW + segmentGap) * 2,
        yy: segmentY,
        w: segmentW,
        h: segmentH,
        fill: [245, 253, 250],
        stroke: [156, 221, 196],
        titleColor: [31, 134, 93],
        maxItems: 5,
      });
    };

    // Branded header using the same complete logo image used in the app header.
    doc.setFillColor(19, 19, 19);
    doc.roundedRect(margin, y, maxTextWidth, 42, 8, 8, 'F');
    if (logo) {
      drawImageContain(doc, logo.dataUrl, logo.format, margin + 10, y + 4, 190, 34);
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(53, 202, 201);
    doc.setFontSize(11);
    doc.text(matchesT.exportPdfHeader || 'Investor-ready property release', pageWidth - margin - 10, y + 17, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(187, 202, 214);
    doc.setFontSize(7.8);
    doc.text(`${matchesT.generated || 'Generated'}: ${new Date().toLocaleString()}`, pageWidth - margin - 10, y + 31, { align: 'right' });
    y += 52;

    const heroH = 102;
    const heroGap = 12;
    const heroLeftW = Math.floor((maxTextWidth - heroGap) * 0.52);
    const heroRightW = maxTextWidth - heroLeftW - heroGap;
    const heroRightX = margin + heroLeftW + heroGap;
    doc.setFillColor(246, 251, 251);
    doc.setDrawColor(159, 231, 229);
    doc.roundedRect(margin, y, heroLeftW, heroH, 10, 10, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(8, 18, 34);
    doc.setFontSize(16);
    const heroTitle = doc.splitTextToSize(safe(item?.address || title), heroLeftW - 16);
    doc.text(heroTitle[0] || '-', margin + 8, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(73, 86, 105);
    doc.setFontSize(10.5);
    doc.text(`${safe(item?.city)}, ${safe(item?.state)} ${safe(item?.zip, '')}`.trim(), margin + 8, y + 42);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 166, 35);
    doc.setFontSize(20);
    doc.text(fmtMoney(item?.price), margin + 8, y + 64);

    doc.setDrawColor(120, 130, 142);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin + 8, y + 50, margin + heroLeftW - 8, y + 50);
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
      doc.roundedRect(chipX, y + 78, chipW, 17, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(43, 68, 88);
      doc.setFontSize(8.5);
      doc.text(chip, chipX + 6, y + 89);
      chipX += chipW + 6;
      if (chipX > margin + heroLeftW - 80) break;
    }

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
      await yieldToBrowser();
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

    const panelGap = 8;
    const panelW = Math.floor((maxTextWidth - panelGap * 2) / 3);
    const panelH = 168;
    drawPanel(pdfLabel('exportOwnerInfo', 'Owner Information'), panelRowsOwner, margin, y, panelW, panelH);
    drawPanel(pdfLabel('exportPropertyInfo', 'Property Characteristics'), panelRowsProperty, margin + panelW + panelGap, y, panelW, panelH);
    drawPanel(pdfLabel('exportLandInfo', 'Land Information'), panelRowsLand, margin + (panelW + panelGap) * 2, y, panelW, panelH);
    y += panelH + 10;

    // Full-width intermediate Notes block between the 3 columns and the map section.
    const notesBlockH = 56;
    doc.setFillColor(249, 250, 252);
    doc.setDrawColor(208, 216, 229);
    doc.roundedRect(margin, y, maxTextWidth, notesBlockH, 6, 6, 'FD');
    doc.setFillColor(19, 19, 19);
    doc.roundedRect(margin + 1, y + 1, maxTextWidth - 2, 22, 5, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10.5);
    doc.text(pdfLabel('notes', 'Notes'), margin + 8, y + 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(74, 84, 96);
    doc.setFontSize(8.2);
    const notesLines = doc.splitTextToSize(ownerNotes || '-', maxTextWidth - 16);
    const maxNotesLines = 3;
    for (let i = 0; i < Math.min(maxNotesLines, notesLines.length); i += 1) {
      doc.text(notesLines[i], margin + 8, y + 34 + (i * 8));
    }
    y += notesBlockH + 10;

    const drawMapSection = async (x, sectionY, sectionW, sectionH) => {
      if (sectionH <= 90) return;
      const coords = getPropertyCoordinates();
      const lat = coords.lat;
      const lng = coords.lng;
      const canRenderMap = Number.isFinite(lat) && Number.isFinite(lng);
      doc.setFillColor(249, 250, 252);
      doc.setDrawColor(208, 216, 229);
      doc.roundedRect(x, sectionY, sectionW, sectionH, 6, 6, 'FD');
      doc.setFillColor(19, 19, 19);
      doc.roundedRect(x + 1, sectionY + 1, sectionW - 2, 22, 5, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10.5);
      doc.text(pdfLabel('exportMapSnapshot', 'Property Map Snapshot'), x + 8, sectionY + 16);

      const mapX = x + 8;
      const mapY = sectionY + 29;
      const mapW = sectionW - 16;
      const mapInnerH = sectionH - 37;
      doc.setDrawColor(205, 216, 232);
      doc.roundedRect(mapX, mapY, mapW, mapInnerH, 5, 5);

      if (canRenderMap) {
        const cityZoom = 12;
        const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${cityZoom}&size=720x320&markers=${lat},${lng},red-pushpin`;
        let mapImage = await fetchImageData(mapUrl, 1500, 720);
        if (!mapImage) {
          const tileSnapshot = await makeOsmTileMapImage({ lat, lng, zoom: cityZoom, width: 720, height: 320 });
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
    };

    const drawPhotoSection = async ({
      x,
      sectionY,
      sectionW,
      sectionH,
      columns,
    }) => {
      const photos = galleryImages.slice(0, 10);
      if (!photos.length || sectionH <= 70) return;
      const titleH = 22;
      const contentTop = sectionY + titleH + 7;
      const gap = 6;
      const rows = Math.ceil(photos.length / columns);
      const innerW = sectionW - 16;
      const availableH = sectionH - titleH - 17;
      const cellW = (innerW - (gap * (columns - 1))) / columns;
      const cellH = Math.max(34, (availableH - (gap * (rows - 1))) / rows);

      doc.setFillColor(249, 250, 252);
      doc.setDrawColor(208, 216, 229);
      doc.roundedRect(x, sectionY, sectionW, sectionH, 6, 6, 'FD');
      doc.setFillColor(19, 19, 19);
      doc.roundedRect(x + 1, sectionY + 1, sectionW - 2, titleH, 5, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10.2);
      doc.text(pdfLabel('photos', 'Additional Photos'), x + 8, sectionY + 16);

      for (let i = 0; i < photos.length; i += 1) {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const imgX = x + 8 + (col * (cellW + gap));
        const imgY = contentTop + (row * (cellH + gap));
        doc.setDrawColor(205, 216, 232);
        doc.roundedRect(imgX, imgY, cellW, cellH, 5, 5);
        const fitted = await renderFittedImageDataUrl({
          sourceDataUrl: photos[i].dataUrl,
          targetW: cellW,
          targetH: cellH,
          mode: 'cover',
          radius: 5,
          background: '#ffffff',
        });
        if (fitted) {
          doc.addImage(fitted, 'JPEG', imgX, imgY, cellW, cellH, undefined, 'FAST');
        } else {
          drawImageCover(doc, photos[i].dataUrl, photos[i].format, imgX, imgY, cellW, cellH);
        }
        if (i % 3 === 2) await yieldToBrowser();
      }
    };

    const mediaBottom = pageHeight - margin;
    const mediaAvailableH = mediaBottom - y;
    if (galleryImages.length > 5 && mediaAvailableH > 150) {
      const mediaGap = 10;
      const photosW = Math.floor(maxTextWidth * 0.42);
      const mapW = maxTextWidth - photosW - mediaGap;
      await drawPhotoSection({
        x: margin,
        sectionY: y,
        sectionW: photosW,
        sectionH: mediaAvailableH,
        columns: 2,
      });
      await drawMapSection(
        margin + photosW + mediaGap,
        y,
        mapW,
        mediaAvailableH,
      );
      y += mediaAvailableH;
    } else {
      if (galleryImages.length > 0) {
        const galleryH = 94;
        await drawPhotoSection({
          x: margin,
          sectionY: y,
          sectionW: maxTextWidth,
          sectionH: galleryH,
          columns: 5,
        });
        y += galleryH + 10;
      }

      // Keep the map on the first page whenever the content leaves usable space.
      if (y > pageHeight - margin - 92) {
        doc.addPage();
        y = topMargin;
      }
      const mapH = pageHeight - y - margin;
      await drawMapSection(margin, y, maxTextWidth, mapH);
    }

    drawMaxxisAnalysisPage();
    await yieldToBrowser();

    const safeName = String(title || 'portfolio-release').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 64);
    const fileName = `${safeName || 'portfolio_release'}.pdf`;
    const pdfBlob = doc.output('blob');
    await yieldToBrowser();
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 15000);
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

  const buildMaxxisAnalysisPrompt = () => {
    return 'Show the factual published details for the property currently selected on screen. Identify missing fields, but do not calculate financial metrics, assess risk, judge deal quality, or make a recommendation.';
  };

  const handleAnalyzeWithMaxxis = () => {
    if (typeof onBlockedExport === 'function' && onBlockedExport() === false) return;
    if (typeof onAnalyzeWithMaxxis !== 'function') return;
    const source = buildExportPayload();
    const imageUrls = getExportImageUrls();
    onAnalyzeWithMaxxis({
      id: `maxxis-property-analysis-${item?.id || item?.address || Date.now()}-${Date.now()}`,
      title: source.title,
      prompt: buildMaxxisAnalysisPrompt(),
      propertyId: item?.id,
      onExportPdf: (analysisText) => generateReleasePdf({
        title: source.title,
        cardsDescription: source.cardsDescription,
        imageUrls,
        maxxisAnalysis: analysisText,
      }),
    });
    setEmailComposeOpen(false);
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
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
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
                <button
                  type="button"
                  onClick={handleAnalyzeWithMaxxis}
                  style={{
                    border: `1px solid ${C.accent}`,
                    background: C.alpha(C.accent, 0.14),
                    color: C.accent,
                    borderRadius: 9,
                    padding: '9px 8px',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {matchesT.exportAnalyzeWithMaxxis || 'Analyze with Maxxis Deal AI'}
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
