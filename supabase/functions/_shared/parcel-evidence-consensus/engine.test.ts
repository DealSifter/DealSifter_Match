import { describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { computeParcelEvidenceConsensus as compute } from './engine.ts';
import { candidatesFromAuthorizedBundle, getPropertyEvidenceConsensus, publisherLotCandidate } from './adapters.ts';
import type { CandidateInput, ConsensusField } from './types.ts';
import { AREA_VARIANCE_THRESHOLDS, SQFT_PER_ACRE } from '../public-parcel/areaPolicy.ts';
import { areaCrossCheck } from '../public-parcel/geometry.ts';
import { PARCEL_SOURCES } from '../public-parcel/registry.ts';
import { normalizeParcel } from '../public-parcel/arcgis.ts';
import { mapRentCastProperty } from '../property-data/rentcast/rentcastMapper.ts';
import { buildInternalPropertyEvidence } from '../property-data/propertyEvidenceService.ts';
import { specialization, SPECIALIZED_DOMAINS } from './policy.ts';
import { CONSENSUS_FIELDS } from './types.ts';

const sample = (field: ConsensusField, originalValue: unknown, family = 'PUBLISHER', options: Partial<CandidateInput> = {}): CandidateInput => ({
  field, originalValue, sourceType: family === 'RENTCAST' ? 'RENTCAST' : family === 'PUBLISHER' ? 'USER_PROVIDED' : 'PUBLIC_PARCEL_GIS',
  sourceId: family.toLowerCase(), sourceFamily: family, sourceAuthority: family, evidenceStatus: 'USER_PROVIDED',
  retrievedAt: '2026-10-14T00:00:00Z', ...options,
});
const area = (value: number, family = 'PUBLISHER', options: Partial<CandidateInput> = {}) => sample('lotArea', value, family, { unit: 'ACRES', ...options });
const lot = (values: CandidateInput[]) => compute(values).fields.lotArea;
const gable = [area(1.14), area(23854, 'RENTCAST', { unit: 'SQFT', evidenceStatus: 'VERIFIED_RECORD' })];
const three = [...gable, area(1.23, 'COUNTY_GIS:fixture', { evidenceStatus: 'PUBLIC_RECORD' })];
const artifactRoot = existsSync('supabase/functions/_shared/property-fact-reconciliation/model.ts') ? 'qa/smart-property-enrichment/consensus-regression' : existsSync('supabase/functions/_shared/maxxis/canonicalEvidenceProjection.ts') ? 'qa/canonical-evidence-maxxis/consensus-regression' : 'qa/parcel-evidence-consensus';
const artifact = (name: string, value: unknown) => {
  const path = artifactRoot; mkdirSync(path, { recursive: true });
  writeFileSync(`${path}/${name}.json`, JSON.stringify({ fixtureOnly: true, ...value as object }, null, 2) + '\n');
};

describe('deterministic field evidence consensus', () => {
  it('Gable: two independent sources conflict, no provider wins', () => {
    const result = lot(gable);
    expect(result.status).toBe('MATERIAL_CONFLICT'); expect(result.provisionalResolvedValue).toBeNull();
    expect(result.candidates).toHaveLength(2); expect(result.candidates[1].evidenceStatus).toBeDefined();
    artifact('gable-two-source-control', { result });
  });
  it('three sources: unique independent majority detects RentCast outlier without silent resolution', () => {
    const result = lot(three);
    expect(result.status).toBe('OUTLIER_DETECTED'); expect(result.supportingSources).toEqual(['COUNTY_GIS:fixture', 'PUBLISHER']);
    expect(result.conflictingSources).toEqual(['RENTCAST']); expect(result.provisionalResolvedValue).toBeNull();
    expect(result.candidates.find(row => row.sourceType === 'RENTCAST')?.normalizedAcres).toBe(23854 / 43560);
    artifact('three-source-outlier-control', { result });
  });
  it.each([
    [0.5, 0.505, 'CONSISTENT'], [1, 1.06, 'MINOR_VARIANCE'], [1, 1.8, 'MATERIAL_CONFLICT'],
    [0.98, 1, 'CONSISTENT'], [0.979999, 1, 'MINOR_VARIANCE'], [0.9, 1, 'MINOR_VARIANCE'], [0.899999, 1, 'MATERIAL_CONFLICT'],
  ])('area boundaries %s/%s => %s', (a, b, status) => {
    const result = lot([area(a as number), area(b as number, 'GIS')]);
    expect(result.status).toBe(status); expect(areaCrossCheck([a as number, b as number]).status).toBe(status);
  });
  it('uses central policy and rejects invalid overrides', () => {
    expect(AREA_VARIANCE_THRESHOLDS).toEqual({ consistent: .02, minor: .1 });
    expect(compute([area(1), area(1.06, 'GIS')], { consistent: .07 }).fields.lotArea.status).toBe('CONSISTENT');
    expect(() => compute([], { minor: .01 })).toThrow('INVALID_CONSENSUS_THRESHOLDS');
    expect(() => compute([], { consistent: NaN })).toThrow('INVALID_CONSENSUS_THRESHOLDS');
  });
  it('resolution requires independent agreement; single source only remains evidence', () => {
    const result = lot([area(.75, 'GIS')]); expect(result.status).toBe('SINGLE_SOURCE');
    expect(result.provisionalResolvedValue).toBeNull(); expect(result.candidates[0].normalizedValue).toBe(.75 * SQFT_PER_ACRE);
  });
  it('provisional family median only with all-source agreement or explicit cluster opt-in', () => {
    expect(lot([area(.5), area(.505, 'GIS')]).provisionalResolvedAcres).toBeCloseTo(.5025, 14);
    const opt = compute(three, { allowOutlierProvisional: true }).fields.lotArea;
    expect(opt.provisionalResolvedAcres).toBeCloseTo(1.185, 14); expect(opt.materialConflict).toBe(true);
    expect(opt.resolutionBasis).toBe('EXPLICIT_OPT_IN_MAJORITY_FAMILY_MEDIAN'); expect(opt.outliers).toHaveLength(1);
  });
  it('preserves all correlated evidence, not independent votes', () => {
    const rows = [area(1, 'GIS'), area(1.01, 'GIS', { sourceType: 'CALCULATED_GEOMETRY' }), area(.55, 'RENTCAST')];
    const result = lot(rows); expect(result.status).toBe('MATERIAL_CONFLICT'); expect(result.independentSourceFamilies).toHaveLength(2);
    expect(result.candidates).toHaveLength(3); expect(result.outliers).toHaveLength(0);
  });
  it('internal GIS contradiction cannot become a strong confirmation', () => {
    const result = lot([area(1, 'GIS'), area(.55, 'GIS', { sourceType: 'CALCULATED_GEOMETRY' }), area(1)]);
    expect(result.status).toBe('MATERIAL_CONFLICT'); expect(result.reasonCode).toBe('SOURCE_INTERNAL_CONFLICT');
    expect(result.provisionalResolvedValue).toBeNull(); expect(result.internalSourceStates.find(row => row.sourceFamily === 'GIS')?.status).toBe('MATERIAL_CONFLICT');
  });
  it('GIS internal agreement stays single independent source', () => {
    const result = lot([area(1, 'GIS'), area(1.01, 'GIS', { sourceType: 'CALCULATED_GEOMETRY' })]);
    expect(result.status).toBe('SINGLE_SOURCE'); expect(result.internalSourceStates[0].status).toBe('CONSISTENT');
  });
  it('raw/normalized RentCast derivatives forced into one family', () => {
    const result = lot([area(1, 'RENTCAST'), area(1, 'RENTCAST', { sourceFamily: 'RentCast-normalized' })]);
    expect(result.independentSourceFamilies).toEqual(['RENTCAST']); expect(result.status).toBe('SINGLE_SOURCE');
  });
  it('same sourceId or publisher derivative cannot masquerade as independent sources', () => {
    const rows = [area(1, 'one', { sourceId: 'same-record', sourceType: 'FUTURE_PROVIDER' }), area(1, 'two', { sourceId: 'same-record', sourceType: 'FUTURE_PROVIDER' })];
    expect(lot(rows).status).toBe('SINGLE_SOURCE');
    expect(lot([area(1), area(1, 'PUBLISHER', { sourceFamily: 'publisher-normalized' })]).status).toBe('SINGLE_SOURCE');
    expect(lot(rows).candidates.map(row => row.declaredSourceFamily).sort()).toEqual(['one', 'two']);
  });
  it('exact duplicates neither create outliers nor weight provisional medians', () => {
    const first = lot([area(1), area(1.06, 'GIS')]);
    const repeated = lot([...Array.from({ length: 20 }, () => area(1)), area(1.06, 'GIS')]);
    expect(repeated.provisionalResolvedValue).toBe(first.provisionalResolvedValue); expect(repeated.candidates).toHaveLength(21);
    expect(lot([...Array.from({ length: 20 }, () => area(1)), area(.55, 'RENTCAST')]).status).toBe('MATERIAL_CONFLICT');
  });
  it('ties/overlapping clusters and non-majorities stay unresolved', () => {
    for (const values of [[1, 1.1, 1.2], [1, 1.01, 2, 2.01], [1, 2, 3]]) {
      const result = lot(values.map((v, i) => area(v, `source-${i}`)));
      expect(result.status).toBe('MATERIAL_CONFLICT'); expect(result.provisionalResolvedValue).toBeNull();
    }
  });
  it('retains precision, raw text and safe localized publisher units', () => {
    for (const [raw, expected] of [['1.123456789 ac', 1.123456789], ['1,123456789 acres', 1.123456789], ['23,854 sqft', 23854], ['23.854,25 sf', 23854.25]] as const) {
      const parsed = publisherLotCandidate(raw); expect(parsed.value).toBe(expected); expect(parsed.originalValue).toBe(raw);
    }
    expect(publisherLotCandidate('about 1 acre').value).toBeNull();
    expect(publisherLotCandidate(null).value).toBeNull();
    expect(lot([{ ...area(0), ...publisherLotCandidate('1.123456789 ac') }]).candidates[0].normalizedAcres).toBeCloseTo(1.123456789, 14);
  });
  it('unavailable, unknown, not-applicable and genuinely known zero are distinct', () => {
    const fields = compute([sample('apn', null, 'GIS', { evidenceStatus: 'UNKNOWN' }), sample('zoning', null, 'GIS', { evidenceStatus: 'NOT_APPLICABLE' }),
      sample('propertyTax', 0, 'GIS', { unit: 'USD', evidenceStatus: 'PUBLIC_RECORD' })]).fields;
    expect(fields.lotArea.status).toBe('UNAVAILABLE'); expect(fields.apn.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(fields.zoning.status).toBe('NOT_APPLICABLE'); expect(fields.propertyTax.status).toBe('SINGLE_SOURCE');
    expect(fields.propertyTax.candidates[0].normalizedValue).toBe(0);
    expect(lot([area(0)]).status).toBe('INSUFFICIENT_EVIDENCE');
  });
  it.each(['lotArea', 'assessedValue', 'propertyTax'] as const)('missing %s never converts to zero', field => {
    for (const value of [null, undefined, '', NaN, Infinity, -1]) {
      const result = compute([sample(field, value, 'PUBLISHER', { unit: field === 'lotArea' ? 'ACRES' : 'USD' })]).fields[field];
      expect(result.candidates[0].normalizedValue).toBeNull(); expect(result.provisionalResolvedValue).toBeNull();
    }
  });
  it('rejects unknown units and derived non-finite area', () => {
    expect(lot([area(1, 'PUBLISHER', { unit: null })]).status).toBe('INSUFFICIENT_EVIDENCE');
    expect(lot([area(Number.MAX_VALUE)]).candidates[0].normalizedValue).toBeNull();
  });
  it('APN preserves leading zeros and only removes separators under explicit county policy', () => {
    const metadata = { countyFips: '49035', apnNormalization: 'REMOVE_SEPARATORS' as const };
    const result = compute([sample('apn', '00-012.30', 'PUBLISHER', { metadata }), sample('apn', '0001230', 'GIS', { metadata })]).fields.apn;
    expect(result.status).toBe('CONSISTENT'); expect(result.provisionalResolvedValue).toBe('0001230');
    expect(result.candidates.some(row => row.originalValue === '00-012.30')).toBe(true);
    expect(compute([sample('apn', '0001230'), sample('apn', '1230', 'GIS')]).fields.apn.status).toBe('MATERIAL_CONFLICT');
    expect(compute([sample('apn', 'A-1'), sample('apn', 'A1', 'GIS')]).fields.apn.status).toBe('MATERIAL_CONFLICT');
    expect(compute([sample('apn', 'A-1', 'GIS', { metadata: { apnNormalization: 'REMOVE_SEPARATORS' } })]).fields.apn.status).toBe('INSUFFICIENT_EVIDENCE');
    artifact('apn-consensus-cases', { result });
  });
  it('APNs from different jurisdictions are not a direct comparison', () => {
    const result = compute([sample('apn', '123', 'PUBLISHER', { metadata: { countyFips: '49035' } }), sample('apn', '456', 'GIS', { metadata: { countyFips: '37063' } })]).fields.apn;
    expect(result.status).toBe('INSUFFICIENT_EVIDENCE');
  });
  it('safe owner punctuation/case/whitespace normalization, no fuzzy LLC aliases', () => {
    expect(compute([sample('owner', 'Acme, LLC'), sample('owner', '  ACME LLC  ', 'GIS')]).fields.owner.status).toBe('CONSISTENT');
    expect(compute([sample('owner', 'Acme LLC'), sample('owner', 'Acme Holdings LLC', 'GIS')]).fields.owner.status).toBe('MATERIAL_CONFLICT');
    expect(compute([sample('owner', 'Acme LLC'), sample('owner', 'Acme L.L.C.', 'GIS')]).fields.owner.status).toBe('CONSISTENT');
  });
  it('owner arrays use exact normalized sets with original provenance retained', () => {
    const result = compute([sample('owner', ['Acme, LLC', 'John Smith']), sample('owner', ['JOHN SMITH', 'ACME LLC', 'ACME LLC'], 'GIS')]).fields.owner;
    expect(result.status).toBe('CONSISTENT'); expect(result.candidates.some(row => Array.isArray(row.originalValue) && row.originalValue.length === 3)).toBe(true);
    expect(compute([sample('owner', ['A', 'B']), sample('owner', 'A | B', 'GIS')]).fields.owner.status).toBe('MATERIAL_CONFLICT');
    expect(compute([sample('owner', ['Acme, LLC']), sample('owner', 'ACME LLC', 'GIS')]).fields.owner.status).toBe('CONSISTENT');
  });
  it('ownership temporal changes do not imply a current conflict', () => {
    const rows = [sample('owner', 'A', 'PUBLISHER', { metadata: { effectiveDate: '2024-01-01' } }), sample('owner', 'B', 'GIS', { metadata: { effectiveDate: '2026-01-01' } })];
    expect(compute(rows).fields.owner.status).toBe('INSUFFICIENT_EVIDENCE');
  });
  it.each(['assessedValue', 'propertyTax'] as const)('fiscal comparability and actual zero: %s', field => {
    const concept = field === 'assessedValue' ? 'ASSESSED_VALUE' : 'ANNUAL_RECORDED_TAX';
    const rows = [sample(field, 0, 'PUBLISHER', { unit: 'USD', metadata: { year: 2024, concept } }), sample(field, 0, 'GIS', { unit: 'USD', metadata: { year: 2024, concept } })];
    expect(compute(rows).fields[field].status).toBe('CONSISTENT'); expect(compute(rows).fields[field].provisionalResolvedValue).toBe(0);
    expect(compute([rows[0], { ...rows[1], originalValue: 100 }]).fields[field].status).toBe('MATERIAL_CONFLICT');
    expect(compute([rows[0], { ...rows[1], metadata: { year: 2025, concept } }]).fields[field].status).toBe('INSUFFICIENT_EVIDENCE');
    expect(compute([rows[0], { ...rows[1], metadata: { concept } }]).fields[field].status).toBe('INSUFFICIENT_EVIDENCE');
    expect(compute([rows[0], { ...rows[1], evidenceStatus: 'ESTIMATED' }]).fields[field].status).toBe('SINGLE_SOURCE');
    artifact(field === 'assessedValue' ? 'assessment-consensus-cases' : 'tax-consensus-cases', { sameYear: compute(rows).fields[field], differentYear: compute([rows[0], { ...rows[1], metadata: { year: 2025, concept } }]).fields[field] });
  });
  it('AVM/market/sale/asking price never competes with assessed value', () => {
    const rows = ['AVM', 'MARKET_VALUE', 'SALE_PRICE', 'ASKING_PRICE'].map(concept => sample('assessedValue', 100, concept, { unit: 'USD', metadata: { year: 2026, concept } }));
    expect(compute(rows).fields.assessedValue.independentSourceFamilies).toHaveLength(0);
  });
  it('zoning specialization preserves publisher disagreement and no winner', () => {
    const result = compute([sample('zoning', 'R2'), sample('zoning', 'R1', 'PLANNING', { sourceType: 'PUBLIC_ZONING' })]).fields.zoning;
    expect(result.status).toBe('MATERIAL_CONFLICT'); expect(result.provisionalResolvedValue).toBeNull();
    expect(result.candidates.find(row => row.sourceType === 'PUBLIC_ZONING')?.specialization).toBe('SPECIALIZED');
    artifact('zoning-consensus-cases', { result });
  });
  it('LAND publisher lock remains unchanged, provider SFR conflict documented', () => {
    const property = { type: 'LAND', resolvedAnalysisPropertyType: 'LAND' };
    const before = structuredClone(property);
    const result = compute([sample('propertyType', property.type), sample('propertyType', 'Single Family', 'RENTCAST')]).fields.propertyType;
    expect(result.status).toBe('MATERIAL_CONFLICT'); expect(property).toEqual(before); expect(property.resolvedAnalysisPropertyType).toBe('LAND');
  });
  it('building sqft never participates in lot consensus for any property type', () => {
    for (const type of ['LAND', 'RURAL', 'RECREATIONAL', 'MIXED_USE', 'SFR']) {
      const bundle = compute([area(1), sample('buildingArea', 43_560, 'RENTCAST', { unit: 'SQFT' }), sample('propertyType', type)]);
      expect(bundle.fields.lotArea.status).toBe('SINGLE_SOURCE'); expect(bundle.fields.lotArea.candidates).toHaveLength(1);
      expect(bundle.fields.buildingArea.status).toBe('SINGLE_SOURCE');
    }
  });
  it('stale-usable participates without changing freshness, provenance or timestamps', () => {
    const rows = [area(1), area(1.01, 'RENTCAST', { freshness: 'STALE_USABLE', sourceUpdatedAt: '2024-01-01', evidenceStatus: 'VERIFIED_RECORD' })];
    const result = lot(rows); expect(result.status).toBe('CONSISTENT');
    expect(result.candidates.find(row => row.sourceType === 'RENTCAST')).toMatchObject({ freshness: 'STALE_USABLE', sourceUpdatedAt: '2024-01-01', evidenceStatus: 'VERIFIED_RECORD' });
    artifact('stale-evidence-cases', { result });
  });
  it.each(['EXPIRED_UNUSABLE', 'IDENTITY_MISMATCH', 'CORRUPT', 'ABSENT'] as const)('unusable freshness excluded: %s', freshness => {
    const result = lot([area(1), area(1, 'RENTCAST', { freshness })]); expect(result.status).toBe('SINGLE_SOURCE');
    expect(result.candidates.find(row => row.sourceType === 'RENTCAST')?.exclusionReason).toBe('UNUSABLE_FRESHNESS');
  });
  it('future documented user confirmation is domain-aware and never overrides conflict', () => {
    const result = lot([area(1.21, 'PUBLISHER', { userConfirmed: true, metadata: { documentContext: 'SURVEY' } }), area(.5, 'GIS')]);
    expect(result.status).toBe('MATERIAL_CONFLICT'); expect(result.candidates.find(row => row.sourceType === 'USER_PROVIDED')?.specialization).toBe('SPECIALIZED');
  });
  it('field states are independent, future source/domain extension requires no global ranking', () => {
    const bundle = compute([...gable, sample('apn', '001'), sample('apn', '001', 'GIS'), sample('assessedValue', 100, 'GIS', { unit: 'USD' }), sample('marketRent', 1500, 'future', { sourceType: 'FUTURE_PROVIDER', unit: 'USD' })]);
    expect(bundle.fields.lotArea.status).toBe('MATERIAL_CONFLICT'); expect(bundle.fields.apn.status).toBe('CONSISTENT');
    expect(bundle.fields.assessedValue.status).toBe('SINGLE_SOURCE'); expect(bundle.fields.marketRent.status).toBe('SINGLE_SOURCE');
    expect(specialization('PUBLIC_TAX', 'marketRent', false, false)).toBe('UNSPECIFIED');
    expect(specialization('USER_PROVIDED', 'currentRent', false, false)).toBe('SPECIALIZED');
    expect(specialization('RENTCAST', 'marketRent', false, false)).toBe('SPECIALIZED');
  });
  it('recomputation and source ordering are deterministic, no private cross-user cache', () => {
    expect(compute(three)).toEqual(compute([...three].reverse()));
    const original = structuredClone(three); const resultA = compute(three); resultA.fields.lotArea.candidates[0].metadata = { sourceHash: 'changed' };
    expect(three).toEqual(original); expect(compute(three)).not.toEqual(resultA);
    expect(lot([area(1), area(1, 'RENTCAST')]).status).toBe('CONSISTENT');
    expect(lot([area(2), area(1, 'RENTCAST')]).status).toBe('MATERIAL_CONFLICT');
  });
  it('changed provider/GIS evidence and source hashes recompute without cache invalidation', () => {
    const initial = [area(1), area(1, 'RENTCAST', { metadata: { sourceHash: 'provider-v1' } }), area(1, 'GIS')];
    expect(lot(initial).status).toBe('CONSISTENT');
    expect(lot([initial[0], { ...initial[1], originalValue: .5, metadata: { sourceHash: 'provider-v2' } }, initial[2]]).status).toBe('OUTLIER_DETECTED');
    const changed = lot([initial[0], initial[1], { ...initial[2], originalValue: 2 }]);
    expect(changed.status).toBe('OUTLIER_DETECTED'); expect(changed.conflictingSources).toEqual(['GIS']);
  });
  it('pure execution has no fetch/provider/Gemini calls and modest fixture cost', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('FORBIDDEN_LIVE_CALL'));
    const start = performance.now(); for (let i = 0; i < 250; i++) compute(three);
    const milliseconds = performance.now() - start;
    expect(fetch).not.toHaveBeenCalled(); fetch.mockRestore();
    artifact('performance-validation', { iterations: 250, totalMilliseconds: milliseconds, providerCalls: 0, geminiCalls: 0 });
  });
  it('writes reproducible area/independence QA diagnostics', () => {
    artifact('lot-area-consensus-cases', { cases: [[.5, .505], [1, 1.06], [1, 1.8]].map(values => lot(values.map((v, i) => area(v, `source-${i}`)))) });
    artifact('source-independence-cases', { correlated: lot([area(1, 'GIS'), area(1.01, 'GIS')]), internalConflict: lot([area(1, 'GIS'), area(.55, 'GIS')]), duplicated: lot([area(1), area(1)]) });
    const ranks = { SPECIALIZED: 3, RELEVANT: 2, CONTEXTUAL: 1, UNSPECIFIED: 0 };
    const matrix = CONSENSUS_FIELDS.flatMap(field => (Object.keys(SPECIALIZED_DOMAINS) as CandidateInput['sourceType'][]).map(source => {
      const level = specialization(source, field, false, false);
      return `${field},${source},${ranks[level]},${level}_DOMAIN_METADATA_NOT_WINNER_PRIORITY`;
    }));
    writeFileSync(`${artifactRoot}/field-authority-matrix.csv`, ['domain,sourceType,specializationRank,notes', ...matrix].join('\n') + '\n');
  });
});

