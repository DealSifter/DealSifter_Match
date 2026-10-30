import { resolveScopedProfile } from './profileScopeResolver';

// Only the profile currently edited by this onboarding branch receives its draft.
export function resolveOnboardingPreviewProfile(scope, { accountType, personalProfile, professionalProfile, primaryDraft = {}, professionalDraft = {} }) {
  const saved = resolveScopedProfile(scope, {accountType, personalProfile, professionalProfile});
  const primaryScope = accountType === 'fsbo_owner' ? 'fsbo' : 'personal';
  const draft = scope === primaryScope ? primaryDraft : scope === 'professional' && accountType === 'professional' ? professionalDraft : {};
  return {...saved, ...draft, scope};
}
