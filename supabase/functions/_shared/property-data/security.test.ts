import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  './types.ts', './address.ts', './backendFactory.ts', './cache.ts', './conflicts.ts', './fixtures.ts',
  './manualValidation.ts', './normalizedRecordSchema.ts', './propertyEvidenceService.ts', './propertyRepository.ts', './providers.ts', './usageGuard.ts',
  './rentcast/rentcastClient.ts', './rentcast/rentcastTypes.ts', './rentcast/rentcastMapper.ts',
];

describe('Property Intelligence security contracts', () => {
  it('keeps RentCast integration backend-only and never reads a VITE key', () => {
    const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
    expect(source).toContain("getEnv('RENTCAST_API_KEY')");
    expect(source).not.toContain('VITE_RENTCAST');
    expect(source).not.toContain('import.meta.env');
    expect(source).not.toContain('AI_INFERRED_VALUE');
  });

  it('keeps the persistent cache backend-only and normalizes writes through service-role RPCs', () => {
    const migration = readFileSync(new URL('../../../migrations/20260909190000_property_intelligence_cache.sql', import.meta.url), 'utf8');
    expect(migration).toMatch(/alter table public\.property_intelligence_cache enable row level security/i);
    expect(migration).toMatch(/revoke all on public\.property_intelligence_cache from anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.ds_get_property_intelligence_cache[\s\S]*to service_role/i);
    expect(migration).toMatch(/grant execute on function public\.ds_upsert_property_intelligence_cache[\s\S]*to service_role/i);
    expect(migration).toMatch(/unique \(property_id, provider, data_type\)/i);
    expect(migration).not.toMatch(/api_key|request_headers|raw_response/i);
  });

  it('contains no automatic entrypoint, live invocation or UI/Maxxis integration', () => {
    const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
    expect(source).not.toContain('Deno.serve');
    expect(source).not.toContain('MaxxisAssistant');
    expect(source).not.toContain("from '../../../src");
  });

  it('keeps API keys, headers, raw responses and addresses out of the usage ledger migration', () => {
    const migration = readFileSync(new URL('../../../migrations/20260909183000_external_provider_usage_guard.sql', import.meta.url), 'utf8');
    expect(migration).not.toMatch(/api_key|x-api-key|raw_response|formatted_address|street|owner_name/i);
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('p_hard_limit > 45');
    expect(migration).toContain('pg_advisory_xact_lock');
  });
});
