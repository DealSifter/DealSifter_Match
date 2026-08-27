export const DEFAULT_GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
] as const;

export function buildGeminiModelCandidates(configuredModel = '') {
  return Array.from(new Set([
    String(configuredModel || '').trim(),
    ...DEFAULT_GEMINI_MODELS,
  ].filter(Boolean)));
}
