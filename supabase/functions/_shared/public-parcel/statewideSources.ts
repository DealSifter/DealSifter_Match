import type {ParcelSource} from './types.ts';
import {STATEWIDE_VERIFIED_COUNTIES,FL_DOR_COUNTY_CODES} from './statewideCoverage.ts';

// LOCAL review candidates only. The auditor cannot promote these declarations.
// Existing active registrations are preserved; no statewide activation by a title.
export const STATEWIDE_CANDIDATES: readonly ParcelSource[] = [
  {
    sourceId:'us-fl-fgio-statewide-candidate',country:'US',state:'FL',stateFips:'12',county:'Polk',countyFips:'12105',
    coverageCountyFips:STATEWIDE_VERIFIED_COUNTIES.FL,coverageScope:'PARTIAL_COUNTY',
    providerType:'ARCGIS',serviceUrl:'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer',layerId:0,geometrySupported:true,
    fieldMapping:{apn:'PARCEL_ID',parcelId:'PARCELNO',situsAddress:'PHY_ADDR1',lotSqft:'LND_SQFOOT',buildingArea:'TOT_LVG_AR',yearBuilt:'ACT_YR_BLT',assessedYear:'ASMNT_YR'},
    countyQuery:{field:'CO_NO',codes:FL_DOR_COUNTY_CODES},situsMapping:{street:'PHY_ADDR1',city:'PHY_CITY',zip:'PHY_ZIPCD'},
    defaultLookupGeometry:false,
    authorityName:'FloridaGIO / Florida DOR / contributing county property appraisers',authorityUrl:'https://geodata.floridagio.gov/',
    licenseStatus:'LICENSE_REVIEW_REQUIRED',licenseUrl:'https://geodata.floridagio.gov/datasets/efa909d6b1c841d298b0a649e7f71cf2_0/about',
    licenseReason:'Prior engineering review cleared internal use only; this audit does not establish additional public redistribution permission. Re-read official item disclaimer and retain originating county attribution.',
    usagePermission:'REVIEW_REQUIRED',acquisitionMode:'LIVE_PUBLIC_GIS',capabilities:{subjectLookup:true,neighborLens:false,apnLookup:true},
    status:'DISABLED',statusReason:'Local-only candidate: 62 county samples passed; 5 timed out. Viewport exceeded 7.5s budget. Separate candidate preserves legacy BROKEN registration; no timeout increase or automatic activation.',
    lastValidatedAt:'2026-10-20',sourceFreshness:'2026 export stated by official publisher; per-record ASMNT_YR is fiscal year, not survey/current geometry confirmation.',
    usageNotes:'No owner/mailing fields. LND_SQFOOT/TOT_LVG_AR are sqft. JV/AV_SD/AV_NSD/TAX_AUTH_C are deliberately NOT mapped to market value, ARV or annual tax. Polk situs omits Wahneta; do not auto-correct address. Non-survey dataset.',
    itemId:'efa909d6b1c841d298b0a649e7f71cf2',role:'PARCEL_PRIMARY',strengths:['PARCEL_GEOMETRY','APN','AREA'],
    validation:{authorityVerified:true,schemaValidated:true,geometryQueryValidated:true,apnQueryValidated:true,viewportQueryValidated:false,counties:STATEWIDE_VERIFIED_COUNTIES.FL,sampledCountyFips:['12001','12005','12105'],evidencePath:'qa/gis-statewide-expansion/REAL_CONTROLS.json',countyInventoryEvidencePath:'qa/gis-statewide-expansion/GIS_SOURCE_REGISTRY.json'},
  },
  {
    sourceId:'us-nc-nconemap-statewide-candidate',country:'US',state:'NC',stateFips:'37',county:'Wake',countyFips:'37183',
    coverageCountyFips:STATEWIDE_VERIFIED_COUNTIES.NC,coverageScope:'PARTIAL_COUNTY',
    providerType:'ARCGIS',serviceUrl:'https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer',layerId:1,geometrySupported:true,
    fieldMapping:{apn:'parno',parcelId:'nparno',situsAddress:'siteadd',gisAcres:'gisacres'},
    countyQuery:{field:'stcntyfips'},situsMapping:{street:'siteadd',city:'scity',zip:'szip'},
    authorityName:'NC OneMap / NC Center for Geographic Information and Analysis / county data producers',authorityUrl:'https://www.nconemap.gov/pages/parcels',
    licenseStatus:'CLEAR_FOR_USE',licenseUrl:'https://www.nconemap.gov/pages/terms',
    licenseReason:'Official NC OneMap Terms item e60514c3b78542ef9902e3d7f7a671c1 re-read 2026-10-20: free unrestricted use; written releases not required. Attribution and no-warranty conditions retained.',
    usagePermission:'PUBLIC_DISPLAY_ALLOWED',acquisitionMode:'LIVE_PUBLIC_GIS',capabilities:{subjectLookup:true,neighborLens:true,apnLookup:true},
    status:'DISABLED',statusReason:'Prepared for local review only: 99 county-bound APN/polygon samples, Wake/Buncombe exact APN + point + bbox controls. Swain excluded. Existing two-county NC registration remains unchanged; this candidate is NOT activated.',
    lastValidatedAt:'2026-10-20',sourceFreshness:'Record-level source/transform/revision dates vary; missing/sentinel dates are not proof of current data.',
    usageNotes:'Credit NC OneMap, NCDIT/CGIA and county producers. No owner/mailing fields requested. recareano has variable recareatx units; not mapped. parvaltype varies Market/Assessed/Taxable, so parval is not blindly promoted to assessment/AVM/ARV. Not a survey.',
    itemId:'1de3d7d828ce4813b838ddf055b40317',role:'PARCEL_PRIMARY',strengths:['PARCEL_GEOMETRY','APN','AREA'],
    validation:{authorityVerified:true,schemaValidated:true,geometryQueryValidated:true,apnQueryValidated:true,viewportQueryValidated:true,counties:STATEWIDE_VERIFIED_COUNTIES.NC,sampledCountyFips:['37183','37021'],evidencePath:'qa/gis-statewide-expansion/REAL_CONTROLS.json',countyInventoryEvidencePath:'qa/gis-statewide-expansion/GIS_SOURCE_REGISTRY.json'},
  },
];
// Texas is intentionally absent: metadata claims Query, but bounded real requests
// return ArcGIS 400 UNSUPPORTED. Download candidates remain artifacts, not providers.
