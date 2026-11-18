import { MailboxError, type MailboxUser } from './connectionSecurity.ts';

export type SenderProfile = { scope: 'personal' | 'professional' | 'fsbo'; email: string };
export function senderProfileScope(scope: unknown = 'personal'): SenderProfile['scope'] {
  if (scope === 'personal' || scope === 'professional' || scope === 'fsbo') return scope;
  throw new MailboxError('INVALID_SENDER_PROFILE');
}
export function resolveSenderProfile(payload: any, scopeInput: unknown = 'personal'): SenderProfile {
  const scope = senderProfileScope(scopeInput);
  const resolved = payload?.resolved?.[scope];
  const profile = payload?.profiles?.[scope];
  // An explicitly cleared canonical email stays empty; never borrow another
  // profile's email or the authentication email.
  const raw = resolved && Object.hasOwn(resolved, 'email') ? resolved.email
    : profile && Object.hasOwn(profile, 'email') ? profile.email
      : scope === 'professional' ? (profile?.emailB ?? payload?.legacy?.professionalProfile?.emailB)
        : scope === 'fsbo' ? (profile?.emailFsbo ?? profile?.fsboEmail ?? payload?.legacy?.personalProfile?.emailFsbo ?? payload?.legacy?.personalProfile?.fsboEmail)
          : payload?.legacy?.professionalProfile?.emailA;
  const email = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return { scope, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '' };
}
export async function readSenderProfile(client: any, userId: string, scope: unknown = 'personal'): Promise<SenderProfile> {
  senderProfileScope(scope);
  const { data, error } = await client.from('professional_profiles').select('profile_payload').eq('user_id', userId).maybeSingle();
  if (error) throw new MailboxError('SENDER_PROFILE_UNAVAILABLE');
  return resolveSenderProfile(data?.profile_payload, scope);
}
export function requireGmailProfile(user: MailboxUser): SenderProfile {
  const profile = user.senderProfile;
  if (!profile?.email) throw new MailboxError('PROFILE_EMAIL_REQUIRED');
  senderProfileScope(profile.scope);
  if (!/^[^\s@]+@(gmail|googlemail)\.com$/i.test(profile.email)) throw new MailboxError('GMAIL_PROFILE_REQUIRED');
  return { scope: profile.scope, email: profile.email.trim().toLowerCase() };
}
