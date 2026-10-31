import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';
import { localizePresentationText } from '../../../services/chatTranslation';
import { prepareReportNarrativePresentation } from '../presentation/reportNarrativePresentation';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });

const property = {
  id: 'report-template-test', address: '1200 Fictional Street', city: 'Example City', state: 'FL', zip: '00000',
  type: 'SFR', price: 425000, beds: 4, baths: 2, sqft: 1780, rehab: 48000,
  lot: 9600, yearBuilt: 2004, county: 'Example County', assessedValue: 390000, annualPropertyTax: 5200,
  owner: { name: 'Sample Owner', type: 'Individual', status: 'Not verified', allowedContacts: [{ value: '+1 205 378 0355' }, { value: 'owner.full.address@example.com' }] },
  latestSalePrice: 682130, latestSaleDate: '2014-03-07T00:00:00.000Z',
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
  it.each(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('uses cached presentation notes in the real %s PDF without translation work during rendering', async reportType => {
    const original = `Welcome to The Dalegrove MCM. Notes ${reportType}.`;
    const translated = 'Bem-vindo ao The Dalegrove MCM. Piscina privativa.';
    const translate = vi.fn(async () => ({ data: { translatedText: translated, translationSource: 'gemini' } }));
    const registered = Object.freeze({ ...property, images: [], notes: original });
    await localizePresentationText({ text: original, targetLocale: 'pt', invoke: translate });
    const report = buildMaxxisReportSchema({ reportType, property: registered, dealIntelligence: intelligence,
      maxxisAnalysis: { executiveSummary: 'Evidence summary.', profileAlignment: { score: 70 }, riskAwareness: [], limitations: ['Condition unknown'], nextSteps: ['Verify condition'], provenance: { property: 'USER_PROVIDED' } } });
    await prepareReportNarrativePresentation(report, 'pt');
    const result = await renderMaxxisReportPdf({ schema: report, language: 'pt', generatedAt: '2026-10-09T12:00:00Z',
      exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType, channel: 'PDF' }) });
    const pages = await pdfPages(result);
    expect(pages.map(page => page.text).join(' ')).toContain('Bem-vindo ao The Dalegrove MCM. Piscina privativa.');
    expect(registered.notes).toBe(original);
    expect(translate).toHaveBeenCalledTimes(1);
  }, 30000);
  it('uses the original-color official logo only in the shared header, with no brand footer', () => {
    const source = readFileSync(new URL('./maxxisReportPdf.js', import.meta.url), 'utf8');
    const drawing = readFileSync(new URL('./strictReportPdf.ts', import.meta.url), 'utf8');
    expect(source).toContain("import officialDealSifterLogo from '../../../assets/maxxis/report-official-logo.png?inline'");
    expect(drawing).toContain("this.doc.addImage(this.logo");
    expect(`${source}${drawing}`).not.toMatch(/(?:recolor|tint|grayscale)\s*\(/i);
    const footer = drawing.split('  finish() {')[1].split('const COPY =')[0];
    expect(footer).not.toMatch(/addImage|officialDealSifterLogo|slogan/i);
  });

  it('keeps every actual page title below the shared masthead and every body line above the footer', async () => {
    const result = await render('PROPERTY_RELEASE');
    const audit = result.document.layoutAudit;
    const titles = audit.lines.filter(line => line.sectionId === 'headerPageTitle');
    expect(titles).toHaveLength(result.document.pageCount);
    expect(titles.every(line => line.y >= 80 && line.bottomY <= 124)).toBe(true);
    expect(audit.lines.filter(line => !/^(?:header|footer)/.test(line.sectionId)).every(line => line.bottomY <= 799)).toBe(true);
  }, 30000);

  it('preserves complete property facts and expands the layout before the photo section', () => {
    const model = buildStrictReportViewModel({ schema: buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', property }), language: 'en' });
    const facts = model.property.facts.flatMap(group => group.rows).map(row => `${row.label}: ${row.value}`).join('\n');
    expect(facts).toContain('2004');
    expect(facts).toContain('Example County');
    expect(facts).toContain('682,130');
    expect(facts).toContain('Mar 7, 2014');
    expect(facts).not.toMatch(/annualPropertyTax|propertyTaxYear|\[object Object\]/);
  }, 30000);

  it.each([
    ['en', 'PROPERTY RELEASE', 'Page 1 / 1', 'Mar 7, 2014'],
    ['pt', 'RELATÓRIO DO IMÓVEL', 'Página 1 / 1', '07/03/2014'],
    ['es', 'INFORME DE LA PROPIEDAD', 'Página 1 / 1', '07/03/2014'],
  ])('renders factual Basic in %s as one stable A4 page', async (language, title, pageLabel, saleDate) => {
    const result = await render('PROPERTY_RELEASE', language);
    expect(result.state).toBe('RENDERED');
    const pages = await pdfPages(result);
    expect(pages).toHaveLength(1);
    expect(pages[0].width).toBeCloseTo(595.28, 1);
    expect(pages[0].height).toBeCloseTo(841.89, 1);
    expect(pages[0].text).toContain(title);
    expect(pages[0].text).toContain('1200 Fictional Street');
    expect(pages[0].text).not.toContain('+1 205 378 0355');
    expect(pages[0].text.replace(/\s/g, '')).not.toContain('owner.full.address@example.com');
    expect(pages[0].text).toContain(saleDate);
    expect(result.document.cover.generatedAt).toBe('2026-09-21T22:45:00.000Z');
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
      expect(pages.length).toBe(result.document.pageCount);
      const content = pages.map(page => page.text).join(' ');
      expect(content).toContain('three bedrooms');
      expect(content).toContain('Unresolved physical disagreements: Bedrooms.');
      expect(content).toContain('Flagged values cannot support calculations.');
      expect(content).toContain('Current market evidence does not support a valuation conclusion');
      expect(content).not.toMatch(/\$0|Preserved information|MISSING_|annualPropertyTax|87%/);
      expect(result.document.strictViewModel.executive.thesis.text).toContain('1200 Fictional Street');
      expect(result.document.outputValidation.valid).toBe(true);
      for (const item of result.document.layoutAudit.continuations) expect(item).toMatchObject({ sectionId: expect.any(String), title: expect.any(String), kind: expect.any(String) });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  }, 30000);

  it('preserves PRO facts and compatibility without elevating unsupported legacy narrative into evidence', async () => {
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
    expect(pages.length).toBeLessThanOrEqual(3);
    const content = pages.map(page => page.text).join(' ');
    expect(content).not.toContain('Sample Owner');
    expect(content).toContain('2004');
    expect(content).not.toContain('74%');
    expect(content).toContain('Investment Profile not configured or unavailable.');
    expect(content).not.toContain('Recorded positive signal.');
    expect(content).not.toContain('Recorded missing evidence.');
    expect(result.document.outputValidation.valid).toBe(true);
  }, 30000);

  it('ships one static page asset per physical preview page', () => {
    const manifest = JSON.parse(readFileSync(new URL('../../../assets/maxxis/report-previews/manifest.json', import.meta.url), 'utf8'));
    for (const { product, pageCount: total } of Object.values(manifest.reports)) {
      for (let page = 1; page <= total; page += 1) {
        const bytes = readFileSync(new URL(`../../../assets/maxxis/report-previews/${product}-page-${page}.png`, import.meta.url));
        expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      }
    }
  });
});
