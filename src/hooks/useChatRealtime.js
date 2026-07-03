import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const CHAT_MESSAGES_TABLE = 'chat_messages';
const CHAT_PAGE_SIZE = 30;
const CHAT_MESSAGE_SELECT = 'id, sender_id, recipient_id, contact_owner_id, body, message_type, metadata, read_at, created_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUuid = (value) => UUID_RE.test(String(value || '').trim());

const sortMessages = (messages) => [...messages].sort((a, b) => {
  const at = new Date(a.createdAt || 0).getTime();
  const bt = new Date(b.createdAt || 0).getTime();
  if (at !== bt) return at - bt;
  return String(a.id || '').localeCompare(String(b.id || ''));
});

function mapChatRowToMessage(row, currentUserId) {
  if (!row || !currentUserId) return null;
  const senderId = String(row.sender_id || '').trim();
  const recipientId = String(row.recipient_id || '').trim();
  if (!senderId || !recipientId) return null;
  const isMine = senderId === String(currentUserId);
  const peerId = isMine ? recipientId : senderId;
  if (!peerId) return null;

  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    peerId,
    message: {
      id: row.id,
      clientMessageId: metadata.clientMessageId || null,
      from: isMine ? 'me' : 'them',
      text: row.body || '',
      type: row.message_type || metadata.type || 'text',
      refData: metadata.refData || null,
      originalText: metadata.originalText || row.body || '',
      originalLang: metadata.originalLang || '',
      translatedText: row.body || '',
      translatedLang: metadata.translatedLang || '',
      senderPreview: metadata.senderPreview || null,
      createdAt: row.created_at || null,
      readAt: row.read_at || null,
      readStatus: isMine ? (row.read_at ? 'read' : 'unread') : 'read',
      status: 'sent',
      retryPayload: null,
    },
  };
}

function mergeMessage(current, nextMessage) {
  const messages = Array.isArray(current) ? [...current] : [];
  const messageId = String(nextMessage?.id || '');
  const clientMessageId = String(nextMessage?.clientMessageId || '');
  const existingIndex = messages.findIndex((msg) => (
    (messageId && String(msg?.id || '') === messageId)
    || (clientMessageId && String(msg?.clientMessageId || '') === clientMessageId)
  ));

  if (existingIndex >= 0) {
    messages[existingIndex] = {
      ...messages[existingIndex],
      ...nextMessage,
      retryPayload: nextMessage.retryPayload ?? messages[existingIndex].retryPayload ?? null,
    };
    return sortMessages(messages);
  }

  return sortMessages([...messages, nextMessage]);
}

function appendChatRow(conversations, row, currentUserId) {
  const mapped = mapChatRowToMessage(row, currentUserId);
  if (!mapped) return conversations || {};
  const current = Array.isArray(conversations?.[mapped.peerId]) ? conversations[mapped.peerId] : [];
  return {
    ...(conversations || {}),
    [mapped.peerId]: mergeMessage(current, mapped.message),
  };
}

function groupChatRows(rows, currentUserId) {
  return (Array.isArray(rows) ? rows : []).reduce((grouped, row) => appendChatRow(grouped, row, currentUserId), {});
}

function getPeerCursor(messages) {
  const sentMessages = (Array.isArray(messages) ? messages : []).filter((msg) => msg?.status === 'sent' && msg?.createdAt);
  if (!sentMessages.length) return null;
  return sentMessages.reduce((oldest, msg) => (
    new Date(msg.createdAt).getTime() < new Date(oldest.createdAt).getTime() ? msg : oldest
  )).createdAt;
}

function makeOptimisticMessage({ payload, userId, clientMessageId, text }) {
  return {
    id: `pending:${clientMessageId}`,
    clientMessageId,
    from: 'me',
    text,
    type: payload.type || 'text',
    refData: payload.refData || null,
    originalText: payload.originalText || text,
    originalLang: payload.originalLang || '',
    translatedText: text,
    translatedLang: payload.translatedLang || '',
    senderPreview: payload.senderPreview || null,
    createdAt: new Date().toISOString(),
    readAt: null,
    readStatus: 'unread',
    status: 'sending',
    retryPayload: { ...payload, senderId: userId },
  };
}

