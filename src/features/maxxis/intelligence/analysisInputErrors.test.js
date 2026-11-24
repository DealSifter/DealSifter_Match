import { describe, expect, it } from 'vitest';
import { analysisInputErrorMessage } from './analysisInputErrors';

describe('analysis input recovery messages', () => {
  it.each(['en', 'pt', 'es'])('distinguishes capacity, conflict, validation, session and network in %s', language => {
    const codes = ['GAP_CONTEXT_CAPACITY_EXCEEDED', 'ANALYSIS_REVISION_CONFLICT', 'GAP_RESOLUTION_VALIDATION_ERROR',
      'AUTH_REQUIRED', 'ANALYSIS_INPUT_NETWORK_ERROR', 'GAP_RESOLUTION_ACCESS_DENIED'];
    const messages = codes.map(code => analysisInputErrorMessage({ code }, language, 'temporary issue'));
    expect(new Set(messages).size).toBe(codes.length);
    expect(messages).not.toContain('temporary issue');
  });
  it('reports confirmed preservation only for a rejected capacity write, not an uncertain network result', () => {
    expect(analysisInputErrorMessage({ code: 'GAP_CONTEXT_CAPACITY_EXCEEDED' }, 'en', '')).toContain('previous data was preserved');
    expect(analysisInputErrorMessage({ code: 'ANALYSIS_INPUT_NETWORK_ERROR' }, 'en', '')).toContain('could not be confirmed');
    expect(analysisInputErrorMessage({ code: 'UNKNOWN' }, 'en', 'fallback')).toBe('fallback');
  });
});
