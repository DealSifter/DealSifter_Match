export type CanonicalFactStatus = 'VERIFIED_RECORD' | 'USER_PROVIDED' | 'CALCULATED' | 'ESTIMATED' | 'UNKNOWN' | 'NOT_APPLICABLE';
export type CanonicalPropertyFact = Readonly<{ value: unknown; status: CanonicalFactStatus; source: string | null;
  retrievedAt: string | null; effectiveDate: string | null; confidence: number | null; conflict: unknown | null }>;

type ContextField = { value?: unknown; status?: string; source?: unknown; retrievedAt?: unknown;
  effectiveDate?: unknown; confidence?: unknown };
type PropertyContext = { fields?: Record<string, ContextField>; conflicts?: Array<Record<string, unknown>> };
type CanonicalOptions = { valuationReferences?: Record<string, unknown> | null };
type RegistryEntry = Readonly<{ group: 'identity' | 'physical' | 'parcel' | 'ownership' | 'tax' | 'sales' | 'notes' | 'features' | 'valuationReferences';
  evidenceKey?: string; propertyKeys?: readonly string[]; source?: string }>;

/** The explicit field registry used by chat and all three report levels. */
export const CANONICAL_PROPERTY_FIELD_REGISTRY: Readonly<Record<string, RegistryEntry>> = Object.freeze({
  address: { group: 'identity', evidenceKey: 'address', propertyKeys: ['address', 'streetAddress'] },
  city: { group: 'identity', evidenceKey: 'city', propertyKeys: ['city'] },
  state: { group: 'identity', evidenceKey: 'state', propertyKeys: ['state'] },
  zip: { group: 'identity', evidenceKey: 'zipCode', propertyKeys: ['zip', 'zipCode', 'postalCode'] },
  formattedAddress: { group: 'identity', evidenceKey: 'formattedAddress', propertyKeys: ['formattedAddress'] },
  latitude: { group: 'identity', evidenceKey: 'latitude', propertyKeys: ['latitude', 'lat'] },
  longitude: { group: 'identity', evidenceKey: 'longitude', propertyKeys: ['longitude', 'lng'] },
  propertyType: { group: 'physical', evidenceKey: 'propertyType', propertyKeys: ['type', 'propertyType'] },
  beds: { group: 'physical', evidenceKey: 'bedrooms', propertyKeys: ['beds', 'bedrooms'] },
  baths: { group: 'physical', evidenceKey: 'bathrooms', propertyKeys: ['baths', 'bathrooms'] },
  livingAreaSqft: { group: 'physical', evidenceKey: 'livingAreaSqft', propertyKeys: ['sqft', 'livingAreaSqft', 'squareFeet'] },
  lotSizeSqft: { group: 'physical', evidenceKey: 'lotSizeSqft', propertyKeys: ['lotSizeSqft', 'lot', 'lotSize'] },
  lotSizeAcres: { group: 'physical', evidenceKey: 'lotSizeAcres', propertyKeys: ['lotSizeAcres'] },
  yearBuilt: { group: 'physical', evidenceKey: 'yearBuilt', propertyKeys: ['yearBuilt'] },
  county: { group: 'parcel', evidenceKey: 'county', propertyKeys: ['county'] },
  stateFips: { group: 'parcel', evidenceKey: 'stateFips', propertyKeys: ['stateFips'] },
  countyFips: { group: 'parcel', evidenceKey: 'countyFips', propertyKeys: ['countyFips'] },
  assessorId: { group: 'parcel', evidenceKey: 'assessorId', propertyKeys: ['assessorId', 'assessorID', 'apn', 'parcelId', 'parcelNumber'] },
  legalDescription: { group: 'parcel', evidenceKey: 'legalDescription', propertyKeys: ['legalDescription'] },
  subdivision: { group: 'parcel', evidenceKey: 'subdivision', propertyKeys: ['subdivision'] },
  zoning: { group: 'parcel', evidenceKey: 'zoning', propertyKeys: ['zoning'] },
  ownerName: { group: 'ownership', propertyKeys: ['ownerName'] },
  ownerType: { group: 'ownership', propertyKeys: ['ownerType'] },
  ownerOccupied: { group: 'ownership', evidenceKey: 'ownerOccupied', propertyKeys: ['ownerOccupied'] },
  ownerMailingAddress: { group: 'ownership', propertyKeys: ['ownerMailingAddress'] },
  ownershipRecordPresent: { group: 'ownership', evidenceKey: 'ownershipRecordPresent', propertyKeys: ['ownershipRecordPresent'] },
  assessedValue: { group: 'tax', evidenceKey: 'assessedValue', propertyKeys: ['assessedValue'] },
  assessmentYear: { group: 'tax', evidenceKey: 'assessmentYear', propertyKeys: ['assessmentYear'] },
  annualPropertyTax: { group: 'tax', evidenceKey: 'annualPropertyTax', propertyKeys: ['annualPropertyTax'] },
  propertyTaxYear: { group: 'tax', evidenceKey: 'propertyTaxYear', propertyKeys: ['propertyTaxYear'] },
  lastSalePrice: { group: 'sales', evidenceKey: 'latestSalePrice', propertyKeys: ['latestSalePrice', 'lastSalePrice'] },
  lastSaleDate: { group: 'sales', evidenceKey: 'latestSaleDate', propertyKeys: ['latestSaleDate', 'lastSaleDate'] },
  saleHistory: { group: 'sales', evidenceKey: 'saleHistory', propertyKeys: ['saleHistory'] },
  hoaFee: { group: 'physical', evidenceKey: 'hoaFee', propertyKeys: ['hoaFee'] },
  userNotes: { group: 'notes', evidenceKey: 'propertyUserNotes', propertyKeys: ['propertyUserNotes', 'notes', 'description'] },
  garage: { group: 'features', propertyKeys: ['garage'] }, pool: { group: 'features', propertyKeys: ['pool'] },
  stories: { group: 'features', propertyKeys: ['stories'] }, units: { group: 'features', propertyKeys: ['units'] },
  fireplace: { group: 'features', propertyKeys: ['fireplace'] }, roof: { group: 'features', propertyKeys: ['roof'] },
  hvac: { group: 'features', propertyKeys: ['hvac'] }, architecture: { group: 'features', propertyKeys: ['architecture'] },
  exterior: { group: 'features', propertyKeys: ['exterior'] }, view: { group: 'features', propertyKeys: ['view'] },
  propertyFeatures: { group: 'features', evidenceKey: 'propertyFeatures', propertyKeys: ['propertyFeatures'] },
  providerEstimate: { group: 'valuationReferences', source: 'RENTCAST_VALUATION' },
  recentSalesMarketEstimate: { group: 'valuationReferences', source: 'RECENT_SALES_MARKET_ESTIMATE' },
});

