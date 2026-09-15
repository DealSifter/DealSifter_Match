import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql=readFileSync(new URL('../../supabase/migrations/20260914223000_maxxis_report_artifact_soft_delete.sql',import.meta.url),'utf8');
describe('Maxxis saved report artifact lifecycle',()=>{
  it('soft deletes only the owned artifact and never deletes commercial entitlement',()=>{
    expect(sql).toMatch(/deleted_at = now\(\)/i);
    expect(sql).toMatch(/id = p_report_id and user_id = v_user_id/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.maxxis_report_entitlements/i);
  });
  it('restores the artifact without another unlock or debit',()=>{
    expect(sql).toMatch(/on conflict[\s\S]*deleted_at=null/i);
    expect(sql).not.toMatch(/users\s+set\s+nuggets/i);
  });
});
