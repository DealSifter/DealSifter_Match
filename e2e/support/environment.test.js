import { describe, expect, it } from 'vitest';
import { assertRealGeminiEnvironment, assertSafeRealBackendEnvironment } from './environment.js';

const stagingUrl = 'https://oqdcnjupquhybwdbeeew.supabase.co';

describe('real-runtime environment guard', () => {
  it('allows only the canonical staging project', () => {
    expect(() => assertSafeRealBackendEnvironment({
      baseURL: 'http://127.0.0.1:4181',
      supabaseUrl: stagingUrl,
      backendMode: 'real',
      serviceRoleKey: 'staging-only',
    })).not.toThrow();
    expect(() => assertSafeRealBackendEnvironment({
      baseURL: 'http://127.0.0.1:4181',
      supabaseUrl: 'https://cyeipfskwwisbbayyaca.supabase.co',
      backendMode: 'real',
      serviceRoleKey: 'must-not-be-used',
    })).toThrow(/BLOCKED_BY_GUARD/);
  });

  it('classifies missing fixture credentials as BLOCKED_AUTH', () => {
    expect(() => assertSafeRealBackendEnvironment({
      baseURL: 'http://127.0.0.1:4181',
      supabaseUrl: stagingUrl,
      backendMode: 'real',
      serviceRoleKey: '',
    })).toThrow(/BLOCKED_AUTH/);
  });

  it('forbids any LLM stub in real Gemini acceptance', () => {
    expect(() => assertRealGeminiEnvironment({ mode: 'real', supabaseUrl: stagingUrl, stubValue: '' })).not.toThrow();
    expect(() => assertRealGeminiEnvironment({ mode: 'real', supabaseUrl: stagingUrl, stubValue: '1' })).toThrow(/BLOCKED_BY_GUARD/);
  });
});
