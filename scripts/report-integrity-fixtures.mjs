/**
 * Deterministic, synthetic report controls. Never imported by application code.
 * Addresses identify the user-requested regression cases; amounts/evidence below
 * are QA fixtures, not live property records or production valuations.
 */
export const REPORT_FIXTURE_TIME = '2026-10-16T12:00:00.000Z';
export const REPORT_FIXTURE_LANGUAGES = Object.freeze(['pt', 'en', 'es']);

const evidence = (field, value, sourceType = 'VERIFIED_RECORD', source = 'Public GIS') => ({
  field, value, sourceType, source, evidenceId: `fixture:${source}:${field}`,
});
const fact = (value, status = 'USER_PROVIDED', source = 'PROPERTY_APP_VALUE', extra = {}) => ({
  value, status, semanticState: value == null ? 'UNAVAILABLE' : 'KNOWN', source,
  retrievedAt: REPORT_FIXTURE_TIME, effectiveDate: null, confidence: null,
  conflict: null, ...extra,
});
const financialCandidate = (domain, value, options = {}) => ({
  id: `fixture:${domain}`, domain, value, unit: 'USD', cadence: 'ANNUAL',
  evidenceClass: 'USER_PROVIDED_ACTUAL', sourceType: 'USER_PROVIDED',
  sourceId: 'fixture-publisher', sourceFamily: 'PUBLISHER', sourceAuthority: 'PUBLISHER',
  evidenceStatus: 'USER_PROVIDED', freshness: 'FRESH', userConfirmed: true,
  retrievedAt: REPORT_FIXTURE_TIME, ...options,
});
const marketRent = (property) => ({
  provider: 'rentcast', evidenceType: 'rent_estimate', schemaVersion: 1,
  status: 'AVAILABLE', provenance: 'PROVIDER_ESTIMATE', currency: 'USD', cadence: 'MONTHLY',
  rent: 7820, rangeLow: 5230, rangeHigh: 10410, scope: 'PROPERTY',
  retrievedAt: REPORT_FIXTURE_TIME, freshness: 'FRESH',
  queryFingerprint: 'fixture-rent-avm-honolulu-subject-5-bed-2333-sqft',
  subjectProperty: { address: property.address, city: property.city, state: property.state,
    zipCode: property.zip, propertyType: 'Single Family', bedrooms: 5, bathrooms: 3,
    livingAreaSqft: 2333, latitude: property.latitude, longitude: property.longitude },
  comparables: Array.from({ length: 5 }, (_, index) => ({
    listingId: `fixture-rental-${index + 1}`, address: `${7082 + index} Mock Rental St`,
    propertyType: 'Single Family', price: 7700 - index * 150,
    bedrooms: 5, bathrooms: 3, livingAreaSqft: 2300 + index * 25,
    latitude: 21.285 + index * 0.002, longitude: -157.72 + index * 0.002,
    distanceMiles: 1.12 + index * 0.1, daysOld: 30 + index * 7,
    providerCorrelation: 0.958 - index * 0.02,
  })),
});
const soldComparables = () => Array.from({ length: 5 }, (_, index) => ({
  compIdentifier: `fixture-sold-${index + 1}`, address: `${1201 + index} Mock Sold Avenue`,
  salePrice: 310000 + index * 7500, saleDate: `2026-0${9 - index}-15`,
  beds: 3, baths: 2, sqft: 1700 + index * 25, lotSizeSqft: 6500 + index * 100,
  latitude: 34.737 + index * 0.002, longitude: -92.33 + index * 0.002,
  distanceMiles: 0.4 + index * 0.2, similarity: 0.94 - index * 0.02,
  conditionStatus: 'CONFIRMED_RENOVATED', candidateCondition: 'RENOVATED',
  conditionEvidenceSource: 'DOCUMENTED_INSPECTION', transactionQuality: 'ARMS_LENGTH',
  role: 'PRIMARY', sourceType: 'VERIFIED_RECORD', provenance: 'VERIFIED_RECORD',
  inclusionReason: 'CONDITION_AND_STRUCTURAL_COMPATIBILITY_CONFIRMED',
  adjustment: { totalAdjustment: 0, basis: 'CONFIRMED_CONDITION_COMPATIBILITY' },
}));
const emptyDeal = () => ({
  executiveDealOverview: null,
  propertyEvidence: { verifiedRecords: [], userProvided: [], unknown: [], conflicts: [] },
  comparableEvidence: { used: [], supporting: [], excluded: [] },
  valuationIntelligence: { status: 'ARV_UNAVAILABLE', range: null, centralReference: null,
    confidence: 'LOW', compsUsed: 0, methodology: null, providerEstimate: null },
  riskAnalysis: [], limitations: [], nextVerificationSteps: [],
  provenance: { propertyEvidence: 'SYNTHETIC_QA_FIXTURE' },
});
const canonicalPhysical = (property) => ({
  propertyType: fact(property.type), beds: fact(property.beds), baths: fact(property.baths),
  livingAreaSqft: fact(property.sqft), lotSizeSqft: fact(property.lotSizeSqft),
  lotSizeAcres: fact(property.lotSizeAcres), yearBuilt: fact(property.yearBuilt),
});
const baseInput = (property, dealIntelligence = emptyDeal()) => ({
  property, dealIntelligence,
  maxxisAnalysis: {
    executiveSummary: null, keyObservations: { positives: [], attention: [] },
    marketContext: { rentEstimate: dealIntelligence.valuationIntelligence?.rentalEvidence?.rentEstimate },
    profileAlignment: dealIntelligence.investmentFit,
    limitations: dealIntelligence.limitations, nextSteps: dealIntelligence.nextVerificationSteps,
    canonicalInvestmentAnalysis: dealIntelligence.canonicalInvestmentAnalysis,
    financialEvidence: dealIntelligence.financialEvidence,
    financialReadiness: dealIntelligence.financialReadiness,
    provenance: { property: 'SYNTHETIC_QA_FIXTURE' },
  },
});

