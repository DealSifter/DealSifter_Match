const KEY = 'ds_feed_order_override_v1';
export const FEED_SORT_ORDERS = ['random', 'recent', 'name_asc', 'price_asc', 'price_desc', 'my_cards_first'];
export const normalizeFeedSortOrder = value => FEED_SORT_ORDERS.includes(value) ? value : 'random';

export function readFeedOrderingOverride(storage = globalThis.sessionStorage) {
  try { return JSON.parse(storage?.getItem(KEY) || 'null'); } catch { return null; }
}

export function writeFeedOrderingOverride(owner, master, value, storage = globalThis.sessionStorage) {
  const override = { owner: String(owner || ''), master: normalizeFeedSortOrder(master), value: normalizeFeedSortOrder(value) };
  try { storage?.setItem(KEY, JSON.stringify(override)); } catch { /* Remains available in memory. */ }
  return override;
}

export function resolveFeedOrderingOverride(override, owner, master) {
  const fallback = normalizeFeedSortOrder(master);
  return override?.owner === String(owner || '') && override.master === fallback && FEED_SORT_ORDERS.includes(override.value) ? override.value : fallback;
}

export function clearFeedOrderingSession(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(KEY); } catch { /* Best effort on logout. */ }
}
