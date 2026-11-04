import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { pngDimensions, ReportPdfImages } from './reportPdfImages';

const original = 'data:image/png;base64,' + readFileSync(new URL('../../../assets/maxxis/report-official-logo.png', import.meta.url)).toString('base64');
describe('PDF raster work is bounded and reused', () => {
  it('reads the original brand dimensions without decompressing its pixels', () => {
    expect(pngDimensions(original)).toEqual({ width: 4791, height: 1193, fileType: 'PNG' });
    expect(pngDimensions('data:image/png;base64,aGVsbG8=')).toBeNull();
    expect(pngDimensions('https://images.example.invalid/a.png')).toBeNull();
  });
  it('avoids duplicate PNG processing and embeds losslessly with FAST compression', () => {
    const doc = { getImageProperties: vi.fn(), addImage: vi.fn() };
    const images = new ReportPdfImages(doc as any);
    images.add(original, 10, 20, 145, 36, 'official-dealsifter-logo');
    images.add(original, 10, 20, 145, 36, 'official-dealsifter-logo');
    expect(doc.getImageProperties).not.toHaveBeenCalled();
    expect(doc.addImage.mock.calls.every(call => call[6] === 'official-dealsifter-logo' && call[7] === 'FAST')).toBe(true);
  });
  it('reads JPEG dimensions once and uses the same per-document alias for repeated photos', () => {
    const doc = { getImageProperties: vi.fn(() => ({ width: 1200, height: 800, fileType: 'JPEG' })), addImage: vi.fn() };
    const images = new ReportPdfImages(doc as any);
    for (let page = 0; page < 6; page++) images.add('data:image/jpeg;base64,fixture', 0, 0, 90, 60);
    expect(doc.getImageProperties).toHaveBeenCalledOnce();
    expect(new Set(doc.addImage.mock.calls.map(call => call[6])).size).toBe(1);
  });
});
