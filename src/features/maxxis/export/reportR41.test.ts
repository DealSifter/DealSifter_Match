import { describe, expect, it } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { readFileSync } from 'node:fs';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';
import { composeReportContent, readableReportDate, reportCompletion, REPORT_INTERNAL_LABELS, REPORT_RAW_ISO } from './reportContentPlan';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';
import { r41Fixtures } from '../../../../scripts/report-r41-fixtures.mjs';
const types = [['PROPERTY_RELEASE','free'], ['MAXXIS_ANALYSIS','pro'], ['DEAL_INTELLIGENCE','enterprise']] as const;
const fixtures = r41Fixtures();
const vm = (id: string, reportType = 'DEAL_INTELLIGENCE') => buildStrictReportViewModel({ schema: buildMaxxisReportSchema({ ...fixtures.find((f: any) => f.id === id)!.input, reportType }), language: 'en' });
describe('R4.1 deterministic report finish, offline', () => {
  it('requires every completion prerequisite and never upgrades a partial ARV', () => {
    const full = { externalAccepted: true, hasValue: true, mainArv: true, calculatedFinancials: true, blocking: false };
    expect(reportCompletion(full)).toBe('COMPLETE');
    expect(reportCompletion({...full, blocking:true})).toBe('PARTIAL');
    expect(reportCompletion({...full, mainArv:false})).toBe('PARTIAL');
    expect(reportCompletion({...full, calculatedFinancials:false})).toBe('PARTIAL');
    expect(reportCompletion({...full, externalAccepted:false})).toBe('PRELIMINARY');
    expect(reportCompletion({...full, hasValue:false})).toBe('PRELIMINARY');
  });
  it.each(types)('keeps rich >= partial and sparse preliminary at %s', type => {
    const rank = {PRELIMINARY:0,PARTIAL:1,COMPLETE:2};
    expect(vm('sparse', type).completion).toBe(type === 'PROPERTY_RELEASE' ? 'COMPLETE' : type === 'MAXXIS_ANALYSIS' ? 'PARTIAL' : 'PRELIMINARY');
    expect(rank[vm('rich', type).completion!]).toBeGreaterThanOrEqual(rank[vm('partial', type).completion!]);
  });
  it('keeps numeric results partial while a required return indicator is unresolved', () => {
    expect(vm('rich').completion).toBe('PARTIAL');
    expect(vm('partial').completion).toBe('PARTIAL');
  });
  it('uses a prepared cartographic base with attribution and the same numbered comparables', async () => {
    const input = fixtures.find((fixture: any) => fixture.id === 'rich')!.input;
    const schema = buildMaxxisReportSchema({...input,reportType:'DEAL_INTELLIGENCE'});
    const model = buildStrictReportViewModel({schema});
    const section = model.sections.find(section => section.map && section.table)!;
    // Mock the already prepared raster; this test performs no tile request.
    const raster = 'data:image/png;base64,' + readFileSync(new URL('../../../../qa/report-template/sample-location-basemap.png',import.meta.url)).toString('base64');
    const result = await renderMaxxisReportPdf({schema,language:'en',mapImages:{[section.id]:raster},exportEntitlement:resolveReportExportEntitlement({plan:'enterprise',reportType:'DEAL_INTELLIGENCE',channel:'PDF'})});
    expect(result.state).toBe('RENDERED');
    const audit = result.document.layoutAudit, text = audit.lines.map((line:any)=>line.text).join(' ');
    expect(text).toContain('OpenStreetMap contributors'); expect(text).not.toContain('Schematic, not to scale');
    expect(audit.maps[0].points.map((point:any)=>point.marker)).toEqual(['S','1','2','3']);
    const table = audit.sections.find((block:any)=>block.sectionId === section.id + '-table');
    expect(audit.maps[0].page).toBe(table!.page);
  });
  it('omits a strategy basis whose sole price was already displayed; keeps profile/coverage outside indicator gaps', () => {
    const blocks = composeReportContent(vm('sparse'));
    expect(blocks.some(block => block.id === 'strategy-cost-basis')).toBe(false);
    expect(JSON.stringify(blocks.find(block => block.id === 'report-pending'))).not.toMatch(/Signal coverage|Profile compatibility/);
    const checks = blocks.find(block => block.id === 'next-actions');
    expect(checks?.text?.split('\n\n').length || 0).toBeLessThanOrEqual(3);
    expect(checks?.text || '').not.toMatch(REPORT_INTERNAL_LABELS);
  });
  it.each(['en','pt','es'])('formats dates consistently and never repeats subject dimensions in rent: %s', locale => {
    expect(readableReportDate('2026-10-30T12:00:00Z',locale)).not.toMatch(REPORT_RAW_ISO);
    const model = vm('rich'); model.locale = locale as 'en'|'pt'|'es';
    const blocks = composeReportContent(model), rent = blocks.find(block => block.id === 'market-rent');
    expect(rent!.hero!.value).toMatch(/^\$2,400/);
    expect(rent!.rows?.some(row => /Subject.*(?:bed|bath|area)/i.test(row.label))).toBe(false);
    expect(JSON.stringify(blocks)).not.toMatch(REPORT_RAW_ISO);
  });
  for (const fixture of fixtures) for (const [type, plan] of types) it(`${fixture.id} ${type}: no ISO, internal labels, duplicates, orphan or continued title`, async () => {
    const schema = buildMaxxisReportSchema({...fixture.input, reportType:type});
    const result = await renderMaxxisReportPdf({schema,language:'en',generatedAt:'2026-10-30T12:00:00Z',exportEntitlement:resolveReportExportEntitlement({plan,reportType:type,channel:'PDF'})});
    expect(result.state).toBe('RENDERED');
    const {layoutAudit:audit,pageCount} = result.document, text = audit.lines.map((line:any)=>line.text).join(' ');
    expect(text).not.toMatch(REPORT_RAW_ISO); expect(text).not.toMatch(REPORT_INTERNAL_LABELS);
    // The supplied clone repeats the product masthead/subtitle, never a body report title.
    expect(audit.lines.filter((line:any)=>line.page>1&&/^header(?:PageTitle|PageSubtitle)$/.test(line.sectionId))).toHaveLength(0);
    const last = audit.sections.filter((block:any)=>block.page===pageCount);
    expect(last.some((block:any)=>!['map','disclaimer'].includes(block.kind))).toBe(true);
    expect(new Set(audit.sections.map((block:any)=>block.sectionId)).size).toBe(audit.sections.length);
    expect(audit.lines.every((line:any)=>line.overflowX===0&&line.overflowY===0)).toBe(true);
    if (fixture.id==='sparse') expect(audit.maps).toHaveLength(0);
    if (audit.maps.length) expect(text).toContain('Schematic, not to scale.');
  });
});
