import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../migrations/20260912090000_valuation_evidence_cache_usage.sql', import.meta.url),
  'utf8',
);

describe('valuation evidence database migration', () => {
  it('adds only the AVM cache/usage types and preserves the 45-call guard', () => {
    expect(migration).toMatch(/data_type in \('property_record', 'property_value_avm'\)/);
    expect(migration).toMatch(/operation in \('property_lookup', 'property_value_avm'\)/);
    expect(migration).toMatch(/p_hard_limit < 1 or p_hard_limit > 45/);
  });

  it('keeps both cache writers backend-only, including the fingerprint-bound wrapper', () => {
    expect(migration).toMatch(/revoke all on function public\.ds_upsert_property_intelligence_cache\(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz, text\) from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.ds_upsert_property_intelligence_cache\(uuid, text, text, text, smallint, jsonb, timestamptz, timestamptz, text\) to service_role/i);
  });
});
