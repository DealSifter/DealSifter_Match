import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import type { MaxxisServiceResult, ProviderContactAccess } from './types.ts';

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;
const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};
const STATE_CODES = new Set(Object.values(STATE_NAMES));

export type SearchServicesInput = {
  category?: string;
  state?: string;
  city?: string;
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
};

const cleanText = (value: unknown, max = 100) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
const cleanMoney = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100_000_000 ? number : undefined;
};

function normalizeState(value: unknown) {
  const text = cleanText(value, 40).toLowerCase();
  const code = text.length === 2 ? text.toUpperCase() : STATE_NAMES[text];
  return code && STATE_CODES.has(code) ? code : '';
}

export function validateSearchServicesInput(value: unknown): SearchServicesInput {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const minPrice = cleanMoney(raw.minPrice);
  const maxPrice = cleanMoney(raw.maxPrice);
  const limitRaw = Number(raw.limit);
  const category = cleanText(raw.category || raw.serviceType);
  const state = normalizeState(raw.state);
  return {
    ...(category ? { category } : {}),
    ...(state ? { state } : {}),
    ...(cleanText(raw.city) ? { city: cleanText(raw.city) } : {}),
    ...(cleanText(raw.keyword, 160) ? { keyword: cleanText(raw.keyword, 160) } : {}),
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice: Math.max(maxPrice, minPrice ?? 0) } : {}),
    limit: Number.isFinite(limitRaw) ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitRaw))) : DEFAULT_LIMIT,
  };
}

const categoryKey = (value: unknown) => cleanText(value).toLowerCase();

function normalizeContactAccess(row: Record<string, unknown> | null): ProviderContactAccess {
  const status = String(row?.status || 'unavailable');
  return {
    status: ['locked', 'already_unlocked', 'insufficient_balance', 'unavailable'].includes(status)
      ? status as ProviderContactAccess['status']
      : 'unavailable',
    cost: Number.isFinite(Number(row?.cost)) ? Number(row?.cost) : null,
    currency: 'nuggets',
    profileScope: ['personal', 'professional', 'fsbo'].includes(String(row?.profile_scope || row?.profileScope))
      ? String(row?.profile_scope || row?.profileScope) as ProviderContactAccess['profileScope']
      : undefined,
    reason: row?.reason ? String(row.reason) : null,
  };
}

async function getProviderContactAccess(
  client: ReturnType<typeof createClient>,
  serviceIds: string[],
): Promise<Map<string, ProviderContactAccess>> {
  if (!serviceIds.length) return new Map();
  try {
    const { data, error } = await client.rpc('ds_get_provider_contact_access', { p_service_ids: serviceIds });
    if (error) throw error;
    return new Map((Array.isArray(data) ? data : []).map((row) => [
      String(row.service_id || row.serviceId || ''),
      normalizeContactAccess(row as Record<string, unknown>),
    ]).filter(([id]) => id));
  } catch {
    return new Map(serviceIds.map((id) => [id, { status: 'unavailable', cost: null, currency: 'nuggets', reason: 'access_quote_unavailable' }]));
  }
}

export type SearchServicesMetrics = {
  dbDurationMs: number;
  queryCount: number;
  rowsReturned: number;
  payloadBytes: number;
};

export type SearchServicesBatchResult = {
  items: MaxxisServiceResult[];
  itemsByCategory: Map<string, MaxxisServiceResult[]>;
  metrics: SearchServicesMetrics;
};

export async function searchServicesBatch(inputs: unknown[], authHeader: string): Promise<SearchServicesBatchResult> {
  const filtersList = (Array.isArray(inputs) && inputs.length ? inputs : [{}])
    .slice(0, 10)
    .map(validateSearchServicesInput);
  const sharedFilters = filtersList[0];
  const categories = Array.from(new Set(filtersList.map((filters) => filters.category).filter(Boolean)));
  const limit = Math.max(...filtersList.map((filters) => filters.limit || DEFAULT_LIMIT));
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const dbStartedAt = Date.now();
  const { data, error } = await client.rpc('ds_search_public_services', {
    p_categories: categories.length ? categories : null,
    p_state: sharedFilters.state || null,
    p_city: sharedFilters.city || null,
    p_keyword: sharedFilters.keyword || null,
    p_min_price: sharedFilters.minPrice ?? null,
    p_max_price: sharedFilters.maxPrice ?? null,
    p_limit_per_category: limit,
  });
  if (error) throw new Error('SERVICE_SEARCH_FAILED');
  const rows = Array.isArray(data) ? data : [];
  const mappedRows = rows.map((row) => ({
    matchedCategory: cleanText(row.matched_category),
    service: {
      id: String(row.id),
      title: cleanText(row.title),
      serviceType: cleanText(row.category),
      description: cleanText(row.description, 500),
      price: row.price === null || row.price === undefined || !Number.isFinite(Number(row.price)) ? null : Number(row.price),
      markets: Array.isArray(row.markets) ? row.markets.map((market) => cleanText(market, 120)).filter(Boolean).slice(0, 12) : [],
      image: Array.isArray(row.media_images) ? cleanText(row.media_images[0], 2_000) : '',
    } as MaxxisServiceResult,
  }));
  const serviceIds = Array.from(new Set(mappedRows.map(({ service }) => service.id)));
  const accessByServiceId = await getProviderContactAccess(client, serviceIds);
  const itemsByCategory = new Map<string, MaxxisServiceResult[]>();
  const items: MaxxisServiceResult[] = [];
  const seenItems = new Set<string>();
  mappedRows.forEach(({ matchedCategory, service }) => {
    const item = {
      ...service,
      contactAccess: accessByServiceId.get(service.id) || { status: 'unavailable', cost: null, currency: 'nuggets', reason: 'access_quote_missing' },
    } as MaxxisServiceResult;
    const key = categoryKey(matchedCategory);
    itemsByCategory.set(key, [...(itemsByCategory.get(key) || []), item]);
    if (!seenItems.has(item.id)) {
      seenItems.add(item.id);
      items.push(item);
    }
  });
  const dbDurationMs = Date.now() - dbStartedAt;
  return {
    items,
    itemsByCategory,
    metrics: {
      dbDurationMs,
      queryCount: 1 + Number(serviceIds.length > 0),
      rowsReturned: rows.length,
      payloadBytes: new TextEncoder().encode(JSON.stringify(rows)).byteLength,
    },
  };
}

export async function searchServicesWithMetrics(input: unknown, authHeader: string): Promise<SearchServicesBatchResult> {
  return searchServicesBatch([input], authHeader);
}

export async function searchServices(input: unknown, authHeader: string): Promise<MaxxisServiceResult[]> {
  return (await searchServicesWithMetrics(input, authHeader)).items;
}
