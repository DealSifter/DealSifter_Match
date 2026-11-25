// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ getSession: vi.fn(), single: vi.fn(), listener: null }));
vi.mock('../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {
  auth: { getSession: mock.getSession, onAuthStateChange: fn => { mock.listener = fn; return { data: { subscription: { unsubscribe: vi.fn() } } }; } },
  from: () => { const query = { select: () => query, eq: () => query, single: mock.single }; return query; },
} }));
vi.mock('../lib/localStoragePolicy', () => ({ clearSensitiveCache: vi.fn() }));
vi.mock('../lib/productAnalytics', () => ({ trackProductEvent: vi.fn() }));
vi.mock('../lib/observability', () => ({ captureOperationalMetric: vi.fn() }));
import { useAuthSession } from './useAuthSession';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const session = id => ({ access_token: 'synthetic-' + id, user: { id, email: id + '@qa.invalid' } });
afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); });
const props = () => ({ authSession: null, setAuthSession: vi.fn(), setIsAdmin: vi.fn(), onSessionRestored: vi.fn() });

it('late administrator lookup from A cannot update B or restore A navigation', async () => {
  const bootstrap = deferred(), a = deferred(); mock.getSession.mockReturnValue(bootstrap.promise);
  mock.single.mockReturnValueOnce(a.promise).mockResolvedValueOnce({ data: { is_admin: false } });
  const options = props(); renderHook(() => useAuthSession(options));
  await act(async () => { mock.listener('SIGNED_IN', session('A')); });
  await waitFor(() => expect(mock.single).toHaveBeenCalledTimes(1));
  await act(async () => { mock.listener('SIGNED_OUT', null); mock.listener('SIGNED_IN', session('B')); });
  await waitFor(() => expect(options.onSessionRestored).toHaveBeenCalledWith(expect.objectContaining({ userId: 'B' })));
  options.setIsAdmin.mockClear(); options.onSessionRestored.mockClear();
  await act(async () => { a.resolve({ data: { is_admin: true } }); bootstrap.resolve({ data: { session: session('A') } }); });
  expect(options.setIsAdmin).not.toHaveBeenCalled(); expect(options.onSessionRestored).not.toHaveBeenCalled();
  expect(options.setAuthSession.mock.calls.at(-1)[0]).toBeTypeOf('function');
});

it('discarded A errors cannot reset the current administrator status', async () => {
  const a = deferred(); mock.getSession.mockResolvedValue({ data: { session: null } });
  mock.single.mockReturnValueOnce(a.promise).mockResolvedValueOnce({ data: { is_admin: true } });
  const options = props(); renderHook(() => useAuthSession(options));
  await waitFor(() => expect(options.setAuthSession).toHaveBeenCalledWith(null));
  await act(async () => { mock.listener('SIGNED_IN', session('A')); });
  await waitFor(() => expect(mock.single).toHaveBeenCalledTimes(1));
  await act(async () => { mock.listener('SIGNED_IN', session('B')); });
  await waitFor(() => expect(options.setIsAdmin).toHaveBeenLastCalledWith(true)); options.setIsAdmin.mockClear();
  await act(async () => { a.resolve({ data: null, error: { message: 'old request' } }); });
  expect(options.setIsAdmin).not.toHaveBeenCalled();
});
