import { PropertyDataError, type Evidence, type NormalizedPropertyRecord } from '../types.ts';
import type { RentCastPropertyRecordRaw } from './rentcastTypes.ts';

const textValue = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const booleanValue = (value: unknown) => typeof value === 'boolean' ? value : null;

function evidence<T>(
  value: T | null,
  metadata: { retrievedAt: string; providerPropertyId: string },
  effectiveDate: string | null = null,
): Evidence<T> {
  return value === null
    ? { value: null, status: 'UNAVAILABLE', source: 'rentcast', retrievedAt: metadata.retrievedAt, effectiveDate: null, providerPropertyId: metadata.providerPropertyId, confidence: null }
    : { value, status: 'VERIFIED_RECORD', source: 'rentcast', retrievedAt: metadata.retrievedAt, effectiveDate, providerPropertyId: metadata.providerPropertyId, confidence: null };
}

function latestYearEntry<T extends { year?: unknown }>(input: Record<string, T> | null | undefined) {
  return Object.entries(input || {})
    .map(([key, value]) => ({ year: numberValue(value?.year) ?? (/^\d{4}$/.test(key) ? Number(key) : null), value }))
    .filter((entry): entry is { year: number; value: T } => entry.year !== null && entry.year >= 1800 && entry.year <= 2200)
    .sort((a, b) => b.year - a.year)[0] || null;
}

function latestSale(record: RentCastPropertyRecordRaw) {
  const candidates = Object.values(record.history || {})
    .filter((entry) => String(entry?.event || '').toLowerCase() === 'sale')
    .map((entry) => ({ date: textValue(entry.date), price: numberValue(entry.price) }))
    .concat([{ date: textValue(record.lastSaleDate), price: numberValue(record.lastSalePrice) }])
    .filter((entry): entry is { date: string; price: number | null } => Boolean(entry.date) && Number.isFinite(Date.parse(entry.date as string)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return candidates[0] || null;
}

export function mapRentCastProperty(record: RentCastPropertyRecordRaw, retrievedAt = new Date().toISOString()): NormalizedPropertyRecord {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { billableSuccess: true, httpStatus: 200 });
  const providerPropertyId = textValue(record.id);
  if (!providerPropertyId) throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { billableSuccess: true, httpStatus: 200 });
  const metadata = { retrievedAt, providerPropertyId };
  const assessment = latestYearEntry(record.taxAssessments);
  const propertyTax = latestYearEntry(record.propertyTaxes);
  const sale = latestSale(record);
  const ownerNames = Array.isArray(record.owner?.names)
    ? record.owner.names.map(textValue).filter((value): value is string => Boolean(value))
    : [];

  return {
    provider: 'rentcast',
    sourceMetadata: { source: 'rentcast', retrievedAt, providerPropertyId, confidence: null },
    identity: { providerPropertyId: evidence(providerPropertyId, metadata) },
    address: {
      formattedAddress: evidence(textValue(record.formattedAddress), metadata),
      addressLine1: evidence(textValue(record.addressLine1), metadata),
      city: evidence(textValue(record.city), metadata),
      state: evidence(textValue(record.state), metadata),
      zipCode: evidence(textValue(record.zipCode), metadata),
      county: evidence(textValue(record.county), metadata),
      latitude: evidence(numberValue(record.latitude), metadata),
      longitude: evidence(numberValue(record.longitude), metadata),
    },
    characteristics: {
      propertyType: evidence(textValue(record.propertyType), metadata),
      bedrooms: evidence(numberValue(record.bedrooms), metadata),
      bathrooms: evidence(numberValue(record.bathrooms), metadata),
      livingAreaSqft: evidence(numberValue(record.squareFootage), metadata),
      lotSizeSqft: evidence(numberValue(record.lotSize), metadata),
      yearBuilt: evidence(numberValue(record.yearBuilt), metadata),
    },
    ownership: {
      ownerNames: evidence(ownerNames.length ? ownerNames : null, metadata),
      ownerOccupied: evidence(booleanValue(record.ownerOccupied), metadata),
    },
    tax: {
      assessedValue: evidence(assessment ? numberValue(assessment.value.value) : null, metadata, assessment ? String(assessment.year) : null),
      assessmentYear: evidence(assessment?.year ?? null, metadata, assessment ? String(assessment.year) : null),
      annualPropertyTax: evidence(propertyTax ? numberValue(propertyTax.value.total) : null, metadata, propertyTax ? String(propertyTax.year) : null),
      propertyTaxYear: evidence(propertyTax?.year ?? null, metadata, propertyTax ? String(propertyTax.year) : null),
    },
    lastSale: {
      price: evidence(sale?.price ?? null, metadata, sale?.date ?? null),
      date: evidence(sale?.date ?? null, metadata, sale?.date ?? null),
    },
  };
}
