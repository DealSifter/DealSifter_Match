import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { PostgrestClient } from '@supabase/postgrest-js';

const base = 'https://synthetic.supabase.co';
const url = base + '/rest/v1/users?select=id';
const headers = token => ({ Authorization: 'Bearer ' + token });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const json = id => new Response(JSON.stringify({ id }), { headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); vi.doUnmock('@supabase/supabase-js'); });

async function setup() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', base);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-synthetic-anon');
  vi.stubGlobal('crypto', webcrypto);
  let request, authListener;
  vi.doMock('@supabase/supabase-js', () => ({ createClient: (_url, _key, options) => {
    request = options.global.fetch;
    return { auth: { onAuthStateChange: callback => { authListener = callback; return { data: { subscription: { unsubscribe() {} } } }; } } };
  } }));
  const transport = vi.fn();
  vi.stubGlobal('fetch', transport);
  await import('./supabaseClient');
  return { request, transport, emit: (event, token) => authListener(event, token ? { access_token: token, user: { id: 'synthetic' } } : null) };
}

it('SEC-06 regression: overlapping same-URL reads with A and B receive only their own response', async () => {
  const { request, transport } = await setup();
  const a = deferred(), b = deferred();
  transport.mockImplementation((_url, init) => new Headers(init.headers).get('authorization').endsWith('A') ? a.promise : b.promise);
  const first = request(url, { headers: headers('A') });
  const second = request(url, { headers: headers('B') });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
  a.resolve(json('A')); b.resolve(json('B'));
  expect(await (await first).json()).toEqual({ id: 'A' });
  expect(await (await second).json()).toEqual({ id: 'B' });
});

it.each(['GET', 'HEAD'])('deduplicates equivalent %s reads in one session with independent response bodies', async method => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A');
  const pending = deferred(); transport.mockReturnValue(pending.promise);
  const first = request(url, { method, headers: headers('A') });
  const second = request(url, { method, headers: new Headers({ authorization: 'Bearer A' }) });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  pending.resolve(method === 'HEAD' ? new Response(null) : json('A'));
  const responses = await Promise.all([first, second]);
  expect(responses[0]).not.toBe(responses[1]);
  expect(await responses[0].text()).toBe(await responses[1].text());
});

it('separates anonymous and authenticated reads', async () => {
  const { request, transport } = await setup(); const a = deferred(), b = deferred();
  transport.mockImplementation((_u, init) => new Headers(init.headers).has('authorization') ? b.promise : a.promise);
  const anonymous = request(url), signedIn = request(url, { headers: headers('A') });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
  a.resolve(json('anonymous')); b.resolve(json('A'));
  expect(await (await anonymous).json()).toEqual({ id: 'anonymous' });
  expect(await (await signedIn).json()).toEqual({ id: 'A' });
});

it('invalidates an anonymous request when login starts a new authentication context', async () => {
  const { request, transport, emit } = await setup(); emit('INITIAL_SESSION');
  const pending = deferred(); transport.mockReturnValueOnce(pending.promise).mockResolvedValueOnce(json('A'));
  const anonymous = request(url).catch(error => error);
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1)); emit('SIGNED_IN', 'A'); pending.resolve(json('anonymous'));
  expect(await anonymous).toMatchObject({ name: 'AbortError' });
  expect(await (await request(url, { headers: headers('A') })).json()).toEqual({ id: 'A' });
});

it.each(['GET', 'POST'])('discards pending %s data across logout/login, even if transport ignores cancellation', async method => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A');
  const a = deferred(); transport.mockReturnValueOnce(a.promise).mockResolvedValueOnce(json('B'));
  const obsolete = request(url, { method, headers: headers('A') }).catch(error => error);
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  emit('SIGNED_OUT'); emit('SIGNED_IN', 'B');
  a.resolve(json('A'));
  expect(await obsolete).toMatchObject({ name: 'AbortError' });
  expect(await (await request(url, { method, headers: headers('B') })).json()).toEqual({ id: 'B' });
});

it('separates different sessions of the same user and invalidates old clones', async () => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'same-user-session-1');
  transport.mockResolvedValueOnce(json('first')).mockResolvedValueOnce(json('second'));
  const old = await request(url, { headers: headers('same-user-session-1') });
  const clone = old.clone(); emit('SIGNED_OUT'); emit('SIGNED_IN', 'same-user-session-2');
  await expect(old.json()).rejects.toMatchObject({ name: 'AbortError' });
  await expect(clone.text()).rejects.toMatchObject({ name: 'AbortError' });
  expect(await (await request(url, { headers: headers('same-user-session-2') })).json()).toEqual({ id: 'second' });
});

it('does not release a body that finishes after the identity changes', async () => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A');
  let source;
  const response = new Response(new ReadableStream({ start(controller) { source = controller; } }));
  transport.mockResolvedValue(response);
  const result = await request(url, { method: 'POST', headers: headers('A') });
  const reading = result.text().catch(error => error);
  emit('SIGNED_IN', 'B'); source.enqueue(new TextEncoder().encode('{"id":"A"}')); source.close();
  expect(await reading).toMatchObject({ name: 'AbortError' });
});

it('discards a late streamed chunk from the previous session', async () => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A');
  let source; transport.mockResolvedValue(new Response(new ReadableStream({ start(controller) { source = controller; } })));
  const response = await request(url, { method: 'POST', headers: headers('A') });
  const reader = response.body.getReader(), chunk = reader.read().catch(error => error);
  await Promise.resolve(); emit('SIGNED_OUT'); source.enqueue(new TextEncoder().encode('old-A'));
  expect(await chunk).toMatchObject({ name: 'AbortError' });
});

