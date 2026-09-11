import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../migrations/20260910120000_property_intelligence_entitlements.sql', import.meta.url), 'utf8');

describe('Property Intelligence entitlement foundation', () => {
  it('is distinct from existing contact/property unlock semantics and is idempotent', () => {
    expect(migration).toContain('property_intelligence_entitlements');
    expect(migration).toContain('property_intelligence_entitlements_unique');
    expect(migration).not.toContain('property_unlocks');
    expect(migration).not.toContain('ds_purchase_property_unlock');
  });

  it('keeps grants server-authoritative and exposes only the boolean authenticated check', () => {
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on public\.property_intelligence_entitlements from public, anon, authenticated/i);
    expect(migration).toMatch(/grant select, insert on public\.property_intelligence_entitlements to service_role/i);
    expect(migration).toMatch(/auth\.uid\(\)/i);
    expect(migration).toMatch(/grant execute[\s\S]*to authenticated, service_role/i);
    expect(migration).not.toMatch(/grant (insert|update|delete)[\s\S]*to authenticated/i);
  });

  it('contains no Nuggets, Stripe, payment, or destructive database operation', () => {
    expect(migration).not.toMatch(/nugget|stripe|payment|wallet|refund/i);
    expect(migration).not.toMatch(/\b(drop|truncate)\b|\bdelete\s+from\b/i);
  });
});
