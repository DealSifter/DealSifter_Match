const FIELD_MAP = Object.freeze({
  bedrooms: 'beds', bathrooms: 'baths', livingAreaSqft: 'sqft',
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
const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
const propertyTypeFamily = (value) => {
  const token = normalize(value).replace(/\s+/g, '');
  if (['sfr', 'singlefamily', 'singlefamilyresidence', 'detached'].includes(token)) return 'SINGLE_FAMILY';
  if (['land', 'lot', 'vacantland', 'undevelopedland'].includes(token)) return 'LAND';
  return token.toUpperCase();
};
const strategyFor = (type, objective) => {
  const propertyType = normalize(type); const strategy = normalize(objective);
  if (/\b(?:land|lot|vacant)\b/.test(propertyType)) return 'LAND';
  if (/\b(?:sub to|subject to|subto)\b/.test(strategy)) return 'SUB_TO';
  if (/\b(?:seller financ\w*|owner financ\w*|owner carry)\b/.test(strategy)) return 'SELLER_FINANCING';
  if (/\b(?:wholesale|assignment)\b/.test(strategy)) return 'WHOLESALE';
  if (/\b(?:buy and hold|buy hold|rental|hold)\b/.test(strategy)) return 'BUY_AND_HOLD';
  if (/\b(?:flip|fix and flip|rehab and sell)\b/.test(strategy)) return 'FLIP';
  return 'GENERIC_SELL';
};
const materialFeatures = (features, strategy) => (Array.isArray(features) ? features : [])
  .filter((entry) => (strategy === 'LAND'
    ? /zoning|zone|access|road|utility|water|sewer|electric|survey|topograph|flood|acre|lot|parcel|subdiv/i
    : /garage|pool|roof|foundation|heating|cooling|parking|fireplace|construction|condition|renovat|bed|bath/i)
    .test(typeof entry === 'string' ? entry : JSON.stringify(entry)))
  .slice(0, 12);

export function mergePropertyReleaseEvidence(property, response) {
  const merged = { ...(property || {}) };
  if (response?.state !== 'unlocked') return Object.freeze(merged);
  const fields = response?.intelligence?.fields || {};
  Object.entries(FIELD_MAP).forEach(([field, propertyKey]) => {
    const evidence = fields[field];
    if (evidence?.status === 'VERIFIED_RECORD' && present(evidence.value)) merged[propertyKey] = evidence.value;
  });
  const providerType = fields.propertyType?.status === 'VERIFIED_RECORD' && present(fields.propertyType.value)
    ? fields.propertyType.value : null;
  if (!present(merged.type) && present(providerType)) merged.type = providerType;
  if (present(providerType)) merged.providerPropertyType = providerType;
  if (present(merged.type)) merged.resolvedAnalysisPropertyType = merged.type;
  if (present(merged.type) || present(merged.objective)) merged.resolvedAnalysisStrategy = strategyFor(merged.type, merged.objective);
  if (present(providerType) && present(merged.type)) {
    merged.propertyTypeConflict = propertyTypeFamily(providerType) !== propertyTypeFamily(merged.type);
  }
  if (present(merged.notes)) merged.propertyUserNotes = merged.notes;
  if (present(merged.description)) merged.maxxisPropertySummary = merged.description;
  const lotSqft = Number(merged.lotSizeSqft ?? merged.lot);
  if (!present(merged.lotSizeAcres) && Number.isFinite(lotSqft) && lotSqft > 0) {
    merged.lotSizeAcres = Math.round((lotSqft / 43_560) * 10_000) / 10_000;
  }
  const features = materialFeatures(merged.propertyFeatures, merged.resolvedAnalysisStrategy);
  if (features.length) merged.materialPropertyFeatures = features;
  return Object.freeze(merged);
}
