const FIELD_MAP = Object.freeze({
  propertyType: 'type', bedrooms: 'beds', bathrooms: 'baths', livingAreaSqft: 'sqft',
  lotSizeSqft: 'lotSizeSqft', yearBuilt: 'yearBuilt', county: 'county',
  latitude: 'latitude', longitude: 'longitude', assessedValue: 'assessedValue',
  assessmentYear: 'assessmentYear', annualPropertyTax: 'annualPropertyTax',
  propertyTaxYear: 'propertyTaxYear', latestSalePrice: 'latestSalePrice',
  latestSaleDate: 'latestSaleDate', ownerOccupied: 'ownerOccupied',
  ownershipRecordPresent: 'ownershipRecordPresent', stateFips: 'stateFips',
  countyFips: 'countyFips', assessorId: 'assessorId', legalDescription: 'legalDescription',
  subdivision: 'subdivision', zoning: 'zoning', hoaFee: 'hoaFee',
  propertyFeatures: 'propertyFeatures', saleHistory: 'saleHistory',
});

const present = (value) => value !== null && value !== undefined && value !== '';

export function mergePropertyReleaseEvidence(property, response) {
  const merged = { ...(property || {}) };
  if (response?.state !== 'unlocked') return Object.freeze(merged);
  const fields = response?.intelligence?.fields || {};
  Object.entries(FIELD_MAP).forEach(([field, propertyKey]) => {
    const evidence = fields[field];
    if (evidence?.status === 'VERIFIED_RECORD' && present(evidence.value)) merged[propertyKey] = evidence.value;
  });
  if (!present(merged.notes) && present(merged.description)) merged.notes = merged.description;
  return Object.freeze(merged);
}
