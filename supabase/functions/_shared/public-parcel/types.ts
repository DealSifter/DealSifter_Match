export type SourceStatus = 'DISCOVERED' | 'SCHEMA_VALIDATED' | 'AUTHORITY_VALIDATED' | 'LICENSE_REVIEW_REQUIRED' | 'ACTIVE' | 'DISABLED' | 'BROKEN';
export type LicenseStatus = 'APPROVED' | 'CLEAR_FOR_USE' | 'LICENSE_REVIEW_REQUIRED' | 'UNKNOWN' | 'UNVERIFIED';
export type SourceRole = 'PARCEL_PRIMARY' | 'ASSESSMENT' | 'TAX' | 'ZONING' | 'SECONDARY_PARCEL';
export type SourceStrength = 'PARCEL_GEOMETRY' | 'APN' | 'AREA' | 'OWNER' | 'ASSESSMENT' | 'TAX' | 'ZONING';
export type ParcelField = 'apn' | 'parcelId' | 'situsAddress' | 'assessorAcres' | 'gisAcres' | 'lotSqft' | 'ownerName' | 'assessedValue' | 'assessedYear' | 'propertyTax' | 'propertyTaxYear' | 'taxCode' | 'zoning' | 'legalDescription' | 'subdivision';
export type Point = { lat: number; lng: number };
export type Bounds = [number, number, number, number];
export type ParcelGeometry = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
export type ParcelSource = Readonly<{
  sourceId: string; country: 'US'; state: string; stateFips: string; county: string; countyFips: string;
  providerType: string; serviceUrl: string; layerId: number; geometrySupported: boolean;
  fieldMapping: Partial<Record<ParcelField, string>>; authorityName: string; authorityUrl: string;
  licenseStatus: LicenseStatus; licenseUrl: string; usageNotes: string; lastValidatedAt: string | null;
  sourceFreshness: string; status: SourceStatus; itemId?: string; apnNormalization?: 'EXACT' | 'REMOVE_SEPARATORS';
  statusReason: string; licenseReason: string; role?: SourceRole; strengths?: readonly SourceStrength[];
  coverageCountyFips?: readonly string[];
  // Some authorities publish mixed area units in a companion field. Never assume acres.
  areaMapping?: { valueField: string; unitField: string };
  validation?: { authorityVerified: boolean; schemaValidated: boolean; geometryQueryValidated: boolean;
    apnQueryValidated: boolean; viewportQueryValidated: boolean; counties: readonly string[]; evidencePath: string };
}>;
export type ParcelEvidence = {
  parcelId: string | null; apn: string | null; geometry: ParcelGeometry | null; situsAddress: string | null;
  lotSqft: number | null; acres: number | null; assessorAcres: number | null; gisAcres: number | null;
  geometryCalculatedSqft: number | null; geometryCalculatedAcres: number | null;
  ownerName: string | null; assessedValue: number | null; assessedYear: number | null; propertyTax: number | null; propertyTaxYear: number | null;
  taxCode: string | null; zoning: string | null; legalDescription: string | null; subdivision: string | null;
  source: string; sourceAuthority: string; sourceUrl: string; licenseStatus: LicenseStatus; licenseUrl: string; usageNotes: string;
  retrievedAt: string; sourceUpdatedAt: string | null; evidenceStatus: 'PUBLIC_RECORD';
  provenance: Record<string, { value: unknown; source: string; sourceField: string | null; status: 'PUBLIC_RECORD' | 'CALCULATED' | 'UNAVAILABLE' }>;
  areaCrossCheck: { status: 'CONSISTENT' | 'MINOR_VARIANCE' | 'MATERIAL_CONFLICT' | 'NOT_EVALUATED'; relativeDifference: number | null };
};
export type ParcelQuery = { operation: 'resolve' | 'query-point' | 'query-apn' | 'query-bounds' | 'coverage'; point?: Point; bounds?: Bounds; zoom?: number;
  countyFips?: string; stateFips?: string; apn?: string; address?: { address: string; city?: string; state?: string; zip?: string }; signal?: AbortSignal };
export type ProviderResult = { parcels: ParcelEvidence[]; exceededLimit: boolean };
export interface PublicParcelProvider {
  queryByPoint(point: Point, signal?: AbortSignal): Promise<ProviderResult>;
  queryByAPN(apn: string, signal?: AbortSignal): Promise<ProviderResult>;
  queryByAddress?(address: string, signal?: AbortSignal): Promise<ProviderResult>;
  queryByBounds(bounds: Bounds, signal?: AbortSignal): Promise<ProviderResult>;
  getCoverage(): ParcelSource;
}
export type ParcelResult = { status: 'COVERAGE_AVAILABLE' | 'NO_ACTIVE_PUBLIC_SOURCE' | 'SOURCE_TEMPORARILY_UNAVAILABLE' | 'AMBIGUOUS_LOCATION' | 'PARCEL_NOT_FOUND';
  parcels: ParcelEvidence[]; countyFips: string | null; sourceIds: string[]; ambiguity: boolean; exceededLimit: boolean;
  freshness: 'FRESH' | 'STALE_USABLE' | 'UNAVAILABLE'; cacheHit: boolean; expiresAt: string | null; reason?: string };
export const PARCEL_MIN_ZOOM = 16;
export const PARCEL_MAX_RESULTS = 120;
