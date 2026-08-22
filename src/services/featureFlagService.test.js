import { describe, expect, it } from 'vitest';
import { deterministicCohort, resolveFeatureFlags } from '../../supabase/functions/_shared/featureFlags';
import { isFeatureEnabled, normalizeFeatureFlagResponse, OFF_FEATURE_FLAGS } from './featureFlagService';

describe('controlled feature rollout', () => {
  it('keeps future flags off by default and enables the neutral staging probe', () => {
    const flags = resolveFeatureFlags({ userId: 'user-a', environment: 'staging' });
    expect(flags.platform_readiness_probe).toBe(true);
    expect(flags.maxxis_next_generation).toBe(false);
    expect(flags.maxxis_proactive_insights).toBe(false);
  });

  it('supports server-approved staging overrides but ignores unapproved overrides', () => {
    expect(resolveFeatureFlags({ userId: 'user-a', environment: 'staging', overrides: { new_feed_experience: true }, allowOverride: true }).new_feed_experience).toBe(true);
    expect(resolveFeatureFlags({ userId: 'user-a', environment: 'staging', overrides: { maxxis_proactive_insights: true }, allowOverride: true }).maxxis_proactive_insights).toBe(true);
    expect(resolveFeatureFlags({ userId: 'user-a', environment: 'production', overrides: { new_feed_experience: true }, allowOverride: false }).new_feed_experience).toBe(false);
  });

  it('assigns stable cohorts and distributes different users deterministically', () => {
    expect(deterministicCohort('stable-user', 'new_feed_experience')).toBe(deterministicCohort('stable-user', 'new_feed_experience'));
    const cohorts = new Set(Array.from({ length: 40 }, (_, index) => deterministicCohort(`user-${index}`, 'new_feed_experience')));
    expect(cohorts.size).toBeGreaterThan(20);
  });

  it('fails closed on invalid config and cannot enable unknown client flags', () => {
    const snapshot = normalizeFeatureFlagResponse({ source: 'client', flags: { maxxis_next_generation: true, hidden_bypass: true } });
    expect(snapshot.flags).toEqual(OFF_FEATURE_FLAGS);
    expect(isFeatureEnabled(snapshot, 'maxxis_next_generation')).toBe(false);
    expect(isFeatureEnabled(snapshot, 'hidden_bypass')).toBe(false);
  });
});
