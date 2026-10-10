import { describe, expect, it } from 'vitest';
import { calculateLandDevelopmentScenario, constructionBenchmark2026, formatLandDevelopmentAnswer, parseLandDevelopmentAssumptions, LAND_DEVELOPMENT_COST_FIELDS } from './landDevelopmentScenario.ts';
import { resolveDealScenario } from './scenarioEngine.ts';
import { mapRentCastSoldRecordPool } from '../property-data/soldMapper.ts';
import { mapRentCastValueEstimate } from '../property-data/valuationMapper.ts';
import { selectDevelopmentComparables } from '../property-data/soldCompEngine.ts';
import { DEFAULT_SOLD_SEARCH_POLICY } from '../property-data/soldProvider.ts';
import { classifyAnalysisApplicability } from './analysisApplicability.ts';

const now = '2026-10-09T12:00:00Z';
const input = { purchasePrice: 19000, state: 'AL', lotSizeAcres: 1.14, developmentIntent: 'SUBDIVIDE_AND_BUILD', proposedUnitCount: 2, proposedBuildingSqftPerUnit: 1500, proposedPropertyType: 'SFR' };
const valuation = mapRentCastValueEstimate({ lookup: { street: '741 Gable Dr', city: 'Center Point', state: 'AL', zipCode: '35215' }, retrievedAt: now,
  requestPolicy: { maxRadius: 5, daysOld: 365, compCount: 0, lookupSubjectAttributes: false }, raw: { subjectProperty: { id: 'subject',
    addressLine1: '741 Gable Dr', city: 'Center Point', state: 'AL', zipCode: '35215', propertyType: 'Land', latitude: 33.65, longitude: -86.68, lotSize: 49658.4 }, comparables: [] } });
const record = (id: string, type = 'Single Family', area = 1500, age = 30, price = 300000) => ({ id, formattedAddress: `${id} Example St`, propertyType: type,
  latitude: 33.651, longitude: -86.681, squareFootage: area, lotSize: type === 'Land' ? 49658.4 : 24829.2,
  bedrooms: 3, bathrooms: 2, yearBuilt: 2025, lastSaleDate: new Date(Date.parse(now) - age * 86400000).toISOString(), lastSalePrice: price });
const evidence = (records: ReturnType<typeof record>[]) => ({ valuation, records: mapRentCastSoldRecordPool({ records,
  policy: { ...DEFAULT_SOLD_SEARCH_POLICY, saleDateRangeDays: 365 }, queryFingerprint: 'a'.repeat(64), retrievedAt: now }).records });

