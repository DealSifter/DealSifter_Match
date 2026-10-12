import { invokeSupabaseFunction } from '../lib/supabaseClient';

export async function queryPublicParcels(query, { signal } = {}) {
  const { data, error } = await invokeSupabaseFunction('public-parcel', { body: query, signal });
  if (error) throw error;
  if (!data || !Array.isArray(data.parcels)) throw new Error('INVALID_PARCEL_RESPONSE');
  return data;
}
