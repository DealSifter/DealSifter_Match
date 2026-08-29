import { describe, expect, it } from 'vitest';
import { guideTipsEnabledKey, resolveGuideTipsActivation } from './guideTipsActivation';

describe('GuideTips activation', () => {
  it('requires the guide only when the hydrated account has no valid profile', () => {
    expect(resolveGuideTipsActivation({ canStart: true, isAuthenticated: true, hasValidProfile: false })).toMatchObject({
      mandatory: true,
      enabled: true,
      activeTour: 'initial',
    });
  });

  it('does not reopen on login when a valid profile exists', () => {
    expect(resolveGuideTipsActivation({
      canStart: true,
      isAuthenticated: true,
      hasValidProfile: true,
      manuallyEnabled: false,
      pageTour: 'feed',
    })).toEqual({ mandatory: false, enabled: false, activeTour: 'feed' });
  });

  it('reopens for a valid profile only when the user manually enabled it', () => {
    expect(resolveGuideTipsActivation({
      canStart: true,
      isAuthenticated: true,
      hasValidProfile: true,
      manuallyEnabled: true,
      pageTour: 'matches',
    })).toEqual({ mandatory: false, enabled: true, activeTour: 'matches' });
  });

  it('never starts while the user is not authenticated even if stale flags exist', () => {
    expect(resolveGuideTipsActivation({
      canStart: true,
      isAuthenticated: false,
      hasValidProfile: false,
      manuallyEnabled: true,
      pageTour: 'feed',
    })).toEqual({ mandatory: false, enabled: false, activeTour: 'feed' });
  });

  it('never starts on public/auth surfaces', () => {
    expect(resolveGuideTipsActivation({
      canStart: true,
      isAuthenticated: true,
      isProtectedSurface: false,
      hasValidProfile: false,
      manuallyEnabled: true,
      pageTour: 'feed',
    })).toEqual({ mandatory: false, enabled: false, activeTour: 'feed' });
  });

  it('scopes the manual preference to each authenticated user', () => {
    expect(guideTipsEnabledKey('user-a')).toBe('ds_guidetips_enabled:user-a');
    expect(guideTipsEnabledKey('user-b')).toBe('ds_guidetips_enabled:user-b');
  });
});