export function reportIntegrityFixtures({ heroImage = null, galleryImages = null } = {}) {
  const photos = galleryImages || (heroImage ? [heroImage] : []);
  const lowProperty = {
    id: '11111111-1111-4111-8111-111111111111', address: '4724 W 26th St',
    city: 'Little Rock', state: 'AR', zip: '72204', type: 'SFR', objective: 'Sell',
    resolvedAnalysisPropertyType: 'SFR', resolvedAnalysisStrategy: 'GENERIC_SELL',
    price: 90000, beds: 3, baths: 2, sqft: 1760, lot: 5000, lotSizeSqft: 5000,
    rehab: 35000, capRate: 0, latitude: 34.7285, longitude: -92.3311,
    published: true, images: photos,
    propertyUserNotes: 'Synthetic regression control. Property condition requires an inspection.',
    localizedPropertyUserNotes: { translation: 'Registro sintético. A condição do imóvel exige inspeção.' },
    owner: { name: 'QA Publisher', type: 'investor', allowedContacts: [] },
  };
  const lowDeal = emptyDeal();
  lowDeal.valuationIntelligence.providerEstimate = { value: 0, status: 'PROVIDER_ESTIMATE' };
  lowDeal.valuationIntelligence.warnings = ['MISSING_CAPRATE', 'annualPropertyTax', 'propertyTaxYear'];
  lowDeal.propertyEvidence.userProvided = [evidence('askingPrice', 90000, 'USER_PROVIDED', 'Publisher'),
    evidence('bedrooms', 3, 'USER_PROVIDED', 'Publisher'), evidence('bathrooms', 2, 'USER_PROVIDED', 'Publisher')];
  lowDeal.propertyEvidence.unknown = ['annualPropertyTax', 'propertyTaxYear', 'condition', 'latestSalePrice']
    .map((field) => evidence(field, null, 'UNKNOWN', null));
  lowDeal.limitations = ['annualPropertyTax: UNKNOWN', 'propertyTaxYear: UNKNOWN', 'MISSING CAPRATE'];
  lowDeal.investmentFit = { score: 29, calculable: true, semantics: 'PROFILE_FIT_ONLY', criteria: [] };
  lowDeal.analysisConfidence = { score: 91, classification: 'LIMITED', notPropertyScore: true,
    semantics: 'ANALYSIS_COMPLETENESS_AND_RELIABILITY_ONLY', contributors: [], limitations: lowDeal.limitations };
  lowDeal.executiveSummaryIntelligence = { lines: [] };
  const lowInput = baseInput(lowProperty, lowDeal);
  lowInput.structuredAnalysis = { type: 'maxxis_structured_analysis', language: 'pt',
    executiveSummary: { translation: 'Resumo inválido: não deve chegar ao PDF.' },
    positiveSignals: [], concerns: ['MISSING CAPRATE'],
    missingEvidence: ['annualPropertyTax', 'propertyTaxYear'],
    recommendedActions: ['Resolve market evidence', 'Resolve market evidence'] };

  const rentalProperty = {
    id: '22222222-2222-4222-8222-222222222222', address: '7081 Kalanianaole Hwy',
    city: 'Honolulu', state: 'HI', zip: '96825', type: 'SFR', objective: 'Buy and Hold',
    resolvedAnalysisPropertyType: 'SFR', resolvedAnalysisStrategy: 'BUY_AND_HOLD',
    price: 2100000, beds: 5, baths: 3, sqft: 2333, lotSizeSqft: 10000,
    latitude: 21.285, longitude: -157.715, images: photos, published: true,
    annualPropertyTax: 6500, propertyTaxYear: 2025, assessedValue: 1800000,
    assessorId: 'QA-HONOLULU-001', yearBuilt: 1987,
    propertyUserNotes: 'Synthetic rental-evidence control; not an actual property valuation.',
  };
  const rentalDeal = emptyDeal();
  rentalDeal.valuationIntelligence.rentalEvidence = { rentEstimate: marketRent(rentalProperty) };
  rentalDeal.propertyEvidence.verifiedRecords = [evidence('bedrooms', 5), evidence('bathrooms', 3),
    evidence('livingAreaSqft', 2333), evidence('yearBuilt', 1987),
    evidence('annualPropertyTax', 6500, 'VERIFIED_RECORD', 'RentCast'),
    evidence('propertyTaxYear', 2025, 'VERIFIED_RECORD', 'RentCast'),
    evidence('assessorId', 'QA-HONOLULU-001')];
  rentalProperty.canonicalPropertyFacts = { version: 'CANONICAL_PROPERTY_FACTS_V1',
    physical: canonicalPhysical(rentalProperty),
    tax: { annualPropertyTax: fact(6500, 'VERIFIED_RECORD', 'RENTCAST_PROPERTY_RECORD'),
      propertyTaxYear: fact(2025, 'VERIFIED_RECORD', 'RENTCAST_PROPERTY_RECORD') },
    financial: { askingPrice: fact(2100000), capRate: fact(null, 'UNAVAILABLE'), noi: fact(null, 'UNAVAILABLE') },
    conflicts: [],
  };

  const gableProperty = {
    id: '33333333-3333-4333-8333-333333333333', address: '741 Gable Dr',
    city: 'Stuttgart', state: 'AR', zip: '72160', type: 'LAND', objective: 'Sell',
    resolvedAnalysisPropertyType: 'LAND', resolvedAnalysisStrategy: 'LAND', price: 42000,
    lot: '0.3 acres', lotSizeAcres: 0.3, lotSizeSqft: 20000,
    latitude: 34.5, longitude: -91.55, assessorId: 'QA-GABLE-001', zoning: 'R2',
    annualPropertyTax: 600, propertyTaxYear: 2025,
    // Deliberately retained legacy residential zeros: never premium LAND facts.
    beds: 0, baths: 0, sqft: 0, rehab: 0, capRate: 0, images: [], published: true,
    providerPropertyType: 'SFR', propertyTypeConflict: true,
    propertyUserNotes: 'Synthetic parcel conflict control; zoning R2 is publisher-declared, not legal approval.',
    canonicalPropertyFacts: { version: 'CANONICAL_PROPERTY_FACTS_V1',
      physical: { propertyType: fact('LAND'),
        lotSizeAcres: fact(0.3, 'USER_PROVIDED', 'PUBLISHER_DECLARATION'),
        lotSizeSqft: fact(20000, 'VERIFIED_RECORD', 'PUBLIC_GIS') },
      parcel: { zoning: fact('R2', 'USER_PROVIDED', 'PUBLISHER_DECLARATION'),
        assessorId: fact('QA-GABLE-001', 'VERIFIED_RECORD', 'PUBLIC_GIS') },
      tax: { annualPropertyTax: fact(600, 'VERIFIED_RECORD', 'PUBLIC_ASSESSOR'),
        propertyTaxYear: fact(2025, 'VERIFIED_RECORD', 'PUBLIC_ASSESSOR') },
      financial: { askingPrice: fact(42000), rehab: fact(null, 'NOT_APPLICABLE'),
        capRate: fact(null, 'NOT_APPLICABLE') },
      conflicts: [{ field: 'lotSizeSqft', severity: 'MATERIAL', code: 'LOT_DIMENSION_CONFLICT',
        appValue: 13068, providerValue: 20000, resolution: 'UNRESOLVED' }],
    },
  };
  const gableDeal = emptyDeal();
  gableDeal.valuationIntelligence.status = 'NOT_APPLICABLE';
  gableDeal.valuationIntelligence.providerEstimate = { value: 350000, status: 'QUARANTINED_FOR_TYPE_CONFLICT' };
  gableDeal.propertyEvidence.verifiedRecords = [evidence('lotSizeSqft', 20000),
    evidence('assessorId', 'QA-GABLE-001'), evidence('annualPropertyTax', 600)];
  gableDeal.propertyEvidence.userProvided = [evidence('zoning', 'R2', 'USER_PROVIDED', 'Publisher'),
    evidence('lotSizeAcres', 0.3, 'USER_PROVIDED', 'Publisher')];
  gableDeal.propertyEvidence.conflicts = [{ field: 'lotSizeSqft', severity: 'MATERIAL' }];

  const arvProperty = {
    id: '44444444-4444-4444-8444-444444444444', address: '1200 Mock Sold Avenue',
    city: 'Little Rock', state: 'AR', zip: '72204', type: 'SFR', objective: 'Flip',
    resolvedAnalysisPropertyType: 'SFR', resolvedAnalysisStrategy: 'FLIP',
    price: 200000, rehab: 45000, beds: 3, baths: 2, sqft: 1760,
    lotSizeSqft: 7000, latitude: 34.735, longitude: -92.328, images: photos,
    yearBuilt: 1980, published: true,
    propertyUserNotes: 'Synthetic documented-renovation and recorded-sale control.',
    fieldProvenance: { rehab: 'USER_PROVIDED', askingPrice: 'USER_PROVIDED' },
  };
  const arvDeal = emptyDeal();
  arvDeal.comparableEvidence.used = soldComparables();
  arvDeal.valuationIntelligence = { status: 'ARV_AVAILABLE', range: { low: 310000, high: 340000 },
    centralReference: 325000, confidence: 'HIGH', compsUsed: 5,
    methodology: 'DETERMINISTIC_CONDITION_ADJUSTED_ARV_V1',
    warnings: ['RECORDED_SALES_NOT_APPRAISAL'],
    adjustmentContext: { conditionCompatibility: 'CONFIRMED', adjustedCompCount: 5 },
  };
  arvDeal.propertyEvidence.verifiedRecords = [evidence('bedrooms', 3), evidence('bathrooms', 2),
    evidence('livingAreaSqft', 1760), evidence('yearBuilt', 1980), evidence('lotSizeSqft', 7000)];
  arvDeal.propertyEvidence.userProvided = [evidence('rehab', 45000, 'USER_PROVIDED', 'Publisher')];

  const buyProperty = {
    id: '55555555-5555-4555-8555-555555555555', address: '250 Mock Rental Lane',
    city: 'Little Rock', state: 'AR', zip: '72205', type: 'SFR', objective: 'Buy and Hold',
    resolvedAnalysisPropertyType: 'SFR', resolvedAnalysisStrategy: 'BUY_AND_HOLD',
    price: 220000, beds: 3, baths: 2, sqft: 1500, lotSizeSqft: 6000,
    latitude: 34.75, longitude: -92.35, images: photos, annualPropertyTax: 2400,
    propertyTaxYear: 2025, hoaFee: 0, capRate: 0, published: true,
    propertyUserNotes: 'Synthetic lease-income control. Insurance and maintenance remain unconfirmed.',
  };
  const buyDeal = emptyDeal();
  const buyRent = marketRent(buyProperty);
  buyRent.rent = 2100; buyRent.rangeLow = 1900; buyRent.rangeHigh = 2300;
  buyRent.subjectProperty = { ...buyRent.subjectProperty, bedrooms: 3, bathrooms: 2,
    livingAreaSqft: 1500, latitude: 34.75, longitude: -92.35 };
  buyRent.comparables = buyRent.comparables.map((row, index) => ({ ...row,
    address: `${251 + index} Mock Lease Lane`, price: 2050 + index * 25,
    bedrooms: 3, livingAreaSqft: 1480 + index * 10,
    latitude: 34.75 + index * 0.002, longitude: -92.355 + index * 0.002 }));
  buyDeal.valuationIntelligence.rentalEvidence = { rentEstimate: buyRent };
  buyDeal.propertyEvidence.verifiedRecords = [evidence('annualPropertyTax', 2400, 'VERIFIED_RECORD', 'RentCast'),
    evidence('propertyTaxYear', 2025, 'VERIFIED_RECORD', 'RentCast')];
  buyProperty.canonicalPropertyFacts = { version: 'CANONICAL_PROPERTY_FACTS_V1',
    physical: { ...canonicalPhysical(buyProperty),
      hoaFee: fact(0, 'USER_PROVIDED', 'PUBLISHER_DECLARATION', { provenance: { explicit: true, confirmed: true } }) },
    tax: { annualPropertyTax: fact(2400, 'VERIFIED_RECORD', 'RENTCAST_PROPERTY_RECORD'),
      propertyTaxYear: fact(2025, 'VERIFIED_RECORD', 'RENTCAST_PROPERTY_RECORD') },
    financial: { askingPrice: fact(220000), capRate: fact(null, 'UNAVAILABLE'), noi: fact(null, 'UNAVAILABLE') },
    conflicts: [],
  };
  const buyCandidates = [
    financialCandidate('currentContractRent', 1950, { cadence: 'MONTHLY' }),
    financialCandidate('providerMarketRentEstimate', 2100, { cadence: 'MONTHLY', evidenceClass: 'PROVIDER_ESTIMATE',
      sourceType: 'PROVIDER_ESTIMATE', sourceId: 'fixture-rentcast-avm', sourceFamily: 'RENTCAST',
      sourceAuthority: 'RENTCAST', evidenceStatus: 'ESTIMATED' }),
    financialCandidate('propertyTax', 2400, { evidenceClass: 'PUBLIC_RECORD', sourceType: 'PROPERTY_RECORD',
      sourceId: 'fixture-rentcast-tax', sourceFamily: 'RENTCAST', sourceAuthority: 'RENTCAST',
      evidenceStatus: 'VERIFIED_RECORD', periodYear: 2025, metadata: { concept: 'ANNUAL_RECORDED_TAX' } }),
    financialCandidate('hoa', 0, { cadence: 'MONTHLY' }),
    financialCandidate('vacancy', 5, { unit: 'PERCENT', cadence: 'ANNUAL', evidenceClass: 'INVESTOR_ASSUMPTION',
      metadata: { percentageBasis: 'SCHEDULED_RENT' } }),
  ];

  const parityProperty = { ...lowProperty, yearBuilt: 1950, annualPropertyTax: 1166, propertyTaxYear: 2025,
    assessedValue: 16651, assessmentYear: 2025, assessorId: 'QA-APN-066', county: 'Pulaski', subdivision: 'QA SUBDIVISION',
    legalDescription: 'LOT 7R, BEING A REPLAT OF LOTS 7 AND 8', ownerOccupied: false, ownershipRecordPresent: true,
    latestSalePrice: 30000, latestSaleDate: '2022-06-01', lotSizeSqft: 7013, lotSizeAcres: .161,
    owner: { name: 'QA Publisher', allowedContacts: [{ type: 'phone', value: '+15550123456' }] },
    canonicalPropertyFacts: { physical: { baths: fact(1, 'CONFLICTED', 'RENTCAST_PROPERTY_RECORD', { semanticState: 'CONFLICTED', conflict: true }),
      livingAreaSqft: fact(806, 'CONFLICTED', 'RENTCAST_PROPERTY_RECORD', { semanticState: 'CONFLICTED', conflict: true }),
      lotSizeSqft: fact(7013, 'CONFLICTED', 'PUBLIC_GIS', { semanticState: 'CONFLICTED', conflict: true }),
      lotSizeAcres: fact(.161, 'CONFLICTED', 'PUBLIC_GIS', { semanticState: 'CONFLICTED', conflict: true }) }, conflicts: [] } };
  const parityDeal = emptyDeal();
  parityDeal.comparableEvidence.used = soldComparables();
  parityDeal.comparableEvidence.supporting = soldComparables().slice(0, 3).map((row, i) => ({ ...row, compIdentifier: `support-${i}`, address: `${1300 + i} Complementary Sold St`, role: 'SUPPORTING', similarity: 65 - i }));
  parityDeal.valuationIntelligence.providerListingReferences = Array.from({ length: 8 }, (_, i) => ({ address: `${2100 + i} Mock For Sale St`, price: 110000 + i * 1000,
    priceSemantic: 'PROVIDER_LISTING_PRICE', providerCorrelation: .80 + i * .01, latitude: 34.731 + i * .002, longitude: -92.33 + i * .001, lastSeenDate: '2026-10-17', distanceMiles: .3 + i * .1 }));
  parityDeal.marketRent = { state: 'RENT_AVM_REVIEW_REQUIRED', reviewField: 'baths' };
  const parityInput = baseInput(parityProperty, parityDeal); parityInput.maxxisAnalysis.marketRent = parityDeal.marketRent;
  return [
    { id: 'PROPERTY_PARITY', slug: 'property-parity', input: parityInput,
      localizedRegressionNotes: { pt: 'Controle sintético de dados completos e divergências.', en: 'Synthetic complete-property and discrepancy control.', es: 'Control sintético de datos completos y discrepancias.' },
      expected: { address: parityProperty.address, strategy: 'GENERIC_SELL', noZero: true, noArvModule: true } },
    { id: 'LOW_EVIDENCE_SELL', slug: 'low-evidence-sell', input: lowInput,
      localizedRegressionNotes: {
        pt: 'Registro sintético. A condição do imóvel exige inspeção.',
        en: 'Synthetic control. Property condition requires an inspection.',
        es: 'Registro sintético. La condición del inmueble requiere una inspección.',
      },
      expected: { address: lowProperty.address, strategy: 'GENERIC_SELL', maxPages: 5,
        noZero: true, noRental: true, noArvModule: true, evidenceLimited: true } },
    { id: 'RENTAL_MARKET_RICH', slug: 'rental-market-rich', input: baseInput(rentalProperty, rentalDeal),
      expected: { address: rentalProperty.address, strategy: 'BUY_AND_HOLD', rental: true,
        rentalRent: 7820, rentalLow: 5230, rentalHigh: 10410,
        rentalAddresses: rentalDeal.valuationIntelligence.rentalEvidence.rentEstimate.comparables.map((row) => row.address),
        rentalMarkers: 5, noFalseCapRate: true } },
    { id: 'LAND_CONFLICT', slug: 'land-conflict', input: baseInput(gableProperty, gableDeal),
      expected: { address: gableProperty.address, strategy: 'LAND', noRental: true,
        noResidentialFacts: true, conflict: true, noArvModule: true, zoning: 'R2' } },
    { id: 'ARV_RICH', slug: 'arv-rich', input: baseInput(arvProperty, arvDeal),
      expected: { address: arvProperty.address, strategy: 'FLIP', arv: true,
        arvLow: 310000, arvHigh: 340000, soldMarkers: 5,
        soldAddresses: arvDeal.comparableEvidence.used.map((row) => row.address), noRental: true } },
    { id: 'BUY_HOLD', slug: 'buy-hold', input: baseInput(buyProperty, buyDeal),
      financialCandidates: buyCandidates,
      expected: { address: buyProperty.address, strategy: 'BUY_AND_HOLD', rental: true,
        rentalRent: 2100, rentalLow: 1900, rentalHigh: 2300, currentRent: 1950,
        rentalAddresses: buyRent.comparables.map((row) => row.address), rentalMarkers: 5,
        explicitZeroDomains: ['hoa'], noFalseCapRate: true } },
    { id: 'MINIMAL', slug: 'minimal', input: baseInput({
      id: '66666666-6666-4666-8666-666666666666', address: 'Undocumented QA parcel',
      city: 'Example City', state: 'AR', type: 'SFR', objective: 'Sell',
      price: null, beds: null, baths: null, sqft: null, rehab: 0, capRate: 0, images: [],
    }), expected: { address: 'Undocumented QA parcel', strategy: 'GENERIC_SELL',
      maxPages: 5, noZero: true, noRental: true, noArvModule: true, evidenceLimited: true } },
  ];
}

