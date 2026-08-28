import { describe, expect, it } from 'vitest';
import { buildToolInterpretationRequest, sanitizeToolResultForGemini } from './toolResultForGemini.ts';

describe('sanitized Gemini tool interpretation payload', () => {
  it('keeps authoritative property metrics while removing contact and hidden fields', () => {
    const safe = sanitizeToolResultForGemini({
      type: 'property_details',
      found: true,
      property: { id: 'property-1', city: 'Dallas', state: 'TX', price: 200000, address: 'Private Street', description: 'Call 214-555-0101' },
      metrics: { metrics: { pricePerSqft: { value: 125, calculable: true, source: 'calculated' } } },
      contact: { email: 'private@example.com', phone: '+12145550101' },
      workflow: { items: [{ code: 'property_reviewed', status: 'completed', metadata: { email: 'private@example.com' } }] },
    });
    const serialized = JSON.stringify(safe);
    expect(serialized).toContain('125');
    expect(serialized).toContain('property_reviewed');
    expect(serialized).not.toMatch(/Private Street|private@example|214-555|\+1214|description|address|metadata/i);
  });

  it('builds one function response and never declares another tool round', () => {
    const request = buildToolInterpretationRequest({
      contents: [{ role: 'user', parts: [{ text: 'Question' }] }],
      modelParts: [{ functionCall: { name: 'searchProperties', args: {} } }],
      toolName: 'searchProperties',
      functionCallId: 'call-1',
      toolResult: { type: 'properties', items: [] },
      language: 'pt',
      generationConfig: { maxOutputTokens: 500, thinkingConfig: { thinkingLevel: 'minimal' } },
      safetySettings: [],
    });
    expect(request).not.toHaveProperty('tools');
    expect(JSON.stringify(request.systemInstruction)).toContain('Maxxis Deal AI');
    expect(request.contents.at(-1)).toEqual(expect.objectContaining({ role: 'user' }));
    expect(JSON.stringify(request.contents.at(-1))).toContain('functionResponse');
    expect(JSON.stringify(request.contents.at(-1))).toContain('call-1');
  });
});
