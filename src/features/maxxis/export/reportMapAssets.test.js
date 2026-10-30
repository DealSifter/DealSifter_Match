import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadReportMediaImage } from './reportMediaImage';
import { getPreparedReportMaps, prepareReportMaps, preparedReportMapCacheKey } from './reportMapAssets';
vi.mock('./reportMediaImage', () => ({ loadReportMediaImage: vi.fn() }));
vi.mock('./reportIntegrityViewModel', () => ({ buildStrictReportViewModel: () => ({
  property: { locationPoint: { latitude: 27.95, longitude: -82.45, marker: 'S' } },
  sections: [{ id: 'comparables', map: { points: [{ latitude: 27.95, longitude: -82.45, marker: 'S' }] } }],
}) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('report map preparation and PDF cache revisions', () => {
  it('retries failed maps on the same report and shares tiles across its sections', async () => {
    const context = Object.fromEntries(['fillRect', 'drawImage', 'save', 'restore', 'beginPath', 'arc', 'fill', 'stroke', 'fillText'].map(name => [name, vi.fn()]));
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/png;base64,bWFw' }) });
    const schema = {};
    loadReportMediaImage.mockResolvedValue(null);
    await prepareReportMaps(schema);
    expect(getPreparedReportMaps(schema)).toEqual({ comparables: null, location: null });
    const failedRevision = preparedReportMapCacheKey(schema), failedRequests = loadReportMediaImage.mock.calls.length;
    expect(failedRequests).toBeGreaterThan(0);
    loadReportMediaImage.mockResolvedValue({});
    await prepareReportMaps(schema);
    expect(getPreparedReportMaps(schema)).toEqual({ comparables: 'data:image/png;base64,bWFw', location: 'data:image/png;base64,bWFw' });
    expect(preparedReportMapCacheKey(schema)).not.toBe(failedRevision);
    expect(loadReportMediaImage).toHaveBeenCalledTimes(failedRequests * 2);
    await prepareReportMaps(schema);
    expect(loadReportMediaImage).toHaveBeenCalledTimes(failedRequests * 2);
  });
});
