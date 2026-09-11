import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const feed = read('migrations/20260812000001_harden_global_feed_privacy.sql');
const publicAccess = read('migrations/20260814000001_maxxis_sanitized_property_access.sql');
const portfolio = read('migrations/20260729000001_profile_scoped_unlock_entitlements.sql');

describe('private fixture: listing contracts (source verification, not a production browser test)', () => {
  it('FEED / MAPVIEW inventory excludes unpublished properties', () => {
    expect(feed).toMatch(/coalesce\(p\.publish_to_showcase, true\)/);
    expect(feed).toMatch(/drop policy if exists properties_select_showcase/);
  });
  it('MAXXIS SEARCH and public detail both exclude unpublished properties', () => {
    expect(publicAccess.match(/coalesce\(p\.publish_to_showcase, true\) = true/g)).toHaveLength(2);
    expect(read('migrations/20260909162500_exclude_own_properties_from_maxxis_search.sql')).toContain('coalesce(p.publish_to_showcase, true) = true');
  });
  it('GENERAL LISTINGS: base table RLS is owner scoped; public policy removed', () => {
    expect(read('migrations/20260409181738_init_mvp_auth_profiles_properties.sql')).toContain('properties_select_own on public.properties for select using (owner_id = auth.uid())');
    expect(feed).toContain('drop policy if exists properties_select_showcase');
    const app = readFileSync(new URL('../../../../src/App.jsx', import.meta.url), 'utf8');
    const selects = [...app.matchAll(/\.from\('properties'\)\s*\.select\([^]*?(?=;)/g)];
    expect(selects.length).toBeGreaterThan(0);
    for (const [query] of selects) expect(query).toContain(".eq('owner_id', supabaseUserId)");
  });
  it('OTHER USER PORTFOLIO excludes unpublished properties in preview and portfolio', () => {
    expect(portfolio.match(/and coalesce\(p\.publish_to_showcase, true\) and coalesce\(p\.is_active, true\)/g)).toHaveLength(2);
  });
  it('private fixture cannot accidentally be published after local migration', () => {
    const sql = read('migrations/20260910181000_property_intelligence_fixture_privacy.sql');
    expect(sql).toContain('07343e87-1ef8-4ca5-a88e-be49d95431a7');
    expect(sql).toMatch(/publish_to_showcase is false/i);
  });
});
