import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20260914090000_maxxis_report_unlock_ownership.sql', import.meta.url), 'utf8');
const planFallback = readFileSync(new URL('../../supabase/migrations/20260914100000_maxxis_report_plan_fallback.sql', import.meta.url), 'utf8');

describe('Maxxis report ownership migration contract', () => {
  it('binds ownership to user, property and capability with a unique entitlement', () => {
    expect(migration).toMatch(/unique \(user_id, property_id, capability\)/i);
    expect(migration).toContain('report_version');
    expect(migration).toContain('report_id uuid');
  });

  it('uses canonical Nuggets with server identity and serializes concurrent debits', () => {
    expect(migration).toContain('v_user_id uuid := auth.uid()');
    expect(migration).toMatch(/from public\.users u where u\.id = v_user_id for update/i);
    expect(migration).toContain('nuggets = nuggets - v_cost');
    expect(migration).toContain("v_capability = 'MAXXIS_ANALYSIS' then 3 else 5");
  });

  it('prevents repeat charges and allows only owner reads', () => {
    expect(migration).toMatch(/on conflict \(user_id, property_id, capability\) do nothing/i);
    expect(migration).toMatch(/already_owned boolean/i);
    expect(migration.match(/using \(user_id = auth\.uid\(\)\)/g)).toHaveLength(2);
    expect(migration).toMatch(/report ownership required/i);
    expect(migration).toContain('ds_save_maxxis_report_payload');
  });

  it('does not add Stripe or RentCast integration', () => {
    expect(migration).not.toMatch(/stripe|rentcast/i);
  });

  it('preserves users.plan_id when no active subscription row exists', () => {
    expect(planFallback).toMatch(/select lower\(coalesce\(u\.plan_id, 'free'\)\)/i);
    expect(planFallback).toContain("v_plan in ('pro', 'professional')");
    expect(planFallback).not.toMatch(/stripe|rentcast/i);
  });
});
