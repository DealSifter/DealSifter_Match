import type { PropertyEvidenceService } from './propertyEvidenceService.ts';
import type { NormalizedPropertyRecord } from './types.ts';

const PRESENT_FIELDS: Array<[string, (record: NormalizedPropertyRecord) => { value: unknown }]> = [
  ['address.formattedAddress', (record) => record.address.formattedAddress],
  ['address.county', (record) => record.address.county],
  ['address.latitude', (record) => record.address.latitude],
  ['address.longitude', (record) => record.address.longitude],
  ['characteristics.propertyType', (record) => record.characteristics.propertyType],
  ['characteristics.bedrooms', (record) => record.characteristics.bedrooms],
  ['characteristics.bathrooms', (record) => record.characteristics.bathrooms],
  ['characteristics.livingAreaSqft', (record) => record.characteristics.livingAreaSqft],
  ['characteristics.lotSizeSqft', (record) => record.characteristics.lotSizeSqft],
  ['characteristics.yearBuilt', (record) => record.characteristics.yearBuilt],
  ['ownership.ownerOccupied', (record) => record.ownership.ownerOccupied],
  ['tax.assessedValue', (record) => record.tax.assessedValue],
  ['tax.annualPropertyTax', (record) => record.tax.annualPropertyTax],
  ['lastSale.price', (record) => record.lastSale.price],
  ['lastSale.date', (record) => record.lastSale.date],
];

function maskProviderPropertyId(value: string) {
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

/** Manual-only harness. It has no entrypoint and cannot run without explicit opt-in. */
export async function runControlledPropertyEvidenceValidation(options: {
  enabled: string | undefined;
  mode: string | undefined;
  environment: string | undefined;
  service: PropertyEvidenceService;
  propertyId: string;
  userId?: string | null;
}) {
  if (String(options.enabled || '').trim().toLowerCase() !== 'true') {
    throw new Error('LIVE_PROPERTY_VALIDATION_NOT_ENABLED');
  }
  if (String(options.mode || '').trim().toLowerCase() !== 'live') {
    throw new Error('LIVE_PROPERTY_VALIDATION_REQUIRES_LIVE_MODE');
  }
  if (!['local', 'development', 'staging'].includes(String(options.environment || '').trim().toLowerCase())) {
    throw new Error('LIVE_PROPERTY_VALIDATION_REQUIRES_NON_PRODUCTION');
  }
  const first = await options.service.getPropertyEvidence({ propertyId: options.propertyId, userId: options.userId });
  const second = await options.service.getPropertyEvidence({ propertyId: options.propertyId, userId: options.userId });
  const liveRequests = Number(!first.cacheHit) + Number(!second.cacheHit);
  if (liveRequests > 2) throw new Error('LIVE_PROPERTY_VALIDATION_REQUEST_LIMIT_EXCEEDED');
  return {
    liveRequests,
    cacheHits: Number(first.cacheHit) + Number(second.cacheHit),
    firstCacheHit: first.cacheHit,
    secondCacheHit: second.cacheHit,
    providerPropertyId: maskProviderPropertyId(first.externalData.sourceMetadata.providerPropertyId),
    fieldsReceived: PRESENT_FIELDS.filter(([, getEvidence]) => getEvidence(first.externalData).value !== null)
      .map(([path]) => path),
    missingFields: [...first.missingFields],
    addressMatch: !first.conflicts.some((conflict) => ['address', 'city', 'state', 'zip'].includes(conflict.field)),
    cachePersisted: second.cacheHit,
  };
}
