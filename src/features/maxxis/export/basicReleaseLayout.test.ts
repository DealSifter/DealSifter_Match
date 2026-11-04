import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { r43Fixtures } from '../../../../scripts/report-r43-fixtures.mjs';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';
import { composeReportContent } from './reportContentPlan';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';
import { REFERENCE_DESIGN } from './reportReferenceDesign';

const photo = 'data:image/jpeg;base64,' + readFileSync(new URL('../../../assets/maxxis/report-previews/sample-property-photo.jpg', import.meta.url)).toString('base64');
const photos = [photo, ...[1, 2, 3, 4].map(i => 'data:image/jpeg;base64,' + readFileSync(new URL(`../../../../qa/report-template/sample-photos/gallery-${i}.jpg`, import.meta.url)).toString('base64'))];
const map = 'data:image/png;base64,' + readFileSync(new URL('../../../../qa/report-template/sample-location-basemap.png', import.meta.url)).toString('base64');
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim();

describe('one-page Basic Release with complete content', () => {
  it('fits short notes together with long legal text and several publisher contact channels', async () => {
    const input = structuredClone(r43Fixtures(photos).find((f: any) => f.id === 'rich')!.input);
    input.property.notes = 'Fictional property notes about the home, garden, layout and access. '.repeat(7);
    input.property.description = input.property.notes;
    input.property.legalDescription = 'Fictional Lot 5-A, Block 2, Sample Beach Subdivision. Sewer easement across the eastern boundary of the parcel, together with recorded utility access along the southern boundary.';
    input.property.owner = { name: 'Fictional Publisher and Property Holdings', type: 'Individual', allowedContacts: [
      { type: 'phone', value: '(555) 010-0100' }, { type: 'whatsapp', value: '(555) 010-0200' },
      { type: 'telegram', value: '(555) 010-0300' }, { type: 'email', value: 'fictional-publisher@example.invalid' }
    ] };
    const schema = buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', ...input });
    const model = buildStrictReportViewModel({ schema, language: 'en', includePublisher: true });
    const result: any = await renderMaxxisReportPdf({ schema, language: 'en', includePublisher: true, mapImageData: map,
      exportEntitlement: resolveReportExportEntitlement({ plan: 'free', reportType: 'PROPERTY_RELEASE', channel: 'PDF' }) });
    expect(result.state).toBe('RENDERED');
    expect(result.document.pageCount).toBe(1);
    const text = normalized(result.document.layoutAudit.lines.map((line: any) => line.text).join(' '));
    for (const block of composeReportContent(model)) for (const row of block.rows || []) {
      expect(text.replace(/\s/g, '')).toContain(row.value.replace(/\s/g, ''));
    }
    expect(text).toContain(normalized(model.disclaimer));
    expect(result.document.layoutAudit.sections.filter((s: any) => s.kind === 'reference-facts').every((s: any) => s.bounds.bottom <= 841.89 / 2)).toBe(true);
    const audit = result.document.layoutAudit;
    expect(audit.sections.find((s: any) => s.sectionId === 'property-gallery').bounds.height).toBeGreaterThan(110);
    expect(audit.sections.find((s: any) => s.kind === 'map').bounds.height).toBe(194);
    expect(audit.sections.find((s: any) => s.sectionId === 'report-disclaimer').bounds.bottom).toBeCloseTo(790, 1);
  }, 30000);

  it.each(['en', 'pt', 'es'])('fits a long description, authorized publisher, facts, five photos, map and qualifications in %s', async language => {
    const input = structuredClone(r43Fixtures(photos).find((f: any) => f.id === 'rich')!.input);
    const description = 'Fictional house with a documented layout, garden, living spaces and utility access. '.repeat(20);
    input.property.notes = description;
    input.property.description = description;
    input.property.propertyUserNotes = description;
    const schema = buildMaxxisReportSchema({ reportType: 'PROPERTY_RELEASE', ...input });
    const model = buildStrictReportViewModel({ schema, language, includePublisher: true });
    const result: any = await renderMaxxisReportPdf({ schema, language, includePublisher: true, mapImageData: map,
      exportEntitlement: resolveReportExportEntitlement({ plan: 'free', reportType: 'PROPERTY_RELEASE', channel: 'PDF' }) });
    expect(result.state).toBe('RENDERED');
    expect(result.document.pageCount).toBe(1);
    const audit = result.document.layoutAudit;
    const text = normalized(audit.lines.map((line: any) => line.text).join(' '));
    // The report must keep every supplied word and its full qualification.
    const noteText = normalized(audit.lines.filter((line: any) => line.sectionId.startsWith('listing-description') && [7, REFERENCE_DESIGN.release.footerFontSize].includes(line.fontSize)).map((line: any) => line.text).join(' '));
    expect(noteText).toBe(normalized(description));
    expect(text).toContain(normalized(model.disclaimer));
    for (const group of composeReportContent(model).filter(block => block.id.startsWith('property-group-'))) {
      for (const row of group.rows || []) expect(text.replace(/\s/g, '')).toContain(row.value.replace(/\s/g, ''));
    }
    expect(audit.maps.length).toBe(1);
    expect(result.document.strictViewModel.property.photos).toHaveLength(5);
    expect(audit.lines.every((line: any) => line.overflowX === 0 && line.overflowY === 0)).toBe(true);
    expect(audit.sections.every((section: any) => section.bounds.bottom <= 790)).toBe(true);
    const continued = audit.sections.find((s: any) => s.sectionId === 'listing-description-continued'),
      sources = audit.sections.find((s: any) => s.sectionId === 'report-sources'),
      disclaimer = audit.sections.find((s: any) => s.sectionId === 'report-disclaimer');
    expect(continued.bounds.y).toBe(sources.bounds.y);
    expect(continued.bounds.right).toBeLessThan(sources.bounds.x);
    expect(disclaimer.bounds.y).toBeGreaterThanOrEqual(Math.max(continued.bounds.bottom, sources.bounds.bottom));
    expect(disclaimer.bounds.bottom).toBeCloseTo(790, 1);
    expect(audit.lines.filter((line: any) => /^(listing-description-continued|report-sources|report-disclaimer)$/.test(line.sectionId)).every((line: any) => line.fontSize <= 5.8)).toBe(true);
  }, 30000);
});
