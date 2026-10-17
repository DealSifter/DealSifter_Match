import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel, validateReportViewModel } from '../export/reportIntegrityViewModel';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';
import { MaxxisAnalysisReportExperience } from './MaxxisAnalysisReportExperience';

const dataPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTQAAAABJRU5ErkJggg==';
const property = { id: 'property-1', address: '4724 W 26th St', city: 'Little Rock', state: 'AR', zip: '72204',
  type: 'SFR', objective: 'Sell', price: 90000, beds: 3, baths: 2, sqft: 1760, lot: 5000,
  capRate: 0, rehab: 0, description: 'Original publisher notes.', images: [dataPhoto], latitude: 34.727, longitude: -92.328 };
const intelligence = { executiveDealOverview: 'Legacy preformatted provider estimate $0, annualPropertyTax, MISSING CAPRATE',
  whyThisPropertyStandsOut: [], investmentFit: { score: 29 },
  propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [{ field: 'propertyTaxYear' }], conflicts: [] },
  comparableEvidence: { used: [], supporting: [], excluded: [] },
  valuationIntelligence: { status: 'ARV_UNAVAILABLE', providerEstimate: { value: 0 }, warnings: ['MISSING_CAPRATE'] },
  limitations: ['annualPropertyTax: UNKNOWN'], nextVerificationSteps: [], provenance: { property: 'USER_PROVIDED' } };
const schemaFor = (reportType = 'DEAL_INTELLIGENCE', override = {}) => buildMaxxisReportSchema({ reportType,
  property: { ...property, ...override }, dealIntelligence: intelligence,
  maxxisAnalysis: { executiveSummary: 'Raw unsupported summary', profileAlignment: { score: 29 }, provenance: { property: 'USER_PROVIDED' } } });
