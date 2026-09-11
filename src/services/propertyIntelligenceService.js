import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pendingRequests = new Map();

export function isPropertyIntelligenceId(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

export async function fetchPropertyIntelligence(propertyId, invoke = null) {
  const cleanPropertyId = String(propertyId || '').trim();
  if (!isPropertyIntelligenceId(cleanPropertyId)) throw new Error('INVALID_PROPERTY');
  if (!invoke && (!isSupabaseConfigured || !supabase)) {
    return { success: true, state: 'locked', entitled: false, authRequired: true };
  }
  if (!invoke) {
    const { data } = await supabase.auth.getSession();
    if (!data?.session) return { success: true, state: 'locked', entitled: false, authRequired: true };
  }
  if (pendingRequests.has(cleanPropertyId)) return pendingRequests.get(cleanPropertyId);
  const request = (async () => {
    const invokeFunction = invoke || ((body) => supabase.functions.invoke('property-intelligence', { body }));
    const { data, error } = await invokeFunction({ propertyId: cleanPropertyId });
    if (error) throw new Error('PROPERTY_INTELLIGENCE_UNAVAILABLE');
    if (!data || !['hidden', 'locked', 'unlocked', 'unavailable'].includes(data.state)) {
      throw new Error('PROPERTY_INTELLIGENCE_UNAVAILABLE');
    }
    return data;
  })();
  pendingRequests.set(cleanPropertyId, request);
  try {
    return await request;
  } finally {
    if (pendingRequests.get(cleanPropertyId) === request) pendingRequests.delete(cleanPropertyId);
  }
}
