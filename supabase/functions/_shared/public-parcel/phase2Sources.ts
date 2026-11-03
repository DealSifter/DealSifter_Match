import type {ParcelSource} from './types.ts';
import {PHASE2_DECLARATIONS} from './phase2Declarations.ts';

// Every entry is OFF. Per-operation proof is deliberately NOT inferred from
// another county endpoint, a sample polygon, a title, or an HTTP 200 alone.
export const PHASE2_CANDIDATES: readonly ParcelSource[] = PHASE2_DECLARATIONS.map(s => ({
  sourceId:s.sourceId,country:'US',state:s.state,stateFips:s.stateFips,county:s.county,countyFips:s.countyFips,
  coverageCountyFips:s.coverageCountyFips,coverageScope:'PARTIAL_COUNTY',
  providerType:'ARCGIS',serviceUrl:s.url.replace(/\/\d+$/,''),layerId:Number(s.url.match(/\/(\d+)$/)![1]),geometrySupported:true,
  fieldMapping:s.fields,...(s.countyQuery?{countyQuery:s.countyQuery}:{}),
  authorityName:s.authority,authorityUrl:new URL(s.url).origin,licenseStatus:s.licenseStatus,licenseUrl:s.licenseUrl,
  licenseReason:s.licenseStatus==='CLEAR_FOR_USE'?'Dataset-specific public-domain/CC-BY terms or existing reviewed public-use terms retained; see Phase 2 evidence. Attribution and non-survey limitations apply.':'Dataset-specific commercial/cache/redistribution conditions not cleared; unavailable until reviewed.',
  usagePermission:s.licenseStatus==='CLEAR_FOR_USE'?'PUBLIC_DISPLAY_ALLOWED':'REVIEW_REQUIRED',
  acquisitionMode:'LIVE_PUBLIC_GIS',status:'DISABLED',
  statusReason:'Local Phase 2 candidate only; no activation. County list is positive-sample scope, not all parcels. Exact APN, point and viewport capabilities reflect separate controls for this endpoint.',
  lastValidatedAt:'2026-10-20',sourceFreshness:'Actual per-record dates where published. No synthetic current year/freshness; missing dates remain unknown.',
  usageNotes:'Credit the publisher and contributing county. No owner/mailing/taxpayer fields. Recorded legal/GIS areas remain distinct. No market value/ARV from tax data. Missing attributes stay unavailable. Not a boundary survey.',
  capabilities:{subjectLookup:s.pointVerified,neighborLens:s.viewportVerified,apnLookup:s.apnVerified},
  role:'PARCEL_PRIMARY',strengths:['PARCEL_GEOMETRY','APN',...(s.fields.assessorAcres||s.fields.gisAcres||s.fields.lotSqft?['AREA' as const]:[])],
  validation:{authorityVerified:true,schemaValidated:true,geometryQueryValidated:true,apnQueryValidated:s.apnVerified,viewportQueryValidated:s.viewportVerified,
    counties:s.coverageCountyFips,evidencePath:'qa/gis-statewide-expansion-phase2/GIS_SOURCE_REGISTRY_ALL_15.json',countyInventoryEvidencePath:'qa/gis-statewide-expansion-phase2/GIS_COUNTY_COVERAGE_ALL_15.csv'},
}));
