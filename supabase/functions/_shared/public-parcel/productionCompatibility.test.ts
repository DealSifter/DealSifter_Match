import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PARCEL_APPROVED_ORIGINS, PARCEL_SOURCES, ParcelSourceRegistry, activationBlockers, productionSourceAllowed } from './registry.ts';

const baseline = JSON.parse(readFileSync(new URL('./productionRegistry.baseline.json', import.meta.url), 'utf8'));
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable((value as Record<string, unknown>)[key])])) : value;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

describe('compatibility with the deployed parcel registry', () => {
  it('preserves all registered sources, states and approved upstream origins', () => {
    expect(PARCEL_SOURCES).toHaveLength(baseline.sourceCount);
    expect(new Set(PARCEL_SOURCES.map(source => source.sourceId)).size).toBe(baseline.sourceCount);
    expect([...new Set(PARCEL_SOURCES.map(source => source.state))].sort()).toEqual(baseline.states);
    expect([...PARCEL_APPROVED_ORIGINS].sort()).toEqual(baseline.origins);
  });

  it.each(baseline.sources)('retains mapping, permissions and activation checks for $sourceId', expected => {
    const source = PARCEL_SOURCES.find(item => item.sourceId === expected.sourceId);
    expect(source).toBeDefined();
    expect(digest(source)).toBe(expected.sha256);
    expect(productionSourceAllowed(source!)).toBe(expected.productionAllowed);
    expect(activationBlockers(source!)).toEqual(expected.activationBlockers);
  });

  it.each(baseline.countySelections)('keeps county selection and APN query boundaries for $countyFips', expected => {
    const actual = new ParcelSourceRegistry().forCounty(expected.countyFips).map(source => ({
      sourceId: source.sourceId, queryCountyFips: source.queryCountyFips ?? null, countyQuery: source.countyQuery ?? null,
    }));
    expect(actual).toEqual(expected.selections);
  });
});
