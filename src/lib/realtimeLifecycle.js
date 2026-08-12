export function createRealtimeTopic(prefix, ownerId) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${String(prefix || 'realtime')}-${String(ownerId || 'anonymous')}-${suffix}`;
}

export function createRealtimeLifecycle(supabaseClient) {
  let active = true;
  let channel = null;

  const guard = (handler) => (...args) => {
    if (!active || typeof handler !== 'function') return undefined;
    return handler(...args);
  };

  const subscribe = (nextChannel, statusHandler) => {
    if (!active || !nextChannel) return null;
    channel = nextChannel;
    channel.subscribe(guard(statusHandler));
    return channel;
  };

  const dispose = () => {
    if (!active) return;
    active = false;
    const currentChannel = channel;
    channel = null;
    if (currentChannel && typeof supabaseClient?.removeChannel === 'function') {
      try {
        const removal = supabaseClient.removeChannel(currentChannel);
        if (removal && typeof removal.catch === 'function') removal.catch(() => {});
      } catch {
        // Realtime cleanup is best-effort and must never block navigation/logout.
      }
    }
  };

  return { guard, subscribe, dispose, isActive: () => active };
}
