import { describe, expect, it } from 'vitest';
import { buildAnalyticalInteractionInstruction, MAXXIS_ANALYTICAL_INTERACTION } from './analyticalInteraction.ts';
import { buildSystemPrompt } from './prompts.ts';
import { buildToolInterpretationRequest } from './toolResultForGemini.ts';

describe('Maxxis Analytical Interaction', () => {
  it('keeps answer-first materiality and factual semantics in one canonical policy', () => {
    expect(MAXXIS_ANALYTICAL_INTERACTION).toContain('answer the central question first');
    expect(MAXXIS_ANALYTICAL_INTERACTION).toContain('never a bad deal');
    expect(MAXXIS_ANALYTICAL_INTERACTION).toContain('never verification of the whole property');
    expect(MAXXIS_ANALYTICAL_INTERACTION).toContain('Tax assessment is not market value, appraisal, or ARV');
    expect(MAXXIS_ANALYTICAL_INTERACTION).toContain('missing data');
  });

  it('applies adaptive depth globally without forcing a deal template on FAQ/help', () => {
    const prompt = buildSystemPrompt('en', 'dashboard');
    expect(prompt).toContain('Simple FAQ/help and educational questions get a direct, concise answer');
    expect(prompt.match(/MAXXIS ANALYTICAL INTERACTION/g)).toHaveLength(1);
    expect(prompt).not.toContain('UNDERSTAND\nPRIORITIZE\nANSWER');
  });

  it('specializes Deal Insight for main insight, evidence, uncertainty, and one useful next step', () => {
    const request = buildToolInterpretationRequest({
      contents: [{ role: 'user', parts: [{ text: 'Analyze this deal for me.' }] }],
      modelParts: [{ functionCall: { name: 'getDealInsightContext', args: { propertyId: '00000000-0000-4000-8000-000000000000' } } }],
      toolName: 'getDealInsightContext', toolResult: { type: 'deal_insight', state: 'available' },
      language: 'en', generationConfig: {}, safetySettings: [], plainToolResult: true,
    });
    const text = String(request.systemInstruction.parts[0].text);
    expect(text).toContain(buildAnalyticalInteractionInstruction('deal_insight'));
    expect(text).toContain('Start with the most material profile-fit or deal-context insight');
    expect(text).toContain('Offer at most one useful next step');
  });
});
