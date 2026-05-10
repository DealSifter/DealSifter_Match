/**
 * matchPressure.js
 *
 * Simulated market-pressure data per property.
 * - getMatchPressure(propertyId) → deterministic seeded 15–85% per property.
 *   Value is stored in localStorage so it stays consistent across sessions.
 * - getDealAlerts / setDealAlert / shouldSendDealAlert → manage periodic
 *   3-day countdown for owner notifications.
 */

const PRESSURE_KEY = 'ds_match_pressure';
const ALERTS_KEY   = 'ds_deal_alerts';
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Deterministic integer hash from a string (DJB2-like)
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 31) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/**
 * Returns a simulated match-pressure percentage (15–85) for a given propertyId.
 * The value is seeded by the id so it is consistent across reloads.
 */
export function getMatchPressure(propertyId) {
  if (!propertyId) return 0;
  const key = String(propertyId);
  try {
    const raw = localStorage.getItem(PRESSURE_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    if (typeof stored[key] === 'number') return stored[key];
    const val = 15 + (hashStr(key) % 71); // 15–85
    stored[key] = val;
    localStorage.setItem(PRESSURE_KEY, JSON.stringify(stored));
    return val;
  } catch {
    return 15 + (hashStr(key) % 71);
  }
}

/** Read the raw alert-timestamps map from localStorage. */
export function getDealAlerts() {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Record "alert sent now" for a given propertyId. */
export function setDealAlert(propertyId) {
  try {
    const alerts = getDealAlerts();
    alerts[String(propertyId)] = Date.now();
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch { /* no-op */ }
}

/**
 * Returns true if no alert has been sent for this property,
 * or if the last alert was ≥ 3 days ago.
 */
export function shouldSendDealAlert(propertyId) {
  const alerts = getDealAlerts();
  const last = alerts[String(propertyId)];
  if (!last) return true;
  return (Date.now() - last) >= THREE_DAYS_MS;
}
