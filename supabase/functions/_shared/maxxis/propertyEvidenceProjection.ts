type PropertyContext = {
  fields?: Record<string, { value?: unknown; status?: string }>;
};

const REPORT_FIELD_MAP = Object.freeze({
  bedrooms: 'beds',
  bathrooms: 'baths',
  livingAreaSqft: 'sqft',
  lotSizeSqft: 'lotSizeSqft',
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
  stateFips: 'stateFips',
  countyFips: 'countyFips',
  assessorId: 'assessorId',
  legalDescription: 'legalDescription',
  subdivision: 'subdivision',
  zoning: 'zoning',
  hoaFee: 'hoaFee',
  propertyFeatures: 'propertyFeatures',
  saleHistory: 'saleHistory',
} as const);

export const REPORT_FIELD_VISIBILITY = Object.freeze({
  ALWAYS_VISIBLE_IF_AVAILABLE: Object.freeze([
    'address', 'city', 'state', 'zip', 'type', 'price', 'objective', 'propertyUserNotes',
  ]),
  VISIBLE_IF_RELEVANT: Object.freeze([
    'beds', 'baths', 'sqft', 'lotSizeSqft', 'lotSizeAcres', 'yearBuilt', 'county',
    'assessorId', 'legalDescription', 'subdivision', 'zoning', 'assessedValue',
    'assessmentYear', 'annualPropertyTax', 'propertyTaxYear', 'latestSalePrice',
    'latestSaleDate', 'ownerOccupied', 'ownershipRecordPresent', 'hoaFee',
    'materialPropertyFeatures', 'saleHistory',
  ]),
  INTERNAL_ONLY: Object.freeze(['stateFips', 'countyFips', 'providerPropertyType', 'fieldProvenance']),
});

function present(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

function usefulEvidenceValue(_key: string, value: unknown) {
  return present(value);
}

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function propertyTypeFamily(value: unknown) {
  const token = normalize(value).replace(/\s+/g, '');
  if (['sfr', 'singlefamily', 'singlefamilyresidence', 'detached'].includes(token)) return 'SINGLE_FAMILY';
  if (['land', 'lot', 'vacantland', 'undevelopedland'].includes(token)) return 'LAND';
  return token.toUpperCase();
}

function resolvedPropertyType(property: Record<string, unknown>, providerType: unknown) {
  return present(property.type) ? property.type : present(property.propertyType) ? property.propertyType : providerType;
}

function resolvedStrategy(propertyType: unknown, objective: unknown) {
  const type = normalize(propertyType);
  const strategy = normalize(objective);
  if (/\b(?:land|lot|vacant)\b/.test(type)) return 'LAND';
  if (/\b(?:sub to|subject to|subto)\b/.test(strategy)) return 'SUB_TO';
  if (/\b(?:seller financ\w*|owner financ\w*|owner carry)\b/.test(strategy)) return 'SELLER_FINANCING';
  if (/\b(?:wholesale|assignment)\b/.test(strategy)) return 'WHOLESALE';
  if (/\b(?:buy and hold|buy hold|rental|hold)\b/.test(strategy)) return 'BUY_AND_HOLD';
  if (/\b(?:flip|fix and flip|rehab and sell)\b/.test(strategy)) return 'FLIP';
  return 'GENERIC_SELL';
}

function materialFeatures(value: unknown, strategy: string) {
  const entries = Array.isArray(value) ? value : [];
  const tokens = strategy === 'LAND'
    ? /zoning|zone|access|road|utility|utilities|water|sewer|electric|survey|topograph|flood|acre|lot|parcel|subdiv/i
    : /garage|pool|roof|foundation|heating|cooling|parking|fireplace|construction|condition|renovat|bed|bath/i;
  return entries.filter((entry) => tokens.test(typeof entry === 'string' ? entry : JSON.stringify(entry))).slice(0, 12);
}

export function mergeVerifiedPropertyEvidenceIntoFacts(
  property: Record<string, unknown> | null,
  propertyContext: PropertyContext | null,
) {
  const merged: Record<string, unknown> = { ...(property || {}) };
  const fields = propertyContext?.fields || {};
  const provenance: Record<string, string> = {};
  Object.entries(REPORT_FIELD_MAP).forEach(([evidenceKey, reportKey]) => {
    const evidence = fields[evidenceKey];
    if (evidence?.status === 'VERIFIED_RECORD' && usefulEvidenceValue(evidenceKey, evidence.value)) {
      merged[reportKey] = evidence.value;
      provenance[reportKey] = String((evidence as { source?: unknown }).source || 'PROPERTY_EVIDENCE');
    }
  });
  const providerPropertyType = fields.propertyType?.status === 'VERIFIED_RECORD'
    && present(fields.propertyType.value) ? fields.propertyType.value : null;
  const canonicalType = resolvedPropertyType(property || {}, providerPropertyType);
  if (present(canonicalType)) merged.type = canonicalType;
  if (present(providerPropertyType)) merged.providerPropertyType = providerPropertyType;
  if (present(canonicalType)) merged.resolvedAnalysisPropertyType = canonicalType;
  if (present(canonicalType) || present(merged.objective)) {
    merged.resolvedAnalysisStrategy = resolvedStrategy(canonicalType, merged.objective);
  }
  if (present(providerPropertyType) && present(canonicalType)) {
    merged.propertyTypeConflict = propertyTypeFamily(providerPropertyType) !== propertyTypeFamily(canonicalType);
  }

  // Notes entered on the property card are a distinct user-owned field. They
  // must never be synthesized from the description or analytical prose.
  if (present(property?.notes)) merged.propertyUserNotes = property?.notes;
  if (present(property?.description)) merged.maxxisPropertySummary = property?.description;

  const lotSqft = Number(merged.lotSizeSqft ?? merged.lot);
  const lotAcres = Number(merged.lotSizeAcres);
  if ((!Number.isFinite(lotAcres) || lotAcres <= 0) && Number.isFinite(lotSqft) && lotSqft > 0) {
    merged.lotSizeAcres = Math.round((lotSqft / 43_560) * 10_000) / 10_000;
  }
  if ((!Number.isFinite(lotSqft) || lotSqft <= 0) && Number.isFinite(lotAcres) && lotAcres > 0) {
    merged.lotSizeSqft = Math.round(lotAcres * 43_560 * 10) / 10;
  }
  if (!present(merged.lot) && present(merged.lotSizeSqft)) merged.lot = merged.lotSizeSqft;
  const features = materialFeatures(merged.propertyFeatures, String(merged.resolvedAnalysisStrategy));
  if (features.length) merged.materialPropertyFeatures = features;
  if (Object.keys(provenance).length) merged.fieldProvenance = Object.freeze(provenance);
  if (merged.resolvedAnalysisStrategy === 'LAND') {
    ['beds', 'baths', 'sqft', 'yearBuilt', 'rehab', 'capRate'].forEach((key) => delete merged[key]);
  }
  return Object.freeze(merged);
}
