import { normalizeState, normalizeStreet, normalizeZipCode } from './address.ts';
import type { InternalPropertyEvidence, PropertyEvidenceConflict } from './propertyEvidenceTypes.ts';
import type { Evidence, NormalizedPropertyRecord } from './types.ts';

export const PROPERTY_SIZE_CONFLICT_THRESHOLD_PERCENT = 5;

const comparableText = (value: string) => value.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const propertyType = (value: string) => {
  const normalized = comparableText(value);
  if (['SFR', 'SINGLE FAMILY', 'SINGLE FAMILY RESIDENCE', 'SINGLE FAMILY HOME'].includes(normalized)) return 'SINGLE FAMILY';
  return normalized;
};

function values<T>(internal: Evidence<T>, external: Evidence<T>) {
  return internal.value !== null && external.value !== null ? [internal.value, external.value] as const : null;
}

function textConflict(
  field: string,
  internal: Evidence<string>,
  external: Evidence<string>,
  normalize: (value: string) => string = comparableText,
) {
  const pair = values(internal, external);
  if (!pair || normalize(pair[0]) === normalize(pair[1])) return null;
  return {
    field, internalValue: pair[0], externalValue: pair[1], internalSource: 'dealSifter',
    externalSource: 'rentcast', difference: null, differencePercent: null, severity: 'INFO',
  } satisfies PropertyEvidenceConflict;
}

function exactNumericConflict(field: string, internal: Evidence<number>, external: Evidence<number>) {
  const pair = values(internal, external);
  if (!pair || pair[0] === pair[1]) return null;
  const difference = Math.abs(pair[0] - pair[1]);
  const differencePercent = pair[0] === 0 ? null : (difference / Math.abs(pair[0])) * 100;
  return {
    field, internalValue: pair[0], externalValue: pair[1], internalSource: 'dealSifter',
    externalSource: 'rentcast', difference, differencePercent, severity: 'WARNING',
  } satisfies PropertyEvidenceConflict;
}

function sizedNumericConflict(field: string, internal: Evidence<number>, external: Evidence<number>) {
  const conflict = exactNumericConflict(field, internal, external);
  if (!conflict || conflict.differencePercent === null
    || conflict.differencePercent <= PROPERTY_SIZE_CONFLICT_THRESHOLD_PERCENT) return null;
  return conflict;
}

export function detectPropertyEvidenceConflicts(
  internal: InternalPropertyEvidence,
  external: NormalizedPropertyRecord,
) {
  const candidates: Array<PropertyEvidenceConflict | null> = [
    textConflict('address', internal.address.addressLine1, external.address.addressLine1, normalizeStreet),
    textConflict('city', internal.address.city, external.address.city),
    textConflict('state', internal.address.state, external.address.state, normalizeState),
    textConflict('zip', internal.address.zipCode, external.address.zipCode, normalizeZipCode),
    textConflict('propertyType', internal.characteristics.propertyType, external.characteristics.propertyType, propertyType),
    exactNumericConflict('bedrooms', internal.characteristics.bedrooms, external.characteristics.bedrooms),
    exactNumericConflict('bathrooms', internal.characteristics.bathrooms, external.characteristics.bathrooms),
    sizedNumericConflict('livingAreaSqft', internal.characteristics.livingAreaSqft, external.characteristics.livingAreaSqft),
    sizedNumericConflict('lotSizeSqft', internal.characteristics.lotSizeSqft, external.characteristics.lotSizeSqft),
    exactNumericConflict('yearBuilt', internal.characteristics.yearBuilt, external.characteristics.yearBuilt),
  ];
  return candidates.filter((item): item is PropertyEvidenceConflict => item !== null);
}
