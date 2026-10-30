import { describe, it, expect, vi } from 'vitest';
import { buildFinancialEvidenceFromAuthorizedContext } from '../../../../supabase/functions/_shared/maxxis/financialEvidenceContext';
import { buildFinancialEvidenceAnswer } from '../../../../supabase/functions/_shared/maxxis/financialEvidenceAnswer';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel, validateReportViewModel } from './reportIntegrityViewModel';
import { resolveComparableMap } from './reportMapAssets';
import { projectProviderListingReferences } from '../../../../supabase/functions/_shared/maxxis/reportMarketReferences';
const rent = { provider: 'rentcast', evidenceType: 'rent_estimate', status: 'AVAILABLE', rent: 7820, rangeLow: 5230, rangeHigh: 10410, retrievedAt: '2026-10-17T12:00:00Z' };
const property = { id: '11111111-1111-4111-8111-111111111111', type: 'SFR', objective: 'Sell', address: '7081 Kalanianaole Hwy', price: 2100000 };
const evidence = () => buildFinancialEvidenceFromAuthorizedContext({ propertyId: property.id, cachedRent: { evidence: rent, freshness: { state: 'FRESH' } },
  taxProjection: { candidates: [{ candidateId: 'tax', normalizedValue: 6500, sourceType: 'RENTCAST', sourceId: 'rentcast', sourceFamily: 'RENTCAST', sourceAuthority: 'RentCast', evidenceStatus: 'VERIFIED_RECORD', freshness: 'FRESH', metadata: { year: 2025 } }] } });
