import { describe, expect, it, vi } from 'vitest';
import { evidenceAbsenceCopy, evidenceAbsenceReason, EVIDENCE_ABSENCE_REASONS } from './evidenceAbsence.ts';
import { getCanonicalPropertyEvidenceWithDependencies } from './canonicalEvidenceTool.ts';
import { assertAddressCoherence } from '../property-data/addressCoherence.ts';
import { FLORIDA_POSTAL_CITIES } from '../property-data/floridaPostalCities.ts';
import { createProviderExecution, trackedProviderFetch } from '../property-data/providerExecution.ts';
import { createPropertyDataProvider, readPropertyDataConfig, RentCastPropertyDataProvider } from '../property-data/providers.ts';
import { RentCastValuationDataProvider } from '../property-data/valuationProvider.ts';
import { RentCastSoldRecordDataProvider } from '../property-data/soldProvider.ts';
import { createSupplementalEvidenceProvider, RentCastSupplementalEvidenceProvider } from '../property-data/supplementalEvidenceProvider.ts';
import { MarketRentService } from '../property-data/marketRentService.ts';
import { createRentCastClient } from '../property-data/rentcast/rentcastClient.ts';
import { resolveRentAvmSubjectAttributes } from '../property-data/rentAvmSubject.ts';
import { InMemorySupplementalEvidenceCache } from '../property-data/supplementalEvidenceCache.ts';
import { InMemoryPropertyDataUsageGuard } from '../property-data/usageGuard.ts';
import { PropertyDataError } from '../property-data/types.ts';
import { buildMaxxisReportSchema } from '../../../../src/domain/maxxis/maxxisReportSchema.js';
import { buildStrictReportViewModel, validateReportViewModel } from '../../../../src/features/maxxis/export/reportIntegrityViewModel.ts';
import { marketRentStateAnswer } from './financialEvidenceAnswer.ts';
import { projectSoldDelivery, soldDeliveryAnswer } from './reportMarketReferences.ts';

const id = '11111111-1111-4111-8111-111111111111';
const property = { id, address: '100 Example St', city: 'Miami', state: 'FL', zip: '33101', type: 'SFR', beds: 3, baths: 2, sqft: 1500, price: 250000 };
const lookup = { street: property.address, city: property.city, state: property.state, zipCode: property.zip, propertyId: id, userId: 'offline' };
const subject = resolveRentAvmSubjectAttributes({ property });

describe('R-1 single absence vocabulary and user copy', () => {
  it.each([
    ['ENTITLEMENT_BLOCKED', 'NOT_ENTITLED'], ['PLAN_PROVIDER_BUDGET_EXHAUSTED', 'QUOTA_BLOCKED'],
    ['MONTHLY_PROVIDER_LIMIT_REACHED', 'QUOTA_BLOCKED'], ['PROVIDER_DISABLED', 'PLAN_GATE'],
    ['PROVIDER_NOT_CONFIGURED', 'PLAN_GATE'], ['ADDRESS_MISMATCH', 'IDENTITY_MISMATCH'],
    ['ADDRESS_CONFIRMATION_REQUIRED', 'USER_INPUT_REQUIRED'], ['PROPERTY_NOT_FOUND', 'NO_COVERAGE'],
    ['RENT_ENTITLEMENT_CHECK_FAILED', 'PROVIDER_ERROR'], ['NOT_QUERIED', 'NOT_REQUESTED'],
  ])('%s has one truthful bounded reason', (input, expected) => expect(evidenceAbsenceReason(input)).toBe(expected));
  it.each(['pt', 'en', 'es'])('renders every absence reason without internal jargon in %s', language => {
    for (const reason of EVIDENCE_ABSENCE_REASONS) {
      const copy = evidenceAbsenceCopy(reason, language);
      expect(copy.length).toBeGreaterThan(40);
      expect(copy).not.toMatch(/SOLD|AVM|gates?|not requested in this flow|[A-Z]{3,}_[A-Z_]+/);
    }
  });
  it.each(EVIDENCE_ABSENCE_REASONS)('keeps %s through schema and the report view model', reason => {
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property,
      dealIntelligence: { evidenceReasons: { propertyRecord: reason, valuation: reason, recordedSales: reason },
        propertyEvidence: {}, valuationIntelligence: { status: 'ARV_UNAVAILABLE' }, comparableEvidence: {} } });
    const vm = buildStrictReportViewModel({ schema, language: 'pt' });
    expect(vm.indicatorReasons?.propertyRecord).toBe(reason);
    for (const indicator of ['arv','marketRent','roi','noi','capRate','landInformation','comparablesMap']) {
      expect(Object.hasOwn(vm.indicatorReasons!,indicator)).toBe(true);
    }
    expect(vm.values.assessorId.absenceReason).toBe(reason);
    expect(vm.sections.find(section => section.id === 'evidence-availability')?.items?.[0].text).toContain(evidenceAbsenceCopy(reason, 'pt'));
    for (const value of Object.values(vm.values)) if (['UNAVAILABLE', 'NOT_APPLICABLE', 'CONFLICTED'].includes(value.state)) expect(value.absenceReason).toBeTruthy();
    expect(validateReportViewModel(vm).valid).toBe(true);
  });
  it('never calls a blocked recorded-sales query not requested', () => {
    const receipt = projectSoldDelivery({ soldEvidence: 'UNAVAILABLE', soldEvidenceReason: 'MONTHLY_PROVIDER_LIMIT_REACHED', soldProviderAttempted: false });
    expect(receipt.absenceReason).toBe('QUOTA_BLOCKED');
    expect(soldDeliveryAnswer(receipt, 'en')).toContain('allowance');
    expect(soldDeliveryAnswer(receipt, 'en')).not.toMatch(/SOLD|AVM|not requested/);
  });
});

