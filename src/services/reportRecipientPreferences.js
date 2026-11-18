import { supabase } from '../lib/supabaseClient';
import { normalizeReportEmailPreferences } from '../domain/profile/reportEmailPreferences';
import { readSenderProfile } from '../../supabase/functions/_shared/mailbox/senderProfile.ts';

async function accountSettings(expectedUserId) {
  if (!supabase) throw new Error('REPORT_RECIPIENT_PREFERENCES_UNAVAILABLE');
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user?.id || (expectedUserId && user.id !== expectedUserId)) throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
  const result = await supabase.from('users').select('settings_payload').eq('id', user.id).maybeSingle();
  if (result.error || !result.data) throw new Error('REPORT_RECIPIENT_PREFERENCES_UNAVAILABLE');
  return { user, settings: result.data.settings_payload || {} };
}

function ownedLegacyRecipients(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem('ds_export_mail_defaults') || 'null');
    if (!saved) return null;
    const profile = JSON.parse(localStorage.getItem('userProfile') || 'null');
    // Never claim a global, unowned browser preference for a different account.
    const owner = saved.userId || profile?.userId || profile?.user_id || profile?.id;
    return owner === userId ? normalizeReportEmailPreferences(saved) : null;
  } catch { return null; }
}

export async function loadReportRecipientPreferences(expectedUserId, profileScope = 'personal') {
  const { user, settings } = await accountSettings(expectedUserId);
  const sender = await readSenderProfile(supabase, user.id, profileScope);
  const current = await supabase.auth.getUser();
  if (current.error || current.data?.user?.id !== user.id) throw new Error('REPORT_DELIVERY_UNAUTHORIZED');
  const saved = normalizeReportEmailPreferences(settings.userPreferences?.reportEmailRecipients);
  const legacy = saved ? null : ownedLegacyRecipients(user.id);
  return { userId: user.id, senderEmail: sender.email, profileScope: sender.scope, recipients: saved || legacy,
    source: saved ? 'ACCOUNT' : legacy ? 'OWNED_BROWSER_LEGACY' : 'NONE' };
}

export async function saveReportRecipientPreferences(userId, recipients) {
  const { user, settings } = await accountSettings(userId);
  const normalized = normalizeReportEmailPreferences(recipients);
  if (!normalized) throw new Error('REPORT_RECIPIENT_SAVE_FAILED');
  const { data, error } = await supabase.from('users').update({ settings_payload: {
    ...settings, userPreferences: { ...(settings.userPreferences || {}), reportEmailRecipients: normalized },
  } }).eq('id', user.id).select('id').maybeSingle();
  if (error || data?.id !== user.id) throw new Error('REPORT_RECIPIENT_SAVE_FAILED');
  // Keep the existing settings editor in sync, so its next save retains this preference.
  window.dispatchEvent(new CustomEvent('dealsifter.reportRecipientsSaved', { detail: { userId: user.id, recipients: normalized } }));
  try { localStorage.setItem('ds_export_mail_defaults', JSON.stringify({ userId: user.id, ...normalized })); } catch { /* Server is authoritative. */ }
  return normalized;
}
