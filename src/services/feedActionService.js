import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const MAX_FEED_ACTION_ROWS = 240;
const VALID_ACTIONS = new Set(['matched', 'interested']);
const VALID_ENTITY_TYPES = new Set(['person', 'property']);
const VALID_PROFILE_SCOPES = new Set(['personal', 'professional', 'fsbo']);

const normalizeText = (value) => String(value || '').trim();

const sanitizeAction = (action) => {
  const normalized = normalizeText(action).toLowerCase();
  return VALID_ACTIONS.has(normalized) ? normalized : '';
};

const sanitizeEntityType = (entityType) => {
  const normalized = normalizeText(entityType).toLowerCase();
  return VALID_ENTITY_TYPES.has(normalized) ? normalized : '';
};

const sanitizeProfileScope = (scope) => {
  const normalized = normalizeText(scope).toLowerCase();
  return VALID_PROFILE_SCOPES.has(normalized) ? normalized : '';
};

const makePayload = ({ action, entityType, entityId, ownerId, primaryProfile }) => {
  const payload = {
    action,
    entity_type: entityType,
    entity_id: entityId,
    updatedAt: new Date().toISOString(),
  };
  if (ownerId) payload.ownerId = ownerId;
  if (primaryProfile) payload.primaryProfile = primaryProfile;
  return payload;
};

const normalizeRow = (row = {}) => {
  const action = sanitizeAction(row.action);
  const entityType = sanitizeEntityType(row.entity_type || row.entityType);
  const entityId = normalizeText(row.entity_id || row.entityId);
  if (!action || !entityType || !entityId) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    action,
    entity_type: entityType,
    entity_id: entityId,
    owner_id: normalizeText(row.owner_id || row.ownerId || payload.ownerId),
    updated_at: row.updated_at || row.updatedAt || null,
    payload: {
      action,
      entity_type: entityType,
      entity_id: entityId,
      ownerId: normalizeText(row.owner_id || row.ownerId || payload.ownerId),
      primaryProfile: sanitizeProfileScope(payload.primaryProfile || payload.primary_profile || payload.scopeKey),
      sourceCardId: normalizeText(payload.sourceCardId || payload.source_card_id),
      updatedAt: row.updated_at || row.updatedAt || payload.updatedAt || null,
    },
  };
};

export function resolveCanonicalFeedActions(rows = [], identityIndex = {}) {
  if (identityIndex?.loaded !== true) {
    return { ready: false, matched: [], interested: [], canonicalRows: [] };
  }

  const contactsByOwnerId = identityIndex.contactsByOwnerId || new Map();
  const contactsByOwnerScope = identityIndex.contactsByOwnerScope || new Map();
  const propertiesById = identityIndex.propertiesById || new Map();
  const matched = [];
  const interested = [];
  const canonicalRows = [];

  (Array.isArray(rows) ? rows : [])
    .map(normalizeRow)
    .filter(Boolean)
    .forEach((row) => {
      const payload = row.payload || {};
      if (row.action === 'matched' && row.entity_type === 'person') {
        const ownerId = normalizeText(row.owner_id || payload.ownerId || row.entity_id);
        const scope = sanitizeProfileScope(payload.primaryProfile);
        const canonical = (scope && contactsByOwnerScope.get(`${ownerId}::${scope}`))
          || contactsByOwnerId.get(ownerId)
          || null;
        if (!canonical) return;
        canonicalRows.push(row);
        matched.push({
          ...canonical,
          source: 'supabase',
          ownerId,
          unlockOwnerId: ownerId,
          ...(payload.sourceCardId ? { sourceCardId: payload.sourceCardId } : {}),
        });
        return;
      }

      if (row.action === 'interested' && row.entity_type === 'property') {
        const canonical = propertiesById.get(row.entity_id) || null;
        if (canonical) {
          canonicalRows.push(row);
          interested.push({ ...canonical, source: 'supabase' });
        }
      }
    });

  return { ready: true, matched, interested, canonicalRows };
}

const feedActionKey = (row) => [row?.action, row?.entity_type, row?.entity_id].map(normalizeText).join('::');

export function findRemovedFeedActionRows(previousRows = [], nextRows = []) {
  const nextKeys = new Set((Array.isArray(nextRows) ? nextRows : [])
    .map(normalizeRow)
    .filter(Boolean)
    .map(feedActionKey));
  return (Array.isArray(previousRows) ? previousRows : [])
    .map(normalizeRow)
    .filter(Boolean)
    .filter((row) => !nextKeys.has(feedActionKey(row)));
}

export async function readFeedActions(userId) {
  const cleanUserId = normalizeText(userId);
  if (!cleanUserId || !isSupabaseConfigured || !supabase) return [];
  const { data, error } = await supabase
    .from('user_feed_actions')
    .select('action, entity_type, entity_id, payload, updated_at')
    .eq('user_id', cleanUserId)
    .in('action', [...VALID_ACTIONS])
    .order('updated_at', { ascending: false })
    .limit(MAX_FEED_ACTION_ROWS * 3);
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map(normalizeRow).filter(Boolean);
}

