import { randomUUID } from 'node:crypto';
import { test, expect } from '../../fixtures/realBackendFixture.js';

function firstRow(payload) {
  return Array.isArray(payload) ? payload[0] : payload;
}

test('atomic rate limiter isolates identities, expires windows and stores no PII', async ({ realBackend }) => {
  const subjectA = randomUUID();
  const subjectB = randomUUID();
  const operation = `e2e_rate_${Date.now()}`;
  const expiryOperation = `${operation}_expiry`;
  const consume = (subjectId) => realBackend.adminRpc('ds_consume_edge_rate_limit', {
    p_subject_id: subjectId,
    p_operation: operation,
    p_window_seconds: 3_600,
    p_max_requests: 3,
  });
  const consumeExpiringWindow = () => realBackend.adminRpc('ds_consume_edge_rate_limit', {
    p_subject_id: subjectA,
    p_operation: expiryOperation,
    p_window_seconds: 5,
    p_max_requests: 1,
  });

  try {
    const simultaneous = await Promise.all(Array.from({ length: 6 }, () => consume(subjectA)));
    const decisions = simultaneous.map(firstRow);
    expect(decisions.filter((row) => row.allowed === true)).toHaveLength(3);
    expect(decisions.filter((row) => row.allowed === false)).toHaveLength(3);
    expect(decisions.every((row) => Number(row.retry_after) >= 1)).toBe(true);

    const otherUser = firstRow(await consume(subjectB));
    expect(otherUser.allowed).toBe(true);
    expect(otherUser.remaining).toBe(2);

    const stored = await realBackend.adminSelect(
      'edge_rate_limits',
      `select=subject_id,operation,window_started_at,request_count,expires_at&operation=eq.${operation}`,
    );
    expect(stored).toHaveLength(2);
    expect(Object.keys(stored[0]).sort()).toEqual([
      'expires_at', 'operation', 'request_count', 'subject_id', 'window_started_at',
    ]);

    expect(firstRow(await consumeExpiringWindow()).allowed).toBe(true);
    let blockedWindow = null;
    for (let attempt = 0; attempt < 5 && !blockedWindow; attempt += 1) {
      const decision = firstRow(await consumeExpiringWindow());
      if (decision.allowed === false) blockedWindow = decision;
    }
    expect(blockedWindow?.allowed).toBe(false);
    const waitMs = (Math.max(1, Number(blockedWindow.retry_after)) + 1) * 1_000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    const nextWindow = firstRow(await consumeExpiringWindow());
    expect(nextWindow.allowed).toBe(true);
    expect(nextWindow.remaining).toBe(0);
  } finally {
    await Promise.all([
      realBackend.adminDelete('edge_rate_limits', `operation=eq.${operation}`),
      realBackend.adminDelete('edge_rate_limits', `operation=eq.${expiryOperation}`),
    ]).catch(() => {});
  }
});

test('Maxxis Edge Function emits structured 429 under a controlled concurrent burst', async ({ realBackend }) => {
  const providerSession = await realBackend.signIn(realBackend.provider.email, realBackend.provider.password);
  const responses = await Promise.all(Array.from({ length: 21 }, () => realBackend.invokeFunction({
    token: providerSession.access_token,
    name: 'maxxis-chat',
    body: { message: 'Controlled phase 5C rate limit probe', page: 'e2e', language: 'en' },
  })));
  const throttled = responses.filter((response) => response.status === 429);
  expect(throttled.length).toBeGreaterThanOrEqual(1);
  throttled.forEach(({ payload }) => {
    expect(payload.error).toBe('rate_limit_exceeded');
    expect(payload.retryAfter).toBeGreaterThanOrEqual(1);
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
