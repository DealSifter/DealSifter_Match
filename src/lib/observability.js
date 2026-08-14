import * as Sentry from '@sentry/react';
import { trackAppEvent } from './adminEventTracking';

const SENSITIVE_KEY_RE = /(password|passwd|secret|access_token|refresh_token|authorization|apikey|api_key|cookie|email|phone|whatsapp|full_name|street_address|private_address|profile_payload|chat_content|message_body|avatar|photo|image)/i;
const MAX_CONTEXT_DEPTH = 4;
const REDACTED = '[Redacted]';
const CHUNK_ERROR_RE = /chunkloaderror|loading chunk|dynamically imported module|module script failed/i;
let initialized = false;

const envText = (key) => String(import.meta.env[key] || '').trim();
const clampRate = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback;
};

export const getObservabilityMetadata = () => ({
  environment: envText('VITE_APP_ENVIRONMENT') || import.meta.env.MODE || 'unknown',
  release: envText('VITE_APP_RELEASE') || envText('VITE_APP_VERSION') || 'local',
});

export const isObservabilityEnabled = () => Boolean(envText('VITE_SENTRY_DSN'));

const scrubText = (value) => String(value || '')
  .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9]?))+/gi, REDACTED)
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
          SENSITIVE_KEY_RE.test(key) && !/^has_(email|phone|whatsapp)$/i.test(key)
            ? REDACTED
            : scrubTelemetryValue(item, depth + 1),
        ]),
    );
  }
  return '[Unsupported]';
};

export const scrubTelemetryEvent = (event) => {
  if (!event) return event;
  if (event.message) event.message = scrubText(event.message);
  if (event.transaction) event.transaction = scrubText(event.transaction);
  if (event.user) {
    event.user = event.user.id ? { id: String(event.user.id) } : undefined;
  }
  if (event.request) {
    if (event.request.url) event.request.url = scrubUrl(event.request.url);
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    delete event.request.env;
  }
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception?.value ? scrubText(exception.value) : exception?.value,
      stacktrace: exception?.stacktrace ? {
        ...exception.stacktrace,
        frames: exception.stacktrace.frames?.map((frame) => ({
          ...frame,
          filename: frame?.filename ? scrubUrl(frame.filename) : frame?.filename,
          abs_path: frame?.abs_path ? scrubUrl(frame.abs_path) : frame?.abs_path,
          vars: undefined,
        })),
      } : exception?.stacktrace,
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

  const errorText = `${event.message || ''} ${event.exception?.values?.map((item) => item?.value || '').join(' ') || ''}`;
  if (CHUNK_ERROR_RE.test(errorText)) {
    event.tags = { ...(event.tags || {}), area: 'chunk_loading' };
  }
  return event;
};

