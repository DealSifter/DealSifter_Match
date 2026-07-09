import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const MAX_FEED_ACTION_ROWS = 240;
const VALID_ACTIONS = new Set(['matched', 'interested']);
const VALID_ENTITY_TYPES = new Set(['person', 'property']);

const normalizeText = (value) => String(value || '').trim();

const sanitizeAction = (action) => {
  const normalized = normalizeText(action).toLowerCase();
  return VALID_ACTIONS.has(normalized) ? normalized : '';
};

const sanitizeEntityType = (entityType) => {
  const normalized = normalizeText(entityType).toLowerCase();
  return VALID_ENTITY_TYPES.has(normalized) ? normalized : '';
};

const makePayload = ({ action, entityType, entityId, ownerId }) => {
  const payload = {
    action,
    entity_type: entityType,
    entity_id: entityId,
    updatedAt: new Date().toISOString(),
  };
  if (ownerId) payload.ownerId = ownerId;
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
      sourceCardId: normalizeText(payload.sourceCardId || payload.source_card_id),
      updatedAt: row.updated_at || row.updatedAt || payload.updatedAt || null,
    },
  };
};

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

export async function recordFeedAction(userId, action, entityType, entityId, ownerId = '') {
  const cleanUserId = normalizeText(userId);
  const cleanAction = sanitizeAction(action);
  const cleanEntityType = sanitizeEntityType(entityType);
  const cleanEntityId = normalizeText(entityId);
  const cleanOwnerId = normalizeText(ownerId);
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
      }),
    }));
  if (!cleanUserId || !safeRows.length || !isSupabaseConfigured || !supabase) {
    return { ok: false, skipped: true };
  }
  const { error } = await supabase.rpc('ds_upsert_user_feed_actions', { p_actions: safeRows });
  if (error) throw error;
  return { ok: true };
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
  const pushRow = (action, entityType, entityId, ownerId = '') => {
    const cleanAction = sanitizeAction(action);
    const cleanEntityType = sanitizeEntityType(entityType);
    const cleanEntityId = normalizeText(entityId);
    const cleanOwnerId = normalizeText(ownerId);
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
      }),
    });
  };

  (Array.isArray(matched) ? matched : []).slice(-MAX_FEED_ACTION_ROWS).forEach((item) => {
    pushRow('matched', 'person', item?.ownerId || item?.unlockOwnerId || item?.sellerId || item?.contactId || item?.id, item?.ownerId || item?.unlockOwnerId || item?.sellerId || item?.contactId);
  });
  (Array.isArray(interested) ? interested : []).slice(-MAX_FEED_ACTION_ROWS).forEach((item) => {
    pushRow('interested', 'property', item?.id || item?.propertyId || item?.property_id || item?.portfolioId, item?.ownerId || item?.owner_id);
  });

  return rows;
}
