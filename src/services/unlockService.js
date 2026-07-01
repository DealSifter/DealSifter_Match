import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export class UnlockServiceError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = options.name || 'UnlockServiceError';
    this.code = options.code || 'unlock_service_error';
    this.cause = options.cause;
  }
}

export class InsufficientNuggets extends UnlockServiceError {
  constructor(message = 'Not enough nuggets', options = {}) {
    super(message, { ...options, name: 'InsufficientNuggets', code: 'insufficient_nuggets' });
  }
}

export class ExclusivityAlreadyActive extends UnlockServiceError {
  constructor(message = 'Exclusivity already active', options = {}) {
    super(message, { ...options, name: 'ExclusivityAlreadyActive', code: 'exclusivity_already_active' });
  }
}

export class InvalidToken extends UnlockServiceError {
  constructor(message = 'Invalid or expired unlock token', options = {}) {
    super(message, { ...options, name: 'InvalidToken', code: 'invalid_token' });
  }
}

export class UnlockCostChanged extends UnlockServiceError {
  constructor(message = 'Unlock cost changed', options = {}) {
    super(message, { ...options, name: 'UnlockCostChanged', code: 'unlock_cost_changed' });
    this.currentCost = options.currentCost ?? null;
  }
}

export class PlanLimitReached extends UnlockServiceError {
  constructor(message = 'Plan limit reached', options = {}) {
    super(message, { ...options, name: 'PlanLimitReached', code: 'plan_limit_reached' });
  }
}

export class UnauthorizedUnlock extends UnlockServiceError {
  constructor(message = 'Unauthorized', options = {}) {
    super(message, { ...options, name: 'UnauthorizedUnlock', code: 'unauthorized' });
  }
}

const asUuidOrNull = (value) => {
  const normalized = String(value || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
};

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) {
    throw new UnlockServiceError('Supabase is not configured', { code: 'supabase_not_configured' });
  }
  return supabase;
};

const pickRow = (data) => (Array.isArray(data) ? data[0] : data);

export function normalizeUnlockIntent(row) {
  if (!row) return null;
  return {
    token: row.intent_token || row.intentToken || row.id || null,
    sellerId: row.seller_id || row.sellerId || null,
    propertyId: row.property_id || row.propertyId || null,
    scope: row.scope || 'contact',
    mode: row.mode || 'normal',
    baseCost: Math.max(1, Number(row.base_cost || row.baseCost || 1)),
    exclusivityCost: Math.max(0, Number(row.exclusivity_cost || row.exclusivityCost || 0)),
    totalCost: Math.max(1, Number(row.total_cost || row.totalCost || 1)),
    normalUnlockCount: Number(row.normal_unlock_count || row.normalUnlockCount || 0),
    expiresAt: row.expires_at || row.expiresAt || null,
    blocked: row.blocked === true,
  };
}

export function normalizePropertyUnlockQuote(row, propertyId = null) {
  if (!row) return null;
  return {
    propertyId: row.property_id || row.propertyId || propertyId,
    ownerId: row.owner_id || row.ownerId || null,
    baseCost: Math.max(1, Number(row.base_cost || row.baseCost || 1)),
    normalUnlockCount: Number(row.normal_unlock_count || row.normalUnlockCount || 0),
    exclusivityKind: String(row.exclusivity_kind || row.exclusivityKind || 'regular'),
    exclusivityCost: Math.max(0, Number(row.exclusivity_cost || row.exclusivityCost || 0)),
    blocked: row.blocked === true,
    expiresAt: row.expires_at || row.expiresAt || null,
  };
}

const parseCurrentCost = (message) => {
  const match = String(message || '').match(/current_cost=([0-9]+)/i);
  return match ? Number(match[1]) : null;
};

export function normalizeUnlockError(error) {
  if (error instanceof UnlockServiceError) return error;
  const message = String(error?.message || error?.details || error?.detail || error || 'Unlock failed');
  const lower = message.toLowerCase();
  const code = String(error?.code || '').trim();

  if (lower.includes('not enough nuggets') || code === '22003') {
    return new InsufficientNuggets(message, { cause: error });
  }
  if (lower.includes('active exclusivity') || lower.includes('under active exclusivity')) {
    return new ExclusivityAlreadyActive(message, { cause: error });
  }
  if (lower.includes('intent invalid') || lower.includes('intent expired') || lower.includes('intent required') || code === '57014') {
    return new InvalidToken(message, { cause: error });
  }
  if (lower.includes('unlock cost changed') || lower.includes('refresh required') || code === '40001') {
    return new UnlockCostChanged(message, { cause: error, currentCost: parseCurrentCost(message) });
  }
  if (lower.includes('plan_limit_reached')) {
    return new PlanLimitReached(message, { cause: error });
  }
  if (lower.includes('authentication required') || lower.includes('unauthorized') || code === '28000') {
    return new UnauthorizedUnlock(message, { cause: error });
  }
  return new UnlockServiceError(message, { cause: error, code: code || 'unlock_failed' });
}

async function rpc(name, args = {}) {
  const client = ensureSupabase();
  const { data, error } = await client.rpc(name, args);
  if (error) throw normalizeUnlockError(error);
  return data;
}

