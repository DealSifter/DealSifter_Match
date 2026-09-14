import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  capabilityForMaxxisTool,
  guardMaxxisRuntimeEntitlement,
  inferMaxxisRuntimeCapability,
  loadMaxxisRuntimeAccessContext,
} from './runtimeEntitlement.ts';

const USER_ID = '00000000-0000-4000-8000-000000000001';

describe('MaxxisRuntimeEntitlementGuard', () => {
  it.each([
    ['free', 'PROPERTY_RELEASE', true],
    ['free', 'MAXXIS_ANALYSIS', false],
    ['free', 'DEAL_INTELLIGENCE', false],
    ['pro', 'MAXXIS_ANALYSIS', true],
    ['pro', 'DEAL_INTELLIGENCE', false],
    ['enterprise', 'DEAL_INTELLIGENCE', true],
  ])('%s requesting %s resolves allowed=%s', (plan, requestedCapability, allowed) => {
    expect(guardMaxxisRuntimeEntitlement({ userId: USER_ID, plan, requestedCapability })).toMatchObject({
      allowed, result: allowed ? 'ALLOW' : 'DENY',
    });
  });

  it('is fail-closed for missing identity and unknown capabilities', () => {
    expect(guardMaxxisRuntimeEntitlement({ plan: 'enterprise', requestedCapability: 'DEAL_INTELLIGENCE' })).toMatchObject({ allowed: false, error: 'UNAUTHENTICATED' });
    expect(guardMaxxisRuntimeEntitlement({ userId: USER_ID, plan: 'enterprise', requestedCapability: 'UNKNOWN' })).toMatchObject({ allowed: false, error: 'CAPABILITY_NOT_AVAILABLE' });
  });

  it('uses server inference over a modified frontend claiming a lower level', () => {
    expect(inferMaxxisRuntimeCapability({ message: 'Calculate ARV for this property', requestedCapability: 'PROPERTY_RELEASE', hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
  });

  it('maps premium tools and leaves ordinary tools outside the report gate', () => {
    expect(capabilityForMaxxisTool('getDealInsightContext')).toBe('DEAL_INTELLIGENCE');
    expect(capabilityForMaxxisTool('getDealCopilotOverview')).toBe('DEAL_INTELLIGENCE');
    expect(capabilityForMaxxisTool('getPropertyDetails')).toBeNull();
  });

  it('loads active plans, defaults absent subscriptions to FREE, and fails closed on read error', async () => {
    const query = (result: unknown) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(result),
    });
    const pro = await loadMaxxisRuntimeAccessContext(USER_ID, { from: vi.fn(() => query({ data: { plan_id: 'pro', status: 'active' }, error: null })) } as never);
    const free = await loadMaxxisRuntimeAccessContext(USER_ID, { from: vi.fn(() => query({ data: null, error: null })) } as never);
    const failed = await loadMaxxisRuntimeAccessContext(USER_ID, { from: vi.fn(() => query({ data: null, error: { message: 'denied' } })) } as never);
    expect(pro).toMatchObject({ ok: true, context: { plan: 'PRO', entitlements: [] } });
    expect(free).toMatchObject({ ok: true, context: { plan: 'FREE', entitlements: [] } });
    expect(failed).toEqual({ ok: false, error: 'ENTITLEMENT_MISSING' });
  });

  it('gates before Gemini and before premium tool execution', () => {
    const source = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(source.indexOf('loadMaxxisRuntimeAccessContext(userId, userClient)')).toBeLessThan(source.indexOf('const result = await callGemini('));
    expect(source.indexOf('const toolCapability = capabilityForMaxxisTool(toolName)')).toBeLessThan(source.indexOf('result = await executeMaxxisTool('));
  });

  it('does not activate RentCast, Nuggets, or Stripe', () => {
    const source = readFileSync(new URL('./runtimeEntitlement.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/RENTCAST_API_KEY|stripe\.|consume_nuggets|debit/i);
    expect(source).toContain('entitlements: []');
  });
});
