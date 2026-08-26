import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_EVENTS, MAXXIS_DEAL_FUNNEL } from '../domain/analytics/productEvents';
import { resetProductEventDedupeForTests, sanitizeProductProperties, trackProductEvent } from './productAnalytics';

describe('privacy-safe product analytics', () => {
  beforeEach(() => resetProductEventDedupeForTests());

  it('defines the Maxxis Deal AI deal funnel and required taxonomy', () => {
    expect(MAXXIS_DEAL_FUNNEL).toEqual([
      'property_viewed', 'deal_copilot_opened', 'provider_suggested',
      'provider_unlock_started', 'provider_unlocked', 'provider_message_sent', 'provider_reply_received',
    ]);
    expect(Object.keys(PRODUCT_EVENTS)).toContain('workflow_item_completed');
    expect(Object.keys(PRODUCT_EVENTS)).toEqual(expect.arrayContaining(['session_started', 'auth_signed_in']));
  });

  it('removes PII and unapproved metadata', () => {
    expect(sanitizeProductProperties({
      source: 'maxxis',
      email: 'person@example.com',
      phone: '+1 214 555 1212',
      chat_body: 'private',
      response_type: 'properties',
      arbitrary: 'no',
    })).toEqual({ source: 'maxxis', response_type: 'properties' });
  });

  it('deduplicates repeated actions and keeps analytics failure non-blocking', async () => {
    const transport = vi.fn(async () => true);
    expect(await trackProductEvent('property_viewed', { entityId: 'property-1', dedupeKey: 'view-property-1', transport })).toBe(true);
    expect(await trackProductEvent('property_viewed', { entityId: 'property-1', dedupeKey: 'view-property-1', transport })).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(await trackProductEvent('maxxis_opened', { dedupeKey: 'maxxis-failure', transport: async () => { throw new Error('offline'); } })).toBe(false);
  });

  it('rejects unknown events and unsafe entity identifiers', async () => {
    const transport = vi.fn(async () => true);
    expect(await trackProductEvent('unknown_event', { transport })).toBe(false);
    await trackProductEvent('property_viewed', { entityId: 'private address with spaces', transport });
    expect(transport.mock.calls[0][1].entityId).toBeNull();
  });
});
