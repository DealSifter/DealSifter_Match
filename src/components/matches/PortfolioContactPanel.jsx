import React, { useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { Icon } from '../ui/Icon';
import { SmartImage } from '../ui/SmartImage';

const normalizeText = (value) => String(value || '').trim();

const normalizeMethods = (value) => (
  Array.isArray(value)
    ? value.map((item) => normalizeText(item).toLowerCase()).filter(Boolean)
    : []
);

const normalizeContact = (canonicalContact) => {
  if (!canonicalContact || typeof canonicalContact !== 'object') return null;
  const contact = canonicalContact.contact && typeof canonicalContact.contact === 'object'
    ? canonicalContact.contact
    : canonicalContact;
  const methods = normalizeMethods(contact.contactMethods || contact.contact_methods || canonicalContact.contactMethods || canonicalContact.contact_methods);
  return {
    name: normalizeText(contact.name || canonicalContact.name),
    avatarUrl: normalizeText(contact.avatarUrl || contact.avatar_url || canonicalContact.avatarUrl || canonicalContact.avatar_url || canonicalContact.photo || canonicalContact.avatar),
    category: normalizeText(contact.category || canonicalContact.category || canonicalContact.cat || canonicalContact.type),
    location: normalizeText(contact.location || canonicalContact.location || canonicalContact.loc),
    email: normalizeText(contact.email || canonicalContact.email),
    phonePrimary: normalizeText(contact.phonePrimary || contact.phone_primary || canonicalContact.phonePrimary || canonicalContact.primaryPhone || canonicalContact.phone),
    phoneSecondary: normalizeText(contact.phoneSecondary || contact.phone_secondary || canonicalContact.phoneSecondary || canonicalContact.secondaryPhone),
    whatsapp: normalizeText(contact.whatsapp || canonicalContact.whatsapp),
    contactMethods: methods,
  };
};

export function PortfolioContactPanel({
  canonicalContact,
  isUnlocked,
  variant = 'desktop',
  onUnlockRequest,
}) {
  const allT = useT('matches');
  const t = allT.matches || {};
  const modalsT = allT.modals || {};
  const contact = useMemo(() => normalizeContact(canonicalContact), [canonicalContact]);
  const [showUnavailable, setShowUnavailable] = useState(false);
  const [copied, setCopied] = useState('');
  const copyTimerRef = useRef(null);

  useEffect(() => {
    if (!isUnlocked || contact || showUnavailable) return undefined;
    const timer = window.setTimeout(() => setShowUnavailable(true), 350);
    return () => window.clearTimeout(timer);
  }, [contact, isUnlocked, showUnavailable]);

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  const copyValue = async (key, value) => {
    const text = normalizeText(value);
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopied(''), 1200);
      }
    } catch (error) {
      void error;
    }
  };

  if (!isUnlocked) {
    return (
      <button
        type="button"
        onClick={onUnlockRequest}
        className={`portfolio-contact-panel portfolio-contact-panel-${variant} locked`}
        style={{
          width: variant === 'desktop' ? 'auto' : '100%',
          minHeight: variant === 'modal' ? 34 : 38,
          borderRadius: 10,
          border: `1px solid ${C.gold}`,
          background: C.alpha(C.gold, 0.12),
          color: C.gold,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: variant === 'desktop' ? '7px 12px' : '9px 12px',
          fontSize: variant === 'modal' ? 11 : 12,
          fontWeight: 900,
          cursor: 'pointer',
        }}
      >
        <Icon name="lock" size={13} color={C.gold} />
        {t.unlockBtn || 'Unlock Contact'}
      </button>
    );
  }

  if (!contact) {
    return (
      <div
        className={`portfolio-contact-panel portfolio-contact-panel-${variant} unavailable`}
        style={{
          border: `1px dashed ${C.border}`,
          borderRadius: 10,
          padding: variant === 'modal' ? '8px 10px' : '10px 12px',
          color: C.t3,
          fontSize: variant === 'modal' ? 11 : 12,
          fontWeight: 800,
          background: C.alpha(C.t1, 0.025),
        }}
      >
        {showUnavailable
          ? (t.contactUnavailable || 'Contato não disponível')
          : (t.contactLoading || 'Carregando contato...')}
      </div>
    );
  }

  const channels = [
    { key: 'phone-primary', icon: 'phone', label: modalsT.contactPhone || 'Phone', value: contact.phonePrimary },
    { key: 'phone-secondary', icon: 'sms', label: modalsT.contactSms || 'Phone 2', value: contact.phoneSecondary },
    { key: 'whatsapp', icon: 'whatsapp', label: modalsT.contactWhatsApp || 'WhatsApp', value: contact.whatsapp },
    { key: 'email', icon: 'email', label: modalsT.contactEmail || 'Email', value: contact.email },
  ].filter((channel) => channel.value);

  if (contact.contactMethods.includes('chat')) {
    channels.push({ key: 'chat', icon: 'chat', label: 'DealSifter Chat', value: t.chatAvailable || 'Available' });
  }

  const compact = variant === 'modal';
  const isMobile = variant === 'mobile';
  const direction = isMobile ? 'column' : 'row';

  return (
    <div
      className={`portfolio-contact-panel portfolio-contact-panel-${variant}`}
      style={{
        display: 'flex',
        flexDirection: compact ? 'column' : direction,
        alignItems: compact || isMobile ? 'stretch' : 'center',
        gap: compact ? 8 : 10,
        width: isMobile ? '100%' : 'auto',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: compact ? 'none' : '0 1 auto' }}>
        {contact.avatarUrl ? (
          <SmartImage
            src={contact.avatarUrl}
            alt={contact.name || 'Contact'}
            style={{ width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: compact ? 28 : 32, height: compact ? 28 : 32, borderRadius: '50%', background: C.alpha(C.accent, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="person" size={compact ? 13 : 15} color={C.accent} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.t1, fontSize: compact ? 11 : 12, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {contact.name || t.unlockedLabel || 'Unlocked'}
          </div>
          <div style={{ color: C.t3, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[contact.category, contact.location].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: isMobile ? 'stretch' : 'flex-start', minWidth: 0 }}>
        {channels.length ? channels.map((channel) => (
          <button
            key={channel.key}
            type="button"
            onClick={() => copyValue(channel.key, channel.value)}
            title={channel.label}
            style={{
              minWidth: isMobile ? '100%' : 0,
              maxWidth: isMobile ? '100%' : 230,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: isMobile ? 'center' : 'flex-start',
              gap: 6,
              padding: compact ? '5px 8px' : '7px 10px',
              borderRadius: 8,
              border: `1px solid ${copied === channel.key ? C.success : C.border}`,
              background: copied === channel.key ? C.alpha(C.success, 0.14) : C.alpha(C.t1, 0.05),
              color: copied === channel.key ? C.success : C.t1,
              fontSize: compact ? 10 : 11,
              fontWeight: 750,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <Icon name={copied === channel.key ? 'check' : channel.icon} size={12} color={copied === channel.key ? C.success : C.t1} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.value}</span>
          </button>
        )) : (
          <div style={{ color: C.t3, fontSize: 11, fontWeight: 800 }}>
            {t.contactUnavailable || 'Contato não disponível'}
          </div>
        )}
      </div>
    </div>
  );
}

export default PortfolioContactPanel;
