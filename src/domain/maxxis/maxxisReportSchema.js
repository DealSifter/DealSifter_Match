import { INTELLIGENCE_REPORT_TYPES } from '../intelligenceAccess';

export const MAXXIS_REPORT_SCHEMA_VERSION = 'MAXXIS_REPORT_SCHEMA_V2';
export const MAXXIS_REPORT_SOURCE_TYPES = Object.freeze([
  'USER_PROVIDED', 'VERIFIED_RECORD', 'CALCULATED', 'ESTIMATED', 'UNKNOWN', 'NOT_APPLICABLE',
]);

const REPORT_SECTIONS = Object.freeze([
  'propertySummary', 'executiveSummary', 'investmentProfile', 'propertyEvidence',
  'comparableEvidence', 'valuationEvidence', 'riskAssessment', 'limitations',
  'verificationChecklist', 'provenance',
]);

const LEVEL_SECTIONS = Object.freeze({
  PROPERTY_RELEASE: new Set(['propertySummary', 'provenance']),
  MAXXIS_ANALYSIS: new Set(['propertySummary', 'executiveSummary', 'investmentProfile', 'riskAssessment', 'limitations', 'verificationChecklist', 'provenance']),
  DEAL_INTELLIGENCE: new Set(REPORT_SECTIONS),
});