export function useChatRealtime({
  currentUserId,
  enabled = true,
  onError = null,
  onSendError = null,
} = {}) {
  const [conversations, setConversations] = useState({});
  const [hasMoreByPeer, setHasMoreByPeer] = useState({});
  const [loadingMoreByPeer, setLoadingMoreByPeer] = useState({});
  const userId = String(currentUserId || '').trim();
  const canUseRealtime = Boolean(enabled && isSupabaseConfigured && supabase && isValidUuid(userId));

  const reportError = useCallback((label, error) => {
    if (typeof onError === 'function') onError(label, error);
    else if (import.meta.env.DEV) console.warn(label, error);
  }, [onError]);

  const appendMessageRow = useCallback((row) => {
    setConversations((prev) => appendChatRow(prev, row, userId));
  }, [userId]);

  const replaceMessageStatus = useCallback((peerId, clientMessageId, patch) => {
    setConversations((prev) => {
      const current = Array.isArray(prev?.[peerId]) ? prev[peerId] : [];
      return {
        ...(prev || {}),
        [peerId]: current.map((msg) => (
          String(msg?.clientMessageId || '') === String(clientMessageId)
            ? { ...msg, ...patch }
            : msg
        )),
      };
    });
  }, []);

  useEffect(() => {
    if (!canUseRealtime) {
      window.setTimeout(() => {
        setConversations({});
        setHasMoreByPeer({});
        setLoadingMoreByPeer({});
      }, 0);
      return undefined;
    }

    let cancelled = false;
    const hydrateMessages = async () => {
      const { data, error } = await supabase
        .from(CHAT_MESSAGES_TABLE)
        .select(CHAT_MESSAGE_SELECT)
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE_SIZE);

      if (cancelled) return;
      if (error) {
        reportError('Chat message hydration failed.', error);
        return;
      }
      const grouped = groupChatRows((data || []).reverse(), userId);
      setConversations(grouped);
      setHasMoreByPeer(Object.fromEntries(Object.keys(grouped).map((peerId) => [peerId, (grouped[peerId] || []).length >= CHAT_PAGE_SIZE])));
    };

    hydrateMessages();
    const channel = supabase
      .channel(`chat-messages-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: CHAT_MESSAGES_TABLE, filter: `recipient_id=eq.${userId}` }, (payload) => appendMessageRow(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: CHAT_MESSAGES_TABLE, filter: `sender_id=eq.${userId}` }, (payload) => appendMessageRow(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: CHAT_MESSAGES_TABLE, filter: `recipient_id=eq.${userId}` }, (payload) => appendMessageRow(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: CHAT_MESSAGES_TABLE, filter: `sender_id=eq.${userId}` }, (payload) => appendMessageRow(payload.new))
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [appendMessageRow, canUseRealtime, reportError, userId]);

  const loadMore = useCallback(async (peerIdInput, cursorInput = null) => {
    const peerId = String(peerIdInput || '').trim();
    if (!canUseRealtime || !isValidUuid(peerId) || loadingMoreByPeer[peerId]) return [];

    const cursor = cursorInput || getPeerCursor(conversations?.[peerId]);

    setLoadingMoreByPeer((prev) => ({ ...prev, [peerId]: true }));
    let query = supabase
      .from(CHAT_MESSAGES_TABLE)
      .select(CHAT_MESSAGE_SELECT)
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(CHAT_PAGE_SIZE);
    if (cursor) query = query.lt('created_at', cursor);
    const { data, error } = await query;

    setLoadingMoreByPeer((prev) => ({ ...prev, [peerId]: false }));

    if (error) {
      reportError('Chat message pagination failed.', error);
      return [];
    }

    const rows = (data || []).reverse();
    setConversations((prev) => {
      const next = { ...(prev || {}) };
      rows.forEach((row) => {
        const mapped = mapChatRowToMessage(row, userId);
        if (!mapped) return;
        const current = Array.isArray(next[mapped.peerId]) ? next[mapped.peerId] : [];
        next[mapped.peerId] = mergeMessage(current, mapped.message);
      });
      return next;
    });
    setHasMoreByPeer((prev) => ({ ...prev, [peerId]: rows.length >= CHAT_PAGE_SIZE }));
    return rows;
  }, [canUseRealtime, conversations, loadingMoreByPeer, reportError, userId]);

  const markConversationRead = useCallback(async (peerIdInput) => {
    const peerId = String(peerIdInput || '').trim();
    if (!canUseRealtime || !isValidUuid(peerId)) return;

    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from(CHAT_MESSAGES_TABLE)
      .update({ read_at: readAt })
      .eq('sender_id', peerId)
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) {
      reportError('Chat read receipt update failed.', error);
      return;
    }

    setConversations((prev) => {
      const current = Array.isArray(prev?.[peerId]) ? prev[peerId] : [];
      return {
        ...(prev || {}),
        [peerId]: current.map((msg) => (
          msg.from === 'them' ? { ...msg, readAt, readStatus: 'read' } : msg
        )),
      };
    });
  }, [canUseRealtime, reportError, userId]);

  const sendMessage = useCallback(async (payload = {}) => {
    if (!canUseRealtime) return null;
    const recipientId = String(payload.recipientId || '').trim();
    const text = String(payload.text || '').trim();
    if (!isValidUuid(recipientId) || !text) return null;

    const clientMessageId = payload.clientMessageId || `client:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const metadata = {
      ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
      clientMessageId,
      refData: payload.refData || null,
      originalText: payload.originalText || text,
      originalLang: payload.originalLang || '',
      translatedLang: payload.translatedLang || '',
      contactPrimaryProfile: payload.contactPrimaryProfile || payload.primaryProfile || '',
      senderPreview: payload.senderPreview || null,
    };

    const optimistic = makeOptimisticMessage({ payload, userId, clientMessageId, text });
    setConversations((prev) => ({
      ...(prev || {}),
      [recipientId]: mergeMessage(prev?.[recipientId], optimistic),
    }));

    const { data, error } = await supabase
      .from(CHAT_MESSAGES_TABLE)
      .insert({
        sender_id: userId,
        recipient_id: recipientId,
        contact_owner_id: payload.contactOwnerId || recipientId,
        body: text,
        message_type: payload.type || 'text',
        metadata,
      })
      .select(CHAT_MESSAGE_SELECT)
      .single();

    if (error) {
      reportError('Chat message persistence failed.', error);
      replaceMessageStatus(recipientId, clientMessageId, { status: 'failed', retryPayload: { ...payload, clientMessageId } });
      if (typeof onSendError === 'function') onSendError(error);
      return null;
    }

    appendMessageRow(data);
    return data;
  }, [appendMessageRow, canUseRealtime, onSendError, replaceMessageStatus, reportError, userId]);

  const retryMessage = useCallback(async (peerIdInput, messageIdInput) => {
    const peerId = String(peerIdInput || '').trim();
    if (!isValidUuid(peerId)) return null;
    const current = Array.isArray(conversations?.[peerId]) ? conversations[peerId] : [];
    const failed = current.find((msg) => String(msg?.id || '') === String(messageIdInput || ''));
    const retryPayload = failed?.retryPayload;
    if (!retryPayload) return null;
    replaceMessageStatus(peerId, failed.clientMessageId, { status: 'sending' });
    return sendMessage({ ...retryPayload, clientMessageId: failed.clientMessageId });
  }, [conversations, replaceMessageStatus, sendMessage]);

  return {
    conversations,
    setConversations,
    sendMessage,
    retryMessage,
    appendMessageRow,
    markConversationRead,
    loadMore,
    hasMore: hasMoreByPeer,
    loadingMore: loadingMoreByPeer,
    realtimeEnabled: canUseRealtime,
  };
}
