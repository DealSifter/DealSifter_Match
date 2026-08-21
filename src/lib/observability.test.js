import { describe, expect, it, vi } from 'vitest';
import {
  getObservabilityMetadata,
  initObservability,
  isObservabilityEnabled,
  scrubTelemetryEvent,
  scrubTelemetryValue,
} from './observability';

describe('observability privacy boundary', () => {
  it('redacts PII and credentials embedded in otherwise safe fields', () => {
    const value = scrubTelemetryValue({
      note: 'Contact tarso@example.com at +1 (214) 555-0199',
      authorization: 'Bearer private-token',
      nested: { apiResult: 'sk_live_private123' },
    });
    expect(value.note).not.toContain('tarso@example.com');
    expect(value.note).not.toContain('555-0199');
    expect(value.authorization).toBe('[Redacted]');
    expect(value.nested.apiResult).toBe('[Redacted]');
  });

  it('scrubs exception messages, breadcrumbs and URL query values', () => {
    const event = scrubTelemetryEvent({
      message: 'Checkout failed for buyer@example.com',
      user: { id: 'user-a', email: 'buyer@example.com', ip_address: '127.0.0.1' },
      request: { url: 'https://dealsifter.com/?email=buyer@example.com&token=private' },
      exception: { values: [{ type: 'Error', value: 'Bearer abc.def.ghi for buyer@example.com' }] },
      breadcrumbs: [{ message: 'Called +1 214 555 0199', data: { email: 'buyer@example.com' } }],
    });

    expect(event.user).toEqual({ id: 'user-a' });
    expect(event.message).not.toContain('buyer@example.com');
    expect(event.request.url).not.toContain('buyer%40example.com');
    expect(event.request.url).not.toContain('private');
    expect(event.exception.values[0].value).toBe('[Redacted] for [Redacted]');
    expect(event.breadcrumbs[0].message).not.toContain('555');
    expect(event.breadcrumbs[0].data.email).toBe('[Redacted]');
  });

  it('drops profile, conversation and private address payloads', () => {
    const value = scrubTelemetryValue({
      profile_payload: { full_name: 'Private User' },
      chat_content: 'private negotiation',
      private_address: '100 Private Street',
      safe_counter: 3,
    });

    expect(value.profile_payload).toBe('[Redacted]');
    expect(value.chat_content).toBe('[Redacted]');
    expect(value.private_address).toBe('[Redacted]');
    expect(value.safe_counter).toBe(3);
  });

  it('scrubs query data in stack frame URLs', () => {
    const event = scrubTelemetryEvent({
      exception: {
        values: [{
          value: 'failure',
          stacktrace: {
            frames: [{ filename: 'https://app.test/chunk.js?token=private', vars: { email: 'a@b.com' } }],
          },
        }],
      },
    });

    expect(event.exception.values[0].stacktrace.frames[0].filename).not.toContain('private');
    expect(event.exception.values[0].stacktrace.frames[0].vars).toBeUndefined();
  });

  it('keeps the application operational when no DSN is configured', () => {
    vi.stubEnv('VITE_SENTRY_DSN', '');
    expect(isObservabilityEnabled()).toBe(false);
    expect(() => initObservability()).not.toThrow();
    expect(initObservability()).toBe(false);
    expect(getObservabilityMetadata()).toEqual(expect.objectContaining({
      environment: expect.any(String),
      release: expect.any(String),
    }));
    vi.unstubAllEnvs();
  });
});
