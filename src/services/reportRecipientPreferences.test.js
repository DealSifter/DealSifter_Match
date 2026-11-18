// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadReportRecipientPreferences, saveReportRecipientPreferences } from './reportRecipientPreferences';
import { normalizeUserPreferences } from '../domain/profile/userPreferences';
const m = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({ supabase: { auth: { getUser: m.auth }, from: m.from } }));
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  m.auth.mockResolvedValue({ data: { user: { id: 'a', email: 'qa-a@example.invalid' } } });
  const chain = { select: m.select, eq: m.eq, maybeSingle: m.maybeSingle, update: m.update };
  for (const fn of [m.from, m.select, m.eq, m.update]) fn.mockReturnValue(chain);
  m.maybeSingle.mockResolvedValue({ data: { profile_payload: { resolved: { personal: { email: 'profile-sender@gmail.com' } } }, settings_payload: { userPreferences: { reportEmailRecipients: { to: 'board@trello.example.invalid', cc: '', bcc: '' } } } } });
});
describe('registered report email recipients, not the sender account', () => {
  it('loads existing account recipients before requesting another and gets sender from the saved active profile, not auth', async () => {
    const account = await loadReportRecipientPreferences('a');
    expect(account.recipients.to).toBe('board@trello.example.invalid'); expect(account.senderEmail).toBe('profile-sender@gmail.com');
    expect(m.eq).toHaveBeenCalledWith('id', 'a');
  });
  it('rejects account mismatch without reading preferences', async () => {
    await expect(loadReportRecipientPreferences('b')).rejects.toThrow('UNAUTHORIZED'); expect(m.from).not.toHaveBeenCalled();
  });
  it('recovers an owned browser legacy address when no account preference exists', async () => {
    m.maybeSingle.mockResolvedValue({ data: { settings_payload: {} } });
    localStorage.setItem('userProfile', JSON.stringify({ id: 'a' })); localStorage.setItem('ds_export_mail_defaults', JSON.stringify({ to: 'old-board@trello.example.invalid' }));
    expect((await loadReportRecipientPreferences('a')).recipients.to).toBe('old-board@trello.example.invalid');
  });
  it('does not import an address owned by another account or an unowned browser value', async () => {
    m.maybeSingle.mockResolvedValue({ data: { settings_payload: {} } });
    localStorage.setItem('userProfile', JSON.stringify({ id: 'b' })); localStorage.setItem('ds_export_mail_defaults', JSON.stringify({ userId: 'b', to: 'b@example.invalid' }));
    expect((await loadReportRecipientPreferences('a')).recipients).toBeNull();
    localStorage.removeItem('userProfile'); localStorage.setItem('ds_export_mail_defaults', JSON.stringify({ to: 'unknown@example.invalid' }));
    expect((await loadReportRecipientPreferences('a')).recipients).toBeNull();
  });
  it('saves in existing private account preferences and preserves other settings', async () => {
    m.maybeSingle.mockResolvedValueOnce({ data: { settings_payload: { version: 3, untouched: 'keep', userPreferences: { privacy: { readReceipts: false } } } } }).mockResolvedValueOnce({ data: { id: 'a' } });
    await saveReportRecipientPreferences('a', { to: 'board@example.invalid', cc: '', bcc: '' });
    expect(m.update).toHaveBeenCalledWith({ settings_payload: { version: 3, untouched: 'keep', userPreferences: { privacy: { readReceipts: false }, reportEmailRecipients: { to: 'board@example.invalid', cc: '', bcc: '' } } } });
    expect(JSON.parse(localStorage.getItem('ds_export_mail_defaults')).userId).toBe('a');
  });
  it('does not claim a preference was saved when RLS denies the update', async () => {
    m.maybeSingle.mockResolvedValueOnce({ data: { settings_payload: {} } }).mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    await expect(saveReportRecipientPreferences('a', { to: 'qa@example.invalid' })).rejects.toThrow('SAVE_FAILED'); expect(localStorage.getItem('ds_export_mail_defaults')).toBeNull();
  });
  it('normalization preserves registered addresses through ordinary settings saves', () => {
    const value = normalizeUserPreferences({ reportEmailRecipients: { to: 'board@example.invalid', cc: 'copy@example.invalid', bcc: '' } });
    expect(normalizeUserPreferences(value).reportEmailRecipients).toEqual(value.reportEmailRecipients);
  });
});