describe('R-1 offline locality gate before any quota reservation', () => {
  it('ships a statewide snapshot instead of a few hard-coded examples', () => expect(Object.keys(FLORIDA_POSTAL_CITIES).length).toBeGreaterThan(1400));
  it.each([
    { city: 'Miami', state: 'FL', zipCode: '33101' },
    { city: 'Orlando', state: 'FL', zipCode: '32801' },
    { city: 'Winter Haven', state: 'FL', zipCode: '33880' },
    { city: 'St. Petersburg', state: 'FL', zipCode: '33701' },
  ])('accepts coherent Florida locality $zipCode', input => expect(() => assertAddressCoherence({ ...lookup, ...input })).not.toThrow());
  it.each([
    { city: 'Winter Haven', state: 'FL', zipCode: '32003' },
    { city: 'Miami', state: 'FL', zipCode: '10001' },
    { city: 'Miami', state: 'NY', zipCode: '33101' },
    { city: 'Unknown alias', state: 'FL', zipCode: '33101' },
  ])('requires address confirmation for conflicting $city/$state/$zipCode', input => expect(() => assertAddressCoherence({ ...lookup, ...input })).toThrow('ADDRESS_CONFIRMATION_REQUIRED'));
  it('does not fabricate coverage outside Florida', () => expect(() => assertAddressCoherence({ ...lookup, city: 'Austin', state: 'TX', zipCode: '78701' })).not.toThrow());
  it.each(['record', 'value', 'sales', 'rent', 'listings', 'rentalListings', 'market'])('blocks %s before reservation or HTTP', async family => {
    const usageGuard = { reserve: vi.fn(), finalize: vi.fn() };
    const client = { lookupProperty: vi.fn(), estimateValue: vi.fn(), searchSoldProperties: vi.fn(), estimateRent: vi.fn(), searchSaleListings: vi.fn(), searchRentalListings: vi.fn(), getMarketData: vi.fn() };
    const input = { ...lookup, city: 'Winter Haven', zipCode: '32003', queryFingerprint: 'offline', policy: {} };
    const supplemental = new RentCastSupplementalEvidenceProvider({ client, usageGuard });
    const attempts = {
      record: () => new RentCastPropertyDataProvider({ client, usageGuard }).getPropertyRecord(input),
      value: () => new RentCastValuationDataProvider({ client, usageGuard }).getValuationEvidence(input),
      sales: () => new RentCastSoldRecordDataProvider({ client, usageGuard }).getSoldRecordPool(input),
      rent: () => supplemental.getRentEstimate(input), listings: () => supplemental.getSaleListings(input),
      rentalListings: () => supplemental.getRentalListings(input), market: () => supplemental.getMarketData(input),
    };
    await expect(attempts[family as keyof typeof attempts]()).rejects.toThrow('ADDRESS_CONFIRMATION_REQUIRED');
    expect(usageGuard.reserve).not.toHaveBeenCalled();
    for (const transport of Object.values(client)) expect(transport).not.toHaveBeenCalled();
  });
});

