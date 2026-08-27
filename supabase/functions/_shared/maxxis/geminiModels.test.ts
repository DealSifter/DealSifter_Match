import { describe, expect, it } from 'vitest';
import { buildGeminiModelCandidates, DEFAULT_GEMINI_MODELS } from './geminiModels.ts';

describe('Gemini model candidates', () => {
  it('uses the current supported lightweight model first by default', () => {
    expect(buildGeminiModelCandidates()[0]).toBe('gemini-3.5-flash-lite');
    expect(DEFAULT_GEMINI_MODELS).not.toContain('gemini-2.0-flash');
  });

  it('prioritizes and deduplicates an explicitly configured model', () => {
    const models = buildGeminiModelCandidates('gemini-3.5-flash');
    expect(models[0]).toBe('gemini-3.5-flash');
    expect(models.filter((model) => model === 'gemini-3.5-flash')).toHaveLength(1);
  });
});
