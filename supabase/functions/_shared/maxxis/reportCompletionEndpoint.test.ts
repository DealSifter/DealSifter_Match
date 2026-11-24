import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
let handler: any;
beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: (key: string) => ({ SUPABASE_URL: 'https://oqdcnjupquhybwdbeeew.supabase.co', SUPABASE_ANON_KEY: 'fixture-anon' } as Record<string, string>)[key] }, serve: () => {} });
  await mkdir('.tmp-codex/r3-completion', { recursive: true });
  const file = resolve('.tmp-codex/r3-completion/endpoint.mjs');
  await build({ entryPoints: ['supabase/functions/maxxis-analysis-inputs/index.ts'], outfile: file, bundle: true,
    platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'offline-server-adapters', setup(b) {
      b.onResolve({ filter: /^npm:@supabase\/supabase-js@2$/ }, () => ({ path: 'auth-stub', namespace: 'offline' }));
      b.onResolve({ filter: /\/toolRegistry\.ts$/ }, () => ({ path: 'snapshot-stub', namespace: 'offline' }));
      b.onLoad({ filter: /.*/, namespace: 'offline' }, args => ({ contents: args.path === 'auth-stub'
        ? 'export function createClient(){throw Error("REAL_CLIENT_FORBIDDEN")}'
        : 'export async function executeMaxxisTool(){throw Error("LIVE_TOOL_FORBIDDEN")}', loader: 'js' }));
    } }] });
  handler = (await import(/* @vite-ignore */ pathToFileURL(file).href)).handleMaxxisAnalysisInputsRequest;
});
afterAll(() => vi.unstubAllGlobals());
const propertyId = '11111111-1111-4111-8111-111111111111';
function harness({ plan = 'enterprise', entitled = true } = {}) {
  const rows = new Map<string, any>();
  let writeError: any = null;
  const loadSnapshot = vi.fn(async (...args) => {
    if (args[7] !== true) throw Error('CACHE_ONLY_REQUIRED');
    return { state: 'available', propertyId, property: { id: propertyId, type: 'SFR', objective: 'Buy and Hold', price: 200000 },
      intelligenceSnapshot: {}, dealIntelligence: { valuationIntelligence: { status: 'ARV_UNAVAILABLE' } }, structuredAnalysis: {} };
  });
  const dependencies = { loadSnapshot, loadAccess: async () => ({ ok: true, context: { userId: 'fixture', plan, entitlements: [] } }),
    createClient: (_url: string, _key: string, opts: any) => {
      const user = opts.global.headers.Authorization.slice(7);
      return { auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) },
        from: (table: string) => {
          const q: any = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: table === 'properties' ? { type: 'SFR' } : rows.get(user) || null, error: null }) };
          return q;
        },
        rpc: async (name: string, values: any) => {
          if (name === 'ds_has_maxxis_analysis_context_access') return { data: entitled, error: null };
          if (name !== 'ds_save_analysis_context_cas') throw Error('UNEXPECTED_RPC');
          const current = rows.get(user);
          if ((current?.analysis_revision || 0) !== values.p_expected_revision) return { data: null, error: { code: '40001' } };
          if (writeError) return { data: null, error: writeError };
          const saved = { ...values.p_context, analysis_revision: values.p_expected_revision + 1, updated_at: '2026-11-05T12:00:00Z' };
          rows.set(user, saved); return { data: saved, error: null };
        } };
    } };
  const call = async (body: any, user = 'account-a') => {
    const response = await handler(new Request('http://localhost/inputs', { method: 'POST', headers: { Authorization: 'Bearer ' + user, 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, ...body }) }), dependencies);
    return { status: response.status, body: await response.json() };
  };
  return { call, rows, loadSnapshot, setWriteError: (error: any) => { writeError = error; } };
}

