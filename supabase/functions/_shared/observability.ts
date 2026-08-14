export const OPERATIONAL_ERROR_CATEGORIES = [
  'AUTH',
  'RLS',
  'VALIDATION',
  'PROVIDER',
  'TIMEOUT',
  'QUOTA',
  'PAYMENT',
  'CONFLICT',
  'DATABASE',
  'INTERNAL',
] as const;

export type OperationalErrorCategory = typeof OPERATIONAL_ERROR_CATEGORIES[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_CODE_RE = /^[A-Z][A-Z0-9_]{1,63}$/;
const SAFE_NAME_RE = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i;
const SENSITIVE_KEY_RE = /(password|secret|token|authorization|apikey|cookie|email|phone|whatsapp|message|content|address|payload|body)/i;

export function sanitizeOperationalText(value: unknown, maxLength = 500) {
  return String(value || '')
    .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9]?))+/gi, '[Redacted]')
    .replace(/bearer\s+[a-z0-9._~-]+/gi, '[Redacted]')
    .replace(/\b(?:sk|pk)_(?:live|test)_[a-z0-9_-]+\b/gi, '[Redacted]')
    .replace(/\bsb_(?:secret|publishable)_[a-z0-9_-]+\b/gi, '[Redacted]')
    .replace(/\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/gi, '[Redacted]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[Redacted]')
    .slice(0, Math.max(1, Math.min(2000, maxLength)));
}

function runtimeEnv(name: string) {
  try {
    return typeof Deno !== 'undefined' ? String(Deno.env.get(name) || '').trim() : '';
  } catch {
    return '';
  }
}

function safeName(value: unknown, fallback: string) {
  const normalized = String(value || '').trim().slice(0, 80);
  return SAFE_NAME_RE.test(normalized) ? normalized : fallback;
}

function safeStatus(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const normalized = String(value || '').trim().slice(0, 40);
  return SAFE_NAME_RE.test(normalized) ? normalized : undefined;
}

function safeMetrics(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => SAFE_NAME_RE.test(key) && !SENSITIVE_KEY_RE.test(key))
    .slice(0, 30)
    .map(([key, item]) => {
      if (typeof item === 'boolean') return [key, item];
      if (typeof item === 'number' && Number.isFinite(item)) return [key, item];
      if (typeof item === 'string' && SAFE_NAME_RE.test(item)) return [key, item.slice(0, 80)];
      if (Array.isArray(item)) {
        return [key, item
          .filter((entry) => typeof entry === 'string' && SAFE_NAME_RE.test(entry))
          .slice(0, 12)
          .map((entry) => entry.slice(0, 80))];
      }
      return [key, undefined];
    })
    .filter(([, item]) => item !== undefined);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function createRequestId(req?: Request) {
  const incoming = String(req?.headers.get('x-request-id') || '').trim();
  return UUID_RE.test(incoming) ? incoming : crypto.randomUUID();
}

export function classifyOperationalError(value: unknown, status?: number): OperationalErrorCategory {
  const source = value as { code?: string; name?: string; message?: string } | null;
  const text = `${source?.code || ''} ${source?.name || ''} ${source?.message || value || ''}`.toUpperCase();
  if (status === 401 || /AUTH|UNAUTHORIZED|JWT|SESSION/.test(text)) return 'AUTH';
  if (/ROW.LEVEL|\bRLS\b|OWNERSHIP|PERMISSION_DENIED/.test(text)) return 'RLS';
  if (status === 504 || /TIMEOUT|TIMED_OUT|ABORT/.test(text)) return 'TIMEOUT';
  if (status === 429 || /QUOTA|RATE_LIMIT|PLAN_LIMIT|INSUFFICIENT_BALANCE/.test(text)) return 'QUOTA';
  if (status === 402 || /STRIPE|PAYMENT|CHECKOUT|WEBHOOK/.test(text)) return 'PAYMENT';
  if (status === 409 || /CONFLICT|STALE|ALREADY_|INTENT_EXPIRED|COST_CHANGED/.test(text)) return 'CONFLICT';
  if (/GEMINI|PROVIDER|MODEL|UPSTREAM/.test(text)) return 'PROVIDER';
  if (/POSTGRES|DATABASE|PGRST|SQL|RPC_FAILED|LOOKUP_FAILED/.test(text)) return 'DATABASE';
  if ((status != null && status >= 400 && status < 500) || /INVALID|REQUIRED|NOT_FOUND|METHOD_NOT_ALLOWED|ORIGIN/.test(text)) return 'VALIDATION';
  return 'INTERNAL';
}

export function normalizeOperationalErrorCode(value: unknown, category?: OperationalErrorCategory) {
  const candidate = String((value as { code?: string } | null)?.code || value || '').trim().toUpperCase();
  if (SAFE_CODE_RE.test(candidate)) return candidate;
  return `${category || classifyOperationalError(value)}_ERROR`;
}

export function getEdgeRelease() {
  return runtimeEnv('OBSERVABILITY_RELEASE')
    || runtimeEnv('DENO_DEPLOYMENT_ID')
    || runtimeEnv('GIT_COMMIT_SHA')
    || 'local';
}

export function buildOperationalEvent(input: {
  functionName: string;
  operation: string;
  requestId?: string;
  userId?: string;
  durationMs?: number;
  success: boolean;
  errorCode?: unknown;
  errorCategory?: OperationalErrorCategory;
  provider?: string;
  status?: number | string;
  severity?: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  release?: string;
  metrics?: Record<string, unknown>;
}) {
  const category = input.success
    ? undefined
    : (input.errorCategory || classifyOperationalError(input.errorCode, typeof input.status === 'number' ? input.status : undefined));
  const event = {
    timestamp: new Date().toISOString(),
    signal: 'operational_event',
    function_name: safeName(input.functionName, 'unknown'),
    operation: safeName(input.operation, 'unknown'),
    request_id: UUID_RE.test(String(input.requestId || '')) ? String(input.requestId) : '',
    user_id: UUID_RE.test(String(input.userId || '')) ? String(input.userId) : '',
    duration_ms: Math.max(0, Math.round(Number(input.durationMs || 0))),
    success: Boolean(input.success),
    error_category: category,
    error_code: input.success ? undefined : normalizeOperationalErrorCode(input.errorCode, category),
    provider: input.provider ? safeName(input.provider, 'unknown') : undefined,
    status: safeStatus(input.status),
    severity: input.severity || (input.success ? 'INFO' : (category === 'PAYMENT' || category === 'DATABASE' || category === 'INTERNAL' ? 'HIGH' : 'WARNING')),
    release: safeName(input.release || getEdgeRelease(), 'unknown'),
    metrics: safeMetrics(input.metrics),
  };
  return Object.fromEntries(Object.entries(event).filter(([, value]) => value !== undefined));
}

export function logOperationalEvent(input: Parameters<typeof buildOperationalEvent>[0]) {
  const event = buildOperationalEvent(input);
  const output = JSON.stringify(event);
  if (input.success) console.log(output);
  else console.error(output);
  return event;
}

export function withRequestId(response: Response, requestId: string) {
  const headers = new Headers(response.headers);
  if (UUID_RE.test(String(requestId || ''))) headers.set('x-request-id', requestId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
