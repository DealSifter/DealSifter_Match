import { describe, expect, it } from 'vitest';
import { reportCategoryAccent } from './referenceReportPdf';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';
import { r4Fixtures } from '../../../../scripts/report-r4-fixtures.mjs';
const render = async (reportType, description) => {
  const input = r4Fixtures().find(f => f.id === 'rich').input;
  const schema = buildMaxxisReportSchema({ ...input, reportType, property: { ...input.property, images: [], ...(description ? { description } : {}) } });
  const result = await renderMaxxisReportPdf({ schema, language: 'en', generatedAt: '2026-10-30T12:00:00Z', exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType, channel: 'PDF' }) });
  expect(result.state).toBe('RENDERED');
  return result.document;
};
describe('measured content layout with the approved brand', () => {
  it.each(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('fits complete blocks and text inside physical pages: %s', async type => {
    const document = await render(type), audit = document.layoutAudit;
    expect(document.pageCount).toBeLessThanOrEqual(type === 'PROPERTY_RELEASE' ? 1 : type === 'MAXXIS_ANALYSIS' ? 3 : Infinity);
    expect(audit.sections.every(s => s.bounds.y >= 130 && s.bounds.bottom <= 790 && s.clippedLines === 0)).toBe(true);
    expect(audit.lines.every(l => l.overflowX === 0 && l.overflowY === 0)).toBe(true);
    expect(audit.sections.filter(s => s.sectionId === 'report-disclaimer')).toHaveLength(1);
    expect(audit.sections.at(-1).sectionId).toBe('report-disclaimer');
    for (const a of audit.sections) for (const b of audit.sections) if (a !== b && a.page === b.page) {
      const overlap = Math.min(a.bounds.right, b.bounds.right) > Math.max(a.bounds.x,b.bounds.x) && Math.min(a.bounds.bottom,b.bounds.bottom) > Math.max(a.bounds.y,b.bounds.y);
      expect(overlap).toBe(false);
    }
    expect(audit.maps).toHaveLength(1);
    expect(audit.lines.filter(l => l.sectionId === 'headerPlan')).toHaveLength(document.pageCount);
  });
  it('grows the note with its text instead of clipping it or using a fixed continuation page', async () => {
    const note = Array.from({length: 65}, (_,i) => 'Detail'+i).join(' ');
    const document = await render('DEAL_INTELLIGENCE', note);
    const text = document.layoutAudit.lines.map(l => l.text).join(' ');
    expect(text).toContain('Detail0'); expect(text).toContain('Detail64');
    expect(text).not.toContain(String.fromCharCode(8230));
    expect(document.layoutAudit.continuations).toHaveLength(0);
  });
  it('preserves category colors', () => {
    expect(reportCategoryAccent('PROPERTY_RELEASE')).toEqual([25,179,184]);
    expect(reportCategoryAccent('MAXXIS_ANALYSIS')).toEqual([0,145,95]);
    expect(reportCategoryAccent('DEAL_INTELLIGENCE')).toEqual([231,167,0]);
  });
});
