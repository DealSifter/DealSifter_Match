import { parseDealMetricNumber } from './dealMetrics.ts';
import type {
  MaxxisComparisonProperty,
  PropertyComparisonCriterion,
  PropertyComparisonResult,
} from './types.ts';
import type { PropertyDetailsLookupResult } from './propertyDetails.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MIN_COMPARE_PROPERTIES = 2;
export const MAX_COMPARE_PROPERTIES = 3;
export const MAX_COMPARISON_CONTEXT_IDS = 20;

export type ComparePropertiesInput = {
  propertyIds: string[];
};

type PropertyDetailsLookup = (propertyId: string) => Promise<PropertyDetailsLookupResult>;

function cleanId(value: unknown) {
  return String(value || '').trim();
}

function normalizeUniqueIds(values: unknown[], limit: number) {
  const ids: string[] = [];
  const seen = new Set<string>();
  values.forEach((value) => {
    const id = cleanId(value);
    const key = id.toLowerCase();
    if (!UUID_PATTERN.test(id) || seen.has(key) || ids.length >= limit) return;
    seen.add(key);
    ids.push(id);
  });
  return ids;
}

export function normalizeComparisonContextIds(value: unknown): string[] {
  return normalizeUniqueIds(Array.isArray(value) ? value : [], MAX_COMPARISON_CONTEXT_IDS);
}

export function validateComparePropertiesInput(value: unknown): ComparePropertiesInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_COMPARE_PROPERTIES_INPUT');
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => key !== 'propertyIds') || !Array.isArray(raw.propertyIds)) {
    throw new Error('INVALID_COMPARE_PROPERTIES_INPUT');
  }
  if (raw.propertyIds.some((id) => !UUID_PATTERN.test(cleanId(id)))) throw new Error('INVALID_PROPERTY_ID');
  const propertyIds = normalizeUniqueIds(raw.propertyIds, MAX_COMPARE_PROPERTIES + 1);
  if (propertyIds.length < MIN_COMPARE_PROPERTIES) throw new Error('PROPERTY_COMPARISON_MIN_REQUIRED');
  if (raw.propertyIds.length > MAX_COMPARE_PROPERTIES || propertyIds.length > MAX_COMPARE_PROPERTIES) {
    throw new Error('PROPERTY_COMPARISON_LIMIT_EXCEEDED');
  }
  if (propertyIds.length !== raw.propertyIds.length) throw new Error('INVALID_COMPARE_PROPERTIES_INPUT');
  return { propertyIds };
}

export function resolveComparePropertiesInput(
  toolArgs: unknown,
  trustedPropertyIds: unknown,
): ComparePropertiesInput {
  const input = validateComparePropertiesInput(toolArgs);
  const allowedIds = normalizeComparisonContextIds(trustedPropertyIds);
  if (allowedIds.length < MIN_COMPARE_PROPERTIES) throw new Error('PROPERTY_COMPARISON_CONTEXT_REQUIRED');
  const allowedByKey = new Map(allowedIds.map((id) => [id.toLowerCase(), id]));
  if (input.propertyIds.some((id) => !allowedByKey.has(id.toLowerCase()))) {
    throw new Error('PROPERTY_COMPARISON_CONTEXT_MISMATCH');
  }
  return { propertyIds: input.propertyIds.map((id) => allowedByKey.get(id.toLowerCase())!) };
}

function safeComparisonProperty(property: NonNullable<PropertyDetailsLookupResult['property']>): MaxxisComparisonProperty {
  return {
    id: property.id,
    type: property.type,
    city: property.city,
    state: property.state,
    zip: property.zip,
    price: property.price,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    objective: property.objective,
    rehab: property.rehab,
    capRate: property.capRate,
  };
}

function validStoredNumber(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function criterion(
  properties: PropertyComparisonResult['properties'],
  source: PropertyComparisonCriterion['source'],
  readValue: (item: PropertyComparisonResult['properties'][number]) => number | null,
): PropertyComparisonCriterion {
  const entries = properties.flatMap((item) => {
    const value = readValue(item);
    return value === null || !Number.isFinite(value) ? [] : [{ propertyId: item.id, value }];
  });
  const comparedKeys = new Set(entries.map((entry) => entry.propertyId.toLowerCase()));
  const comparable = entries.length >= MIN_COMPARE_PROPERTIES;
  if (!comparable) {
    return {
      source,
      comparable: false,
      comparedPropertyIds: entries.map((entry) => entry.propertyId),
      unavailablePropertyIds: properties.filter((item) => !comparedKeys.has(item.id.toLowerCase())).map((item) => item.id),
      lowestPropertyIds: [],
      highestPropertyIds: [],
    };
  }
  const lowest = Math.min(...entries.map((entry) => entry.value));
  const highest = Math.max(...entries.map((entry) => entry.value));
  return {
    source,
    comparable: true,
    comparedPropertyIds: entries.map((entry) => entry.propertyId),
    unavailablePropertyIds: properties.filter((item) => !comparedKeys.has(item.id.toLowerCase())).map((item) => item.id),
    lowestPropertyIds: entries.filter((entry) => entry.value === lowest).map((entry) => entry.propertyId),
    highestPropertyIds: entries.filter((entry) => entry.value === highest).map((entry) => entry.propertyId),
  };
}

export async function comparePropertiesWithLookup(
  input: unknown,
  lookup: PropertyDetailsLookup,
): Promise<PropertyComparisonResult> {
  const validated = validateComparePropertiesInput(input);
  const details = await Promise.all(validated.propertyIds.map((propertyId) => lookup(propertyId)));
  const unavailable = details.some((result, index) => (
    !result.found
    || !result.property
    || !result.metrics
    || result.property.id.toLowerCase() !== validated.propertyIds[index].toLowerCase()
  ));
  if (unavailable) throw new Error('PROPERTY_COMPARISON_UNAVAILABLE');

  const properties = details.map((result) => ({
    id: result.property!.id,
    property: safeComparisonProperty(result.property!),
    missingFields: [...result.missingFields],
    metrics: result.metrics!,
  }));

  return {
    properties,
    comparison: {
      price: criterion(properties, 'stored', (item) => validStoredNumber(item.property.price)),
      sqft: criterion(properties, 'stored', (item) => parseDealMetricNumber(item.property.sqft, 'sqft')),
      rehab: criterion(properties, 'stored', (item) => validStoredNumber(item.property.rehab)),
      pricePerSqft: criterion(properties, 'calculated', (item) => {
        const metric = item.metrics.metrics.pricePerSqft;
        return metric.calculable && metric.source === 'calculated' ? metric.value : null;
      }),
      acquisitionPlusRehab: criterion(properties, 'calculated', (item) => {
        const metric = item.metrics.metrics.acquisitionPlusRehab;
        return metric.calculable && metric.source === 'calculated' ? metric.value : null;
      }),
      capRate: criterion(properties, 'stored', (item) => {
        const metric = item.metrics.metrics.capRate;
        return metric.calculable && metric.source === 'stored' ? metric.value : null;
      }),
    },
  };
}
