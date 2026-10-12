import { describe, expect, it, vi } from 'vitest';
import { ParcelRequestCache } from './cache.ts';
import { PARCEL_SOURCES, ParcelSourceRegistry, activationBlockers, productionSourceAllowed } from './registry.ts';
import { normalizeParcel } from './arcgis.ts';
import { PublicParcelResolver } from './resolver.ts';
import { resolveFeatureFlags } from '../featureFlags.ts';

const source = () => PARCEL_SOURCES.find(source => source.sourceId === 'us-ma-massgis-parcels')!;
const active = () => ({ ...source(), status: 'ACTIVE' as const, lastValidatedAt: '2026-10-12', validation: {
  authorityVerified: true, schemaValidated: true, geometryQueryValidated: true, apnQueryValidated: true, viewportQueryValidated: true,
  counties: ['25017', '25025'], evidencePath: 'UNIT_FIXTURE',
} });

describe('Phase 1B activation contract', () => {
  it('requires independently reviewed legal and technical evidence before ACTIVE is effective', () => {
    expect(productionSourceAllowed(active())).toBe(true);
    expect(productionSourceAllowed({ ...active(), validation: undefined })).toBe(false);
    expect(activationBlockers({ ...active(), validation: undefined })).toContain('AUTHORITY_NOT_VERIFIED');
  });
  it.each(['DISCOVERED', 'SCHEMA_VALIDATED', 'AUTHORITY_VALIDATED', 'LICENSE_REVIEW_REQUIRED', 'DISABLED', 'BROKEN'] as const)('does not run %s sources even with cleared licenses', status => {
    expect(productionSourceAllowed({ ...active(), status })).toBe(false);
  });
  it.each(['UNKNOWN', 'UNVERIFIED', 'LICENSE_REVIEW_REQUIRED'] as const)('does not run ACTIVE source with %s license', licenseStatus => {
    expect(productionSourceAllowed({ ...active(), licenseStatus })).toBe(false);
  });
  it('does not extrapolate validated counties to a whole state', () => {
    expect(productionSourceAllowed({ ...active(), coverageCountyFips: ['25017', '25025', '25021'] })).toBe(false);
    expect(new ParcelSourceRegistry([active()]).forCounty('25021')).toEqual([]);
  });
  it('supports one state service for multiple inspected counties and multiple sources per county', () => {
    const secondary = { ...active(), sourceId: 'SECONDARY_TEST', role: 'SECONDARY_PARCEL' as const };
    const registry = new ParcelSourceRegistry([active(), secondary]);
    expect(registry.forCounty('25017')).toHaveLength(2); expect(registry.forCounty('25025')).toHaveLength(2);
  });
  it('keeps tax/assessment/zoning-only roles out of parcel polygon runtime', async () => {
    const factory = vi.fn();
    const registry = new ParcelSourceRegistry([{ ...active(), role: 'TAX' }]);
    const result = await new PublicParcelResolver({ registry, providerFactory: factory }).resolve({ operation: 'coverage', countyFips: '25017' });
    expect(result.status).toBe('NO_ACTIVE_PUBLIC_SOURCE'); expect(factory).not.toHaveBeenCalled();
  });
  it('all configured ACTIVE sources have county-level evidence, explainable status and licenses', () => {
    for (const configured of PARCEL_SOURCES) {
      expect(configured.statusReason).not.toBe(''); expect(configured.licenseReason).not.toBe('');
      if (configured.status === 'ACTIVE') expect(activationBlockers(configured)).toEqual([]);
    }
  });
});

describe('internal-only reuse of existing feature flag framework', () => {
  const config = { public_parcel_intelligence: { enabled: true, environments: ['production', 'development'], percentage: 100, internalUserIds: ['internal-validator'] } };
  it('enables explicitly allowlisted validators', () => expect(resolveFeatureFlags({ userId: 'internal-validator', environment: 'production', remoteConfig: config }).public_parcel_intelligence).toBe(true));
  it('keeps general users OFF even with a 100 percent rollout', () => expect(resolveFeatureFlags({ userId: 'general-user', environment: 'production', remoteConfig: config }).public_parcel_intelligence).toBe(false));
  it('keeps default OFF including the internal identity', () => expect(resolveFeatureFlags({ userId: 'internal-validator', environment: 'production' }).public_parcel_intelligence).toBe(false));
  it('neither admin nor development overrides bypass the allowlist', () => {
    for (const environment of ['production', 'development'] as const) expect(resolveFeatureFlags({ userId: 'general-user', environment, remoteConfig: config,
      allowOverride: true, overrides: { public_parcel_intelligence: true } }).public_parcel_intelligence).toBe(false);
  });
  it('malformed allowlists fail closed', () => expect(resolveFeatureFlags({ userId: 'general-user', environment: 'production', remoteConfig: {
    public_parcel_intelligence: { ...config.public_parcel_intelligence, internalUserIds: 'general-user' },
  } }).public_parcel_intelligence).toBe(false));
});

