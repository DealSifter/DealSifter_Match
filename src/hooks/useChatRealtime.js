import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const CHAT_MESSAGES_TABLE = 'chat_messages';
const CHAT_MESSAGE_SELECT = 'id, sender_id, recipient_id, contact_owner_id, body, message_type, metadata, created_at';

function mapChatRowToMessage(row, currentUserId) {
  if (!row || !currentUserId) return null;
  const senderId = String(row.sender_id || '').trim();
  const recipientId = String(row.recipient_id || '').trim();
  if (!senderId || !recipientId) return null;
  const peerId = senderId === String(currentUserId) ? recipientId : senderId;
  if (!peerId) return null;

  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    peerId,
    message: {
      id: row.id,
      from: senderId === String(currentUserId) ? 'me' : 'them',
      text: row.body || '',
      type: row.message_type || metadata.type || 'text',
      refData: metadata.refData || null,
      originalText: metadata.originalText || row.body || '',
      originalLang: metadata.originalLang || '',
      translatedText: row.body || '',
      translatedLang: metadata.translatedLang || '',
      senderPreview: metadata.senderPreview || null,
      createdAt: row.created_at || null,
    },
  };
}

function appendChatRow(conversations, row, currentUserId) {
  const mapped = mapChatRowToMessage(row, currentUserId);
  if (!mapped) return conversations || {};
  const current = Array.isArray(conversations?.[mapped.peerId]) ? conversations[mapped.peerId] : [];
  if (mapped.message.id && current.some((msg) => String(msg?.id || '') === String(mapped.message.id))) {
    return conversations || {};
  }
  return {
    ...(conversations || {}),
    [mapped.peerId]: [...current, mapped.message].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
  };
}

function groupChatRows(rows, currentUserId) {
  return (Array.isArray(rows) ? rows : []).reduce((grouped, row) => appendChatRow(grouped, row, currentUserId), {});
}

/**
 * Keeps the current user's chat conversations hydrated and subscribed through
 * Supabase Realtime.
 *
 * Realtime events:
 * - INSERT on public.chat_messages where current user is sender.
 * - INSERT on public.chat_messages where current user is recipient.
 *
 * Cleanup:
 * - Removes the Supabase channel when the component unmounts or the user changes.
 */
export function useChatRealtime({
  currentUserId,
  enabled = true,
  onError = null,
  onSendError = null,
} = {}) {
  const [conversations, setConversations] = useState({});
  const userId = String(currentUserId || '').trim();
  const canUseRealtime = Boolean(enabled && isSupabaseConfigured && supabase && userId && userId !== 'local-user');

  const reportError = useCallback((label, error) => {
    if (typeof onError === 'function') onError(label, error);
    else if (import.meta.env.DEV) console.warn(label, error);
  }, [onError]);

  const appendMessageRow = useCallback((row) => {
    setConversations((prev) => appendChatRow(prev, row, userId));
  }, [userId]);

  useEffect(() => {
    if (!canUseRealtime) {
      window.setTimeout(() => setConversations({}), 0);
      return undefined;
    }

    let cancelled = false;
    const hydrateMessages = async () => {
      const { data, error } = await supabase
        .from(CHAT_MESSAGES_TABLE)
        .select(CHAT_MESSAGE_SELECT)
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: true })
        .limit(500);

      if (cancelled) return;
      if (error) {
        reportError('Chat message hydration failed.', error);
        return;
      }
      setConversations(groupChatRows(data, userId));
    };

    hydrateMessages();
    const channel = supabase
      .channel(`chat-messages-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: CHAT_MESSAGES_TABLE, filter: `recipient_id=eq.${userId}` }, (payload) => appendMessageRow(payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: CHAT_MESSAGES_TABLE, filter: `sender_id=eq.${userId}` }, (payload) => appendMessageRow(payload.new))
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [appendMessageRow, canUseRealtime, reportError, userId]);

  const sendMessage = useCallback(async (payload = {}) => {
    if (!canUseRealtime) return;
    const recipientId = String(payload.recipientId || '').trim();
    const text = String(payload.text || '').trim();
    if (!recipientId || !text) return;

    const optimisticId = `pending:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: optimisticId,
      sender_id: userId,
      recipient_id: recipientId,
      contact_owner_id: payload.contactOwnerId || recipientId,
      body: text,
      message_type: payload.type || 'text',
      metadata: {
        refData: payload.refData || null,
        originalText: payload.originalText || text,
        originalLang: payload.originalLang || '',
        translatedLang: payload.translatedLang || '',
        contactPrimaryProfile: payload.contactPrimaryProfile || payload.primaryProfile || '',
        senderPreview: payload.senderPreview || null,
      },
      created_at: new Date().toISOString(),
    };

    appendMessageRow(optimistic);

    const { data, error } = await supabase
      .from(CHAT_MESSAGES_TABLE)
      .insert({
        sender_id: userId,
        recipient_id: recipientId,
        contact_owner_id: payload.contactOwnerId || recipientId,
        body: text,
        message_type: payload.type || 'text',
        metadata: optimistic.metadata,
      })
      .select(CHAT_MESSAGE_SELECT)
      .single();

    if (error) {
      reportError('Chat message persistence failed.', error);
      setConversations((prev) => {
        const current = Array.isArray(prev?.[recipientId]) ? prev[recipientId] : [];
        return {
          ...(prev || {}),
          [recipientId]: current.filter((msg) => String(msg?.id || '') !== optimisticId),
        };
      });
      if (typeof onSendError === 'function') onSendError(error);
      return;
    }

    setConversations((prev) => {
      const current = Array.isArray(prev?.[recipientId]) ? prev[recipientId] : [];
      return {
        ...(prev || {}),
        [recipientId]: current.filter((msg) => String(msg?.id || '') !== optimisticId),
      };
    });
    appendMessageRow(data);
  }, [appendMessageRow, canUseRealtime, onSendError, reportError, userId]);

  return {
    conversations,
    setConversations,
    sendMessage,
    appendMessageRow,
    realtimeEnabled: canUseRealtime,
  };
}
