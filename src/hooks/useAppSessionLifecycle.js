import { useEffect, useState } from 'react';
import {
  APP_IDLE_SIGNOUT_MS,
  APP_LAST_ACTIVITY_KEY,
  SECURITY_ACTIVE_SESSION_KEY,
  SECURITY_SESSIONS_KEY,
  appendSecurityAuditEvent,
} from '../lib/appSessionSecurity';

export function useAppSessionLifecycle({ authSession, page, lastActivityRef, logoutRef, supabaseClient, isConfigured }) {
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    if (!authSession?.id) return;
    try {
      const now = Date.now();
      const currentId = localStorage.getItem(SECURITY_ACTIVE_SESSION_KEY) || `sess-${now}-${Math.random().toString(16).slice(2, 7)}`;
      localStorage.setItem(SECURITY_ACTIVE_SESSION_KEY, currentId);
      const all = JSON.parse(localStorage.getItem(SECURITY_SESSIONS_KEY) || '[]');
      const rows = Array.isArray(all) ? all : [];
      const nextRows = rows
        .filter((row) => row && String(row.userId || '') === String(authSession.id))
        .map((row) => ({ ...row, current: String(row.id) === String(currentId) }));
      if (!nextRows.some((row) => String(row.id) === String(currentId))) {
        nextRows.unshift({
          id: currentId,
          userId: authSession.id,
          email: authSession.email || '',
          createdAt: now,
          lastSeenAt: now,
          current: true,
          device: String(navigator.userAgent || 'Unknown device').slice(0, 120),
        });
        appendSecurityAuditEvent({ type: 'session', status: 'created', message: 'New active session started.' });
      }
      localStorage.setItem(SECURITY_SESSIONS_KEY, JSON.stringify(nextRows.slice(0, 20)));
      window.setTimeout(() => setSessionVersion((version) => version + 1), 0);
    } catch {
      // Session diagnostics must not block authentication.
    }
  }, [authSession?.id, authSession?.email]);

  useEffect(() => {
    if (!isConfigured || !supabaseClient || !authSession?.userId) return undefined;
    let cancelled = false;
    const sendHeartbeat = async () => {
      if (cancelled) return;
      try {
        await supabaseClient.rpc('track_user_heartbeat', { p_page: String(page || 'app').slice(0, 48) });
      } catch {
        // Analytics must never interrupt app navigation.
      }
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [authSession?.userId, isConfigured, page, supabaseClient]);

  useEffect(() => {
    if (!authSession?.id) return undefined;
    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      try { localStorage.setItem(APP_LAST_ACTIVITY_KEY, String(now)); } catch { /* no-op */ }
      try {
        const currentId = localStorage.getItem(SECURITY_ACTIVE_SESSION_KEY);
        if (!currentId) return;
        const all = JSON.parse(localStorage.getItem(SECURITY_SESSIONS_KEY) || '[]');
        const rows = Array.isArray(all) ? all : [];
        let changed = false;
        const next = rows.map((row) => {
          if (String(row?.id || '') !== String(currentId)) return row;
          changed = true;
          return { ...row, lastSeenAt: now };
        });
        if (changed) localStorage.setItem(SECURITY_SESSIONS_KEY, JSON.stringify(next));
      } catch { /* no-op */ }
    };
    const getLastActivityAt = () => {
      try {
        const stored = Number(localStorage.getItem(APP_LAST_ACTIVITY_KEY) || '0');
        if (Number.isFinite(stored) && stored > 0) return stored;
      } catch { /* no-op */ }
      return Number(lastActivityRef.current || Date.now());
    };
    const checkIdleTimeout = () => {
      if (Date.now() - getLastActivityAt() > APP_IDLE_SIGNOUT_MS) {
        appendSecurityAuditEvent({ type: 'session', status: 'timeout', message: 'Session ended after 4 hours without activity.' });
        logoutRef.current?.();
      }
    };
    updateActivity();
    const events = ['pointerdown', 'keydown', 'mousemove', 'touchstart', 'input', 'change', 'scroll'];
    events.forEach((event) => window.addEventListener(event, updateActivity, { passive: true }));
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') checkIdleTimeout();
    };
    window.addEventListener('focus', checkIdleTimeout);
    document.addEventListener('visibilitychange', visibilityHandler);
    const timer = window.setInterval(checkIdleTimeout, 60 * 1000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, updateActivity));
      window.removeEventListener('focus', checkIdleTimeout);
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.clearInterval(timer);
    };
  }, [authSession?.id, lastActivityRef, logoutRef]);

  return sessionVersion;
}
