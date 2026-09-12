import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../../../migrations/20260912093000_closed_sale_evidence_cache_usage.sql', import.meta.url), 'utf8');

describe('closed-sale evidence migration', () => {
  it('adds only the sold pool cache/usage operation and preserves the global limit', () => {
    expect(migration).toMatch(/'property_sold_record_pool'/);
    expect(migration).toMatch(/'property_sold_search'/);
    expect(migration).toMatch(/p_hard_limit < 1 or p_hard_limit > 45/);
    expect(migration).toMatch(/grant execute[\s\S]*to service_role/i);
  });
});
