import type { InternalPropertyRecord, PropertyEvidenceResult } from '../property-data/propertyEvidenceTypes.ts';
import type { Evidence } from '../property-data/types.ts';
import type { ParcelEvidence, ParcelResult, ParcelSource } from '../public-parcel/types.ts';
import { productionSourceAllowed } from '../public-parcel/registry.ts';
import type { CandidateInput, ConsensusField } from './types.ts';
import { computeParcelEvidenceConsensus } from './engine.ts';

// Parse only documented property lot conventions, retaining precision and raw input.
// Numeric/unqualified DB lot is sqft (existing production contract); acre suffix is explicit.
export function publisherLotCandidate(raw: InternalPropertyRecord['lot']): Pick<CandidateInput, 'originalValue' | 'value' | 'unit'> {
  if (typeof raw === 'number') return { originalValue: raw, value: raw, unit: 'SQFT' };
  if (raw == null || !raw.trim()) return { originalValue: raw, value: null, unit: null };
  const match = raw.trim().match(/^([+-]?\d[\d.,\s]*)(ac|acre|acres|sqft|sq\.\s*ft\.?|sf)?$/i);
  if (!match) return { originalValue: raw, value: null, unit: null };
  let numeric = match[1].replace(/\s+/g, '');
  const comma = numeric.lastIndexOf(','), dot = numeric.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) numeric = comma > dot ? numeric.replace(/\./g, '').replace(',', '.') : numeric.replace(/,/g, '');
  else if (comma >= 0) numeric = /^\d{1,3}(?:,\d{3})+$/.test(numeric) ? numeric.replace(/,/g, '') : numeric.replace(',', '.');
  // Decimal dot is retained: no presentation rounding in the consensus adapter.
  const value = Number(numeric);
  return { originalValue: raw, value: Number.isFinite(value) ? value : null, unit: /^ac/i.test(match[2] ?? '') ? 'ACRES' : 'SQFT' };
}

