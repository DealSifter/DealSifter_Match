import type { ParcelSource } from './types.ts';
import { EXPANSION_SOURCES } from './sources.ts';

// Configuration only. Discovery cannot modify this registry or activate a source.
export const PARCEL_SOURCES: readonly ParcelSource[] = Object.freeze([
  {
    sourceId: 'us-al-jefferson-parcels', country: 'US', state: 'AL', stateFips: '01', county: 'Jefferson', countyFips: '01073', providerType: 'ARCGIS',
    statusReason: 'Backend receives HTTP 403 HTML from an Imperva/Incapsula gateway; usable public runtime not established.', licenseReason: 'Catalog disclaimer does not resolve commercial data redistribution terms.', role: 'PARCEL_PRIMARY',
    serviceUrl: 'https://jccgis.jccal.org/server/rest/services/Basemap/Parcels/MapServer', layerId: 0, geometrySupported: true,
    fieldMapping: { apn: 'APP_PID', parcelId: 'PARCELID', situsAddress: 'ADDR_APR', ownerName: 'OWNERNAME', assessorAcres: 'ACRES_APR', gisAcres: 'GIS_ACRES', legalDescription: 'Legal_Desc', subdivision: 'SUBDIV_NAME' },
    authorityName: 'Jefferson County Commission — GIS Division', authorityUrl: 'https://www.jccal.org/484/Enterprise-GIS',
    licenseStatus: 'LICENSE_REVIEW_REQUIRED', licenseUrl: 'https://www.arcgis.com/home/item.html?id=02545b1e80ef45b4a39be8bc12cd43fa',
    usageNotes: 'Official catalog says no use limitations; commercial redistribution must be reconciled with county data-license terms. Not a survey. Direct endpoint returned HTTP 403 during diagnostics.',
    lastValidatedAt: null, sourceFreshness: 'Nightly publication stated by layer metadata; actual timestamp unavailable', status: 'LICENSE_REVIEW_REQUIRED', itemId: '02545b1e80ef45b4a39be8bc12cd43fa',
  },
  {
    sourceId: 'us-nc-wake-parcels', country: 'US', state: 'NC', stateFips: '37', county: 'Wake', countyFips: '37183', providerType: 'ARCGIS',
    statusReason: 'Original endpoint timed out; license alone cannot validate geometry and provisional fields.', licenseReason: 'Official Wake County item explicitly specifies CC-BY-4.0; attribution required.', role: 'PARCEL_PRIMARY',
    serviceUrl: 'https://maps.wake.gov/arcgis/rest/services/Property/Parcels/MapServer', layerId: 0, geometrySupported: true,
    fieldMapping: { apn: 'PIN_NUM', parcelId: 'REID', situsAddress: 'SITE_ADDRESS', assessorAcres: 'DEED_ACRES', ownerName: 'OWNER', assessedValue: 'TOTAL_VALUE' },
    authorityName: 'Wake County Geographic Information Services', authorityUrl: 'https://data.wake.gov/',
    licenseStatus: 'CLEAR_FOR_USE', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    usageNotes: 'Official item f5ed009c66e844ec82f29064edd95017 states CC-BY-4.0. Attribution required, not a legal document. Schema mapping remains provisional until live inspection passes.',
    lastValidatedAt: null, sourceFreshness: 'End of business day according to authority; retain actual timestamps separately', status: 'DISCOVERED', itemId: 'f5ed009c66e844ec82f29064edd95017',
  },
  {
    sourceId: 'us-wa-king-parcels', country: 'US', state: 'WA', stateFips: '53', county: 'King', countyFips: '53033', providerType: 'ARCGIS',
    statusReason: 'Point/APN technical validation passed; resale restriction remains unresolved.', licenseReason: 'Copy/distribution permission includes a resale restriction; commercial product review required.', role: 'PARCEL_PRIMARY',
    serviceUrl: 'https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_Parcels/MapServer', layerId: 0, geometrySupported: true,
    fieldMapping: { apn: 'PIN' }, authorityName: 'King County GIS Center', authorityUrl: 'https://kingcounty.gov/services/gis.aspx',
    licenseStatus: 'LICENSE_REVIEW_REQUIRED', licenseUrl: 'https://kingcounty.gov/en/legacy/services/gis/Maps/terms-of-use.aspx',
    usageNotes: 'Copy/distribution permissions have a resale restriction. Commercial use in this product requires review. Layer exposes PIN, not owner/assessment/tax. Not a survey.',
    lastValidatedAt: '2026-10-12', sourceFreshness: 'Source update timestamp queried from metadata, not inferred', status: 'LICENSE_REVIEW_REQUIRED',
  },
  {
    sourceId: 'us-ut-salt-lake-parcels', country: 'US', state: 'UT', stateFips: '49', county: 'Salt Lake', countyFips: '49035', providerType: 'ARCGIS',
    statusReason: 'Specific LIR CC-BY-4.0 terms verified; official schema and real point/APN/viewport validation passed. Internal validation only.', licenseReason: 'Specific official LIR item 6f900727e16d4ce1a83f2a1ec1d82e60 explicitly licenses this dataset under CC-BY-4.0; attribution required.', role: 'PARCEL_PRIMARY',
    strengths: ['PARCEL_GEOMETRY', 'APN', 'AREA'], validation: { authorityVerified: true, schemaValidated: true, geometryQueryValidated: true, apnQueryValidated: true, viewportQueryValidated: true, counties: ['49035'], evidencePath: 'qa/public-parcel-intelligence/phase1b-source-inspection.json' },
    serviceUrl: 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/Parcels_SaltLake_LIR/FeatureServer', layerId: 0, geometrySupported: true,
    fieldMapping: { apn: 'PARCEL_ID', situsAddress: 'PARCEL_ADD', assessorAcres: 'PARCEL_ACRES', taxCode: 'TAX_DISTRICT', subdivision: 'SUBDIV_NAME' },
    authorityName: 'Utah Geospatial Resource Center / Salt Lake County', authorityUrl: 'https://gis.utah.gov/products/sgid/cadastre/parcels/',
    licenseStatus: 'CLEAR_FOR_USE', licenseUrl: 'https://www.arcgis.com/home/item.html?id=6f900727e16d4ce1a83f2a1ec1d82e60',
    usageNotes: 'CC-BY-4.0: attribute Utah UGRC and Salt Lake County. Not a survey. Market-value fields are deliberately not mapped to assessed value.',
    lastValidatedAt: '2026-10-12', sourceFreshness: 'Source editing timestamp, where published', status: 'ACTIVE', itemId: '6f900727e16d4ce1a83f2a1ec1d82e60',
  },
  {
    sourceId: 'us-ca-sonoma-parcels', country: 'US', state: 'CA', stateFips: '06', county: 'Sonoma', countyFips: '06097', providerType: 'ARCGIS',
    statusReason: 'Technical queries passed; public/internal attribute conditions remain unresolved.', licenseReason: 'Public reachability is not a redistribution license.', role: 'PARCEL_PRIMARY',
    serviceUrl: 'https://socogis.sonomacounty.ca.gov/map/rest/services/CRAPublic/ParcelsPublic/FeatureServer', layerId: 0, geometrySupported: true,
    fieldMapping: { apn: 'APN', assessorAcres: 'LandSizeAcres', lotSqft: 'LandSizeSqft', situsAddress: 'SitusFormatted1', assessedValue: 'Value601NetValue', assessedYear: 'Value601RollYear', taxCode: 'TaxRateArea' }, authorityName: 'County of Sonoma — GIS / Clerk-Recorder-Assessor', authorityUrl: 'https://gis.sonomacounty.gov/',
    licenseStatus: 'LICENSE_REVIEW_REQUIRED', licenseUrl: 'https://gis.sonomacounty.gov/',
    usageNotes: 'Public versus internal-use-only attributes require explicit review. Do not infer a redistribution license from endpoint reachability.',
    lastValidatedAt: '2026-10-12', sourceFreshness: 'Source editing timestamp, where published', status: 'LICENSE_REVIEW_REQUIRED',
  },
  ...EXPANSION_SOURCES,
]);
export const PARCEL_APPROVED_ORIGINS = Object.freeze([...new Set(PARCEL_SOURCES.map(source => new URL(source.serviceUrl).origin))]);
export const licenseCleared = (source: ParcelSource) => ['APPROVED', 'CLEAR_FOR_USE'].includes(source.licenseStatus);
export function activationBlockers(source: ParcelSource) {
  const proof = source.validation;
  const blockers: string[] = [];
  if (!licenseCleared(source)) blockers.push('LICENSE_NOT_CLEARED');
  if (!source.licenseReason.trim()) blockers.push('LICENSE_REASON_REQUIRED');
  if (!proof?.authorityVerified) blockers.push('AUTHORITY_NOT_VERIFIED');
  if (!proof?.schemaValidated) blockers.push('SCHEMA_NOT_VALIDATED');
  if (!source.geometrySupported || !proof?.geometryQueryValidated) blockers.push('GEOMETRY_NOT_VALIDATED');
  if (!proof?.apnQueryValidated || !source.fieldMapping.apn) blockers.push('APN_NOT_VALIDATED');
  if (!proof?.viewportQueryValidated) blockers.push('VIEWPORT_NOT_VALIDATED');
  if (!source.lastValidatedAt || !proof?.evidencePath) blockers.push('VALIDATION_EVIDENCE_REQUIRED');
  if ([source.countyFips, ...(source.coverageCountyFips || [])].some(fips => !proof?.counties.includes(fips))) blockers.push('COVERAGE_NOT_VALIDATED');
  return blockers;
}
export const productionSourceAllowed = (source: ParcelSource) => source.status === 'ACTIVE' && activationBlockers(source).length === 0;
export function normalizeCountyFips(county: unknown, state?: unknown) {
  const value = String(county ?? '').trim(); const prefix = String(state ?? '').trim();
  if (/^\d{5}$/.test(value)) return /^\d{2}$/.test(prefix) && !value.startsWith(prefix) ? null : value;
  return /^\d{3}$/.test(value) && /^\d{2}$/.test(prefix) ? prefix + value : null;
}
export class ParcelSourceRegistry {
  constructor(readonly sources: readonly ParcelSource[] = PARCEL_SOURCES) {}
  forCounty(fips: string, diagnostics = false) {
    return this.sources.filter(source => (source.countyFips === fips || source.coverageCountyFips?.includes(fips)) && (productionSourceAllowed(source)
      || diagnostics && !['DISABLED', 'BROKEN'].includes(source.status)));
  }
}
export function approvedLayerUrl(source: ParcelSource, origins: readonly string[] = PARCEL_APPROVED_ORIGINS) {
  const url = new URL(source.serviceUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !origins.includes(url.origin)
    || !/\/(?:FeatureServer|MapServer)$/.test(url.pathname) || !Number.isInteger(source.layerId) || source.layerId < 0) throw new Error('UNAPPROVED_SOURCE_URL');
  return `${url.href.replace(/\/$/, '')}/${source.layerId}`;
}
