import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock('@supabase/supabase-js'); });

it('N-03 discovery: overlapping same-URL reads with different identities share the first response', async () => {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://synthetic.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-synthetic-anon');
  let clientFetch;
  vi.doMock('@supabase/supabase-js', () => ({ createClient: (_url, _key, options) => {
    clientFetch = options.global.fetch;
    return {};
  } }));
  let resolveA;
  const transport = vi.fn(() => new Promise(resolve => { resolveA = resolve; }));
  vi.stubGlobal('fetch', transport);
  await import('./supabaseClient');
  const url = 'https://synthetic.supabase.co/rest/v1/users?select=id';
  const first = clientFetch(url, { headers: { Authorization: 'Bearer synthetic-A' } });
  const nextAccount = clientFetch(url, { headers: { Authorization: 'Bearer synthetic-B' } });
  resolveA(new Response(JSON.stringify({ id: 'synthetic-A' })));
  expect(await (await first).json()).toEqual({ id: 'synthetic-A' });
  expect(await (await nextAccount).json()).toEqual({ id: 'synthetic-A' });
  expect(transport).toHaveBeenCalledTimes(1);
  // This passing reproduction CONFIRMS a new vulnerability; it is not a fix.
});
