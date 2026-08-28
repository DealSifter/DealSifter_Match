import { describe, expect, it } from 'vitest';
import { buildGeminiGenerationConfig } from './geminiGenerationConfig.ts';

describe('Gemini generation configuration', () => {
  it('uses minimal thinking and no legacy sampling controls for Gemini 3', () => {
    expect(buildGeminiGenerationConfig('gemini-3.5-flash-lite', 1400)).toEqual({
      maxOutputTokens: 1400,
      thinkingConfig: { thinkingLevel: 'minimal' },
    });
  });

  it('uses the compatible zero thinking budget for Gemini 2.5 fallback', () => {
    expect(buildGeminiGenerationConfig('gemini-2.5-flash', 1400)).toEqual({
      maxOutputTokens: 1400,
      thinkingConfig: { thinkingBudget: 0 },
    });
  });
});