const REPORT_FIELD_MAP = Object.freeze({ bedrooms: 'beds', bathrooms: 'baths', livingAreaSqft: 'sqft', lotSizeSqft: 'lotSizeSqft',
  yearBuilt: 'yearBuilt', county: 'county', latitude: 'latitude', longitude: 'longitude', assessedValue: 'assessedValue',
  assessmentYear: 'assessmentYear', annualPropertyTax: 'annualPropertyTax', propertyTaxYear: 'propertyTaxYear',
  latestSalePrice: 'latestSalePrice', latestSaleDate: 'latestSaleDate', ownerOccupied: 'ownerOccupied',
  ownershipRecordPresent: 'ownershipRecordPresent', stateFips: 'stateFips', countyFips: 'countyFips', assessorId: 'assessorId',
  legalDescription: 'legalDescription', subdivision: 'subdivision', zoning: 'zoning', hoaFee: 'hoaFee',
  propertyFeatures: 'propertyFeatures', saleHistory: 'saleHistory' } as const);

export const REPORT_FIELD_VISIBILITY = Object.freeze({
  ALWAYS_VISIBLE_IF_AVAILABLE: Object.freeze(['address', 'city', 'state', 'zip', 'type', 'price', 'objective', 'propertyUserNotes']),
  VISIBLE_IF_RELEVANT: Object.freeze(['beds', 'baths', 'sqft', 'lotSizeSqft', 'lotSizeAcres', 'yearBuilt', 'county', 'assessorId',
    'legalDescription', 'subdivision', 'zoning', 'assessedValue', 'assessmentYear', 'annualPropertyTax', 'propertyTaxYear',
    'latestSalePrice', 'latestSaleDate', 'ownerOccupied', 'ownershipRecordPresent', 'hoaFee', 'materialPropertyFeatures', 'saleHistory']),
  INTERNAL_ONLY: Object.freeze(['stateFips', 'countyFips', 'providerPropertyType', 'fieldProvenance']),
});

