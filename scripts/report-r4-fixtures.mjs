// Entirely fictional, offline controls. Never imported by the application.
export const R4_TIME = '2026-10-30T12:00:00.000Z';
const property = {
  id: 'r4-fictional-subject', title: 'Example residence', address: '1200 Example Avenue', city: 'Example City', state: 'FL', zip: '00000',
  type: 'SFR', objective: 'Subject To', price: 280000, beds: 3, baths: 2, sqft: 1600, latitude: 28, longitude: -82,
  owner: { name: 'Fictional Publisher', allowedContacts: [{ type: 'email', value: 'publisher@example.invalid' }] },
};
const emptyDeal = { provenance: { property: 'FICTIONAL_QA' }, propertyEvidence: { verifiedRecords: [], userProvided: [], conflicts: [] }, comparableEvidence: { used: [], supporting: [] },
  valuationIntelligence: { status: 'ARV_UNAVAILABLE', confidence: 'LOW', range: null },
  evidenceReasons: { propertyRecord: 'NO_COVERAGE', valuation: 'NO_COVERAGE', recordedSales: 'NO_COVERAGE' } };
const comp = index => ({ compIdentifier: `r4-sale-${index}`, address: `${1300 + index} Fictional Avenue`, salePrice: 340000 + index * 5000,
  saleDate: '2026-09-20', sqft: 1600, latitude: 28 + .002 * index, longitude: -82 + .003 * index, role: 'PRIMARY',
  source: 'RentCast', retrievedAt: R4_TIME, distanceMiles: .3 + index * .1, similarity: 95 - index });
const criteria = ['market', 'price', 'property_type', 'strategy'].map((key, index) => ({ key, score: index === 1 ? 0 : 95,
  explanation: index === 1 ? 'Outside the selected price band.' : 'Compatible with this profile.' }));
const profile = { score: 71, criteria, profileSource: 'AUTHENTICATED_CURRENT_PROFILE', sourceProfile: { targetMarkets: ['FL'], priceRange: '100_200k', propertyTypes: ['SFR'], strategies: ['Subject To'] } };
const assumption = (value, cadence = 'ANNUAL') => ({ value, unit: 'USD', cadence, analyticalUsability: 'ACTUAL_SINGLE_SOURCE',
  sourceClass: 'USER_PROVIDED_ACTUAL', source: { sourceType: 'USER_PROVIDED', userConfirmed: true } });
export function r4Fixtures(photos = []) {
  const rent = { provider: 'rentcast', evidenceType: 'rent_estimate', status: 'AVAILABLE', rent: 2400, rangeLow: 2200, rangeHigh: 2600,
    currency: 'USD', cadence: 'MONTHLY', retrievedAt: R4_TIME, comparables: [], subjectProperty: { bedrooms: 3, bathrooms: 2, livingAreaSqft: 1600 } };
  const richProperty = { ...property, images: photos, objective: 'Buy and Hold', lotSizeSqft: 7000, lot: 7000, county: 'Example County',
    yearBuilt: 2005, zoning: 'RS', assessorId: 'FICTIONAL-001', annualPropertyTax: 3200, propertyTaxYear: 2026,
    description: 'Fictional residence with a renovated kitchen and documented operating inputs. Verify all assumptions before making a decision.',
    fieldProvenance: { annualPropertyTax: { source: 'RentCast', retrievedAt: R4_TIME, status: 'VERIFIED_RECORD' } } };
  const financialEvidence = { inputs: { currentContractRent: assumption(2400, 'MONTHLY'), propertyTax: assumption(3200), insurance: assumption(1800),
    hoa: assumption(0, 'MONTHLY'), maintenance: assumption(1200), utilities: assumption(300), otherOperatingExpenses: assumption(200),
    vacancy: { ...assumption(5), unit: 'PERCENT' }, propertyManagement: { ...assumption(8), unit: 'PERCENT' } } };
  const readiness = { readinessLevel: 'READY_ACTUAL', missingCritical: [], conflictedInputs: [], metrics: { NOI: { readinessLevel: 'READY_ACTUAL' } } };
  const richDeal = { ...emptyDeal, evidenceReasons: { propertyRecord: null, valuation: null, recordedSales: null }, executiveDealOverview: 'The documented operating basis and eligible sales support comparison of the stated investment scenario.',
    investmentFit: profile, marketRent: { state: 'AVAILABLE', evidence: rent }, financialEvidence, financialReadiness: readiness,
    propertyEvidence: { verifiedRecords: [{ field: 'annualPropertyTax', value: 3200, source: 'RentCast', retrievedAt: R4_TIME }], userProvided: [], conflicts: [] },
    comparableEvidence: { used: [1, 2, 3].map(comp), supporting: [] },
    valuationIntelligence: { status: 'ARV_AVAILABLE', confidence: 'MODERATE', range: { low: 340000, high: 360000 }, centralReference: 350000,
      compsUsed: 3, retrievedAt: R4_TIME, source: 'RentCast' },
    riskAnalysis: [{ category: 'EXECUTION', explanation: 'Obtain a current inspection and written contractor bids.' }],
    nextVerificationSteps: ['Review the lease and operating statements.', 'Confirm title and recorded transaction evidence.'] };
  const analysis = deal => ({ executiveSummary: deal.executiveDealOverview || 'This partial analysis uses the submitted property information. No external evidence was obtained.', profileAlignment: deal.investmentFit,
    marketRent: deal.marketRent, financialEvidence: deal.financialEvidence, financialReadiness: deal.financialReadiness,
    riskAwareness: deal.riskAnalysis, nextSteps: deal.nextVerificationSteps, evidenceReasons: deal.evidenceReasons, provenance: { property: 'FICTIONAL_QA' } });
  const partialDeal = { ...richDeal, comparableEvidence: { used: [1, 2].map(comp), supporting: [] },
    valuationIntelligence: { ...richDeal.valuationIntelligence, status: 'ARV_LIMITED', confidence: 'LOW', compsUsed: 2 },
    financialReadiness: { readinessLevel: 'INCOMPLETE', missingCritical: ['insurance'], metrics: { NOI: { readinessLevel: 'INCOMPLETE' } } } };
  return [
    { id: 'rich', input: { property: richProperty, dealIntelligence: richDeal, maxxisAnalysis: analysis(richDeal) } },
    { id: 'partial', input: { property: { ...richProperty, images: photos.slice(0, 1) }, dealIntelligence: partialDeal, maxxisAnalysis: analysis(partialDeal) } },
    { id: 'sparse', input: { property: { ...property, images: photos.slice(0, 1) }, dealIntelligence: emptyDeal, maxxisAnalysis: analysis(emptyDeal) } },
  ];
}
