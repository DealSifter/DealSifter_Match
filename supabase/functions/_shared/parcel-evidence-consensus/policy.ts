import { AREA_VARIANCE_THRESHOLDS } from '../public-parcel/areaPolicy.ts';
import type { ConsensusField, ConsensusSource, EvidenceCandidate } from './types.ts';

// Domain metadata, NOT a universal provider ranking or a winner-selection rule.
export const SPECIALIZED_DOMAINS: Readonly<Record<ConsensusSource, readonly ConsensusField[]>> = Object.freeze({
  USER_PROVIDED: ['currentRent', 'occupancy', 'condition'],
  PUBLIC_PARCEL_GIS: ['lotGeometry', 'lotArea', 'apn'],
  PUBLIC_ASSESSOR: ['assessedValue', 'buildingArea', 'yearBuilt', 'owner', 'apn'],
  PUBLIC_TAX: ['propertyTax'], PUBLIC_ZONING: ['zoning'], RENTCAST: ['marketRent', 'saleRecord'],
  CALCULATED_GEOMETRY: ['lotArea'], FUTURE_PROVIDER: [],
});
export const RELEVANT_DOMAINS: Readonly<Partial<Record<ConsensusSource, readonly ConsensusField[]>>> = Object.freeze({
  PUBLIC_PARCEL_GIS: ['owner', 'assessedValue', 'propertyTax', 'zoning', 'propertyType', 'buildingArea', 'yearBuilt'],
  PUBLIC_ASSESSOR: ['lotArea', 'propertyTax', 'zoning', 'propertyType', 'saleRecord'],
  PUBLIC_TAX: ['owner', 'apn', 'assessedValue'], PUBLIC_ZONING: ['apn', 'propertyType'],
  RENTCAST: ['lotArea', 'apn', 'owner', 'assessedValue', 'propertyTax', 'zoning', 'propertyType', 'buildingArea', 'yearBuilt', 'occupancy', 'currentRent'],
});
export function specialization(source: ConsensusSource, field: ConsensusField, confirmed: boolean, documented: boolean): EvidenceCandidate['specialization'] {
  if (source === 'USER_PROVIDED' && confirmed && documented) return 'SPECIALIZED';
  if (SPECIALIZED_DOMAINS[source].includes(field)) return 'SPECIALIZED';
  if (source === 'USER_PROVIDED') return 'CONTEXTUAL';
  return RELEVANT_DOMAINS[source]?.includes(field) ? 'RELEVANT' : 'UNSPECIFIED';
}
export type ConsensusPolicy = { consistent: number; minor: number; allowOutlierProvisional: boolean };
export const DEFAULT_CONSENSUS_POLICY: Readonly<ConsensusPolicy> = Object.freeze({
  ...AREA_VARIANCE_THRESHOLDS, allowOutlierProvisional: false,
});
