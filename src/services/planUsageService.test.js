import { describe, expect, it } from 'vitest';
import { canUsePlanAction } from './planUsageService';

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
});
