import type { EvidenceStatus } from '../property-data/types.ts';
import type { EvidenceFreshnessState } from '../property-data/cacheFreshness.ts';

export const CONSENSUS_FIELDS = ['lotArea', 'apn', 'owner', 'assessedValue', 'propertyTax', 'zoning', 'propertyType',
  'buildingArea', 'yearBuilt', 'currentRent', 'marketRent', 'occupancy', 'condition', 'saleRecord', 'lotGeometry'] as const;
export type ConsensusField = typeof CONSENSUS_FIELDS[number];
export type ConsensusStatus = 'CONSISTENT' | 'MINOR_VARIANCE' | 'MATERIAL_CONFLICT' | 'OUTLIER_DETECTED'
  | 'INSUFFICIENT_EVIDENCE' | 'SINGLE_SOURCE' | 'NOT_APPLICABLE' | 'UNAVAILABLE';
export type ConsensusSource = 'USER_PROVIDED' | 'PUBLIC_PARCEL_GIS' | 'PUBLIC_ASSESSOR' | 'PUBLIC_TAX'
  | 'PUBLIC_ZONING' | 'RENTCAST' | 'CALCULATED_GEOMETRY' | 'FUTURE_PROVIDER';
export type CandidateInput = {
  field: ConsensusField; originalValue: unknown; value?: number | string | null; unit?: 'ACRES' | 'SQFT' | 'USD' | null;
  sourceType: ConsensusSource; sourceId: string; sourceFamily: string;
  sourceAuthority?: string | null; evidenceStatus: EvidenceStatus | 'PUBLIC_RECORD' | 'UNKNOWN' | 'NOT_APPLICABLE';
  retrievedAt?: string | null; sourceUpdatedAt?: string | null; freshness?: EvidenceFreshnessState | 'UNAVAILABLE';
  userConfirmed?: boolean;
  metadata?: { year?: number | null; effectiveDate?: string | null; concept?: string; countyFips?: string | null;
    apnNormalization?: 'EXACT' | 'REMOVE_SEPARATORS'; documentContext?: 'SURVEY' | 'DOCUMENTED';
    sourceHash?: string; sourceField?: string | null };
};
export type EvidenceCandidate = CandidateInput & {
  candidateId: string; declaredSourceFamily: string; normalizedValue: number | string | null; normalizedUnit: string | null;
  normalizedAcres: number | null; specialization: 'SPECIALIZED' | 'RELEVANT' | 'CONTEXTUAL' | 'UNSPECIFIED';
  comparable: boolean; exclusionReason: string | null;
};
export type FieldEvidenceConsensus = {
  field: ConsensusField; status: ConsensusStatus; candidates: EvidenceCandidate[];
  independentSourceFamilies: string[]; agreementCluster: string[]; outliers: string[];
  supportingSources: string[]; conflictingSources: string[];
  internalSourceStates: { sourceFamily: string; status: ConsensusStatus }[];
  provisionalResolvedValue: number | string | null; provisionalResolvedAcres: number | null;
  normalizedUnit: string | null; resolutionBasis: string | null; reasonCode: string;
  materialConflict: boolean; unresolvedReason: string | null;
};
export type ParcelEvidenceConsensus = {
  version: 'parcel-consensus-v1'; fields: Record<ConsensusField, FieldEvidenceConsensus>;
};
