import { describe, expect, it } from 'vitest';
import { canUsePlanAction, getPlan, isFeatureAllowed } from './planUsageService';

describe('planUsageService plan gates', () => {
  it('allows chat immediately after a realtime plan upgrade snapshot changes from free to pro', () => {
    const beforeRealtimeUpgrade = canUsePlanAction({ planId: 'free' }, 'chat');
    const afterRealtimeUpgrade = canUsePlanAction({ planId: 'pro' }, 'chat');

    expect(beforeRealtimeUpgrade.allowed).toBe(false);
    expect(afterRealtimeUpgrade.allowed).toBe(true);
  });

  it('keeps PDF export behind paid plan gates', () => {
    expect(canUsePlanAction({ planId: 'free' }, 'export_pdf').allowed).toBe(false);
    expect(canUsePlanAction({ planId: 'pro' }, 'export_pdf').allowed).toBe(true);
  });

  it('treats admin as unrestricted for every commercial feature gate', () => {
    const heavyUsage = {
      swipesToday: 999,
      likesToday: 999,
      unlocksThisMonth: 999,
      activeMatches: 999,
    };

    expect(getPlan('admin').limits.swipesPerDay).toBeNull();
    expect(getPlan('admin').limits.unlockRequestsPerMonth).toBeNull();
    expect(isFeatureAllowed({ planId: 'admin' }, 'chat')).toBe(true);
    expect(isFeatureAllowed({ planId: 'admin' }, 'export_pdf')).toBe(true);
    expect(isFeatureAllowed({ planId: 'admin' }, 'spotlight')).toBe(true);
    expect(isFeatureAllowed({ planId: 'admin' }, 'exclusivity')).toBe(true);

    ['swipe', 'like', 'match', 'unlock', 'chat', 'export_pdf', 'spotlight', 'exclusivity'].forEach((action) => {
      expect(canUsePlanAction({ planId: 'admin' }, action, heavyUsage).allowed).toBe(true);
    });
  });
});