export function initObservability() {
  if (!isObservabilityEnabled()) return false;
  if (initialized) return true;
  initialized = true;

  const tracesSampleRate = clampRate(envText('VITE_SENTRY_TRACES_SAMPLE_RATE'), 0.05);
  const { environment, release } = getObservabilityMetadata();

  Sentry.init({
    dsn: envText('VITE_SENTRY_DSN'),
    environment,
    release,
    sendDefaultPii: false,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate,
    tracePropagationTargets: ['localhost', /^https:\/\/[^/]+\.supabase\.co\/functions\/v1\//],
    beforeSend: scrubTelemetryEvent,
    beforeSendTransaction: scrubTelemetryEvent,
    beforeBreadcrumb: (breadcrumb) => scrubTelemetryValue(breadcrumb),
  });

  Sentry.setTags({ app: 'dealsifter-match', environment, release });

  window.__DS_REPORT_ERROR = (error, info = {}) => {
    captureAppException(error, {
      area: 'react_error_boundary',
      scope: info?.scope || 'app',
      component_stack: info?.componentStack ? '[React component stack captured]' : undefined,
    });
  };

  if (environment !== 'production') {
    window.__DS_OBSERVABILITY_SMOKE = () => Sentry.captureMessage('observability_smoke', {
      level: 'info',
      tags: { controlled: 'true', environment, release },
    });
  }

  return true;
}

export function setObservabilityUser(userId) {
  if (!isObservabilityEnabled()) return;
  Sentry.setUser(userId ? { id: String(userId) } : null);
}

export function captureAppException(error, context = {}) {
  if (!isObservabilityEnabled()) return undefined;
  return Sentry.withScope((scope) => {
    const safeContext = scrubTelemetryValue({
      route: typeof window !== 'undefined' ? window.location.pathname : '',
      ...context,
    });
    scope.setContext('deal_sifter', safeContext);
    if (safeContext?.area) scope.setTag('area', String(safeContext.area));
    if (safeContext?.operation) scope.setTag('operation', String(safeContext.operation));
    return Sentry.captureException(error instanceof Error ? error : new Error(String(error || 'Unknown error')));
  });
}

export function captureOperationalMetric(operation, details = {}) {
  if (!isObservabilityEnabled()) return undefined;
  const sampleRate = clampRate(envText('VITE_SENTRY_OPERATION_SAMPLE_RATE'), 0.1);
  if (Math.random() > sampleRate) return undefined;
  const safeOperation = String(operation || '').replace(/[^a-z0-9_.:-]/gi, '_').slice(0, 80);
  if (!safeOperation) return undefined;
  return Sentry.withScope((scope) => {
    const safeDetails = scrubTelemetryValue(details);
    scope.setTags({
      signal: 'operational_sli',
      operation: safeOperation,
      success: safeDetails?.success === false ? 'false' : 'true',
      route: typeof window !== 'undefined' ? window.location.pathname : '',
    });
    scope.setContext('operational_metric', safeDetails);
    return Sentry.captureMessage(`operational_sli:${safeOperation}`, 'info');
  });
}

export function captureWebVital(metric) {
  if (!isObservabilityEnabled()) return undefined;
  const sampleRate = clampRate(envText('VITE_SENTRY_WEB_VITALS_SAMPLE_RATE'), 0.1);
  if (Math.random() > sampleRate) return undefined;
  const name = String(metric?.name || '').toUpperCase();
  if (!['LCP', 'INP', 'CLS'].includes(name)) return undefined;
  return Sentry.withScope((scope) => {
    scope.setTags({
      signal: 'web_vital',
      metric: name,
      rating: String(metric?.rating || 'unknown'),
      route: typeof window !== 'undefined' ? window.location.pathname : '',
    });
    scope.setContext('web_vital', scrubTelemetryValue({
      name,
      value: Number(metric?.value || 0),
      delta: Number(metric?.delta || 0),
      rating: metric?.rating || 'unknown',
      navigation_type: metric?.navigationType || 'unknown',
    }));
    return Sentry.captureMessage(`web_vital:${name}`, 'info');
  });
}

export function captureCheckoutError(error, context = {}) {
  captureAppException(error, {
    ...context,
    area: 'checkout',
    operation: context.action || 'stripe_checkout',
  });
}

export function captureUnlockError(error, context = {}) {
  captureAppException(error, {
    area: 'unlock',
    user_id: context.user_id || null,
    operation: context.action || 'unlock',
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
  const safePayload = scrubTelemetryValue({ event: cleanEvent, ...payload });

  trackAppEvent(`entitlement_${cleanEvent}`, {
    entityType: 'entitlement',
    entityId: cleanEvent,
    metadata: safePayload,
  });

  if (!isObservabilityEnabled()) return;

  Sentry.withScope((scope) => {
    scope.setContext('deal_sifter_entitlement', safePayload);
    scope.setTag('severity', level === 'error' ? 'high' : 'warning');
    if (level === 'error') {
      Sentry.captureException(error instanceof Error ? error : new Error(cleanEvent));
      return;
    }
    Sentry.captureMessage(cleanEvent, 'warning');
  });
}