describe('read-only adapters and production isolation', () => {
  const publisher = { id: 'fixture', type: 'LAND', address: null, city: null, state: null, zip: null, price: 10, beds: null, baths: null, sqft: '1800', lot: '1.14 ac' };
  const provider = () => ({ propertyId: 'fixture', internalData: buildInternalPropertyEvidence(publisher),
    externalData: mapRentCastProperty({ id: 'fixture-provider', lotSize: 23854, squareFootage: 1800, propertyType: 'Single Family', assessorID: '001' }, '2026-10-14T00:00:00Z'),
    conflicts: [], missingFields: [], provider: 'rentcast' as const, cacheHit: true, retrievedAt: '2026-10-14T00:00:00Z',
    sourceDiagnostics: { assessorId: { providerFieldPresence: 'PRESENT' as const, normalizationResult: '001', classification: 'AVAILABLE' as const } } });
  it('adapts existing normalized PropertyEvidenceResult without provider calls or raw data replacement', () => {
    const evidence = provider(); const before = structuredClone(evidence);
    const result = getPropertyEvidenceConsensus({ publisher, providerEvidence: evidence });
    expect(result.fields.lotArea.status).toBe('MATERIAL_CONFLICT'); expect(result.fields.propertyType.status).toBe('MATERIAL_CONFLICT');
    expect(result.fields.buildingArea.status).toBe('CONSISTENT'); expect(evidence).toEqual(before);
    expect(getPropertyEvidenceConsensus({ providerEvidence: evidence }).fields.lotArea.status).toBe('MATERIAL_CONFLICT');
  });
  it('preserves GIS recorded/calculated values as correlated source and blocks unapproved/non-subject parcels', () => {
    const source = PARCEL_SOURCES.find(row => row.sourceId === 'us-ut-salt-lake-parcels')!;
    const parcel = normalizeParcel(source, { PARCEL_ACRES: 1, PARCEL_ID: '001' }, { type: 'Polygon', coordinates: [[[-111, 40], [-111, 40.001], [-110.999, 40.001], [-110.999, 40], [-111, 40]]] }, '2026-10-14T00:00:00Z', null);
    const selected = { parcel, source, countyFips: '49035', subjectMatch: 'VERIFIED_SUBJECT' as const, freshness: 'STALE_USABLE' as const };
    const rows = candidatesFromAuthorizedBundle({ publicParcels: [selected] });
    expect(rows.filter(row => row.field === 'lotArea' && row.originalValue != null)).toHaveLength(3);
    expect(new Set(rows.map(row => row.sourceFamily)).size).toBe(1);
    expect(rows.find(row => row.sourceType === 'CALCULATED_GEOMETRY')).toMatchObject({ evidenceStatus: 'CALCULATED', freshness: 'STALE_USABLE' });
    expect(() => getPropertyEvidenceConsensus({ publicParcels: [{ ...selected, source: { ...source, usagePermission: 'INTERNAL_ANALYTICS_ONLY' } }] })).toThrow('INELIGIBLE');
    expect(() => getPropertyEvidenceConsensus({ publicParcels: [{ ...selected, countyFips: '37063' }] })).toThrow('INELIGIBLE');
  });
  it('only the explicitly migrated Maxxis read-only consumers import consensus; reports/financials remain isolated', () => {
    const walk = (root: string): string[] => readdirSync(root, { withFileTypes: true }).flatMap(item => item.isDirectory() ? walk(join(root, item.name)) : [join(root, item.name)]);
    const consumers = [...walk('src'), ...walk('supabase/functions')].filter(path => /\.(ts|tsx|js|jsx)$/.test(path)
      && !/parcel-evidence-consensus|\.(test|spec)\./.test(path));
    const hits = consumers.filter(path => /(?:from\s*|import\s*\()['"][^'"]*parcel-evidence-consensus/.test(readFileSync(path, 'utf8')));
    const approved=['canonicalEvidenceProjection.ts','canonicalEvidenceTool.ts','consensusFactAnswer.ts','analyticalPropertyContext.ts','property-fact-reconciliation/model.ts','property-fact-reconciliation/runtime.ts','property-fact-review/index.ts','propertyFacts/cardFacts.js'];
    expect(hits.every(path=>approved.some(name=>path.replaceAll('\\','/').endsWith(name)))).toBe(true);
    expect(hits).toHaveLength(8);
    artifact('consumer-validation', { runtimeImportCount: hits.length, approvedConsumers: hits, inspectedRuntimeFiles: consumers.length, propertyFactSidecars:true,publisherValueOverwrites:0,reportConsumption:0,financialConsumption:0 });
  });
});
