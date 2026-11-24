// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveReportSenderScope } from './reportSenderScope';
import { buildScopedProfilePayload } from '../lib/profileScopeResolver';
import { resolveSenderProfile, requireGmailProfile } from '../../supabase/functions/_shared/mailbox/senderProfile';

describe('report sender identity before opening onboarding', () => {
  const profile = { fullNameB: 'Synthetic business', emailA: '', emailB: 'synthetic@gmail.com', cardPriorityB: 'primary' };
  it('uses the saved primary business Gmail on first opening and after reload without resaving', () => {
    const input = { accountType: 'professional', professionalProfile: profile };
    const payload = buildScopedProfilePayload(input);
    for (const snapshot of [input, JSON.parse(JSON.stringify(input))]) {
      const scope = resolveReportSenderScope(snapshot);
      expect(scope).toBe('professional');
      expect(requireGmailProfile({ id: 'owner', email: 'login@hotmail.com', senderProfile: resolveSenderProfile(payload, scope) }).email).toBe('synthetic@gmail.com');
    }
  });
  it('respects an explicit personal selection, including an empty email, without borrowing the business Gmail', () => {
    const input = { accountType: 'professional', professionalProfile: profile, selectedScope: 'personal' };
    expect(resolveReportSenderScope(input)).toBe('personal');
    expect(resolveSenderProfile(buildScopedProfilePayload(input), resolveReportSenderScope(input)).email).toBe('');
  });
  it('does not choose a different profile just because it has a Gmail address', () => {
    const input = { accountType: 'professional', professionalProfile: { ...profile, emailA: 'personal@hotmail.com', cardPriorityA: 'primary', cardPriorityB: '' } };
    expect(resolveReportSenderScope(input)).toBe('personal');
  });
  it('supports FSBO and a deliberate business selection in that account', () => {
    expect(resolveReportSenderScope({ accountType: 'fsbo_owner', personalProfile: { cardPriorityC: 'primary' } })).toBe('fsbo');
    expect(resolveReportSenderScope({ accountType: 'fsbo_owner', selectedScope: 'professional' })).toBe('professional');
  });
  it('keeps the previous default when no primary identity is registered', () => {
    expect(resolveReportSenderScope({ accountType: 'professional' })).toBe('personal');
    expect(resolveReportSenderScope({ accountType: 'fsbo_owner', selectedScope: 'personal' })).toBe('fsbo');
  });
});
