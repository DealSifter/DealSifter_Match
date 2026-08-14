import { calculateDealMetrics } from './dealMetrics.ts';
import type { DealMetricsResult } from './dealMetrics.ts';
import { analyzeDealFacts } from './dealAdvisor.ts';
import { identifyPropertyServiceNeeds } from './propertyServiceNeeds.ts';
import type {
  DealAdvisorAnalysis,
  MaxxisPropertyDetails,
  PropertyServiceMatch,
  PropertyServiceNeed,
} from './types.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGES = 12;

export type GetPropertyDetailsInput = {
  propertyId: string;
  includeServiceMatches?: boolean;
  includeOperationalContext?: boolean;
};

export type NormalizedPropertyDetailsResult = {
  found: boolean;
  property: MaxxisPropertyDetails | null;
  missingFields: string[];
};

export type PropertyDetailsLookupResult = NormalizedPropertyDetailsResult & {
  metrics: DealMetricsResult | null;
  analysis: DealAdvisorAnalysis | null;
  serviceNeeds: PropertyServiceNeed[];
  serviceMatches: PropertyServiceMatch[] | null;
};

type SupabaseLikeClient = {
  rpc: (name: string, args: Record<string, unknown>) => any;
};

const cleanText = (value: unknown, max = 500) => String(value || '')
  .replace(/[\u0000-\u001F\u007F]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const cleanPublicNarrative = (value: unknown, max = 500) => cleanText(value, max)
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted]')
  .replace(/https?:\/\/\S+/gi, '[redacted]')
  .replace(/(?:\+?\d[\d().\s-]{7,}\d)/g, '[redacted]');

const cleanNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

function cleanPublicImageUrl(value: unknown) {
  const raw = cleanText(value, 2_000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    if (/\/storage\/v1\/object\/sign\//i.test(url.pathname)) return '';
    const sensitiveQueryKey = Array.from(url.searchParams.keys()).some((key) => (
      /^(token|signature|sig|expires|x-amz-|x-goog-)/i.test(key)
    ));
    return sensitiveQueryKey ? '' : url.href.slice(0, 2_000);
  } catch {
    return '';
  }
}

export function validateGetPropertyDetailsInput(value: unknown): GetPropertyDetailsInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_PROPERTY_DETAILS_INPUT');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !['propertyId', 'includeServiceMatches', 'includeOperationalContext'].includes(key))) throw new Error('INVALID_PROPERTY_DETAILS_INPUT');
  if (raw.includeServiceMatches !== undefined && typeof raw.includeServiceMatches !== 'boolean') {
    throw new Error('INVALID_PROPERTY_DETAILS_INPUT');
  }
  if (raw.includeOperationalContext !== undefined && typeof raw.includeOperationalContext !== 'boolean') {
    throw new Error('INVALID_PROPERTY_DETAILS_INPUT');
  }
  const propertyId = cleanText(raw.propertyId, 50);
  if (!UUID_PATTERN.test(propertyId)) throw new Error('INVALID_PROPERTY_ID');
  return {
    propertyId,
    ...(raw.includeServiceMatches === true ? { includeServiceMatches: true } : {}),
    ...(raw.includeOperationalContext === true ? { includeOperationalContext: true } : {}),
  };
}

export function resolvePropertyDetailsInput(toolArgs: unknown, trustedPropertyId: unknown): GetPropertyDetailsInput {
  const input = validateGetPropertyDetailsInput(toolArgs);
  const contextId = cleanText(trustedPropertyId, 50);
  if (!UUID_PATTERN.test(contextId)) throw new Error('PROPERTY_CONTEXT_REQUIRED');
  if (input.propertyId.toLowerCase() !== contextId.toLowerCase()) throw new Error('PROPERTY_CONTEXT_MISMATCH');
  return {
    propertyId: contextId,
    ...(input.includeServiceMatches === true ? { includeServiceMatches: true } : {}),
    ...(input.includeOperationalContext === true ? { includeOperationalContext: true } : {}),
  };
}

export function normalizePropertyDetails(row: Record<string, any>, imageRows: Array<Record<string, any>> = []): NormalizedPropertyDetailsResult {
  const property: MaxxisPropertyDetails = {
    id: cleanText(row.id, 50),
    type: cleanText(row.type, 100),
    city: cleanText(row.city, 120),
    state: cleanText(row.state, 2).toUpperCase(),
    zip: cleanText(row.zip, 10),
    price: cleanNumber(row.price),
    beds: cleanNumber(row.beds),
    baths: cleanNumber(row.baths),
    sqft: cleanText(row.sqft, 40),
    improvement: cleanPublicNarrative(row.improvement, 300),
    lot: cleanPublicNarrative(row.lot, 120),
    dealTag: cleanPublicNarrative(row.deal_tag, 100),
    objective: cleanPublicNarrative(row.objective, 160),
    rehab: cleanNumber(row.rehab),
    capRate: cleanNumber(row.cap_rate),
    description: cleanPublicNarrative(row.description, 2_000),
    markets: Array.isArray(row.markets)
      ? row.markets.map((market: unknown) => cleanText(market, 120)).filter(Boolean).slice(0, 12)
      : [],
    images: imageRows.map((image) => cleanPublicImageUrl(image.image_url)).filter(Boolean).slice(0, MAX_IMAGES),
    published: row.publish_to_showcase === true,
    dealClosed: row.deal_closed === true,
  };

  const missingFields = [
    ...(!property.type ? ['type'] : []),
    ...(!property.city ? ['city'] : []),
    ...(!property.state ? ['state'] : []),
    ...(!property.zip ? ['zip'] : []),
    ...(property.price === null || property.price <= 0 ? ['price'] : []),
    ...(!property.sqft ? ['sqft'] : []),
    ...(!property.objective ? ['objective'] : []),
    ...(property.rehab === null || property.rehab <= 0 ? ['rehab'] : []),
    ...(property.capRate === null ? ['cap_rate'] : []),
    ...(!property.description ? ['description'] : []),
    ...(!property.images.length ? ['images'] : []),
  ];

  return { found: true, property, missingFields };
}

export async function getPropertyDetailsWithClient(
  input: GetPropertyDetailsInput,
  client: SupabaseLikeClient,
): Promise<PropertyDetailsLookupResult> {
  const { data: row, error } = await client
    .rpc('ds_get_public_property_details', { p_property_id: input.propertyId })
    .maybeSingle();

  if (error) throw new Error('PROPERTY_DETAILS_FAILED');
  if (!row) return { found: false, property: null, missingFields: [], metrics: null, analysis: null, serviceNeeds: [], serviceMatches: null };
  const normalized = normalizePropertyDetails(
    row,
    (Array.isArray(row.images) ? row.images : []).map((image_url: unknown) => ({ image_url })),
  );
  const property = normalized.property;
  const metrics = property ? calculateDealMetrics({
    price: property.price,
    sqft: property.sqft,
    rehab: property.rehab,
    capRate: property.capRate,
  }) : null;
  const analysis = property && metrics ? analyzeDealFacts({
    property,
    metrics,
    missingFields: normalized.missingFields,
  }) : null;
  const serviceNeeds = property && metrics && analysis ? identifyPropertyServiceNeeds({
    property,
    metrics,
    analysis,
  }) : [];

  return { ...normalized, metrics, analysis, serviceNeeds, serviceMatches: null };
}
