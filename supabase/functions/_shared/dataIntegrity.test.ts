import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../migrations/20260815000002_data_integrity_audit.sql', import.meta.url),
  'utf8',
);
const validationMigration = readFileSync(
  new URL('../../migrations/20260815000003_validate_data_integrity_constraints.sql', import.meta.url),
  'utf8',
);
const auditor = readFileSync(
  new URL('../../../scripts/audit-data-integrity.mjs', import.meta.url),
  'utf8',
);
const recoveryDrill = readFileSync(
  new URL('../../../scripts/recovery-drill.mjs', import.meta.url),
  'utf8',
);

describe('Phase 5D data integrity controls', () => {
  it('protects new financial and ownership writes without rewriting legacy rows', () => {
    expect(migration).toContain('users_nuggets_nonnegative_check');
    expect(migration).toContain('nugget_purchases_values_check');
    expect(migration).toContain('unlocks_values_check');
    expect(migration).toContain('property_unlocks_distinct_parties_check');
    expect(migration.match(/not valid/g)?.length).toBeGreaterThanOrEqual(10);
    expect(validationMigration.match(/validate constraint/g)?.length).toBe(15);
    expect(validationMigration).not.toMatch(/\b(update|delete|truncate|drop)\b/i);
  });

  it('defines an aggregate, stable and service-role-only audit RPC', () => {
    expect(migration).toContain('function public.ds_data_integrity_audit()');
    expect(migration).toMatch(/language sql\s+stable\s+security definer/i);
    expect(migration).toContain('grant execute on function public.ds_data_integrity_audit() to service_role');
    expect(migration).toContain('revoke all on function public.ds_data_integrity_audit() from public, anon, authenticated');
    expect(migration).not.toMatch(/select\s+.*email|select\s+.*phone|select\s+.*address/i);
  });

  it('blocks production by default and emits only aggregate findings', () => {
    expect(auditor).toContain("new Set(['cyeipfskwwisbbayyaca'])");
    expect(auditor).toContain("DATA_INTEGRITY_ALLOW_PRODUCTION !== 'I_UNDERSTAND_READ_ONLY'");
    expect(auditor).toContain('row.issue_count');
    expect(auditor).not.toContain('row_data');
  });

  it('limits recovery mutations to namespaced staging fixtures and always cleans up', () => {
    expect(recoveryDrill).toContain("new Set(['cyeipfskwwisbbayyaca'])");
    expect(recoveryDrill).toContain("confirmation !== 'staging-fixtures-only'");
    expect(recoveryDrill).toContain('finally');
    expect(recoveryDrill).toContain('await cleanup()');
    expect(recoveryDrill).not.toMatch(/STRIPE|nuggets_spent|chat_messages/i);
  });
});
