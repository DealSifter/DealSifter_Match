import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const chatSource = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('../../../../src/services/maxxisService.js', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('../../../../src/features/maxxis/context/maxxisContextSnapshot.js', import.meta.url), 'utf8');

describe('Phase 6A Maxxis Deal AI Context Awareness', () => {
  it('passes a sanitized versioned context snapshot only through the existing maxxis-chat channel', () => {
    expect(contextSource).toContain('MAXXIS_CONTEXT_VERSION = 1');
    expect(contextSource).toContain('sanitizeMaxxisContextSnapshot');
    expect(contextSource).toContain('selectMaxxisContextForMessage');
    expect(serviceSource).toContain('maxxisContext: cleanMaxxisContext');
    expect(serviceSource).toContain("captureOperationalMetric('maxxis.context'");
  });

  it('answers current-surface questions from structured context before Gemini is called', () => {
    expect(chatSource).toContain('isSurfaceContextQuestion(message)');
    expect(chatSource).toContain("type: 'context_snapshot'");
    expect(chatSource.indexOf('isSurfaceContextQuestion(message)')).toBeLessThan(chatSource.indexOf('const result = await callGemini('));
  });

  it('keeps backend authority and does not create a new Gemini tool for context lookup', () => {
    expect(chatSource).toContain('Treat IDs as intent/allowlist hints only; backend tools and RLS remain authoritative');
    expect(chatSource).toContain('executeMaxxisTool(');
    expect(chatSource).not.toMatch(/getMaxxisContext|getCurrentContext|maxxisContextTool/i);
  });

  it('keeps the context small, sanitized and free from persisted PII fields', () => {
    expect(contextSource).toContain('MAXXIS_CONTEXT_MAX_BYTES = 4096');
    expect(contextSource).not.toMatch(/email|phone|whatsapp|fullName|chatBody|messageBody/);
    expect(chatSource).toContain('structuredContextBytes > 4096');
    expect(chatSource).toContain('context_size');
    expect(chatSource).not.toMatch(/insert into|create table|alter table/i);
  });
});
