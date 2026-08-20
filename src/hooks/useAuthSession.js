import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured, supabaseConfigHint } from '../lib/supabaseClient';
import { clearSensitiveCache } from '../lib/localStoragePolicy';
import { captureOperationalMetric } from '../lib/observability';
import { trackProductEvent } from '../lib/productAnalytics';

export const mapSupabaseUserToSession = (user, mode = 'login', provider = 'supabase') => ({
  id: user?.id || null,
  mode,
  provider,
  email: String(user?.email || '').trim(),
  fullName: String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '').trim(),
  loginAt: Date.now(),
  userId: user?.id || null,
  emailVerified: !!user?.email_confirmed_at,
});

const getSupabaseSessionProvider = (user) => {
  const fromMetadata = String(user?.app_metadata?.provider || '').trim().toLowerCase();
  if (fromMetadata) return fromMetadata;
  const fromIdentity = String(user?.identities?.[0]?.provider || '').trim().toLowerCase();
  if (fromIdentity) return fromIdentity;
  return 'supabase';
};

const getAuthCallbackType = () => {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    const searchType = String(url.searchParams.get('type') || '').toLowerCase();
    if (searchType) return searchType;
    const hashParams = new URLSearchParams(String(url.hash || '').replace(/^#/, ''));
    return String(hashParams.get('type') || '').toLowerCase();
  } catch {
    return '';
  }
};

const isEmailConfirmationCallback = () => {
  const type = getAuthCallbackType();
  return type === 'signup' || type === 'email';
};

export function useAuthSession({
  authSession,
  setAuthSession,
  setSystemAccount,
  setIsAdmin,
  authRedirectUrl,
  addToast,
  appendSecurityAuditEvent,
  consumeRateLimit,
  safeLogError,
  onAuthenticated,
  onSessionRestored,
  onEmailConfirmedNeedsLogin,
}) {
  const [isAuthBootstrapping, setIsAuthBootstrapping] = useState(() => Boolean(isSupabaseConfigured && supabase));
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);
  const [isForgotPasswordProcessing, setIsForgotPasswordProcessing] = useState(false);
  const lastKnownAuthSessionRef = useRef(authSession || null);
  const emailConfirmationHandledRef = useRef(false);

  useEffect(() => {
    lastKnownAuthSessionRef.current = authSession || null;
  }, [authSession]);

  const applySystemAccountFromSession = useCallback((next) => {
    setSystemAccount?.((prev) => ({
      ...(prev || {}),
      fullName: next.fullName || prev?.fullName || '',
      email: next.email || prev?.email || '',
    }));
  }, [setSystemAccount]);

  useEffect(() => {
    try {
      if (authSession) localStorage.setItem('authSession', JSON.stringify(authSession));
      else localStorage.removeItem('authSession');
    } catch (error) {
      safeLogError?.('Failed to persist auth session.', error);
    }
  }, [authSession, safeLogError]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    let active = true;
    const clearSession = () => {
      setAuthSession(null);
      setIsAdmin?.(false);
      lastKnownAuthSessionRef.current = null;
    };

    const forceLoginAfterEmailConfirmation = async (session) => {
      if (!active || emailConfirmationHandledRef.current) return true;
      if (!isEmailConfirmationCallback()) return false;

      emailConfirmationHandledRef.current = true;
      const email = String(session?.user?.email || '').trim();
      clearSession();
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        try { await supabase.auth.signOut(); } catch { /* no-op */ }
      }
      onEmailConfirmedNeedsLogin?.(email);
      return true;
    };

    const applySession = async (session, { restoreNavigation = false } = {}) => {
      if (!active) return;
      const user = session?.user;
      if (!user) {
        return;
      }
      if (await forceLoginAfterEmailConfirmation(session)) return;

      const provider = getSupabaseSessionProvider(user);
      const previous = lastKnownAuthSessionRef.current;
      const previousUserId = previous?.userId || previous?.id || null;
      const mapped = mapSupabaseUserToSession(user, 'login', provider);
      const sameUser = String(previousUserId || '') === String(user.id || '');
      const next = sameUser
        ? { ...mapped, loginAt: previous?.loginAt || mapped.loginAt }
        : mapped;
      if (String(previousUserId || '') !== String(user.id || '')) {
        clearSensitiveCache(user.id);
      }
      lastKnownAuthSessionRef.current = next;
      setAuthSession((current) => {
        if (
          String(current?.userId || current?.id || '') === String(next.userId || '')
          && current?.email === next.email
          && current?.fullName === next.fullName
          && current?.provider === next.provider
          && current?.emailVerified === next.emailVerified
        ) {
          return current;
        }
        return next;
      });
      applySystemAccountFromSession(next);
      void trackProductEvent('session_started', {
        entityType: 'session',
        entityId: user.id,
        dedupeKey: `session-started:${user.id}:${next.loginAt}`,
        properties: { source: restoreNavigation ? 'restored' : 'auth_state' },
      });

      if (!sameUser || restoreNavigation) {
        try {
          const { data: userRow } = await supabase
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single();
          setIsAdmin?.(!!userRow?.is_admin);
        } catch {
          setIsAdmin?.(false);
        }
      }

      if (!sameUser || restoreNavigation) {
        onSessionRestored?.(next);
      }
    };

    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) await applySession(data.session, { restoreNavigation: true });
      else if (!lastKnownAuthSessionRef.current) clearSession();
    }).catch((error) => {
      safeLogError?.('Supabase session bootstrap failed.', error);
    }).finally(() => {
      if (active) setIsAuthBootstrapping(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        applySession(session, {
          restoreNavigation: event === 'SIGNED_IN' || event === 'INITIAL_SESSION',
        });
        return;
      }
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearSession();
        return;
      }
      // Supabase can emit transient null sessions during bootstrap/refresh.
      // Keep the last persisted app session until an explicit sign-out occurs,
      // otherwise desktop navigation can reopen the login modal between modules.
      if (!lastKnownAuthSessionRef.current) clearSession();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [applySystemAccountFromSession, onEmailConfirmedNeedsLogin, onSessionRestored, safeLogError, setAuthSession, setIsAdmin]);

  const handleAuthSubmit = useCallback(async (payload) => {
    if (isSupabaseConfigured && supabase) {
      setIsAuthProcessing(true);
      const startedAt = Date.now();
      const mode = payload?.mode === 'signup' ? 'signup' : 'login';
      const email = String(payload?.email || '').trim();
      const password = String(payload?.password || '');
      const fullName = String(payload?.fullName || '').trim();
      const provider = payload?.provider === 'google' ? 'google' : 'credentials';

      try {
        if (provider === 'credentials' && mode === 'login') {
          const guard = consumeRateLimit?.(`login:${email.toLowerCase()}`, 7, 10 * 60 * 1000, 15 * 60 * 1000);
          if (guard && !guard.allowed) {
            captureOperationalMetric('auth.credentials', {
              success: false,
              duration_ms: Date.now() - startedAt,
              error_category: 'AUTH',
              error_code: 'RATE_LIMITED',
              mode,
            });
            addToast?.({ type: 'warning', message: 'Too many attempts. Try again in a few minutes.' });
            appendSecurityAuditEvent?.({ type: 'login', status: 'blocked', message: 'Login temporarily rate-limited.', email });
            return;
          }
        }

        if (provider === 'google') {
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: authRedirectUrl },
          });
          if (error) throw error;
          captureOperationalMetric('auth.oauth_start', {
            success: true,
            duration_ms: Date.now() - startedAt,
            provider: 'google',
          });
          return;
        }

        if (mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: authRedirectUrl,
              data: { full_name: fullName || undefined },
            },
          });
          if (error) throw error;

          if (data?.session?.user) {
            const next = mapSupabaseUserToSession(data.session.user, 'signup', 'credentials');
            clearSensitiveCache(data.session.user.id);
            setAuthSession(next);
            applySystemAccountFromSession(next);
            onAuthenticated?.(next);
            appendSecurityAuditEvent?.({ type: 'signup', status: 'success', message: 'New account created and signed in.', email });
            void trackProductEvent('auth_signed_in', {
              entityType: 'user',
              entityId: data.session.user.id,
              dedupeKey: `auth-signed-in:${data.session.user.id}:${next.loginAt}`,
              properties: { source: 'signup', auth_provider: 'credentials' },
            });
            captureOperationalMetric('auth.credentials', {
              success: true,
              duration_ms: Date.now() - startedAt,
              mode,
              session_created: true,
            });
            return;
          }

          addToast?.({ type: 'success', title: 'Conta criada', message: 'Confira seu email para confirmar o acesso.' });
          appendSecurityAuditEvent?.({ type: 'signup', status: 'pending_verification', message: 'Account created awaiting email verification.', email });
          captureOperationalMetric('auth.credentials', {
            success: true,
            duration_ms: Date.now() - startedAt,
            mode,
            session_created: false,
          });
          onAuthenticated?.(null, { closeOnly: true });
          return;
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (data?.session?.user) {
          const next = mapSupabaseUserToSession(data.session.user, 'login', 'credentials');
          clearSensitiveCache(data.session.user.id);
          setAuthSession(next);
          applySystemAccountFromSession(next);
          onAuthenticated?.(next);
          appendSecurityAuditEvent?.({ type: 'login', status: 'success', message: 'User signed in with credentials.', email });
          void trackProductEvent('auth_signed_in', {
            entityType: 'user',
            entityId: data.session.user.id,
            dedupeKey: `auth-signed-in:${data.session.user.id}:${next.loginAt}`,
            properties: { source: 'login', auth_provider: 'credentials' },
          });
        }
        captureOperationalMetric('auth.credentials', {
          success: Boolean(data?.session?.user),
          duration_ms: Date.now() - startedAt,
          error_category: data?.session?.user ? undefined : 'AUTH',
          error_code: data?.session?.user ? undefined : 'SESSION_MISSING',
          mode,
        });
        return;
      } catch (error) {
        captureOperationalMetric('auth.submit', {
          success: false,
          duration_ms: Date.now() - startedAt,
          error_category: 'AUTH',
          error_code: String(error?.code || error?.status || 'AUTH_FAILED').slice(0, 64),
          mode,
          provider,
        });
        safeLogError?.('Supabase auth submit failed.', error);
        appendSecurityAuditEvent?.({ type: 'login', status: 'failed', message: String(error?.message || 'Authentication failed.'), email });
        addToast?.({ type: 'error', title: 'Erro de autenticacao', message: String(error?.message || 'Falha na autenticacao com Supabase.') });
        return;
      } finally {
        setIsAuthProcessing(false);
      }
    }

    addToast?.({
      type: 'error',
      title: 'Supabase nao configurado',
      message: supabaseConfigHint || 'Na Vercel, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e faca Redeploy.',
    });
  }, [
    addToast,
    appendSecurityAuditEvent,
    applySystemAccountFromSession,
    authRedirectUrl,
    consumeRateLimit,
    onAuthenticated,
    safeLogError,
    setAuthSession,
  ]);

  const handleForgotPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      addToast?.({ type: 'error', message: supabaseConfigHint || 'Supabase nao configurado.' });
      return;
    }

    const trimmed = String(email || '').trim();
    if (!trimmed.includes('@')) {
      addToast?.({ type: 'warning', message: 'Informe um email valido.' });
      return;
    }

    setIsForgotPasswordProcessing(true);
    try {
      const guard = consumeRateLimit?.(`forgot:${trimmed.toLowerCase()}`, 5, 30 * 60 * 1000, 30 * 60 * 1000);
      if (guard && !guard.allowed) {
        addToast?.({ type: 'warning', message: 'Too many reset attempts. Please wait before trying again.' });
        appendSecurityAuditEvent?.({ type: 'password_reset', status: 'blocked', message: 'Password reset temporarily rate-limited.', email: trimmed });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: authRedirectUrl,
      });
      if (error) throw error;

      addToast?.({ type: 'success', title: 'Email enviado', message: 'Confira sua caixa de entrada para redefinir a senha.' });
      appendSecurityAuditEvent?.({ type: 'password_reset', status: 'success', message: 'Password reset email sent.', email: trimmed });
    } catch (err) {
      addToast?.({ type: 'error', message: String(err?.message || 'Falha ao enviar email de redefinicao.') });
    } finally {
      setIsForgotPasswordProcessing(false);
    }
  }, [addToast, appendSecurityAuditEvent, authRedirectUrl, consumeRateLimit]);

  const refreshAuthSessionSnapshot = useCallback(async () => {
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
      clearSensitiveCache(user.id);
      setAuthSession(next);
      return { ok: true, session: next };
    } catch (err) {
      safeLogError?.('Supabase auth session refresh failed.', err);
      return { ok: false, session: authSession || null, message: String(err?.message || 'Falha ao atualizar sessao.') };
    }
  }, [authSession, safeLogError, setAuthSession]);

  return {
    isAuthBootstrapping,
    isAuthProcessing,
    isForgotPasswordProcessing,
    handleAuthSubmit,
    handleForgotPassword,
    refreshAuthSessionSnapshot,
  };
}
