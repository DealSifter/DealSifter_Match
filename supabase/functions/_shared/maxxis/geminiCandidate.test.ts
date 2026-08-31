import { describe, expect, it } from 'vitest';
import { inspectGeminiCandidate } from './geminiCandidate.ts';

const tools = new Set(['getPropertyDetails', 'getDealCopilotOverview']);

describe('Gemini candidate success contract', () => {
  it('rejects HTTP-success payloads with no useful candidate', () => {
    expect(inspectGeminiCandidate({ candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }, tools)).toMatchObject({
      usable: false,
      failure: 'GEMINI_EMPTY_RESPONSE',
    });
  });

  it('rejects whitespace and invalid tool calls as partial output', () => {
    expect(inspectGeminiCandidate({ candidates: [{ content: { parts: [{ text: '   ' }, { functionCall: { name: '' } }] } }] }, tools).usable).toBe(false);
    expect(inspectGeminiCandidate({ candidates: [{ content: { parts: [{ functionCall: { name: 'unknownTool' } }] } }] }, tools).usable).toBe(false);
  });

  it('accepts useful text or a declared tool call', () => {
    expect(inspectGeminiCandidate({ candidates: [{ content: { parts: [{ text: 'Useful answer' }] } }] }, tools)).toMatchObject({ usable: true, text: 'Useful answer' });
    expect(inspectGeminiCandidate({ candidates: [{ content: { parts: [{ functionCall: { name: 'getDealCopilotOverview', args: {} } }] } }] }, tools)).toMatchObject({ usable: true });
  });

  it('preserves blocked-response classification', () => {
    expect(inspectGeminiCandidate({ candidates: [{ finishReason: 'SAFETY' }] }, tools).failure).toBe('GEMINI_BLOCKED_RESPONSE');
  });
});
