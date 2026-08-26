import { describe, expect, it, vi } from 'vitest';
import { MAXXIS_EXPERIENCE_MODES } from '../orchestration/maxxisExperienceTypes';
import {
  buildMaxxisMessageCompositionBridge,
  composeMaxxisExperience,
  MAXXIS_COMPOSITION_LIMITS,
  safeMaxxisCompositionAnalytics,
} from './maxxisExperienceComposer';

const action = (code, label = code, extra = {}) => ({ code, label, enabled: true, semanticKey: code, ...extra });
const decision = (mode, extra = {}) => ({
  mode,
  primaryContent: { type: 'CONTEXT' },
  secondaryContent: [],
  primaryAction: null,
  secondaryActions: [],
  ...extra,
});
const compose = (mode, extra = {}) => composeMaxxisExperience({ decision: decision(mode, extra.decision), language: extra.language || 'en', facts: extra.facts, followUps: extra.followUps, density: extra.density });

describe('Maxxis Deal AI Contextual Experience Composer', () => {
  it('1. PASSIVE renders nothing', () => {
    const result = compose('PASSIVE');
    expect(result).toMatchObject({ status: 'COMPOSED', headline: '', presentationHints: { render: false } });
  });

  it('2. CONTEXTUAL composes available property context', () => {
    expect(compose('CONTEXTUAL', { facts: { property: { beds: 3, type: 'property', city: 'Dallas', state: 'TX' } } }).summary).toContain('3-bed');
  });

  it('3. ANALYSIS prioritizes the current review and missing data', () => {
    const result = compose('ANALYSIS', { facts: { property: { city: 'Dallas' }, missingItems: ['Rehab cost'] } });
    expect(result.summary).toContain('missing');
    expect(result.statusItems).toEqual(['Rehab cost']);
  });

  it('4. CHANGE_REVIEW presents one change narrative', () => {
    const result = compose('CHANGE_REVIEW', { facts: { changes: ['Provider replied'], openItems: ['Verify rehab'] } });
    expect(result.headline).toBe('Something changed.');
    expect(result.summary.match(/changed/gi)).toHaveLength(1);
  });

  it('5. PROVIDER_REVIEW protects locked contact details', () => {
    const result = compose('PROVIDER_REVIEW', { facts: { provider: { replied: true, locked: true, email: 'hidden@example.com' } } });
    expect(result.summary).toContain('protected');
    expect(JSON.stringify(result)).not.toContain('hidden@example.com');
  });

  it('6. ACTION_PREPARATION states that nothing happened', () => {
    expect(compose('ACTION_PREPARATION').summary).toContain('Nothing will happen');
  });

  it('7. ACTION_CONFIRMATION prioritizes consequence', () => {
    const result = compose('ACTION_CONFIRMATION', { facts: { action: { code: 'UNLOCK_PROVIDER_CONTACT', nuggetCost: 5 } } });
    expect(result.summary).toContain('5 Nuggets');
    expect(result.presentationHints.density).toBe('COMPACT');
  });

  it('8. ACTION_RESULT is concise', () => {
    const result = compose('ACTION_RESULT', { facts: { action: { code: 'SEND_PROVIDER_MESSAGE', status: 'SUCCESS' } } });
    expect(result.summary).toContain('provider can now reply');
  });

  it('9. MEMORY_RECALL combines resume, change and open item', () => {
    const result = compose('MEMORY_RECALL', { facts: { changes: ['Provider replied'], openItems: ['Rehab quote'] } });
    expect(result.summary).toContain('continuity');
    expect(result.statusItems).toEqual(['Provider replied', 'Rehab quote']);
  });

  it('10. COMPARISON explains trade-offs without a winner', () => {
    const result = compose('COMPARISON', { facts: { comparison: ['A has lower price', 'B has lower rehab'] } });
    expect(result.summary).toContain('not selecting a winner');
    expect(result.summary).not.toMatch(/\bbuy\b/i);
  });

  it('11. explicit metric question does not dump a snapshot', () => {
    const result = compose('ANALYSIS', { facts: { property: { city: 'Dallas' }, metric: { question: 'Why is cap rate unavailable?', explanation: 'Cap rate needs rent and expense data.' } } });
    expect(result.summary).toBe('Cap rate needs rent and expense data.');
    expect(result.summary).not.toContain('Dallas');
  });

  it('12. missing data is explicit and never invented', () => {
    const result = compose('ANALYSIS', { facts: { missingItems: ['ARV'] } });
    expect(result.statusItems).toEqual(['ARV']);
    expect(JSON.stringify(result)).not.toMatch(/\$\d/);
  });

  it('13. stale raw data is not treated as current evidence', () => {
    const result = compose('ANALYSIS', { facts: { stale: { price: 100000 }, evidence: [] } });
    expect(JSON.stringify(result)).not.toContain('100000');
  });

  it('14. locked provider never reveals contact', () => {
    const result = compose('PROVIDER_REVIEW', { facts: { phone: '+1 214 555 0100', provider: { locked: true, contact: { email: 'x@y.com' } } } });
    expect(JSON.stringify(result)).not.toMatch(/214|x@y/);
  });

  it('15. unlocked provider reports access without exposing PII', () => {
    const result = compose('ACTION_RESULT', { facts: { action: { code: 'UNLOCK_PROVIDER_CONTACT', status: 'SUCCESS' }, email: 'x@y.com' } });
    expect(result.summary).toContain('Contact access');
    expect(JSON.stringify(result)).not.toContain('x@y.com');
  });

  it('16. financial confirmation uses only supplied cost', () => {
    expect(compose('ACTION_CONFIRMATION', { facts: { action: { code: 'UNLOCK_PROVIDER_CONTACT', nuggetCost: 7 } } }).summary).toContain('7 Nuggets');
  });

  it('17. workflow presents current open count', () => {
    expect(compose('WORKFLOW_REVIEW', { facts: { openItems: ['Verify title', 'Review quote'] } }).summary).toContain('2 workflow items');
  });

  it('18. multiple evidence remains available', () => {
    expect(compose('ANALYSIS', { facts: { evidence: ['Price fits target', 'Dallas matches market'] } }).evidence).toHaveLength(2);
  });

  it('19. evidence respects the explicit limit', () => {
    expect(compose('ANALYSIS', { facts: { evidence: ['A', 'B', 'C', 'D'] } }).evidence).toHaveLength(MAXXIS_COMPOSITION_LIMITS.EVIDENCE);
  });

  it('20. follow-ups respect the explicit limit', () => {
    const followUps = ['A', 'B', 'C', 'D'].map((code) => ({ code, label: code }));
    expect(compose('ANALYSIS', { followUps }).followUps).toHaveLength(MAXXIS_COMPOSITION_LIMITS.FOLLOW_UPS);
  });

  it('21. duplicate headline and summary are removed', () => {
    const result = compose('PROVIDER_REVIEW', { facts: { provider: { replied: true, locked: false } } });
    expect(result.headline).toBe('Your provider replied.');
    expect(result.summary).not.toContain('Your provider replied');
  });

  it('22. duplicate actions are removed by semantic key', () => {
    const duplicate = action('VIEW_PROVIDERS', 'One');
    const result = compose('ANALYSIS', {
      decision: { primaryAction: duplicate, secondaryActions: [{ ...duplicate, label: 'Two' }] },
      followUps: [{ code: 'show_providers', intent: 'show_providers', label: 'Show providers' }],
    });
    expect([result.primaryAction, ...result.secondaryActions].filter(Boolean)).toHaveLength(1);
    expect(result.followUps).toEqual([]);
  });

  it('23. COMPACT limits evidence and follow-ups', () => {
    const result = compose('ANALYSIS', { density: 'COMPACT', facts: { evidence: ['A', 'B'] }, followUps: [{ code: 'A', label: 'A' }, { code: 'B', label: 'B' }, { code: 'C', label: 'C' }] });
    expect(result.evidence).toHaveLength(1);
    expect(result.followUps).toHaveLength(2);
  });

  it('24. STANDARD is the analysis default', () => {
    expect(compose('ANALYSIS').presentationHints.density).toBe('STANDARD');
  });

  it('25. DETAILED requires requested detail or explicit density', () => {
    expect(compose('ANALYSIS', { facts: { requestedDetail: true } }).presentationHints.density).toBe('DETAILED');
  });

  it('26. PT uses one language', () => {
    expect(compose('PROVIDER_REVIEW', { language: 'pt', facts: { provider: { locked: true } } }).headline).toBe('Seu provider respondeu.');
  });

  it('27. EN uses one language', () => {
    expect(compose('PROVIDER_REVIEW', { language: 'en' }).headline).toBe('Your provider replied.');
  });

  it('28. ES uses one language', () => {
    expect(compose('PROVIDER_REVIEW', { language: 'es' }).headline).toBe('Tu provider respondio.');
  });

  it('29. unknown mode requests legacy fallback', () => {
    expect(composeMaxxisExperience({ decision: { mode: 'FUTURE_MODE' } })).toEqual({ status: 'FALLBACK', reason: 'UNKNOWN_MODE' });
  });

  it('30. malformed input falls back without throwing', () => {
    expect(() => composeMaxxisExperience({ decision: null })).not.toThrow();
    expect(composeMaxxisExperience({ decision: null }).status).toBe('FALLBACK');
  });

  it('31. PII defense redacts nested evidence text', () => {
    const result = compose('ANALYSIS', { facts: { evidence: ['Email owner@example.com or call +1 214 555 0100'] } });
    expect(JSON.stringify(result)).not.toMatch(/owner@|214 555/);
  });

  it('32. HTML defense strips arbitrary markup', () => {
    const result = compose('ANALYSIS', { facts: { evidence: ['<img src=x onerror=alert(1)>Safe fact'] } });
    expect(JSON.stringify(result)).not.toContain('<img');
    expect(result.evidence).toEqual(['Safe fact']);
  });

  it('33. output is deterministic and analytics excludes text', () => {
    const input = { facts: { evidence: ['Price fits target'] } };
    const first = compose('ANALYSIS', input);
    expect(compose('ANALYSIS', input)).toEqual(first);
    expect(safeMaxxisCompositionAnalytics(first)).toEqual({ composition_mode: 'ANALYSIS', density: 'STANDARD', content_count: 3, action_count: 0 });
    expect(JSON.stringify(safeMaxxisCompositionAnalytics(first))).not.toContain('Price fits');
  });

  it('34. pure composition has zero side effects', () => {
    const network = vi.spyOn(globalThis, 'fetch');
    const input = { decision: decision('ANALYSIS'), facts: { evidence: ['A'] } };
    const before = JSON.stringify(input);
    composeMaxxisExperience(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(network).not.toHaveBeenCalled();
    network.mockRestore();
  });

  it('35. message bridge selects only structured safe fields', () => {
    const bridge = buildMaxxisMessageCompositionBridge({
      compositionMode: 'PROVIDER_REVIEW',
      data: { status: 'reply_received', email: 'hidden@example.com', phone: '+1 214 555 0100', serviceId: 'service-1' },
    });
    expect(bridge.orchestrationInput.conversationState).toBeTruthy();
    expect(JSON.stringify(bridge)).not.toMatch(/hidden@|214 555|service-1/);
  });

  it('36. composition stays within the local latency target', () => {
    const startedAt = performance.now();
    for (let index = 0; index < 100; index += 1) compose('ANALYSIS', { facts: { evidence: ['A', 'B', 'C'] } });
    expect((performance.now() - startedAt) / 100).toBeLessThan(5);
  });
});
