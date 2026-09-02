import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  aggregateAttemptResults,
  attemptsForHeartbeat,
  classifyHeartbeatAttempt,
  rateLimitWaitMs,
  validateAcceptanceEnvironment,
  validateBaselineLock,
} from './maxxis-acceptance-lib.mjs';

const staging = {
  target: 'staging',
  projectRef: 'oqdcnjupquhybwdbeeew',
  supabaseUrl: 'https://oqdcnjupquhybwdbeeew.supabase.co',
  anonKey: 'staging-anon',
  serviceRoleKey: 'staging-service',
  backendMode: 'real',
  llmMode: 'real',
  stubValue: '',
};

describe('Maxxis real-runtime acceptance contract', () => {
  it('allows only the explicit staging project with real backend and Gemini', () => {
    expect(validateAcceptanceEnvironment(staging)).toMatchObject({ ok: true, status: 'READY' });
    expect(validateAcceptanceEnvironment({ ...staging, target: 'production' })).toMatchObject({ status: 'BLOCKED_BY_GUARD' });
    expect(validateAcceptanceEnvironment({ ...staging, supabaseUrl: 'https://cyeipfskwwisbbayyaca.supabase.co' })).toMatchObject({ status: 'BLOCKED_BY_GUARD' });
    expect(validateAcceptanceEnvironment({ ...staging, serviceRoleKey: '' })).toMatchObject({ status: 'BLOCKED_AUTH' });
    expect(validateAcceptanceEnvironment({ ...staging, stubValue: '1' })).toMatchObject({ status: 'BLOCKED_BY_GUARD', reason: 'LLM_STUB_FORBIDDEN' });
  });

  it('repeats only critical tool-routing heartbeats in variance mode', () => {
    expect(attemptsForHeartbeat('HB-05', true)).toBe(3);
    expect(attemptsForHeartbeat('HB-06', true)).toBe(3);
    expect(attemptsForHeartbeat('HB-07', true)).toBe(3);
    expect(attemptsForHeartbeat('HB-08', true)).toBe(1);
    expect(attemptsForHeartbeat('HB-05', false)).toBe(1);
  });

  it('paces real calls without retrying or delaying the first request', () => {
    expect(rateLimitWaitMs({ lastStartedAt: 0, now: 1_000 })).toBe(0);
    expect(rateLimitWaitMs({ lastStartedAt: 1_000, now: 5_000 })).toBe(16_000);
    expect(rateLimitWaitMs({ lastStartedAt: 1_000, now: 22_000 })).toBe(0);
  });

  it('marks mixed attempts as FLAKY and never hides the first failure', () => {
    const aggregate = aggregateAttemptResults('HB-06', [
      { status: 'FAIL', classification: 'CONTRACT', reason: 'WRONG_TOOL' },
      { status: 'FAIL', classification: 'CONTRACT', reason: 'WRONG_TOOL' },
      { status: 'PASS', classification: '', reason: 'OK' },
    ]);
    expect(aggregate).toMatchObject({ status: 'FLAKY', attempts: 3, passCount: 1, finalResult: 'PASS' });
    expect(aggregate.firstFailure).toEqual({ status: 'FAIL', classification: 'CONTRACT', reason: 'WRONG_TOOL' });
  });

  it('asserts semantic behavior and explicit provider health rather than answer substrings', () => {
    const heartbeat = { id: 'HB-05', expectedTool: 'searchProperties' };
    const result = {
      ok: true,
      status: 200,
      payload: {
        message: 'Any natural answer is accepted.',
        status: 'success',
        providerStatus: 'ok',
        type: 'properties',
        data: { properties: [] },
        runtime: { provider: 'gemini', toolName: 'searchProperties' },
      },
    };
    expect(classifyHeartbeatAttempt({ heartbeat, result })).toMatchObject({ status: 'PASS', semanticClass: 'PROPERTY_SEARCH' });
    expect(classifyHeartbeatAttempt({ heartbeat, result: { ...result, payload: { ...result.payload, providerStatus: 'empty' } } }))
      .toMatchObject({ status: 'FAIL', reason: 'PROVIDER_STATUS_NOT_OK' });
  });

  it('locks the exact ten-heartbeat R1 baseline', () => {
    const ids = Array.from({ length: 10 }, (_, index) => `HB-${String(index + 1).padStart(2, '0')}`);
    expect(validateBaselineLock(
      { heartbeats: ids.map((id) => ({ id })) },
      { results: ids.map((id) => ({ id, status: 'PASS' })) },
    )).toEqual({ ok: true, reason: 'R1_BASELINE_LOCKED' });
  });

  it('preserves the official prompts and forbids intercepted runtime evidence', () => {
    const contract = JSON.parse(readFileSync(new URL('../config/heartbeat-contract.json', import.meta.url), 'utf8'));
    const spec = readFileSync(new URL('../e2e/tests/real-gemini/maxxis-heartbeat-r0.spec.js', import.meta.url), 'utf8');
    expect(contract.heartbeats.map((item) => item.prompt)).toEqual([
      'Como funciona o Feed?',
      'Como funciona o Dashboard?',
      'O que é Tax Deed?',
      'Qual a diferença entre Tax Deed e Wholesale?',
      'Mostre propriedades em Dallas.',
      'Como está este imóvel?',
      'Compare estes dois imóveis.',
      'Quem pode me ajudar aqui?',
      'O que estou vendo?',
      'E agora?',
    ]);
    expect(spec).toContain("name: 'maxxis-chat'");
    expect(spec).not.toContain('route.fulfill');
    expect(spec).not.toContain('mockBackend');
  });
});