describe('source-specialized field normalization', () => {
  it.each([['AC', .25, .25, 10890], ['SF', 10890, null, 10890], ['UNKNOWN', 10890, null, null]] as const)('handles source area unit %s without inventing acres', (unit, value, expectedAcres, expectedSqft) => {
    const parcel = normalizeParcel(source(), { LOT_SIZE: value, LOT_UNITS: unit }, null, '2026-10-12', null);
    expect(parcel.assessorAcres).toBe(expectedAcres); expect(parcel.lotSqft).toBe(expectedSqft);
    if (unit === 'SF') expect(parcel.provenance.lotSqft.sourceField).toBe('LOT_SIZE');
  });
  it('does not request NJ owner identity or fabricate the prior-year tax year', () => {
    const nj = PARCEL_SOURCES.find(source => source.sourceId === 'us-nj-njogis-parcels')!;
    const parcel = normalizeParcel(nj, { OWNER_NAME: 'IGNORED', LAST_YR_TX: 1000 }, null, '2026-10-12', null);
    expect(nj.fieldMapping.ownerName).toBeUndefined(); expect(parcel.ownerName).toBeNull();
    expect(parcel.propertyTax).toBe(1000); expect(parcel.propertyTaxYear).toBeNull();
  });
  it('does not treat Florida just value or different assessed bases as a total assessment', () => {
    const fl = PARCEL_SOURCES.find(source => source.sourceId === 'us-fl-fgio-state-parcels')!;
    const parcel = normalizeParcel(fl, { JV: 100000, AV_SD: 90000, AV_NSD: 80000, TAX_AUTH_C: 'TAX01' }, null, '2026-10-12', null);
    expect(parcel.assessedValue).toBeNull(); expect(parcel.propertyTax).toBeNull();
  });
});

describe('healthy government courtesy scheduling', () => {
  it('spaces distinct viewport keys without mislabeling a healthy source as unavailable', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    try {
      const cache = new ParcelRequestCache(); const stamps: number[] = [];
      const work = async () => { stamps.push(Date.now()); return 'REAL_ADAPTER_SEAM'; };
      await cache.run('first', 'authority', work);
      const second = cache.run('second', 'authority', work);
      expect(stamps).toEqual([0]); await vi.advanceTimersByTimeAsync(1500); await second;
      expect(stamps).toEqual([0, 1500]); expect(cache.health.get('authority')?.consecutiveFailures).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('reserves distinct slots and rejects an unbounded queue before invoking GIS', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    try {
      const cache = new ParcelRequestCache(); const work = vi.fn(async () => 'parcel');
      const first = cache.run('a', 'authority', work); const second = cache.run('b', 'authority', work); const third = cache.run('c', 'authority', work);
      await expect(cache.run('d', 'authority', work)).rejects.toThrow('SOURCE_COURTESY_BACKOFF');
      await vi.advanceTimersByTimeAsync(3000); await Promise.all([first, second, third]); expect(work).toHaveBeenCalledTimes(3);
    } finally { vi.useRealTimers(); }
  });
  it('does not invoke queued work or increment failure counts when a prior query opens backoff', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    try {
      const cache = new ParcelRequestCache(); const work = vi.fn(async () => 'parcel');
      await cache.run('first', 'authority', work);
      const queued = cache.run('next', 'authority', work); const rejected = expect(queued).rejects.toThrow('SOURCE_COURTESY_BACKOFF');
      const health = cache.health.get('authority')!; cache.health.set('authority', { ...health, status: 'BACKOFF', consecutiveFailures: 1, nextAllowedAt: 10000 });
      await vi.advanceTimersByTimeAsync(1500); await rejected; expect(work).toHaveBeenCalledOnce(); expect(cache.health.get('authority')?.consecutiveFailures).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});
