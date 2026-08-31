import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectGeminiCandidate } from './geminiCandidate.ts';
import {
  classifyGeminiHttpFailure,
  classifyGeminiThrownFailure,
  isRetryableGeminiFailure,
} from './geminiErrors.ts';

const allowedTools = new Set(['getPropertyDetails']);
const edgeSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const clientSource = readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8');

describe('PROVIDER_FAILURE_SIMULATION — never real-runtime evidence', () => {
  it('classifies empty and partial HTTP-200 candidates as retryable empty responses', () => {
    for (const payload of [
      { candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] },
      { candidates: [{ content: { parts: [{ text: '  ' }] }, finishReason: 'STOP' }] },
    ]) {
      const inspection = inspectGeminiCandidate(payload, allowedTools);
      expect(inspection).toMatchObject({ usable: false, failure: 'GEMINI_EMPTY_RESPONSE' });
      expect(isRetryableGeminiFailure(inspection.failure)).toBe(true);
    }
  });

  it('classifies timeout and 503 as transient without adding unlimited retry', () => {
    const timeout = classifyGeminiThrownFailure(new DOMException('simulated', 'AbortError'));
    const unavailable = classifyGeminiHttpFailure(503, { error: { status: 'UNAVAILABLE' } });
    expect(timeout).toBe('GEMINI_TIMEOUT');
    expect(unavailable).toBe('GEMINI_MODEL_UNAVAILABLE');
    expect(isRetryableGeminiFailure(timeout)).toBe(true);
    expect(isRetryableGeminiFailure(unavailable)).toBe(true);
    expect(edgeSource).toContain('budget.limits.maxGeminiCalls');
  });

  it('keeps tool failure distinct and non-retryable', () => {
    const toolError = Object.assign(new Error('simulated'), { code: 'GEMINI_TOOL_ERROR' });
    const classified = classifyGeminiThrownFailure(toolError);
    expect(classified).toBe('GEMINI_TOOL_ERROR');
    expect(isRetryableGeminiFailure(classified)).toBe(false);
  });

  it('marks an exhausted second-pass simulation as structured degraded output', () => {
    expect(edgeSource).toContain("fallbackSource: 'structured_tool_result'");
    expect(edgeSource).toContain("conversation_status: secondPassFailure ? 'degraded' : 'success'");
    expect(edgeSource).toContain("status: conversationStatus");
  });

  it('preserves SUCCESS, DEGRADED and UNAVAILABLE as distinguishable client states', () => {
    expect(clientSource).toContain("status: String(data?.status || 'success')");
    expect(clientSource).toContain("status: 'degraded'");
    expect(clientSource).toContain("status: 'unavailable'");
    expect(clientSource).toContain("providerStatus: 'empty'");
  });
});
