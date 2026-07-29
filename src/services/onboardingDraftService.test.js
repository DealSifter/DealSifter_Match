import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildOnboardingDraftKey,
  clearOnboardingDraft,
  readOnboardingDraft,
  writeOnboardingDraft,
} from './onboardingDraftService';

describe('onboardingDraftService', () => {
  let values;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps drafts isolated by user and account type', () => {
    writeOnboardingDraft('user-a', 'professional', { name: 'A' });
    writeOnboardingDraft('user-a', 'fsbo_owner', { name: 'B' });
    writeOnboardingDraft('user-b', 'professional', { name: 'C' });

    expect(readOnboardingDraft('user-a', 'professional')).toEqual({ name: 'A' });
    expect(readOnboardingDraft('user-a', 'fsbo_owner')).toEqual({ name: 'B' });
    expect(readOnboardingDraft('user-b', 'professional')).toEqual({ name: 'C' });
  });

  it('clears only the completed branch draft', () => {
    writeOnboardingDraft('user-a', 'professional', { portfolioAddress: 'Main St' });
    writeOnboardingDraft('user-a', 'fsbo_owner', { portfolioAddress: 'Oak St' });

    clearOnboardingDraft('user-a', 'professional');

    expect(readOnboardingDraft('user-a', 'professional')).toBeNull();
    expect(readOnboardingDraft('user-a', 'fsbo_owner')).toEqual({ portfolioAddress: 'Oak St' });
  });

  it('uses a stable namespaced key', () => {
    expect(buildOnboardingDraftKey('user-a', 'professional'))
      .toBe('ds_onboarding_draft_v1:user-a:professional');
  });
});
