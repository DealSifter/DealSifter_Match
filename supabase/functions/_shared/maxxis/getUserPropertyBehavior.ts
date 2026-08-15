import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import type { UserPropertyBehavior, UserPropertyBehaviorAction } from './types.ts';

export const BEHAVIOR_WINDOW_DAYS = 90;
export const BEHAVIOR_ACTION_LIMIT = 100;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const emptyBehavior = (actionCount = 0): UserPropertyBehavior => ({
  actions: [],
  actionCount,
  resolvedActionCount: 0,
  historyAvailable: false,
  windowDays: BEHAVIOR_WINDOW_DAYS,
  limit: BEHAVIOR_ACTION_LIMIT,
});

export async function getUserPropertyBehaviorWithClient(
  userId: string,
  client: ReturnType<typeof createClient>,
): Promise<UserPropertyBehavior> {
  if (!userId) throw new Error('AUTH_REQUIRED');
  const cutoff = new Date(Date.now() - BEHAVIOR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: actionRows, error: actionError } = await client
    .from('user_feed_actions')
    .select('action, entity_type, entity_id, updated_at')
    .eq('user_id', userId)
    .eq('action', 'interested')
    .eq('entity_type', 'property')
    .gte('updated_at', cutoff)
    .order('updated_at', { ascending: false })
    .limit(BEHAVIOR_ACTION_LIMIT);
  if (actionError) throw new Error('PROPERTY_BEHAVIOR_READ_FAILED');

  const rows = Array.isArray(actionRows) ? actionRows : [];
  const propertyIds = Array.from(new Set(rows.map((row) => String(row.entity_id || '').trim()).filter((id) => UUID_PATTERN.test(id))));
  if (!propertyIds.length) return emptyBehavior(rows.length);

  const { data: propertyRows, error: propertyError } = await client
    .rpc('ds_search_public_properties', {
      p_property_ids: propertyIds,
      p_limit: Math.min(propertyIds.length, BEHAVIOR_ACTION_LIMIT),
    });
  if (propertyError) throw new Error('PROPERTY_BEHAVIOR_PROPERTIES_FAILED');

  const propertiesById = new Map((Array.isArray(propertyRows) ? propertyRows : []).map((property) => [String(property.id), property]));
  const actions = rows.flatMap((row): UserPropertyBehaviorAction[] => {
    const entityId = String(row.entity_id || '').trim();
    const property = propertiesById.get(entityId);
    if (!property) return [];
    return [{
      action: 'interested',
      signal: 'positive',
      entityId,
      updatedAt: String(row.updated_at || ''),
      property: {
        id: entityId,
        city: property.city,
        state: property.state,
        price: property.price,
        type: property.type,
        objective: property.objective,
      },
    }];
  });
  return {
    actions,
    actionCount: rows.length,
    resolvedActionCount: actions.length,
    historyAvailable: actions.length > 0,
    windowDays: BEHAVIOR_WINDOW_DAYS,
    limit: BEHAVIOR_ACTION_LIMIT,
  };
}

export async function getUserPropertyBehavior(authHeader: string): Promise<UserPropertyBehavior> {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('AUTH_REQUIRED');
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await client.auth.getUser(token);
  if (authError || !user) throw new Error('AUTH_REQUIRED');
  return getUserPropertyBehaviorWithClient(user.id, client);
}
