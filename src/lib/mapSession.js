// Sidebar choices belong to one signed-in browser session, never to master preferences.
const CONTEXT_KEY = 'ds_map_session_context_v1';
const KEYS = ['ds_mapview_ui_state_v1', 'mapViewport', 'ds_map_return_viewport'];

export function clearMapSession(storage = globalThis.sessionStorage) {
  for (const key of [...KEYS, CONTEXT_KEY]) {
    try { storage?.removeItem(key); } catch { /* Storage may be disabled. */ }
  }
}

export function openMapSession(owner, preferences, storage = globalThis.sessionStorage) {
  const identity = JSON.stringify([String(owner || ''), preferences || {}]);
  let context;
  try { context = JSON.parse(storage?.getItem(CONTEXT_KEY) || 'null'); } catch { /* Start fresh. */ }
  if (context?.identity !== identity) {
    clearMapSession(storage);
    context = { identity, token: globalThis.crypto.randomUUID() };
    try { storage?.setItem(CONTEXT_KEY, JSON.stringify(context)); } catch { /* In-memory map still works. */ }
  }
  const token = context.token;
  const active = () => {
    try { return JSON.parse(storage?.getItem(CONTEXT_KEY) || 'null')?.token === token; } catch { return false; }
  };
  return {
    read(key) {
      if (!active()) return null;
      try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
    },
    write(key, value) {
      if (!active()) return;
      try { storage.setItem(key, JSON.stringify(value)); } catch { /* Best effort. */ }
    },
    remove(key) {
      if (!active()) return;
      try { storage.removeItem(key); } catch { /* Best effort. */ }
    },
  };
}
