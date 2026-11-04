import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';
import { composeReportContent } from './reportContentPlan';
import { renderMaxxisReportPdf } from './maxxisReportPdf';
import { resolveReportExportEntitlement } from './reportExportEntitlement';
import { r43Fixtures, R4_TIME } from '../../../../scripts/report-r43-fixtures.mjs';
import { REFERENCE_DESIGN } from './reportReferenceDesign';
import { StrictPdfFlow } from './strictReportPdf';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

const photo = 'data:image/jpeg;base64,' + readFileSync(new URL('../../../assets/maxxis/report-previews/sample-property-photo.jpg', import.meta.url)).toString('base64');
const gallery = [photo, ...[1, 2, 3, 4].map(number => 'data:image/jpeg;base64,' + readFileSync(new URL(`../../../../qa/report-template/sample-photos/gallery-${number}.jpg`, import.meta.url)).toString('base64'))];
const basemap = 'data:image/png;base64,' + readFileSync(new URL('../../../../qa/report-template/sample-location-basemap.png', import.meta.url)).toString('base64');
const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
const makeSchema = (id: string, reportType = 'DEAL_INTELLIGENCE', photos: string[] = []) => {
  const input = structuredClone(r43Fixtures(photos).find((fixture: any) => fixture.id === id)!.input);
  return buildMaxxisReportSchema({ ...input, reportType });
};
const render = (schema: any, extra = {}) => renderMaxxisReportPdf({ schema, generatedAt: R4_TIME, language: 'en',
  exportEntitlement: resolveReportExportEntitlement({ plan: 'enterprise', reportType: schema.reportType, channel: 'PDF' }), ...extra });