export type AuthorizedConsensusBundle = {
  // Authorization/subject identity is the acquisition caller's responsibility.
  // This module cannot fetch propertyId or authenticate a user, and caches nothing.
  publisher?: InternalPropertyRecord;
  providerEvidence?: PropertyEvidenceResult;
  publicParcels?: readonly { parcel: ParcelEvidence; source: ParcelSource;
    countyFips: string; subjectMatch: 'VERIFIED_SUBJECT'; freshness: ParcelResult['freshness'] }[];
  additionalCandidates?: readonly CandidateInput[];
};
export function candidatesFromAuthorizedBundle(bundle: AuthorizedConsensusBundle): CandidateInput[] {
  const rows: CandidateInput[] = [];
  if (bundle.publisher) {
    const property = bundle.publisher;
    const base = { sourceType: 'USER_PROVIDED' as const, sourceId: 'dealSifter', sourceFamily: 'PUBLISHER',
      sourceAuthority: 'PUBLISHER', evidenceStatus: 'USER_PROVIDED' as const };
    rows.push({ ...base, field: 'lotArea', ...publisherLotCandidate(property.lot) },
      { ...base, field: 'propertyType', originalValue: property.type },
      { ...base, field: 'buildingArea', originalValue: property.sqft,
        value: typeof property.sqft === 'number' ? property.sqft : typeof property.sqft === 'string' && /^\d+(\.\d+)?$/.test(property.sqft.trim()) ? Number(property.sqft) : null, unit: 'SQFT' });
  }
  const provider = bundle.providerEvidence;
  if (provider) {
    const record = provider.externalData;
    const add = (field: ConsensusField, evidence: Evidence<unknown> | undefined, unit: CandidateInput['unit'] = null, metadata: CandidateInput['metadata'] = {}) => {
      if (!evidence) return;
      const originalValue = evidence.value;
      rows.push({ field, originalValue, unit, sourceType: 'RENTCAST', sourceId: 'rentcast',
        sourceFamily: 'RENTCAST', sourceAuthority: 'RentCast', evidenceStatus: evidence.status,
        retrievedAt: evidence.retrievedAt, sourceUpdatedAt: evidence.effectiveDate,
        freshness: provider.freshness?.state,
        metadata: { ...metadata, effectiveDate: evidence.effectiveDate } });
    };
    add('lotArea', record.characteristics.lotSizeSqft, 'SQFT');
    add('buildingArea', record.characteristics.livingAreaSqft, 'SQFT');
    add('yearBuilt', record.characteristics.yearBuilt);
    add('propertyType', record.characteristics.propertyType);
    add('apn', record.parcel?.assessorId, null, { countyFips: record.parcel?.countyFips.value });
    add('owner', record.ownership.ownerNames);
    add('assessedValue', record.tax.assessedValue, 'USD', { year: record.tax.assessmentYear.value, concept: 'ASSESSED_VALUE' });
    add('propertyTax', record.tax.annualPropertyTax, 'USD', { year: record.tax.propertyTaxYear.value, concept: 'ANNUAL_RECORDED_TAX' });
    add('zoning', record.parcel?.zoning);
    if (!bundle.publisher) {
      const base = { sourceType: 'USER_PROVIDED' as const, sourceId: 'dealSifter', sourceFamily: 'PUBLISHER', sourceAuthority: 'PUBLISHER' };
      for (const [field, evidence, unit] of [
        ['lotArea', provider.internalData.characteristics.lotSizeSqft, 'SQFT'],
        ['buildingArea', provider.internalData.characteristics.livingAreaSqft, 'SQFT'],
        ['propertyType', provider.internalData.characteristics.propertyType, null],
      ] as const) rows.push({ ...base, field, originalValue: evidence.value, unit, evidenceStatus: evidence.status, retrievedAt: evidence.retrievedAt });
    }
  }
  for (const selection of bundle.publicParcels ?? []) {
    const { parcel, source } = selection;
    if (selection.subjectMatch !== 'VERIFIED_SUBJECT' || !productionSourceAllowed(source)
      || parcel.source !== source.sourceId || ![source.countyFips, ...(source.coverageCountyFips ?? [])].includes(selection.countyFips)) {
      throw new Error('INELIGIBLE_OR_UNVERIFIED_SUBJECT_PARCEL');
    }
    const base = { sourceId: parcel.source, sourceFamily: `COUNTY_GIS:${selection.countyFips}`,
      sourceAuthority: parcel.sourceAuthority, evidenceStatus: parcel.evidenceStatus,
      retrievedAt: parcel.retrievedAt, sourceUpdatedAt: parcel.sourceUpdatedAt, freshness: selection.freshness };
    const add = (field: ConsensusField, sourceField: string, value: unknown, sourceType: CandidateInput['sourceType'], unit: CandidateInput['unit'] = null, metadata: CandidateInput['metadata'] = {}) => {
      rows.push({ ...base, field, originalValue: value, sourceType, unit,
        evidenceStatus: value == null ? 'UNAVAILABLE' : sourceType === 'CALCULATED_GEOMETRY' ? 'CALCULATED' : base.evidenceStatus,
        metadata: { countyFips: selection.countyFips, sourceField: parcel.provenance[sourceField]?.sourceField ?? sourceField, ...metadata } });
    };
    add('lotArea', 'assessorAcres', parcel.assessorAcres, 'PUBLIC_ASSESSOR', 'ACRES');
    add('lotArea', 'gisAcres', parcel.gisAcres, 'PUBLIC_PARCEL_GIS', 'ACRES');
    // Convenience lotSqft/acres may already be derived; never turn that fallback into a new record.
    if (parcel.provenance.lotSqft?.status === 'PUBLIC_RECORD') add('lotArea', 'lotSqft', parcel.provenance.lotSqft.value, 'PUBLIC_PARCEL_GIS', 'SQFT');
    add('lotArea', 'geometryCalculatedSqft', parcel.geometryCalculatedSqft, 'CALCULATED_GEOMETRY', 'SQFT');
    add('lotArea', 'geometryCalculatedAcres', parcel.geometryCalculatedAcres, 'CALCULATED_GEOMETRY', 'ACRES');
    add('apn', 'apn', parcel.apn, 'PUBLIC_PARCEL_GIS', null, { apnNormalization: source.apnNormalization });
    add('owner', 'ownerName', parcel.ownerName, 'PUBLIC_PARCEL_GIS');
    add('assessedValue', 'assessedValue', parcel.assessedValue, 'PUBLIC_ASSESSOR', 'USD', { year: parcel.assessedYear, concept: 'ASSESSED_VALUE' });
    add('propertyTax', 'propertyTax', parcel.propertyTax, 'PUBLIC_TAX', 'USD', { year: parcel.propertyTaxYear, concept: 'ANNUAL_RECORDED_TAX' });
    add('zoning', 'zoning', parcel.zoning, source.role === 'ZONING' ? 'PUBLIC_ZONING' : 'PUBLIC_PARCEL_GIS');
  }
  rows.push(...bundle.additionalCandidates ?? []);
  return rows;
}
/** Future consumers must supply an already-authorized bundle, not an arbitrary propertyId. */
export function getPropertyEvidenceConsensus(bundle: AuthorizedConsensusBundle) {
  return computeParcelEvidenceConsensus(candidatesFromAuthorizedBundle(bundle));
}
