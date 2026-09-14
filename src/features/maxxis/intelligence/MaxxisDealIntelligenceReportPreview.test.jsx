import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';

const property = {
  id: 'property-1', title: 'Stored property', city: 'Austin', state: 'TX', zip: '78701',
  type: 'SFR', price: 320000, rehab: 60000, beds: 3, baths: 2, sqft: 1600,
  capRate: 5.2, lot: '7,500 sqft', objective: 'Fix and Flip', description: 'Stored notes',
  images: ['https://property-images.example.test/subject.jpg'], published: true,
};

const maxxisAnalysis = {
  executiveSummary: 'The available information indicates partial profile fit.',
  keyObservations: { positives: ['Target market aligned.'], attention: ['Condition is unknown.'] },
  profileAlignment: { score: 75, semantics: 'PROFILE_FIT_ONLY' },
  riskAwareness: [{ code: 'UNKNOWN_CONDITION', category: 'DATA_RISK', severity: 'MEDIUM', reason: 'Condition is unknown.' }],
  limitations: ['Condition is unknown.'], nextSteps: ['Validate condition.'],
};

function dealIntelligence(status = 'ARV_LIMITED') {
  const unavailable = status === 'ARV_UNAVAILABLE';
  return {
    executiveDealOverview: 'Based on available evidence, profile alignment is partial.',
    whyThisPropertyStandsOut: [{ explanation: 'Target market aligned.', source: 'CALCULATED' }],
    investmentFit: { score: 75, strategy: { status: 'matched' }, targetMarket: { status: 'matched' }, propertyType: { status: 'matched' } },
    propertyEvidence: { strength: 'MEDIUM', verifiedRecords: [{ field: 'sqft' }], userProvided: [{ field: 'price' }], unknown: [{ field: 'yearBuilt' }], conflicts: [] },
    comparableEvidence: { used: unavailable ? [] : [{ compIdentifier: 'comp-1', address: 'Recorded comp', salePrice: 390000, saleDate: '2026-04-08', distanceMiles: 0.5, similarity: 88, conditionStatus: 'MATCHES_TARGET', role: 'PRIMARY', image: 'https://external-comp-image.example.test/forbidden.jpg' }], supporting: [], excluded: [{ compIdentifier: 'comp-2', address: 'Excluded comp', role: 'EXCLUDED', exclusionReason: 'Structural dissimilarity' }] },
    valuationIntelligence: { status, range: unavailable ? null : { low: 430000, high: 490000 }, centralReference: unavailable ? null : 460000, confidence: unavailable ? 'LOW' : 'MODERATE', compsUsed: unavailable ? 0 : 1, methodology: unavailable ? null : 'DEALSIFTER_WEIGHTED_ARV_V1', warnings: unavailable ? ['INSUFFICIENT_COMPS'] : ['SCENARIO_BASED'] },
    riskAnalysis: [{ code: 'UNKNOWN_CONDITION', category: 'DATA_RISK', severity: 'HIGH', reason: 'Condition is unknown.' }],
    limitations: ['yearBuilt: UNKNOWN'], nextVerificationSteps: ['Validate condition.'],
    provenance: { property: 'PROPERTY_INTELLIGENCE' },
  };
}

const render = (schema) => renderToStaticMarkup(<MaxxisDealIntelligenceReportPreview schema={schema} />);

describe('Maxxis Deal Intelligence Report Experience v2', () => {
  it('renders Free Property Release as one property-only page', () => {
    const html = render(buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', property }));
    expect((html.match(/data-report-page=/g) || [])).toHaveLength(1);
    expect(html).toContain('Investor-ready property release');
    expect(html).toContain('Property Photos');
    expect(html).toContain('Location Map');
    expect(html).not.toContain('Comparative Market Analysis');
    expect(html).not.toContain('Estimated ARV Range');
  });

  it('renders Pro Maxxis Analysis without premium valuation or comparable content', () => {
    const html = render(buildMaxxisReportSchema({ reportType: 'MAXXIS_ANALYSIS', property, maxxisAnalysis }));
    expect((html.match(/data-report-page=/g) || [])).toHaveLength(2);
    expect(html).toContain('Powered by MAXXIS AI');
    expect(html).toContain('Profile fit');
    expect(html).not.toContain('Estimated ARV Range');
    expect(html).not.toContain('Sale Price');
  });

  it('renders the six-page Enterprise experience with approved report sections', () => {
    const html = render(buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: dealIntelligence() }));
    expect((html.match(/data-report-page=/g) || [])).toHaveLength(6);
    for (const heading of ['Comparative Market Analysis', 'Valuation Intelligence', 'Powered by MAXXIS AI']) expect(html).toContain(heading);
    expect(html).toContain('data-report-section="INVESTMENT_FIT_RISK"');
    expect(html).toContain('data-report-section="KEY_INSIGHTS_VERIFICATION"');
    expect(html).toContain('Match Score represents profile compatibility, not investment quality.');
    expect(html).toContain('does not constitute appraisal');
    expect(html).not.toMatch(/\b(?:BUY|SELL|GOOD DEAL|GUARANTEED)\b/);
  });

  it('shows scenario KPIs without false precision or a guaranteed result', () => {
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: dealIntelligence() });
    expect(schema.presentation.kpiScenarios).toMatchObject({ available: true, scenarioBased: true, rounded: true, sourceType: 'CALCULATED' });
    expect(schema.presentation.kpiScenarios.potentialSpread).toEqual([
      { scenario: 'LOW', value: 50000 }, { scenario: 'EXPECTED', value: 80000 }, { scenario: 'HIGH', value: 110000 },
    ]);
    expect(render(schema)).toContain('Scenario-based illustration from existing inputs; not a return forecast or guarantee.');
  });

  it('uses no external comparable images', () => {
    const html = render(buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: dealIntelligence() }));
    expect(html).toContain('https://property-images.example.test/subject.jpg');
    expect(html).not.toContain('external-comp-image.example.test');
    expect(html).toContain('no external comparable images');
  });

  it('keeps ARV unavailable and unknown fields explicit without $0 or KPI substitution', () => {
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: dealIntelligence('ARV_UNAVAILABLE') });
    const html = render(schema);
    expect(schema.presentation.kpiScenarios).toMatchObject({ available: false, sourceType: 'UNKNOWN' });
    expect(html).toContain('ARV_UNAVAILABLE');
    expect(html).toContain('UNKNOWN');
    expect(html).not.toContain('$0');
    expect(JSON.stringify(schema)).not.toMatch(/\bavm\b/i);
  });
});
