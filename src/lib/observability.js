import * as Sentry from '@sentry/react';
import { trackAppEvent } from './adminEventTracking';

const SENSITIVE_KEY_RE = /(password|passwd|secret|token|authorization|apikey|api_key|cookie|email|phone|whatsapp|name|full_name|avatar|photo|image|address)/i;
const MAX_CONTEXT_DEPTH = 4;
const REDACTED = '[Redacted]';
let initialized = false;

const isEnabled = () => Boolean(String(import.meta.env.VITE_SENTRY_DSN || '').trim());

const scrubText = (value) => String(value || '')
  .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/gi, REDACTED)
  .replace(/bearer\s+[a-z0-9._~-]+/gi, REDACTED)
  .replace(/\b(?:sk|pk)_(?:live|test)_[a-z0-9_-]+\b/gi, REDACTED)
  .replace(/\bsb_(?:secret|publishable)_[a-z0-9_-]+\b/gi, REDACTED)
  .replace(/\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/gi, REDACTED)
  .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, REDACTED);

const scrubUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  try {
    const parsed = new URL(raw);
    parsed.username = '';
    parsed.password = '';
    parsed.hash = '';
    [...parsed.searchParams.keys()].forEach((key) => parsed.searchParams.set(key, REDACTED));
    return parsed.toString();
  } catch {
    return scrubText(raw);
  }
};

export const scrubTelemetryValue = (value, depth = 0) => {
  if (depth > MAX_CONTEXT_DEPTH) return '[Truncated]';
  if (value == null) return value;
  if (typeof value === 'string') {
    const scrubbed = scrubText(value);
    return scrubbed.length > 500 ? `${scrubbed.slice(0, 500)}...` : scrubbed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => scrubTelemetryValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [
          key,
          SENSITIVE_KEY_RE.test(key) && !/^has_(email|phone|whatsapp)$/i.test(key) ? REDACTED : scrubTelemetryValue(item, depth + 1),
        ]),
    );
  }
  return '[Unsupported]';
};

export const scrubTelemetryEvent = (event) => {
  if (!event) return event;
  if (event.message) event.message = scrubText(event.message);
  delete event.user?.email;
  delete event.user?.username;
  delete event.user?.ip_address;
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception?.value ? scrubText(exception.value) : exception?.value,
    }));
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.slice(-50).map((breadcrumb) => ({
      ...breadcrumb,
      message: breadcrumb?.message ? scrubText(breadcrumb.message) : breadcrumb?.message,
      data: breadcrumb?.data ? scrubTelemetryValue(breadcrumb.data) : breadcrumb?.data,
    }));
  }
  if (event.extra) event.extra = scrubTelemetryValue(event.extra);
  if (event.contexts) event.contexts = scrubTelemetryValue(event.contexts);
  if (event.tags) event.tags = scrubTelemetryValue(event.tags);
  if (event.fingerprint) event.fingerprint = scrubTelemetryValue(event.fingerprint);
  return event;
};

export function initObservability() {
  if (!isEnabled()) return false;
  if (initialized) return true;
  initialized = true;

  const configuredSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.05);
  const tracesSampleRate = Number.isFinite(configuredSampleRate)
    ? Math.min(1, Math.max(0, configuredSampleRate))
    : 0.05;

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    sendDefaultPii: false,
    tracesSampleRate,
    beforeSend: scrubTelemetryEvent,
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
    scope.setContext('deal_sifter', scrubTelemetryValue(context));
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
  const safePayload = scrubTelemetryValue({
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
