// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const client = vi.hoisted(() => ({ auth: { getUser: vi.fn() }, functions: { invoke: vi.fn() } }));
vi.mock('../lib/supabaseClient', () => ({ supabase: client }));
import { authorizeReportMailbox, readReportMailbox, disconnectReportMailbox, sendPreparedReportEmail } from './reportMailboxService';
beforeEach(() => {
  vi.resetAllMocks();
  client.auth.getUser.mockResolvedValue({ data: { user: { id: 'qa-a' } } });
  client.functions.invoke.mockResolvedValue({ data: { status: 'DISCONNECTED' } });
});
it('requires explicit consent before any backend call', async () => {
  await expect(authorizeReportMailbox('qa-a', false)).rejects.toThrow('EXPLICIT_CONSENT_REQUIRED');
  expect(client.auth.getUser).not.toHaveBeenCalled();
  expect(client.functions.invoke).not.toHaveBeenCalled();
});
it('rejects another account without querying its connection', async () => {
  await expect(readReportMailbox('qa-b')).rejects.toThrow('MAILBOX_AUTHENTICATION_REQUIRED');
  expect(client.functions.invoke).not.toHaveBeenCalled();
});
it('does not accept cached metadata across an account switch', async () => {
  client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'qa-a' } } }).mockResolvedValueOnce({ data: { user: { id: 'qa-b' } } });
  await expect(readReportMailbox('qa-a')).rejects.toThrow('MAILBOX_AUTHENTICATION_REQUIRED');
});
it('does not claim connection when the endpoint is absent', async () => {
  client.functions.invoke.mockResolvedValue({ error: new Error('not deployed') });
  await expect(readReportMailbox('qa-a')).rejects.toThrow('MAILBOX_CONNECTION_UNAVAILABLE');
});
it('rejects a substituted external authorization URL', async () => {
  client.functions.invoke.mockResolvedValue({ data: { authorizationUrl: 'https://other.example.invalid/authorize' } });
  await expect(authorizeReportMailbox('qa-a', true)).rejects.toThrow('MAILBOX_AUTHORIZATION_URL_INVALID');
});
it('does not authorize the suspended Microsoft provider', async () => {
  client.functions.invoke.mockResolvedValue({ data: { authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?code_challenge_method=S256' } });
  await expect(authorizeReportMailbox('qa-a', true)).rejects.toThrow('MAILBOX_AUTHORIZATION_URL_INVALID');
});
it('returns only a valid Google PKCE URL after consent', async () => {
  const authorizationUrl = 'https://accounts.google.com/o/oauth2/v2/auth?code_challenge_method=S256';
  client.functions.invoke.mockResolvedValue({ data: { authorizationUrl } });
  expect(await authorizeReportMailbox('qa-a', true)).toEqual({ authorizationUrl });
  expect(client.functions.invoke).toHaveBeenCalledWith('report-mailbox-oauth/start', { body: { consent: true } });
});
it('disconnects through the authenticated endpoint without changing app login', async () => {
  expect(await disconnectReportMailbox('qa-a')).toEqual({ status: 'DISCONNECTED' });
  expect(client.functions.invoke).toHaveBeenCalledWith('report-mailbox-oauth/disconnect', { body: {} });
});
it('requires explicit send confirmation and matching report ownership', async () => {
  await expect(sendPreparedReportEmail('qa-a', { reference: { userId: 'qa-b' }, confirmSend: true })).rejects.toThrow('EXPLICIT_SEND_CONFIRMATION_REQUIRED');
  expect(client.functions.invoke).not.toHaveBeenCalled();
});
it('sends only the reviewed envelope through the delivery endpoint', async () => {
  const payload = { reference: { userId: 'qa-a' }, confirmSend: true, pdfBase64: 'fixture' };
  client.functions.invoke.mockResolvedValue({ data: { state: 'ACCEPTED' } });
  expect(await sendPreparedReportEmail('qa-a', payload)).toEqual({ state: 'ACCEPTED' });
  expect(client.functions.invoke).toHaveBeenCalledWith('report-mail-delivery', { body: payload });
});
it('does not disclose delivery results across an account switch', async () => {
  client.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'qa-a' } } }).mockResolvedValueOnce({ data: { user: { id: 'qa-b' } } });
  await expect(sendPreparedReportEmail('qa-a', { reference: { userId: 'qa-a' }, confirmSend: true })).rejects.toThrow('MAILBOX_AUTHENTICATION_REQUIRED');
});
