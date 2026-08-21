import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { MAXXIS_EXECUTION_LIMITS, MaxxisExecutionBudget } from './maxxisExecutionBudget.ts';

const protectionSource = readFileSync(new URL('./abuseProtection.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../migrations/20260815000001_edge_rate_limits.sql', import.meta.url), 'utf8');
const chatSource = readFileSync(new URL('../maxxis-chat/index.ts', import.meta.url), 'utf8');
const messageSource = readFileSync(new URL('./maxxis/providerMessageSend.ts', import.meta.url), 'utf8');
const unlockSource = readFileSync(new URL('./maxxis/providerContactUnlock.ts', import.meta.url), 'utf8');
const stripeSource = readFileSync(new URL('../create-checkout-session/index.ts', import.meta.url), 'utf8');
const webhookSource = readFileSync(new URL('../stripe-webhook/index.ts', import.meta.url), 'utf8');

describe('Phase 5C abuse protection', () => {
  it('uses an atomic upsert for concurrent counters and hides the RPC from clients', () => {
    expect(migration).toMatch(/on conflict \(subject_id, operation, window_started_at\)[\s\S]*request_count = least/i);
    expect(migration).toContain('enable row level security');
    expect(migration).toMatch(/revoke all on function public\.ds_consume_edge_rate_limit[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.ds_consume_edge_rate_limit[\s\S]*to service_role/i);
  });

  it('returns structured 429 responses with retry and request identifiers', () => {
    expect(protectionSource).toContain("'Retry-After': String(decision.retryAfter)");
    expect(protectionSource).toContain("'x-request-id': requestId");
    expect(protectionSource).toContain("error: unavailable ? 'abuse_protection_unavailable' : 'rate_limit_exceeded'");
  });

  it('keeps user identity server-derived and persists no direct PII', () => {
    expect(protectionSource).toMatch(/checkRateLimit\([\s\S]*userId: string/);
    expect(migration).not.toMatch(/email|phone|address|message_body|authorization|ip_address/i);
    expect(migration).toMatch(/subject_id uuid not null/);
  });

  it('enforces the Gemini call budget', () => {
    const budget = new MaxxisExecutionBudget({ ...MAXXIS_EXECUTION_LIMITS, maxGeminiCalls: 2 });
    budget.consumeGeminiCall();
    budget.consumeGeminiCall();
    expect(() => budget.consumeGeminiCall()).toThrow('MAXXIS_BUDGET_EXHAUSTED');
  });

  it('enforces one tool round and one tool call', () => {
    const budget = new MaxxisExecutionBudget();
    budget.consumeToolRound();
    expect(() => budget.consumeToolRound()).toThrow('MAXXIS_BUDGET_EXHAUSTED');
  });

  it('rejects oversized history and tool payloads before further work', () => {
    const budget = new MaxxisExecutionBudget();
    expect(() => budget.validateHistory(Array.from({ length: 11 }, () => ({ content: 'ok' })))).toThrow('MAXXIS_CONTEXT_TOO_LARGE');
    expect(() => budget.validateHistory([{ content: 'x'.repeat(MAXXIS_EXECUTION_LIMITS.maxHistoryChars + 1) }])).toThrow('MAXXIS_CONTEXT_TOO_LARGE');
    expect(() => budget.validateToolPayload('x'.repeat(MAXXIS_EXECUTION_LIMITS.maxToolPayloadChars + 1))).toThrow('MAXXIS_TOOL_PAYLOAD_TOO_LARGE');
  });

  it('enforces total duration', () => {
    vi.useFakeTimers();
    const budget = new MaxxisExecutionBudget({ ...MAXXIS_EXECUTION_LIMITS, maxDurationMs: 10 });
    vi.advanceTimersByTime(11);
    expect(() => budget.consumeGeminiCall()).toThrow('MAXXIS_BUDGET_EXHAUSTED');
    vi.useRealTimers();
  });

  it('applies kill switches and server-side rate limits to sensitive Maxxis flows', () => {
    expect(chatSource).toContain("isOperationalFeatureEnabled('MAXXIS_ENABLED')");
    expect(messageSource).toContain("isOperationalFeatureEnabled('PROVIDER_MESSAGING_ENABLED')");
    expect(unlockSource).toContain("isOperationalFeatureEnabled('CONTACT_UNLOCK_ENABLED')");
    expect(messageSource).toContain("checkRateLimit(userId, operation)");
    expect(unlockSource).toContain("checkRateLimit(userId, operation)");
  });

  it('deduplicates repeated and concurrent provider message preparations', () => {
    expect(messageSource).toContain('stableMessageKey');
    expect(messageSource).toContain("error?.code === '23505'");
    expect(migration).toContain('maxxis_pending_message_idempotency_idx');
  });

  it('uses official Stripe idempotency and preserves webhook event replay protection', () => {
    expect(stripeSource).toContain("req.headers.get('Idempotency-Key')");
    expect(stripeSource).toContain('idempotencyKey: `checkout:${user.id}:${clientIdempotencyKey}`');
    expect(webhookSource).toContain('processVerifiedStripeWebhookEvent');
  });

  it('rejects oversized Stripe webhook bodies before signature processing', () => {
    expect(webhookSource).toContain('contentLength > 1024 * 1024');
    expect(webhookSource).toContain("new Response('Payload too large', { status: 413 })");
  });
});
