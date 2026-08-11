import { createClient } from 'npm:@supabase/supabase-js@2';
import { supabaseAnonKey, supabaseUrl } from './config.ts';
import type { MaxxisServiceResult, ProviderContactAccess } from './types.ts';

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;
const FETCH_LIMIT = 250;
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

const includesNormalized = (value: unknown, search: string) => String(value || '').toLowerCase().includes(search.toLowerCase());

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

export async function searchServices(input: unknown, authHeader: string): Promise<MaxxisServiceResult[]> {
  const filters = validateSearchServicesInput(input);
  const client = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data, error } = await client.from('services')
    .select('id, title, category, description, price, media_images, markets, publish_to_connections, created_at')
    .eq('publish_to_connections', true)
    .order('created_at', { ascending: false })
    .limit(FETCH_LIMIT);
  if (error) throw new Error('SERVICE_SEARCH_FAILED');

  const services = (Array.isArray(data) ? data : [])
    .filter((row) => {
      const markets = Array.isArray(row.markets) ? row.markets.map((market) => cleanText(market, 120)) : [];
      const categoryMatches = !filters.category || includesNormalized(row.category, filters.category);
      const stateMatches = !filters.state || markets.some((market) => {
        const normalized = market.toLowerCase();
        const stateName = Object.entries(STATE_NAMES).find(([, code]) => code === filters.state)?.[0] || '';
        const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
        return normalized === filters.state!.toLowerCase() || normalized === stateName || tokens.includes(filters.state!.toLowerCase());
      });
      const cityMatches = !filters.city || markets.some((market) => includesNormalized(market, filters.city!));
      const keywordMatches = !filters.keyword || [row.title, row.category, row.description].some((field) => includesNormalized(field, filters.keyword!));
      const price = row.price === null || row.price === undefined ? null : Number(row.price);
      return categoryMatches && stateMatches && cityMatches && keywordMatches
        && (filters.minPrice === undefined || (price !== null && Number.isFinite(price) && price >= filters.minPrice))
        && (filters.maxPrice === undefined || (price !== null && Number.isFinite(price) && price <= filters.maxPrice));
    })
    .slice(0, filters.limit || DEFAULT_LIMIT)
    .map((row) => ({
      id: String(row.id),
      title: cleanText(row.title),
      serviceType: cleanText(row.category),
      description: cleanText(row.description, 500),
      price: row.price === null || row.price === undefined || !Number.isFinite(Number(row.price)) ? null : Number(row.price),
      markets: Array.isArray(row.markets) ? row.markets.map((market) => cleanText(market, 120)).filter(Boolean).slice(0, 12) : [],
      image: Array.isArray(row.media_images) ? cleanText(row.media_images[0], 2_000) : '',
    }));
  const accessByServiceId = await getProviderContactAccess(client, services.map((service) => service.id));
  return services.map((service) => ({
    ...service,
    contactAccess: accessByServiceId.get(service.id) || { status: 'unavailable', cost: null, currency: 'nuggets', reason: 'access_quote_missing' },
  }));
}