const PROPERTY_KEYS = Object.freeze([
  'id', 'title', 'address', 'city', 'state', 'zip', 'description', 'type', 'beds',
  'baths', 'sqft', 'lot', 'price', 'images', 'improvement', 'dealTag', 'objective',
  'rehab', 'capRate', 'markets', 'published', 'dealClosed', 'notes', 'source',
  'portfolio', 'labels', 'owner', 'latitude', 'longitude', 'yearBuilt', 'county',
  'assessedValue', 'assessmentYear', 'annualPropertyTax', 'propertyTaxYear',
  'ownerOccupied', 'ownershipRecordPresent',
  'latestSalePrice', 'latestSaleDate',
  'lotSizeSqft', 'lotSizeAcres', 'pricePerLotSqft', 'pricePerAcre',
  'stateFips', 'countyFips', 'assessorId', 'legalDescription', 'subdivision',
  'zoning', 'hoaFee', 'propertyFeatures', 'saleHistory',
  'propertyUserNotes', 'maxxisPropertySummary', 'maxxisAnalyticalCommentary',
  'resolvedAnalysisPropertyType', 'resolvedAnalysisStrategy', 'providerPropertyType',
  'propertyTypeConflict', 'materialPropertyFeatures', 'fieldProvenance', 'reportFieldVisibility',
  'canonicalPropertyFacts',
]);
const COMPARABLE_KEYS = Object.freeze([
  'compIdentifier', 'address', 'salePrice', 'saleDate', 'distanceMiles', 'similarity',
  'conditionStatus', 'candidateCondition', 'conditionEvidenceSource', 'promotionBlockers',
  'transactionQuality', 'role', 'inclusionReason', 'exclusionReason', 'beds',
  'baths', 'sqft', 'latitude', 'longitude', 'sourceType', 'provenance',
  'lotSizeSqft', 'yearBuilt', 'providerCorrelation', 'saleAgeDays', 'compClass',
]);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const hasReportValue = (value) => value !== null && value !== undefined && value !== '';
const sourceType = (value, fallback = 'UNKNOWN') => MAXXIS_REPORT_SOURCE_TYPES.includes(value) ? value : fallback;
const emptySection = () => Object.freeze({ available: false, sourceType: 'UNKNOWN', data: null });
const finiteCoordinate = (value) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const isVacantLandType = (value) => /^(?:vacant\s+land|land|lot|terreno|solar)$/i.test(String(value || '').trim());
const resolvedStrategyFor = (type, objective) => {
  const propertyType = String(type || '').trim().toLowerCase();
  const strategy = String(objective || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  if (isVacantLandType(propertyType)) return 'LAND';
  if (/\b(?:sub to|subject to|subto)\b/.test(strategy)) return 'SUB_TO';
  if (/\b(?:seller financ\w*|owner financ\w*|owner carry)\b/.test(strategy)) return 'SELLER_FINANCING';
  if (/\b(?:wholesale|assignment)\b/.test(strategy)) return 'WHOLESALE';
  if (/\b(?:buy and hold|buy hold|rental|hold)\b/.test(strategy)) return 'BUY_AND_HOLD';
  if (/\b(?:flip|fix and flip|rehab and sell)\b/.test(strategy)) return 'FLIP';
  return 'GENERIC_SELL';
};
const section = (data, source, available = data !== null && data !== undefined) => available
  ? Object.freeze({ available: true, sourceType: sourceType(source), data })
  : emptySection();

function canonicalPropertyInput(property) {
  if (!isObject(property)) return {};
  return {
    ...property,
    id: property.id ?? property.propertyId,
    title: property.title ?? property.name,
    address: property.address ?? property.streetAddress,
    zip: property.zip ?? property.zipCode ?? property.postalCode,
    type: property.type ?? property.propertyType,
    beds: property.beds ?? property.bedrooms,
    baths: property.baths ?? property.bathrooms,
    sqft: property.sqft ?? property.livingAreaSqft ?? property.squareFeet,
    lot: property.lot ?? property.lotSizeSqft ?? property.lotSize,
    lotSizeSqft: property.lotSizeSqft,
    lotSizeAcres: property.lotSizeAcres,
    pricePerLotSqft: property.pricePerLotSqft,
    pricePerAcre: property.pricePerAcre,
    price: property.price ?? property.askingPrice,
    latitude: property.latitude ?? property.lat,
    longitude: property.longitude ?? property.lng,
  };
}

// Combines the server-owned evidence snapshot with the exact property context already
// authorized on the current app surface. Evidence wins when present; app values only
// fill gaps (owner/contact data, photos and notes are commonly app-only).
export function mergeMaxxisReportProperty(evidenceProperty, appProperty) {
  const evidence = canonicalPropertyInput(evidenceProperty);
  const app = canonicalPropertyInput(appProperty);
  const merged = {};
  const appAuthoritative = new Set([
    'id', 'title', 'address', 'city', 'state', 'zip', 'type', 'objective', 'notes',
    'propertyUserNotes', 'description', 'maxxisPropertySummary',
  ]);
  PROPERTY_KEYS.forEach((key) => {
    if (key === 'owner' || key === 'images') return;
    const selected = appAuthoritative.has(key)
      ? (hasReportValue(app[key]) ? app[key] : evidence[key])
      : (hasReportValue(evidence[key]) ? evidence[key] : app[key]);
    if (hasReportValue(selected)) merged[key] = selected;
  });
  merged.propertyUserNotes = hasReportValue(app.propertyUserNotes) ? app.propertyUserNotes
    : hasReportValue(app.notes) ? app.notes
      : hasReportValue(evidence.propertyUserNotes) ? evidence.propertyUserNotes : null;
  merged.maxxisPropertySummary = hasReportValue(evidence.maxxisPropertySummary)
    ? evidence.maxxisPropertySummary : (hasReportValue(app.description) ? app.description : null);
  merged.maxxisAnalyticalCommentary = hasReportValue(evidence.maxxisAnalyticalCommentary)
    ? evidence.maxxisAnalyticalCommentary : null;
  merged.resolvedAnalysisPropertyType = hasReportValue(app.type) ? app.type
    : (evidence.resolvedAnalysisPropertyType || evidence.type || null);
  merged.type = merged.resolvedAnalysisPropertyType || merged.type;
  merged.resolvedAnalysisStrategy = app.resolvedAnalysisStrategy
    || (hasReportValue(app.type) || hasReportValue(app.objective)
      ? resolvedStrategyFor(merged.type, merged.objective)
      : evidence.resolvedAnalysisStrategy || resolvedStrategyFor(merged.type, merged.objective));
  if (Number(merged.capRate) === 0 && merged.resolvedAnalysisStrategy !== 'BUY_AND_HOLD') {
    delete merged.capRate;
  }
  const images = [...(Array.isArray(evidence.images) ? evidence.images : []),
    ...(Array.isArray(app.images) ? app.images : [])]
    .filter((item) => typeof item === 'string' && item.trim())
    .filter((item, index, values) => values.indexOf(item) === index)
    .slice(0, 8);
  if (images.length) merged.images = images;
  const evidenceOwner = isObject(evidence.owner) ? evidence.owner : {};
  const appOwner = isObject(app.owner) ? app.owner : {};
  const allowedContacts = [
    ...(Array.isArray(evidenceOwner.allowedContacts) ? evidenceOwner.allowedContacts : []),
    ...(Array.isArray(appOwner.allowedContacts) ? appOwner.allowedContacts : []),
  ].filter((contact, index, values) => contact && values.findIndex((candidate) =>
    String(candidate?.type || '') === String(contact?.type || '')
      && String(candidate?.value || '') === String(contact?.value || '')) === index);
  const owner = {
    name: hasReportValue(evidenceOwner.name) ? evidenceOwner.name : appOwner.name,
    type: hasReportValue(evidenceOwner.type) ? evidenceOwner.type : appOwner.type,
    status: hasReportValue(evidenceOwner.status) ? evidenceOwner.status : appOwner.status,
    allowedContacts,
  };
  if (hasReportValue(owner.name) || hasReportValue(owner.type) || hasReportValue(owner.status) || allowedContacts.length) {
    merged.owner = owner;
  }
  if (isVacantLandType(merged.type)) {
    ['beds', 'baths', 'sqft', 'yearBuilt', 'rehab', 'capRate'].forEach((key) => delete merged[key]);
  }
  return Object.freeze(merged);
}

const CANONICAL_TO_OVERVIEW = Object.freeze({
  'identity.address': 'address', 'identity.city': 'city', 'identity.state': 'state', 'identity.zip': 'zip',
  'identity.latitude': 'latitude', 'identity.longitude': 'longitude', 'physical.propertyType': 'type',
  'physical.beds': 'beds', 'physical.baths': 'baths', 'physical.livingAreaSqft': 'sqft',
  'physical.lotSizeSqft': 'lotSizeSqft', 'physical.lotSizeAcres': 'lotSizeAcres', 'physical.yearBuilt': 'yearBuilt',
  'physical.hoaFee': 'hoaFee', 'parcel.county': 'county', 'parcel.stateFips': 'stateFips',
  'parcel.countyFips': 'countyFips', 'parcel.assessorId': 'assessorId', 'parcel.legalDescription': 'legalDescription',
  'parcel.subdivision': 'subdivision', 'parcel.zoning': 'zoning', 'ownership.ownerOccupied': 'ownerOccupied',
  'ownership.ownershipRecordPresent': 'ownershipRecordPresent', 'tax.assessedValue': 'assessedValue',
  'tax.assessmentYear': 'assessmentYear', 'tax.annualPropertyTax': 'annualPropertyTax',
  'tax.propertyTaxYear': 'propertyTaxYear', 'sales.lastSalePrice': 'latestSalePrice',
  'sales.lastSaleDate': 'latestSaleDate', 'sales.saleHistory': 'saleHistory', 'notes.userNotes': 'propertyUserNotes',
  'features.propertyFeatures': 'propertyFeatures',
});

/** A single factual overview projection shared by L1, L2 and L3. */
export function buildPropertyOverviewModel(property) {
  if (!isObject(property)) return null;
  const data = Object.fromEntries(PROPERTY_KEYS
    .filter((key) => Object.hasOwn(property, key))
    .map((key) => [key, property[key] === undefined ? null : property[key]]));
  const canonical = isObject(property.canonicalPropertyFacts) ? property.canonicalPropertyFacts : null;
  if (canonical) {
    Object.entries(CANONICAL_TO_OVERVIEW).forEach(([path, target]) => {
      const [group, field] = path.split('.');
      const fact = canonical?.[group]?.[field];
      // Canonical evidence wins for objective facts. App-owned Notes remain exact.
      if (hasReportValue(fact?.value) && (target !== 'propertyUserNotes' || !hasReportValue(data.propertyUserNotes))) {
        data[target] = fact.value;
      }
    });
    data.canonicalPropertyFacts = canonical;
  }
  if (!hasReportValue(data.resolvedAnalysisPropertyType) && hasReportValue(data.type)) data.resolvedAnalysisPropertyType = data.type;
  if (!hasReportValue(data.resolvedAnalysisStrategy)) data.resolvedAnalysisStrategy = resolvedStrategyFor(data.type, data.objective);
  if (Number(data.capRate) === 0 && data.resolvedAnalysisStrategy !== 'BUY_AND_HOLD') delete data.capRate;
  if (isVacantLandType(data.type)) {
    ['beds', 'baths', 'sqft', 'yearBuilt', 'rehab', 'capRate'].forEach((key) => delete data[key]);
  }
  if (Object.hasOwn(data, 'images')) {
    data.images = Object.freeze((Array.isArray(data.images) ? data.images : []).filter((item) => typeof item === 'string' && item.trim()));
  }
  const latitude = finiteCoordinate(property.latitude ?? property.lat);
  const longitude = finiteCoordinate(property.longitude ?? property.lng);
  if (latitude !== null && latitude >= -90 && latitude <= 90) data.latitude = latitude;
  if (longitude !== null && longitude >= -180 && longitude <= 180) data.longitude = longitude;
  if (Object.hasOwn(data, 'owner')) {
    const owner = isObject(data.owner) ? data.owner : {};
    data.owner = Object.freeze({
      name: owner.name || null,
      type: owner.type || null,
      status: owner.status || null,
      allowedContacts: Object.freeze(Array.isArray(owner.allowedContacts) ? owner.allowedContacts.map((contact) => Object.freeze({
        type: contact?.type || null, label: contact?.label || null, value: contact?.value || null,
      })) : []),
    });
  }
  return Object.keys(data).length ? Object.freeze(data) : null;
}

const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const roundedMoney = (value) => Number.isFinite(value) ? Math.round(value / 1000) * 1000 : null;
const roundedPercent = (value) => Number.isFinite(value) ? Math.round(value * 10) / 10 : null;

function scenarioKpis(property, valuation) {
  const purchasePrice = finitePositive(property?.price);
  const rehab = finitePositive(property?.rehab);
  const rangeLow = finitePositive(valuation?.range?.low);
  const rangeHigh = finitePositive(valuation?.range?.high);
  if (!purchasePrice || !rehab || !rangeLow || !rangeHigh || ['ARV_UNAVAILABLE', 'NOT_APPLICABLE'].includes(valuation?.status)) {
    return Object.freeze({
      available: false,
      sourceType: valuation?.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : 'UNKNOWN',
      reason: valuation?.status === 'NOT_APPLICABLE'
        ? 'RESIDENTIAL_ARV_NOT_APPLICABLE' : 'PURCHASE_PRICE_REHAB_AND_ARV_RANGE_REQUIRED',
      potentialSpread: null, projectedRoi: null,
    });
  }
  const costBasis = purchasePrice + rehab;
  const centralReference = finitePositive(valuation.centralReference);
  const expectedArv = centralReference && centralReference >= rangeLow && centralReference <= rangeHigh
    ? centralReference : ((rangeLow + rangeHigh) / 2);
  const values = [rangeLow, expectedArv, rangeHigh];
  const potentialSpread = Object.freeze(values.map((arv, index) => Object.freeze({
    scenario: ['LOW', 'EXPECTED', 'HIGH'][index], value: roundedMoney(arv - costBasis),
  })));
  const projectedRoi = Object.freeze(values.map((arv, index) => Object.freeze({
    scenario: ['LOW', 'EXPECTED', 'HIGH'][index], value: roundedPercent(((arv - costBasis) / costBasis) * 100),
  })));
  return Object.freeze({
    available: true, sourceType: 'CALCULATED', scenarioBased: true, rounded: true,
    inputs: Object.freeze({ purchasePrice, rehab, arvRange: Object.freeze({ low: rangeLow, high: rangeHigh }) }),
    potentialSpread, projectedRoi,
    disclaimer: 'Scenario-based illustration from existing inputs; not a return forecast or guarantee.',
  });
}

function existingMetrics(dealMetrics, property) {
  const metrics = isObject(dealMetrics?.metrics) ? dealMetrics.metrics : {};
  const metric = (key) => metrics[key]?.calculable && Number.isFinite(Number(metrics[key]?.value))
    ? Object.freeze({ value: Number(metrics[key].value), sourceType: 'CALCULATED', source: metrics[key].source || null })
    : Object.freeze({ value: null, sourceType: 'UNKNOWN', source: null });
  return Object.freeze({
    pricePerSqft: metric('pricePerSqft'),
    acquisitionPlusRehab: metric('acquisitionPlusRehab'),
    capRate: metrics.capRate?.calculable && Number.isFinite(Number(metrics.capRate?.value))
      && (String(property?.resolvedAnalysisStrategy || '').toUpperCase() === 'BUY_AND_HOLD'
        || Number(metrics.capRate.value) > 0)
      ? Object.freeze({ value: Number(metrics.capRate.value), sourceType: 'USER_PROVIDED', source: metrics.capRate.source || 'stored' })
      : Object.freeze({ value: null, sourceType: 'UNKNOWN', source: null }),
  });
}

function evidenceCounts(evidence, sections) {
  const listLength = (value) => Array.isArray(value) ? value.length : 0;
  const sectionCount = (type) => Object.values(sections || {}).filter((item) => item?.available && item.sourceType === type).length;
  return Object.freeze({
    verifiedRecords: listLength(evidence?.verifiedRecords),
    userProvided: listLength(evidence?.userProvided),
    calculated: sectionCount('CALCULATED'),
    estimated: sectionCount('ESTIMATED'),
    unknown: listLength(evidence?.unknown),
    conflicts: listLength(evidence?.conflicts),
  });
}

function comparableEvidence(value) {
  if (!isObject(value)) return null;
  const select = (items) => Object.freeze((Array.isArray(items) ? items : []).map((item) => Object.freeze(
    Object.fromEntries(COMPARABLE_KEYS.filter((key) => Object.hasOwn(item || {}, key)).map((key) => [key, item[key]])),
  )));
  return Object.freeze({ used: select(value.used), supporting: select(value.supporting), excluded: select(value.excluded) });
}

function comparableStatistics(comparables, property) {
  const used = Array.isArray(comparables?.used) ? comparables.used : [];
  const supporting = Array.isArray(comparables?.supporting) ? comparables.supporting : [];
  const set = used.length ? used : supporting;
  const numbers = (values) => values.map(Number).filter(Number.isFinite);
  const average = (values) => values.length
    ? Math.round((values.reduce((sum, entry) => sum + entry, 0) / values.length) * 100) / 100 : null;
  const median = (values) => {
    if (!values.length) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const value = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    return Math.round(value * 100) / 100;
  };
  const salePrices = numbers(set.map((item) => item.salePrice));
  const pricePerSqft = numbers(set.map((item) => {
    const price = finitePositive(item.salePrice);
    const sqft = finitePositive(item.sqft);
    return price && sqft ? price / sqft : null;
  }));
  const land = isVacantLandType(property?.type);
  const pricePerLotSqft = numbers(set.map((item) => {
    const price = finitePositive(item.salePrice);
    const lot = finitePositive(item.lotSizeSqft);
    return price && lot ? price / lot : null;
  }));
  const subjectPrice = finitePositive(property?.price);
  const subjectSqft = finitePositive(property?.sqft);
  const subjectPricePerSqft = subjectPrice && subjectSqft ? subjectPrice / subjectSqft : null;
  const marketPricePerSqft = average(pricePerSqft);
  return Object.freeze({
    sourceType: set.length ? 'CALCULATED' : 'UNKNOWN',
    sampleSize: set.length,
    usedCount: used.length,
    supportingCount: supporting.length,
    averageSalePrice: average(salePrices),
    medianSalePrice: median(salePrices),
    salePriceLow: salePrices.length ? Math.min(...salePrices) : null,
    salePriceHigh: salePrices.length ? Math.max(...salePrices) : null,
    averageDistanceMiles: average(numbers(set.map((item) => item.distanceMiles))),
    medianDistanceMiles: median(numbers(set.map((item) => item.distanceMiles))),
    medianSaleAgeDays: median(numbers(set.map((item) => item.saleAgeDays))),
    averageSimilarity: average(numbers(set.map((item) => item.similarity))),
    structuralScoreRange: (() => {
      const values = numbers(set.map((item) => item.similarity));
      return values.length ? Object.freeze({ low: Math.min(...values), high: Math.max(...values) }) : null;
    })(),
    providerCorrelationRange: (() => {
      const values = numbers(set.map((item) => item.providerCorrelation));
      return values.length ? Object.freeze({ low: Math.min(...values), high: Math.max(...values) }) : null;
    })(),
    medianUnitPrice: land ? median(pricePerLotSqft) : median(pricePerSqft),
    averageUnitPrice: land ? average(pricePerLotSqft) : average(pricePerSqft),
    unitPriceBasis: land ? 'LOT_SQFT' : 'LIVING_SQFT',
    marketPricePerSqft,
    subjectPricePerSqft: subjectPricePerSqft === null ? null : Math.round(subjectPricePerSqft * 100) / 100,
    subjectVsMarketPercent: subjectPricePerSqft && marketPricePerSqft
      ? Math.round(((subjectPricePerSqft / marketPricePerSqft) - 1) * 1000) / 10 : null,
  });
}

function valuationEvidence(value) {
  if (!isObject(value)) return null;
  const status = ['ARV_AVAILABLE', 'ARV_LIMITED', 'ARV_UNAVAILABLE', 'NOT_APPLICABLE'].includes(value.status)
    ? value.status : 'ARV_UNAVAILABLE';
  const available = !['ARV_UNAVAILABLE', 'NOT_APPLICABLE'].includes(status);
  const low = finitePositive(value.range?.low);
  const high = finitePositive(value.range?.high);
  const range = available && low && high && low <= high ? Object.freeze({ low, high }) : null;
  const centralReference = finitePositive(value.centralReference);
  return Object.freeze({
    status,
    range,
    centralReference: available && range && centralReference && centralReference >= range.low && centralReference <= range.high
      ? centralReference : null,
    confidence: ['LOW', 'MODERATE', 'HIGH'].includes(value.confidence) ? value.confidence : 'LOW',
    compsUsed: Number.isFinite(Number(value.compsUsed)) ? Math.max(0, Number(value.compsUsed)) : 0,
    methodology: value.methodology || null,
    warnings: Object.freeze(Array.isArray(value.warnings) ? [...value.warnings] : []),
    source: status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : available ? 'CALCULATED' : 'UNKNOWN',
    providerEstimate: isObject(value.providerEstimate) && finitePositive(value.providerEstimate.value)
      ? Object.freeze({
          value: finitePositive(value.providerEstimate.value),
          status: value.providerEstimate.status || 'PROVIDER_ESTIMATE_UNVALIDATED',
          provenance: 'ESTIMATED',
        })
      : null,
    recentSalesMarketEstimate: isObject(value.recentSalesMarketEstimate)
      ? Object.freeze({ ...value.recentSalesMarketEstimate }) : null,
    providerEstimateDivergence: Number.isFinite(Number(value.providerEstimateDivergence))
      ? Number(value.providerEstimateDivergence) : null,
    activeSaleListings: Object.freeze(Array.isArray(value.activeSaleListings) ? value.activeSaleListings.slice(0, 10) : []),
    marketData: isObject(value.marketData) ? Object.freeze({ ...value.marketData }) : null,
    rentalEvidence: isObject(value.rentalEvidence) ? Object.freeze({ ...value.rentalEvidence }) : null,
  });
}

function pagesFor(reportType) {
  if (reportType === INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE) {
    return Object.freeze([Object.freeze({ page: 1, code: 'PROPERTY_OVERVIEW', sections: ['propertySummary', 'provenance'] })]);
  }
  if (reportType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS) {
    return Object.freeze([
      Object.freeze({ page: 1, code: 'EXECUTIVE_SUMMARY_PROPERTY_CONTEXT', sections: ['propertySummary', 'executiveSummary', 'provenance'] }),
      Object.freeze({ page: 2, code: 'INVESTMENT_FIT_RISK', sections: ['investmentProfile', 'riskAssessment', 'limitations'] }),
      Object.freeze({ page: 3, code: 'KEY_INSIGHTS_NEXT_STEPS', sections: ['executiveSummary', 'limitations', 'verificationChecklist', 'provenance'] }),
    ]);
  }
  return Object.freeze([
    Object.freeze({ page: 1, code: 'PROPERTY_OVERVIEW', sections: ['propertySummary', 'provenance'] }),
    Object.freeze({ page: 2, code: 'COMPARATIVE_MARKET_ANALYSIS', sections: ['comparableEvidence', 'provenance'] }),
    Object.freeze({ page: 3, code: 'VALUATION_INTELLIGENCE', sections: ['valuationEvidence', 'limitations'] }),
    Object.freeze({ page: 4, code: 'INVESTMENT_FIT_RISK', sections: ['investmentProfile', 'riskAssessment', 'propertyEvidence'] }),
    Object.freeze({ page: 5, code: 'KEY_INSIGHTS_VERIFICATION', sections: ['executiveSummary', 'limitations', 'verificationChecklist'] }),
    Object.freeze({ page: 6, code: 'MAXXIS_AI_ANALYSIS', sections: ['executiveSummary', 'riskAssessment', 'verificationChecklist', 'provenance'] }),
  ]);
}

function levelData(reportType, input) {
  const property = buildPropertyOverviewModel(input.property);
  if (reportType === INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE) {
    return {
      propertySummary: section(property, 'USER_PROVIDED'),
      provenance: section({ propertySummary: 'USER_PROVIDED' }, 'USER_PROVIDED'),
    };
  }
  if (reportType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS) {
    const analysis = isObject(input.maxxisAnalysis) ? input.maxxisAnalysis : {};
    const executive = analysis.executiveSummary || analysis.keyObservations
      ? Object.freeze({ summary: analysis.executiveSummary || null, observations: analysis.keyObservations || null,
        dealThesis: analysis.dealThesis || null, marketContext: analysis.marketContext || null })
      : null;
    return {
      propertySummary: section(property, 'USER_PROVIDED'),
      executiveSummary: section(executive, 'CALCULATED'),
      investmentProfile: section(analysis.profileAlignment || null, 'CALCULATED'),
      riskAssessment: section(analysis.riskAwareness || null, 'CALCULATED'),
      limitations: section(analysis.limitations || null, 'CALCULATED'),
      verificationChecklist: section(analysis.nextSteps || null, 'CALCULATED'),
      provenance: section(analysis.provenance || null, 'CALCULATED'),
    };
  }
  const intelligence = isObject(input.dealIntelligence) ? input.dealIntelligence : {};
  const valuation = valuationEvidence(intelligence.valuationIntelligence);
  const executive = intelligence.executiveDealOverview || intelligence.whyThisPropertyStandsOut
    ? Object.freeze({
      summary: intelligence.executiveDealOverview || null,
      observations: Array.isArray(intelligence.whyThisPropertyStandsOut) ? intelligence.whyThisPropertyStandsOut : [],
    }) : null;
  const checklist = Object.freeze([
    ...(Array.isArray(intelligence.nextVerificationSteps) ? intelligence.nextVerificationSteps : []),
    ...(valuation?.status === 'NOT_APPLICABLE' ? [] : ['Validate property condition.']),
    'Verify title and encumbrances.',
    ...(intelligence.comparableEvidence?.used?.length ? ['Inspect the comparable evidence.'] : []),
    'Confirm all user-provided assumptions.',
  ].filter((item, index, items) => item && items.indexOf(item) === index));
  return {
    propertySummary: section(property, 'USER_PROVIDED'),
    executiveSummary: section(executive, 'CALCULATED'),
    investmentProfile: section(intelligence.investmentFit || null, 'CALCULATED'),
    propertyEvidence: section(intelligence.propertyEvidence || null, 'VERIFIED_RECORD'),
    comparableEvidence: section(comparableEvidence(intelligence.comparableEvidence), 'VERIFIED_RECORD'),
    valuationEvidence: section(valuation, valuation?.status === 'NOT_APPLICABLE'
      ? 'NOT_APPLICABLE' : valuation?.status === 'ARV_UNAVAILABLE' ? 'UNKNOWN' : 'CALCULATED'),
    riskAssessment: section(intelligence.riskAnalysis || null, 'CALCULATED'),
    limitations: section(intelligence.limitations || null, 'CALCULATED'),
    verificationChecklist: section(checklist, 'CALCULATED'),
    provenance: section(intelligence.provenance || null, 'CALCULATED'),
  };
}

export function buildMaxxisReportSchema({ reportType, property = null, maxxisAnalysis = null, dealIntelligence = null, dealMetrics = null, structuredAnalysis = null, resolvedUserLocale = null } = {}) {
  const normalizedType = String(reportType || '').trim().toUpperCase();
  const allowed = LEVEL_SECTIONS[normalizedType];
  if (!allowed) return null;
  const populated = levelData(normalizedType, { property, maxxisAnalysis, dealIntelligence });
  const sections = Object.freeze(Object.fromEntries(REPORT_SECTIONS.map((key) => [
    key,
    allowed.has(key) ? (populated[key] || emptySection()) : emptySection(),
  ])));
  return Object.freeze({
    type: 'maxxis_report_schema',
    version: MAXXIS_REPORT_SCHEMA_VERSION,
    reportType: normalizedType,
    resolvedUserLocale: ['en', 'pt', 'es'].includes(String(resolvedUserLocale || structuredAnalysis?.locale || structuredAnalysis?.language))
      ? String(resolvedUserLocale || structuredAnalysis?.locale || structuredAnalysis?.language) : null,
    sections,
    pages: pagesFor(normalizedType),
    structuredAnalysis: isObject(structuredAnalysis) && structuredAnalysis.type === 'maxxis_structured_analysis'
      ? Object.freeze(structuredAnalysis) : null,
    presentation: Object.freeze({
      brand: 'DealSifter Match',
      design: 'PREMIUM_INVESTOR_REPORT_V2',
      map: Object.freeze({
        status: finiteCoordinate(property?.latitude) !== null && finiteCoordinate(property?.longitude) !== null ? 'COORDINATES_AVAILABLE' : 'LOCATION_CONTEXT_ONLY',
        latitude: finiteCoordinate(property?.latitude),
        longitude: finiteCoordinate(property?.longitude),
      }),
      kpiScenarios: normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
        ? scenarioKpis(property, sections.valuationEvidence.data) : null,
      existingMetrics: normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE ? existingMetrics(dealMetrics, property) : null,
      comparableStatistics: normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
        ? comparableStatistics(sections.comparableEvidence.data, property) : null,
      evidenceCounts: normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
        ? evidenceCounts(sections.propertyEvidence.data, sections)
        : normalizedType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS
          ? Object.freeze({
            verifiedRecords: Number(maxxisAnalysis?.canonicalInvestmentAnalysis?.evidenceSummary?.verifiedFieldCount) || 0,
            userProvided: Number(maxxisAnalysis?.canonicalInvestmentAnalysis?.evidenceSummary?.userProvidedFieldCount) || 0,
            calculated: sections.investmentProfile.available ? 1 : 0,
            estimated: 0,
            unknown: Number(maxxisAnalysis?.canonicalInvestmentAnalysis?.evidenceSummary?.unknownFieldCount) || 0,
            conflicts: Number(maxxisAnalysis?.canonicalInvestmentAnalysis?.evidenceSummary?.conflictCount) || 0,
          }) : null,
      analysisConfidence: normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
        ? (dealIntelligence?.analysisConfidence || null) : null,
      canonicalInvestmentAnalysis: normalizedType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS
        ? (maxxisAnalysis?.canonicalInvestmentAnalysis || null)
        : normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
          ? (dealIntelligence?.canonicalInvestmentAnalysis || null) : null,
      sellerFinancingScenario: normalizedType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS
        ? (maxxisAnalysis?.sellerFinancingScenario || null)
        : normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
          ? (dealIntelligence?.sellerFinancingScenario || null) : null,
      investorPerspective: normalizedType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS
        ? (maxxisAnalysis?.canonicalInvestmentAnalysis?.focusMap ? Object.freeze({
          persona: maxxisAnalysis.canonicalInvestmentAnalysis.focusMap.strategy,
          priorities: maxxisAnalysis.canonicalInvestmentAnalysis.focusMap.dimensions.map((item) => item.dimension),
          focusMap: maxxisAnalysis.canonicalInvestmentAnalysis.focusMap,
        }) : null)
        : normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE ? (dealIntelligence?.investorPerspective || null) : null,
      executiveSummaryIntelligence: normalizedType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
        ? (dealIntelligence?.executiveSummaryIntelligence || null) : null,
      externalComparableImages: false,
    }),
    exportFoundation: Object.freeze({
      pdf: 'CLIENT_RENDERED',
      email: 'PREPARED_NOT_RENDERED',
      share: 'PREPARED_NOT_RENDERED',
    }),
  });
}

export function buildAuthorizedMaxxisReport(input = {}) {
  const reportType = String(input.reportType || '').trim().toUpperCase();
  const decision = input.accessDecision;
  if (!decision?.allowed || decision.reportType !== reportType) {
    return Object.freeze({ state: 'LOCKED', reportType: reportType || null, report: null });
  }
  const report = buildMaxxisReportSchema(input);
  return Object.freeze({ state: report ? 'AVAILABLE' : 'LOCKED', reportType: reportType || null, report });
}
