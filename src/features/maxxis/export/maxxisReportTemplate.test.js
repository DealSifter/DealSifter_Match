import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

const property = {
  id: 'report-template-test', address: '1200 Fictional Street', city: 'Example City', state: 'FL', zip: '00000',
  type: 'SFR', price: 425000, beds: 4, baths: 2, sqft: 1780, rehab: 48000,
  lot: 9600, yearBuilt: 2004, county: 'Example County', assessedValue: 390000, annualPropertyTax: 5200,
  owner: { name: 'Sample Owner', type: 'Individual', status: 'Not verified', allowedContacts: [] },
  notes: 'Owner narrative says three bedrooms; the structured record says four.', published: true,
};
const intelligence = {
  executiveDealOverview: 'Only recorded facts and supplied analysis are displayed.',
  whyThisPropertyStandsOut: ['A recorded property fact is available.'],
  investmentFit: { score: 62 },
  propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [], conflicts: [{ field: 'beds' }] },
  comparableEvidence: { used: [], supporting: [], excluded: [] },
  valuationIntelligence: { status: 'ARV_UNAVAILABLE', warnings: ['Insufficient condition evidence.'] },
  riskAnalysis: [], limitations: ['Condition unverified.'], nextVerificationSteps: ['Verify condition.'],
  analysisConfidence: {
    score: 87, classification: 'LIMITED', semantics: 'ANALYSIS_COMPLETENESS_AND_RELIABILITY_ONLY',
    notPropertyScore: true, contributors: ['Verified property records'], limitations: ['Condition unknown'],
  },
  executiveSummaryIntelligence: {
    lines: [
      'Only recorded facts and supplied analysis are displayed.',
      'The assessment reflects the verified property fields.',
      'Comparable and valuation support remains unavailable.',
      'The principal uncertainty is the property condition.',
      'Focus on the unresolved evidence before making a decision.',
      'Next verification priority: verify condition.',
    ],
  },
  provenance: { propertyEvidence: 'USER_PROVIDED' },
};

async function pdfPages(result) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await getDocument({ data: result.document.binary, useSystemFonts: true }).promise;
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const page = await pdf.getPage(index + 1);
    const content = await page.getTextContent();
    return { text: content.items.map((item) => item.str).join(' '), width: page.view[2], height: page.view[3] };
  }));
  pdf.cleanup();
  return pages;
}

async function render(reportType, language = 'en') {
  const plan = reportType === 'DEAL_INTELLIGENCE' ? 'enterprise' : 'free';
  return renderMaxxisReportPdf({
    schema: buildMaxxisReportSchema({ reportType, property, dealIntelligence: intelligence }),
    exportEntitlement: resolveReportExportEntitlement({ plan, reportType, channel: 'PDF' }),
    generatedAt: '2026-09-21T22:45:00.000Z', language,
  });
}

