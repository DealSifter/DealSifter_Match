import { afterEach, describe, expect, it, vi } from 'vitest';
import { boundedJson, normalizeParcel } from './arcgis.ts';
import { ParcelRequestCache } from './cache.ts';
import { PARCEL_SOURCES, ParcelSourceRegistry } from './registry.ts';
import { PublicParcelResolver } from './resolver.ts';
import { parcelTelemetryObserver, type ParcelRequestTelemetry } from './telemetry.ts';
import type { ParcelSource, ProviderResult } from './types.ts';

afterEach(() => vi.useRealTimers());

describe('Production GIS behavior combined with report telemetry', () => {
  it('keeps adapters county-bound when the same authority serves repeated local APNs', async () => {
    const source = PARCEL_SOURCES.find(row => row.sourceId === 'us-ar-agiso-state-parcels')!;
    const counties = [...new Set([source.countyFips, ...source.coverageCountyFips || []])].slice(0, 2);
    expect(counties).toHaveLength(2);
    let now = Date.parse('2026-11-02T00:00:00Z');
    const telemetry: ParcelRequestTelemetry = { provider: 'arcgis', service: 'https://fixtures.invalid/query',
      httpStatus: 200, latencyMs: 1, requestedAt: new Date(now).toISOString(), outcome: 'SUCCESS', reportId: 'fixture-report' };
    const factory = vi.fn((scoped: ParcelSource) => ({
      queryByAPN: vi.fn(async (): Promise<ProviderResult> => ({ parcels: [normalizeParcel(scoped,
        { [scoped.fieldMapping.apn!]: 'UNIT-APN' }, null, new Date(now).toISOString(), null)], exceededLimit: false, telemetry: [telemetry] })),
      queryByPoint: vi.fn(), queryByBounds: vi.fn(), getCoverage: () => scoped,
    }));
    const resolver = new PublicParcelResolver({ registry: new ParcelSourceRegistry([source]), providerFactory: factory,
      resolveCounty: vi.fn(), cache: new ParcelRequestCache(() => now) });
    for (const countyFips of counties) {
      const result = await resolver.resolve({ operation: 'query-apn', countyFips, apn: 'UNIT-APN' });
      expect(result.status).toBe('COVERAGE_AVAILABLE');
      expect(result.telemetry).toContainEqual(telemetry);
      now += 2000;
    }
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory.mock.calls.map(([scoped]) => scoped.queryCountyFips)).toEqual(counties);
  });

  it('retains Retry-After while reporting the real HTTP status and stripping query data', async () => {
    const events: ParcelRequestTelemetry[] = [];
    const fetcher = vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '7' } }));
    await expect(boundedJson('https://fixtures.invalid/query?apn=UNIT-APN', fetcher, undefined, 1000,
      parcelTelemetryObserver(events, { reportId: 'fixture-report', requestId: 'fixture-request', origin: 'validation' })))
      .rejects.toMatchObject({ message: 'GIS_HTTP_429', retryAfterMs: 7000 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ httpStatus: 429, outcome: 'HTTP_ERROR', service: 'https://fixtures.invalid/query',
      reportId: 'fixture-report', requestId: 'fixture-request', origin: 'validation' });
  });

  it('preserves the timeout reason without dropping the failed-attempt telemetry', async () => {
    vi.useFakeTimers();
    const events: ParcelRequestTelemetry[] = [];
    const fetcher = vi.fn((_url: Parameters<typeof fetch>[0], options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    const pending = boundedJson('https://fixtures.invalid/query', fetcher, undefined, 20, entry => events.push(entry));
    const assertion = expect(pending).rejects.toThrow('GIS_TIMEOUT');
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ httpStatus: null, outcome: 'TRANSPORT_ERROR' });
  });
});
