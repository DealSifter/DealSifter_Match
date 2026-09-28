import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Maxxis land report pipeline regression', () => {
  it('dispatches trusted property analysis deterministically before Gemini tool selection', () => {
    const source = readFileSync(new URL('../../../../supabase/functions/maxxis-chat/index.ts', import.meta.url), 'utf8');
    const deterministicAt = source.indexOf('const deterministicPropertyAnalysisCall:');
    const providerSelectionAt = source.indexOf('for (const model of geminiModels.slice');
    expect(deterministicAt).toBeGreaterThan(-1);
    expect(deterministicAt).toBeLessThan(providerSelectionAt);
    expect(source).toContain('} else if (deterministicPropertyAnalysisCall) {');
    expect(source).toContain('const mandatoryFunctionCall = deterministicPropertyAnalysisCall ||');
    expect(source).toContain("name: 'getDealInsightContext'");
  });

  it('keeps the structured report when only optional Gemini interpretation degrades', () => {
    const source = readFileSync(new URL('../../../../supabase/functions/maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(source).toContain("fallbackSource: 'structured_tool_result'");
    expect(source).toContain("const text = interpretedText || canonicalSummary || dealInsightMessage");
    expect(source).toContain("type: 'deal_insight', data: result");
  });

  it('releases failed one-shot report mode without deleting property or conversation state', () => {
    const source = readFileSync(new URL('../../../components/maxxis/MaxxisAssistant.jsx', import.meta.url), 'utf8');
    expect(source).toContain('lastReportFailureRef.current = createMaxxisReportFailureState');
    expect(source).toContain('setPropertyAnalysisMode(null)');
    expect(source).toContain('composeMaxxisReportFailureExplanation(previousReportFailure, language)');
    expect(source).toContain("if (!reportGenerationFailed) persistStructuredDealMemory(result, 'DEAL_REVIEW')");
    expect(source).toMatch(/else if \(projectedReport\) \{[\s\S]*?setPropertyAnalysisMode\(null\);/);
  });
});
