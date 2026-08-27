import { describe, expect, it } from 'vitest';
import { buildCorsHeaders, parseAllowedOrigins, resolveAllowedOrigin } from './corsPolicy.ts';

describe('Maxxis Deal AI CORS policy', () => {
  it('normalizes configured and fallback app origins', () => {
    expect(parseAllowedOrigins(
      'https://dealsifter.com/, https://app.dealsifter.com, *',
      ['https://dealsiftermatch.vercel.app/path'],
    )).toEqual([
      'https://dealsifter.com',
      'https://app.dealsifter.com',
      'https://dealsiftermatch.vercel.app',
    ]);
  });

  it('allows exact trusted origins and fails closed otherwise', () => {
    const allowed = ['https://dealsiftermatch.vercel.app'];
    expect(resolveAllowedOrigin('https://dealsiftermatch.vercel.app', allowed))
      .toBe('https://dealsiftermatch.vercel.app');
    expect(resolveAllowedOrigin('https://evil.example', allowed)).toBe('');
    expect(resolveAllowedOrigin('', allowed)).toBe('');
  });

  it('authorizes the browser preflight required by the chat POST', () => {
    const headers = buildCorsHeaders(
      'https://dealsiftermatch.vercel.app',
      ['https://dealsiftermatch.vercel.app'],
    );

    expect(headers['Access-Control-Allow-Origin']).toBe('https://dealsiftermatch.vercel.app');
    expect(headers['Access-Control-Allow-Methods']).toContain('POST');
    expect(headers['Access-Control-Allow-Headers']).toContain('authorization');
  });
});
