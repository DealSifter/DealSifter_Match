const TECHNICAL_ID_RE = /^[a-zA-Z0-9:_-]{1,120}$/;

function technicalId(value) {
  const normalized = String(value || '').trim();
  return TECHNICAL_ID_RE.test(normalized) ? normalized : '';
}

function timestamp(value, fallback = Date.now()) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildMaxxisProactiveEventsFromChatNotifications(notifications = [], now = Date.now()) {
  return (Array.isArray(notifications) ? notifications : [])
    .filter((notification) => notification?.source === 'chat_realtime' && notification?.read !== true)
    .map((notification) => {
      const conversationId = technicalId(notification.ownerId);
      const messageId = technicalId(notification.latestMessageId);
      if (!conversationId || !messageId) return null;
      return {
        code: 'PROVIDER_REPLIED',
        entityType: 'CONVERSATION',
        entityId: conversationId,
        source: 'chat_realtime',
        occurredAt: timestamp(notification.occurredAt, now),
        severity: 'RELEVANT',
        dedupeKey: `provider-reply:${messageId}`,
        evidence: {
          conversationId,
          actionAvailable: true,
          hasStructuredSource: true,
        },
      };
    })
    .filter(Boolean);
}

export default buildMaxxisProactiveEventsFromChatNotifications;
