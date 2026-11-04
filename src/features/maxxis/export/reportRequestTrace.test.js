import { describe, expect, it, vi } from 'vitest';
import { createReportRequestTrace } from './reportRequestTrace';

describe('real report trace IDs across supported browsers', () => {
  it('uses the native UUID implementation when present', () => {
    const cryptoApi = { randomUUID: vi.fn().mockReturnValueOnce('00000000-0000-4000-8000-000000000001').mockReturnValueOnce('00000000-0000-4000-8000-000000000002') };
    const trace = createReportRequestTrace(cryptoApi);
    expect(trace.reportId).not.toBe(trace.requestId);
    expect(cryptoApi.randomUUID).toHaveBeenCalledTimes(2);
  });
  it('uses cryptographic random bytes if randomUUID is absent', () => {
    let calls = 0;
    const cryptoApi = { getRandomValues: vi.fn(bytes => bytes.fill(++calls)) };
    const trace = createReportRequestTrace(cryptoApi);
    for (const id of Object.values(trace)) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(trace.reportId).not.toBe(trace.requestId);
    expect(cryptoApi.getRandomValues).toHaveBeenCalledTimes(2);
  });
  it('rejects a browser without a cryptographic source explicitly', () => {
    expect(() => createReportRequestTrace({})).toThrow('REPORT_TRACE_UNAVAILABLE');
  });
});
