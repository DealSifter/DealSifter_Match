import { rentCastAddressMatches } from './address.ts';
import { PropertyDataError, type Evidence, type PropertyLookupInput } from './types.ts';
import type { RentCastValuationPropertyRaw, RentCastValueEstimateRaw } from './rentcast/rentcastTypes.ts';
import type {
  NormalizedComparableCandidate,
  NormalizedValuationEvidence,
  NormalizedValuationSubject,
  ValuationRequestPolicy,
} from './valuationTypes.ts';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const positive = (value: unknown) => {
  const parsed = number(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};
const date = (value: unknown) => {
  const candidate = text(value);
  return candidate && Number.isFinite(Date.parse(candidate)) ? candidate : null;
};

function providerEvidence<T>(value: T | null, retrievedAt: string, providerPropertyId: string | null): Evidence<T> {
  return value === null
    ? { value: null, status: 'UNAVAILABLE', source: 'rentcast', retrievedAt, effectiveDate: null, providerPropertyId, confidence: null }
    : { value, status: 'ESTIMATED', source: 'rentcast', retrievedAt, effectiveDate: null, providerPropertyId, confidence: null };
}

function calculatedEvidence(value: number | null, retrievedAt: string): Evidence<number> {
  return value === null
    ? { value: null, status: 'UNAVAILABLE', source: 'calculation', retrievedAt, effectiveDate: null, providerPropertyId: null, confidence: null }
    : { value, status: 'CALCULATED', source: 'calculation', retrievedAt, effectiveDate: null, providerPropertyId: null, confidence: null };
}

const variance = (candidate: number | null, subject: number | null) =>
  candidate !== null && subject !== null && subject > 0 ? Math.abs(candidate - subject) / subject : null;
const difference = (candidate: number | null, subject: number | null) =>
  candidate !== null && subject !== null ? Math.abs(candidate - subject) : null;

function mapSubject(raw: RentCastValuationPropertyRaw, retrievedAt: string): NormalizedValuationSubject {
  const providerPropertyId = text(raw.id);
  return {
    providerPropertyId: providerEvidence(providerPropertyId, retrievedAt, providerPropertyId),
    formattedAddress: providerEvidence(text(raw.formattedAddress), retrievedAt, providerPropertyId),
    addressLine1: providerEvidence(text(raw.addressLine1), retrievedAt, providerPropertyId),
    city: providerEvidence(text(raw.city), retrievedAt, providerPropertyId),
    state: providerEvidence(text(raw.state), retrievedAt, providerPropertyId),
    zipCode: providerEvidence(text(raw.zipCode), retrievedAt, providerPropertyId),
    latitude: providerEvidence(number(raw.latitude), retrievedAt, providerPropertyId),
    longitude: providerEvidence(number(raw.longitude), retrievedAt, providerPropertyId),
    propertyType: providerEvidence(text(raw.propertyType), retrievedAt, providerPropertyId),
    bedrooms: providerEvidence(number(raw.bedrooms), retrievedAt, providerPropertyId),
    bathrooms: providerEvidence(number(raw.bathrooms), retrievedAt, providerPropertyId),
    livingAreaSqft: providerEvidence(positive(raw.squareFootage), retrievedAt, providerPropertyId),
    lotSizeSqft: providerEvidence(positive(raw.lotSize), retrievedAt, providerPropertyId),
    yearBuilt: providerEvidence(positive(raw.yearBuilt), retrievedAt, providerPropertyId),
    lastSalePrice: providerEvidence(positive(raw.lastSalePrice), retrievedAt, providerPropertyId),
    lastSaleDate: providerEvidence(date(raw.lastSaleDate), retrievedAt, providerPropertyId),
  };
}

function mapComparable(raw: RentCastValuationPropertyRaw, subject: NormalizedValuationSubject, retrievedAt: string): NormalizedComparableCandidate {
  const livingAreaSqft = positive(raw.squareFootage);
  const lotSizeSqft = positive(raw.lotSize);
  const yearBuilt = positive(raw.yearBuilt);
  const bedrooms = number(raw.bedrooms);
  const bathrooms = number(raw.bathrooms);
  const price = positive(raw.price);
  return {
    provider: 'rentcast', retrievedAt, evidenceStatus: 'ESTIMATED', providerPropertyId: text(raw.id),
    formattedAddress: text(raw.formattedAddress), addressLine1: text(raw.addressLine1), city: text(raw.city),
    state: text(raw.state), zipCode: text(raw.zipCode), latitude: number(raw.latitude), longitude: number(raw.longitude),
    propertyType: text(raw.propertyType), bedrooms, bathrooms, livingAreaSqft, lotSizeSqft, yearBuilt, price,
    priceSemantic: 'PROVIDER_LISTING_PRICE', listingStatus: text(raw.status), listingType: text(raw.listingType),
    listedDate: date(raw.listedDate), removedDate: date(raw.removedDate), lastSeenDate: date(raw.lastSeenDate),
    daysOnMarket: number(raw.daysOnMarket), distanceMiles: number(raw.distance), daysOld: number(raw.daysOld),
    providerCorrelation: number(raw.correlation),
    derived: {
      pricePerSqft: calculatedEvidence(price !== null && livingAreaSqft !== null ? price / livingAreaSqft : null, retrievedAt),
      sqftVarianceFromSubject: calculatedEvidence(variance(livingAreaSqft, subject.livingAreaSqft.value), retrievedAt),
      lotSizeVarianceFromSubject: calculatedEvidence(variance(lotSizeSqft, subject.lotSizeSqft.value), retrievedAt),
      yearBuiltDifference: calculatedEvidence(difference(yearBuilt, subject.yearBuilt.value), retrievedAt),
      bedroomDifference: calculatedEvidence(difference(bedrooms, subject.bedrooms.value), retrievedAt),
      bathroomDifference: calculatedEvidence(difference(bathrooms, subject.bathrooms.value), retrievedAt),
    },
  };
}

export function mapRentCastValueEstimate(options: {
  raw: RentCastValueEstimateRaw;
  lookup: PropertyLookupInput;
  requestPolicy: ValuationRequestPolicy;
  retrievedAt?: string;
}): NormalizedValuationEvidence {
  const retrievedAt = options.retrievedAt || new Date().toISOString();
  const subjectRaw = options.raw?.subjectProperty;
  if (!subjectRaw || typeof subjectRaw !== 'object' || Array.isArray(subjectRaw)) {
    throw new PropertyDataError('INVALID_PROVIDER_RESPONSE', { billableSuccess: true, httpStatus: 200 });
  }
  if (!rentCastAddressMatches(options.lookup, subjectRaw)) {
    throw new PropertyDataError('ADDRESS_MISMATCH', { billableSuccess: true, httpStatus: 200 });
  }
  const subjectProperty = mapSubject(subjectRaw, retrievedAt);
  const comparablesRaw = Array.isArray(options.raw.comparables) ? options.raw.comparables : [];
  const comparables = comparablesRaw
    .filter((candidate): candidate is RentCastValuationPropertyRaw => Boolean(candidate) && typeof candidate === 'object' && !Array.isArray(candidate))
    .map((candidate) => mapComparable(candidate, subjectProperty, retrievedAt));
  const providerPropertyId = subjectProperty.providerPropertyId.value;
  return {
    provider: 'rentcast', evidenceType: 'property_value_avm', schemaVersion: 1, retrievedAt,
    requestPolicy: { ...options.requestPolicy },
    providerComparableCount: comparablesRaw.length,
    providerEstimate: {
      value: providerEvidence(positive(options.raw.price), retrievedAt, providerPropertyId),
      rangeLow: providerEvidence(positive(options.raw.priceRangeLow), retrievedAt, providerPropertyId),
      rangeHigh: providerEvidence(positive(options.raw.priceRangeHigh), retrievedAt, providerPropertyId),
      providerConfidenceSemantic: 'PROVIDER_85_PERCENT_RANGE',
    },
    subjectProperty,
    comparables,
    limitations: [
      'RENOVATION_CONDITION_UNAVAILABLE',
      'ARMS_LENGTH_DISTRESS_UNAVAILABLE',
      'PROVIDER_LISTING_PRICE_IS_NOT_CONFIRMED_SALE_PRICE',
    ],
  };
}
