export const LOCKED_INTELLIGENCE_FIELDS = Object.freeze([
  'propertyRecord',
  'propertyCharacteristics',
  'taxAssessment',
  'propertyTaxes',
  'lastRecordedSale',
  'ownershipRecord',
]);

export const UNLOCKED_INTELLIGENCE_FIELDS = Object.freeze([
  ['propertyType', 'propertyType'],
  ['bedrooms', 'bedrooms'],
  ['bathrooms', 'bathrooms'],
  ['livingAreaSqft', 'livingArea'],
  ['lotSizeSqft', 'lotSize'],
  ['yearBuilt', 'yearBuilt'],
  ['county', 'county'],
  ['latitude', 'latitude'],
  ['longitude', 'longitude'],
  ['assessedValue', 'taxAssessment'],
  ['assessmentYear', 'assessmentYear'],
  ['annualPropertyTax', 'propertyTaxes'],
  ['propertyTaxYear', 'taxYear'],
  ['latestSalePrice', 'latestSalePrice'],
  ['latestSaleDate', 'latestSaleDate'],
  ['ownerOccupied', 'ownerOccupied'],
  ['ownershipRecordPresent', 'ownershipRecord'],
]);

const moneyFields = new Set(['assessedValue', 'annualPropertyTax', 'latestSalePrice']);
const areaFields = new Set(['livingAreaSqft', 'lotSizeSqft']);

export function formatIntelligenceValue(field, evidence, unavailable = 'Unavailable') {
  if (!evidence || evidence.status === 'UNAVAILABLE' || evidence.value === null || evidence.value === undefined || evidence.value === '') {
    return unavailable;
  }
  if (moneyFields.has(field)) {
    const value = Number(evidence.value);
    return Number.isFinite(value) ? `$${value.toLocaleString('en-US')}` : unavailable;
  }
  if (areaFields.has(field)) {
    const value = Number(evidence.value);
    return Number.isFinite(value) ? `${value.toLocaleString('en-US')} sqft` : unavailable;
  }
  if (field === 'ownerOccupied' || field === 'ownershipRecordPresent') return evidence.value === true ? 'Yes' : 'No';
  if (field === 'latestSaleDate') {
    const date = new Date(evidence.value);
    return Number.isNaN(date.getTime()) ? unavailable : date.toLocaleDateString(undefined, { timeZone: 'UTC' });
  }
  return String(evidence.value);
}

export function buildIntelligenceRows(intelligence, labels = {}, unavailable = 'Unavailable') {
  const fields = intelligence?.fields || {};
  return UNLOCKED_INTELLIGENCE_FIELDS.map(([field, labelKey]) => ({
    field,
    label: labels[labelKey] || labelKey,
    value: formatIntelligenceValue(field, fields[field], unavailable),
    status: fields[field]?.status || 'UNAVAILABLE',
  }));
}

export function conflictsByField(intelligence) {
  return new Map((intelligence?.conflicts || []).map((conflict) => [conflict.field, conflict]));
}
