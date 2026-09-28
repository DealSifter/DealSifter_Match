type PropertyContext = {
  fields?: Record<string, { value?: unknown; status?: string }>;
};

const REPORT_FIELD_MAP = Object.freeze({
  propertyType: 'type',
  bedrooms: 'beds',
  bathrooms: 'baths',
  livingAreaSqft: 'sqft',
  lotSizeSqft: 'lot',
  yearBuilt: 'yearBuilt',
  county: 'county',
  latitude: 'latitude',
  longitude: 'longitude',
  assessedValue: 'assessedValue',
  assessmentYear: 'assessmentYear',
  annualPropertyTax: 'annualPropertyTax',
  propertyTaxYear: 'propertyTaxYear',
  latestSalePrice: 'latestSalePrice',
  latestSaleDate: 'latestSaleDate',
  ownerOccupied: 'ownerOccupied',
  ownershipRecordPresent: 'ownershipRecordPresent',
} as const);

function present(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

export function mergeVerifiedPropertyEvidenceIntoFacts(
  property: Record<string, unknown> | null,
  propertyContext: PropertyContext | null,
) {
  const merged: Record<string, unknown> = { ...(property || {}) };
  const fields = propertyContext?.fields || {};
  Object.entries(REPORT_FIELD_MAP).forEach(([evidenceKey, reportKey]) => {
    const evidence = fields[evidenceKey];
    if (evidence?.status === 'VERIFIED_RECORD' && present(evidence.value)) {
      merged[reportKey] = evidence.value;
    }
  });
  return Object.freeze(merged);
}
