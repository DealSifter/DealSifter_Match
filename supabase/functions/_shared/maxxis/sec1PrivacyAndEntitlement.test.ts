import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compactMaxxisConversationHistory } from './maxxisContextBudget';
import { guardMaxxisRuntimeEntitlement, loadMaxxisRuntimeAccessContext } from './runtimeEntitlement';
import { sanitizeToolResultForGemini } from './toolResultForGemini';

vi.mock('./config.ts', () => ({ geminiApiKey: 'synthetic-key-not-real', geminiTimeoutMs: 1000 }));
import { callGemini } from './geminiClient';

afterEach(() => vi.unstubAllGlobals());

describe('SEC-02 runtime contract with synthetic persisted plans', () => {
  const client = (plan: string, status: string, userPlan = 'free') => ({ from: (table: string) => {
    const result = { data: table === 'subscriptions' ? { plan_id: plan, status, current_period_end: status==='canceled'?'2000-01-01':'2099-01-01' }
      : table === 'users' ? { plan_id: userPlan, is_admin: false } : [], error: null };
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return q;
  } });
  it.each([
    ['free', 'active', 'MAXXIS_ANALYSIS', false],
    ['pro', 'active', 'MAXXIS_ANALYSIS', true],
    ['enterprise', 'active', 'DEAL_INTELLIGENCE', true],
    ['enterprise', 'canceled', 'DEAL_INTELLIGENCE', false],
    ['pro', 'unpaid', 'MAXXIS_ANALYSIS', false],
  ])('%s / %s enforces %s=%s', async (plan,status,capability,allowed) => {
    const loaded = await loadMaxxisRuntimeAccessContext('synthetic-a',client(plan,status) as never);
    expect(loaded.ok).toBe(true);
    if(loaded.ok)expect(guardMaxxisRuntimeEntitlement({ ...loaded.context,requestedCapability:capability }).allowed).toBe(allowed);
  });
});

it('U-01: captures synthetic PII in free text/history using mocked Gemini transport only', async () => {
  const source=readFileSync(new URL('../../maxxis-chat/index.ts',import.meta.url),'utf8');
  const body=source.match(/function sanitizeText\(value: unknown, maxLength = 2400\) \{([\s\S]*?)\n\}/)?.[1];
  expect(body).toBeTruthy();
  const sanitizeText=new Function('value','maxLength',body as string);
  const message=sanitizeText('Contact me at synthetic-person@qa.invalid or +1 202-555-0199',2400);
  const history=compactMaxxisConversationHistory([{role:'user',content:'My confidential budget is $150000; email previous@qa.invalid'}]);
  const captured: Record<string, unknown>[]=[];
  vi.stubGlobal('fetch',vi.fn(async (_url,options) => {
    captured.push(JSON.parse(options.body));
    return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
  }));
  await callGemini('synthetic-model',{contents:[...history.contents,{role:'user',parts:[{text:message}]}]});
  const payload=JSON.stringify(captured);
  expect(payload).toContain('synthetic-person@qa.invalid');
  expect(payload).toContain('previous@qa.invalid');
  expect(payload).toContain('+1 202-555-0199');
  expect(payload).toContain('150000');
});

it('U-01: existing tool projection redacts direct service contacts', () => {
  const projected=sanitizeToolResultForGemini({type:'services',services:[{id:'synthetic-service',title:'Photo synthetic-person@qa.invalid',email:'hidden@qa.invalid',phone:'+12025550199'}]} as never);
  expect(JSON.stringify(projected)).not.toContain('hidden@qa.invalid');
});
