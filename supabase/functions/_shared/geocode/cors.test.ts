import { describe, expect, it } from 'vitest';
import { geocodeCorsHeaders } from './cors.ts';

describe('geocode browser transport with production tracing', () => {
  it.each(['authorization', 'apikey', 'content-type', 'x-client-info', 'baggage', 'sentry-trace', 'traceparent', 'tracestate'])(
    'permits the %s request header without treating it as authentication', header => {
      const allowed = geocodeCorsHeaders['Access-Control-Allow-Headers'].split(',').map(value => value.trim());
      expect(allowed).toContain(header);
      expect(allowed).not.toContain('*');
    },
  );
  it('declares POST and OPTIONS while preserving the existing noncredentialed origin contract', () => {
    expect(geocodeCorsHeaders['Access-Control-Allow-Methods'].split(',').map(value => value.trim())).toEqual(['GET', 'POST', 'OPTIONS']);
    expect(geocodeCorsHeaders['Access-Control-Allow-Origin']).toBe('*');
    expect(geocodeCorsHeaders).not.toHaveProperty('Access-Control-Allow-Credentials');
  });
});
