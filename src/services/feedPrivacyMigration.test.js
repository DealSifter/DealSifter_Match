import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../supabase/migrations/20260812000001_harden_global_feed_privacy.sql',
  import.meta.url,
);
const sql = readFileSync(migrationUrl, 'utf8');

describe('global feed privacy migration contract', () => {
  it('removes locked account fields from the global inventory DTO', () => {
    expect(sql).not.toMatch(/\bu\.email\b/i);
    expect(sql).not.toMatch(/\bu\.phone\b/i);
    expect(sql).not.toMatch(/\bu\.is_admin\b/i);
    expect(sql).toMatch(/ds_sanitize_public_feed_jsonb\(coalesce\(pp\.profile_payload/i);
  });

  it('suppresses exact property location when address privacy is enabled', () => {
    expect(sql).toMatch(/case when p\.hide_street_address_on_card then null else p\.address end as address/i);
    expect(sql).toMatch(/case when p\.hide_street_address_on_card then null else p\.lat end as lat/i);
    expect(sql).toMatch(/case when p\.hide_street_address_on_card then null else p\.lng end as lng/i);
    expect(sql).toMatch(/null::text as geocode_input/i);
  });

  it('closes direct showcase policies on sensitive base tables', () => {
    expect(sql).toMatch(/drop policy if exists properties_select_showcase on public\.properties/i);
    expect(sql).toMatch(/drop policy if exists users_select_showcase on public\.users/i);
    expect(sql).toMatch(/drop policy if exists professional_profile_select_showcase on public\.professional_profiles/i);
    expect(sql).toMatch(/revoke all on function public\.ds_get_global_feed_inventory\(\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.ds_get_global_feed_inventory\(\) to authenticated, service_role/i);
  });
});