export async function createUnlockIntent({ contactId, propertyId = null, mode = 'normal', metadata = {} } = {}) {
  const sellerId = asUuidOrNull(contactId);
  const cleanPropertyId = asUuidOrNull(propertyId);
  if (!sellerId && !cleanPropertyId) {
    throw new UnlockServiceError('Valid contactId or propertyId is required', { code: 'invalid_unlock_target' });
  }
  const data = await rpc('ds_create_unlock_intent', {
    p_seller_id: sellerId,
    p_property_id: cleanPropertyId,
    p_mode: mode || 'normal',
    p_metadata: metadata || {},
  });
  const intent = normalizeUnlockIntent(pickRow(data));
  if (!intent?.token) throw new InvalidToken('Unlock intent was not created');
  return intent;
}

export async function getUnlockCost(contactId) {
  return createUnlockIntent({ contactId, mode: 'normal', metadata: { source: 'unlock_service_get_cost' } });
}

export async function getPropertyUnlockQuote(propertyId) {
  const cleanPropertyId = asUuidOrNull(propertyId);
  if (!cleanPropertyId) throw new UnlockServiceError('Valid propertyId is required', { code: 'invalid_property_id' });
  const data = await rpc('ds_get_property_unlock_quote', { p_property_id: cleanPropertyId });
  return normalizePropertyUnlockQuote(pickRow(data), cleanPropertyId);
}

export async function unlockContact(contactId, intentToken, nuggetCost) {
  const sellerId = asUuidOrNull(contactId);
  const token = asUuidOrNull(intentToken);
  if (!sellerId) throw new UnlockServiceError('Valid contactId is required', { code: 'invalid_contact_id' });
  if (!token) throw new InvalidToken('Unlock intent token is required');
  const data = await rpc('ds_purchase_contact_unlock', {
    p_seller_id: sellerId,
    p_intent_token: token,
  });
  const row = pickRow(data);
  if (!row?.unlock_id) throw new UnlockServiceError('Contact unlock did not return a persisted record');
  const totalCost = Number(row.total_cost || nuggetCost || 0);
  if (Number.isFinite(Number(nuggetCost)) && Number(nuggetCost) > 0 && totalCost !== Number(nuggetCost)) {
    throw new UnlockCostChanged('Unlock cost changed', { currentCost: totalCost });
  }
  return {
    ...row,
    total_cost: totalCost,
    remaining_nuggets: Number(row.remaining_nuggets),
  };
}

export async function unlockProperty(propertyId, intentToken, options = {}) {
  const cleanPropertyId = asUuidOrNull(propertyId);
  const token = asUuidOrNull(intentToken);
  if (!cleanPropertyId) throw new UnlockServiceError('Valid propertyId is required', { code: 'invalid_property_id' });
  if (!token) throw new InvalidToken('Unlock intent token is required');
  const data = await rpc('ds_purchase_property_unlock', {
    p_property_id: cleanPropertyId,
    p_mode: options.mode || 'normal',
    p_metadata: options.metadata || {},
    p_intent_token: token,
  });
  const row = pickRow(data);
  if (!row?.unlock_id && !row?.id) throw new UnlockServiceError('Property unlock did not return a persisted record');
  return row;
}

export async function purchaseExclusivity(propertyId, contactId, intentToken) {
  const cleanPropertyId = asUuidOrNull(propertyId);
  const sellerId = asUuidOrNull(contactId);
  const token = asUuidOrNull(intentToken);
  if (!cleanPropertyId) throw new UnlockServiceError('Valid propertyId is required', { code: 'invalid_property_id' });
  if (!sellerId) throw new UnlockServiceError('Valid contactId is required', { code: 'invalid_contact_id' });
  if (!token) throw new InvalidToken('Unlock intent token is required');
  const data = await rpc('ds_purchase_exclusivity_unlock', {
    p_property_id: cleanPropertyId,
    p_seller_id: sellerId,
    p_intent_token: token,
    p_metadata: { source: 'unlock_service_exclusivity' },
  });
  const row = pickRow(data);
  if (!row?.unlock_id && !row?.id) throw new UnlockServiceError('Exclusivity purchase did not return a persisted record');
  return row;
}

export async function getActiveExclusivities(userId) {
  const cleanUserId = asUuidOrNull(userId);
  const data = await rpc('ds_get_active_exclusivities', { p_user_id: cleanUserId });
  return Array.isArray(data) ? data : [];
}

export async function getUserUnlockState(userId) {
  const cleanUserId = asUuidOrNull(userId);
  const data = await rpc('ds_get_user_unlock_state', { p_user_id: cleanUserId });
  return {
    contactSnapshots: Array.isArray(data?.contact_snapshots) ? data.contact_snapshots : [],
    unlocks: Array.isArray(data?.unlocks) ? data.unlocks : [],
    propertyUnlocks: Array.isArray(data?.property_unlocks) ? data.property_unlocks : [],
  };
}

export async function checkIsUnlocked(contactId, userId) {
  const sellerId = asUuidOrNull(contactId);
  const cleanUserId = asUuidOrNull(userId);
  if (!sellerId) throw new UnlockServiceError('Valid contactId is required', { code: 'invalid_contact_id' });
  const data = await rpc('ds_check_is_unlocked', {
    p_contact_id: sellerId,
    p_user_id: cleanUserId,
  });
  const row = pickRow(data);
  return {
    isUnlocked: row?.is_unlocked === true,
    unlockId: row?.unlock_id || null,
    sellerId: row?.seller_id || sellerId,
    nuggetsSpent: Number(row?.nuggets_spent || 0),
    createdAt: row?.created_at || null,
  };
}