const present = (value: unknown) => value !== null && value !== undefined && value !== '';
const finite = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : null;
const normalize = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
function propertyTypeFamily(value: unknown) { const token = normalize(value).replace(/\s+/g, '');
  if (['sfr', 'singlefamily', 'singlefamilyresidence', 'detached'].includes(token)) return 'SINGLE_FAMILY';
  if (['land', 'lot', 'vacantland', 'undevelopedland'].includes(token)) return 'LAND'; return token.toUpperCase(); }
function resolvedStrategy(type: unknown, objective: unknown) { const t = normalize(type); const s = normalize(objective);
  if (/\b(?:land|lot|vacant)\b/.test(t)) return 'LAND'; if (/\b(?:sub to|subject to|subto)\b/.test(s)) return 'SUB_TO';
  if (/\b(?:seller financ\w*|owner financ\w*|owner carry)\b/.test(s)) return 'SELLER_FINANCING';
  if (/\b(?:wholesale|assignment)\b/.test(s)) return 'WHOLESALE'; if (/\b(?:buy and hold|buy hold|rental|hold)\b/.test(s)) return 'BUY_AND_HOLD';
  if (/\b(?:flip|fix and flip|rehab and sell)\b/.test(s)) return 'FLIP'; return 'GENERIC_SELL'; }