describe('report recovery vertical evidence contract', () => {
  it('keeps the L1 property fields in both higher levels with concise unresolved values', () => {
    const full = { ...property, beds: 3, baths: 2, sqft: 1760, yearBuilt: 1950, lotSizeSqft: 7013, assessorId: 'QA-066',
      county: 'Pulaski', subdivision: 'QA subdivision', legalDescription: 'LOT 7R', annualPropertyTax: 1166, propertyTaxYear: 2025,
      assessedValue: 16651, assessmentYear: 2025, latestSalePrice: 30000, latestSaleDate: '2022-06-01',
      owner: { name: 'QA publisher', allowedContacts: [{ type: 'phone', value: '+15550123456' }] },
      canonicalPropertyFacts: { physical: { baths: { value: 1, semanticState: 'CONFLICTED' } } } };
    const models = ['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'].map(reportType => buildStrictReportViewModel({ schema: buildMaxxisReportSchema({ reportType, property: full }), language: 'pt' }));
    const base = models[0].property.facts.flatMap(group => group.rows).map(row => row.value);
    for (const model of models) {
      expect(validateReportViewModel(model).valid).toBe(true);
      expect(model.property.facts.flatMap(group => group.rows).map(row => row.value)).toEqual(expect.arrayContaining(base));
      expect(model.values.baths).toMatchObject({ state: 'CONFLICTED', text: '1', numericValue: null });
      expect(model.sections.filter(s => s.id === 'data-discrepancies')).toHaveLength(1);
    }
  });
  it('retains the complete canonical rental response including its five addresses, prices and map points', () => {
    const response = { ...rent, rent: 970, comparables: Array.from({ length: 5 }, (_, i) => ({ listingId: `rent-${i}`, address: `${i + 1} QA Rental St`, price: 895 + i * 50, latitude: 34.73 + i * .001, longitude: -92.33 + i * .001 })) };
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: { marketRent: { state: 'AVAILABLE', evidence: response } } });
    const vm = buildStrictReportViewModel({ schema, language: 'en' }), section = vm.sections.find(s => s.id === 'market-rent');
    expect(section.table.rows.map(row => row[1])).toEqual(response.comparables.map(c => c.address));
    expect(section.table.rows[0][2]).toBe('$895');
    expect(section.map.points.filter(p => p.marker !== 'S')).toHaveLength(5);
    expect(section.hero.value).toBe('$970');
  });
  it('ranks 5 SOLDs, 3 complementary SOLDs and 5 FOR SALE references without inventing ARV', () => {
    const listings = Array.from({ length: 10 }, (_, i) => ({ address: `${i} QA Listing`, price: 100000 + i * 1000, priceSemantic: 'PROVIDER_LISTING_PRICE', providerCorrelation: .80 + i / 100, latitude: 34.73, longitude: -92.33 }));
    expect(projectProviderListingReferences(listings).map(row => row.address)).toEqual(['9 QA Listing', '8 QA Listing', '7 QA Listing', '6 QA Listing', '5 QA Listing']);
    const sold = Array.from({ length: 8 }, (_, i) => ({ compIdentifier: `sold-${i}`, address: `${i} QA Closed Sale`, salePrice: 120000 + i * 1000, saleDate: '2026-09-01', role: 'PRIMARY', similarity: 80 + i, latitude: 34.73, longitude: -92.33 }));
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: {
      comparableEvidence: { used: sold, supporting: [] }, valuationIntelligence: { status: 'ARV_UNAVAILABLE', providerListingReferences: listings },
    } });
    const vm = buildStrictReportViewModel({ schema, language: 'en' }), market = vm.sections.find(s => s.id === 'sales-comparables');
    expect(market.table.rows.filter(row => row[5] === 'SOLD')).toHaveLength(5);
    expect(market.table.rows.filter(row => row[5].includes('Complementary'))).toHaveLength(3);
    expect(market.table.rows.filter(row => row[5] === 'FOR SALE')).toHaveLength(5);
    expect(market.table.rows[0][1]).toBe('7 QA Closed Sale');
    expect(market.map.points.filter(p => p.markerTone === 'sold')).toHaveLength(5);
    expect(market.map.points.filter(p => p.markerTone === 'complementary')).toHaveLength(3);
    expect(market.map.points.filter(p => p.markerTone === 'for-sale')).toHaveLength(5);
    expect(vm.sections.some(s => s.id === 'arv-market')).toBe(false);
    expect(projectProviderListingReferences([{ ...listings[0], priceSemantic: 'RECORDED_SALE' }])).toEqual([]);
  });
  it('explains a rental subject review instead of claiming the provider has no rental data', () => {
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: { marketRent: { state: 'RENT_AVM_REVIEW_REQUIRED', reviewField: 'buildingArea' } } });
    const text = buildStrictReportViewModel({ schema, language: 'pt' }).sections.find(s => s.id === 'rent-pending').text;
    expect(text.toLowerCase()).toContain('área construída');
    expect(text).not.toContain('sem dados');
  });
  it.each(['NO_RESULT','PROVIDER_ERROR','USAGE_BLOCKED','ENTITLEMENT_BLOCKED'])('reports the actual acquisition state %s rather than claiming no query', state => {
    const schema = buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', property, dealIntelligence: { marketRent: { state } } });
    const text = buildStrictReportViewModel({ schema, language: 'pt' }).sections.find(s => s.id === 'rent-pending').text;
    expect(text).not.toContain('ainda não consultado');
    expect(text).toBeTruthy();
  });
  it('rejects a partially loaded basemap instead of exporting blank map tiles', async () => {
    const context = Object.fromEntries(['fillRect', 'drawImage', 'save', 'restore', 'beginPath', 'arc', 'fill', 'stroke', 'fillText'].map(name => [name, vi.fn()]));
    let requested = 0, failedTile;
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/png;base64,bWFw' }) });
    vi.stubGlobal('Image', class {
      set src(value) { if (!value) return; failedTile ||= value; const fail = value === failedTile; requested++; queueMicrotask(() => fail ? this.onerror?.() : this.onload?.()); }
    });
    try {
      const map = await resolveComparableMap({}, { points: [{ latitude: 34.735, longitude: -92.328, marker: 'S', markerTone: '#15384f' }] });
      expect(requested).toBeGreaterThan(1);
      expect(map).toBeNull();
      expect(context.drawImage).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('projects profile criteria without treating absent scores as zero, in both report levels', () => {
    const profile = { score: 78, sourceProfile: { targetMarkets: ['Little Rock, AR'] }, profileSource: 'AUTHENTICATED_CURRENT_PROFILE', criteria: [{ key: 'market', score: 90 }, { key: 'price', score: null }, { key: 'unrecognized', score: 100 }] };
    for (const reportType of ['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']) {
      const schema = buildMaxxisReportSchema({ reportType, property, maxxisAnalysis: { profileAlignment: profile }, dealIntelligence: { investmentFit: profile } });
      const vm = buildStrictReportViewModel({ schema, language: 'en' });
      expect(validateReportViewModel(vm).valid).toBe(true);
      expect(vm.sections.find(s => s.id === 'profile-fit').gauge.value).toBe(78);
      const criteria = vm.sections.find(s => s.id === 'profile-criteria');
      expect(criteria.comparison).toEqual([{ label: 'Target market', value: 90, text: '90%' }]);
      expect(criteria.rows.map(row => row.value)).toEqual(['90%']);
    }
  });
  it('the same resolved rent reaches Maxxis and L2 without current-rent substitution or premium detail', () => {
    const financialEvidence = evidence();
    const schema = buildMaxxisReportSchema({ reportType: 'MAXXIS_ANALYSIS', property, maxxisAnalysis: { financialEvidence } });
    const vm = buildStrictReportViewModel({ schema, language: 'en' });
    expect(validateReportViewModel(vm).valid).toBe(true);
    expect(vm.sections.find(s => s.id === 'market-rent').hero.value).toBe('$7,820');
    expect(vm.sections.find(s => s.id === 'market-rent').map).toBeUndefined();
    const answer = buildFinancialEvidenceAnswer({ domain: 'providerMarketRentEstimate' }, financialEvidence, 'en').answer;
    expect(answer).toContain('7,820'); expect(answer).toContain('RentCast'); expect(answer).toContain('not current contract rent');
    expect(financialEvidence.inputs.currentContractRent.value).toBeNull();
    expect(vm.values.annualPropertyTax.text).toBe('$6,500');
    expect(vm.values.annualPropertyTax.source).toContain('RentCast');
    financialEvidence.inputs.propertyTax = { ...financialEvidence.inputs.propertyTax, value: null, analyticalUsability: 'CONFLICTED' };
    const conflict = buildMaxxisReportSchema({ reportType: 'MAXXIS_ANALYSIS', property: { ...property, annualPropertyTax: 999 }, maxxisAnalysis: { financialEvidence } });
    expect(buildStrictReportViewModel({ schema: conflict, language: 'en' }).values.annualPropertyTax).toMatchObject({ state: 'CONFLICTED', numericValue: null });
  });
  it('retains tax provenance and leads the NOI gap with the next blocker', () => {
    const stack = evidence();
    const tax = buildFinancialEvidenceAnswer({ domain: 'propertyTax' }, stack, 'en').answer;
    expect(tax).toContain('6,500'); expect(tax).toContain('RentCast'); expect(tax).not.toContain('Provided by you');
    const answer = buildFinancialEvidenceAnswer({ metric: 'NOI' }, stack, 'en', { strategy: 'Buy and Hold', propertyType: 'SFR' }).answer;
    expect(answer.indexOf('Next priority input')).toBeLessThan(answer.indexOf('7,820'));
  });
  it('does not describe an unqueried market as having no data', () => {
    const stack = buildFinancialEvidenceFromAuthorizedContext({ propertyId: property.id });
    expect(buildFinancialEvidenceAnswer({ domain: 'providerMarketRentEstimate' }, stack, 'pt').answer).toMatch(/Ainda não consultei/);
    const schema = buildMaxxisReportSchema({ reportType: 'MAXXIS_ANALYSIS', property, maxxisAnalysis: { financialEvidence: stack } });
    expect(buildStrictReportViewModel({ schema, language: 'pt' }).sections.some(s => s.id === 'rent-pending')).toBe(true);
  });
});
