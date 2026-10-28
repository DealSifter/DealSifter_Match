import { describe, expect, it, vi } from 'vitest';
import { ReferenceReportComposition, reportCategoryAccent } from './referenceReportPdf';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel } from './reportIntegrityViewModel';
import { reportIntegrityFixtures } from '../../../../scripts/report-integrity-fixtures.mjs';

function setup(reportType, locale = 'pt') {
  const input = reportIntegrityFixtures().find(f => f.id === 'PROPERTY_PARITY').input;
  input.property.owner.allowedContacts[0].value = '+15551234567890';
  const original = buildStrictReportViewModel({ schema: buildMaxxisReportSchema({ ...input, reportType,
    dealIntelligence: { ...input.dealIntelligence, investmentFit: { score: 78 } } }), language: locale });
  const vm = { ...original, property: { ...original.property, photos: ['photo1', 'photo2', 'photo3', 'photo4', 'photo5'] } };
  const audit = { lines: [], sections: [], maps: [] }, pages = [];
  const doc = new Proxy({ getCurrentPageInfo: () => ({ pageNumber: pages.length }), getImageProperties: () => ({ width: 1000, height: 240, fileType: 'PNG' }), getTextWidth: value => String(value).length * 5.2 }, {
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
    drawLines: (lines, x, y, width, sectionId, size, bold, color) => lines.forEach((text, i) => audit.lines.push({ text, x, y: y + i * (size + 4), width, sectionId, size, bold, color })),
    newPage: title => { pages.push(title); flow.referenceHeader?.(title); },
  };
  return { vm, flow, composition: new ReferenceReportComposition(flow, vm, {}, null) };
}

describe('incremental report density, without analytical changes', () => {
  it('labels the basic report badge Basic without changing its internal report type', () => {
    const { flow, vm, composition } = setup('PROPERTY_RELEASE');
    composition.overview();
    expect(flow.audit.lines.find(line => line.sectionId === 'headerPlan').text).toBe('Basic');
    expect(vm.reportType).toBe('PROPERTY_RELEASE');
    expect(composition.accent).toEqual([25, 179, 184]);
  });
  it.each(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('%s fills the location card with the map and overlays its title and attribution', type => {
    const { flow, vm } = setup(type);
    const box = { x: 26, y: 500, w: 310, h: 160 };
    let linesAtImage;
    flow.image.mockImplementation(() => { linesAtImage = flow.audit.lines.length; return true; });
    const composition = new ReferenceReportComposition(flow, vm, {}, 'prepared-location-map');
    composition.locationCard(box);
    expect(flow.image).toHaveBeenCalledWith('prepared-location-map', box.x, box.y, box.w, box.h, 'cover');
    expect(flow.mapImage).not.toHaveBeenCalled();
    const lines = flow.audit.lines.slice(linesAtImage);
    expect(lines[0].text).toBe('Mapa de localização');
    expect(lines[0].y).toBe(box.y + 12);
    expect(lines.some(line => line.text === '© OpenStreetMap contributors')).toBe(true);
    expect(flow.drawMap).not.toHaveBeenCalled();
    expect(flow.doc.clip).toHaveBeenCalled();
    expect(flow.audit.sections.find(s => s.sectionId === 'propertyLocationMap').bounds.width).toBe(box.w);
  });
  it('keeps a full-size coordinate fallback with an accurate caption when the map image cannot be drawn', () => {
    const { flow, vm } = setup('PROPERTY_RELEASE');
    flow.image.mockReturnValue(false);
    const composition = new ReferenceReportComposition(flow, vm, {}, 'invalid-map');
    composition.locationCard({ x: 26, y: 500, w: 310, h: 160 });
    expect(flow.drawMap).toHaveBeenCalledWith([vm.property.locationPoint], 26, 500, 310, 160, 'propertyLocationMap');
    expect(flow.audit.lines.some(line => line.text.includes('© OpenStreetMap'))).toBe(false);
    expect(flow.audit.lines.some(line => line.text.includes('Diagrama de coordenadas'))).toBe(true);
  });
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
    expect(legal.width).toBe(card.bounds.width - 14);
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
  it.each([
    ['PROPERTY_RELEASE', [25, 179, 184]],
    ['MAXXIS_ANALYSIS', [0, 145, 95]],
    ['DEAL_INTELLIGENCE', [231, 167, 0]],
  ])('%s keeps original branding at 70%% size, vertically centered, with the shared dark header', (type, accent) => {
    const { flow, composition } = setup(type);
    composition.overview();
    expect(reportCategoryAccent(type)).toEqual(accent);
    expect(composition.accent).toEqual(accent);
    const brand = flow.doc.addImage.mock.calls[0];
    expect(brand[0]).toBe('official-logo');
    expect(brand[4]).toBeCloseTo(205 * .7);
    expect(brand[5] / brand[4]).toBeCloseTo(240 / 1000);
    expect(brand[3] + brand[5] / 2).toBeCloseTo(9 + 66 / 2);
    expect(flow.doc.setFillColor.mock.calls).toContainEqual([39, 49, 57]);
    expect(flow.audit.lines.find(line => line.sectionId === 'propertyPrice').color).toEqual(accent);
  });
  it('does not repeat the address/price band on any analytical page', () => {
    const { flow, composition } = setup('DEAL_INTELLIGENCE');
    composition.market(); composition.valuation(); composition.profile(); composition.verification(); composition.conclusion();
    expect(flow.audit.lines.filter(line => line.sectionId === 'propertyIdentity')).toEqual([]);
    expect(flow.audit.sections.find(section => section.sectionId === 'sales-comparablesMap').bounds.y).toBe(130);
  });
  it('redistributes width to publisher/property facts, tightens padding, and keeps long contacts whole', () => {
    const { flow, composition } = setup('DEAL_INTELLIGENCE');
    composition.overview();
    const card = id => flow.audit.sections.find(section => section.sectionId === id);
    expect(card('overviewFacts0').bounds.width).toBeGreaterThan(160);
    expect(card('overviewFacts1').bounds.width).toBeGreaterThan(150);
    expect(card('overviewFacts2').bounds.width).toBeLessThan(220);
    const phone = flow.audit.lines.find(line => line.sectionId === 'overviewFacts0' && line.text === '+15551234567890');
    expect(phone).toBeTruthy();
  });
});