it('refreshes authorization without mixing tokens or retrying stale credentials', async () => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'old-token');
  const old = deferred(); transport.mockReturnValueOnce(old.promise).mockResolvedValue(json('refreshed'));
  const obsolete = request(url, { headers: headers('old-token') }).catch(error => error);
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  emit('TOKEN_REFRESHED', 'new-token'); old.resolve(json('old'));
  expect(await obsolete).toMatchObject({ name: 'AbortError' });
  await expect(request(url, { headers: headers('old-token') })).rejects.toMatchObject({ name: 'AbortError' });
  expect(await (await request(url, { headers: headers('new-token') })).json()).toEqual({ id: 'refreshed' });
  expect(transport).toHaveBeenCalledTimes(2);
});

it('retains equivalent reads on repeated SIGNED_IN and transient null refresh events', async () => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A');
  const pending = deferred(); transport.mockReturnValue(pending.promise);
  const first = request(url, { headers: headers('A') });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  emit('SIGNED_IN', 'A'); emit('TOKEN_REFRESHED');
  const second = request(url, { headers: headers('A') });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  pending.resolve(json('A'));
  expect(await (await first).json()).toEqual({ id: 'A' });
  expect(await (await second).json()).toEqual({ id: 'A' });
});

it.each(['USER_UPDATED', 'MFA_CHALLENGE_VERIFIED'])('invalidates authorization on %s even if the token is unchanged', async event => {
  const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A'); transport.mockResolvedValue(json('A'));
  const response = await request(url, { headers: headers('A') }); emit(event, 'A');
  await expect(response.json()).rejects.toMatchObject({ name: 'AbortError' });
});

it('normalizes Request and Headers inputs while separating response representation and request options', async () => {
  const { request, transport } = await setup(); const pending = deferred(); transport.mockReturnValue(pending.promise);
  const first = request(new Request(url, { headers: { ...headers('A'), Accept: 'application/json' } }));
  const second = request(url, { headers: { ...headers('A'), Accept: 'text/csv' } });
  const third = request(url, { headers: headers('A'), credentials: 'omit' });
  const fourth = request(url, { headers: headers('A'), credentials: 'include' });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(4)); pending.resolve(json('own'));
  await Promise.all([first, second, third, fourth]);
});

it('preserves independent cancellation and removes failed/aborted pending entries', async () => {
  const { request, transport } = await setup(); const one = new AbortController(), two = new AbortController();
  const second = deferred(); transport.mockImplementation((_u, init) => init.signal === one.signal
    ? new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) : second.promise);
  const a = request(url, { signal: one.signal }).catch(error => error), b = request(url, { signal: two.signal });
  await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(2)); one.abort(); second.resolve(json('second'));
  expect(await a).toMatchObject({ name: 'AbortError' }); expect(await (await b).json()).toEqual({ id: 'second' });
  transport.mockRejectedValueOnce(new Error('synthetic network failure')).mockResolvedValueOnce(json('retry'));
  await expect(request(url)).rejects.toThrow('synthetic network failure');
  expect(await (await request(url)).json()).toEqual({ id: 'retry' });
  await expect(request(url, { signal: one.signal })).rejects.toMatchObject({ name: 'AbortError' });
});

it('does not deduplicate writes, Auth calls, or a different origin with a matching URL prefix', async () => {
  const { request, transport } = await setup(); transport.mockImplementation(async () => json('ok'));
  const requests = [request(url, { method: 'POST' }), request(url, { method: 'POST' }),
    request(base + '/auth/v1/token'), request(base + '/auth/v1/token'),
    request(base + '.example.invalid/rest/v1/users'), request(base + '.example.invalid/rest/v1/users')];
  await Promise.all(requests); expect(transport).toHaveBeenCalledTimes(6);
});

describe('actual PostgREST consumer contract with mock transport', () => {
  it('does not retry a late network error from an obsolete session', async () => {
    const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A'); const pending = deferred();
    transport.mockReturnValue(pending.promise);
    const client = new PostgrestClient(base + '/rest/v1', { fetch: request, headers: headers('A') });
    const query = client.from('users').select('id').then(result => result);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1)); emit('SIGNED_OUT'); emit('SIGNED_IN', 'B');
    pending.reject(new Error('synthetic network failure'));
    const result = await query; expect(result.data).toBeNull(); expect(result.error.message).toContain('AbortError');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('returns no old data to a state consumer after switching accounts', async () => {
    const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A'); const a = deferred();
    transport.mockReturnValueOnce(a.promise).mockResolvedValueOnce(new Response('[{"id":"B"}]'));
    const clientA = new PostgrestClient(base + '/rest/v1', { fetch: request, headers: headers('A') });
    const clientB = new PostgrestClient(base + '/rest/v1', { fetch: request, headers: headers('B') });
    let displayed = 'B';
    const old = clientA.from('users').select('id').then(result => { if (result.data) displayed = result.data[0].id; return result; });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1)); emit('SIGNED_OUT'); emit('SIGNED_IN', 'B');
    a.resolve(new Response('[{"id":"A"}]'));
    expect((await old).data).toBeNull(); expect(displayed).toBe('B');
    const current = await clientB.from('users').select('id'); expect(current.error).toBeNull(); expect(current.data).toEqual([{ id: 'B' }]);
  });
  it('preserves legitimate SDK retry after a transient HTTP error', async () => {
    const { request, transport, emit } = await setup(); emit('SIGNED_IN', 'A');
    transport.mockResolvedValueOnce(new Response('', { status: 520, headers: { 'Retry-After': '0' } })).mockResolvedValueOnce(new Response('[{"id":"A"}]'));
    const client = new PostgrestClient(base + '/rest/v1', { fetch: request, headers: headers('A') });
    expect((await client.from('users').select('id')).data).toEqual([{ id: 'A' }]); expect(transport).toHaveBeenCalledTimes(2);
  });
});
