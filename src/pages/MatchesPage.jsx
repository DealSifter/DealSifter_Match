import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { C } from '../theme/colors';
import { useT } from '../i18n/translations';
import { PROPERTIES, CARDS, CATEGORIES, SERVICE_PORTFOLIO } from '../data/mockData';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { PlanGateModal } from '../components/modals/PlanGateModal';
import { PropertyCard } from '../components/cards/PropertyCard';
import { SwipeCard } from '../components/cards/SwipeCard';
import { SmartImage } from '../components/ui/SmartImage';
import { catIcon } from '../lib/catIcon';
import { buildDisplayContacts, normalizeContactMethod } from '../lib/contactPriority';
import { resolveScopedProfile, normalizeProfileScope } from '../lib/profileScopeResolver';
import { formatPropertyLocation } from '../lib/formatPropertyLocation';
import { translateChatText, getSafeLang } from '../services/chatTranslation';
import { getPlanGateCopy, isFeatureAllowed } from '../lib/planAccess';
import { trackAppEvent } from '../lib/adminEventTracking';
import { getPortfolioUnlockCost } from '../lib/unlockRules';
import appLogo from '../assets/logo.png';

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
  pt: 'Tenho interesse neste Serviço',
  en: 'I am interested in this Service',
  es: 'Tengo interés en este Servicio',
};

const DEFAULT_PEER_LANGS = { input: 'en', output: 'en' };

