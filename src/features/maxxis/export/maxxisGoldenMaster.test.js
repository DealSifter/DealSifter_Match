import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const products = [
  ['property-release-page-1.png', 'basic/page-1'],
  ['maxxis-analysis-page-1.png', 'pro/page-1'],
  ['maxxis-analysis-page-2.png', 'pro/page-2'],
  ['maxxis-analysis-page-3.png', 'pro/page-3'],
  ['deal-intelligence-page-1.png', 'enterprise/page-1'],
  ['deal-intelligence-page-2.png', 'enterprise/page-2'],
  ['deal-intelligence-page-3.png', 'enterprise/page-3'],
  ['deal-intelligence-page-4.png', 'enterprise/page-4'],
  ['deal-intelligence-page-5.png', 'enterprise/page-5'],
  ['deal-intelligence-page-6.png', 'enterprise/page-6'],
];
const root = new URL('../../../../', import.meta.url);

describe('Maxxis report golden masters', () => {
  it('has the exact approved 1/3/6 canonical reference set', () => {
    for (const [file] of products) {
      expect(existsSync(new URL(`docs/report-design-reference/${file}`, root)), file).toBe(true);
    }
  });

  it('keeps expected, actual and diff artifacts for all ten A4 pages', () => {
    const summary = JSON.parse(readFileSync(new URL('qa/report-visual-diffs/summary.json', root), 'utf8'));
    expect(summary.pages).toHaveLength(10);
    expect(summary.pass).toBe(true);
    for (const [, destination] of products) {
      for (const artifact of ['expected.png', 'actual.png', 'diff.png', 'metrics.json']) {
        expect(existsSync(new URL(`qa/report-visual-diffs/${destination}/${artifact}`, root)), `${destination}/${artifact}`).toBe(true);
      }
    }
  });

  it('uses official branding and keeps the footer logo-free', () => {
    const source = readFileSync(new URL('src/features/maxxis/export/maxxisReportPdf.js', root), 'utf8');
    const footer = source.slice(source.indexOf('function pageFooter'), source.indexOf('function photo'));
    expect(source).toContain("report-official-logo.png?inline");
    expect(footer).not.toContain('addImage');
    expect(footer).toContain('generatedAt');
    expect(footer).toContain('total');
  });
});
