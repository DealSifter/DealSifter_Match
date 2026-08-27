import { describe, expect, it } from 'vitest';
import {
  classifyGeminiCandidateFailure,
  classifyGeminiHttpFailure,
  classifyGeminiThrownFailure,
  selectGeminiFailure,
} from './geminiErrors.ts';

describe('Gemini failure classification', () => {
  it('classifies sanitized provider HTTP failures', () => {
    expect(classifyGeminiHttpFailure(403)).toBe('GEMINI_AUTH_ERROR');
    expect(classifyGeminiHttpFailure(429)).toBe('GEMINI_QUOTA_EXCEEDED');
    expect(classifyGeminiHttpFailure(404)).toBe('GEMINI_MODEL_UNAVAILABLE');
    expect(classifyGeminiHttpFailure(500)).toBe('GEMINI_INTERNAL_ERROR');
    expect(classifyGeminiHttpFailure(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.' } }))
      .toBe('GEMINI_AUTH_ERROR');
  });

  it('distinguishes timeouts, network failures and blocked responses', () => {
    expect(classifyGeminiThrownFailure(new DOMException('aborted', 'AbortError'))).toBe('GEMINI_TIMEOUT');
    expect(classifyGeminiThrownFailure(new TypeError('fetch failed'))).toBe('GEMINI_NETWORK_ERROR');
    expect(classifyGeminiCandidateFailure({ finishReason: 'SAFETY' })).toBe('GEMINI_BLOCKED_RESPONSE');
    expect(classifyGeminiCandidateFailure({ finishReason: 'STOP' })).toBe('GEMINI_EMPTY_RESPONSE');
  });

  it('keeps the most actionable reason across model attempts', () => {
    expect(selectGeminiFailure(['GEMINI_INTERNAL_ERROR', 'GEMINI_QUOTA_EXCEEDED']))
      .toBe('GEMINI_QUOTA_EXCEEDED');
  });
});
