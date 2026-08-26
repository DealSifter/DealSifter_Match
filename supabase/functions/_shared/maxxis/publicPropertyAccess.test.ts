import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../../migrations/20260814000001_maxxis_sanitized_property_access.sql', import.meta.url),
  'utf8',
);
const detailsSource = readFileSync(new URL('./propertyDetails.ts', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('./searchProperties.ts', import.meta.url), 'utf8');
const behaviorSource = readFileSync(new URL('./getUserPropertyBehavior.ts', import.meta.url), 'utf8');
const conversationSource = readFileSync(new URL('./providerConversationAnalysis.ts', import.meta.url), 'utf8');

describe('sanitized Maxxis Deal AI property access boundary', () => {
  it('defines narrow SECURITY DEFINER RPCs without weakening base-table RLS', () => {
    expect(migration).toMatch(/create or replace function public\.ds_get_public_property_details\(p_property_id uuid\)/i);
    expect(migration).toMatch(/create or replace function public\.ds_search_public_properties\(/i);
    expect(migration.match(/security definer/gi)).toHaveLength(2);
    expect(migration.match(/set search_path = pg_catalog, public/gi)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toMatch(/revoke all on function public\.ds_get_public_property_details\(uuid\) from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.ds_get_public_property_details\(uuid\) to authenticated, service_role/i);
    expect(migration).not.toMatch(/create policy .*properties.*select/i);
  });

  it('enforces the published, active, open and non-demo visibility contract', () => {
    expect(migration.match(/coalesce\(p\.is_active, true\) = true/gi)).toHaveLength(2);
    expect(migration.match(/coalesce\(p\.publish_to_showcase, true\) = true/gi)).toHaveLength(2);
    expect(migration.match(/coalesce\(p\.deal_closed, false\) = false/gi)).toHaveLength(2);
    expect(migration.match(/coalesce\(p\.source, ''\) <> 'demo_seed_mock'/gi)).toHaveLength(2);
  });

  it('keeps private structured fields outside both RPC return contracts', () => {
    const returns = migration.match(/returns table \([\s\S]*?\n\)/gi) || [];
    expect(returns).toHaveLength(2);
    returns.forEach((contract) => {
      expect(contract).not.toMatch(/owner_id|address|\blat\b|\blng\b|email|phone|whatsapp|profile_payload|unlock/i);
    });
    expect(migration).toMatch(/image_url !~\* '\/storage\/v1\/object\/sign\/'/i);
    expect(migration).toMatch(/token\|signature\|sig\|expires\|x-amz-\|x-goog-/i);
  });

  it('routes every affected Maxxis Deal AI property reader through sanitized RPCs', () => {
    expect(detailsSource).toContain("rpc('ds_get_public_property_details'");
    expect(searchSource).toContain("rpc('ds_search_public_properties'");
    expect(behaviorSource).toContain("rpc('ds_search_public_properties'");
    expect(conversationSource).toContain("rpc('ds_get_public_property_details'");
    [detailsSource, searchSource, behaviorSource, conversationSource]
      .forEach((source) => expect(source).not.toContain(".from('properties')"));
  });
});
