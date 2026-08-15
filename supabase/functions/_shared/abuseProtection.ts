import { createClient } from 'npm:@supabase/supabase-js@2';
import { logOperationalEvent } from './observability.ts';
export { MAXXIS_EXECUTION_LIMITS, MaxxisExecutionBudget } from './maxxisExecutionBudget.ts';

export const EDGE_RATE_LIMITS = {
  maxxis_chat: { windowSeconds: 60, maxRequests: 20 },
  provider_analysis: { windowSeconds: 60, maxRequests: 30 },
  provider_message_draft: { windowSeconds: 60, maxRequests: 30 },
  provider_message_prepare: { windowSeconds: 60, maxRequests: 12 },
  provider_message_confirm: { windowSeconds: 60, maxRequests: 8 },
  provider_message_cancel: { windowSeconds: 60, maxRequests: 20 },
  provider_unlock_prepare: { windowSeconds: 60, maxRequests: 12 },
  provider_unlock_confirm: { windowSeconds: 60, maxRequests: 6 },
  provider_unlock_cancel: { windowSeconds: 60, maxRequests: 20 },
  profile_action_confirm: { windowSeconds: 60, maxRequests: 12 },
  profile_action_cancel: { windowSeconds: 60, maxRequests: 20 },
  deal_workflow_update: { windowSeconds: 60, maxRequests: 30 },
  checkout_create: { windowSeconds: 300, maxRequests: 6 },
  portal_create: { windowSeconds: 300, maxRequests: 10 },
  account_delete: { windowSeconds: 3600, maxRequests: 3 },
  geocode: { windowSeconds: 60, maxRequests: 30 },
  support_email: { windowSeconds: 600, maxRequests: 5 },
  stripe_reprocess: { windowSeconds: 300, maxRequests: 10 },
} as const;

export type RateLimitOperation = keyof typeof EDGE_RATE_LIMITS;

type RateLimitRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export type RateLimitDecision = {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  unavailable?: boolean;
};

function runtimeEnv(name: string) {
  try {
    return typeof Deno !== 'undefined' ? String(Deno.env.get(name) || '').trim() : '';
  } catch {
    return '';
  }
}

function adminRateLimitClient(): RateLimitRpcClient | null {
  const url = runtimeEnv('SUPABASE_URL');
  const serviceRoleKey = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data[0] && typeof data[0] === 'object' ? data[0] as Record<string, unknown> : null;
  return data && typeof data === 'object' ? data as Record<string, unknown> : null;
}

export async function checkRateLimit(
  userId: string,
  operation: RateLimitOperation,
  client: RateLimitRpcClient | null = adminRateLimitClient(),
): Promise<RateLimitDecision> {
  const config = EDGE_RATE_LIMITS[operation];
  if (!client || !userId) return { allowed: false, retryAfter: 1, remaining: 0, unavailable: true };
  const { data, error } = await client.rpc('ds_consume_edge_rate_limit', {
    p_subject_id: userId,
    p_operation: operation,
    p_window_seconds: config.windowSeconds,
    p_max_requests: config.maxRequests,
  });
  if (error) return { allowed: false, retryAfter: 1, remaining: 0, unavailable: true };
  const row = firstRow(data);
  if (!row) return { allowed: false, retryAfter: 1, remaining: 0, unavailable: true };
  return {
    allowed: row.allowed === true,
    retryAfter: Math.max(1, Math.ceil(Number(row.retry_after || 1))),
    remaining: Math.max(0, Math.floor(Number(row.remaining || 0))),
  };
}

export function rateLimitResponse(
  decision: RateLimitDecision,
  requestId: string,
  headers: HeadersInit = {},
) {
  const unavailable = decision.unavailable === true;
  return new Response(JSON.stringify({
    error: unavailable ? 'abuse_protection_unavailable' : 'rate_limit_exceeded',
    retryAfter: decision.retryAfter,
    requestId,
  }), {
    status: unavailable ? 503 : 429,
    headers: {
      ...Object.fromEntries(new Headers(headers).entries()),
      'Content-Type': 'application/json',
      'Retry-After': String(decision.retryAfter),
      'x-request-id': requestId,
      'Cache-Control': 'no-store',
    },
  });
}

export function logAbuseGuard(input: {
  functionName: string;
  operation: string;
  requestId: string;
  userId?: string;
  category: 'RATE_LIMIT' | 'BUDGET_EXHAUSTED' | 'REQUEST_TOO_LARGE' | 'REPLAY_BLOCKED' | 'MESSAGE_THROTTLED' | 'ABUSE_GUARD';
  status: number;
  durationMs?: number;
  limitType?: string;
}) {
  return logOperationalEvent({
    functionName: input.functionName,
    operation: input.operation,
    requestId: input.requestId,
    userId: input.userId,
    durationMs: input.durationMs,
    success: false,
    errorCode: input.category,
    status: input.status,
    severity: 'INFO',
    metrics: { limit_type: input.limitType || input.category.toLowerCase() },
  });
}

export function isOperationalFeatureEnabled(name: 'MAXXIS_ENABLED' | 'PROVIDER_MESSAGING_ENABLED' | 'CONTACT_UNLOCK_ENABLED') {
  const value = runtimeEnv(name).toLowerCase();
  return !['0', 'false', 'off', 'disabled'].includes(value);
}

export async function readJsonWithLimit(req: Request, maxBytes: number): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: 'REQUEST_TOO_LARGE' | 'INVALID_JSON' }
> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, error: 'REQUEST_TOO_LARGE' };
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return { ok: false, error: 'REQUEST_TOO_LARGE' };
  try {
    const parsed = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ok: true, body: parsed as Record<string, unknown> }
      : { ok: false, error: 'INVALID_JSON' };
  } catch {
    return { ok: false, error: 'INVALID_JSON' };
  }
}
