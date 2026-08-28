import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const realGeminiSpec = readFileSync(
  new URL('../../e2e/tests/real-gemini/maxxis-real-gemini.spec.js', import.meta.url),
  'utf8',
);
const loggerSource = readFileSync(
  new URL('../../supabase/functions/_shared/maxxis/logger.ts', import.meta.url),
  'utf8',
);
const featureFlagsSource = readFileSync(
  new URL('../../supabase/functions/_shared/featureFlags.ts', import.meta.url),
  'utf8',
);
const featureFlagsDoc = readFileSync(
  new URL('../../docs/FEATURE_FLAGS.md', import.meta.url),
  'utf8',
);
const maxxisDoc = readFileSync(
  new URL('../../docs/MAXXIS_AI_DOCUMENTACAO.md', import.meta.url),
  'utf8',
);

describe('Maxxis real-language acceptance and operational metrics contract', () => {
  it('covers free-language continuations in PT, EN and ES without exact response matching', () => {
    expect(realGeminiSpec).toContain("language: 'pt'");
    expect(realGeminiSpec).toContain("language: 'en'");
    expect(realGeminiSpec).toContain("language: 'es'");
    expect(realGeminiSpec).toContain('Quais imóveis parecem mais alinhados');
    expect(realGeminiSpec).toContain('Who could help me move this property forward?');
    expect(realGeminiSpec).toContain('¿Y ahora qué debería revisar aquí?');
  });

  it('emits the required PII-safe Gemini and tool counters', () => {
    for (const metric of [
      'gemini_request_count',
      'gemini_success_count',
      'gemini_failure_count',
      'fallback_count',
      'degraded_count',
      'tool_selection_count',
      'tool_success_count',
      'tool_failure_count',
      'second_pass_success',
      'response_duration_ms',
    ]) expect(loggerSource).toContain(metric);
    expect(loggerSource).not.toContain('details.message');
    expect(loggerSource).not.toContain('details.prompt');
    expect(loggerSource).not.toContain('details.email');
  });

  it('keeps production flags, knowledge routing and fallback documentation aligned with code', () => {
    expect(featureFlagsSource).toContain("maxxis_proactive_insights: { enabled: true, environments: ['production'], percentage: 100 }");
    expect(featureFlagsSource).toContain("maxxis_deal_memory: { enabled: true, environments: ['development', 'staging'], percentage: 100 }");
    expect(featureFlagsDoc).toContain('`maxxis_proactive_insights` is enabled for 100% of production accounts');
    expect(featureFlagsDoc).toContain('`maxxis_deal_memory` is also development/staging-only');
    expect(maxxisDoc).toContain('MAXXIS_KNOWLEDGE_VERSION');
    expect(maxxisDoc).toContain('fallbackLevel');
    expect(maxxisDoc).toContain('Não há polling');
  });
});
