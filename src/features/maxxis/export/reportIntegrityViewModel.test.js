import { describe, expect, it } from 'vitest';
import { buildMaxxisReportSchema } from '../../../domain/maxxis/maxxisReportSchema';
import { buildStrictReportViewModel, reportFieldLabel, reportNarrativeString, validateExecutiveNarrative, validateRenderedReportText, validateReportViewModel } from './reportIntegrityViewModel';
import { reportIntegrityFixtures } from '../../../../scripts/report-integrity-fixtures.mjs';
import { localizePresentationText } from '../../../services/chatTranslation';

const property = { id: 'integrity-test', type: 'SFR', address: '4724 W 26th St', city: 'Little Rock', state: 'AR', zip: '72204', price: 90000, beds: 3, baths: 2, sqft: 1760, objective: 'Sell', capRate: 0 };
const schemaFor = (changes = {}, reportType = 'DEAL_INTELLIGENCE') => buildMaxxisReportSchema({ reportType, property: { ...property, ...changes }, dealIntelligence: { propertyEvidence: {}, valuationIntelligence: { status: 'ARV_UNAVAILABLE' }, comparableEvidence: {} } });
const project = (changes = {}, locale = 'pt') => buildStrictReportViewModel({ schema: schemaFor(changes), language: locale });
const visible = vm => [vm.property, vm.executive, vm.sections, vm.disclaimer].map(value => JSON.stringify(value)).join(' ');

