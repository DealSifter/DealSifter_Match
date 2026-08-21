/* global process */
import { createHash, randomUUID } from 'node:crypto';

const PRODUCTION_REFS = new Set(['cyeipfskwwisbbayyaca']);
const url = String(process.env.RECOVERY_DRILL_SUPABASE_URL || '').trim().replace(/\/$/, '');
const key = String(process.env.RECOVERY_DRILL_SERVICE_ROLE_KEY || '').trim();
const confirmation = process.env.RECOVERY_DRILL_CONFIRM;

function projectRef(value) {
  try {
    const parts = new URL(value).hostname.toLowerCase().split('.');
    return parts.length >= 3 && parts[1] === 'supabase' ? parts[0] : '';
  } catch {
    return '';
  }
}

function stop(message) {
  console.error(`[recovery-drill] ${message}`);
  process.exit(1);
}

const ref = projectRef(url);
if (!url || !key || !ref) stop('Staging URL and service-role key are required.');
if (PRODUCTION_REFS.has(ref)) stop(`Production project ${ref} is blocked.`);
if (confirmation !== 'staging-fixtures-only') stop('Set RECOVERY_DRILL_CONFIRM=staging-fixtures-only.');

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

async function request(path, { method = 'GET', body, prefer = '' } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const requestId = response.headers.get('x-request-id') || 'unavailable';
    throw new Error(`${method} ${path.split('?')[0]} failed: HTTP ${response.status}; requestId=${requestId}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((keyName) => [keyName, canonicalize(value[keyName])]),
    );
  }
  return value;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function normalizeSnapshot({ property: propertyRow, workflow: workflowRow }) {
  return {
    property: {
      ...propertyRow,
      price: Number(propertyRow.price),
      beds: Number(propertyRow.beds),
      baths: Number(propertyRow.baths),
      rehab: Number(propertyRow.rehab),
      publish_to_showcase: Boolean(propertyRow.publish_to_showcase),
      include_in_preview: Boolean(propertyRow.include_in_preview),
      is_active: Boolean(propertyRow.is_active),
    },
    workflow: {
      ...workflowRow,
      completed_at: new Date(workflowRow.completed_at).toISOString(),
    },
  };
}

const runId = `phase5d-${Date.now().toString(36)}`;
const ownerId = randomUUID();
const actorId = randomUUID();
const propertyId = randomUUID();
const serviceId = randomUUID();
const workflowId = randomUUID();
const pendingId = randomUUID();
const password = `Drill-${randomUUID()}-Aa1!`;
const createdUsers = [];

const owner = {
  id: ownerId,
  email: `owner+${runId}@example.test`,
  password,
  email_confirm: true,
  user_metadata: { full_name: `Recovery Owner ${runId}`, e2e_namespace: runId },
};
const actor = {
  id: actorId,
  email: `actor+${runId}@example.test`,
  password,
  email_confirm: true,
  user_metadata: { full_name: `Recovery Actor ${runId}`, e2e_namespace: runId },
};

const property = {
  id: propertyId,
  owner_id: ownerId,
  type: 'SFR',
  address: `Fixture ${runId}`,
  city: 'Recovery City',
  state: 'TX',
  zip: '75001',
  price: 250000,
  beds: 3,
  baths: 2,
  rehab: 25000,
  primary_profile: 'professional',
  publish_to_showcase: false,
  include_in_preview: false,
  is_active: true,
};
const workflow = {
  id: workflowId,
  user_id: actorId,
  property_id: propertyId,
  code: 'inspection_completed',
  status: 'completed',
  source: 'user',
  metadata: { recoveryDrill: true, namespace: runId },
  completed_at: new Date().toISOString(),
};

async function cleanup() {
  for (const userId of createdUsers.reverse()) {
    await request(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' }).catch(() => {});
  }
  const ids = [ownerId, actorId, propertyId, serviceId, workflowId, pendingId];
  for (const id of ids) {
    await request(`/rest/v1/deleted_records_audit?record_id=eq.${id}`, { method: 'DELETE' }).catch(() => {});
    await request(`/rest/v1/deleted_records_audit?owner_ref=eq.${id}`, { method: 'DELETE' }).catch(() => {});
  }
}

try {
  for (const user of [owner, actor]) {
    await request('/auth/v1/admin/users', { method: 'POST', body: user });
    createdUsers.push(user.id);
    await request('/rest/v1/users?on_conflict=id', {
      method: 'POST',
      body: [{ id: user.id, email: user.email, full_name: user.user_metadata.full_name, account_type: 'professional', nuggets: 3 }],
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
  }

  await request('/rest/v1/professional_profiles?on_conflict=user_id', {
    method: 'POST',
    body: [{ user_id: ownerId, category: 'Contractor', primary_category: 'Contractor', profile_payload: { recoveryDrill: runId } }],
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  await request('/rest/v1/properties', { method: 'POST', body: [property], prefer: 'return=minimal' });
  await request('/rest/v1/services', {
    method: 'POST',
    body: [{ id: serviceId, owner_id: ownerId, title: `Recovery Service ${runId}`, price: 100, publish_to_connections: false, primary_profile: 'professional' }],
    prefer: 'return=minimal',
  });
  await request('/rest/v1/deal_workflow_items', { method: 'POST', body: [workflow], prefer: 'return=minimal' });
  await request('/rest/v1/maxxis_pending_actions', {
    method: 'POST',
    body: [{ id: pendingId, user_id: actorId, action_type: 'update_investment_profile', payload: { recoveryDrill: runId }, status: 'pending', expires_at: new Date(Date.now() - 60_000).toISOString() }],
    prefer: 'return=minimal',
  });

  const detected = await request('/rest/v1/rpc/ds_data_integrity_audit', { method: 'POST', body: {} });
  const expiredFinding = detected.find((row) => row.check_code === 'expired_pending_action');
  if (Number(expiredFinding?.issue_count || 0) < 1) throw new Error('Controlled inconsistency was not detected');

  await request(`/rest/v1/maxxis_pending_actions?id=eq.${pendingId}`, {
    method: 'PATCH', body: { status: 'expired' }, prefer: 'return=minimal',
  });

  const snapshot = { property, workflow };
  const expectedHash = hash(normalizeSnapshot(snapshot));
  await request(`/rest/v1/properties?id=eq.${propertyId}`, { method: 'DELETE' });
  const missing = await request(`/rest/v1/properties?id=eq.${propertyId}&select=id`);
  if (missing.length !== 0) throw new Error('Fixture deletion simulation failed');

  await request('/rest/v1/properties', { method: 'POST', body: [property], prefer: 'return=minimal' });
  await request('/rest/v1/deal_workflow_items', { method: 'POST', body: [workflow], prefer: 'return=minimal' });
  const restoredProperty = (await request(`/rest/v1/properties?id=eq.${propertyId}&select=id,owner_id,type,address,city,state,zip,price,beds,baths,rehab,primary_profile,publish_to_showcase,include_in_preview,is_active`))[0];
  const restoredWorkflow = (await request(`/rest/v1/deal_workflow_items?id=eq.${workflowId}&select=id,user_id,property_id,code,status,source,metadata,completed_at`))[0];
  const restoredHash = hash(normalizeSnapshot({ property: restoredProperty, workflow: restoredWorkflow }));
  if (expectedHash !== restoredHash) throw new Error('Restored fixture hash mismatch');

  const finalAudit = await request('/rest/v1/rpc/ds_data_integrity_audit', { method: 'POST', body: {} });
  const critical = finalAudit.filter((row) => Number(row.issue_count) > 0 && ['HIGH', 'CRITICAL'].includes(row.severity));
  if (critical.length) throw new Error('Post-restore integrity audit found HIGH/CRITICAL issues');

  console.log(JSON.stringify({
    projectRef: ref,
    namespace: runId,
    fixtureOnly: true,
    controlledFindingDetected: true,
    logicalSnapshotHashMatched: true,
    restoredStructures: ['users', 'professional_profiles', 'properties', 'services', 'deal_workflow_items', 'maxxis_pending_actions'],
    postRestoreCriticalFindings: 0,
  }, null, 2));
} finally {
  await cleanup();
}
