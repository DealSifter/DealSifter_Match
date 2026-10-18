import { describe, expect, it, vi } from 'vitest';
import { ReferenceReportComposition } from './referenceReportPdf';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';
import { reportIntegrityFixtures } from '../../../../scripts/report-integrity-fixtures.mjs';

function setup(reportType, locale = 'pt') {
  const input = reportIntegrityFixtures().find(f => f.id === 'PROPERTY_PARITY').input;
  const original = buildStrictReportViewModel({ schema: buildMaxxisReportSchema({ ...input, reportType,
    dealIntelligence: { ...input.dealIntelligence, investmentFit: { score: 78 } } }), language: locale });
  const vm = { ...original, property: { ...original.property, photos: ['photo1', 'photo2', 'photo3', 'photo4', 'photo5'] } };
  const audit = { lines: [], sections: [], maps: [] }, pages = [];
  const doc = new Proxy({ getCurrentPageInfo: () => ({ pageNumber: pages.length }), getImageProperties: () => ({ width: 1000, height: 240, fileType: 'PNG' }) }, {
    get(target, key) { return target[key] || (target[key] = vi.fn()); },
  });
  const flow = { doc, logo: 'official-logo', audit, pages, image: vi.fn(() => true), mapImage: vi.fn(() => false), drawMap: vi.fn(),
    lines: (value, width, size = 10) => {
      const limit = Math.max(1, Math.floor(width / (size * .52))), words = String(value).split(/\s+/), result = [];
      let current = '';
      for (const word of words) {
        if (current && current.length + word.length + 1 > limit) { result.push(current); current = ''; }
        current += `${current ? ' ' : ''}${word}`;
      }
      return [...result, current];
    },
    drawLines: (lines, x, y, width, sectionId, size) => lines.forEach((text, i) => audit.lines.push({ text, x, y: y + i * (size + 4), width, sectionId })),
    newPage: title => { pages.push(title); flow.referenceHeader?.(title); },
  };
  return { vm, flow, composition: new ReferenceReportComposition(flow, vm, {}, null) };
}

describe('incremental report density, without analytical changes', () => {
  it.each(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('%s keeps five photos with a larger main photo and usable map/notes space', reportType => {
    const { flow, composition, vm } = setup(reportType), before = JSON.stringify(vm.sections);
    composition.overview();
    const photos = flow.audit.sections.filter(s => s.kind === 'reference-photo');
    expect(photos).toHaveLength(5);
    expect(new Set(photos.map(p => p.page)).size).toBe(1);
    expect(photos[0].bounds.width).toBeCloseTo(photos[1].bounds.width * 2);
    expect(photos.every(p => p.bounds.height >= 80 && p.bounds.width / p.bounds.height < 2.2)).toBe(true);
    expect(flow.image).toHaveBeenCalledTimes(6); // Hero plus all five gallery images.
    const map = flow.audit.sections.find(s => s.sectionId === 'propertyLocationMap');
    expect(map.bounds.height).toBeGreaterThan(100);
    expect(flow.audit.sections.find(s => s.sectionId === 'publisher-notes').bounds.height).toBe(map.bounds.height);
    expect(JSON.stringify(vm.sections)).toBe(before);
  });
  it.each(['pt', 'en', 'es'])('balances short parcel fields into two columns with full-width legal description in %s', locale => {
    const { flow, composition } = setup('DEAL_INTELLIGENCE', locale);
    composition.overview();
    const card = flow.audit.sections.find(s => s.sectionId === 'overviewFacts2');
    const content = flow.audit.lines.filter(s => s.sectionId === 'overviewFacts2');
    const apn = content.find(line => line.text === 'QA-APN-066'), county = content.find(line => line.text === 'Pulaski');
    expect(apn.y).toBe(county.y);
    expect(apn.x).not.toBe(county.x);
    const legal = content.find(line => line.text.startsWith('LOT 7R'));
    expect(legal.width).toBe(card.bounds.width - 20);
    expect(legal.y).toBeGreaterThan(apn.y);
    expect(card.bounds.height).toBeLessThan(250);
  });
  it('preserves comparison maps, ranges, graph size and the profile gauge', () => {
    const { flow, composition } = setup('DEAL_INTELLIGENCE');
    composition.market(); composition.valuation(); composition.profile();
    expect(flow.drawMap.mock.calls.some(([, , , , height]) => height >= 142)).toBe(true);
    expect(flow.doc.circle.mock.calls.some(([, , radius]) => radius === 58)).toBe(true);
  });
  it('does not inflate brief summaries and conclusions into tall empty cards', () => {
    const { flow, composition } = setup('DEAL_INTELLIGENCE');
    composition.profile(); composition.verification();
    expect(flow.audit.sections.find(s => s.sectionId === 'profileInsights').bounds.height).toBeLessThan(100);
    expect(flow.audit.sections.find(s => s.sectionId === 'verificationConclusion').bounds.height).toBeLessThan(100);
  });
});
