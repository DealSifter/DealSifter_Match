import { describe, it, expect } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';
import { composeReportContent, reportReaderText, REPORT_INTERNAL_JARGON } from './reportContentPlan';
import { setReportPublisherDisclosure } from './reportPublisherDisclosure';
import { r4Fixtures } from '../../../../scripts/report-r4-fixtures.mjs';
import {renderMaxxisReportPdf} from './maxxisReportPdf';
import {resolveReportExportEntitlement} from './reportExportEntitlement';
const fixture = (id: string) => r4Fixtures().find((item: any) => item.id === id)!.input;
const model = (id = 'rich', reportType = 'DEAL_INTELLIGENCE') => buildStrictReportViewModel({ schema: buildMaxxisReportSchema({ ...fixture(id), reportType }), language: 'en' });
describe('R4 content and privacy contract', () => {
  it('embeds the trusted report reference in the PDF metadata without copying attempt payloads', async () => {
    const reportTrace = {reportId:'00000000-0000-4000-8000-000000000013',requestId:'00000000-0000-4000-8000-000000000014',unexpected:'never-export'};
    const schema = buildMaxxisReportSchema({...fixture('sparse'),reportType:'PROPERTY_RELEASE',reportTrace});
    expect(schema.reportTrace).toEqual({reportId:reportTrace.reportId,requestId:reportTrace.requestId});
    const result = await renderMaxxisReportPdf({schema,generatedAt:'2026-10-30T12:00:00Z',exportEntitlement:resolveReportExportEntitlement({plan:'free',reportType:'PROPERTY_RELEASE',channel:'PDF'})});
    expect(result.state).toBe('RENDERED');
    const pdf = new TextDecoder().decode(result.document.binary);
    expect(pdf).toContain(`report_id=${reportTrace.reportId}`);expect(pdf).toContain(`request_id=${reportTrace.requestId}`);
    expect(pdf).not.toContain('never-export');
  });
  it.each(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('declares content and a ceiling, not fixed pages: %s', reportType => {
    const schema = buildMaxxisReportSchema({ ...fixture('rich'), reportType });
    expect(schema.pages).toEqual([]); expect(schema.contentSections.length).toBeGreaterThan(0);
    expect(schema.layoutPolicy.maxPages).toBe(reportType === 'PROPERTY_RELEASE' ? 1 : reportType === 'MAXXIS_ANALYSIS' ? 3 : null);
  });
  it('consolidates missing indicators into one actionable table', () => {
    const blocks = composeReportContent(model('sparse')), pending = blocks.filter(b => b.id === 'report-pending');
    expect(pending).toHaveLength(1); expect(pending[0].columns).toEqual(['Indicator', 'Reason', 'Required action']);
    expect(pending[0].table!.every(row => row.length === 3 && row.every(Boolean))).toBe(true);
    expect(blocks.some(block => /readiness|pending/.test(block.id) && block.id !== 'report-pending')).toBe(false);
  });
  it('deduplicates repeated narrative and photos by content', () => {
    const vm = model(); vm.property.photos = ['data:image/png;base64,AA', 'data:image/png;base64,AA'];
    vm.sections.push({ ...vm.sections.find(s => s.text)!, id: 'duplicate-fixture' });
    const blocks = composeReportContent(vm), texts = blocks.map(b => b.text).filter(Boolean), photos = blocks.flatMap(b => b.photos || []);
    expect(new Set(texts).size).toBe(texts.length); expect(photos).toHaveLength(1);
    expect(blocks.filter(b => b.kind === 'disclaimer')).toHaveLength(1); expect(blocks.at(-1)!.kind).toBe('disclaimer');
  });
  it('deduplicates visible fields across different evidence references and omits the overview price from later cards', () => {
    const vm = model('sparse');
    vm.sections.push({ id: 'repeated-amount', title: 'Reported basis', kind: 'facts', priority: 1, continuationPolicy: 'SAME_SECTION', evidenceRefs: [], rows: [
      { label: 'Asking price', value: vm.property.price, evidenceRefs: ['different:reference'] },
    ] });
    expect(composeReportContent(vm).flatMap(block => block.rows || []).filter(row => row.label === 'Asking price')).toHaveLength(0);
  });
  it('keeps table and single map identities aligned; incomplete coordinates mean subject only', () => {
    const vm = model(), blocks = composeReportContent(vm), map = blocks.find(b => b.map)!;
    expect(blocks.filter(b => b.map)).toHaveLength(1);
    expect(map.map!.points.map(p => p.marker)).toEqual(['S', '1', '2', '3']);
    vm.sections.find(s => s.map && s.table)!.map!.points.pop();
    expect(composeReportContent(vm).find(b => b.map)!.map!.points.map(p => p.marker)).toEqual(['S']);
  });
  it('does not expose publisher details without an explicit authorized choice', () => {
    const schema = buildMaxxisReportSchema({ ...fixture('rich'), reportType: 'DEAL_INTELLIGENCE' });
    const visible = (includePublisher?: boolean) => JSON.stringify(composeReportContent(buildStrictReportViewModel({ schema, includePublisher })));
    expect(visible()).not.toMatch(/Fictional Publisher|publisher@example.invalid/);
    setReportPublisherDisclosure(schema, true); expect(visible()).toContain('publisher@example.invalid');
    setReportPublisherDisclosure(schema, false); expect(visible()).not.toContain('publisher@example.invalid');
    const denied = buildMaxxisReportSchema({ ...fixture('rich'), property: { ...fixture('rich').property, owner: { name: 'Fictional Publisher', allowedContacts: [] } }, reportType: 'DEAL_INTELLIGENCE' });
    expect(JSON.stringify(composeReportContent(buildStrictReportViewModel({ schema: denied, includePublisher: true })))).not.toContain('Fictional Publisher');
  });
  it.each(['pt', 'en', 'es'])('removes internal jargon without clipping in %s', locale => {
    const text = reportReaderText('SOLD / AVM / gate / structural candidates / normalized / not requested in this flow', locale);
    expect(text).not.toMatch(REPORT_INTERNAL_JARGON); expect(text).not.toContain('…');
  });
  it('labels preliminary evidence and keeps a single source/date block', () => {
    const vm = model('partial'), blocks = composeReportContent(vm);
    expect(vm.completion).toBe('PRELIMINARY'); expect(blocks.find(b => b.id === 'arv-market')!.title).toContain('Preliminary');
    expect(blocks.filter(b => b.id === 'report-sources')).toHaveLength(1);
    expect(JSON.stringify(blocks.find(b => b.id === 'report-sources'))).toContain('2026-10-30');
    expect(JSON.stringify(blocks.find(b => b.id === 'report-sources'))).toContain('Comparable sales');
    expect(model('sparse').disclaimer).not.toContain('GIS'); expect(model('rich').disclaimer).toContain('GIS');
  });
});
