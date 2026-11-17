// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { beginConnection, finishConnection, seal, unseal, digest, type ConsentState, type MailboxStore } from './googleConnection';

const config = { clientId: 'fixture-app', clientSecret: 'fixture-secret', callback: 'https://staging.example.invalid/callback',
  encryptionKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' };
const user = { id: 'fixture-user-a', email: 'dealsifter-qa-0000000000000000@gmail.com', email_confirmed_at: '2026-11-16T00:00:00Z' };
const now = Date.parse('2026-11-16T12:00:00Z');
function fixture() {
  const states = new Map<string, ConsentState>();
  const claims = new Set<string>();
  let connection: Record<string, unknown> | null = null;
  const store: MailboxStore = {
    async putState(hash, state) { states.set(hash, state); },
    async consumeState(hash) {
      if (claims.has(hash)) return null;
      claims.add(hash);
      return states.get(hash) || null;
    },
    getUser: vi.fn(async () => user),
    saveConnection: vi.fn(async (hash, value) => {
      if (!states.delete(hash)) throw new Error('CONSENT_CANCELLED');
      connection = value;
    }),
  };
  const fetchMock = vi.fn(async (url: string | URL | Request) => String(url).includes('/token')
    ? new Response(JSON.stringify({ access_token: 'private-test-token', token_type: 'Bearer', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/gmail.send' }))
    : new Response(JSON.stringify({ sub: 'mailbox-a', email: user.email, email_verified: true })));
  async function start() {
    const result = await beginConnection(user, config, store, now);
    return new URL(result.authorizationUrl).searchParams.get('state')!;
  }
  const finish = (state: string, time = now) => finishConnection({ state, code: 'fixture-code' }, config, store, fetchMock as typeof fetch, time);
  return { store, states, start, finish, fetchMock, connection: () => connection };
}
describe('Gmail mailbox consent, offline security contract', () => {
  it('requires a Gmail account and does not substitute Hotmail or another sender', async () => {
    const f = fixture();
    await expect(beginConnection({ ...user, email: 'fixture@hotmail.com' }, config, f.store)).rejects.toThrow('GMAIL_ACCOUNT_REQUIRED');
    expect(f.states.size).toBe(0);
    expect(f.fetchMock).not.toHaveBeenCalled();
  });
  it('rejects an unverified Google identity even when the email matches', async () => {
    const f = fixture(); const state = await f.start();
    f.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token', token_type: 'Bearer', expires_in: 3600,
      scope: 'openid email https://www.googleapis.com/auth/gmail.send' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: 'mailbox-a', email: user.email, email_verified: false })));
    await expect(f.finish(state)).rejects.toThrow('MAILBOX_EMAIL_MISMATCH');
    expect(f.store.saveConnection).not.toHaveBeenCalled();
  });
  it('requires a confirmed account email before creating state', async () => {
    const f = fixture();
    await expect(beginConnection({ ...user, email_confirmed_at: undefined }, config, f.store)).rejects.toThrow('CONFIRM_ACCOUNT_EMAIL');
    expect(f.states.size).toBe(0);
  });
  it('fails closed when provider configuration is absent', async () => {
    const f = fixture();
    await expect(beginConnection(user, { ...config, clientSecret: '' }, f.store)).rejects.toThrow('MAILBOX_NOT_CONFIGURED');
    expect(f.states.size).toBe(0);
  });
  it('uses random state, PKCE S256, exact callback, least scopes and no secret in browser URL', async () => {
    const f = fixture();
    const a = new URL((await beginConnection(user, config, f.store, now)).authorizationUrl);
    const b = await f.start();
    expect(a.searchParams.get('state')).not.toBe(b);
    expect(a.searchParams.get('code_challenge_method')).toBe('S256');
    expect(a.searchParams.get('redirect_uri')).toBe(config.callback);
    expect(a.searchParams.get('access_type')).toBe('online');
    expect(a.searchParams.has('response_mode')).toBe(false);
    expect(a.searchParams.get('scope')).toBe('openid email https://www.googleapis.com/auth/gmail.send');
    expect(a.toString()).not.toContain('fixture-secret');
    const state = f.states.get(await digest(a.searchParams.get('state')!))!;
    expect(Date.parse(state.expires_at) - now).toBe(600_000);
    expect(state.verifier_encrypted).toMatch(/^v1\./);
    const verifier = await unseal(state.verifier_encrypted, config.encryptionKey, `state:google:${user.id}:${await digest(a.searchParams.get('state')!)}`);
    expect(a.searchParams.get('code_challenge')).toBe(await digest(verifier));
  });
  it('encrypts with authenticated user context and rejects tampering/cross-account decryption', async () => {
    const value = await seal('private-value', config.encryptionKey, 'user-a');
    expect(value).not.toContain('private-value');
    expect(await unseal(value, config.encryptionKey, 'user-a')).toBe('private-value');
    await expect(unseal(value, config.encryptionKey, 'user-b')).rejects.toThrow('INVALID_CIPHERTEXT');
    await expect(unseal(value.slice(0, -3) + 'abc', config.encryptionKey, 'user-a')).rejects.toThrow('INVALID_CIPHERTEXT');
  });
  it.each(['missing', 'expired', 'replayed'])('blocks %s consent before any provider HTTP', async kind => {
    const f = fixture();
    const state = await f.start();
    if (kind === 'missing') f.states.clear();
    if (kind === 'replayed') await f.store.consumeState(await digest(state));
    await expect(f.finish(state, kind === 'expired' ? now + 600_001 : now)).rejects.toThrow('INVALID_OR_EXPIRED_CONSENT');
    expect(f.fetchMock).not.toHaveBeenCalled();
  });
  it('consumes a denied consent without exchanging a code', async () => {
    const f = fixture(); const state = await f.start();
    await expect(finishConnection({ state, error: 'access_denied' }, config, f.store, f.fetchMock as typeof fetch, now)).rejects.toThrow('CONSENT_NOT_GRANTED');
    await expect(f.finish(state)).rejects.toThrow('INVALID_OR_EXPIRED_CONSENT');
    expect(f.fetchMock).not.toHaveBeenCalled();
  });
  it('stores an encrypted matching mailbox and returns only connection metadata', async () => {
    const f = fixture(); const state = await f.start();
    const result = await f.finish(state);
    expect(result.status).toBe('CONNECTED');
    expect(JSON.stringify(result)).not.toContain('private-test-token');
    expect(f.connection()?.mailbox_email).toBe(user.email);
    expect(await unseal(String(f.connection()?.token_encrypted), config.encryptionKey, `mailbox:${user.id}:google`)).toBe('private-test-token');
    expect(f.fetchMock).toHaveBeenCalledTimes(2);
    expect(f.fetchMock.mock.calls.every(([url]) => !String(url).includes('sendMail'))).toBe(true);
  });
  it('exchanges the code only once for concurrent callbacks', async () => {
    const f = fixture(); const state = await f.start();
    const results = await Promise.allSettled([f.finish(state), f.finish(state)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(f.fetchMock).toHaveBeenCalledTimes(2); // one token request + one identity request
    expect(f.store.saveConnection).toHaveBeenCalledTimes(1);
  });
  it('rejects another mailbox without persisting its token', async () => {
    const f = fixture(); const state = await f.start();
    f.fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'token', token_type: 'Bearer', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/gmail.send' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: 'other', email: 'other@example.invalid', email_verified: true })));
    await expect(f.finish(state)).rejects.toThrow('MAILBOX_EMAIL_MISMATCH');
    expect(f.store.saveConnection).not.toHaveBeenCalled();
  });
  it('rejects changed account email before persisting', async () => {
    const f = fixture(); const state = await f.start();
    vi.mocked(f.store.getUser).mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, email: 'changed@example.invalid' });
    await expect(f.finish(state)).rejects.toThrow('MAILBOX_EMAIL_MISMATCH');
    expect(f.store.saveConnection).not.toHaveBeenCalled();
  });
  it('does not retry a failed token request or reveal provider response', async () => {
    const f = fixture(); const state = await f.start();
    f.fetchMock.mockResolvedValue(new Response('provider-sensitive-response', { status: 401 }));
    await expect(f.finish(state)).rejects.toThrow('MAILBOX_AUTHORIZATION_FAILED');
    expect(f.fetchMock).toHaveBeenCalledTimes(1);
    expect(f.connection()).toBeNull();
  });
  it('rejects a grant without gmail.send', async () => {
    const f = fixture(); const state = await f.start();
    f.fetchMock.mockResolvedValue(new Response(JSON.stringify({ access_token: 'token', token_type: 'Bearer', expires_in: 3600, scope: 'User.Read' })));
    await expect(f.finish(state)).rejects.toThrow('MAILBOX_PERMISSION_MISSING');
    expect(f.fetchMock).toHaveBeenCalledTimes(1);
  });
  it('cannot reconnect after disconnect removes a consent already waiting on Google', async () => {
    const f = fixture(); const state = await f.start();
    f.fetchMock.mockImplementationOnce(async () => {
      f.states.clear(); // same state deletion performed by authenticated disconnect
      return new Response(JSON.stringify({ access_token: 'token', token_type: 'Bearer', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/gmail.send' }));
    });
    await expect(f.finish(state)).rejects.toThrow('CONSENT_CANCELLED');
    expect(f.connection()).toBeNull();
  });
});
