import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildMaxxisProactiveEventsFromChatNotifications,
  buildMaxxisProactiveEventsFromConversations,
  buildMaxxisProactiveEventsFromRuntime,
  buildMaxxisTrustedDealContextEvents,
  MAXXIS_PROACTIVE_SIGNAL_SOURCE_MAP,
} from './maxxisProactiveEventBridge';

const appSource = readFileSync(new URL('../../../App.jsx', import.meta.url), 'utf8');

describe('Maxxis proactive realtime bridge', () => {
  it('creates a deduplicated provider reply signal without message PII', () => {
    const [event] = buildMaxxisProactiveEventsFromChatNotifications([{
      source: 'chat_realtime',
      ownerId: '11111111-1111-4111-8111-111111111111',
      latestMessageId: '22222222-2222-4222-8222-222222222222',
      occurredAt: '2026-08-27T00:00:00.000Z',
      message: 'private body',
      email: 'private@example.com',
      phone: '+15555555555',
      read: false,
    }]);

    expect(event).toMatchObject({
      code: 'PROVIDER_REPLIED',
      source: 'chat_realtime',
      event: 'incoming_message',
      dedupeKey: 'PROVIDER_REPLIED:provider-reply:22222222-2222-4222-8222-222222222222',
    });
    expect(JSON.stringify(event)).not.toMatch(/private body|private@example|15555555555/);
  });

  it('maps every supported signal to a real source, freshness and safe payload contract', () => {
    expect(Object.keys(MAXXIS_PROACTIVE_SIGNAL_SOURCE_MAP)).toEqual(expect.arrayContaining([
      'PROVIDER_REPLIED',
      'SERVICE_MATCH_AVAILABLE',
      'NEW_DEAL_GAP',
      'WORKFLOW_ITEM_CHANGED',
      'PROVIDER_UNLOCKED',
      'NEW_ACTION_AVAILABLE',
      'IMPORTANT_MISSING_INFORMATION',
      'PENDING_ACTION_EXPIRING',
      'DEAL_CONTEXT_UPDATED',
    ]));
    Object.values(MAXXIS_PROACTIVE_SIGNAL_SOURCE_MAP).forEach((definition) => {
      expect(definition.source).toBeTruthy();
      expect(definition.event).toBeTruthy();
      expect(definition.safePayload).toBeInstanceOf(Array);
      expect(definition.freshnessMs).toBeGreaterThan(0);
    });
  });

  it('emits only changed trusted deal IDs and merges real runtime events without PII', () => {
    const propertyId = '33333333-3333-4333-8333-333333333333';
    const baseline = buildMaxxisTrustedDealContextEvents({}, [{ id: propertyId, price: 100000, address: 'Private Street' }]);
    expect(baseline.events).toEqual([]);
    const changed = buildMaxxisTrustedDealContextEvents(baseline.versions, [{ id: propertyId, price: 120000, address: 'Private Street' }], 2_000);
    const events = buildMaxxisProactiveEventsFromRuntime({
      runtimeEvents: changed.events.map((event) => ({ ...event, email: 'private@example.test' })),
      now: 2_000,
    });
    expect(events[0]).toMatchObject({
      code: 'DEAL_CONTEXT_UPDATED',
      source: 'trusted_app_context',
      evidence: { propertyId },
    });
    expect(JSON.stringify(events)).not.toMatch(/Private Street|private@example/i);
  });

  it('connects confirmed entitlements and trusted portfolio changes to the runtime bridge', () => {
    expect(appSource).toContain('buildMaxxisTrustedDealContextEvents');
    expect(appSource).toContain("code: 'PROVIDER_UNLOCKED'");
    expect(appSource).toContain('buildMaxxisProactiveEventsFromRuntime({');
    expect(appSource).not.toMatch(/setInterval[\s\S]{0,180}maxxisRuntimeProactiveEvents/);
  });

  it('ignores read, unrelated and malformed notifications', () => {
    expect(buildMaxxisProactiveEventsFromChatNotifications([
      { source: 'chat_realtime', ownerId: 'peer', latestMessageId: 'message', read: true },
      { source: 'unlock_notification', ownerId: 'peer', latestMessageId: 'message', read: false },
      { source: 'chat_realtime', ownerId: 'invalid id', latestMessageId: 'message', read: false },
    ])).toEqual([]);
  });

  it('uses RLS-authorized conversation state without copying message content', () => {
    const conversationId = '55555555-5555-4555-8555-555555555555';
    const messageId = '66666666-6666-4666-8666-666666666666';
    const [event] = buildMaxxisProactiveEventsFromConversations({
      [conversationId]: [{
        id: messageId,
        from: 'them',
        text: 'Private provider reply with phone +15555555555',
        createdAt: '2026-08-28T10:00:00.000Z',
      }],
    });
    expect(event).toMatchObject({
      code: 'PROVIDER_REPLIED',
      evidence: { conversationId },
      dedupeKey: `PROVIDER_REPLIED:provider-reply:${messageId}`,
    });
    expect(JSON.stringify(event)).not.toMatch(/Private provider|15555555555/);
  });
});
