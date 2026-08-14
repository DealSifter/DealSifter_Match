import { describe, expect, it, vi } from 'vitest';
import {
  buildOperationalEvent,
  classifyOperationalError,
  createRequestId,
  logOperationalEvent,
  normalizeOperationalErrorCode,
  sanitizeOperationalText,
  withRequestId,
} from './observability';

describe('Edge observability contract', () => {
  it('classifies operational failures without relying on stack traces', () => {
    expect(classifyOperationalError('UNAUTHORIZED', 401)).toBe('AUTH');
    expect(classifyOperationalError('MAXXIS_PROVIDER_QUOTA', 429)).toBe('QUOTA');
    expect(classifyOperationalError('STRIPE_WEBHOOK_FAILED', 500)).toBe('PAYMENT');
    expect(classifyOperationalError('PROFILE_CONFLICT', 409)).toBe('CONFLICT');
    expect(classifyOperationalError('PGRST_DATABASE_FAILED', 500)).toBe('DATABASE');
    expect(classifyOperationalError('unexpected failure', 500)).toBe('INTERNAL');
  });

  it('accepts only UUID correlation IDs and returns them safely', () => {
    const requestId = '11111111-1111-4111-8111-111111111111';
    expect(createRequestId(new Request('https://example.test', { headers: { 'x-request-id': requestId } }))).toBe(requestId);
    expect(createRequestId(new Request('https://example.test', { headers: { 'x-request-id': 'unsafe value' } }))).toMatch(/^[0-9a-f-]{36}$/i);
    expect(withRequestId(new Response('ok'), requestId).headers.get('x-request-id')).toBe(requestId);
  });

  it('uses a strict safe schema and does not serialize PII or request bodies', () => {
    const event = buildOperationalEvent({
      functionName: 'maxxis-chat',
      operation: 'maxxis_chat',
      requestId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      durationMs: 125.4,
      success: false,
      errorCode: 'MAXXIS_TIMEOUT',
      provider: 'gemini',
      status: 504,
      release: 'release-123',
      metrics: {
        provider_duration_ms: 100,
        email: 'buyer@example.com',
        message_body: 'private chat',
        tool: 'searchProperties',
      },
    });
    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain('buyer@example.com');
    expect(serialized).not.toContain('private chat');
    expect(event).toMatchObject({
      function_name: 'maxxis-chat',
      error_category: 'TIMEOUT',
      error_code: 'MAXXIS_TIMEOUT',
      duration_ms: 125,
      release: 'release-123',
    });
    expect(event.metrics).toEqual({ provider_duration_ms: 100, tool: 'searchProperties' });
  });

  it('replaces free-form error messages with a category code before logging', () => {
    expect(normalizeOperationalErrorCode('failure for buyer@example.com', 'INTERNAL')).toBe('INTERNAL_ERROR');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const event = logOperationalEvent({
      functionName: 'stripe-webhook',
      operation: 'process',
      success: false,
      errorCode: 'STRIPE_WEBHOOK_FAILED',
    });
    expect(event.error_category).toBe('PAYMENT');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('sanitizes PII and credentials in persisted diagnostic text', () => {
    const value = sanitizeOperationalText('buyer@example.com Bearer eyJabc.def.ghi +1 214 555 0199');
    expect(value).not.toContain('buyer@example.com');
    expect(value).not.toContain('eyJabc');
    expect(value).not.toContain('555');
  });
});
