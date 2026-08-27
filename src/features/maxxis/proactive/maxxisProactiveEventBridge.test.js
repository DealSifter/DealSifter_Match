import { describe, expect, it } from 'vitest';
import { buildMaxxisProactiveEventsFromChatNotifications } from './maxxisProactiveEventBridge';

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
      dedupeKey: 'provider-reply:22222222-2222-4222-8222-222222222222',
    });
    expect(JSON.stringify(event)).not.toMatch(/private body|private@example|15555555555/);
  });

  it('ignores read, unrelated and malformed notifications', () => {
    expect(buildMaxxisProactiveEventsFromChatNotifications([
      { source: 'chat_realtime', ownerId: 'peer', latestMessageId: 'message', read: true },
      { source: 'unlock_notification', ownerId: 'peer', latestMessageId: 'message', read: false },
      { source: 'chat_realtime', ownerId: 'invalid id', latestMessageId: 'message', read: false },
    ])).toEqual([]);
  });
});
