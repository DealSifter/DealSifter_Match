import { SQFT_PER_ACRE, relativeAreaDifference, classifyAreaDifference } from '../public-parcel/areaPolicy.ts';
import { DEFAULT_CONSENSUS_POLICY, specialization, type ConsensusPolicy } from './policy.ts';
import { CONSENSUS_FIELDS, type CandidateInput, type ConsensusField, type ConsensusStatus,
  type EvidenceCandidate, type FieldEvidenceConsensus, type ParcelEvidenceConsensus } from './types.ts';

const numericFields = new Set<ConsensusField>(['lotArea', 'buildingArea', 'assessedValue', 'propertyTax', 'yearBuilt', 'currentRent', 'marketRent']);
const temporalFields = new Set<ConsensusField>(['assessedValue', 'propertyTax']);
const safeText = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function normalize(input: CandidateInput): EvidenceCandidate {
  // Clone provenance to prevent output mutation from contaminating another caller.
  const candidate = structuredClone(input);
  let value: number | string | null = null, unit: string | null = null, reason: string | null = null;
  const raw = Object.hasOwn(candidate, 'value') ? candidate.value : candidate.originalValue;
  if (numericFields.has(candidate.field)) {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      value = raw;
      if (candidate.field === 'lotArea' || candidate.field === 'buildingArea') {
        unit = 'SQFT';
        if (candidate.unit === 'ACRES' && candidate.field === 'lotArea') value *= SQFT_PER_ACRE;
        else if (candidate.unit !== 'SQFT') { value = null; reason = 'UNSUPPORTED_AREA_UNIT'; }
        if (value === 0 && candidate.field === 'lotArea') { value = null; reason = 'INVALID_ZERO_LOT_AREA'; }
      } else if (candidate.field !== 'yearBuilt') {
        unit = 'USD';
        if (candidate.unit !== 'USD') { value = null; reason = 'UNSUPPORTED_MONETARY_UNIT'; }
      } else if (!Number.isInteger(raw) || raw < 1) { value = null; reason = 'INVALID_YEAR'; }
      if (typeof value === 'number' && !Number.isFinite(value)) { value = null; reason = 'NON_FINITE_NORMALIZED_VALUE'; }
    }
  } else if (candidate.field === 'owner' && Array.isArray(raw) && raw.length && raw.every(v => typeof v === 'string' && v.trim())) {
    const names = [...new Set(raw.map(v => safeText(v).replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()))].sort(compareText);
    // A multi-owner set cannot accidentally equal a literal single owner containing a delimiter.
    value = names.length === 1 ? names[0] : `OWNER_SET:${JSON.stringify(names)}`;
  } else if (typeof raw === 'string' && raw.trim()) {
    value = safeText(raw);
    if (candidate.field === 'apn') {
      // APN has no universal numeric/canonical format. Separator removal is opt-in per county/source contract.
      if (candidate.metadata?.apnNormalization === 'REMOVE_SEPARATORS') {
        if (!candidate.metadata.countyFips) reason = 'APN_NORMALIZATION_JURISDICTION_REQUIRED';
        else value = value.replace(/[\s.\-/]/g, '');
      }
    } else if (candidate.field === 'owner') value = value.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    else if (candidate.field === 'propertyType') {
      const aliases: Record<string, string> = { 'SINGLE FAMILY': 'SFR', 'SINGLE-FAMILY': 'SFR', 'SINGLE FAMILY RESIDENTIAL': 'SFR', 'VACANT LAND': 'LAND' };
      value = aliases[value] ?? value;
    }
  }
  if (['UNAVAILABLE', 'UNKNOWN', 'NOT_APPLICABLE'].includes(candidate.evidenceStatus)) reason = candidate.evidenceStatus;
  else if (['EXPIRED_UNUSABLE', 'IDENTITY_MISMATCH', 'CORRUPT', 'ABSENT', 'UNAVAILABLE'].includes(candidate.freshness ?? '')) reason = 'UNUSABLE_FRESHNESS';
  else if (candidate.evidenceStatus === 'ESTIMATED' && temporalFields.has(candidate.field)) reason = 'ESTIMATE_NOT_ACTUAL_RECORD';
  else if (candidate.field === 'assessedValue' && candidate.metadata?.concept && candidate.metadata.concept !== 'ASSESSED_VALUE') reason = 'NON_EQUIVALENT_ASSESSMENT_CONCEPT';
  else if (candidate.field === 'propertyTax' && candidate.metadata?.concept && candidate.metadata.concept !== 'ANNUAL_RECORDED_TAX') reason = 'NON_EQUIVALENT_TAX_CONCEPT';
  else if (!candidate.sourceFamily.trim() || !candidate.sourceId.trim()) reason = 'SOURCE_IDENTITY_REQUIRED';
  else if (value === null) reason ??= 'NO_COMPARABLE_VALUE';
  // Provider raw/normalized/cache derivatives are always one underlying family.
  const family = candidate.sourceType === 'RENTCAST' ? 'RENTCAST' : candidate.sourceType === 'USER_PROVIDED' ? 'PUBLISHER' : candidate.sourceFamily.trim();
  return { ...candidate, sourceFamily: family, declaredSourceFamily: candidate.sourceFamily, candidateId: '', normalizedValue: value, normalizedUnit: unit,
    normalizedAcres: candidate.field === 'lotArea' && typeof value === 'number' ? value / SQFT_PER_ACRE : null,
    specialization: specialization(candidate.sourceType, candidate.field, candidate.userConfirmed === true, !!candidate.metadata?.documentContext),
    comparable: reason === null, exclusionReason: reason };
}
function difference(a: EvidenceCandidate, b: EvidenceCandidate, policy: ConsensusPolicy): ConsensusStatus {
  if (typeof a.normalizedValue === 'number' && typeof b.normalizedValue === 'number') {
    // Area thresholds do not automatically become money/year tolerances.
    if (a.field !== 'lotArea' && a.field !== 'buildingArea') return a.normalizedValue === b.normalizedValue ? 'CONSISTENT' : 'MATERIAL_CONFLICT';
    const delta = relativeAreaDifference(a.normalizedValue, b.normalizedValue);
    return classifyAreaDifference(delta, policy);
  }
  return a.normalizedValue === b.normalizedValue ? 'CONSISTENT' : 'MATERIAL_CONFLICT';
}
function groupStatus(rows: EvidenceCandidate[], policy: ConsensusPolicy): ConsensusStatus {
  let result: ConsensusStatus = 'CONSISTENT';
  for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
    const status = difference(rows[a], rows[b], policy);
    if (status === 'MATERIAL_CONFLICT') return status;
    if (status === 'MINOR_VARIANCE') result = status;
  }
  return result;
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2;
};

