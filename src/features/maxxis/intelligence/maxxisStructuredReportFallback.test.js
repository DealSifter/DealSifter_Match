import { describe, expect, it } from 'vitest';
import { didStructuredReportGenerationFail, hasUsableStructuredReportFallback } from './maxxisStructuredReportFallback';

const structuredFallback = {
  type: 'deal_insight',
  degraded: true,
  fallbackSource: 'structured_tool_result',
  data: {
    state: 'available',
    dealIntelligence: { type: 'deal_intelligence_context', propertyId: 'property-1' },
  },
};

describe('Maxxis structured report fallback', () => {
  it.each(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])(
    'keeps a valid structured %s report when the Gemini interpretation degrades',
    (reportType) => {
      expect(hasUsableStructuredReportFallback(structuredFallback, reportType)).toBe(true);
      expect(didStructuredReportGenerationFail(structuredFallback, reportType)).toBe(false);
    },
  );

  it('fails closed when the structured intelligence context is absent', () => {
    expect(didStructuredReportGenerationFail({
      type: 'deal_insight', degraded: true, fallbackSource: 'structured_tool_result', data: { state: 'available' },
    }, 'DEAL_INTELLIGENCE')).toBe(true);
  });
});
