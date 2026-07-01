import { useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const CONTACT_UNLOCKS_TABLE = 'unlocks';
const PROPERTY_UNLOCKS_TABLE = 'property_unlocks';

function readSeenIds(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function writeSeenIds(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids].slice(-500)));
  } catch {
    // Best-effort only.
  }
}

function mapUnlockNotification(table, row) {
  if (!row?.id) return null;
  return {
    id: `${table}:${row.id}`,
    table,
    unlockId: row.id,
    buyerId: row.buyer_id || null,
    ownerId: row.seller_id || row.owner_id || null,
    propertyId: row.property_id || null,
    mode: row.mode || 'contact',
    totalCost: Number(row.total_cost || row.nuggets_spent || 0),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Subscribes to unlock INSERT events where the current user owns the unlocked
 * contact/card.
 *
 * Realtime events:
 * - INSERT on public.unlocks filtered by seller_id = current user.
 * - INSERT on public.property_unlocks filtered by owner_id = current user.
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
  const storageKey = userId && userId !== 'local-user'
    ? `ds_unlock_notifications_seen:${userId}`
    : 'ds_unlock_notifications_seen';
  const [notifications, setNotifications] = useState([]);
  const canUseRealtime = Boolean(enabled && isSupabaseConfigured && supabase && userId && userId !== 'local-user');

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const reportError = useCallback((label, error) => {
    if (typeof onError === 'function') onError(label, error);
    else if (import.meta.env.DEV) console.warn(label, error);
  }, [onError]);

  const addNotification = useCallback((table, row) => {
    const nextNotification = mapUnlockNotification(table, row);
    if (!nextNotification) return;
    setNotifications((prev) => {
      if ((prev || []).some((item) => item.id === nextNotification.id)) return prev;
      const seenIds = readSeenIds(storageKey);
      const enriched = {
        ...nextNotification,
        read: seenIds.has(nextNotification.id),
      };
      if (!enriched.read && typeof onNotify === 'function') onNotify(enriched);
      return [enriched, ...(Array.isArray(prev) ? prev : [])].slice(0, 100);
    });
  }, [onNotify, storageKey]);

  useEffect(() => {
    if (!canUseRealtime) {
      window.setTimeout(() => setNotifications([]), 0);
      return undefined;
    }

    const channel = supabase
      .channel(`unlock-owner-notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: CONTACT_UNLOCKS_TABLE, filter: `seller_id=eq.${userId}` }, (payload) => addNotification(CONTACT_UNLOCKS_TABLE, payload.new))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: PROPERTY_UNLOCKS_TABLE, filter: `owner_id=eq.${userId}` }, (payload) => addNotification(PROPERTY_UNLOCKS_TABLE, payload.new))
      .subscribe((status, error) => {
        if (error) reportError('Unlock notification realtime subscription failed.', error);
        if (status === 'CHANNEL_ERROR') reportError('Unlock notification realtime channel error.', new Error(status));
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [addNotification, canUseRealtime, reportError, userId]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = (Array.isArray(prev) ? prev : []).map((item) => ({ ...item, read: true }));
      const seenIds = readSeenIds(storageKey);
      next.forEach((item) => seenIds.add(item.id));
      writeSeenIds(storageKey, seenIds);
      return next;
    });
  }, [storageKey]);

  const clear = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    unreadCount,
    markAllRead,
    clear,
    realtimeEnabled: canUseRealtime,
  };
}

