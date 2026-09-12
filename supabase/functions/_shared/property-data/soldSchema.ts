import type { NormalizedSoldRecordPool, RecordedSaleTransaction, SoldPropertyRecord } from './soldTypes.ts';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nullableNumber = (value: unknown) => value === null || finite(value);
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const iso = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

function transaction(value: unknown): value is RecordedSaleTransaction {
  return object(value) && iso(value.saleDate) && finite(value.salePrice) && value.salePrice > 0
    && value.evidenceStatus === 'VERIFIED_RECORD' && value.source === 'rentcast_property_record';
}

function record(value: unknown): value is SoldPropertyRecord {
  if (!object(value) || value.provider !== 'rentcast' || !iso(value.retrievedAt)) return false;
  const textFields = ['providerPropertyId', 'assessorId', 'formattedAddress', 'addressLine1', 'city', 'state', 'zipCode', 'propertyType'];
  const numberFields = ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'livingAreaSqft', 'lotSizeSqft', 'yearBuilt'];
  return textFields.every((field) => nullableText(value[field]))
    && numberFields.every((field) => nullableNumber(value[field]))
    && Array.isArray(value.saleTransactions) && value.saleTransactions.every(transaction)
    && (value.latestValidSale === null || transaction(value.latestValidSale))
    && typeof value.saleTransactionAmbiguous === 'boolean'
    && value.transactionQuality === 'UNKNOWN';
}

export function isNormalizedSoldRecordPool(value: unknown): value is NormalizedSoldRecordPool {
  if (!object(value) || value.provider !== 'rentcast' || value.evidenceType !== 'property_sold_record_pool'
    || value.schemaVersion !== 1 || !iso(value.retrievedAt) || !/^[0-9a-f]{64}$/i.test(String(value.queryFingerprint || ''))
    || !finite(value.recordsReturned) || value.recordsReturned < 0 || !Array.isArray(value.records)
    || value.recordsReturned < value.records.length || !value.records.every(record) || !object(value.requestPolicy)) return false;
  const policy = value.requestPolicy;
  return finite(policy.radiusMiles) && policy.radiusMiles > 0
    && finite(policy.saleDateRangeDays) && policy.saleDateRangeDays >= 1
    && typeof policy.propertyType === 'string' && Boolean(policy.propertyType.trim())
    && finite(policy.limit) && Number.isInteger(policy.limit) && policy.limit >= 1 && policy.limit <= 500;
}

export function serializeNormalizedSoldRecordPool(value: NormalizedSoldRecordPool) {
  const serialized = JSON.parse(JSON.stringify(value)) as unknown;
  if (!isNormalizedSoldRecordPool(serialized)) throw new Error('INVALID_NORMALIZED_SOLD_RECORD_POOL');
  return serialized;
}
