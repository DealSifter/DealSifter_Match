import type { RentCastPropertyRecordRaw, RentCastSaleHistoryRaw } from './rentcast/rentcastTypes.ts';
import type { NormalizedSoldRecordPool, RecordedSaleTransaction, SoldPropertyRecord, SoldSearchPolicy } from './soldTypes.ts';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const positive = (value: unknown) => { const parsed = number(value); return parsed !== null && parsed > 0 ? parsed : null; };
const validDate = (value: unknown) => {
  const parsed = text(value);
  return parsed && Number.isFinite(Date.parse(parsed)) ? new Date(parsed).toISOString() : null;
};

export function extractRecordedSales(
  raw: RentCastPropertyRecordRaw,
  options: { retrievedAt: string; saleDateRangeDays: number },
): { transactions: RecordedSaleTransaction[]; latest: RecordedSaleTransaction | null; ambiguous: boolean } {
  const cutoff = Date.parse(options.retrievedAt) - options.saleDateRangeDays * 86_400_000;
  const now = Date.parse(options.retrievedAt);
  const candidates: RecordedSaleTransaction[] = [];
  const append = (dateValue: unknown, priceValue: unknown, event: unknown = 'Sale') => {
    const saleDate = validDate(dateValue);
    const salePrice = positive(priceValue);
    if (String(event || '').trim().toLowerCase() !== 'sale' || !saleDate || salePrice === null) return;
    const timestamp = Date.parse(saleDate);
    if (timestamp > now || timestamp < cutoff) return;
    candidates.push({ saleDate, salePrice, evidenceStatus: 'VERIFIED_RECORD', source: 'rentcast_property_record' });
  };
  if (raw.history && typeof raw.history === 'object') {
    Object.entries(raw.history).forEach(([key, entry]) => {
      const value = entry as RentCastSaleHistoryRaw;
      append(value?.date || key, value?.price, value?.event);
    });
  }
  append(raw.lastSaleDate, raw.lastSalePrice);
  const deduped = [...new Map(candidates.map((item) => [`${item.saleDate}|${item.salePrice}`, item])).values()]
    .sort((left, right) => Date.parse(right.saleDate) - Date.parse(left.saleDate));
  const latest = deduped[0] || null;
  const ambiguous = Boolean(latest && deduped.some((item, index) => index > 0
    && item.saleDate === latest.saleDate && item.salePrice !== latest.salePrice));
  return { transactions: deduped, latest, ambiguous };
}

function mapRecord(raw: RentCastPropertyRecordRaw, retrievedAt: string, policy: SoldSearchPolicy): SoldPropertyRecord {
  const sales = extractRecordedSales(raw, { retrievedAt, saleDateRangeDays: policy.saleDateRangeDays });
  return {
    provider: 'rentcast', providerPropertyId: text(raw.id), assessorId: text(raw.assessorID), retrievedAt,
    formattedAddress: text(raw.formattedAddress), addressLine1: text(raw.addressLine1), city: text(raw.city),
    state: text(raw.state), zipCode: text(raw.zipCode), latitude: number(raw.latitude), longitude: number(raw.longitude),
    propertyType: text(raw.propertyType), bedrooms: number(raw.bedrooms), bathrooms: number(raw.bathrooms),
    livingAreaSqft: positive(raw.squareFootage), lotSizeSqft: positive(raw.lotSize), yearBuilt: positive(raw.yearBuilt),
    saleTransactions: sales.transactions, latestValidSale: sales.latest, saleTransactionAmbiguous: sales.ambiguous,
    transactionQuality: 'UNKNOWN',
  };
}

export function mapRentCastSoldRecordPool(options: {
  records: RentCastPropertyRecordRaw[];
  policy: SoldSearchPolicy;
  queryFingerprint: string;
  retrievedAt?: string;
}): NormalizedSoldRecordPool {
  const retrievedAt = options.retrievedAt || new Date().toISOString();
  return {
    provider: 'rentcast', evidenceType: 'property_sold_record_pool', schemaVersion: 1, retrievedAt,
    requestPolicy: { ...options.policy }, queryFingerprint: options.queryFingerprint,
    recordsReturned: options.records.length,
    records: options.records.map((record) => mapRecord(record, retrievedAt, options.policy)),
  };
}
