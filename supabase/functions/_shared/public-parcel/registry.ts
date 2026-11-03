import type { ParcelSource } from './types.ts';
import { EXPANSION_SOURCES } from './sources.ts';
import { STRATEGIC_SOURCES } from './strategicSources.ts';
import { STATEWIDE_CANDIDATES } from './statewideSources.ts';
import { PHASE2_CANDIDATES } from './phase2Sources.ts';
import { PRIORITY_NC_COUNTIES, PRIORITY_MA_POINT_COUNTIES } from './priorityCoverage.ts';
import { SUBJECT_FL_COUNTIES, SUBJECT_NC_COUNTIES } from './subjectCoverage.ts';
import { REQUESTED_STATES_SOURCES } from './requestedStatesSources.ts';
import { MUNICIPAL_EXPANSION_SOURCES } from './municipalExpansionSources.ts';

// Configuration only. Discovery cannot modify this registry or activate a source.
export const PARCEL_SOURCES: readonly ParcelSource[] = Object.freeze([
  ...MUNICIPAL_EXPANSION_SOURCES,
  ...REQUESTED_STATES_SOURCES,
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
    usagePermission: 'PUBLIC_DISPLAY_ALLOWED', acquisitionMode: 'LIVE_PUBLIC_GIS', capabilities: { subjectLookup: true, neighborLens: true, apnLookup: true },
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
  ...EXPANSION_SOURCES.filter(source => source.sourceId === 'us-ma-massgis-parcels').map(source => ({
    ...source, sourceId: 'us-ma-massgis-point-expansion', county: 'Barnstable', countyFips: '25001',
    coverageCountyFips: [...PRIORITY_MA_POINT_COUNTIES], coverageScope: 'PARTIAL_COUNTY' as const,
    capabilities: { subjectLookup: true, neighborLens: true, apnLookup: false },
    preferredQueryFormat: 'json' as const, lastValidatedAt: '2026-10-22',
    statusReason: 'Ten additional counties passed bounded point and viewport controls. APN-only lookup is deliberately disabled because statewide LOC_ID queries exceeded the existing timeout. Essex and Hampshire excluded. Partial parcel coverage.',
    validation: { ...source.validation!, apnQueryValidated: false, counties: [...PRIORITY_MA_POINT_COUNTIES], sampledCountyFips: [...PRIORITY_MA_POINT_COUNTIES], evidencePath: 'qa/gis-priority-expansion-release/MA_POINT_RESULTS.json' },
  })),
  ...STRATEGIC_SOURCES,
  ...STATEWIDE_CANDIDATES.filter(source => source.sourceId === 'us-nc-nconemap-statewide-candidate').map(source => ({
    ...source, sourceId: 'us-nc-nconemap-apn-priority', status: 'ACTIVE' as const,
    county: 'Bertie', countyFips: '37015', coverageCountyFips: [...SUBJECT_NC_COUNTIES],
    capabilities: { subjectLookup: false, apnLookup: true, neighborLens: false },
    preferredQueryFormat: 'json' as const, defaultLookupGeometry: true, lastValidatedAt: '2026-10-22',
    statusReason: 'Exact county-bound APN and polygon verified. Point ambiguity/truncation is not bypassed; point and neighborhood operations remain disabled in this additional scope.',
    validation: { ...source.validation!, viewportQueryValidated: false, counties: [...SUBJECT_NC_COUNTIES], sampledCountyFips: [...SUBJECT_NC_COUNTIES], evidencePath: 'qa/gis-subject-first-release/CONTRACT_RESULTS.json' },
  })),
  // Approved bounded rollout: only counties with saved APN + interior-point +
  // viewport proof. This is partial parcel coverage, never a statewide promise.
  ...STATEWIDE_CANDIDATES.map(source => source.sourceId === 'us-nc-nconemap-statewide-candidate' ? {
    ...source, status: 'ACTIVE' as const, countyFips: '37183', coverageCountyFips: [...PRIORITY_NC_COUNTIES],
    lastValidatedAt: '2026-10-22',
    statusReason: 'Prior scope preserved; 61 additional counties passed bounded county-bound APN and interior-point checks using the existing statewide schema and viewport contract. Failed or unproven controls remain excluded. Not universal parcel coverage.',
    validation: source.validation ? { ...source.validation, counties: [...PRIORITY_NC_COUNTIES], sampledCountyFips: [...PRIORITY_NC_COUNTIES], evidencePath: 'qa/gis-priority-expansion-release/LIVE_RESULTS.json' } : undefined,
  } : source.sourceId === 'us-fl-fgio-statewide-candidate' ? {
    ...source, status: 'ACTIVE' as const, coverageCountyFips: [...SUBJECT_FL_COUNTIES],
    licenseStatus: 'CLEAR_FOR_USE' as const, usagePermission: 'PUBLIC_DISPLAY_ALLOWED' as const,
    licenseReason: 'Reviewed 2026-10-22: official FloridaGIO portal explicitly permits anyone to use its open data at no cost and offers this specific 2026 DOR parcel dataset as a web feature service. Specific item terms contain accuracy/public-record and non-survey disclaimers, not a conflicting use restriction. Limited property lookup/display, with DOR and county attribution; no bulk owner-data export.',
    capabilities: { subjectLookup: false, apnLookup: true, neighborLens: false },
    preferredQueryFormat: 'json' as const, defaultLookupGeometry: true, apnNormalization: 'REMOVE_SEPARATORS' as const, lastValidatedAt: '2026-10-22',
    statusReason: 'All 67 Florida counties have bounded unique APN/original-polygon proof. Literal asterisks in official APNs are preserved, not interpreted as wildcards. Separator variants reuse existing exact/normalized lookup. Point and neighborhood queries remain disabled; ambiguous individual APNs are not selected or merged.',
    validation: { ...source.validation!, viewportQueryValidated: false, counties: [...SUBJECT_FL_COUNTIES], sampledCountyFips: [...SUBJECT_FL_COUNTIES], evidencePath: 'qa/gis-florida-completion/CONTRACT_RESULTS.json' },
  } : source),
  ...PHASE2_CANDIDATES.map(source => ['us-mn-mn-metro-washington-phase2-candidate','us-ut-ut-49001-phase2-candidate','us-ut-ut-49003-phase2-candidate'].includes(source.sourceId) ? {
    ...source, status: 'ACTIVE' as const, lastValidatedAt: '2026-10-22',
    ...(source.sourceId === 'us-mn-mn-metro-washington-phase2-candidate' ? { preferredQueryFormat: 'json' as const } : {}),
    capabilities: { subjectLookup: true, neighborLens: true, apnLookup: true },
    statusReason: 'Approved Washington MN / Beaver UT / Box Elder UT only. Dataset-specific terms rechecked and bounded APN/interior-point/viewport controls passed. Partial parcel coverage, not state coverage.',
    validation: source.validation ? { ...source.validation, apnQueryValidated: true, geometryQueryValidated: true, viewportQueryValidated: true, evidencePath: 'qa/gis-coverage-expansion-release/LIVE_RESULTS.json' } : undefined,
  } : source),
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
  if (source.capabilities?.apnLookup !== false && (!proof?.apnQueryValidated || !source.fieldMapping.apn)) blockers.push('APN_NOT_VALIDATED');
  if (source.capabilities?.neighborLens !== false && !proof?.viewportQueryValidated) blockers.push('VIEWPORT_NOT_VALIDATED');
  if (!source.lastValidatedAt || !proof?.evidencePath) blockers.push('VALIDATION_EVIDENCE_REQUIRED');
  if ([source.countyFips, ...(source.coverageCountyFips || [])].some(fips => !proof?.counties.includes(fips))) blockers.push('COVERAGE_NOT_VALIDATED');
  return blockers;
}
export const productionSourceAllowed = (source: ParcelSource) => source.status === 'ACTIVE' && source.usagePermission === 'PUBLIC_DISPLAY_ALLOWED' && activationBlockers(source).length === 0;
export function normalizeCountyFips(county: unknown, state?: unknown) {
  const value = String(county ?? '').trim(); const prefix = String(state ?? '').trim();
  if (/^\d{5}$/.test(value)) return /^\d{2}$/.test(prefix) && !value.startsWith(prefix) ? null : value;
  return /^\d{3}$/.test(value) && /^\d{2}$/.test(prefix) ? prefix + value : null;
}
export class ParcelSourceRegistry {
  constructor(readonly sources: readonly ParcelSource[] = PARCEL_SOURCES, readonly disabledSourceIds: readonly string[] = []) {}
  forCounty(fips: string, diagnostics = false) {
    return this.sources.filter(source => !this.disabledSourceIds.includes(source.sourceId)
      && (source.countyFips === fips || source.coverageCountyFips?.includes(fips)) && (productionSourceAllowed(source)
      || diagnostics && !['DISABLED', 'BROKEN'].includes(source.status)))
      .map(source => {
        // Existing AR registration predates county-bound APN queries. The saved
        // Phase 2 schema uses FIPS3, not FIPS5; never let repeated local APNs
        // query the entire state. Keep the 17 reviewed declarations unchanged.
        const countyQuery = source.countyQuery ?? (source.sourceId === 'us-ar-agiso-state-parcels'
          ? { field: 'countyfips', codes: Object.fromEntries([source.countyFips, ...source.coverageCountyFips ?? []].map(code => [code, code.slice(2)])) } : undefined);
        return countyQuery ? { ...source, countyQuery, queryCountyFips: fips } : source;
      });
  }
}
export function approvedLayerUrl(source: ParcelSource, origins: readonly string[] = PARCEL_APPROVED_ORIGINS) {
  const url = new URL(source.serviceUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !origins.includes(url.origin)
    || !/\/(?:FeatureServer|MapServer)$/.test(url.pathname) || !Number.isInteger(source.layerId) || source.layerId < 0) throw new Error('UNAPPROVED_SOURCE_URL');
  return `${url.href.replace(/\/$/, '')}/${source.layerId}`;
}
