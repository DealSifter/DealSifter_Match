import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./config.ts', () => ({ geminiApiKey: 'synthetic-not-real', geminiTimeoutMs: 1000, geminiModels: ['gemini-3.5-flash-lite','gemini-3.5-flash'] }));
import { GeminiUsageSession, GeminiQuotaError, normalizeGeminiUsage, createGeminiUsageSession } from './geminiUsageGuard';
import { callGemini } from './geminiClient';
const body = { contents: [{ role: 'user', parts: [{ text: 'synthetic' }] }], generationConfig: { maxOutputTokens: 1400 } };
afterEach(() => vi.unstubAllGlobals());
const client = (enforced = true) => ({ rpc: vi.fn(async (name: string) => ({ data: name.includes('reserve') || name.includes('begin') ? { enforced } : null, error: null as unknown })) });
const session = (rpc = client(), consumer: 'maxxis_chat' | 'presentation_translate' = 'maxxis_chat') => new GeminiUsageSession(rpc, 'f1250000-0000-4000-8000-000000000001', consumer);
const response = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'synthetic answer' }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2, cachedContentTokenCount: 4, totalTokenCount: 17 } }), { headers: { 'Content-Type': 'application/json' } });

it('DISABLED preserves one HTTP request without attempts or finalization writes', async () => {
 const rpc = client(false), usage = session(rpc), fetch = vi.fn(async () => response()); vi.stubGlobal('fetch', fetch);
 expect((await callGemini('gemini-3.5-flash-lite', body, 1000, usage)).response.status).toBe(200); await usage.close();
 expect(fetch).toHaveBeenCalledTimes(1); expect(rpc.rpc.mock.calls.map(c => c[0])).toEqual(['ds_gemini_reserve_execution']);
});
it('reserves the full execution once logically, with separate attempts for fallback and interpretation', async () => {
 const rpc = client(), usage = session(rpc), fetch = vi.fn(async () => response()); vi.stubGlobal('fetch', fetch);
 for (const model of ['gemini-3.5-flash-lite','gemini-3.5-flash','gemini-3.5-flash']) await callGemini(model, body, 1000, usage);
 await usage.close(); expect(fetch).toHaveBeenCalledTimes(3);
 const reservations = rpc.rpc.mock.calls.filter(c => c[0] === 'ds_gemini_reserve_execution');
 expect(new Set(reservations.map(c => (c[1] as Record<string, unknown>).p_id)).size).toBe(1);
 expect(reservations[0][1]).toMatchObject({ p_calls: 3, p_consumer: 'maxxis_chat' });
 expect(rpc.rpc.mock.calls.filter(c => c[0] === 'ds_gemini_begin_attempt')).toHaveLength(3);
 expect(rpc.rpc.mock.calls.filter(c => c[0] === 'ds_gemini_finalize_attempt')).toHaveLength(3);
});
it.each(['GEMINI_INDIVIDUAL_LIMIT','GEMINI_FREE_POOL_LIMIT','GEMINI_CAPACITY_LIMIT','GEMINI_CONFIGURATION_REQUIRED'])('%s never dispatches HTTP', async reason => {
 const rpc = { rpc: vi.fn(async () => ({ data: null, error: { message: reason } })) }, fetch = vi.fn();vi.stubGlobal('fetch',fetch);
 await expect(callGemini('gemini-3.5-flash-lite', body, 1000, session(rpc))).rejects.toMatchObject({ reason });expect(fetch).not.toHaveBeenCalled();
});
it('unknown guard outage fails closed, without leaking error payload', async () => {
 const rpc = { rpc: vi.fn(async () => { throw new Error('private upstream details'); }) },fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 await expect(callGemini('gemini-3.5-flash-lite',body,1000,session(rpc))).rejects.toMatchObject({reason:'GEMINI_GUARD_UNAVAILABLE'});expect(fetch).not.toHaveBeenCalled();
});
it('missing authenticated usage context cannot bypass the central guard',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(callGemini('gemini-3.5-flash-lite',body)).rejects.toBeInstanceOf(GeminiQuotaError);expect(fetch).not.toHaveBeenCalled();});
it('deterministic or cached work causes no quota RPC or HTTP',async()=>{const makeClient=vi.fn();const usage=createGeminiUsageSession('synthetic','maxxis_chat',makeClient);await usage.close();expect(makeClient).not.toHaveBeenCalled();});
it('translation reserves one external call in its own category',async()=>{const rpc=client(),usage=session(rpc,'presentation_translate');vi.stubGlobal('fetch',vi.fn(async()=>response()));await callGemini('gemini-3.5-flash-lite',{...body,generationConfig:{maxOutputTokens:8192}},1000,usage);await usage.close();expect(rpc.rpc.mock.calls[0][1]).toMatchObject({p_calls:1,p_consumer:'presentation_translate'});});
it('timeout leaves an uncertain attempt and finalizes without fictional zero tokens',async()=>{const rpc=client(),usage=session(rpc);vi.stubGlobal('fetch',vi.fn(async()=>{throw new DOMException('synthetic timeout','AbortError');}));await expect(callGemini('gemini-3.5-flash-lite',body,1000,usage)).rejects.toMatchObject({name:'AbortError'});const finalize=rpc.rpc.mock.calls.find(c=>c[0]==='ds_gemini_finalize_attempt');expect(finalize?.[1]).toMatchObject({p_total:null,p_prompt:null,p_output:null});});
it('normalizes usage without adding cached tokens twice or persisting source payload',()=>{expect(normalizeGeminiUsage({usageMetadata:{promptTokenCount:10,candidatesTokenCount:5,thoughtsTokenCount:2,cachedContentTokenCount:4,toolUsePromptTokenCount:3,totalTokenCount:20},contents:'PRIVATE'})).toEqual({p_prompt:10,p_output:5,p_thinking:2,p_cached:4,p_tool:3,p_total:20});expect(normalizeGeminiUsage({usageMetadata:{totalTokenCount:-1}}).p_total).toBeNull();});
it('finalization outage does not refund possible consumption',async()=>{const rpc=client(),original=rpc.rpc.getMockImplementation()!;rpc.rpc.mockImplementation(async name=>name==='ds_gemini_finalize_attempt'?{data:null,error:{message:'outage'}}:original(name));vi.stubGlobal('fetch',vi.fn(async()=>response()));await expect(callGemini('gemini-3.5-flash-lite',body,1000,session(rpc))).rejects.toBeInstanceOf(GeminiQuotaError);});
