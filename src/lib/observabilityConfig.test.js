import { describe, expect, it } from 'vitest';
import config from '../../config/observability.json';

describe('observability SLO configuration', () => {
  it('defines every launch-critical SLI with measurable targets', () => {
    const expected = ['AUTH', 'FEED', 'MAXXIS', 'STRIPE', 'UNLOCK', 'MESSAGING'];
    expect(config.slis.map((sli) => sli.id)).toEqual(expected);
    config.slis.forEach((sli) => {
      expect(sli.success_rate_percent).toBeGreaterThan(0);
      expect(sli.p95_latency_ms).toBeGreaterThan(0);
      expect(sli.max_error_rate_percent).toBeGreaterThanOrEqual(0);
      expect(sli.signals.length).toBeGreaterThan(0);
    });
  });

  it('keeps replay disabled and declares actionable alert routing', () => {
    expect(config.sampling.session_replay).toBe(0);
    expect(config.alerts.length).toBeGreaterThanOrEqual(6);
    config.alerts.forEach((alert) => {
      expect(['WARNING', 'HIGH', 'CRITICAL']).toContain(alert.severity);
      expect(alert.window_minutes).toBeGreaterThan(0);
      expect(alert.frequency_minutes).toBeGreaterThan(0);
      expect(alert.channel).toMatch(/^(sentry|github_actions)$/);
    });
  });
});
