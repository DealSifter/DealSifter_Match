// @vitest-environment jsdom
import React from 'react';
import { webcrypto } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { localizePresentationText, getCachedPresentationText } from './chatTranslation';
import { protectNarrativeIdentifiers, restoreNarrativeIdentifiers } from '../../supabase/functions/_shared/presentationText';
import { LocalizedNarrative } from '../components/ui/LocalizedNarrative';
import { getMaxxisGreeting } from './maxxisService';
import { buildDegradedEvidenceContinuation } from '../features/maxxis/intelligence/degradedEvidenceContinuation';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn(async (_, { body }) => ({ data: { translatedText: body.toLang === 'es' ? 'Bienvenido a "The Dalegrove MCM", un oasis con piscina.' : 'Bem-vindo a "The Dalegrove MCM", um oásis com piscina.', translationSource: 'cached-gemini' } })) }));
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { functions: { invoke } }, getSupabaseFunctionUrl: () => '', supabaseAnonKey: '' }));
beforeAll(() => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }); });
const original = 'Welcome to "The Dalegrove MCM", a serene oasis with pool.';

describe('presentation-only narrative localization', () => {
  it('PT/EN/ES share an immutable source, source hash and translation cache', async () => {
    const translate = vi.fn(async body => ({ data: { translatedText: body.toLang === 'pt' ? 'Bem-vindo ao Dalegrove.' : 'Bienvenido a Dalegrove.', translationSource: 'gemini' } }));
    const source = Object.freeze({ notes: original });
    const input = { text: source.notes, sourceLocale: 'en', targetLocale: 'pt-BR', invoke: translate };
    const [a, b] = await Promise.all([localizePresentationText(input), localizePresentationText(input)]);
    expect(a).toBe(b); expect(a.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.evidenceStatus).toBe('USER_PROVIDED'); expect(a.sourceText).toBe(original);
    expect(translate).toHaveBeenCalledTimes(1);
    await localizePresentationText(input); expect(translate).toHaveBeenCalledTimes(1);
    expect((await localizePresentationText({ ...input, targetLocale: 'en' })).translatedText).toBe(original);
    const spanish = await localizePresentationText({ ...input, targetLocale: 'es' });
    expect(spanish.translatedText).toContain('Bienvenido'); expect(spanish.sourceHash).toBe(a.sourceHash);
    expect(source.notes).toBe(original);
    const changed = await localizePresentationText({ ...input, text: `${original} Changed.` });
    expect(changed.sourceHash).not.toBe(a.sourceHash);
  });
  it('protects repeated names, phone/email/address/APN/numbers/URL/brands and fails closed on lost tokens', () => {
    const raw = 'Welcome to "The Dalegrove MCM" at 9537 Dalegrove Dr, Beverly Hills CA 90210. Poggenpohl, Sub Zero, 3 beds; call +1 (555) 123-4567, owner@example.com, APN 123-456, https://example.com. Poggenpohl.';
    const protectedCopy = protectNarrativeIdentifiers(raw, ['9537 Dalegrove Dr', 'Poggenpohl', 'Sub Zero', 'name not in source']);
    expect(restoreNarrativeIdentifiers(protectedCopy.text.replace('Welcome to', 'Bem-vindo a'), protectedCopy.tokens)).toBe(raw.replace('Welcome to', 'Bem-vindo a'));
    expect(restoreNarrativeIdentifiers('missing tokens', protectedCopy.tokens)).toBeNull();
  });
  it('translation failure shows original, preserves all information and is deduplicated', async () => {
    const failed = vi.fn().mockRejectedValue(new Error('offline'));
    const input = { text: 'Welcome to a separate offline property.', targetLocale: 'es', invoke: failed };
    const result = await localizePresentationText(input);
    expect(result.translatedText).toBe(input.text);
    await localizePresentationText(input); expect(failed).toHaveBeenCalledTimes(1);
    expect(getCachedPresentationText(input.text, 'es')).toBe(input.text);
  });
  it('visible card/portfolio narrative updates on locale changes without changing the source or repeated calls', async () => {
    const { rerender } = render(<LocalizedNarrative text={`${original} UI.`} language="pt-BR" />);
    await waitFor(() => expect(screen.getByText(/Bem-vindo a/)).toBeTruthy());
    const calls = invoke.mock.calls.length;
    rerender(<LocalizedNarrative text={`${original} UI.`} language="pt-BR" />);
    expect(invoke.mock.calls.length).toBe(calls);
    rerender(<LocalizedNarrative text={`${original} UI.`} language="en-US" />);
    await waitFor(() => expect(screen.getByText(`${original} UI.`)).toBeTruthy());
    rerender(<LocalizedNarrative text={`${original} UI.`} language="es-ES" />);
    await waitFor(() => expect(screen.getByText(/Bienvenido a/)).toBeTruthy());
    cleanup();
  });
  it('pt-BR greeting and no-cache continuation are deterministic and useful', () => {
    expect(getMaxxisGreeting('pt-BR')).toContain('Ola');
    const answer = buildDegradedEvidenceContinuation({ property: { address: '9537 Dalegrove Dr', price: 2195000, sqft: 1838, objective: 'SUB-TO' }, language: 'pt-BR' });
    expect(answer).toContain('Preço por sqft'); expect(answer).toContain('Próximo passo');
    expect(answer).toContain('Não atualizei dados externos nem calculei um ARV');
  });
});
