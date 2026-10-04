import type { Evidence, NormalizedPropertyRecord } from './types.ts';
const EVIDENCE_KEYS = ['value', 'status', 'source', 'retrievedAt', 'effectiveDate', 'providerPropertyId', 'confidence'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: string[]) => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isIsoDate = (value: unknown) => typeof value === 'string'
  && Number.isFinite(Date.parse(value));

function isEvidence<T>(value: unknown, isValue: (candidate: unknown) => candidate is T): value is Evidence<T> {
  if (!isObject(value) || !hasExactKeys(value, EVIDENCE_KEYS)) return false;
  if (value.status !== 'VERIFIED_RECORD' && value.status !== 'UNAVAILABLE') return false;
  if (value.source !== 'rentcast') return false;
  if (value.retrievedAt !== null && !isIsoDate(value.retrievedAt)) return false;
  if (value.effectiveDate !== null && (typeof value.effectiveDate !== 'string' || !value.effectiveDate.trim())) return false;
  if (typeof value.providerPropertyId !== 'string' || !value.providerPropertyId.trim()) return false;
  if (value.confidence !== null && (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence))) return false;
  if (value.status === 'UNAVAILABLE') return value.value === null;
  return value.value !== null && isValue(value.value);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isRecord = (value: unknown): value is Record<string, unknown> => isObject(value);
const isSaleHistory = (value: unknown): value is Array<{ date: string; price: number | null }> => Array.isArray(value)
  && value.every((item) => isObject(item) && hasExactKeys(item, ['date', 'price'])
    && isString(item.date) && (item.price === null || isNumber(item.price)));

function isEvidenceGroup(value: unknown, fields: Record<string, (candidate: unknown) => boolean>) {
  if (!isObject(value) || !hasExactKeys(value, Object.keys(fields))) return false;
  return Object.entries(fields).every(([field, validator]) => validator(value[field]));
}

export function isNormalizedPropertyRecord(value: unknown): value is NormalizedPropertyRecord {
  if (!isObject(value)) return false;
  const requiredKeys = ['provider', 'sourceMetadata', 'identity', 'address', 'characteristics', 'ownership', 'tax', 'lastSale'];
  const optionalKeys = ['parcel', 'hoa', 'features', 'saleHistory'];
  if (!requiredKeys.every((key) => Object.hasOwn(value, key))
    || Object.keys(value).some((key) => !requiredKeys.includes(key) && !optionalKeys.includes(key))) return false;
  if (value.provider !== 'rentcast' || !isObject(value.sourceMetadata)) return false;
  const sourceMetadataKeys = Object.keys(value.sourceMetadata);
  if (!['source', 'retrievedAt', 'providerPropertyId', 'confidence'].every((key) => sourceMetadataKeys.includes(key))
    || sourceMetadataKeys.some((key) => !['source', 'retrievedAt', 'providerPropertyId', 'confidence', 'fieldDiagnostics'].includes(key))) return false;
  if (value.sourceMetadata.source !== 'rentcast'
    || !isIsoDate(value.sourceMetadata.retrievedAt)
    || typeof value.sourceMetadata.providerPropertyId !== 'string'
    || value.sourceMetadata.confidence !== null) return false;
  if (value.sourceMetadata.fieldDiagnostics !== undefined) {
    const diagnostics = value.sourceMetadata.fieldDiagnostics;
    if (!isObject(diagnostics) || !hasExactKeys(diagnostics, ['providerFieldPresence', 'normalizationResult'])
      || !isObject(diagnostics.providerFieldPresence) || !hasExactKeys(diagnostics.providerFieldPresence, ['assessorID'])
      || !['PRESENT', 'ABSENT'].includes(String(diagnostics.providerFieldPresence.assessorID))
      || !isObject(diagnostics.normalizationResult) || !hasExactKeys(diagnostics.normalizationResult, ['assessorId'])
      || !(diagnostics.normalizationResult.assessorId === null || typeof diagnostics.normalizationResult.assessorId === 'string')) return false;
  }

  return isEvidenceGroup(value.identity, { providerPropertyId: (item) => isEvidence(item, isString) })
    && isEvidenceGroup(value.address, {
      formattedAddress: (item) => isEvidence(item, isString),
      addressLine1: (item) => isEvidence(item, isString),
      city: (item) => isEvidence(item, isString),
      state: (item) => isEvidence(item, isString),
      zipCode: (item) => isEvidence(item, isString),
      county: (item) => isEvidence(item, isString),
      latitude: (item) => isEvidence(item, isNumber),
      longitude: (item) => isEvidence(item, isNumber),
    })
    && isEvidenceGroup(value.characteristics, {
      propertyType: (item) => isEvidence(item, isString),
      bedrooms: (item) => isEvidence(item, isNumber),
      bathrooms: (item) => isEvidence(item, isNumber),
      livingAreaSqft: (item) => isEvidence(item, isNumber),
      lotSizeSqft: (item) => isEvidence(item, isNumber),
      yearBuilt: (item) => isEvidence(item, isNumber),
    })
    && isEvidenceGroup(value.ownership, {
      ownerNames: (item) => isEvidence(item, isStringArray),
      ownerOccupied: (item) => isEvidence(item, isBoolean),
    })
    && isEvidenceGroup(value.tax, {
      assessedValue: (item) => isEvidence(item, isNumber),
      assessmentYear: (item) => isEvidence(item, isNumber),
      annualPropertyTax: (item) => isEvidence(item, isNumber),
      propertyTaxYear: (item) => isEvidence(item, isNumber),
    })
    && isEvidenceGroup(value.lastSale, {
      price: (item) => isEvidence(item, isNumber),
      date: (item) => isEvidence(item, isString),
    })
    && (!value.parcel || isEvidenceGroup(value.parcel, {
      stateFips: (item) => isEvidence(item, isString),
      countyFips: (item) => isEvidence(item, isString),
      assessorId: (item) => isEvidence(item, isString),
      legalDescription: (item) => isEvidence(item, isString),
      subdivision: (item) => isEvidence(item, isString),
      zoning: (item) => isEvidence(item, isString),
    }))
    && (!value.hoa || isEvidenceGroup(value.hoa, { fee: (item) => isEvidence(item, isNumber) }))
    && (!value.features || isEvidenceGroup(value.features, { values: (item) => isEvidence(item, isRecord) }))
    && (!value.saleHistory || isEvidenceGroup(value.saleHistory, { transactions: (item) => isEvidence(item, isSaleHistory) }));
}

export function serializeNormalizedPropertyRecord(record: NormalizedPropertyRecord) {
  const serialized = JSON.parse(JSON.stringify(record)) as unknown;
  if (!isNormalizedPropertyRecord(serialized)) throw new Error('INVALID_NORMALIZED_PROPERTY_RECORD');
  return serialized;
}