describe('reference-specific report compositions', () => {
  let report: any, before: string, model: any, blocks: any[], stripImages: any[], galleryImages: any[];
  beforeAll(async () => {
    const schema = makeSchema('rich', 'DEAL_INTELLIGENCE', gallery);
    before = JSON.stringify(schema);
    model = buildStrictReportViewModel({ schema, language: 'en' });
    blocks = composeReportContent(model);
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('OFFLINE_ONLY'));
    const image = vi.spyOn(StrictPdfFlow.prototype, 'image');
    try {
      report = await render(schema, { mapImageData: basemap });
      expect(fetch).not.toHaveBeenCalled();
      stripImages = image.mock.calls.filter(call => call[1] === 30 && call[2] === 86);
      galleryImages = image.mock.calls.filter(call => gallery.slice(1).includes(call[0]));
    } finally { fetch.mockRestore(); image.mockRestore(); }
    expect(report.state).toBe('RENDERED');
    expect(JSON.stringify(schema)).toBe(before);
  }, 60000);

  it('uses the reference overview geometry, including three facts, a single photo strip, map and notes', () => {
    const sections = report.document.layoutAudit.sections;
    expect(sections.find((s: any) => s.sectionId === 'property-overview').bounds).toMatchObject({ y: 144, height: 155 });
    const facts = sections.filter((s: any) => s.kind === 'reference-facts');
    expect(facts).toHaveLength(3);
    expect(facts.every((s: any) => s.bounds.y === 314 && s.bounds.height >= 100)).toBe(true);
    expect(new Set(facts.map((s: any) => s.bounds.width)).size).toBe(1);
    const photos=sections.find((s: any) => s.sectionId === 'property-gallery'),map=sections.find((s: any) => s.kind === 'map' && s.page === 1),notes=sections.find((s: any) => s.sectionId === 'listing-description');
    expect(photos.bounds.height).toBe(112);
    expect(photos.bounds.y - facts[0].bounds.bottom).toBe(4);
    expect(galleryImages).toHaveLength(4);
    for (const image of galleryImages) {
      expect(image[2] - photos.bounds.y).toBe(33);
      expect(image[4]).toBe(71);
      expect(image[2] + image[4]).toBe(photos.bounds.bottom - 8);
    }
    const overviewLines = report.document.layoutAudit.lines.filter((line: any) => line.sectionId === 'property-overview');
    const price = overviewLines.find((line: any) => line.text === model.property.price);
    const badge = overviewLines.find((line: any) => line.text === [model.property.type, model.property.strategy].filter(Boolean).join(' · '));
    expect(badge.y).toBeGreaterThan(price.bottomY);
    expect(map.bounds.y).toBeGreaterThan(photos.bounds.bottom);
    expect(map.bounds.y).toBe(notes.bounds.y);
    expect(REFERENCE_DESIGN.overview.factsY).toBe(314);
  });

  it('keeps completeness inside the masthead on every page, with date and pagination alone in the footer', () => {
    const audit = report.document.layoutAudit, count = report.document.pageCount;
    for (const id of ['headerProduct', 'headerPlan', 'headerCompleteness']) {
      const lines = audit.lines.filter((line: any) => line.sectionId === id);
      expect(lines).toHaveLength(count);
      expect(lines.every((line: any) => line.y >= 0 && line.bottomY <= 90)).toBe(true);
    }
    expect(audit.lines.filter((line: any) => line.y >= 810).every((line: any) => /^footer-(date|page)$/.test(line.sectionId))).toBe(true);
    expect(audit.lines.some((line: any) => line.sectionId === 'header-page')).toBe(false);
    expect(audit.lines.filter((line: any) => line.sectionId === 'footer-page')).toHaveLength(count);
    const counters = audit.lines.filter((line: any) => /^Page \d+ of \d+$/.test(line.text));
    expect(counters).toHaveLength(count);
    expect(counters.every((line: any) => line.sectionId === 'footer-page' && line.y >= 810)).toBe(true);
    expect(audit.lines.filter((line: any) => line.sectionId === 'referenceChapter')).toHaveLength(count);
  });

  it('uses the two-by-two profile and verification compositions and separate map/table panels', () => {
    const audit = report.document.layoutAudit;
    const profile = audit.sections.find((s: any) => s.kind === 'reference-profile');
    const gauge = audit.sections.find((s: any) => s.kind === 'reference-gauge');
    const bars = audit.sections.find((s: any) => s.kind === 'reference-bars');
    expect(profile.bounds).toMatchObject({ y: 212, height: 140 });
    expect(gauge.bounds.y).toBe(profile.bounds.y);
    expect(gauge.bounds.x).toBeGreaterThan(profile.bounds.right);
    expect(bars.bounds).toMatchObject({ y: 359, height: 150 });
    expect(audit.sections.some((s: any) => s.kind === 'reference-evidence-summary')).toBe(true);
    const maps = audit.sections.filter((s: any) => s.kind === 'reference-map');
    expect(maps.length).toBeGreaterThan(0);
    for (const map of maps) {
      const table = audit.sections.find((s: any) => s.page === map.page && s.kind === 'table');
      expect(table.bounds.y).toBeGreaterThan(map.bounds.bottom);
    }
    const panels = audit.sections.filter((s: any) => /^report-pending-(missing|considerations|checks)$/.test(s.sectionId));
    expect(panels.every((s: any) => s.bounds.height >= 124 && s.bounds.height < 245)).toBe(true);
  });

  it('insets the first title inside the overlapping card and preserves spacing after subsequent property strips', () => {
    const sections = report.document.layoutAudit.sections;
    for (const heading of sections.filter((s: any) => s.kind === 'heading')) {
      const previousBottom = heading.page === 1 ? 82 : 140;
      expect(heading.bounds.y - previousBottom).toBe(heading.page === 1 ? 14 : 3 * 8);
      const next = sections.find((s: any) => s.page === heading.page && s.bounds.y >= heading.bounds.bottom && s.kind !== 'heading');
      expect(next.bounds.y - heading.bounds.bottom).toBe(2 * 7);
    }
  });

  it('gives comparative maps more vertical space while preserving every table below them', () => {
    const audit = report.document.layoutAudit;
    const maps = audit.sections.filter((s: any) => s.kind === 'reference-map');
    expect(maps.length).toBeGreaterThan(0);
    for (const map of maps) {
      expect(map.bounds.height).toBeGreaterThanOrEqual(165);
      const table = audit.sections.find((s: any) => s.sectionId === map.sectionId.replace(/-map$/, ''));
      expect(table).toBeDefined();
      expect(table.page > map.page || table.bounds.y > map.bounds.bottom).toBe(true);
    }
  });

  it('keeps the one-page release records in two columns and enlarges the hero, gallery and location map', async () => {
    const schema = makeSchema('rich', 'PROPERTY_RELEASE', gallery);
    const model = buildStrictReportViewModel({ schema, language: 'en' });
    const image = vi.spyOn(StrictPdfFlow.prototype, 'image');
    let result: any, images: any[];
    try { result = await render(schema, { mapImageData: basemap }); images = [...image.mock.calls]; }
    finally { image.mockRestore(); }
    expect(result.state).toBe('RENDERED');
    expect(result.document.pageCount).toBe(1);
    const audit = result.document.layoutAudit;
    const records = audit.sections.find((s: any) => s.kind === 'reference-facts' && s.title === 'Tax records');
    const details = audit.sections.find((s: any) => s.kind === 'reference-facts' && s.title === 'Property details');
    expect(records.bounds.width).toBeGreaterThan(details.bounds.width * 1.9);
    const labels = audit.lines.filter((line: any) => line.sectionId === records.sectionId);
    const xs = [...new Set(labels.filter((line: any) => line.y > records.bounds.y + 20).map((line: any) => line.x))];
    expect(xs.length).toBeGreaterThanOrEqual(4); // label and value in each of two columns
    const text = normalize(audit.lines.map((line: any) => line.text).join(' '));
    for (const block of composeReportContent(model).filter((block: any) => block.id.startsWith('property-group-'))) {
      for (const row of block.rows || []) expect(text).toContain(normalize(row.value));
    }
    expect(audit.sections.find((s: any) => s.sectionId === 'property-overview').bounds.height).toBeGreaterThan(120);
    expect(audit.sections.find((s: any) => s.sectionId === 'property-gallery').bounds.height).toBeGreaterThan(65);
    expect(images!.filter(call => gallery.slice(1).includes(call[0])).every(call => call[4] > 32)).toBe(true);
    const map = audit.sections.find((s: any) => s.kind === 'map');
    const enterpriseMap = report.document.layoutAudit.sections.find((s: any) => s.page === 1 && s.kind === 'map');
    expect(map.bounds.height).toBe(194);
    expect(map.bounds.width).toBeCloseTo(enterpriseMap.bounds.width, 2);
    expect(map.bounds.height).toBe(enterpriseMap.bounds.height);
    expect(audit.lines.every((line: any) => line.overflowX === 0 && line.overflowY === 0)).toBe(true);
  }, 30000);

  it('uses one unchanged-size strip with photo, address, price and characteristics above the title on every later page', () => {
    const audit=report.document.layoutAudit, strips=audit.sections.filter((s:any)=>s.kind==='property-strip');
    expect(strips).toHaveLength(report.document.pageCount-1);
    expect(stripImages).toHaveLength(strips.length);
    for (const call of stripImages) { expect(call[0]).toBe(model.property.photos[0]); expect(call.slice(1,5)).toEqual([30,86,96,50]); }
    for (const strip of strips) {
      expect(strip.bounds).toMatchObject({x:26,y:82,width:543.28,height:58});
      const title=audit.sections.find((s:any)=>s.page===strip.page&&s.kind==='heading');
      expect(strip.bounds.y).toBeLessThan(REFERENCE_DESIGN.masthead.height);
      expect(title.bounds.y).toBeGreaterThan(strip.bounds.bottom);
      const content=audit.lines.filter((line:any)=>line.page===strip.page&&line.sectionId==='reference-context').map((line:any)=>line.text).join(' ');
      for (const value of [model.property.address,model.property.price,...model.property.metrics.filter((row:any)=>/Bedrooms|Bathrooms|Living area/i.test(row.label)).map((row:any)=>row.value)]) expect(content).toContain(value);
    }
    expect(report.document.pageCount).toBeLessThanOrEqual(6);
  });

  it('uses the original complete logomark and centers its tagline within the full-bleed header', async () => {
    const audit=report.document.layoutAudit;
    const original = readFileSync(new URL('../../../assets/maxxis/report-official-logo.png', import.meta.url));
    expect(createHash('sha256').update(original).digest('hex')).toBe('2d207307fc06a7fe57bdbf00b89b0e8331039d15fc6a983660bc5ca585f98d0d');
    expect(audit.lines.filter((line:any)=>line.sectionId==='headerBrand')).toHaveLength(0);
    const taglines = audit.lines.filter((line:any)=>line.sectionId==='headerTagline');
    expect(taglines).toHaveLength(report.document.pageCount);
    for (const tagline of taglines) {
      expect(tagline.text).toBe('Real Data. Smarter Decisions.');
      expect(tagline.x+tagline.width/2).toBeCloseTo(REFERENCE_DESIGN.brand.x+REFERENCE_DESIGN.brand.width/2,1);
      expect(tagline.y).toBeGreaterThan(REFERENCE_DESIGN.brand.y+REFERENCE_DESIGN.brand.width*REFERENCE_DESIGN.brand.source.height/REFERENCE_DESIGN.brand.source.width);
    }
    for (let page=1;page<=report.document.pageCount;page++) {
      const title=audit.lines.find((line:any)=>line.page===page&&line.sectionId==='headerProduct'),subtitle=audit.lines.find((line:any)=>line.page===page&&line.sectionId==='headerSubtitle');
      expect(title.x+title.width/2).toBeCloseTo(subtitle.x+subtitle.width/2,1);
    }
    Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
    const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loading=getDocument({data:report.document.binary.slice()}),pdf=await loading.promise;
    try {
      const page=await pdf.getPage(1),viewport=page.getViewport({scale:1}),canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height)),context=canvas.getContext('2d');
      await page.render({canvasContext:context,viewport,canvas:canvas as any}).promise;
      for (const [x,y] of [[1,1],[594,1],[1,89],[594,89]]) {
        const actual=[...context.getImageData(x,y,1,1).data].slice(0,3);
        // PDF color conversion may round an 8-bit channel by one unit.
        expect(actual.every((channel,index)=>Math.abs(channel-[39,49,57][index])<=1)).toBe(true);
      }
      // The large opening card overlaps the same eight points of the masthead as later strips.
      const overlap=[...context.getImageData(140,88,1,1).data].slice(0,3);
      expect(overlap.every((channel,index)=>Math.abs(channel-[251,253,254][index])<=1)).toBe(true);
    } finally {await loading.destroy();}
  },30000);

  it('retains every original fact value, source qualification, comparable cell and narrative without changing the model', () => {
    const text = normalize(report.document.layoutAudit.lines.map((line: any) => line.text).join(' '));
    for (const block of blocks) {
      for (const row of block.rows || []) {
        for (const value of row.value.split(' · ').map(normalize).filter(Boolean)) {
          if (value.includes('@')) expect(text.replace(/\s/g, ''), block.id + ': ' + row.label).toContain(value.replace(/\s/g, ''));
          else expect(text, block.id + ': ' + row.label).toContain(value);
        }
      }
      for (const row of block.table || []) for (const cell of row) expect(text, block.id + ': table').toContain(normalize(cell));
      if (block.text && block.kind !== 'overview') expect(text, block.id + ': narrative').toContain(normalize(block.text));
    }
    for (const value of [model.property.address, model.property.location, model.property.price, model.property.type, model.property.strategy]) expect(text).toContain(normalize(value));
    const afterModel = buildStrictReportViewModel({ schema: JSON.parse(before), language: 'en' });
    expect(afterModel).toEqual(model);
  });

  it('never overlaps body panels, clips text, or leaves a sources-only or disclaimer-only final page', () => {
    const audit = report.document.layoutAudit;
    expect(audit.lines.every((line: any) => line.overflowX === 0 && line.overflowY === 0)).toBe(true);
    expect(audit.sections.every((s: any) => s.bounds.bottom <= 790)).toBe(true);
    for (const a of audit.sections) for (const b of audit.sections) if (a !== b && a.page === b.page) {
      expect(Math.min(a.bounds.right, b.bounds.right) > Math.max(a.bounds.x, b.bounds.x) && Math.min(a.bounds.bottom, b.bounds.bottom) > Math.max(a.bounds.y, b.bounds.y), a.sectionId + '/' + b.sectionId).toBe(false);
    }
    const last = audit.sections.filter((s: any) => s.page === report.document.pageCount && s.kind !== 'heading');
    expect(last.some((s: any) => s.sectionId === 'reference-conclusion-summary')).toBe(true);
    expect(last.at(-1).sectionId).toBe('report-disclaimer');
  });

  it.each(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('renders a sparse %s without fabricated fill or forced empty chapters', async type => {
    const result: any = await render(makeSchema('sparse', type));
    expect(result.state).toBe('RENDERED');
    expect(result.document.pageCount).toBeLessThanOrEqual(type === 'PROPERTY_RELEASE' ? 1 : 2);
    const text = result.document.layoutAudit.lines.map((line: any) => line.text).join(' ');
    expect(text).not.toMatch(/NaN|undefined|\$0|86%|78%/);
  }, 30000);
});
