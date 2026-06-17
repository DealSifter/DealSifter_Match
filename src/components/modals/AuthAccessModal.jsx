import React, { useMemo, useState } from 'react';
import { C } from '../../theme/colors';
import { useT } from '../../i18n/translations';
import { DealSifterLogo } from '../ui/DealSifterLogo';
import { Icon } from '../ui/Icon';
import { Modal } from '../ui/Modal';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REMEMBER_LOGIN_KEY = 'ds_remember_login_email';

export function AuthAccessModal({ initialTab = 'signup', onClose, onSubmit, onForgotPassword }) {
  const allT = useT('global');
  const t = allT.auth || {};
  const [tab, setTab] = useState(initialTab === 'login' ? 'login' : 'signup');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem(REMEMBER_LOGIN_KEY) || '';
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberLogin(true);
      }
    } catch (e) {
      void e;
    }
  }, []);

  const canSubmit = useMemo(() => {
    const validEmail = EMAIL_REGEX.test(String(email).trim());
    if (tab === 'signup') return fullName.trim().length >= 2 && validEmail && String(password).length >= 8;
    return validEmail && String(password).length >= 4;
  }, [tab, fullName, email, password]);

  const submit = async (provider = 'credentials') => {
    if (isSubmitting) return;
    setError('');
    if (provider === 'google') {
      setIsSubmitting(true);
      try {
        await onSubmit?.({
          mode: tab,
          provider: 'google',
          fullName: fullName.trim(),
          email: email.trim() || 'user@gmail.com',
          password: '',
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (!canSubmit) {
      setError(tab === 'signup' && String(password).length < 8
        ? (t.passwordTooShort || 'A senha deve ter pelo menos 8 caracteres.')
        : (t.invalidForm || 'Please complete the required fields.'));
      return;
    }
    setIsSubmitting(true);
    try {
      try {
        if (rememberLogin) localStorage.setItem(REMEMBER_LOGIN_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_LOGIN_KEY);
      } catch (e) {
        void e;
      }
      await onSubmit?.({
        mode: tab,
        provider,
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={460}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <DealSifterLogo size={38} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.t1, letterSpacing: '-0.3px' }}>{t.title || 'Access DealSifter'}</div>
            <div style={{ fontSize: 13, color: C.t3, marginTop: 2 }}>{t.subtitle || 'Sign up or sign in to continue.'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
          <button
            onClick={() => setTab('signup')}
            style={{
              flex: 1,
              border: `1px solid ${tab === 'signup' ? C.accent : C.border}`,
              background: tab === 'signup' ? C.alpha(C.accent, 0.12) : 'transparent',
              color: tab === 'signup' ? C.accent : C.t2,
              borderRadius: 8,
              padding: '8px 8px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t.tabSignUp || 'Sign Up'}
          </button>
          <button
            onClick={() => setTab('login')}
            style={{
              flex: 1,
              border: `1px solid ${tab === 'login' ? C.accent : C.border}`,
              background: tab === 'login' ? C.alpha(C.accent, 0.12) : 'transparent',
              color: tab === 'login' ? C.accent : C.t2,
              borderRadius: 8,
              padding: '8px 8px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t.tabLogin || 'Login'}
          </button>
        </div>

        {tab === 'signup' ? (
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, color: C.t2, fontWeight: 700, letterSpacing: '0.01em' }}>{t.fullName || 'Full name'}</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t.fullNamePlaceholder || 'Enter your name'}
              style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 13px', background: C.bg, color: C.t1, fontSize: 14, outline: 'none' }}
            />
          </label>
        ) : null}

        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 12, color: C.t2, fontWeight: 700, letterSpacing: '0.01em' }}>{t.email || 'Email'}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder || 'you@email.com'}
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 13px', background: C.bg, color: C.t1, fontSize: 14, outline: 'none' }}
          />
        </label>

        <label style={{ display: 'grid', gap: 7 }}>
          <span style={{ fontSize: 12, color: C.t2, fontWeight: 700, letterSpacing: '0.01em' }}>{t.password || 'Password'}</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.passwordPlaceholder || 'Enter your password'}
            type="password"
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 13px', background: C.bg, color: C.t1, fontSize: 14, outline: 'none' }}
          />
        </label>

        {error ? <div style={{ color: C.danger, fontSize: 12, fontWeight: 600 }}>{error}</div> : null}

        {tab === 'login' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.t2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => setRememberLogin(e.target.checked)}
                style={{ accentColor: C.accent }}
              />
              <span>{t.rememberLogin || 'Remember my data'}</span>
            </label>
            {onForgotPassword ? (
              <button
                type="button"
                onClick={() => onForgotPassword(email)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: C.accent,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textAlign: 'right',
                }}
              >
                {t.forgotPassword || 'Forgot your password?'}
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          disabled={isSubmitting}
          onClick={() => submit('credentials')}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 10,
            background: C.accent,
            color: '#fff',
            padding: '12px 12px',
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '0.01em',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.6 : 1,
          }}
        >
          {tab === 'signup' ? (t.continueSignUp || 'Continue Sign Up') : (t.continueLogin || 'Continue Login')}
        </button>

        <button
          disabled={isSubmitting}
          onClick={() => submit('google')}
          style={{
            width: '100%',
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            background: 'transparent',
            color: C.t1,
            padding: '11px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Icon name="globe" size={14} color={C.t1} />
          {t.continueGoogle || 'Continue with Google'}
        </button>

      </div>
    </Modal>
  );
}