function resolveField(field: ConsensusField, candidates: EvidenceCandidate[], policy: ConsensusPolicy): FieldEvidenceConsensus {
  const valid = candidates.filter(row => row.comparable);
  const families = [...new Set(valid.map(row => row.sourceFamily))].sort(compareText);
  const familyRows = families.map(sourceFamily => ({ sourceFamily, rows: valid.filter(row => row.sourceFamily === sourceFamily) }));
  const internal = familyRows.map(({ sourceFamily, rows }) => ({ sourceFamily, status: rows.length === 1 ? 'SINGLE_SOURCE' as const : groupStatus(rows, policy) }));
  const result: FieldEvidenceConsensus = { field, status: 'UNAVAILABLE', candidates, independentSourceFamilies: families,
    agreementCluster: [], outliers: [], supportingSources: [], conflictingSources: [], internalSourceStates: internal,
    provisionalResolvedValue: null, provisionalResolvedAcres: null, normalizedUnit: valid[0]?.normalizedUnit ?? null,
    resolutionBasis: null, reasonCode: 'NO_EVIDENCE', materialConflict: false, unresolvedReason: 'NO_EVIDENCE' };
  const finish = (status: ConsensusStatus, code: string) => {
    result.status = status; result.reasonCode = code;
    result.materialConflict = status === 'MATERIAL_CONFLICT' || status === 'OUTLIER_DETECTED';
    result.unresolvedReason = result.provisionalResolvedValue === null ? code : null;
    return result;
  };
  if (!valid.length) {
    if (candidates.length && candidates.every(row => row.evidenceStatus === 'NOT_APPLICABLE')) return finish('NOT_APPLICABLE', 'FIELD_NOT_APPLICABLE');
    if (candidates.some(row => row.evidenceStatus !== 'UNAVAILABLE' && row.evidenceStatus !== 'NOT_APPLICABLE')) return finish('INSUFFICIENT_EVIDENCE', 'NO_COMPARABLE_EVIDENCE');
    return finish('UNAVAILABLE', 'NO_EVIDENCE');
  }
  // Different or absent fiscal years/concepts are not a direct contradiction.
  if (valid.length > 1 && temporalFields.has(field) && (valid.some(row => !Number.isInteger(row.metadata?.year)
    || !row.metadata?.concept) || new Set(valid.map(row => `${row.metadata?.year}:${row.metadata?.concept}`)).size !== 1)) {
    result.internalSourceStates = internal.map(row => ({ ...row, status: 'INSUFFICIENT_EVIDENCE' }));
    return finish('INSUFFICIENT_EVIDENCE', 'NON_EQUIVALENT_OR_UNKNOWN_FISCAL_CONTEXT');
  }
  if (field === 'owner' && new Set(valid.map(row => row.metadata?.effectiveDate).filter(Boolean)).size > 1) {
    result.internalSourceStates = internal.map(row => ({ ...row, status: 'INSUFFICIENT_EVIDENCE' }));
    return finish('INSUFFICIENT_EVIDENCE', 'DIFFERENT_OWNERSHIP_DATES');
  }
  if (field === 'apn' && new Set(valid.map(row => row.metadata?.countyFips).filter(Boolean)).size > 1) return finish('INSUFFICIENT_EVIDENCE', 'DIFFERENT_APN_JURISDICTIONS');
  if (internal.some(row => row.status === 'MATERIAL_CONFLICT')) {
    result.conflictingSources = internal.filter(row => row.status === 'MATERIAL_CONFLICT').map(row => row.sourceFamily);
    return finish('MATERIAL_CONFLICT', 'SOURCE_INTERNAL_CONFLICT');
  }
  if (families.length === 1) return finish('SINGLE_SOURCE', 'ONE_INDEPENDENT_SOURCE');
  const allStatus = groupStatus(valid, policy);
  let cluster = familyRows;
  let status = allStatus;
  if (allStatus === 'MATERIAL_CONFLICT') {
    // For scalar numeric/text evidence, maximal pairwise-compatible intervals/groups
    // are found without exponential clique search. ALL derivatives in a family count.
    const sorted = [...familyRows].sort((a, b) => {
      const av = typeof a.rows[0].normalizedValue === 'number' ? Math.min(...a.rows.map(row => row.normalizedValue as number)) : a.rows[0].normalizedValue!;
      const bv = typeof b.rows[0].normalizedValue === 'number' ? Math.min(...b.rows.map(row => row.normalizedValue as number)) : b.rows[0].normalizedValue!;
      return typeof av === 'number' && typeof bv === 'number' ? av - bv || compareText(a.sourceFamily, b.sourceFamily) : compareText(String(av), String(bv)) || compareText(a.sourceFamily, b.sourceFamily);
    });
    const options = sorted.map((_, start) => {
      const members = [sorted[start]];
      for (let end = start + 1; end < sorted.length; end++) {
        const next = [...members, sorted[end]];
        if (groupStatus(next.flatMap(row => row.rows), policy) === 'MATERIAL_CONFLICT') break;
        members.push(sorted[end]);
      }
      return members;
    });
    const size = Math.max(...options.map(option => option.length));
    const winners = options.filter(option => option.length === size);
    // Unique strict majority, every outsider materially disagrees with EVERY
    // member. Ambiguous chains (A~B, B~C, A!C) never select a winner.
    if (size < 2 || size <= families.length / 2 || winners.length !== 1) {
      result.conflictingSources = families;
      return finish('MATERIAL_CONFLICT', 'NO_UNIQUE_INDEPENDENT_MAJORITY_CLUSTER');
    }
    cluster = winners[0];
    const outsiders = familyRows.filter(row => !cluster.includes(row));
    if (!outsiders.every(out => cluster.every(member => out.rows.every(a => member.rows.every(b => difference(a, b, policy) === 'MATERIAL_CONFLICT'))))) {
      result.conflictingSources = families;
      return finish('MATERIAL_CONFLICT', 'AMBIGUOUS_CLUSTER_BOUNDARY');
    }
    status = 'OUTLIER_DETECTED';
    result.conflictingSources = outsiders.map(row => row.sourceFamily);
    result.outliers = outsiders.flatMap(row => row.rows.map(candidate => candidate.candidateId));
  }
  result.supportingSources = cluster.map(row => row.sourceFamily).sort(compareText);
  result.agreementCluster = cluster.flatMap(row => row.rows.map(row => row.candidateId)).sort(compareText);
  if (status !== 'OUTLIER_DETECTED' || policy.allowOutlierProvisional) {
    // Equal FAMILY weighting: ten derivatives never outweigh one independent source.
    const familyValues = cluster.map(row => typeof row.rows[0].normalizedValue === 'number'
      ? median([...new Set(row.rows.map(candidate => candidate.normalizedValue as number))]) : row.rows[0].normalizedValue!);
    result.provisionalResolvedValue = typeof familyValues[0] === 'number' ? median(familyValues as number[]) : familyValues[0];
    result.provisionalResolvedAcres = field === 'lotArea' ? (result.provisionalResolvedValue as number) / SQFT_PER_ACRE : null;
    result.resolutionBasis = status === 'OUTLIER_DETECTED' ? 'EXPLICIT_OPT_IN_MAJORITY_FAMILY_MEDIAN' : 'AGREEING_INDEPENDENT_FAMILY_MEDIAN';
  }
  return finish(status, status === 'OUTLIER_DETECTED' ? 'UNIQUE_MAJORITY_CLUSTER_WITH_OUTLIERS' : 'INDEPENDENT_SOURCES_AGREE');
}

