import React, { useMemo, useState } from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { DealSifterLogo } from '../ui/DealSifterLogo';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

export function AdminLoginModal({ onClose, onSubmit }) {
  const allT = useT('global');
  const t = allT.admin || {};
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const canSubmit = useMemo(() => {
    const hasEmail = emailRegex.test(String(email).trim());
    return hasEmail && String(password).length >= 8;
  }, [email, password]);

  const submit = async () => {
    if (isSubmitting) return;
    setError('');
    if (!canSubmit) {
      setError(t.invalidCredentials || 'Invalid admin credentials format.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await onSubmit?.({ email: email.trim(), password });
      if (result === false) {
        setError(t.invalidCredentials || 'Invalid admin credentials format.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={430}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DealSifterLogo size={36} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{t.loginTitle || 'Admin Access'}</div>
            <div style={{ fontSize: 12, color: C.t3 }}>{t.loginSubtitle || 'Restricted area for system administration.'}</div>
          </div>
        </div>

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.alpha(C.warning || C.gold, 0.1), padding: 10, fontSize: 11, color: C.t2 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.adminNote || 'Admin authentication'}</div>
          <div>{t.adminNoteDesc || 'Use your admin account credentials to sign in.'}</div>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.loginEmail || 'Admin email'}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@dealsifter.com"
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', background: C.bg, color: C.t1 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 11, color: C.t2, fontWeight: 700 }}>{t.loginPassword || 'Password'}</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="******"
            type="password"
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px', background: C.bg, color: C.t1 }}
          />
        </label>

        {error ? <div style={{ color: C.danger, fontSize: 11, fontWeight: 700 }}>{error}</div> : null}

        <button
          disabled={isSubmitting}
          onClick={submit}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 10,
            background: C.accent,
            color: '#fff',
            padding: '11px 12px',
            fontSize: 13,
            fontWeight: 800,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="shield" size={14} color="#fff" />
          {t.loginButton || 'Enter Admin Dashboard'}
        </button>
      </div>
    </Modal>
  );
}
