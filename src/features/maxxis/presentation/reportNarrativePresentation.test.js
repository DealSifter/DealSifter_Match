import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ translate: vi.fn(), photos: vi.fn(), maps: vi.fn() }));
vi.mock('../../../services/chatTranslation', () => ({ localizePresentationText: mocks.translate, getCachedPresentationText: () => null }));
vi.mock('../export/reportPreparedAssets.ts', () => ({ prepareReportAssets: mocks.photos, preparedReportAssetsCacheKey: () => 'photos' }));
vi.mock('../export/reportMapAssets', () => ({ prepareReportMaps: mocks.maps, preparedReportMapCacheKey: () => 'maps' }));
import { prepareReportNarrativePresentation, reportNarrativeProjection } from './reportNarrativePresentation';
const schema = Object.freeze({ sections: { propertySummary: { data: { id: 'owned-property', description: 'Original property description.' } } } });
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe('bounded report presentation preparation', () => {
  it('returns the inline analysis when translation never responds, without acquiring media', async () => {
    vi.useFakeTimers(); mocks.translate.mockReturnValue(new Promise(() => {}));
    let ready = false;
    const pending = prepareReportNarrativePresentation(schema, 'pt', { media: false, timeoutMs: 1500 }).then(() => { ready = true; });
    await vi.advanceTimersByTimeAsync(1499); expect(ready).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await pending; expect(ready).toBe(true);
    expect(mocks.photos).not.toHaveBeenCalled(); expect(mocks.maps).not.toHaveBeenCalled();
    expect(reportNarrativeProjection(schema, 'pt').description.localized).toBe('Original property description.');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('still prepares export images/maps, but bounds an indefinitely stalled preparation', async () => {
    vi.useFakeTimers(); mocks.translate.mockResolvedValue(null);
    mocks.photos.mockReturnValue(new Promise(() => {})); mocks.maps.mockReturnValue(new Promise(() => {}));
    const pending = prepareReportNarrativePresentation(schema, 'pt');
    await vi.advanceTimersByTimeAsync(30000); await pending;
    expect(mocks.photos).toHaveBeenCalledOnce(); expect(mocks.maps).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not release a PDF after five seconds while images and maps are still loading', async () => {
    vi.useFakeTimers(); mocks.translate.mockResolvedValue(null);
    let photosReady, mapsReady, done = false;
    mocks.photos.mockReturnValue(new Promise(resolve => { photosReady = resolve; }));
    mocks.maps.mockReturnValue(new Promise(resolve => { mapsReady = resolve; }));
    const preparation = prepareReportNarrativePresentation(schema, 'en').then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(7000); expect(done).toBe(false);
    photosReady(['photo']); await Promise.resolve(); expect(done).toBe(false);
    mapsReady({ location: 'map' }); await preparation; expect(done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not wait for the deadline when assets and translation complete normally', async () => {
    vi.useFakeTimers(); mocks.translate.mockResolvedValue(null); mocks.photos.mockResolvedValue([]); mocks.maps.mockResolvedValue({});
    await prepareReportNarrativePresentation(schema, 'pt'); expect(vi.getTimerCount()).toBe(0);
  });
  it('still waits for photos when map preparation fails independently', async () => {
    mocks.translate.mockResolvedValue(null); mocks.maps.mockRejectedValue(new Error('MAP_FAILED'));
    let finishPhotos, done = false;
    mocks.photos.mockReturnValue(new Promise(resolve => { finishPhotos = resolve; }));
    const preparation = prepareReportNarrativePresentation(schema, 'en').then(() => { done = true; });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(done).toBe(false);
    finishPhotos(['photo']); await preparation; expect(done).toBe(true);
  });
});
