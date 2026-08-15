export const SECURITY_AUDIT_KEY = 'ds_security_audit';
export const SECURITY_SESSIONS_KEY = 'ds_security_sessions';
export const SECURITY_ACTIVE_SESSION_KEY = 'ds_security_active_session_id';
export const APP_SESSION_TOKEN_KEY = 'ds_app_session_token';
export const APP_LAST_ACTIVITY_KEY = 'ds_app_last_activity_at';
export const APP_IDLE_SIGNOUT_MS = 4 * 60 * 60 * 1000;
export const USER_PREFERENCES_KEY = 'ds_user_preferences';

export const appendSecurityAuditEvent = (event) => {
  try {
    const current = JSON.parse(localStorage.getItem(SECURITY_AUDIT_KEY) || '[]');
    const next = Array.isArray(current) ? current : [];
    next.unshift({
      id: `sec-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
      at: Date.now(),
      ...event,
    });
    localStorage.setItem(SECURITY_AUDIT_KEY, JSON.stringify(next.slice(0, 200)));
  } catch { /* no-op */ }
};

export const consumeRateLimit = (key, maxAttempts, windowMs, lockMs = windowMs) => {
  try {
    const now = Date.now();
    const store = JSON.parse(localStorage.getItem('ds_security_rate_limits') || '{}');
    const entry = store?.[key] || { attempts: [], lockedUntil: 0 };
    if (Number(entry.lockedUntil || 0) > now) {
      return { allowed: false, retryAfterMs: Number(entry.lockedUntil) - now };
    }
    const attempts = (Array.isArray(entry.attempts) ? entry.attempts : []).filter((ts) => now - Number(ts) <= windowMs);
    attempts.push(now);
    if (attempts.length > maxAttempts) {
      const lockedUntil = now + lockMs;
      store[key] = { attempts, lockedUntil };
      localStorage.setItem('ds_security_rate_limits', JSON.stringify(store));
      return { allowed: false, retryAfterMs: lockMs };
    }
    store[key] = { attempts, lockedUntil: 0 };
    localStorage.setItem('ds_security_rate_limits', JSON.stringify(store));
    return { allowed: true, retryAfterMs: 0 };
  } catch {
    return { allowed: true, retryAfterMs: 0 };
  }
};