describe('strict report display boundary', () => {
  it.each([null, undefined, '', false, {}, [], 'invalid', Number.NaN, Infinity, 0])('never infers a financial zero from unavailable %j', input => {
    const vm = project({ price: input, rehab: input });
    expect(vm.values.price.state).toBe('UNAVAILABLE'); expect(vm.values.rehab.state).toBe('UNAVAILABLE');
    expect(vm.values.price.numericValue).toBeNull(); expect(vm.values.rehab.numericValue).toBeNull();
    expect(validateReportViewModel(vm).valid).toBe(true);
  });
  it('accepts explicitly confirmed zero with provenance, not a legacy raw zero', () => {
    const vm = project({ rehab: 0, canonicalPropertyFacts: { financial: { rehab: { value: 0, semanticState: 'KNOWN', userConfirmed: true, source: 'PUBLISHER_DECLARATION' } } } });
    expect(vm.values.rehab).toMatchObject({ state: 'EXPLICIT_ZERO', numericValue: 0 });
    expect(vm.values.rehab.source).toMatch(/publicador/); expect(validateReportViewModel(vm).valid).toBe(true);
    expect(project({ rehab: 0 }).values.rehab.state).toBe('UNAVAILABLE');
  });
  it('does not trust canonical zero merely because old code marked it user-provided', () => {
    const vm = project({ canonicalPropertyFacts: { financial: { capRate: { value: 0, status: 'USER_PROVIDED', source: 'PROPERTY_APP_VALUE' } } } });
    expect(vm.values.capRate.numericValue).toBeNull(); expect(visible(vm)).not.toContain('0%');
  });
  it('requires explicit provenance for a stored capitalization rate', () => {
    expect(project({ capRate: 8 }).values.capRate.state).toBe('UNAVAILABLE');
    const vm = project({ capRate: 8, fieldProvenance: { capRate: 'USER_PROVIDED' } });
    expect(vm.values.capRate.numericValue).toBe(8);
  });
  it('allows existing calculated cap rate only with valid NOI and an explicit matching value basis', () => {
    const schema = schemaFor({ noi: 0, canonicalPropertyFacts: { financial: { noi: { value: 0, userConfirmed: true, source: 'PUBLISHER_DECLARATION' } } } });
    const candidate = { ...schema, presentation: { ...schema.presentation, existingMetrics: { capRate: { value: 0, sourceType: 'CALCULATED', formulaId: 'NOI_DIVIDED_BY_VALUE', valueBasis: 90000 } } } };
    expect(buildStrictReportViewModel({ schema: candidate }).values.capRate.state).toBe('EXPLICIT_ZERO');
    candidate.presentation.existingMetrics.capRate.valueBasis = 100000;
    expect(buildStrictReportViewModel({ schema: candidate }).values.capRate.state).toBe('UNAVAILABLE');
  });
  it.each(['annualPropertyTax', 'propertyTaxYear', 'MISSING CAPRATE', 'MISSING_CAPRATE', '{"translation":"bad"}', '[object Object]', 'NaN', 'READY_MIXED'])('detects prohibited final artifact token %s', token => expect(validateRenderedReportText(token).valid).toBe(false));
  it('fails closed for unknown labels, instead of humanizing raw keys', () => {
    expect(reportFieldLabel('privateUnexpectedBackendKey', 'pt')).toBeNull();
    expect(reportFieldLabel('annualPropertyTax', 'pt')).toBe('Imposto predial anual');
  });
  it.each(['pt', 'en', 'es'])('creates non-empty localized evidence-backed summary in %s', language => {
    const vm = project({}, language);
    expect(vm.executive.thesis.text).toContain('4724 W 26th St'); expect(vm.executive.thesis.evidenceRefs.length).toBeGreaterThan(0);
    expect(vm.executive.status).not.toContain('STRONG'); expect(validateReportViewModel(vm)).toMatchObject({ valid: true });
    expect(vm.sections.some(section => section.id === 'positive-signals')).toBe(false);
    expect(vm.sections.find(section => section.id === 'next-actions').items.length).toBeLessThanOrEqual(3);
  });
  it.each([null, ['bad'], { raw: 'bad' }, { translation: { text: 'bad' } }, '{invalid', '["bad"]'])('never stringifies arbitrary translation/model envelope %j', value => expect(reportNarrativeString(value)).toBe(''));
  it('parses an exact recognized translation envelope before presentation', () => {
    expect(reportNarrativeString({ translation: 'Texto seguro.' })).toBe('Texto seguro.');
    expect(reportNarrativeString('{"translation":"Texto seguro."}')).toBe('Texto seguro.');
  });
  it('rejects arbitrary LLM claims even when they cite a known fact, and falls back deterministically', () => {
    const schema = schemaFor(), initial = buildStrictReportViewModel({ schema });
    const unsupported = { executiveThesis: { text: 'Guaranteed return 98%', evidenceRefs: ['property:identity'] } };
    expect(validateExecutiveNarrative(unsupported, initial).valid).toBe(false);
    const vm = buildStrictReportViewModel({ schema: { ...schema, presentation: { ...schema.presentation, executiveNarrative: unsupported } } });
    expect(vm.executive.thesis.text).toBe(initial.executive.thesis.text);
    expect(vm.diagnostics).toContain('EXECUTIVE_NARRATIVE_REJECTED_DETERMINISTIC_FALLBACK');
  });
  it('rejects missing or unknown narrative evidence references', () => {
    const vm = project();
    expect(validateExecutiveNarrative({ executiveThesis: { text: vm.executive.thesis.text, evidenceRefs: ['unknown:fact'] } }, vm).valid).toBe(false);
  });
  it('accepts an exact packet claim without granting arbitrary numerical synthesis', () => {
    const vm = project(), fact = vm.evidencePacket.find(item => item.id === 'executive:thesis');
    expect(validateExecutiveNarrative({ executiveThesis: { text: fact.text, evidenceRefs: [fact.id] } }, vm).valid).toBe(true);
  });
  it('does not expose all-domain objects or unknown provider features to drawing', () => {
    const vm = project({ propertyFeatures: { unexpectedInternalKey: { payload: 'private' } } });
    expect(visible(vm)).not.toContain('unexpectedInternalKey'); expect(visible(vm)).not.toContain('canonicalPropertyFacts');
  });
  it('treats publisher notes as notes rather than executive conclusions', () => {
    const vm = project({ propertyUserNotes: 'A unique publisher observation.' });
    expect(vm.property.notes).toContain('A unique publisher observation.');
    expect(vm.executive.thesis.text).not.toContain('unique publisher');
  });
  it('resolves an existing safe translation by original cache identity before applying final output guards', async () => {
    const original = 'Welcome to the property. Notes PROPERTY_RELEASE.';
    await localizePresentationText({ text: original, targetLocale: 'pt', invoke: async () => ({ data: { translatedText: 'Notas traduzidas com segurança.' } }) });
    const vm = project({ notes: original });
    expect(vm.property.notes).toContain('Notas traduzidas com segurança.');
    expect(visible(vm)).not.toContain('PROPERTY_RELEASE');
  });
  it.each(reportIntegrityFixtures().map(fixture => [fixture.id, fixture]))('%s has only applicable substantive sections', (_id, fixture) => {
    const vm = buildStrictReportViewModel({ schema: buildMaxxisReportSchema({ reportType: 'DEAL_INTELLIGENCE', ...fixture.input }), language: 'pt' });
    expect(validateReportViewModel(vm)).toMatchObject({ valid: true });
    expect(vm.sections.every(section => section.items?.length || section.rows?.length || section.text || section.hero || section.table?.rows.length)).toBe(true);
    if (fixture.id === 'LAND_CONFLICT') { expect(vm.values.lotSizeSqft.state).toBe('CONFLICTED'); expect(vm.values.pricePerAcre).toBeUndefined(); expect(vm.values.lotSizeSqft.text).toContain('20.000'); expect(visible(vm)).not.toContain('Aluguel contratual'); }
  });
  it('keeps contract rent and provider estimates separate and qualifies provider tax correctly', () => {
    const schema = schemaFor({ objective: 'Buy and Hold' });
    const candidate = { ...schema, presentation: { ...schema.presentation, financialEvidence: { inputs: { propertyTax: { value: 2000, unit: 'USD', cadence: 'ANNUAL', sourceClass: 'PUBLIC_RECORD', source: { sourceType: 'PUBLIC_RECORD', sourceFamily: 'RENTCAST', sourceAuthority: 'RentCast' } } } } } };
    const vm = buildStrictReportViewModel({ schema: candidate, language: 'pt' });
    expect(vm.values['financial:propertyTax'].source).toContain('Registro do provedor · RentCast');
    expect(vm.values['financial:propertyTax'].source).not.toMatch(/Informado/);
    expect(vm.sections.find(section => section.id === 'next-actions').items.some(item => /contrato/.test(item.text))).toBe(true);
  });
  it('labels the existing square-foot-to-acre conversion as calculated, not publisher-declared', () => {
    const vm = project({ lotSizeSqft: 5000 });
    expect(vm.values.lotSizeAcres.numericValue).toBeCloseTo(5000 / 43560, 10);
    expect(vm.values.lotSizeAcres.source).toBe('Cálculo determinístico');
  });
  it('does not let false availability flags authorize forbidden comparable content', () => {
    const schema = schemaFor();
    const vm = buildStrictReportViewModel({ schema: { ...schema, sections: { ...schema.sections, valuationEvidence: { available: false, data: { providerEstimate: { value: 100000 } } } } } });
    expect(vm.sections.some(section => section.id === 'provider-reference')).toBe(false);
  });
  it.each(['MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('preserves confirmed private rent assumptions without promoting incomplete NOI in %s', reportType => {
    const schema = schemaFor({}, reportType);
    const vm = buildStrictReportViewModel({ schema: { ...schema, presentation: { ...schema.presentation,
      activeScenario: { confirmed: true, strategy: 'BUY_AND_HOLD', assumptions: { rent: 1800 }, calculatedOutputs: { NOI: 14200 } },
    } }, language: 'pt' });
    expect(vm.sections.find(section => section.id === 'saved-scenario-assumptions').rows[0].value).toContain('1.800');
    expect(vm.sections.some(section => section.id === 'saved-scenario-results')).toBe(false);
    expect(vm.sections.some(section => section.id === 'saved-scenario-limitations')).toBe(true);
    expect(validateReportViewModel(vm)).toEqual({ valid: true, errors: [] });
    expect(vm.evidencePacket.filter(item => item.id.includes('dealAssumptions.activeScenario')).every(item => item.sourceRefs[0].includes(property.id))).toBe(true);
  });
  it('keeps saved private scenarios out of L1', () => {
    const schema = schemaFor({}, 'PROPERTY_RELEASE');
    const vm = buildStrictReportViewModel({ schema: { ...schema, presentation: { ...schema.presentation,
      activeScenario: { confirmed: true, strategy: 'BUY_AND_HOLD', assumptions: { rent: 1800 } },
    } } });
    expect(vm.sections.some(section => section.id.startsWith('saved-scenario'))).toBe(false);
  });
});