describe('R-1 transport accounting including failure after HTTP', () => {
  it.each(['record','value','sales'])('counts a completed 404 for %s as an actual HTTP attempt', async family => {
    const execution=createProviderExecution();
    const client=createRentCastClient({apiKey:'offline',fetchImpl:trackedProviderFetch(execution,vi.fn(async()=>new Response('{}',{status:404})))});
    const load=family==='record'?()=>client.lookupProperty('offline fixture')
      :family==='value'?()=>client.estimateValue({address:'offline fixture',maxRadius:5,daysOld:90,compCount:5,lookupSubjectAttributes:true})
      :()=>client.searchSoldProperties({address:'offline fixture',radius:5,saleDateRange:90,propertyType:'Single Family',limit:10});
    await expect(load()).rejects.toThrow('PROPERTY_NOT_FOUND');
    expect(execution).toMatchObject({providerCalls:1,phase:'HTTP_COMPLETED'});
  });
  it.each(['throw','result'])('distinguishes access-check %s failure from a confirmed lack of entitlement', async failure => {
    const loadMarketRent=vi.fn();
    const result=await getCanonicalPropertyEvidenceWithDependencies({input:{propertyId:id},propertyId:id,userId:'offline',secret:'',parcelEnabled:false,financialEvidence:true,
      loadPublicProperty:async()=>property,loadCachedProvider:async()=>{if(failure==='throw')throw new Error('CACHE_READ_FAILED');
        return {type:'property_evidence',propertyId:id,state:'unavailable',entitlementState:'not_authorized',cacheState:'unknown',reason:'PROPERTY_INTELLIGENCE_ENTITLEMENT_CHECK_FAILED'};},loadMarketRent});
    expect(result.marketRent).toMatchObject({state:'PROVIDER_ERROR',absenceReason:'PROVIDER_ERROR',providerCalls:0});
    expect(loadMarketRent).not.toHaveBeenCalled();
  });
  it('records quota rejection before the HTTP boundary as zero calls', async () => {
    const execution=createProviderExecution(),transport=vi.fn();
    const provider=new RentCastSupplementalEvidenceProvider({
      client:createRentCastClient({apiKey:'offline',fetchImpl:trackedProviderFetch(execution,transport)}),
      usageGuard:{reserve:async()=>{throw new PropertyDataError('MONTHLY_PROVIDER_LIMIT_REACHED');},finalize:vi.fn()}});
    const result=await new MarketRentService({cache:new InMemorySupplementalEvidenceCache(),provider,execution,enabled:true,
      hasEntitlement:async()=>true,resolveSubject:async()=>subject,providerGate:async work=>work()}).get({propertyId:id,userId:'offline',acquire:true});
    expect(result).toMatchObject({state:'USAGE_BLOCKED',absenceReason:'QUOTA_BLOCKED',providerCalls:0,executionPhase:'BEFORE_HTTP'});
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['before', 'after', 'unobserved'])('canonical catch preserves the %s HTTP boundary', async phase => {
    const result = await getCanonicalPropertyEvidenceWithDependencies({ input: { propertyId: id }, propertyId: id, userId: 'offline', secret: '', parcelEnabled: false, financialEvidence: true,
      loadPublicProperty: async () => property,
      loadCachedProvider: async () => ({ type: 'property_evidence', propertyId: id, state: 'not_loaded', entitlementState: 'authorized', cacheState: 'miss' }),
      loadMarketRent: async (_id, _subject, execution) => {
        if (phase !== 'unobserved') {
          const transport = trackedProviderFetch(execution, vi.fn(async () => new Response('{}')));
          if (phase === 'after') await transport('https://mock.invalid');
        }
        throw new Error('RENT_CACHE_PERSISTENCE_FAILED');
      } });
    expect(result.marketRent?.providerCalls).toBe(phase === 'after' ? 1 : phase === 'before' ? 0 : null);
    expect(result.providerCalls).toBe(phase === 'after' ? 1 : phase === 'before' ? 0 : null);
    expect(result.marketRent?.executionPhase).toBe(phase === 'after' ? 'HTTP_COMPLETED' : phase === 'before' ? 'BEFORE_HTTP' : 'UNKNOWN');
  });
  it.each([200, 500])('retains %s HTTP attempt even when cache persistence fails', async status => {
    const execution = createProviderExecution(), transport = vi.fn(async () => new Response(JSON.stringify({ rent: 2000, subjectProperty: { addressLine1: property.address, city: property.city, state: property.state, zipCode: property.zip } }), { status }));
    const client = createRentCastClient({ apiKey: 'offline', fetchImpl: trackedProviderFetch(execution, transport) });
    const usageGuard = new InMemoryPropertyDataUsageGuard();
    const provider = new RentCastSupplementalEvidenceProvider({ client, usageGuard });
    const cache = new InMemorySupplementalEvidenceCache();
    vi.spyOn(cache, 'set').mockRejectedValue(new Error('CACHE_WRITE_FAILED'));
    const service = new MarketRentService({ cache, provider, execution, enabled: true, hasEntitlement: async () => true, resolveSubject: async () => subject, providerGate: async work => work() });
    const result = await service.get({ propertyId: id, userId: 'offline', acquire: true });
    expect(result).toMatchObject({ state: 'PROVIDER_ERROR', providerCalls: 1, executionPhase: 'HTTP_COMPLETED', absenceReason: 'PROVIDER_ERROR' });
    expect(transport).toHaveBeenCalledOnce();
    expect(marketRentStateAnswer(result, 'en')).not.toContain('No new query');
  });
});

describe('R-1 kill switch, production mock ban and cache identity', () => {
  it.each([
    { PROPERTY_DATA_MODE: 'mock', NODE_ENV: 'production' },
    { PROPERTY_DATA_MODE: 'mock', NODE_ENV: 'test', SUPABASE_URL: 'https://cyeipfskwwisbbayyaca.supabase.co' },
    { PROPERTY_DATA_MODE: 'mock', NODE_ENV: 'test', DENO_DEPLOYMENT_ID: 'deployed' },
    { PROPERTY_DATA_MODE: 'disabled', NODE_ENV: 'production' },
  ])('blocks the provider for production or disabled configuration', async env => {
    const config = readPropertyDataConfig(key => (env as Record<string, string>)[key]);
    expect(config.mode).toBe('disabled');
    const reserve = vi.fn(), fetchImpl = vi.fn();
    await expect(createPropertyDataProvider({ ...config, usageGuard: { reserve, finalize: vi.fn() }, fetchImpl }).getPropertyRecord(lookup)).rejects.toThrow('PROVIDER_DISABLED');
    const supplemental = createSupplementalEvidenceProvider({ ...config, usageGuard: { reserve, finalize: vi.fn() }, fetchImpl });
    await expect(supplemental.getRentEstimate({ ...lookup, queryFingerprint: 'offline' })).rejects.toThrow('PROVIDER_DISABLED');
    expect(fetchImpl).not.toHaveBeenCalled(); expect(reserve).not.toHaveBeenCalled();
  });
  it('treats an address fingerprint change as a cache miss without querying', async () => {
    const cache = new InMemorySupplementalEvidenceCache();
    await cache.set(id, 'rentEstimate', 'old-address', { provider: 'rentcast', evidenceType: 'rent_estimate', schemaVersion: 1, retrievedAt: new Date().toISOString(), queryFingerprint: 'same-query', status: 'NO_RESULT', provenance: 'PROVIDER_ESTIMATE', rent: null, rangeLow: null, rangeHigh: null, subjectProperty: null, comparables: [] });
    expect(await cache.get(id, 'rentEstimate', 'new-address', 'same-query', { allowStale: true })).toBeNull();
  });
});