describe('R-3 endpoint contracts using in-memory auth/CAS adapters, not authenticated RLS acceptance', () => {
  it('classifies the exact capacity constraint, preserves prior data and revision, and allows recovery', async () => {
    const h = harness();
    await h.call({ action: 'UPSERT', confirmed: true, expectedRevision: 0, completionInputs: { insurance: 1600 } });
    const before = structuredClone(h.rows.get('account-a'));
    h.setWriteError({ code: '23514', message: 'new row violates check constraint "property_arv_review_deal_assumptions_check"' });
    const result = await h.call({ action: 'UPSERT', expectedRevision: 1, unknownFields: ['sellingCosts'] });
    expect(result.status).toBe(422);
    expect(result.body).toMatchObject({ success: false, error: 'GAP_CONTEXT_CAPACITY_EXCEEDED', requestId: expect.any(String) });
    expect(JSON.stringify(result.body)).not.toContain('property_arv_review');
    expect(h.rows.get('account-a')).toEqual(before);
    expect((await h.call({ action: 'READ' })).body.data.analysis_revision).toBe(1);
    h.setWriteError(null);
    expect((await h.call({ action: 'UPSERT', expectedRevision: 1, unknownFields: ['sellingCosts'] })).status).toBe(200);
    expect((await h.call({ action: 'UPSERT', expectedRevision: 1, unknownFields: ['sellingCosts'] })).body.error).toBe('ANALYSIS_REVISION_CONFLICT');
  });
  it.each([
    { code: '23514', message: 'constraint "some_other_constraint"' },
    { code: '08006', message: 'property_arv_review_deal_assumptions_check' },
  ])('does not label unrelated persistence errors as capacity: $code $message', async error => {
    const h = harness(); h.setWriteError(error);
    const result = await h.call({ action: 'UPSERT', confirmed: true, expectedRevision: 0, completionInputs: { insurance: 1600 } });
    expect(result.status).toBe(500);
    expect(result.body.error).toBe('GAP_RESOLUTION_PERSISTENCE_ERROR');
    expect(h.rows.size).toBe(0);
  });
  it('R3.1 T1/T5/T7/T10: unknown persists through CAS; estimates require confirmation and server-computed current bases', async () => {
    const h = harness();
    const seeded = await h.call({ action: 'UPSERT', confirmed: true, expectedRevision: 0,
      completionInputs: { scenarioStrategy: 'FLIP', purchasePrice: 200000, exitValue: 300000, rehab: 30000, acquisitionCosts: 5000,
        holdingCosts: 1000, financingMode: 'CASH', financingScope: 'NO_FINANCING_CHARGES', sellingCostPercent: 6 } });
    expect(seeded.status).toBe(200);
    expect((await h.call({action:'UPSERT', expectedRevision:1, unknownFields:['financingCosts', 'sellingCosts']})).status).toBe(200);
    expect(h.rows.get('account-a').deal_assumptions.r3Completion.unknown.financingCosts.status).toBe('UNKNOWN');
    expect((await h.call({action:'UPSERT', expectedRevision:2, acceptEstimateFields:['sellingCosts']})).status).toBe(400);
    expect((await h.call({action:'UPSERT', expectedRevision:2, confirmed:true, acceptEstimateFields:['sellingCosts','financingCosts'], estimateValue:999})).status).toBe(200);
    const stored = h.rows.get('account-a').deal_assumptions.r3Completion;
    expect(stored.inputs.sellingCosts.value).toBe(18000);
    expect(stored.inputs.financingCosts).toMatchObject({ value:0, origin:'SYSTEM_ASSUMPTION', estimate:{ confirmed:true, applicability:'NOT_APPLICABLE', scenarioVersion:3 } });
    expect((await h.call({ action:'UPSERT', expectedRevision:2, confirmed:true, acceptEstimateFields:['sellingCosts']})).status).toBe(409);
    expect((await h.call({action:'READ'},'account-b')).body.data).toBeNull();
    expect((await h.call({action:'UPSERT', expectedRevision:3, completionInputs:{exitValue:400000},confirmed:true})).status).toBe(200);
    const after = await h.call({action:'PREFLIGHT', capability:'DEAL_INTELLIGENCE', partialAccepted:true});
    expect(after.body.data.preflight.fields.sellingCosts.status).toBe('STALE');
    expect(after.body.data.preflight.scenario.calculatedOutputs.ROI).toBeNull();
  });
  it('R3-10/R3-21: concurrent writes with one revision produce one success and one controlled conflict', async () => {
    const h = harness(), body = { action: 'UPSERT', capability: 'DEAL_INTELLIGENCE', confirmed: true, expectedRevision: 0, completionInputs: { insurance: 1600 } };
    const results = await Promise.all([h.call(body), h.call(body)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(h.rows.get('account-a').analysis_revision).toBe(1);
    expect(results.find(r => r.status === 409)?.body.error).toBe('ANALYSIS_REVISION_CONFLICT');
  });
  it('R3-11: READ is scoped to the authenticated account and never accepts a client user override', async () => {
    const h = harness();
    await h.call({ action: 'UPSERT', completionInputs: { insurance: 1600 }, confirmed: true, expectedRevision: 0 });
    expect((await h.call({ action: 'READ', userId: 'account-a' }, 'account-b')).body.data).toBeNull();
    expect((await h.call({ action: 'READ' })).body.data.deal_assumptions.r3Completion.userId).toBe('account-a');
  });
  it('R3-07: refuses a parsed candidate without confirmation before any write', async () => {
    const h = harness();
    const result = await h.call({ action: 'UPSERT', expectedRevision: 0, completionInputs: { insurance: 1600 } });
    expect(result.status).toBe(400); expect(h.rows.size).toBe(0);
  });
  it('R3-14/R3-15/R3-20: access is verified before cache-only preparation, with no provider/LLM fallback', async () => {
    const denied = harness({ plan: 'pro' });
    expect((await denied.call({ action: 'PREFLIGHT', capability: 'DEAL_INTELLIGENCE' })).status).toBe(403);
    expect(denied.loadSnapshot).not.toHaveBeenCalled();
    const allowed = harness();
    const result = await allowed.call({ action: 'PREFLIGHT', capability: 'DEAL_INTELLIGENCE' });
    expect(result.status).toBe(200); expect(result.body.data.preflight.canGenerate).toBe(false);
    expect(allowed.loadSnapshot).toHaveBeenCalledTimes(1); expect(result.body.data.result.runtime.provider).toBe('deterministic');
  });
  it('R3-17/R3-18: confirmed chat inputs return in the deterministic report snapshot at the same revision', async () => {
    const h = harness();
    await h.call({ action: 'UPSERT', confirmed: true, expectedRevision: 0, completionInputs: {
      rent: 2000, vacancyRate: 5, opexMethod: 'AGGREGATE_EGI', opexPercent: 30, insurance: 1600,
    } });
    await h.call({ action: 'UPSERT', expectedRevision: 1, targetCondition: 'AS_IS' });
    const result = await h.call({ action: 'PREFLIGHT', capability: 'DEAL_INTELLIGENCE', partialAccepted: true });
    expect(result.body.data.preflight.canGenerate).toBe(true);
    const snapshot = result.body.data.result.data.intelligenceSnapshot;
    expect(snapshot.analysisRevision).toBe(2);expect(snapshot.dealAssumptions.activeScenario.assumptions.insurance).toBe(1600);
    expect(snapshot.dealAssumptions.activeScenario.calculatedOutputs.NOI).toBe(15960);
  });
  it('never trusts client-supplied financial results or a scenario from another property',async()=>{
    const h=harness();
    const scenario={id:'private-fixture',strategy:'BUY_AND_HOLD',propertyId,confirmed:true,status:'COMPLETE',
      assumptions:{purchasePrice:200000,rent:2000,vacancyRate:5,propertyTax:2200,insurance:1600,HOA:0,managementPercent:0,maintenanceAmount:1200,otherOperatingExpenses:0,monthlyPI:0},
      calculatedOutputs:{NOI:999999999}};
    expect((await h.call({action:'UPSERT',dealAssumptions:{activeScenario:{...scenario,propertyId:'22222222-2222-4222-8222-222222222222'}}})).status).toBe(400);
    expect((await h.call({action:'UPSERT',dealAssumptions:{activeScenario:scenario}})).status).toBe(200);
    expect(h.rows.get('account-a').deal_assumptions.activeScenario.calculatedOutputs.NOI).toBe(17800);
  });
});