export async function recordFeedAction(userId, action, entityType, entityId, ownerId = '', primaryProfile = '') {
  const cleanUserId = normalizeText(userId);
  const cleanAction = sanitizeAction(action);
  const cleanEntityType = sanitizeEntityType(entityType);
  const cleanEntityId = normalizeText(entityId);
  const cleanOwnerId = normalizeText(ownerId);
  const cleanPrimaryProfile = sanitizeProfileScope(primaryProfile);
  if (!cleanUserId || !cleanAction || !cleanEntityType || !cleanEntityId || !isSupabaseConfigured || !supabase) {
    return { ok: false, skipped: true };
  }
  const row = {
    action: cleanAction,
    entity_type: cleanEntityType,
    entity_id: cleanEntityId,
    payload: makePayload({
      action: cleanAction,
      entityType: cleanEntityType,
      entityId: cleanEntityId,
      ownerId: cleanOwnerId,
      primaryProfile: cleanPrimaryProfile,
    }),
  };
  const { error } = await supabase.rpc('ds_upsert_user_feed_actions', { p_actions: [row] });
  if (error) throw error;
  return { ok: true };
}

export async function recordFeedActions(userId, rows = []) {
  const cleanUserId = normalizeText(userId);
  const safeRows = (Array.isArray(rows) ? rows : [])
    .map(normalizeRow)
    .filter(Boolean)
    .map((row) => ({
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      payload: makePayload({
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        ownerId: row.owner_id,
        primaryProfile: row.payload?.primaryProfile,
      }),
    }));
  if (!cleanUserId || !safeRows.length || !isSupabaseConfigured || !supabase) {
    return { ok: false, skipped: true };
  }
  const { error } = await supabase.rpc('ds_upsert_user_feed_actions', { p_actions: safeRows });
  if (error) throw error;
  return { ok: true };
}

export async function syncFeedActions(userId, rows = [], previousRows = []) {
  const cleanUserId = normalizeText(userId);
  if (!cleanUserId || !isSupabaseConfigured || !supabase) return { ok: false, skipped: true };
  const safeRows = (Array.isArray(rows) ? rows : []).map(normalizeRow).filter(Boolean);
  if (safeRows.length) await recordFeedActions(cleanUserId, safeRows);
  const removedRows = findRemovedFeedActionRows(previousRows, safeRows);
  for (const row of removedRows) {
    const { error } = await supabase.rpc('ds_delete_user_feed_action', {
      p_action: row.action,
      p_entity_type: row.entity_type,
      p_entity_id: row.entity_id,
    });
    if (error) throw error;
  }
  return { ok: true, upserted: safeRows.length, removed: removedRows.length };
}

export async function clearFeedActions(userId) {
  const cleanUserId = normalizeText(userId);
  if (!cleanUserId || !isSupabaseConfigured || !supabase) return { ok: false, skipped: true };
  const { error } = await supabase
    .from('user_feed_actions')
    .delete()
    .eq('user_id', cleanUserId);
  if (error) throw error;
  return { ok: true };
}

export function makeFeedActionRows({ matched = [], interested = [] }) {
  const rows = [];
  const pushRow = (action, entityType, entityId, ownerId = '', primaryProfile = '') => {
    const cleanAction = sanitizeAction(action);
    const cleanEntityType = sanitizeEntityType(entityType);
    const cleanEntityId = normalizeText(entityId);
    const cleanOwnerId = normalizeText(ownerId);
    const cleanPrimaryProfile = sanitizeProfileScope(primaryProfile);
    if (!cleanAction || !cleanEntityType || !cleanEntityId) return;
    rows.push({
      action: cleanAction,
      entity_type: cleanEntityType,
      entity_id: cleanEntityId,
      payload: makePayload({
        action: cleanAction,
        entityType: cleanEntityType,
        entityId: cleanEntityId,
        ownerId: cleanOwnerId,
        primaryProfile: cleanPrimaryProfile,
      }),
    });
  };

  (Array.isArray(matched) ? matched : []).slice(-MAX_FEED_ACTION_ROWS).forEach((item) => {
    pushRow(
      'matched',
      'person',
      item?.ownerId || item?.unlockOwnerId || item?.sellerId || item?.contactId || item?.id,
      item?.ownerId || item?.unlockOwnerId || item?.sellerId || item?.contactId,
      item?.primaryProfile || item?.primary_profile || item?.profileScope || item?.profile_scope,
    );
  });
  (Array.isArray(interested) ? interested : []).slice(-MAX_FEED_ACTION_ROWS).forEach((item) => {
    pushRow('interested', 'property', item?.id || item?.propertyId || item?.property_id || item?.portfolioId, item?.ownerId || item?.owner_id);
  });

  return rows;
}
