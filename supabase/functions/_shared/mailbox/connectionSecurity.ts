// Mailbox consent is separate from Supabase login. No network is used without an injected transport.
export class MailboxError extends Error {
  constructor(public code: string) { super(code); }
}
export type MailboxUser = { id: string; email?: string; email_confirmed_at?: string };
export type ConnectionConfig = { clientId: string; clientSecret: string; callback: string; encryptionKey: string };
export type ConsentState = { user_id: string; verifier_encrypted: string; expires_at: string };
export interface MailboxStore {
  putState(hash: string, state: ConsentState): Promise<void>;
  consumeState(hash: string): Promise<ConsentState | null>;
  getUser(id: string): Promise<MailboxUser | null>;
  saveConnection(hash: string, connection: Record<string, unknown>): Promise<void>;
}
const encoder = new TextEncoder();
export function b64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64(value: string) {
  try { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)); }
  catch { throw new MailboxError('INVALID_ENCRYPTION_KEY'); }
}
export async function digest(value: string) { return b64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
export function requireVerifiedUser(user: MailboxUser | null) {
  if (!user?.id || !user.email || !user.email_confirmed_at) throw new MailboxError('CONFIRM_ACCOUNT_EMAIL');
  return user as MailboxUser & { email: string };
}
export function checkConfig(config: ConnectionConfig) {
  if (!config.clientId || !config.clientSecret || !config.encryptionKey) throw new MailboxError('MAILBOX_NOT_CONFIGURED');
  let callback: URL;
  try { callback = new URL(config.callback); } catch { throw new MailboxError('MAILBOX_NOT_CONFIGURED'); }
  if (callback.protocol !== 'https:' || callback.search || callback.hash || callback.username || callback.password) {
    throw new MailboxError('MAILBOX_NOT_CONFIGURED');
  }
  if (unb64(config.encryptionKey).length !== 32) throw new MailboxError('INVALID_ENCRYPTION_KEY');
}
async function encryptionKey(value: string) {
  const bytes = unb64(value);
  if (bytes.length !== 32) throw new MailboxError('INVALID_ENCRYPTION_KEY');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function seal(value: string, key: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, await encryptionKey(key), encoder.encode(value));
  return `v1.${b64(iv)}.${b64(new Uint8Array(ciphertext))}`;
}
export async function unseal(value: string, key: string, context: string) {
  const [version, iv, ciphertext, extra] = value.split('.');
  if (version !== 'v1' || !iv || !ciphertext || extra) throw new MailboxError('INVALID_CIPHERTEXT');
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: encoder.encode(context) }, await encryptionKey(key), unb64(ciphertext)));
  } catch { throw new MailboxError('INVALID_CIPHERTEXT'); }
}
