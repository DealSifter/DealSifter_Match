import { describe, it, expect, vi } from 'vitest';
import { buildFinancialEvidenceFromAuthorizedContext } from '../../../../supabase/functions/_shared/maxxis/financialEvidenceContext';
import { buildFinancialEvidenceAnswer } from '../../../../supabase/functions/_shared/maxxis/financialEvidenceAnswer';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel, validateReportViewModel } from './reportIntegrityViewModel';
import { resolveComparableMap } from './reportMapAssets';
const rent = { provider: 'rentcast', evidenceType: 'rent_estimate', status: 'AVAILABLE', rent: 7820, rangeLow: 5230, rangeHigh: 10410, retrievedAt: '2026-10-17T12:00:00Z' };
const property = { id: '11111111-1111-4111-8111-111111111111', type: 'SFR', objective: 'Sell', address: '7081 Kalanianaole Hwy', price: 2100000 };
const evidence = () => buildFinancialEvidenceFromAuthorizedContext({ propertyId: property.id, cachedRent: { evidence: rent, freshness: { state: 'FRESH' } },
  taxProjection: { candidates: [{ candidateId: 'tax', normalizedValue: 6500, sourceType: 'RENTCAST', sourceId: 'rentcast', sourceFamily: 'RENTCAST', sourceAuthority: 'RentCast', evidenceStatus: 'VERIFIED_RECORD', freshness: 'FRESH', metadata: { year: 2025 } }] } });
describe('report recovery vertical evidence contract', () => {
  it('rejects a partially loaded basemap instead of exporting blank map tiles', async () => {
    const context = Object.fromEntries(['fillRect', 'drawImage', 'save', 'restore', 'beginPath', 'arc', 'fill', 'stroke', 'fillText'].map(name => [name, vi.fn()]));
    let requested = 0;
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/png;base64,bWFw' }) });
    vi.stubGlobal('Image', class {
      set src(_value) { const fail = requested++ === 0; queueMicrotask(() => fail ? this.onerror() : this.onload()); }
    });
    try {
      const map = await resolveComparableMap({}, { points: [{ latitude: 34.735, longitude: -92.328, marker: 'S', markerTone: '#15384f' }] });
      expect(requested).toBeGreaterThan(1);
      expect(map).toBeNull();
      expect(context.drawImage).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
  it('projects profile criteria without treating absent scores as zero, in both report levels', () => {
    const profile = { score: 78, criteria: [{ key: 'market', score: 90 }, { key: 'price', score: null }, { key: 'unrecognized', score: 100 }] };
    for (const reportType of ['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE']) {
      const schema = buildMaxxisReportSchema({ reportType, property, maxxisAnalysis: { profileAlignment: profile }, dealIntelligence: { investmentFit: profile } });
      const vm = buildStrictReportViewModel({ schema, language: 'en' });
      expect(validateReportViewModel(vm).valid).toBe(true);
      expect(vm.sections.find(s => s.id === 'profile-fit').gauge.value).toBe(78);
      const criteria = vm.sections.find(s => s.id === 'profile-criteria');
      expect(criteria.comparison).toEqual([{ label: 'Target market', value: 90, text: '90%' }]);
      expect(criteria.rows.map(row => row.value)).toEqual(['90%', 'Unavailable']);
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
