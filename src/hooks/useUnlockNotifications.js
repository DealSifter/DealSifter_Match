import { useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const NOTIFICATIONS_TABLE = 'notifications';

function mapNotification(row) {
  if (!row?.id) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.id,
    type: row.type || 'unlock',
    payload,
    unlockerId: payload.unlocker_id || null,
    cardId: payload.card_id || null,
    propertyId: payload.property_id || null,
    totalCost: Number(payload.nuggets_spent || 0),
    readAt: row.read_at || null,
    read: Boolean(row.read_at),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Persistent owner notifications for unlock/exclusive events.
 *
 * Realtime events:
 * - INSERT on public.notifications filtered by user_id = current user.
 *
 * Backlog:
 * - On mount, unread rows are fetched from public.notifications so events that
 *   arrived while the user was offline still produce a badge on the next login.
 *
 * Polling/non-realtime stays elsewhere:
 * - Admin KPIs and nugget counters should continue using periodic refresh or
 *   explicit server responses, not this hook.
 */
export function useUnlockNotifications({
  currentUserId,
  enabled = true,
  onNotify = null,
  onError = null,
} = {}) {
  const userId = String(currentUserId || '').trim();
  const canUseNotifications = Boolean(enabled && isSupabaseConfigured && supabase && userId && userId !== 'local-user');
  const [notifications, setNotifications] = useState([]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const reportError = useCallback((label, error) => {
    if (typeof onError === 'function') onError(label, error);
    else if (import.meta.env.DEV) console.warn(label, error);
  }, [onError]);

  const mergeNotification = useCallback((row, shouldNotify = false) => {
    const nextNotification = mapNotification(row);
    if (!nextNotification) return;
    setNotifications((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (current.some((item) => item.id === nextNotification.id)) return current;
      if (shouldNotify && !nextNotification.read && typeof onNotify === 'function') {
        onNotify(nextNotification);
      }
      return [nextNotification, ...current].slice(0, 100);
    });
  }, [onNotify]);

  useEffect(() => {
    if (!canUseNotifications) {
      window.setTimeout(() => setNotifications([]), 0);
      return undefined;
    }

    let cancelled = false;
    const loadUnreadNotifications = async () => {
      const { data, error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .select('id, user_id, type, payload, read_at, created_at')
        .eq('user_id', userId)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (cancelled) return;
      setNotifications((data || []).map(mapNotification).filter(Boolean));
    };

    loadUnreadNotifications().catch((error) => {
      reportError('Unlock notification backlog load failed.', error);
    });

    const channel = supabase
      .channel(`owner-notifications-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: NOTIFICATIONS_TABLE,
        filter: `user_id=eq.${userId}`,
      }, (payload) => mergeNotification(payload.new, true))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: NOTIFICATIONS_TABLE,
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const updated = mapNotification(payload.new);
        if (!updated) return;
        setNotifications((prev) => (Array.isArray(prev) ? prev : []).map((item) => (
          item.id === updated.id ? { ...item, ...updated } : item
        )));
      })
      .subscribe((status, error) => {
        if (error) reportError('Unlock notification realtime subscription failed.', error);
        if (status === 'CHANNEL_ERROR') reportError('Unlock notification realtime channel error.', new Error(status));
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [canUseNotifications, mergeNotification, reportError, userId]);

  const markAsRead = useCallback(async (id) => {
    const notificationId = String(id || '').trim();
    if (!notificationId || !canUseNotifications) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) => (Array.isArray(prev) ? prev : []).map((item) => (
      item.id === notificationId ? { ...item, read: true, readAt } : item
    )));
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ read_at: readAt })
      .eq('id', notificationId)
      .eq('user_id', userId);
    if (error) {
      reportError('Unlock notification mark read failed.', error);
      throw error;
    }
  }, [canUseNotifications, reportError, userId]);

  const markAllAsRead = useCallback(async () => {
    if (!canUseNotifications) return;
    const unreadIds = notifications.filter((item) => !item.read).map((item) => item.id);
    if (!unreadIds.length) return;
    const readAt = new Date().toISOString();
    setNotifications((prev) => (Array.isArray(prev) ? prev : []).map((item) => ({ ...item, read: true, readAt: item.readAt || readAt })));
    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ read_at: readAt })
      .eq('user_id', userId)
      .in('id', unreadIds);
    if (error) {
      reportError('Unlock notification mark all read failed.', error);
      throw error;
    }
  }, [canUseNotifications, notifications, reportError, userId]);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    markAllRead: markAllAsRead,
    clear,
    realtimeEnabled: canUseNotifications,
  };
}