function readScopedProfileFallback(scope = 'personal') {
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

const PortfolioItem = ({ p, onOpen }) => {
  const [idx, setIdx] = useState(0);
  const imgs = p.images || [p.image];
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
      </div>
      <div style={{ padding:8 }}>
        <div style={{ fontSize:10, fontWeight:800, color:C.t1, marginBottom:2, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap" }}>{p.address}</div>
        {p.publishToShowcase === false ? (
          <div style={{ fontSize:9, fontWeight:800, color:C.danger, marginBottom:2, textTransform:'uppercase' }}>
            Stand By
          </div>
        ) : null}
        <div style={{ fontSize:10, color:C.gold, fontWeight:700 }}>${Number(p.price || 0).toLocaleString('en-US')}</div>
      </div>
    </div>
  );
};

// ── Always-visible contact chips ───────────────────────────────────────────
function ContactButtons({ item, variant = 'default', isMobile = false, desktopRightToLeft = false }) {
  const modalsT = useT('matches').modals;
  const [copied, setCopied] = useState(null);
  const [copyNotice, setCopyNotice] = useState('');
  const copyResetRef = useRef(null);
  const copyNoticeResetRef = useRef(null);

  useEffect(() => () => {
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    if (copyNoticeResetRef.current) window.clearTimeout(copyNoticeResetRef.current);
  }, []);

  const copy = async (key, val) => {
    const text = String(val || '').trim();
    if (!text) return;

    let copiedOk = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copiedOk = true;
      }
    } catch (e) {
      void e;
    }

    if (!copiedOk) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', 'true');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        copiedOk = document.execCommand('copy');
        ta.remove();
      } catch (e) {
        void e;
      }
    }

    if (!copiedOk) return;
    setCopied(key);
    if (copyResetRef.current) window.clearTimeout(copyResetRef.current);
    copyResetRef.current = window.setTimeout(() => setCopied(null), 1500);
    setCopyNotice(`${modalsT.copy} ✓`);
    if (copyNoticeResetRef.current) window.clearTimeout(copyNoticeResetRef.current);
    copyNoticeResetRef.current = window.setTimeout(() => setCopyNotice(''), 1200);
  };

  // If the contact fields are not present on the `item`, fall back to the
  // locally saved personal registration (localStorage.personalProfile).
  const shouldUseSavedProfile = !item?.id || item?.id === 999999 || item?.ownerId === 999999 || item?.id === 'preview-personal';
  let savedProfile = null;
  if (shouldUseSavedProfile) savedProfile = readScopedProfileFallback(normalizeProfileScope(item?.primaryProfile || 'personal'));

  const contacts = buildDisplayContacts(item, savedProfile, {
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

  const selectedMethods = (
    (Array.isArray(item?.contactMethods) && item.contactMethods.length
      ? item.contactMethods
      : (Array.isArray(savedProfile?.contactMethods) ? savedProfile.contactMethods : []))
  )
    .map((method) => normalizeContactMethod(method))
    .filter(Boolean);

  const priority2Method = selectedMethods[1] || null;
  const priority2Channel = ['sms', 'whatsapp', 'telegram'].includes(priority2Method)
    ? priority2Method
    : (selectedMethods.find((method) => ['sms', 'whatsapp', 'telegram'].includes(method)) || null);

  const priority2Contact = contacts.find((contact) => contact.priority === 2) || contacts[1] || null;
  const emailContact = contacts.find((contact) => String(contact?.icon || '').toLowerCase() === 'email') || null;
  const p2Value = String(item?.secondaryPhone || savedProfile?.secondaryPhone || priority2Contact?.val || '').trim();
  const emailValue = String(item?.email || savedProfile?.email || emailContact?.val || '').trim();

  const unlockedHeaderContacts = [
    {
      key: 'contact-priority-2',
      icon: priority2Channel || priority2Contact?.icon || 'sms',
      val: p2Value,
      priority: 2,
    },
    {
      key: 'contact-email-inline',
      icon: 'email',
      val: emailValue,
      priority: null,
    },
  ].filter((contact) => contact.val);

  const primaryContact = contacts.find((contact) => contact.priority === 1)
    || (String(item?.primaryPhone || item?.phone || savedProfile?.primaryPhone || savedProfile?.phone || '').trim()
      ? {
          key: 'contact-priority-1',
          icon: 'phone',
          val: String(item?.primaryPhone || item?.phone || savedProfile?.primaryPhone || savedProfile?.phone || '').trim(),
          priority: 1,
        }
      : null);

  const headerContacts = [primaryContact, ...unlockedHeaderContacts].filter((contact) => contact?.val);

  const isUnlockedHeader = variant === 'unlocked-header';
  const isUnlockedHeaderMobile = isUnlockedHeader && isMobile;
  const isUnlockedHeaderDesktop = isUnlockedHeader && !isMobile;
  const useDesktopRightAlignedFlow = isUnlockedHeaderDesktop && desktopRightToLeft;
  const contactsToRender = isUnlockedHeader
    ? (headerContacts.length ? headerContacts : contacts)
    : contacts;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
      <div style={{ display:"flex", flexDirection:isUnlockedHeaderMobile ? "column" : "row", flexWrap:isUnlockedHeaderDesktop ? "nowrap" : (isUnlockedHeader ? "nowrap" : "wrap"), gap:6, marginTop:6, justifyContent:isUnlockedHeaderMobile ? "center" : (useDesktopRightAlignedFlow ? "flex-end" : "flex-start"), alignItems:isUnlockedHeaderMobile ? "center" : "stretch", overflowX:isUnlockedHeaderDesktop ? "auto" : "visible" }}>
        {contactsToRender.map(({ key, icon, val, priority }) => (
          <button key={key} onClick={() => copy(key, val)}
            title={modalsT.copy}
            style={{
              display:"flex",
              alignItems:"center",
              justifyContent:isUnlockedHeaderMobile ? "center" : "flex-start",
              gap:6,
              width:isUnlockedHeaderMobile ? "100%" : "auto",
              flexShrink:isUnlockedHeaderDesktop ? 0 : 1,
              padding:isUnlockedHeader ? "7px 10px" : "5px 10px",
              borderRadius:8,
              background:copied===key?C.alpha(C.success, 0.15):(priority===1 ? C.alpha(C.accent, 0.12) : C.alpha(C.t1, 0.05)),
              border:`1px solid ${copied===key?C.success:(priority===1 ? C.accent : C.border)}`,
              boxShadow: priority===1 ? `0 0 0 1px ${C.alpha(C.accent, 0.12)}` : 'none',
              color:copied===key?C.success:C.t1,
              cursor:"pointer",
              fontSize:isUnlockedHeader ? 12 : 11,
              fontWeight:600,
              transition:"all .2s",
              whiteSpace:isUnlockedHeaderDesktop ? "nowrap" : "normal",
              textAlign:isUnlockedHeaderMobile ? "center" : "left",
              overflow:"hidden",
              textOverflow:"ellipsis",
            }}>
            <Icon name={copied===key?"check":icon} size={13} color={copied===key?C.success:C.t1} />
            <span>{val || "---"}</span>
            {priority ? (
              <span style={{ padding:"2px 6px", borderRadius:999, background:priority===1 ? C.accent : C.alpha(C.t1, 0.07), color:priority===1 ? '#fff' : C.t2, fontSize:9, fontWeight:800, letterSpacing:"0.2px" }}>
                {priority===1 ? modalsT.contactPriorityFirst : `P${priority}`}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {copyNotice ? (
        <div style={{ fontSize:10, color:C.success, textAlign:isUnlockedHeaderMobile ? "center" : (useDesktopRightAlignedFlow ? "right" : "left"), fontWeight:700 }}>
          {copyNotice}
        </div>
      ) : null}
    </div>
  );
}

function getLocalOwnerId(scopeKey) {
  try {
    const map = JSON.parse(localStorage.getItem('profileOwnerMap') || 'null');
    if (map && typeof map[scopeKey] !== 'undefined') return map[scopeKey];
  } catch (e) { void e; }
  return 999999;
}

function PortfolioDetail({ item, owner, ownerDesc, onBack, autoplayMedia = false, onBlockedExport = null }) {
  const allT = useT('matches');
  const matchesT = allT.matches;
  const modalsT = allT.modals;
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = item?.images?.length ? item.images : [item?.image].filter(Boolean);
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
  const [isPreparingExport, setIsPreparingExport] = useState(false);

  useEffect(() => {
    // Reset image index when item changes; defer to next tick to avoid
    // triggering a cascading render within the effect body.
    const t = setTimeout(() => setImgIdx(0), 0);
    return () => clearTimeout(t);
  }, [item?.id]);

  useEffect(() => {
    // Reset email fields when the selected item changes, restoring saved defaults.
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
  }, [item?.id]);

  const fmtMoney = (v) => {
    if (typeof v !== "number") return "-";
    return `$${Number(v || 0).toLocaleString('en-US')}`;
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
    const shouldUseSavedProfile = !owner?.id || owner?.id === 999999 || owner?.ownerId === 999999 || owner?.id === 'preview-personal';
    let savedProfile = null;
    if (shouldUseSavedProfile) savedProfile = readScopedProfileFallback(normalizeProfileScope(owner?.primaryProfile || item?.primaryProfile || 'personal'));
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

  const makeDealSifterWordmark = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Prefer Eras Bold ITC when available on the host OS.
      ctx.font = "bold 46px 'Eras Bold ITC', 'Eras Demi ITC', 'Arial Black', sans-serif";
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#101827';
      ctx.fillText('Deal', 0, 34);
      const dealW = ctx.measureText('Deal').width;
      ctx.fillStyle = '#35cac9';
      ctx.fillText('Sifter', dealW + 2, 34);
      return canvas.toDataURL('image/png');
    } catch (e) {
      void e;
      return null;
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
    const mainImage = await fetchImageData(imageUrls?.[0]);

    const safe = (v, fallback = '-') => {
      const s = normalizeExportText(v);
      return s && s !== '-' ? s : fallback;
    };

    const shouldUseSavedProfile = !owner?.id || owner?.id === 999999 || owner?.ownerId === 999999 || owner?.id === 'preview-personal';
    let savedProfile = null;
    if (shouldUseSavedProfile) savedProfile = readScopedProfileFallback(normalizeProfileScope(owner?.primaryProfile || item?.primaryProfile || 'personal'));

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
      ['Owner Name', ownerName],
      ['Type', ownerType],
      ['Address', ownerAddress],
      ['Owner Status', ownerStatus],
      ['Contact 1', ownerContacts[0] ? `${safe(ownerContacts[0].label)}: ${safe(ownerContacts[0].val)}` : 'No unlocked contacts'],
      ['Contact 2', ownerContacts[1] ? `${safe(ownerContacts[1].label)}: ${safe(ownerContacts[1].val)}` : '-'],
      ['Contact 3', ownerContacts[2] ? `${safe(ownerContacts[2].label)}: ${safe(ownerContacts[2].val)}` : '-'],
    ];

    const panelRowsProperty = [
      ['Title', safe(item?.address || title)],
      ['Price', fmtMoney(item?.price)],
      ['Type', safe(item?.type)],
      ['Strategy', safe(item?.objective)],
      ['Cap Rate', item?.capRate ? `${item.capRate}%` : '-'],
      ['Beds', `${item?.beds > 0 ? item.beds : '-'}`],
      ['Baths', `${item?.baths > 0 ? item.baths : '-'}`],
      ['Living Area', safe(item?.sqft)],
      ['Rehab', fmtMoney(item?.rehab || 0)],
      ['ZIP', safe(item?.zip)],
    ];

    const panelRowsLand = [
      ['Location', `${safe(item?.city)}, ${safe(item?.state)} ${safe(item?.zip, '')}`.trim()],
      ['Deal Tag', safe(item?.dealTag)],
      ['Source', safe(item?.source)],
      ['Lot Size', safe(item?.lot)],
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

    // Header (no background box): logo + app name.
    if (logo) {
      drawImageContain(doc, logo.dataUrl, logo.format, margin, y + 2, 26, 26);
    }
    const wordmarkData = makeDealSifterWordmark();
    if (wordmarkData) {
      doc.addImage(wordmarkData, 'PNG', margin + 40, y + 3, 118, 22, undefined, 'FAST');
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 31, 47);
      doc.setFontSize(17);
      doc.text('Deal', margin + 40, y + 18);
      const dealWidth = doc.getTextWidth('Deal');
      doc.setTextColor(53, 202, 201);
      doc.text('Sifter', margin + 40 + dealWidth + 2, y + 18);
    }
    y += 44;

    const heroH = 138;
    const heroGap = 14;
    const heroLeftW = Math.floor((maxTextWidth - heroGap) * 0.52);
    const heroRightW = maxTextWidth - heroLeftW - heroGap;
    const heroRightX = margin + heroLeftW + heroGap;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(213, 221, 233);
    doc.roundedRect(margin, y, heroLeftW, heroH, 8, 8, 'FD');

    // Move generated timestamp to the right, above the main photo.
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(92, 102, 117);
    doc.setFontSize(9.5);
    doc.text(`Generated: ${new Date().toLocaleString()}`, heroRightX, y - 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 35, 50);
    doc.setFontSize(20);
    const heroTitle = doc.splitTextToSize(safe(item?.address || title), heroLeftW - 16);
    doc.text(heroTitle[0] || '-', margin + 8, y + 26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(58, 68, 84);
    doc.setFontSize(11.5);
    doc.text(`${safe(item?.city)}, ${safe(item?.state)} ${safe(item?.zip, '')}`.trim(), margin + 8, y + 44);

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
      doc.setFillColor(239, 244, 252);
      doc.setDrawColor(210, 220, 235);
      doc.roundedRect(chipX, y + 66, chipW, 18, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(61, 80, 111);
      doc.setFontSize(8.5);
      doc.text(chip, chipX + 6, y + 78);
      chipX += chipW + 6;
      if (chipX > margin + heroLeftW - 80) break;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(72, 84, 102);
    const noteSnippet = safe(item?.description || ownerNotes || '-', '-');
    const noteLines = doc.splitTextToSize(noteSnippet, heroLeftW - 16);
    doc.text((noteLines[0] || '-') + (noteLines[1] ? '...' : ''), margin + 8, y + 114);

    if (mainImage) {
      // Single image occupying the full right hero element (no nested inner image container).
      doc.setDrawColor(205, 216, 232);
      doc.roundedRect(heroRightX, y, heroRightW, heroH, 8, 8);
      const fitted = await renderFittedImageDataUrl({
        sourceDataUrl: mainImage.dataUrl,
        targetW: heroRightW,
        targetH: heroH,
        mode: 'cover',
        radius: 8,
        background: '#ffffff',
      });
      if (fitted) {
        doc.addImage(fitted, 'JPEG', heroRightX, y, heroRightW, heroH, undefined, 'FAST');
      } else {
        drawImageCover(doc, mainImage.dataUrl, mainImage.format, heroRightX, y, heroRightW, heroH);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(140, 150, 165);
      doc.setFontSize(10);
      doc.text('NO IMAGE AVAILABLE', heroRightX + 12, y + 24);
    }
    y += heroH + 12;

    const panelGap = 10;
    const panelW = Math.floor((maxTextWidth - panelGap * 2) / 3);
    const panelH = 198;
    drawPanel('Owner Information', panelRowsOwner, margin, y, panelW, panelH);
    drawPanel('Property Characteristics', panelRowsProperty, margin + panelW + panelGap, y, panelW, panelH);
    drawPanel('Land Information', panelRowsLand, margin + (panelW + panelGap) * 2, y, panelW, panelH);
    y += panelH + 10;

    // Full-width intermediate Notes block between the 3 columns and the map section.
    const notesBlockH = 72;
    doc.setFillColor(249, 250, 252);
    doc.setDrawColor(208, 216, 229);
    doc.roundedRect(margin, y, maxTextWidth, notesBlockH, 6, 6, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 56, 72);
    doc.setFontSize(10.5);
    doc.text('Notes', margin + 8, y + 16);
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
      const lat = Number(item?.lat);
      const lng = Number(item?.lng);
      const canRenderMap = Number.isFinite(lat) && Number.isFinite(lng);
      doc.setFillColor(249, 250, 252);
      doc.setDrawColor(208, 216, 229);
      doc.roundedRect(margin, y, maxTextWidth, mapH, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(46, 56, 72);
      doc.setFontSize(10.5);
      doc.text('Property Map Snapshot', margin + 8, y + 16);

      const mapX = margin + 8;
      const mapY = y + 24;
      const mapW = maxTextWidth - 16;
      const mapInnerH = mapH - 32;
      doc.setDrawColor(205, 216, 232);
      doc.roundedRect(mapX, mapY, mapW, mapInnerH, 5, 5);

      if (canRenderMap) {
        const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=14&size=1200x600&markers=${lat},${lng},red-pushpin`;
        const mapImage = await fetchImageData(mapUrl);
        if (mapImage) {
          drawImageContain(doc, mapImage.dataUrl, mapImage.format, mapX + 1, mapY + 1, mapW - 2, mapInnerH - 2);
        } else {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(110, 120, 132);
          doc.text('Map preview unavailable at the moment.', mapX + 10, mapY + 20);
        }
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(110, 120, 132);
        doc.text('Coordinates unavailable for this property.', mapX + 10, mapY + 20);
      }
    }

    for (let i = 1; i < imageUrls.length; i += 2) {
      doc.addPage();
      const slotGap = 12;
      const headerH = 18;
      const slotW = pageWidth - margin * 2;
      const slotH = Math.floor((pageHeight - margin * 2 - slotGap) / 2);

      for (let slot = 0; slot < 2; slot += 1) {
        const imgIndex = i + slot;
        if (imgIndex >= imageUrls.length) break;
        const url = imageUrls[imgIndex];
        if (!url) continue;
        try {
          const img = await fetchImageData(url);
          if (!img) continue;

          const slotY = margin + slot * (slotH + slotGap);
          const imgTop = slotY + headerH + 6;
          const imgH = slotH - headerH - 8;

          doc.setFillColor(245, 249, 255);
          doc.setDrawColor(218, 227, 240);
          doc.roundedRect(margin, slotY, slotW, headerH, 6, 6, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(43, 67, 103);
          doc.setFontSize(10.5);
          doc.text(`Property Photo ${imgIndex + 1}`, margin + 8, slotY + 12);

          doc.setDrawColor(205, 216, 232);
          doc.roundedRect(margin, imgTop, slotW, imgH, 8, 8);
          drawImageContain(doc, img.dataUrl, img.format, margin + 2, imgTop + 2, slotW - 4, imgH - 4);
        } catch (e) {
          void e;
        }
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
      exportPdfLocal: Boolean(exportPdfLocal),
      exportPhotosLocal: Boolean(exportPhotosLocal),
      exportPdfWithEmail: Boolean(exportPdfWithEmail),
      exportPhotosWithEmail: Boolean(exportPhotosWithEmail),
    };
    try { localStorage.setItem('ds_export_mail_defaults', JSON.stringify(payload)); } catch (e) { void e; }

    const imageUrls = Array.isArray(item?.images) && item.images.length
      ? item.images.filter(Boolean)
      : [item?.image].filter(Boolean);

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
      [matchesT.rehab, fmtMoney(item.rehab || 0)],
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
          <div style={{ fontSize:12, fontWeight:800, color:C.t1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.address}</div>
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
              <div style={{ fontSize:19, color:C.t1, fontWeight:900, lineHeight:1.1, marginTop:2 }}>{fmtMoney(item.price)}</div>
            </div>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 10px", background:C.alpha(C.success, 0.08) }}>
              <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.45px" }}>{matchesT.capRate}</div>
              <div style={{ fontSize:19, color:C.t1, fontWeight:900, lineHeight:1.1, marginTop:2 }}>{item.capRate ? `${item.capRate}%` : "-"}</div>
            </div>
            <div style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:"8px 10px", background:C.alpha(C.accent, 0.08) }}>
              <div style={{ fontSize:9, color:C.t3, textTransform:"uppercase", letterSpacing:"0.45px" }}>{matchesT.rehab}</div>
              <div style={{ fontSize:19, color:C.t1, fontWeight:900, lineHeight:1.1, marginTop:2 }}>{fmtMoney(item.rehab || 0)}</div>
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
        <ContactButtons item={item} />
      </div>

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
            <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>Email recipients</div>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>To</span>
              <input
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="recipient@company.com"
                style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, outline: 'none' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>Cc</span>
              <input
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                placeholder="copy@company.com"
                style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, outline: 'none' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>Bcc</span>
              <input
                value={emailBcc}
                onChange={(e) => setEmailBcc(e.target.value)}
                placeholder="hidden@company.com"
                style={{ padding: '9px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t1, outline: 'none' }}
              />
            </label>
            <div style={{ fontSize: 10, color: C.t3 }}>
              These values are saved as your default for future exports.
            </div>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'grid', gap: 8 }}>
              <div style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>Export options</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                <input type="checkbox" checked={exportPdfLocal} onChange={(e) => setExportPdfLocal(e.target.checked)} />
                Download portfolio release PDF to PC
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                <input type="checkbox" checked={exportPhotosLocal} onChange={(e) => setExportPhotosLocal(e.target.checked)} />
                Download property photos separately to PC
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                <input type="checkbox" checked={exportPdfWithEmail} onChange={(e) => setExportPdfWithEmail(e.target.checked)} />
                Prepare PDF to include with email
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: C.t1 }}>
                <input type="checkbox" checked={exportPhotosWithEmail} onChange={(e) => setExportPhotosWithEmail(e.target.checked)} />
                Prepare separate photos to include with email
              </label>
              <div style={{ fontSize: 10, color: C.t3 }}>
                Email attachments are prepared locally and can be attached manually in your email client.
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setEmailComposeOpen(false)}
                style={{ border:`1px solid ${C.border}`, background:'transparent', color:C.t2, borderRadius:8, padding:'7px 10px', fontSize:11, cursor:'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEmailExport}
                disabled={isPreparingExport}
                style={{ border:'none', background:C.accent, color:'#fff', borderRadius:8, padding:'7px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}
              >
                {isPreparingExport ? 'Preparing...' : 'Continue'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

export function MatchesPage({ nuggets, setModal, openUnlock, unlocked, initialChat, chatFocusToken = 0, interested, matched, setInterested, setMatched, convos, setConvos, categoryOrder, setCategoryOrder, showcaseProperties, propertyPortfolio, servicePortfolio, userProfile, personalProfile, professionalProfile, mobileBottomNavCollapsed = false, userPreferences = null, subscription = null, setPage = null, addToast = null, onOpenChatLanguageConfig = null, propertyUnlocks = [], currentUserId = 'local-user' }) {
  void propertyUnlocks;
  void currentUserId;
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
  const msgInputRef = useRef(null);
  const splitPaneRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Resizing logic
  const [portfolioWidth, setPortfolioWidth] = useState(DESKTOP_PORTFOLIO_WIDTH);
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

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = "default";
    document.body.style.userSelect = "auto";
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing.current || !splitPaneRef.current) return;
    const rect = splitPaneRef.current.getBoundingClientRect();
    const nextWidth = rect.right - e.clientX;
    const hardMax = Math.max(0, Math.min(DESKTOP_PORTFOLIO_MAX_WIDTH, rect.width - DESKTOP_CHAT_MIN_WIDTH - 4));
    const effectiveMin = Math.min(DESKTOP_PORTFOLIO_MIN_WIDTH, hardMax);
    const clamped = Math.max(effectiveMin, Math.min(nextWidth, hardMax));
    setPortfolioWidth(clamped);
  }, [DESKTOP_CHAT_MIN_WIDTH, DESKTOP_PORTFOLIO_MAX_WIDTH, DESKTOP_PORTFOLIO_MIN_WIDTH]);

  const startResizing = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onUp = () => {
      stopResizing();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", onUp);
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
  const CONTACT_SIGNAL = C.accent;
  const PROPERTY_SIGNAL = "#4381bc";
  const personalOwnerId = useMemo(() => getLocalOwnerId('personal'), []);
  const secondaryOwnerId = useMemo(() => getLocalOwnerId('secondary'), []);
  const fsboOwnerId = useMemo(() => getLocalOwnerId('fsbo'), []);
  // Use module-scope CHAT_REPLY_TEMPLATES, CHAT_INTEREST_PREFIX and DEFAULT_PEER_LANGS
  // (defined at top of file) to keep references stable for hook dependencies.
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [interestsFilter, setInterestsFilter] = useState("all");
  const [peopleCategoryDropdownOpen, setPeopleCategoryDropdownOpen] = useState(false);
  const [interestsStateDropdownOpen, setInterestsStateDropdownOpen] = useState(false);
  const [selectedPeopleCategories, setSelectedPeopleCategories] = useState([]);
  const [selectedInterestStates, setSelectedInterestStates] = useState([]);

  // Combined sources: user data merged with mock seed data for mock card owners.
  // Uses String() comparison and deduplication by id so user's own records always win.
  const allPropertiesSource = useMemo(() => {
    const userProps = propertyPortfolio || showcaseProperties || [];
    const userIds = new Set(userProps.map((p) => String(p.id)));
    return [...userProps, ...PROPERTIES.filter((p) => !userIds.has(String(p.id)))];
  }, [propertyPortfolio, showcaseProperties]);

  const allServicesSource = useMemo(() => {
    const userSvcs = servicePortfolio || [];
    const userIds = new Set(userSvcs.map((s) => String(s.id)));
    return [...userSvcs, ...SERVICE_PORTFOLIO.filter((s) => !userIds.has(String(s.id)))];
  }, [servicePortfolio]);

  const buildLocalOwnerCard = useCallback((scope = 'personal') => {
    const normalizedScope = normalizeProfileScope(scope);
    const ownerKey = normalizedScope === 'professional'
      ? 'secondary'
      : (normalizedScope === 'fsbo' ? 'fsbo' : 'personal');
    const ownerId = getLocalOwnerId(ownerKey);
    const scopedIdentity = resolveScopedProfile(normalizedScope, {
      accountType: userProfile?.accountType || '',
      userProfile,
      personalProfile,
      professionalProfile,
    });
    const scopedProperties = allPropertiesSource.filter((p) => (
      String(p.ownerId) === String(ownerId)
      && normalizeProfileScope(p.primaryProfile || 'personal') === normalizedScope
    ));
    const scopedServices = allServicesSource.filter((s) => (
      String(s.ownerId) === String(ownerId)
      && normalizeProfileScope(s.primaryProfile || 'personal') === normalizedScope
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
  }, [allPropertiesSource, allServicesSource, personalProfile, professionalProfile, userProfile]);

  const resolveContactCard = useCallback((cardLike, scopeHint = null) => {
    if (!cardLike) return null;
    const resolvedScope = normalizeProfileScope(scopeHint || cardLike.primaryProfile || (
      String(cardLike.id) === String(secondaryOwnerId) || String(cardLike.ownerId) === String(secondaryOwnerId)
        ? 'professional'
        : (String(cardLike.id) === String(fsboOwnerId) || String(cardLike.ownerId) === String(fsboOwnerId)
          ? 'fsbo'
          : 'personal')
    ));
    const isLocalCard =
      String(cardLike.id) === String(personalOwnerId) ||
      String(cardLike.id) === String(secondaryOwnerId) ||
      String(cardLike.id) === String(fsboOwnerId) ||
      String(cardLike.ownerId) === String(personalOwnerId) ||
      String(cardLike.ownerId) === String(secondaryOwnerId) ||
      String(cardLike.ownerId) === String(fsboOwnerId);
    if (!isLocalCard) return cardLike;
    return {
      ...cardLike,
      ...buildLocalOwnerCard(resolvedScope),
      primaryProfile: resolvedScope,
    };
  }, [buildLocalOwnerCard, fsboOwnerId, personalOwnerId, secondaryOwnerId]);
  const formatTemplate = useCallback((template, values) => {
    let out = String(template || '');
    Object.entries(values || {}).forEach(([key, value]) => {
      out = out.replace(`{${key}}`, String(value));
    });
    return out;
  }, []);

  const allMatched = useMemo(() =>
    matched
      .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
      .map((m) => resolveContactCard(m)),
  [matched, resolveContactCard]);

  const parseStateCode = useCallback((value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    const m = raw.match(/(?:,\s*|\b)([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?\s*$/);
    return m ? m[1].toUpperCase() : null;
  }, []);

  const peopleCategoryOptions = useMemo(() => {
    const categoryLabelById = new Map();
    CATEGORIES.forEach((c) => {
      categoryLabelById.set(c.id, c.label);
      (c.sub || []).forEach((s) => categoryLabelById.set(s.id, s.label));
    });
    const unique = new Map();
    allMatched.forEach((m) => {
      const key = String(m?.cat || '').trim().toLowerCase();
      if (!key) return;
      if (!unique.has(key)) unique.set(key, categoryLabelById.get(key) || m?.type || key);
    });
    return Array.from(unique.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allMatched]);

  const interestStateOptions = useMemo(() => {
    const states = Array.from(new Set(
      interested
        .map((p) => parseStateCode(p?.city || p?.loc || p?.address || ''))
        .filter(Boolean)
    ));
    states.sort();
    return states;
  }, [interested, parseStateCode]);

  const filteredMatched = useMemo(() => {
    const list = allMatched.filter(m => {
      const paid = unlocked.includes(m.id);
      if (peopleFilter === "paid") return paid;
      if (peopleFilter === "locked") return !paid;
      if (selectedPeopleCategories.length > 0) {
        const cat = String(m?.cat || '').trim().toLowerCase();
        if (!selectedPeopleCategories.includes(cat)) return false;
      }
      return true;
    });
    if (sortOrder === 'name_asc') return [...list].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')));
    return list;
  }, [allMatched, peopleFilter, unlocked, selectedPeopleCategories, sortOrder]);

  const filteredInterested = useMemo(() => {
    const list = interested.filter(p => {
      const paid = unlocked.includes(p.ownerId);
      if (interestsFilter === "paid") return paid;
      if (interestsFilter === "locked") return !paid;
      if (selectedInterestStates.length > 0) {
        const state = parseStateCode(p?.city || p?.loc || p?.address || '');
        if (!state || !selectedInterestStates.includes(state)) return false;
      }
      return true;
    });
    if (sortOrder === 'price_desc') return [...list].sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
    return list;
  }, [interested, interestsFilter, unlocked, selectedInterestStates, parseStateCode, sortOrder]);

  const isActiveProperty = active?.address !== undefined;
  const activeContactId = useMemo(() => {
    if (!active) return null;
    return isActiveProperty ? active.ownerId : active.id;
  }, [active, isActiveProperty]);

  const activeOwner = useMemo(() => {
    if (!active) return null;
    if (!isActiveProperty) return resolveContactCard(active);
    if (active.ownerPreview) return resolveContactCard(active.ownerPreview, normalizeProfileScope(active.primaryProfile || active.ownerPreview?.primaryProfile || null));
    const activeScope = normalizeProfileScope(active.primaryProfile || (
      String(active.ownerId) === String(secondaryOwnerId)
        ? 'professional'
        : (String(active.ownerId) === String(fsboOwnerId) ? 'fsbo' : 'personal')
    ));
    if (
      String(active.ownerId) === String(personalOwnerId)
      || String(active.ownerId) === String(secondaryOwnerId)
      || String(active.ownerId) === String(fsboOwnerId)
    ) {
      return buildLocalOwnerCard(activeScope);
    }
    return CARDS.find(c => c.id === active.ownerId);
  }, [active, isActiveProperty, resolveContactCard, secondaryOwnerId, fsboOwnerId, personalOwnerId, buildLocalOwnerCard]);

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

  const isUnlocked = useMemo(() => 
    activeOwner && unlocked.includes(activeOwner.id),
  [activeOwner, unlocked]);

  const activeUnlockCost = useMemo(() => {
    if (!activeOwner?.id) return 1;
    return getPortfolioUnlockCost(activeOwner, allPropertiesSource, allServicesSource);
  }, [activeOwner, allPropertiesSource, allServicesSource]);

  const getUnlockCost = useCallback((ownerId) => {
    if (!ownerId) return 1;
    return getPortfolioUnlockCost(ownerId, allPropertiesSource, allServicesSource);
  }, [allPropertiesSource, allServicesSource]);
  
  const currentMsgs = useMemo(() => 
    (activeOwner && convos) ? (convos[activeOwner.id] || []) : [],
  [activeOwner, convos]);

  const portfolioItems = useMemo(() => {
    if (!activeOwner) return [];
    return allPropertiesSource.filter((p) => String(p.ownerId) === String(activeOwner.id));
  }, [activeOwner, allPropertiesSource]);

  const [portfolioTab, setPortfolioTab] = useState('properties');
  const [portfolioShowAll, setPortfolioShowAll] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 767);
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
    const onResize = () => setIsMobile(window.innerWidth <= 767);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMsgs.length, isTyping]);

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

  const handleSend = useCallback(async (customMsg, type = "text", refData = null) => {
    if (!activeOwner) return;
    if (!canUseChat) {
      blockFeature('chat');
      return;
    }
    const content = (typeof customMsg === 'string' ? customMsg : "") || msg;
    if (!content.trim() && !refData) return;

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

    if (typeof customMsg !== 'string') setMsg("");

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
  ]);

  const mobileBottomNavOffset = isMobile ? (mobileBottomNavCollapsed ? 4 : 88) : 0;
  const previewFeedCardWidth = isMobile ? 360 : 654;
  const previewFeedCardHeight = isMobile ? 576 : 400;
  const previewModalMaxWidth = isMobile ? 420 : 730;

  return (
    <div style={{ paddingTop:58, paddingBottom:mobileBottomNavOffset, height:"calc(var(--app-vh, 1vh) * 100)", boxSizing:"border-box", display:"flex", flexDirection:"column", background:C.bg }}>
      <style>{`
        .map-panel-tabs { display: flex; gap: 4px; margin-bottom: 12px; padding-bottom: 2px; border-bottom: 1px solid var(--ui-border); }
        .map-panel-tab { flex: none; white-space: nowrap; padding: 8px 14px 7px; border-top-left-radius: 10px; border-top-right-radius: 10px; border-bottom-left-radius: 0; border-bottom-right-radius: 0; border: 1px solid transparent; border-bottom: 1px solid transparent; background: var(--ui-hover); color: ${C.t2}; font-size: 12px; font-weight: 600; cursor: pointer; margin-bottom: -3px; transition: all .15s ease; }
        .map-panel-tab.active { border-color: var(--ui-border); border-bottom-color: var(--ui-surface); background: var(--ui-surface); color: ${C.t1}; box-shadow: inset 0 2px 0 var(--ui-active); }
        .map-panel-tab:hover { color: ${C.t1}; background: var(--ui-hover); }
        .matches-mobile-tabbar { display: none; }
        .matches-chat-mobile-tabs { display: none; }
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
      `}</style>
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        
        <div style={{ width:520, flexShrink:0, borderRight:`1px solid ${C.border}`, background:C.card, display:"flex", flexDirection:"column" }} className="matches-sidebar">
          
          <div style={{ padding:16, borderBottom:`1px solid ${C.border}` }}>
            <h2 style={{ fontWeight:800, fontSize:16, display:"flex", alignItems:"center", gap:8 }}>
              <Icon name="chat" size={16} color={C.accent} /> {t.allMatches}
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
              <div style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:C.t3, background:C.alpha(C.bg, 0.4), textTransform:"uppercase", display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
                <span style={{ color:C.t1 }}>{t.people} ({filteredMatched.length})</span>
                <div style={{ display:"flex", gap:4 }}>
                  {[
                    { id:"all", label:t.all },
                    { id:"paid", label:t.paid },
                    { id:"locked", label:cardsT.locked },
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
                {filteredMatched.map(m => {
                  const isLinkedContact = activeContactId === m.id;
                  const isContactUnlocked = unlocked.includes(m.id);
                  const contactUnlockCost = getUnlockCost(m.id);
                  const contactIncomingCount = Array.isArray(convos?.[m.id])
                    ? convos[m.id].filter((message) => message?.from !== 'me').length
                    : 0;
                  const seenIncomingCount = seenIncomingByContact[m.id] || 0;
                  const contactUnreadCount = Math.max(0, contactIncomingCount - seenIncomingCount);
                  return (
                    <div key={m.id} onClick={() => setActive(m)} style={{ display:"flex", alignItems:"center", gap:10, padding:12, borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:isLinkedContact?C.alpha(CONTACT_SIGNAL, 0.12):"transparent" }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", overflow:"hidden", border:`1px solid ${isLinkedContact?CONTACT_SIGNAL:C.border}` }}>
                        <SmartImage src={m.photo} alt={m.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} fallback={<div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:"100%", height:"100%" }}><Icon name={catIcon(m.cat)} size={14} color={C.accent} /></div>} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:12, color:isLinkedContact?CONTACT_SIGNAL:C.t1, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap" }}>{m.name}</div>
                        <div style={{ fontSize:10, color:C.t3, display:"flex", alignItems:"center", gap:4 }}>
                          <span style={{ color:isContactUnlocked ? C.success : C.gold, fontWeight:700 }}>{isContactUnlocked ? cardsT.unlocked : `${cardsT.locked} · ${contactUnlockCost}★`}</span>
                          <span>{m.type}</span>
                          {isContactUnlocked && contactUnreadCount > 0 ? (
                            <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:16, height:16, padding:'0 4px', borderRadius:999, background:C.alpha(C.danger, 0.2), border:`1px solid ${C.alpha(C.danger, 0.55)}`, color:C.danger, fontSize:9, fontWeight:800 }}>
                              {contactUnreadCount > 99 ? '99+' : contactUnreadCount}
                            </span>
                          ) : null}
                          {m.primaryProfile === 'professional' ? (
                            <span style={{ padding:"1px 6px", borderRadius:999, background:C.alpha(C.accent, 0.12), border:`1px solid ${C.alpha(C.accent, 0.25)}`, color:C.accent, fontSize:9, fontWeight:800 }}>
                              {t.professionalBadge || 'Business'}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); if(active?.id === m.id) setActive(null); setMatched(p=>p.filter(x=>x.id!==m.id)); }}
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
                })}
              </div>
            </div>
            <div style={{ flex:1, display:"flex", flexDirection:"column" }} className="matches-col-interests">
              <div style={{ padding:"8px 10px", fontSize:10, fontWeight:700, color:C.gold, background:C.alpha(C.bg, 0.4), textTransform:"uppercase", display:"flex", alignItems:"center", justifyContent:"space-between", gap:6 }}>
                <span style={{ color:C.t1 }}>{t.interests} ({filteredInterested.length})</span>
                <div style={{ display:"flex", gap:4 }}>
                  {[
                    { id:"all", label:t.all },
                    { id:"paid", label:t.paid },
                    { id:"locked", label:cardsT.locked },
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
                {filteredInterested.map(p => {
                  const isLinkedProperty = activeContactId === p.ownerId;
                  const isOwnerUnlocked = unlocked.includes(p.ownerId);
                  const ownerUnlockCost = getUnlockCost(p.ownerId);
                  const owner = p.ownerPreview
                    ? resolveContactCard(p.ownerPreview, p.primaryProfile || p.ownerPreview?.primaryProfile || null)
                    : (
                      String(p.ownerId) === String(personalOwnerId) || String(p.ownerId) === String(secondaryOwnerId) || String(p.ownerId) === String(fsboOwnerId)
                        ? buildLocalOwnerCard(p.primaryProfile || (String(p.ownerId) === String(secondaryOwnerId) ? 'professional' : (String(p.ownerId) === String(fsboOwnerId) ? 'fsbo' : 'personal')))
                        : CARDS.find(c => c.id === p.ownerId)
                    );
                  return (
                    <div key={p.id} onClick={() => setActive(p)} style={{ display:"flex", alignItems:"center", gap:10, padding:12, borderBottom:`1px solid ${C.border}`, cursor:"pointer", background:isLinkedProperty?C.alpha(PROPERTY_SIGNAL, 0.12):"transparent" }}>
                      <div style={{ width:32, height:32, borderRadius:6, overflow:"hidden", border:`1px solid ${isLinkedProperty?PROPERTY_SIGNAL:C.border}` }}>
                        <SmartImage src={p.images?.[0] || p.image} alt={p.address} style={{ width:"100%", height:"100%", objectFit:"cover" }} fallback={<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", background:C.alpha(C.t1, 0.05) }}><Icon name="home" size={14} color={C.t3} /></div>} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:11, color:isLinkedProperty?PROPERTY_SIGNAL:C.t1, textOverflow:"ellipsis", overflow:"hidden", whiteSpace:"nowrap" }}>{p.address}</div>
                        <div style={{ fontSize:9, color:C.gold }}>${(p.price/1000).toFixed(0)}K</div>
                        <div style={{ fontSize:10, color:C.t3, display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          <span style={{ color:isOwnerUnlocked ? C.success : C.gold, fontWeight:700 }}>{isOwnerUnlocked ? cardsT.unlocked : `${cardsT.locked} · ${ownerUnlockCost}★`}</span>
                          <span>{t.by} {owner?.name || "..."}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); if(active?.id === p.id) setActive(null); setInterested(prev=>prev.filter(x=>x.id!==p.id)); }}
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
                })}
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
              <Icon name="lock" size={64} color={C.gold} style={{ marginBottom:20 }} />
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
                      <div style={{ fontWeight:800, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{isActiveProperty ? active.address : active.name}</div>
                      <div style={{ fontSize:11, color:C.success }}>{t.onlineBy} · {activeOwner.name}</div>
                    </div>
                    {!isMobile ? (
                      <div style={{ minWidth:0, maxWidth:'64%', display:'flex', justifyContent:'flex-end', alignSelf:'flex-start' }}>
                        <ContactButtons item={activeOwner} variant="unlocked-header" isMobile={false} desktopRightToLeft />
                      </div>
                    ) : null}
                  </div>
                </div>
                {isMobile ? (
                  <div style={{ marginTop:10 }}>
                        <ContactButtons item={activeOwner} variant="unlocked-header" isMobile />
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
              <div ref={splitPaneRef} style={{ flex:1, display:"flex", overflow:"hidden", minWidth:0 }}>
                <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", borderRight:`1px solid ${C.border}`, position:'relative' }} className="matches-chat-col">
                  <div style={{ position:'absolute', top:10, left:10, zIndex:3, display:'inline-flex', flexDirection:'column', alignItems:'stretch', gap:6, background:C.alpha(C.bg, 0.92), border:`1px solid ${C.border}`, borderRadius:10, padding:'4px 6px' }}>
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
                      title="Configuration"
                      aria-label="Configuration"
                      style={{ height:24, borderRadius:6, border:`1px solid ${C.border}`, background:C.card, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer', padding:'0 8px', color:C.t2, fontSize:10, fontWeight:700 }}
                    >
                      <Icon name="globe" size={12} color={C.t2} />
                      <span>Configuration</span>
                    </button>
                  </div>
                  <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"46px 20px 20px", display:"flex", flexDirection:"column", gap:12 }}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={e => {
                      e.preventDefault(); setIsDragging(false);
                      const data = JSON.parse(e.dataTransfer.getData("property"));
                      handleSend("", "reference", data);
                    }}
                  >
                    {currentMsgs.map((m, i) => (
                      <div key={i} style={{ display:"flex", justifyContent:m.from==="me"?"flex-end":"flex-start" }}>
                        <div style={{ maxWidth:"80%", padding:m.type==="reference"?8:12, borderRadius:12, background:m.from==="me"?C.alpha(C.accent, 0.5):C.bg, border:`1px solid ${m.from==="me"?C.alpha(C.accent, 0.7):C.border}`, color:m.from==="me"?C.t1:C.t1 }}>
                          {m.type === "reference" ? (
                             <div style={{ width:200 }}>
                               <SmartImage src={m.refData.images?.[0] || m.refData.image || m.refData.media?.images?.[0]} alt={m.refData.address || m.refData.name || m.refData.title} style={{ width:"100%", height:100, borderRadius:8, objectFit:"cover" }} fallback={<div style={{ width:"100%", height:100, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", background:C.alpha(C.t1,0.05) }}><Icon name="home" size={18} color={C.t3} /></div>} />
                               <div style={{ padding:8, fontSize:12 }}>{m.refData.address || m.refData.name || m.refData.title}</div>
                             </div>
                          ) : (
                            <>
                              <div style={{ fontSize:chatMainTextSize }}>{m.text}</div>
                              {m.originalText && m.originalText !== m.text && (
                                <div style={{ marginTop:6, paddingTop:6, borderTop:`1px dashed ${C.alpha(C.t1, 0.2)}`, fontSize:10, opacity:0.9 }}>
                                  {t.originalTextLabel} ({String(m.originalLang || '').toUpperCase()}): {m.originalText}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
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
                    onMouseDown={startResizing}
                    style={{ width:4, cursor:"col-resize", background:C.border, transition:"background .2s", zIndex:10 }}
                    onMouseEnter={e => e.currentTarget.style.background = C.accent}
                    onMouseLeave={e => e.currentTarget.style.background = C.border}
                  />
                )}
                
                <div style={{ width:portfolioWidth, minWidth:0, maxWidth:DESKTOP_PORTFOLIO_MAX_WIDTH, overflowY:"auto", padding:20, flexShrink:0, boxSizing:"border-box" }} className="desktop-only matches-portfolio-col">
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:C.t3, letterSpacing:"0.5px" }}>{t.portfolio.toUpperCase()}</div>
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
                        ownerDesc={ownerDesc}
                        onBack={() => setSelectedPortfolioItem(null)}
                        autoplayMedia={autoplayMedia}
                        onBlockedExport={guardExportPdf}
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
                        <div style={{ width: '100%', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.alpha(C.t1,0.02), borderRadius: 8, overflow: 'hidden' }}>
                          {(selectedPortfolioItem.media?.images || []).length > 0 ? (
                            <SmartImage src={selectedPortfolioItem.media.images[0]} alt={selectedPortfolioItem.name} style={{ width: '100%', height: 'auto', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="chat" size={28} color={C.t3} /></div>
                          )}
                        </div>
                        {selectedPortfolioItem.description && <div style={{ marginBottom:8, color:C.t2 }}>{selectedPortfolioItem.description}</div>}
                        {(selectedPortfolioItem.publishToShowcase === false || selectedPortfolioItem.publishToConnections === false) ? (
                          <div style={{ marginBottom:8, display:'inline-flex', alignItems:'center', gap:6, padding:'5px 9px', borderRadius:999, border:`1px solid ${C.alpha(C.danger, 0.28)}`, background:C.alpha(C.danger, 0.08), color:C.danger, fontSize:10, fontWeight:800 }}>
                            <Icon name="slash" size={12} color={C.danger} strokeWidth={2.2} />
                            Stand By
                          </div>
                        ) : null}
                        <ContactButtons item={selectedPortfolioItem} />
                      </div>
                    )
                  ) : (
                    portfolioTab === 'properties' ? (
                      (portfolioItems.length > 0) ? (
                        <>
                          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:PORTFOLIO_GRID_GAP }}>
                            {(portfolioShowAll ? portfolioItems : portfolioItems.slice(0, 4)).map(p => (
                              <PortfolioItem key={p.id} p={p} onOpen={isMobile ? setMobileCardSheet : setSelectedPortfolioItem} />
                            ))}
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
                  ownerDesc={ownerDesc}
                  onBack={() => setMobileCardSheet(null)}
                  autoplayMedia={autoplayMedia}
                  onBlockedExport={guardExportPdf}
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
                  💬 {CHAT_INTEREST_PREFIX[myInputLang] || CHAT_INTEREST_PREFIX.pt}
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
                {(mobileCardSheet.media?.images || []).length > 0 && (
                  <SmartImage src={mobileCardSheet.media.images[0]} alt={mobileCardSheet.name} style={{ width:'100%', borderRadius:12, marginBottom:12, objectFit:'cover', maxHeight:200 }} />
                )}
                {mobileCardSheet.description && <div style={{ color:C.t2, fontSize:13, marginBottom:12 }}>{mobileCardSheet.description}</div>}
                <ContactButtons item={mobileCardSheet} />
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
                  💬 {CHAT_INTEREST_SERVICE_PREFIX[myInputLang] || CHAT_INTEREST_SERVICE_PREFIX.pt}
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
          </div>
          <div style={{ width:'100%', display:'flex', justifyContent:'center' }}>
            <div style={{ pointerEvents:'none', width:`min(100%, ${previewFeedCardWidth}px)`, height:previewFeedCardHeight }}>
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

      <PlanGateModal
        gate={planGate}
        onClose={() => setPlanGate(null)}
        onUpgrade={goToPricingFromGate}
      />
    </div>
  );
}