describe('Land development v2 deterministic contract (synthetic Gable control)', () => {
  it('uses proposed 3000 sqft, not lot area, for the Alabama hard cost', () => {
    const result = calculateLandDevelopmentScenario(input);
    expect(result.totalBuildingSqft).toBe(3000);
    expect(result.hardCost).toEqual({ low: 357000, central: 436500, high: 516000 });
    expect(result.knownDevelopmentBasis).toEqual({ low: 376000, central: 455500, high: 535000 });
    expect(result.estimatedProjectProfit).toBeNull();
  });
  it('has no residential rehab/ARV applicability even when construction is planned', () => {
    expect(classifyAnalysisApplicability({ type: 'Land' }, { targetCondition: 'NEW_CONSTRUCTION' })).toMatchObject({ rehab: 'NOT_APPLICABLE', residentialArv: 'NOT_APPLICABLE' });
    expect(calculateLandDevelopmentScenario(input)).toMatchObject({ rehab: 'NOT_APPLICABLE', existingHouseArv: 'NOT_APPLICABLE', residentialCapRate: 'NOT_APPLICABLE' });
  });
  it('labels national fallback and original benchmark provenance honestly', () => {
    expect(constructionBenchmark2026('invalid')).toMatchObject({ geography: 'NATIONAL', rate: { low: 138, average: 185.4, high: 328 }, sourceCitationStatus: 'ORIGINAL_EXTERNAL_PROVENANCE_NOT_RETAINED', confidence: 'LOW' });
  });
  it.each(['AL', 'Alabama'])('normalizes benchmark state %s', state => {
    expect(constructionBenchmark2026(state).rate).toEqual({ low: 119, average: 145.5, high: 172 });
  });
  it('contractor bid overrides rate and benchmark', () => {
    expect(calculateLandDevelopmentScenario({ ...input, contractorBid: 400000, constructionCostPerSqft: 180 }).hardCost).toEqual({ low: 400000, central: 400000, high: 400000 });
  });
  it('explicit construction rate survives size changes', () => {
    expect(calculateLandDevelopmentScenario({ ...input, proposedBuildingSqftPerUnit: 2000, constructionCostPerSqft: 180 }).hardCost?.central).toBe(720000);
  });
  it.each([null, undefined, ''])('unknown cost %s is not zero', value => {
    const result = calculateLandDevelopmentScenario({ ...input, utilityCost: value });
    expect(result.costCoverage.find(row => row.field === 'utilityCost')).toMatchObject({ value: null, status: 'UNKNOWN' });
    expect(result.estimatedProjectProfit).toBeNull();
  });
  it('allows an explicit zero cost without claiming a complete budget', () => {
    expect(calculateLandDevelopmentScenario({ ...input, utilityCost: 0 }).costCoverage.find(row => row.field === 'utilityCost')).toMatchObject({ value: 0, status: 'USER_ASSUMED' });
  });
  it('keeps legal approval unverified despite a user flag', () => {
    expect(calculateLandDevelopmentScenario({ ...input, zoningSubdivisionVerified: true }).zoningSubdivisionGate.status).toBe('USER_PROVIDED_NOT_LEGALLY_VERIFIED');
  });
  it.each(['pt', 'en', 'es'])('formats complete narrative in %s without raw enums', lang => {
    const text = formatLandDevelopmentAnswer(calculateLandDevelopmentScenario(input), lang);
    expect(text).not.toContain('INTERNAL_REFERENCE_BENCHMARK'); expect(text).not.toContain('closingCosts');
    expect(text.length).toBeGreaterThan(600);
  });
  it.each(['1.500 sqft cada', '1500 sqft each', '1,500 sqft cada'])('parses area %s', text => {
    expect(parseLandDevelopmentAssumptions(text).proposedBuildingSqftPerUnit).toBe(1500);
  });
  it('does not turn subdivision-only lot count into a housing count', () => {
    expect(parseLandDevelopmentAssumptions('subdividir em 2 lotes')).toEqual({ proposedLotCount: 2, developmentIntent: 'SUBDIVIDE' });
  });
  it('progresses from two houses to a size without losing assumptions', () => {
    const first = resolveDealScenario({ message: 'subdividir em dois lotes e construir duas casas', canonicalStrategy: 'LAND', canonicalFacts: { ...input, proposedBuildingSqftPerUnit: null } });
    const next = resolveDealScenario({ message: '1500 sqft cada', canonicalStrategy: 'LAND', canonicalFacts: input, storedAssumptions: first.scenario?.assumptions });
    expect(next.scenario?.calculatedOutputs.hardCost).toEqual({ low: 357000, central: 436500, high: 516000 });
    expect(next.providerCalls).toBe(0);
  });
  it('selects land and exit families independently from mixed pools without duplicate records', () => {
    const data = evidence([record('home1'), record('home2', 'Single Family', 1550, 40, 310000), record('land1', 'Land', 0, 20, 20000), record('land2', 'Land', 0, 40, 24000), record('home1')]);
    const refs = selectDevelopmentComparables(valuation, data.records, { ...input, lotSizeSqft: 49658.4 }, now);
    expect(refs.landAcquisition.valuationCompCount).toBe(2); expect(refs.finishedHomeExit.valuationCompCount).toBe(2);
    expect(refs.landAcquisition.unitMetric).toBe('PRICE_PER_ACRE'); expect(refs.finishedHomeExit.unitMetric).toBe('PRICE_PER_SQFT');
    const result = calculateLandDevelopmentScenario(input, data, now);
    expect(result.aggregateProjectedExit?.central).toBe(600000);
    expect(result.preliminaryGrossSpread?.central).toBe(144500);
    expect(result.estimatedProjectProfit).toBeNull();
  });
  it('requires two qualifying closed sales and labels controlled 365-day expansion', () => {
    expect(calculateLandDevelopmentScenario(input, evidence([record('one')]), now).projectedExitPerUnit).toBeNull();
    const result = calculateLandDevelopmentScenario(input, evidence([record('one'), record('old', 'Single Family', 1500, 250)]), now);
    expect(result.finishedHomeExitReference?.confidenceReasons).toContain('CONTROLLED_365_DAY_EXPANSION');
    expect(result.finishedHomeExitReference?.confidence).toBe('LOW');
  });
  it('rescores cached home candidates after size mutation without provider calls', () => {
    const data = evidence([record('one'), record('two')]);
    expect(calculateLandDevelopmentScenario(input, data, now).projectedExitPerUnit).not.toBeNull();
    expect(calculateLandDevelopmentScenario({ ...input, proposedBuildingSqftPerUnit: 4000 }, data, now).projectedExitPerUnit).toBeNull();
  });
  it('does not aggregate unequal products or calculate profit with incomplete costs', () => {
    const result = calculateLandDevelopmentScenario({ ...input, unitsEquivalent: false }, evidence([record('one'), record('two')]), now);
    expect(result.aggregateProjectedExit).toBeNull(); expect(result.ROI).toBeNull();
  });
  it('calculates scenario profit only after every cost category is explicitly supplied', () => {
    const complete = { ...input, ...Object.fromEntries(LAND_DEVELOPMENT_COST_FIELDS.map(key => [key, 0])) };
    expect(calculateLandDevelopmentScenario(complete, evidence([record('one'), record('two')]), now).estimatedProjectProfit?.central).toBe(144500);
  });
});
