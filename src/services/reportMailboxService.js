import { supabase } from '../lib/supabaseClient';

async function mailboxAction(userId, action, body = {}) {
  if (!supabase || !userId) throw new Error('MAILBOX_AUTHENTICATION_REQUIRED');
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || auth?.user?.id !== userId) throw new Error('MAILBOX_AUTHENTICATION_REQUIRED');
  const result = await supabase.functions.invoke(`report-mailbox-oauth/${action}`, { body });
  if (result.error || !result.data || result.data.code) throw new Error(result.data?.code || 'MAILBOX_CONNECTION_UNAVAILABLE');
  // An account switch while the request was in flight must not disclose another user's metadata.
  const current = await supabase.auth.getUser();
  if (current.error || current.data?.user?.id !== userId) throw new Error('MAILBOX_AUTHENTICATION_REQUIRED');
  return result.data;
}
export const readReportMailbox = userId => mailboxAction(userId, 'status');
export const disconnectReportMailbox = userId => mailboxAction(userId, 'disconnect');
export async function sendPreparedReportEmail(userId, payload) {
  if (!supabase || payload?.reference?.userId !== userId || payload.confirmSend !== true) throw new Error('EXPLICIT_SEND_CONFIRMATION_REQUIRED');
  const { data, error } = await supabase.auth.getUser();
  if (error || data?.user?.id !== userId) throw new Error('MAILBOX_AUTHENTICATION_REQUIRED');
  const result = await supabase.functions.invoke('report-mail-delivery', { body: payload });
  if (result.error || !result.data || result.data.code) throw new Error(result.data?.code || 'REPORT_MAIL_DELIVERY_UNAVAILABLE');
  const current = await supabase.auth.getUser();
  if (current.error || current.data?.user?.id !== userId) throw new Error('MAILBOX_AUTHENTICATION_REQUIRED');
  return result.data;
}
export async function authorizeReportMailbox(userId, consent) {
  if (consent !== true) throw new Error('EXPLICIT_CONSENT_REQUIRED');
  const result = await mailboxAction(userId, 'start', { consent: true });
  const url = new URL(result.authorizationUrl);
  if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth' ||
    url.searchParams.get('code_challenge_method') !== 'S256') throw new Error('MAILBOX_AUTHORIZATION_URL_INVALID');
  return result;
}
