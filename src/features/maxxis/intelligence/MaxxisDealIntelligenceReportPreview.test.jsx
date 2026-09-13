import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';

describe('Maxxis Deal Intelligence professional report preview', () => {
  it('renders the six-page foundation while keeping investment quality separate from profile fit', () => {
    const schema = buildMaxxisReportSchema({
      reportType: 'DEAL_INTELLIGENCE',
      property: { id: 'property-1', title: 'Stored property' },
      dealIntelligence: {
        executiveDealOverview: 'Evidence-based investment intelligence.',
        investmentFit: { score: 75, strategy: { status: 'matched' }, requiredMessage: 'Profile compatibility only.' },
        propertyEvidence: { strength: 'MEDIUM', verifiedRecords: [{ field: 'sqft' }], conflicts: [] },
        comparableEvidence: { used: [{ address: 'Recorded comp' }], supporting: [], excluded: [] },
        valuationIntelligence: { status: 'ARV_LIMITED', range: { low: 380000, high: 430000 }, confidence: 'LOW', methodology: 'DEALSIFTER_WEIGHTED_ARV_V1' },
        riskAnalysis: [{ category: 'DATA_RISK' }], limitations: ['Condition unknown'],
        nextVerificationSteps: ['Validate condition'], provenance: { property: 'PROPERTY_INTELLIGENCE' },
      },
    });
    const html = renderToStaticMarkup(<MaxxisDealIntelligenceReportPreview schema={schema} />);
    expect((html.match(/data-report-page=/g) || [])).toHaveLength(6);
    expect(html).toContain('Executive Investment Brief');
    expect(html).toContain('Comparable Analysis');
    expect(html).toContain('Investment Quality: NOT EVALUATED');
    expect(html).toContain('PDF, email, and share rendering are prepared but not active.');
    expect(html).not.toMatch(/\b(?:BUY|SELL|GOOD DEAL)\b/);
  });
});
