import type { Evidence } from './types.ts';
import type { NormalizedComparableCandidate, NormalizedValuationEvidence } from './valuationTypes.ts';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const nullableText = (value: unknown) => value === null || typeof value === 'string';
const nullableNumber = (value: unknown) => value === null || finite(value);
const iso = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

function evidence(
  value: unknown,
  allowedStatus: 'ESTIMATED' | 'CALCULATED',
  valueType: 'text' | 'number',
): value is Evidence<unknown> {
  if (!object(value)) return false;
  if (value.status !== allowedStatus && value.status !== 'UNAVAILABLE') return false;
  if (value.source !== (allowedStatus === 'ESTIMATED' ? 'rentcast' : 'calculation')) return false;
  if (!iso(value.retrievedAt) || value.effectiveDate !== null || value.confidence !== null) return false;
  if (!nullableText(value.providerPropertyId)) return false;
  if (value.status === 'UNAVAILABLE') return value.value === null;
  return valueType === 'text' ? typeof value.value === 'string' : finite(value.value);
}

function comparable(value: unknown): value is NormalizedComparableCandidate {
  if (!object(value) || value.provider !== 'rentcast' || value.evidenceStatus !== 'ESTIMATED' || !iso(value.retrievedAt)) return false;
  const textFields = ['providerPropertyId', 'formattedAddress', 'addressLine1', 'city', 'state', 'zipCode', 'propertyType', 'listingStatus', 'listingType', 'listedDate', 'removedDate', 'lastSeenDate'];
  const numberFields = ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'livingAreaSqft', 'lotSizeSqft', 'yearBuilt', 'price', 'daysOnMarket', 'distanceMiles', 'daysOld', 'providerCorrelation'];
  if (!textFields.every((field) => nullableText(value[field])) || !numberFields.every((field) => nullableNumber(value[field]))) return false;
  if (value.priceSemantic !== 'PROVIDER_LISTING_PRICE' || !object(value.derived)) return false;
  const derived = value.derived;
  return ['pricePerSqft', 'sqftVarianceFromSubject', 'lotSizeVarianceFromSubject', 'yearBuiltDifference', 'bedroomDifference', 'bathroomDifference']
    .every((field) => evidence(derived[field], 'CALCULATED', 'number'));
}

export function isNormalizedValuationEvidence(value: unknown): value is NormalizedValuationEvidence {
  if (!object(value) || value.provider !== 'rentcast' || value.evidenceType !== 'property_value_avm' || value.schemaVersion !== 1 || !iso(value.retrievedAt)) return false;
  if (!object(value.requestPolicy)
    || !finite(value.requestPolicy.maxRadius) || value.requestPolicy.maxRadius <= 0
    || !finite(value.requestPolicy.daysOld) || value.requestPolicy.daysOld < 1
    || !finite(value.requestPolicy.compCount) || !Number.isInteger(value.requestPolicy.compCount)
    || value.requestPolicy.compCount < 5 || value.requestPolicy.compCount > 25
    || typeof value.requestPolicy.lookupSubjectAttributes !== 'boolean') return false;
  if (!finite(value.providerComparableCount)
    || !Array.isArray(value.comparables)
    || value.providerComparableCount < value.comparables.length) return false;
  if (!object(value.providerEstimate)
    || !evidence(value.providerEstimate.value, 'ESTIMATED', 'number')
    || !evidence(value.providerEstimate.rangeLow, 'ESTIMATED', 'number')
    || !evidence(value.providerEstimate.rangeHigh, 'ESTIMATED', 'number')
    || value.providerEstimate.providerConfidenceSemantic !== 'PROVIDER_85_PERCENT_RANGE') return false;
  if (!object(value.subjectProperty)) return false;
  const subjectProperty = value.subjectProperty;
  const subjectTextFields = ['providerPropertyId', 'formattedAddress', 'addressLine1', 'city', 'state', 'zipCode', 'propertyType', 'lastSaleDate'];
  const subjectNumberFields = ['latitude', 'longitude', 'bedrooms', 'bathrooms', 'livingAreaSqft', 'lotSizeSqft', 'yearBuilt', 'lastSalePrice'];
  if (!subjectTextFields.every((field) => evidence(subjectProperty[field], 'ESTIMATED', 'text'))
    || !subjectNumberFields.every((field) => evidence(subjectProperty[field], 'ESTIMATED', 'number'))) return false;
  if (!Array.isArray(value.comparables) || !value.comparables.every(comparable)) return false;
  return Array.isArray(value.limitations)
    && value.limitations.includes('RENOVATION_CONDITION_UNAVAILABLE')
    && value.limitations.includes('ARMS_LENGTH_DISTRESS_UNAVAILABLE')
    && value.limitations.includes('PROVIDER_LISTING_PRICE_IS_NOT_CONFIRMED_SALE_PRICE');
}

export function serializeNormalizedValuationEvidence(value: NormalizedValuationEvidence) {
  const serialized = JSON.parse(JSON.stringify(value)) as unknown;
  if (!isNormalizedValuationEvidence(serialized)) throw new Error('INVALID_NORMALIZED_VALUATION_EVIDENCE');
  return serialized;
}