/** Separate stress control: do not inflate the six commercial goldens with prose. */
export function reportIntegrityLongNotesFixture(language = 'pt') {
  const base = reportIntegrityFixtures().find(fixture => fixture.id === 'MINIMAL');
  const notes = {
    pt: 'Registro de diligência do publicador. Documente a condição observada, preserve as referências e confirme a situação junto à fonte responsável antes de tomar uma decisão. Esta nota não constitui avaliação nem confirmação oficial.',
    en: 'Publisher diligence note. Document the observed condition, preserve source references and confirm the situation with the responsible source before making a decision. This note is not an appraisal or official confirmation.',
    es: 'Nota de diligencia del publicador. Documente la condición observada, conserve las referencias y confirme la situación con la fuente responsable antes de decidir. Esta nota no es tasación ni confirmación oficial.',
  };
  const text = Array.from({ length: 32 }, (_, index) => `${index + 1}. ${notes[language]}`).join('\n');
  return { ...base, id: 'STRUCTURED_NOTES_CONTINUATION', slug: 'structured-notes-continuation',
    input: { ...base.input, property: { ...base.input.property,
      address: 'Structured notes QA control', price: 125000, propertyUserNotes: text } },
    expected: { ...base.expected, address: 'Structured notes QA control', maxPages: 12, structuredNotes: true } };
}
