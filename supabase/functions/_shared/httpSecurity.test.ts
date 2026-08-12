import { describe, expect, it } from 'vitest';
import {
  buildCorsHeaders,
  isRequestOriginAllowed,
  parseAllowedOrigins,
  resolveTrustedReturnUrl,
} from './httpSecurity.ts';

describe('edge HTTP security', () => {
  const allowed = parseAllowedOrigins(
    'https://dealsifter.com, https://dealsiftermatch.vercel.app/, *',
  );

  it('uses exact trusted origins and never emits wildcard CORS', () => {
    expect(buildCorsHeaders('https://dealsifter.com', allowed)['Access-Control-Allow-Origin'])
      .toBe('https://dealsifter.com');
    expect(buildCorsHeaders('https://evil.example', allowed)['Access-Control-Allow-Origin'])
      .toBeUndefined();
    expect(isRequestOriginAllowed('https://evil.example', allowed)).toBe(false);
    expect(isRequestOriginAllowed('', allowed)).toBe(true);
  });

  it('rejects external and non-http Stripe return URLs', () => {
    const fallback = 'https://dealsifter.com/?checkout=cancelled';
    expect(resolveTrustedReturnUrl('https://dealsifter.com/?checkout=success', fallback, allowed))
      .toBe('https://dealsifter.com/?checkout=success');
    expect(resolveTrustedReturnUrl('https://evil.example/steal', fallback, allowed)).toBe(fallback);
    expect(resolveTrustedReturnUrl('javascript:alert(1)', fallback, allowed)).toBe(fallback);
  });
});
