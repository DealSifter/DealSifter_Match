export function buildGeminiGenerationConfig(model: string, maxOutputTokens: number) {
  const safeMaxOutputTokens = Math.max(64, Math.min(8_192, Math.floor(Number(maxOutputTokens) || 1_400)));
  if (/^gemini-3(?:\.|-|$)/.test(String(model || ''))) {
    return {
      maxOutputTokens: safeMaxOutputTokens,
      thinkingConfig: { thinkingLevel: 'minimal' },
    };
  }
  if (/^gemini-2\.5(?:-|$)/.test(String(model || ''))) {
    return {
      maxOutputTokens: safeMaxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    };
  }
  return { maxOutputTokens: safeMaxOutputTokens };
}
