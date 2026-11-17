import { createClient } from 'npm:@supabase/supabase-js@2';
import { beginConnection, finishConnection, MailboxError, type MailboxStore } from '../_shared/mailbox/googleConnection.ts';
import { buildCorsHeaders, parseAllowedOrigins } from '../_shared/maxxis/corsPolicy.ts';

// Gmail-only candidate. Gateway verify_jwt=false is required for Google's callback;
// every other route performs getUser(JWT) itself. Do not deploy before schema/config review.
const url = Deno.env.get('SUPABASE_URL') || '';
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const origins = parseAllowedOrigins(Deno.env.get('MAILBOX_ALLOWED_ORIGINS') || '');
const config = {
  clientId: Deno.env.get('MAIL_GOOGLE_CLIENT_ID') || '',
  clientSecret: Deno.env.get('MAIL_GOOGLE_CLIENT_SECRET') || '',
  encryptionKey: Deno.env.get('MAIL_TOKEN_ENCRYPTION_KEY') || '',
  callback: `${url}/functions/v1/report-mailbox-oauth/callback`,
};
const store: MailboxStore = {
  async putState(hash, state) {
    const { error } = await admin.from('report_mailbox_oauth_states').insert({ state_hash: hash, ...state });
    if (error) throw new MailboxError('MAILBOX_STORAGE_UNAVAILABLE');
  },
  async consumeState(hash) {
    const { data, error } = await admin.from('report_mailbox_oauth_states').update({ claimed_at: new Date().toISOString() })
      .eq('state_hash', hash).is('claimed_at', null)
      .select('user_id,verifier_encrypted,expires_at').maybeSingle();
    if (error) throw new MailboxError('MAILBOX_STORAGE_UNAVAILABLE');
    return data;
  },
  async getUser(id) {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error) throw new MailboxError('ACCOUNT_UNAVAILABLE');
    return data.user;
  },
  async saveConnection(hash, connection) {
    const { error } = await admin.rpc('ds_complete_mailbox_connection', { p_state_hash: hash, p_connection: connection });
    if (error) throw new MailboxError('MAILBOX_STORAGE_UNAVAILABLE');
  },
};
const messages: Record<string, string> = {
  GMAIL_ACCOUNT_REQUIRED: 'Use uma conta DealSifter com email Gmail confirmado para conectar a caixa.',
  MAILBOX_EMAIL_MISMATCH: 'A caixa autorizada deve ter o mesmo email confirmado da sua conta DealSifter. Reconecte usando essa caixa.',
  CONFIRM_ACCOUNT_EMAIL: 'Confirme o email da sua conta DealSifter antes de conectar a caixa.',
  INVALID_OR_EXPIRED_CONSENT: 'Esta autorização expirou ou já foi utilizada. Inicie uma nova conexão no DealSifter.',
  CONSENT_NOT_GRANTED: 'A conexão não foi autorizada. Nenhuma mensagem foi enviada.',
};
function callbackPage(message: string, status: number) {
  // Only constant, server-owned messages. No query/provider content is interpolated.
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DealSifter — Caixa postal</title><p>${message}</p><p>Feche esta aba e volte ao DealSifter.</p></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" },
  });
}
Deno.serve(async request => {
  const path = new URL(request.url);
  const origin = request.headers.get('origin') || '';
  const headers = { ...buildCorsHeaders(origin, origins), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (path.pathname.endsWith('/callback')) {
    // Google's web-server callback uses query parameters. Never log the request URL,
    // code or state. Responses prevent caching/referrer propagation.
    if (request.method !== 'GET') return callbackPage('Método inválido.', 405);
    try {
      await finishConnection({ state: path.searchParams.get('state') || '', code: path.searchParams.get('code') || undefined,
        error: path.searchParams.get('error') || undefined }, config, store, fetch);
      return callbackPage('Caixa conectada. Nenhuma mensagem foi enviada.', 200);
    } catch (error) {
      const code = error instanceof MailboxError ? error.code : 'MAILBOX_CONNECTION_FAILED';
      return callbackPage(messages[code] || 'Não foi possível conectar a caixa. Tente novamente no DealSifter.', 400);
    }
  }
  if (!origins.includes(origin)) return json({ code: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405);
  const bearer = request.headers.get('authorization') || '';
  if (!bearer.startsWith('Bearer ')) return json({ code: 'AUTHENTICATION_REQUIRED' }, 401);
  const { data: auth, error: authError } = await admin.auth.getUser(bearer.slice(7));
  if (authError || !auth.user) return json({ code: 'AUTHENTICATION_REQUIRED' }, 401);
  try {
    if (path.pathname.endsWith('/start')) {
      const input = await request.json();
      if (input.consent !== true) return json({ code: 'EXPLICIT_CONSENT_REQUIRED' }, 400);
      // Clear expired states and replace previous pending authorizations only for this account.
      const { error } = await admin.from('report_mailbox_oauth_states').delete().eq('user_id', auth.user.id);
      if (error) throw new MailboxError('MAILBOX_STORAGE_UNAVAILABLE');
      return json(await beginConnection(auth.user, config, store));
    }
    if (path.pathname.endsWith('/status')) {
      const { data, error } = await admin.from('report_mailbox_connections')
        .select('provider,mailbox_email,connected_at,expires_at').eq('user_id', auth.user.id).eq('provider', 'google').maybeSingle();
      if (error) throw new MailboxError('MAILBOX_STORAGE_UNAVAILABLE');
      if (data && (!auth.user.email_confirmed_at || data.mailbox_email !== auth.user.email?.trim().toLowerCase())) {
        return json({ status: 'RECONNECT_REQUIRED' });
      }
      return json(data ? { ...data, status: Date.parse(data.expires_at) > Date.now() ? 'CONNECTED' : 'EXPIRED' } : { status: 'DISCONNECTED' });
    }
    if (path.pathname.endsWith('/disconnect')) {
      const { error: stateError } = await admin.from('report_mailbox_oauth_states').delete().eq('user_id', auth.user.id);
      if (stateError) throw new MailboxError('MAILBOX_STORAGE_UNAVAILABLE');
      const { error } = await admin.from('report_mailbox_connections').delete().eq('user_id', auth.user.id).eq('provider', 'google');
      if (error) throw new MailboxError('MAILBOX_STORAGE_UNAVAILABLE');
      return json({ status: 'DISCONNECTED', providerConsentRevoked: false });
    }
    return json({ code: 'NOT_FOUND' }, 404);
  } catch (error) {
    // Never serialize SDK/provider errors: they may contain sensitive response material.
    const code = error instanceof MailboxError ? error.code : 'MAILBOX_CONNECTION_FAILED';
    return json({ code, message: messages[code] || 'Não foi possível conectar a caixa. Tente novamente mais tarde.' }, 400);
  }
});