describe('canonical PDF template behavior', () => {
  it('uses the original-color official logo only in the shared header, with no brand footer', () => {
    const source = readFileSync(new URL('./maxxisReportPdf.js', import.meta.url), 'utf8');
    expect(source).toContain("import officialDealSifterLogo from '../../../assets/maxxis/report-official-logo.png?inline'");
    expect(source).toContain("doc.addImage(officialDealSifterLogo, 'PNG'");
    expect(source).not.toMatch(/(?:recolor|tint|grayscale)\s*\(/i);
    const footer = source.split('function pageFooter(')[1].split('function photo(')[0];
    expect(footer).not.toMatch(/addImage|officialDealSifterLogo|slogan/i);
  });

  it('keeps every page title below the shared graphite masthead', () => {
    const source = readFileSync(new URL('./maxxisReportPdf.js', import.meta.url), 'utf8');
    const header = source.split('function pageHeader(')[1].split('function schematicComparableMap(')[0];
    expect(header).toContain('doc.rect(0, 0, W, 86');
    expect(header).toContain('heading(doc, t[pageCode] || pageCode, M, 115');
    expect(source).toContain('const BODY_OFFSET = 7');
    expect(source).toContain('doc.setCurrentTransformationMatrix(doc.Matrix(1, 0, 0, 1, 0, -BODY_OFFSET))');
    expect(source).toContain('doc.line(M, 803 + BODY_OFFSET, W - M, 803 + BODY_OFFSET)');
  });

  it('preserves complete property facts and expands the layout before the photo section', () => {
    const source = readFileSync(new URL('./maxxisReportPdf.js', import.meta.url), 'utf8');
    const facts = source.split('function propertyFactGrid(')[1].split('function propertyBottom(')[0];
    expect(facts).toContain('const h = Math.max(134, 42 + contentHeight + 5)');
    expect(facts).toContain('latestSaleDate ? String(latestSaleDate) : null');
    expect(facts).toContain('lineHeight: 14');
    expect(facts).toContain('valueMaxLines: null');
    expect(source).toContain('factGridBottom + 15');
  });

  it.each([
    ['en', 'PROPERTY RELEASE', 'Generated', 'Page 1 / 1'],
    ['pt', 'RELATÓRIO DO IMÓVEL', 'Gerado em', 'Página 1 / 1'],
    ['es', 'INFORME DE LA PROPIEDAD', 'Generado', 'Página 1 / 1'],
  ])('renders factual Basic in %s as one stable A4 page', async (language, title, dateLabel, pageLabel) => {
    const result = await render('PROPERTY_RELEASE', language);
    expect(result.state).toBe('RENDERED');
    const pages = await pdfPages(result);
    expect(pages).toHaveLength(1);
    expect(pages[0].width).toBeCloseTo(595.28, 1);
    expect(pages[0].height).toBeCloseTo(841.89, 1);
    expect(pages[0].text).toContain(title);
    expect(pages[0].text).toContain('1200 Fictional Street');
    expect(pages[0].text).toContain(dateLabel);
    expect(pages[0].text).toContain(pageLabel);
    expect(pages[0].text.split(pageLabel)).toHaveLength(2);
    expect(pages[0].text).not.toMatch(/ARV|Comparative Market Analysis|Match Score/);
  });

  it('keeps conflicts visible and unavailable ARV explicit without any external provider or Gemini call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Unexpected network call'); });
    try {
      const result = await render('DEAL_INTELLIGENCE');
      expect(result.state).toBe('RENDERED');
      const pages = await pdfPages(result);
      expect(pages).toHaveLength(6);
      expect(pages[0].text).toContain('4');
      expect(pages[0].text).toContain('three bedrooms');
      expect(pages[0].text).toContain('Needs verification');
      expect(pages[2].text).toContain('ARV unavailable');
      expect(pages[2].text).not.toContain('$0');
      expect(pages[5].text).toContain('Maxxis Analysis Confidence');
      expect(pages[5].text).toContain('87%');
      expect(pages[5].text).toContain('Positive contributions');
      expect(pages[5].text).toContain('MAXXIS EXECUTIVE SUMMARY');
      expect(pages[5].text).toContain('Only recorded facts and supplied analysis are displayed.');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });

  it('binds the existing structured PRO observations rather than dropping their positive/attention groups', async () => {
    const reportType = 'MAXXIS_ANALYSIS';
    const maxxisAnalysis = {
      executiveSummary: 'Stored profile fit is 74%.',
      keyObservations: { positives: ['Recorded positive signal.'], attention: ['Recorded missing evidence.'] },
      profileAlignment: { score: 74, targetMarket: { explanation: 'Market aligned.' } },
      riskAwareness: [], limitations: ['Condition unknown.'], nextSteps: ['Verify condition.'],
      provenance: { property: 'USER_PROVIDED' },
    };
    const result = await renderMaxxisReportPdf({
      schema: buildMaxxisReportSchema({ reportType, property, maxxisAnalysis }),
      exportEntitlement: resolveReportExportEntitlement({ plan: 'pro', reportType, channel: 'PDF' }),
      generatedAt: '2026-09-21T22:45:00.000Z',
    });
    expect(result.state).toBe('RENDERED');
    const pages = await pdfPages(result);
    expect(pages).toHaveLength(3);
    expect(pages[0].text).toContain('Recorded positive signal.');
    expect(pages[0].text).toContain('Owner Information');
    expect(pages[0].text).toContain('Property Details');
    expect(pages[0].text).toContain('Land Information');
    expect(pages[0].text).toContain('Property Photos');
    expect(pages[0].text).toContain('Location');
    expect(pages[0].text).toContain('Sample Owner');
    expect(pages[0].text).toContain('2004');
    expect(pages[2].text).toContain('Recorded missing evidence.');
  });

  it('ships one static page asset per physical preview page', () => {
    for (const [product, total] of [['property-release', 1], ['maxxis-analysis', 3], ['deal-intelligence', 6]]) {
      for (let page = 1; page <= total; page += 1) {
        const bytes = readFileSync(new URL(`../../../assets/maxxis/report-previews/${product}-page-${page}.png`, import.meta.url));
        expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      }
    }
  });
});
