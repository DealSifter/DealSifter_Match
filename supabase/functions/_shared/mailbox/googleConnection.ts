import { MailboxError, digest, b64, requireVerifiedUser, checkConfig, seal, unseal, type MailboxUser, type ConnectionConfig, type MailboxStore } from './connectionSecurity.ts';
export { MailboxError, digest, seal, unseal } from './connectionSecurity.ts';
export type { MailboxUser, ConnectionConfig, ConsentState, MailboxStore } from './connectionSecurity.ts';
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'];
export async function beginConnection(user: MailboxUser, config: ConnectionConfig, store: MailboxStore, now = Date.now()) {
  const verified = requireVerifiedUser(user);
  if (!/@(gmail|googlemail)\.com$/i.test(verified.email.trim())) throw new MailboxError('GMAIL_ACCOUNT_REQUIRED');
  checkConfig(config);
  const state = b64(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
  const stateHash = await digest(state);
  await store.putState(stateHash, {
    user_id: user.id, expires_at: new Date(now + 10 * 60_000).toISOString(),
    verifier_encrypted: await seal(verifier, config.encryptionKey, `state:google:${user.id}:${stateHash}`),
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.callback,
    response_type: 'code', access_type: 'online', scope: SCOPES.join(' '), state,
    code_challenge: await digest(verifier), code_challenge_method: 'S256', prompt: 'consent select_account' }).toString();
  return { authorizationUrl: url.toString(), expiresInSeconds: 600 };
}
export async function finishConnection(input: { state: string; code?: string; error?: string }, config: ConnectionConfig,
  store: MailboxStore, transport: typeof fetch, now = Date.now()) {
  checkConfig(config);
  if (!/^[A-Za-z0-9_-]{43}$/.test(input.state)) throw new MailboxError('INVALID_OR_EXPIRED_CONSENT');
  const stateHash = await digest(input.state);
  // Atomic claim: retries/replays never exchange the code a second time.
  const state = await store.consumeState(stateHash);
  if (!state || !Number.isFinite(Date.parse(state.expires_at)) || Date.parse(state.expires_at) <= now) {
    throw new MailboxError('INVALID_OR_EXPIRED_CONSENT');
  }
  if (input.error) throw new MailboxError('CONSENT_NOT_GRANTED');
  if (!input.code || input.code.length > 8192) throw new MailboxError('INVALID_AUTHORIZATION_CODE');
  const user = requireVerifiedUser(await store.getUser(state.user_id));
  const verifier = await unseal(state.verifier_encrypted, config.encryptionKey, `state:google:${user.id}:${stateHash}`);
  const response = await transport('https://oauth2.googleapis.com/token', {
    method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code: input.code,
      grant_type: 'authorization_code', redirect_uri: config.callback, code_verifier: verifier }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new MailboxError('MAILBOX_AUTHORIZATION_FAILED');
  const token = await response.json();
  const granted = new Set(String(token.scope || '').toLowerCase().split(/\s+/));
  if (token.token_type?.toLowerCase() !== 'bearer' || typeof token.access_token !== 'string' || !token.access_token ||
    !granted.has('https://www.googleapis.com/auth/gmail.send') || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
    throw new MailboxError('MAILBOX_PERMISSION_MISSING');
  }
  const identityResponse = await transport('https://openidconnect.googleapis.com/v1/userinfo', {
    redirect: 'error', headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(15_000),
  });
  if (!identityResponse.ok) throw new MailboxError('MAILBOX_IDENTITY_UNAVAILABLE');
  const identity = await identityResponse.json();
  const mailbox = String(identity.email || '').trim().toLowerCase();
  if (!identity.sub || identity.email_verified !== true || !/@(gmail|googlemail)\.com$/.test(mailbox) || mailbox !== user.email.trim().toLowerCase()) throw new MailboxError('MAILBOX_EMAIL_MISMATCH');
  const currentUser = requireVerifiedUser(await store.getUser(user.id));
  if (currentUser.email.trim().toLowerCase() !== mailbox) throw new MailboxError('MAILBOX_EMAIL_MISMATCH');
  // Online consent only, no refresh-token persistence. Reconnect when this grant expires.
  const expiresAt = new Date(now + Math.min(token.expires_in, 86400) * 1000).toISOString();
  await store.saveConnection(stateHash, { user_id: user.id, provider: 'google', mailbox_email: mailbox,
    provider_subject: identity.sub, granted_scopes: ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send'],
    token_encrypted: await seal(token.access_token, config.encryptionKey, `mailbox:${user.id}:google`),
    connected_at: new Date(now).toISOString(), expires_at: expiresAt });
  return { provider: 'google', status: 'CONNECTED', expiresAt };
}