function firstValue(property: Record<string, unknown>, keys: readonly string[] = []) { for (const key of keys) if (present(property[key])) return property[key]; return null; }
function status(value: unknown): CanonicalFactStatus { return ['VERIFIED_RECORD', 'USER_PROVIDED', 'CALCULATED', 'ESTIMATED', 'NOT_APPLICABLE'].includes(String(value)) ? value as CanonicalFactStatus : 'UNKNOWN'; }
function conflictFor(field: string, context: PropertyContext | null) { return (context?.conflicts || []).find((item) => String(item.field || '') === field) || null; }
function materialFeatures(value: unknown, strategy: string) { const entries = Array.isArray(value) ? value : value && typeof value === 'object'
  ? Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${String(item)}`) : [];
  const tokens = strategy === 'LAND' ? /zoning|zone|access|road|utility|water|sewer|electric|survey|topograph|flood|acre|lot|parcel|subdiv/i
    : /garage|pool|roof|foundation|heating|cooling|parking|fireplace|construction|condition|renovat|bed|bath/i;
  return entries.filter((entry) => tokens.test(String(entry))).slice(0, 12); }

function factFor(field: string, registry: RegistryEntry, property: Record<string, unknown>, context: PropertyContext | null,
  valuation: Record<string, unknown>): CanonicalPropertyFact {
  const evidence = registry.evidenceKey ? context?.fields?.[registry.evidenceKey] : null;
  if (evidence && status(evidence.status) !== 'UNKNOWN' && present(evidence.value)) return Object.freeze({ value: evidence.value,
    status: status(evidence.status), source: String(evidence.source || 'PROPERTY_EVIDENCE'),
    retrievedAt: present(evidence.retrievedAt) ? String(evidence.retrievedAt) : null,
    effectiveDate: present(evidence.effectiveDate) ? String(evidence.effectiveDate) : null,
    confidence: finite(evidence.confidence), conflict: conflictFor(registry.evidenceKey || field, context) });
  if (registry.group === 'valuationReferences') { const value = valuation[field]; return Object.freeze({ value: present(value) ? value : null,
    status: present(value) ? 'ESTIMATED' : 'UNKNOWN', source: present(value) ? registry.source || 'VALUATION_EVIDENCE' : null,
    retrievedAt: null, effectiveDate: null, confidence: null, conflict: null }); }
  let value = firstValue(property, registry.propertyKeys);
  if (!present(value) && field === 'ownerName' && property.owner && typeof property.owner === 'object') value = (property.owner as Record<string, unknown>).name;
  if (!present(value) && field === 'ownerType' && property.owner && typeof property.owner === 'object') value = (property.owner as Record<string, unknown>).type;
  if (!present(value) && field === 'formattedAddress') value = [firstValue(property, ['address']), firstValue(property, ['city']), firstValue(property, ['state']), firstValue(property, ['zip'])].filter(present).join(', ') || null;
  return Object.freeze({ value: present(value) ? value : null, status: present(value) ? 'USER_PROVIDED' : 'UNKNOWN',
    source: present(value) ? 'PROPERTY_APP_VALUE' : null, retrievedAt: null, effectiveDate: null, confidence: null,
    conflict: conflictFor(registry.evidenceKey || field, context) });
}

export function buildCanonicalPropertyFacts(property: Record<string, unknown> | null, propertyContext: PropertyContext | null,
  options: CanonicalOptions = {}) {
  const source = { ...(property || {}) }; const valuation = options.valuationReferences || {}; const groups: Record<string, Record<string, CanonicalPropertyFact>> = {};
  Object.entries(CANONICAL_PROPERTY_FIELD_REGISTRY).forEach(([field, registry]) => { groups[registry.group] ||= {};
    groups[registry.group][field] = factFor(field, registry, source, propertyContext, valuation); });
  const sqft = finite(groups.physical.lotSizeSqft.value); const acres = finite(groups.physical.lotSizeAcres.value);
  if (sqft !== null && sqft > 0 && (acres === null || acres <= 0)) groups.physical.lotSizeAcres = Object.freeze({ value: Math.round((sqft / 43_560) * 10_000) / 10_000,
    status: 'CALCULATED', source: 'LOT_SIZE_CONVERSION', retrievedAt: null, effectiveDate: null, confidence: null, conflict: null });
  const frozenGroups = Object.fromEntries(Object.entries(groups).map(([group, values]) => [group, Object.freeze(values)]));
  return Object.freeze({ version: 'CANONICAL_PROPERTY_FACTS_V1', ...frozenGroups,
    provenance: Object.freeze({ registry: 'CANONICAL_PROPERTY_FIELD_REGISTRY_V1' }),
    conflicts: Object.freeze((propertyContext?.conflicts || []).map((item) => Object.freeze({ ...item }))) });
}

export function mergeVerifiedPropertyEvidenceIntoFacts(property: Record<string, unknown> | null, propertyContext: PropertyContext | null,
  options: CanonicalOptions = {}) {
  const merged: Record<string, unknown> = { ...(property || {}) }; const fields = propertyContext?.fields || {}; const provenance: Record<string, string> = {};
  Object.entries(REPORT_FIELD_MAP).forEach(([evidenceKey, reportKey]) => { const evidence = fields[evidenceKey];
    if (evidence?.status === 'VERIFIED_RECORD' && present(evidence.value)) { merged[reportKey] = evidence.value; provenance[reportKey] = String(evidence.source || 'PROPERTY_EVIDENCE'); } });
  const providerType = fields.propertyType?.status === 'VERIFIED_RECORD' && present(fields.propertyType.value) ? fields.propertyType.value : null;
  const canonicalType = present(property?.type) ? property?.type : present(property?.propertyType) ? property?.propertyType : providerType;
  if (present(canonicalType)) merged.type = canonicalType; if (present(providerType)) merged.providerPropertyType = providerType;
  if (present(canonicalType)) merged.resolvedAnalysisPropertyType = canonicalType;
  if (present(canonicalType) || present(merged.objective)) merged.resolvedAnalysisStrategy = resolvedStrategy(canonicalType, merged.objective);
  if (present(providerType) && present(canonicalType)) merged.propertyTypeConflict = propertyTypeFamily(providerType) !== propertyTypeFamily(canonicalType);
  if (present(property?.notes)) merged.propertyUserNotes = property?.notes;
  if (!present(merged.propertyUserNotes) && present(property?.description)) merged.propertyUserNotes = property?.description;
  if (present(property?.maxxisPropertySummary)) merged.maxxisPropertySummary = property?.maxxisPropertySummary;
  else if (present(property?.description)) merged.maxxisPropertySummary = property?.description;
  const sqft = finite(merged.lotSizeSqft ?? merged.lot); const acres = finite(merged.lotSizeAcres);
  if ((acres === null || acres <= 0) && sqft !== null && sqft > 0) merged.lotSizeAcres = Math.round((sqft / 43_560) * 10_000) / 10_000;
  if ((sqft === null || sqft <= 0) && acres !== null && acres > 0) merged.lotSizeSqft = Math.round(acres * 43_560 * 10) / 10;
  if (!present(merged.lot) && present(merged.lotSizeSqft)) merged.lot = merged.lotSizeSqft;
  const features = materialFeatures(merged.propertyFeatures, String(merged.resolvedAnalysisStrategy)); if (features.length) merged.materialPropertyFeatures = features;
  if (Object.keys(provenance).length) merged.fieldProvenance = Object.freeze(provenance);
  if (merged.resolvedAnalysisStrategy === 'LAND') ['beds', 'baths', 'sqft', 'yearBuilt', 'rehab', 'capRate'].forEach((key) => delete merged[key]);
  merged.canonicalPropertyFacts = buildCanonicalPropertyFacts(merged, propertyContext, options);
  return Object.freeze(merged);
}
