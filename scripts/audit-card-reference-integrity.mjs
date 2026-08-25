/* global process */

const PRODUCTION_REFS = new Set(['cyeipfskwwisbbayyaca']);
const supabaseUrl = String(process.env.CARD_INTEGRITY_SUPABASE_URL || '').trim().replace(/\/$/, '');
const serviceRoleKey = String(process.env.CARD_INTEGRITY_SERVICE_ROLE_KEY || '').trim();

function fail(message) {
  console.error(`[card-integrity] ${message}`);
  process.exit(1);
}

function projectRefFromUrl(value) {
  try {
    const [ref, domain] = new URL(value).hostname.toLowerCase().split('.');
    return domain === 'supabase' ? ref : '';
  } catch {
    return '';
  }
}

if (!supabaseUrl || !serviceRoleKey) {
  fail('CARD_INTEGRITY_SUPABASE_URL and CARD_INTEGRITY_SERVICE_ROLE_KEY are required.');
}
const projectRef = projectRefFromUrl(supabaseUrl);
if (!projectRef) fail('Invalid Supabase URL.');
if (PRODUCTION_REFS.has(projectRef) && process.env.CARD_INTEGRITY_ALLOW_PRODUCTION !== 'I_UNDERSTAND_READ_ONLY') {
  fail(`Production project ${projectRef} is blocked without explicit read-only approval.`);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  'User-Agent': 'DealSifter-Server-Audit/1.0',
};

async function readJson(path, options = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) fail(`Read-only request failed: HTTP ${response.status} at ${path.split('?')[0]}.`);
  return response.json();
}

const inventory = await readJson('/rest/v1/rpc/ds_get_global_feed_inventory', {
  method: 'POST',
  body: '{}',
});
const actions = await readJson('/rest/v1/user_feed_actions?select=user_id,action,entity_type,entity_id,updated_at&action=in.(matched,interested)&limit=10000');

const propertyIds = new Set((inventory?.properties || []).map((row) => String(row.id || '')).filter(Boolean));
const ownerIds = new Set([
  ...(inventory?.properties || []).map((row) => String(row.owner_id || '')),
  ...(inventory?.services || []).map((row) => String(row.owner_id || '')),
].filter(Boolean));
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stale = (Array.isArray(actions) ? actions : []).filter((row) => {
  const id = String(row.entity_id || '');
  if (row.action === 'matched' && row.entity_type === 'person') return !ownerIds.has(id);
  if (row.action === 'interested' && row.entity_type === 'property') return !propertyIds.has(id);
  return true;
});
const staleByContract = Object.fromEntries([...stale.reduce((counts, row) => {
  const key = `${row.action}:${row.entity_type}`;
  counts.set(key, (counts.get(key) || 0) + 1);
  return counts;
}, new Map())].sort(([a], [b]) => a.localeCompare(b)));
const staleDates = stale.map((row) => Date.parse(row.updated_at)).filter(Number.isFinite).sort((a, b) => a - b);

console.log(JSON.stringify({
  projectRef,
  readOnly: true,
  inventory: {
    services: (inventory?.services || []).length,
    properties: propertyIds.size,
    owners: ownerIds.size,
  },
  activeFeedReferences: actions.length,
  staleReferences: stale.length,
  staleNumericIds: stale.filter((row) => !uuidPattern.test(String(row.entity_id || ''))).length,
  affectedUsers: new Set(stale.map((row) => String(row.user_id || '')).filter(Boolean)).size,
  staleByContract,
  firstSeenAt: staleDates.length ? new Date(staleDates[0]).toISOString() : null,
  lastSeenAt: staleDates.length ? new Date(staleDates.at(-1)).toISOString() : null,
}, null, 2));

if (stale.length && !process.argv.includes('--allow-findings')) {
  fail(`${stale.length} stale active feed reference(s) detected.`);
}
