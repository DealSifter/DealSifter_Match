import { describe, it, expect, vi } from 'vitest';
import { propertyEvidenceLeaseKey, SupabasePropertySingleFlight } from './singleFlight.ts';
const id = '11111111-1111-4111-8111-111111111111';
const constraint = /^[0-9a-f-]{36}$/;
describe('UUID-only Production lease contract (offline)', () => {
  it('preserves UUID keys used by record, AVM and supplemental listing/market acquisitions', async () => {
    expect(await propertyEvidenceLeaseKey(id)).toBe(id);
  });
  it('all composite producers and the provider rate gate satisfy the Production constraint', async () => {
    for (const key of [`sold:${id}:fixture-fingerprint`, `market-rent:${id}:fixture-fingerprint`, 'rentcast:market-rent-rate-gate', id]) {
      const rpc = vi.fn(async (_name: string, args: Record<string, unknown>) => {
        expect(String(args.p_key)).toMatch(constraint);
        return { data: true, error: null };
      });
      await new SupabasePropertySingleFlight({ rpc }).run(key, async () => 'ok');
      expect(rpc.mock.calls[0][1].p_key).toBe(rpc.mock.calls[1][1].p_key);
    }
  });
  it('is deterministic, separates namespaces and fingerprints, and sets UUID v5 bits', async () => {
    const inputs = Array.from({ length: 100 }, (_, n) => `sold:${id}:${n}`);
    inputs.push(`market-rent:${id}:0`);
    const keys = await Promise.all(inputs.map(propertyEvidenceLeaseKey));
    expect(new Set(keys).size).toBe(inputs.length);
    expect(keys[0]).toBe(await propertyEvidenceLeaseKey(inputs[0]));
    expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await expect(propertyEvidenceLeaseKey('')).rejects.toThrow('IDENTITY_REQUIRED');
  });
  it('independent concurrent callers share one active database lease and one cache fill', async () => {
    const active = new Map<string, unknown>(); let fills = 0; let cached: string | null = null; let peak = 0;
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      const key = String(args.p_key); expect(key).toMatch(constraint);
      if (name === 'ds_acquire_property_evidence_lease') {
        if (active.has(key)) return { data: false, error: null };
        active.set(key, args.p_token); peak = Math.max(peak, active.size);
        return { data: true, error: null };
      }
      expect(active.get(key)).toBe(args.p_token); active.delete(key);
      return { data: null, error: null };
    });
    const work = async () => { if (cached) return cached; fills++; await new Promise(r => setTimeout(r, 15)); return cached = 'evidence'; };
    const results = await Promise.all([0, 1].map(() => new SupabasePropertySingleFlight({ rpc }).run(`sold:${id}:same`, work)));
    expect(results).toEqual(['evidence', 'evidence']); expect(fills).toBe(1); expect(peak).toBe(1); expect(active.size).toBe(0);
  });
});