const render = (schema, language = 'en') => renderToStaticMarkup(<MaxxisDealIntelligenceReportPreview schema={schema} language={language} />);
const visibleText = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('strict inline report boundary shared with PDF projection', () => {
  it('renders L1 as factual property-only content without premium analysis', () => {
    const html = render(schemaFor('PROPERTY_RELEASE'));
    expect((html.match(/data-report-page=/g) || [])).toHaveLength(1);
    expect(html).toContain('4724 W 26th St');
    expect(html).toContain('Original publisher notes.');
    expect(html).toContain('Location Map');
    expect(html).toContain(dataPhoto);
    expect(html).not.toContain('EXECUTIVE_SNAPSHOT');
    expect(html).not.toContain('MARKET_RENT');
    expect(html).not.toContain('arv-market');
  });

  it('L2 excludes L3 sold/ARV premium content and keeps the existing visual family', () => {
    const html = render(schemaFor('MAXXIS_ANALYSIS'));
    expect(html).toContain('class="is-level-2">PRO</span>');
    expect(html).toContain('maxxis-v2-page-body');
    expect(html).toContain('maxxis-v2-info-card is-narrative');
    expect(html).toContain('EXECUTIVE_SNAPSHOT');
    expect(html).not.toContain('arv-market');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Raw unsupported summary');
    expect(html).not.toContain('maxxis-report-export-actions');
  });

  it('assembles only substantive L3 sections instead of six fixed pages', () => {
    const schema = schemaFor(), view = buildStrictReportViewModel({ schema });
    expect(validateReportViewModel(view).valid).toBe(true);
    const html = render(schema);
    for (const section of view.sections) expect(html).toContain(`data-report-section="${section.id}"`);
    expect(html).toContain('Limited evidence coverage');
    expect(html).toContain('Executive Deal Snapshot');
    expect(html).toContain('not deal quality, probability of success or analysis confidence');
    expect(html).toContain('class="is-level-3">ENTERPRISE</span>');
    expect(html).not.toContain('arv-market');
    expect(html).not.toContain('positive-signals');
    expect((html.match(/data-report-page=/g) || [])).toHaveLength(1);
    expect(html).not.toMatch(/\b(?:BUY|SELL|GOOD DEAL|GUARANTEED)\b/);
  });

  it.each(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('blocks false-zero/raw-object/enum narratives in %s', level => {
    const schema = schemaFor(level, { localizedPropertyUserNotes: '{"translation":"Notas localizadas seguras."}',
      owner: { name: { private: 'raw object must not show' }, allowedContacts: [] },
      materialPropertyFeatures: [{ privatePayload: 'must not appear' }] });
    const html = visibleText(render(schema, 'pt'));
    expect(html).toContain('Notas localizadas seguras.');
    expect(html).not.toMatch(/annualPropertyTax|propertyTaxYear|MISSING[ _]CAPRATE|ARV_UNAVAILABLE|\{"translation"|\[object Object\]|undefined|NaN|Infinity|raw object|privatePayload/);
    expect(html).not.toMatch(/(?:US\$|\$)\s*0(?:\D|$)|(?:^|\s)0%/);
  });

  it('never reads arbitrary legacy pages or leaks internal page codes', () => {
    const original = schemaFor();
    const html = render({ ...original, pages: [{ page: 100, code: 'INTERNAL_RAW_LEAK', sections: ['PRIVATE_DATA'] }],
      structuredAnalysis: { executiveSummary: '{"translation":"BAD"}', missingEvidence: ['annualPropertyTax'] } });
    expect(html).not.toContain('INTERNAL_RAW_LEAK');
    expect(html).not.toContain('PRIVATE_DATA');
    expect(html).not.toContain('annualPropertyTax');
    expect(html).not.toContain('BAD');
  });

  it('uses the exact same five rental rows and marker numbering with pure coordinate geometry', () => {
    const initial = schemaFor();
    const marketRent = { monthlyRentEstimate: 2400, rangeLow: 2100, rangeHigh: 2700,
      rentPerSqft: { value: 1.36 }, rentPerBedroom: { value: 800 }, retrievedAt: '2026-10-16T12:00:00Z', freshness: 'FRESH',
      subject: { latitude: 34.727, longitude: -92.328, bedrooms: 3, bathrooms: 2, livingAreaSqft: 1760 },
      reportRentalComparables: Array.from({ length: 5 }, (_, index) => ({ id: `rental-${index + 1}`, number: index + 1,
        address: `${index + 1} Safe Rental`, monthlyRent: 2200 + index * 100, distanceMiles: index * .2,
        providerCorrelation: .95 - index * .01, latitude: 34.728 + index * .001, longitude: -92.329 - index * .001 })) };
    const html = render({ ...initial, presentation: { ...initial.presentation, marketRent } });
    expect(html).toContain('data-report-section="MARKET_RENT"');
    for (let number = 1; number <= 5; number += 1) {
      expect(html).toContain(`${number} Safe Rental`);
      expect(html).toContain(`data-report-map-marker="${number}"`);
      expect(html).toContain(`data-report-comp-number="${number}"`);
    }
    expect(html).toContain('data-report-map-marker="S"');
    expect(html).not.toContain('tile.openstreetmap');
    expect(html).not.toContain('iframe');
    expect(html).toContain('$2,400');
  });

  it('rejects raw provider URLs and never fetches from SSR/closed rendering', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('UNEXPECTED_NETWORK'); });
    try {
      const html = render(schemaFor('DEAL_INTELLIGENCE', { images: ['https://provider.example.test/raw-property.jpg'],
        comparableEvidence: [{ image: 'https://provider.example.test/raw-comparable.jpg' }] }));
      expect(html).not.toContain('https://provider.example.test');
      expect(html).not.toContain('<table');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it.each([['pt-BR', 'Cobertura de evidências limitada'], ['es-ES', 'Cobertura de evidencia limitada'], ['en-US', 'Limited evidence coverage']])('localizes system narrative from the strict model in %s', (language, expected) => {
    const html = visibleText(render(schemaFor(), language));
    expect(html).toContain(expected);
    expect(html).not.toContain('Legacy preformatted');
    expect(html).not.toContain('MISSING CAPRATE');
    if (language !== 'en-US') expect(html).not.toContain('Current market evidence does not support');
  });

  it('L2 experience delegates summary/highlights to the strict schema rather than raw report fields', () => {
    const report = { type: 'maxxis_analysis_report', executiveSummary: 'RAW REPORT BYPASS',
      propertyHighlights: { verified: [{ field: 'annualPropertyTax', label: 'INTERNAL_LABEL', value: { raw: true } }] },
      riskAwareness: [{ severity: {}, explanation: 'unsafe' }], nextSteps: ['MISSING_CAPRATE'] };
    const html = renderToStaticMarkup(<MaxxisAnalysisReportExperience report={report} reportSchema={schemaFor('MAXXIS_ANALYSIS')} />);
    expect(html).toContain('4724 W 26th St');
    expect(html).not.toMatch(/RAW REPORT BYPASS|INTERNAL_LABEL|annualPropertyTax|\[object Object\]|MISSING_CAPRATE/);
  });

  it('does not render unauthorized or missing report schemas', () => {
    expect(render(null)).toBe('');
    expect(render({ type: 'raw_provider_response', data: property })).toBe('');
    expect(renderToStaticMarkup(<MaxxisAnalysisReportExperience report={{ type: 'maxxis_analysis_report', executiveSummary: 'do not render without schema' }} />)).not.toContain('do not render');
  });
});
