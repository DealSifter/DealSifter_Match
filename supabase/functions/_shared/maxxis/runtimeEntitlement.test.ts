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

  it('returns server-authoritative unlock costs for capabilities not included in the plan', () => {
    expect(guardMaxxisRuntimeEntitlement({ userId: USER_ID, plan: 'free', requestedCapability: 'MAXXIS_ANALYSIS' })).toMatchObject({ allowed: false, nuggetCost: 3, paidUnlockEnabled: true });
    expect(guardMaxxisRuntimeEntitlement({ userId: USER_ID, plan: 'pro', requestedCapability: 'DEAL_INTELLIGENCE' })).toMatchObject({ allowed: false, nuggetCost: 5, paidUnlockEnabled: true });
  });

  it('is fail-closed for missing identity and unknown capabilities', () => {
    expect(guardMaxxisRuntimeEntitlement({ plan: 'enterprise', requestedCapability: 'DEAL_INTELLIGENCE' })).toMatchObject({ allowed: false, error: 'UNAUTHENTICATED' });
    expect(guardMaxxisRuntimeEntitlement({ userId: USER_ID, plan: 'enterprise', requestedCapability: 'UNKNOWN' })).toMatchObject({ allowed: false, error: 'CAPABILITY_NOT_AVAILABLE' });
  });

  it('uses server inference over a modified frontend claiming a lower level', () => {
    expect(inferMaxxisRuntimeCapability({ message: 'Calculate ARV for this property', requestedCapability: 'PROPERTY_RELEASE', hasPropertyContext: true })).toBe('DEAL_INTELLIGENCE');
  });

  it('maps premium tools and leaves ordinary tools outside the report gate', () => {
    expect(capabilityForMaxxisTool('getDealInsightContext')).toBeNull();
    expect(capabilityForMaxxisTool('getDealInsightContext', 'MAXXIS_ANALYSIS')).toBe('MAXXIS_ANALYSIS');
    expect(capabilityForMaxxisTool('getDealCopilotOverview')).toBeNull();
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

  it('scopes one-time report entitlements to the selected property', () => {
    const source = readFileSync(new URL('./runtimeEntitlement.ts', import.meta.url), 'utf8');
    const edge = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(source).toContain(".select('property_id, capability, access_source')");
    expect(source).toContain("entitlementQuery.eq('property_id', propertyId)");
    expect(edge).toContain('loadMaxxisRuntimeAccessContext(userId, userClient, propertyContextId)');
  });

  it('gates before Gemini and before premium tool execution', () => {
    const source = readFileSync(new URL('../../maxxis-chat/index.ts', import.meta.url), 'utf8');
    expect(source.indexOf('loadMaxxisRuntimeAccessContext(userId, userClient, propertyContextId)')).toBeLessThan(source.indexOf('const result = await callGemini('));
    expect(source.indexOf('const toolCapability = capabilityForMaxxisTool(toolName, functionArgs.reportType)')).toBeLessThan(source.indexOf('result = await executeMaxxisTool('));
  });

  it('loads owned report entitlements without RentCast or Stripe', () => {
    const source = readFileSync(new URL('./runtimeEntitlement.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/RENTCAST_API_KEY|stripe\.|consume_nuggets|debit/i);
    expect(source).toContain("from('maxxis_report_entitlements')");
  });
});
