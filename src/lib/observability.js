import * as Sentry from '@sentry/react';
import { trackAppEvent } from './adminEventTracking';

const SENSITIVE_KEY_RE = /(password|passwd|secret|token|authorization|apikey|api_key|cookie|email|phone|whatsapp|name|full_name|avatar|photo|image|address)/i;
const MAX_CONTEXT_DEPTH = 4;

const isEnabled = () => Boolean(String(import.meta.env.VITE_SENTRY_DSN || '').trim());

const scrubValue = (value, depth = 0) => {
  if (depth > MAX_CONTEXT_DEPTH) return '[Truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.includes('@')) return '[Redacted]';
    if (/bearer\s+[a-z0-9._-]+/i.test(value)) return '[Redacted]';
    if (/sk_live_|sk_test_|pk_live_|pk_test_|sb_secret_|sb_publishable_/i.test(value)) return '[Redacted]';
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY_RE.test(key) && !/^has_(email|phone|whatsapp)$/i.test(key) ? '[Redacted]' : scrubValue(item, depth + 1),
        ]),
    );
  }
  return '[Unsupported]';
};

const scrubEvent = (event) => {
  if (!event) return event;
  delete event.user?.email;
  delete event.user?.username;
  delete event.user?.ip_address;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  if (event.extra) event.extra = scrubValue(event.extra);
  if (event.contexts) event.contexts = scrubValue(event.contexts);
  return event;
};

export function initObservability() {
  if (!isEnabled()) return false;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    sendDefaultPii: false,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.05),
    beforeSend: scrubEvent,
  });

  window.__DS_REPORT_ERROR = (error, info = {}) => {
    captureAppException(error, {
      area: 'react_error_boundary',
      component_stack: info?.componentStack ? '[React component stack captured]' : undefined,
    });
  };

  window.addEventListener('error', (event) => {
    const message = String(event?.message || event?.error?.message || '');
    if (/chunkloaderror|loading chunk|dynamically imported module|module script failed/i.test(message)) {
      captureAppException(event.error || new Error(message || 'Chunk loading error'), {
        area: 'chunk_loading',
        source: event?.filename || '',
      });
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    captureAppException(event?.reason || new Error('Unhandled promise rejection'), {
      area: 'unhandled_rejection',
    });
  });

  return true;
}

export function setObservabilityUser(userId) {
  if (!isEnabled()) return;
  Sentry.setUser(userId ? { id: String(userId) } : null);
}

export function captureAppException(error, context = {}) {
  if (!isEnabled()) return;
  Sentry.withScope((scope) => {
    scope.setContext('deal_sifter', scrubValue(context));
    Sentry.captureException(error instanceof Error ? error : new Error(String(error || 'Unknown error')));
  });
}

export function captureCheckoutError(error, context = {}) {
  captureAppException(error, {
    ...context,
    area: 'checkout',
    action: context.action || 'stripe_checkout',
  });
}

export function captureUnlockError(error, context = {}) {
  captureAppException(error, {
    area: 'unlock',
    user_id: context.user_id || null,
    action: context.action || 'unlock',
    nugget_cost: Number.isFinite(Number(context.nugget_cost)) ? Number(context.nugget_cost) : null,
  });
}

export async function hashForTelemetry(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
      const data = new TextEncoder().encode(raw);
      const digest = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 8);
    }
  } catch {
    // Fallback below keeps observability available on older browsers.
  }

  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 8);
}

export function captureEntitlementAlert(level, event, payload = {}, error = null) {
  const cleanEvent = String(event || '').trim();
  if (!cleanEvent) return;
  const safePayload = scrubValue({
    event: cleanEvent,
    ...payload,
  });

  trackAppEvent(`entitlement_${cleanEvent}`, {
    entityType: 'entitlement',
    entityId: cleanEvent,
    metadata: safePayload,
  });

  if (!isEnabled()) return;

  Sentry.withScope((scope) => {
    scope.setContext('deal_sifter_entitlement', safePayload);
    if (level === 'error') {
      Sentry.captureException(error instanceof Error ? error : new Error(cleanEvent));
      return;
    }
    Sentry.captureMessage(cleanEvent, 'warning');
  });
}
