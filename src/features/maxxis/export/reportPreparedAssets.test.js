import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPreparedReportPhotos, prepareReportAssets, preparedReportAssetsCacheKey } from './reportPreparedAssets';

const raster = 'data:image/png;base64,aGVsbG8=';
const schema = images => ({ sections: { propertySummary: { available: true, data: { images } } } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('report media preparation outside the renderer', () => {
  it('is a pure cache read before explicit preparation and preserves inline raster images', () => {
    const input = schema([raster, 'https://images.example.com/home.jpg']);
    expect(getPreparedReportPhotos(input)).toEqual([raster]);
    expect(preparedReportAssetsCacheKey(input)).toBe('0');
  });
  it('does not expose unavailable or unauthorized schema media', async () => {
    const input = { sections: { propertySummary: { available: false, data: { images: [raster] } } } };
    expect(await prepareReportAssets(input)).toEqual([]);
    expect(getPreparedReportPhotos(input)).toEqual([]);
  });
  it('rejects local, private, credentialed and non-HTTPS URLs without starting an image transport', async () => {
    const Image = vi.fn(); vi.stubGlobal('Image', Image);
    vi.stubGlobal('document', { createElement: vi.fn() });
    const input = schema(['http://images.example.com/a.jpg', 'https://127.0.0.1/a', 'https://10.0.0.1/a', 'https://a:b@images.example.com/a', 'https://files.internal/a']);
    expect(await prepareReportAssets(input)).toEqual([]);
    expect(Image).not.toHaveBeenCalled();
  });
  it('single-flights explicit preparation, bounds media to five and caches safe drawing primitives', async () => {
    let requests = 0;
    class Image {
      naturalWidth = 2000; naturalHeight = 1000;
      set src(value) { if (!value) return; requests++; queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', Image);
    const context = { drawImage: vi.fn() };
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context, toDataURL: () => raster }) });
    const input = schema(Array.from({ length: 7 }, (_, index) => `https://images.example.com/prepared-${index}.jpg`));
    const first = prepareReportAssets(input), second = prepareReportAssets(input);
    expect(second).toBe(first);
    expect(await first).toHaveLength(5);
    expect(requests).toBe(5);
    expect(getPreparedReportPhotos(input)).toEqual(Array(5).fill(raster));
    expect(preparedReportAssetsCacheKey(input)).not.toBe('0');
    await prepareReportAssets(input);
    expect(requests).toBe(5);
  });
  it('cancels a slow image within the preparation deadline and never blocks PDF drawing', async () => {
    vi.useFakeTimers();
    const requested = [];
    class Image { set src(value) { requested.push(value); } }
    vi.stubGlobal('Image', Image); vi.stubGlobal('document', { createElement: vi.fn() });
    const input = schema(['https://images.example.com/timeout.jpg']);
    const result = prepareReportAssets(input);
    await vi.advanceTimersByTimeAsync(24000);
    expect(await result).toEqual([]);
    expect(requested).toEqual(['https://images.example.com/timeout.jpg', '', 'https://images.example.com/timeout.jpg', '']);
  });
  it('waits for slow photos and recovers a failed preparation on the same schema', async () => {
    vi.useFakeTimers(); let available = false;
    class Image {
      naturalWidth = 1200; naturalHeight = 800;
      set src(value) { if (!value) return; setTimeout(() => available ? this.onload?.() : this.onerror?.(), 7000); }
    }
    vi.stubGlobal('Image', Image);
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }), toDataURL: () => raster }) });
    const input = schema(['https://images.example.com/recover-after-failure.jpg']);
    const failed = prepareReportAssets(input); await vi.advanceTimersByTimeAsync(14000);
    expect(await failed).toEqual([]);
    const failedKey = preparedReportAssetsCacheKey(input);
    available = true;
    const recovered = prepareReportAssets(input); await vi.advanceTimersByTimeAsync(7000);
    expect(await recovered).toEqual([raster]);
    expect(getPreparedReportPhotos(input)).toEqual([raster]);
    expect(preparedReportAssetsCacheKey(input)).not.toBe(failedKey);
    expect(vi.getTimerCount()).toBe(0);
  });
});
