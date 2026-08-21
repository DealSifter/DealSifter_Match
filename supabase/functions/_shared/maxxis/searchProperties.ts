import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import type { MaxxisPropertyResult } from './types.ts';

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;
const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);

export type SearchPropertiesInput = {
  state?: string[];
  city?: string;
  zipCode?: string;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  objective?: string;
  limit?: number;
};

const cleanText = (value: unknown, max = 80) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const cleanMoney = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100_000_000 ? number : undefined;
};

export function validateSearchPropertiesInput(value: unknown): SearchPropertiesInput {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const rawStates = Array.isArray(raw.state) ? raw.state : (raw.state ? [raw.state] : []);
  const state = Array.from(new Set(rawStates.map((item) => cleanText(item, 2).toUpperCase()).filter((item) => US_STATES.has(item)))).slice(0, 10);
  const minPrice = cleanMoney(raw.minPrice);
  const maxPrice = cleanMoney(raw.maxPrice);
  const beds = cleanMoney(raw.bedrooms);
  const baths = cleanMoney(raw.bathrooms);
  const limitRaw = Number(raw.limit);
  return {
    ...(state.length ? { state } : {}),
    ...(cleanText(raw.city) ? { city: cleanText(raw.city) } : {}),
    ...(cleanText(raw.zipCode, 10).match(/^\d{3,10}(-\d{1,4})?$/) ? { zipCode: cleanText(raw.zipCode, 10) } : {}),
    ...(cleanText(raw.propertyType) ? { propertyType: cleanText(raw.propertyType) } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice: Math.max(maxPrice, minPrice ?? 0) } : {}),
    ...(beds !== undefined ? { bedrooms: Math.min(20, Math.floor(beds)) } : {}),
    ...(baths !== undefined ? { bathrooms: Math.min(20, Math.floor(baths)) } : {}),
    ...(cleanText(raw.objective) ? { objective: cleanText(raw.objective) } : {}),
    limit: Number.isFinite(limitRaw) ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitRaw))) : DEFAULT_LIMIT,
  };
}

export async function searchProperties(input: unknown, authHeader: string): Promise<MaxxisPropertyResult[]> {
  const filters = validateSearchPropertiesInput(input);
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const rpcArgs = {
    ...(filters.state?.length ? { p_state: filters.state } : {}),
    ...(filters.city ? { p_city: filters.city } : {}),
    ...(filters.zipCode ? { p_zip_code: filters.zipCode } : {}),
    ...(filters.propertyType ? { p_property_type: filters.propertyType } : {}),
    ...(filters.minPrice !== undefined ? { p_min_price: filters.minPrice } : {}),
    ...(filters.maxPrice !== undefined ? { p_max_price: filters.maxPrice } : {}),
    ...(filters.bedrooms !== undefined ? { p_bedrooms: filters.bedrooms } : {}),
    ...(filters.bathrooms !== undefined ? { p_bathrooms: filters.bathrooms } : {}),
    ...(filters.objective ? { p_objective: filters.objective } : {}),
    p_limit: filters.limit || DEFAULT_LIMIT,
  };
  const { data, error } = await client.rpc('ds_search_public_properties', rpcArgs);
  if (error) throw new Error('PROPERTY_SEARCH_FAILED');
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({ id: String(row.id), title: cleanText(row.type || 'Property'), city: cleanText(row.city), state: cleanText(row.state, 2).toUpperCase(), zip: cleanText(row.zip, 10), price: Number(row.price || 0), propertyType: cleanText(row.type), bedrooms: Number(row.beds || 0), bathrooms: Number(row.baths || 0), sqft: cleanText(row.sqft), objective: cleanText(row.objective), image: cleanText(row.image, 2_000), status: 'active' }));
}