/** Pure, read-only, per-call computation over ALREADY AUTHORIZED subject evidence.
 * No repository, provider, network, cache, clock, DB write or consumer integration. */
export function computeParcelEvidenceConsensus(inputs: readonly CandidateInput[], overrides: Partial<ConsensusPolicy> = {}): ParcelEvidenceConsensus {
  const policy = { ...DEFAULT_CONSENSUS_POLICY, ...overrides };
  if (!Number.isFinite(policy.consistent) || !Number.isFinite(policy.minor) || policy.consistent < 0
    || policy.minor < policy.consistent || policy.minor >= 1) throw new Error('INVALID_CONSENSUS_THRESHOLDS');
  const candidates = inputs.map(normalize).sort((a, b) => compareText(JSON.stringify(a), JSON.stringify(b)));
  // A source ID cannot acquire independent votes by declaring different families.
  // Merge connected lineages conservatively; preserve the declared lineage in output.
  const parent = new Map(candidates.map(row => [row.sourceFamily, row.sourceFamily]));
  const root = (family: string): string => {
    const next = parent.get(family)!;
    if (next === family) return family;
    const resolved = root(next); parent.set(family, resolved); return resolved;
  };
  const sourceFamilies = new Map<string, string>();
  for (const row of candidates) {
    if (!row.sourceId.trim()) continue;
    const prior = sourceFamilies.get(row.sourceId.trim());
    if (prior) {
      const roots = [root(prior), root(row.sourceFamily)].sort(compareText);
      parent.set(roots[1], roots[0]);
    } else sourceFamilies.set(row.sourceId.trim(), row.sourceFamily);
  }
  candidates.forEach(row => { row.sourceFamily = root(row.sourceFamily); });
  // Exact duplicates preserved for provenance, but never multiply family votes.
  candidates.forEach((row, index) => { row.candidateId = `evidence-${index + 1}`; });
  return { version: 'parcel-consensus-v1', fields: Object.fromEntries(CONSENSUS_FIELDS.map(field =>
    [field, resolveField(field, candidates.filter(row => row.field === field), policy)])) as ParcelEvidenceConsensus['fields'] };
}
