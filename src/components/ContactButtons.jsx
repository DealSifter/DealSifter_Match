import React from 'react';
import { C } from '../theme/colors';
import { Icon } from './ui/Icon';

const clean = (value) => String(value || '').trim();

function ContactButton({ icon, label, value, href, onClick }) {
  const content = (
    <>
      <Icon name={icon} size={12} color={C.t1} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || label}</span>
    </>
  );
  const style = {
    minWidth: 0,
    maxWidth: 230,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.alpha(C.t1, 0.05),
    color: C.t1,
    fontSize: 11,
    fontWeight: 750,
    cursor: onClick || href ? 'pointer' : 'default',
    overflow: 'hidden',
    textDecoration: 'none',
  };

  if (href) {
    return (
      <a href={href} title={label} style={style}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} title={label} style={style}>
      {content}
    </button>
  );
}

export function ContactButtons({
  email = null,
  phone = null,
  whatsapp = null,
  chatEnabled = false,
  onChatClick = null,
}) {
  const emailValue = clean(email);
  const phoneValue = clean(phone);
  const whatsappValue = clean(whatsapp);
  const buttons = [];

  if (phoneValue) {
    buttons.push(
      <ContactButton
        key="phone"
        icon="phone"
        label="Phone"
        value={phoneValue}
        href={`tel:${phoneValue}`}
      />
    );
  }

  if (whatsappValue) {
    buttons.push(
      <ContactButton
        key="whatsapp"
        icon="whatsapp"
        label="WhatsApp"
        value={whatsappValue}
        href={`https://wa.me/${whatsappValue.replace(/\D/g, '')}`}
      />
    );
  }

  if (emailValue) {
    buttons.push(
      <ContactButton
        key="email"
        icon="email"
        label="Email"
        value={emailValue}
        href={`mailto:${emailValue}`}
      />
    );
  }

  if (chatEnabled) {
    buttons.push(
      <ContactButton
        key="chat"
        icon="chat"
        label="DealSifter Chat"
        value="DealSifter Chat"
        onClick={onChatClick}
      />
    );
  }

  if (!buttons.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start', minWidth: 0 }}>
      {buttons}
    </div>
  );
}

export default ContactButtons;
