import type { ParcelSource } from './types.ts';

// Audited positive-geometry/APN inventory, not extrapolated from a title.
export const AR_COUNTY_INVENTORY: readonly string[] = ["05001","05003","05005","05007","05009","05011","05013","05015","05017","05019","05021","05023","05025","05027","05029","05031","05033","05035","05037","05039","05041","05043","05045","05047","05049","05051","05053","05055","05057","05059","05061","05063","05065","05067","05069","05071","05073","05075","05077","05079","05081","05083","05085","05087","05089","05091","05093","05095","05097","05099","05101","05103","05105","05107","05109","05111","05113","05115","05117","05119","05121","05123","05125","05127","05129","05131","05133","05135","05137","05139","05141","05143","05145","05147","05149"];

// Manually reviewed P0 sources. Discovery never changes these declarations.
// A county registration is not a promise that every parcel/attribute is present.
export const STRATEGIC_SOURCES: readonly ParcelSource[] = [
  {
    sourceId:'us-oh-ogrip-public-parcels',country:'US',state:'OH',stateFips:'39',county:'Franklin',countyFips:'39049',coverageCountyFips:['39049','39061'],
    providerType:'ARCGIS',serviceUrl:'https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/arcgis/rest/services/OhioStatewidePacels_full_view/FeatureServer',layerId:0,geometrySupported:true,
    fieldMapping:{apn:'StateParcelID',parcelId:'LocalParcelID',situsAddress:'SitusAddressAll'},
    authorityName:'Ohio Geographically Referenced Information Program (OGRIP)',authorityUrl:'https://parcel-resources-geohio.hub.arcgis.com/',
    licenseStatus:'CLEAR_FOR_USE',licenseUrl:'https://www.arcgis.com/home/item.html?id=26ab5fad8d5d4258a7492a14de83bc0e',
    licenseReason:'Dataset-specific OGRIP public view terms explicitly make state geospatial data available for public informational use with as-is disclaimers; no internal-only or commercial-use prohibition is stated.',
    usageNotes:'Attribute Ohio OGRIP and contributing county auditors. Public polygon view only; separate CAMA table is not joined. LandArea unit is not assumed. Not a legal survey.',
    usagePermission:'PUBLIC_DISPLAY_ALLOWED',acquisitionMode:'LIVE_PUBLIC_GIS',capabilities:{subjectLookup:true,neighborLens:true,apnLookup:true},
    role:'PARCEL_PRIMARY',strengths:['PARCEL_GEOMETRY','APN','AREA'],itemId:'26ab5fad8d5d4258a7492a14de83bc0e',
    status:'BROKEN',statusReason:'Public terms and polygon schema passed, but bounded queries failed in Franklin/Hamilton and JSON/county-filter alternatives exceeded the fixed 7.5-second budget. No public activation.',lastValidatedAt:null,sourceFreshness:'Record CurrentTo differs by county; no synthetic update/confidence value.',
  },
  {
    sourceId:'us-ar-agiso-state-parcels',country:'US',state:'AR',stateFips:'05',county:'Pulaski',countyFips:'05119',coverageCountyFips:AR_COUNTY_INVENTORY,coverageScope:'PARTIAL_COUNTY',
    providerType:'ARCGIS',serviceUrl:'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer',layerId:6,geometrySupported:true,
    fieldMapping:{apn:'parcelid',parcelId:'camakey',situsAddress:'adrlabel',ownerName:'ownername',assessedValue:'assessvalue',legalDescription:'parcellgl',subdivision:'subdivision',taxCode:'taxcode'},
    authorityName:'Arkansas GIS Office / county assessors — Cadastral Mapping Program',authorityUrl:'https://gis.arkansas.gov/',
    licenseStatus:'CLEAR_FOR_USE',licenseUrl:'https://gis.arkansas.gov/Metadata/HTML/asdi.Planning_Cadastre.PARCEL_POLYGON_CAMP_export.html',
    licenseReason:'Official polygon metadata explicitly permits cartographic display and utilization in any manner, subject to distribution liability and non-survey limitations.',
    usageNotes:'Credit Arkansas GIS Office and originating county assessor. Counties may have only partial published blocks. AssessValue is separate from total/market value; tax-area/code is not an annual tax amount. Not a boundary survey.',
    usagePermission:'PUBLIC_DISPLAY_ALLOWED',acquisitionMode:'LIVE_PUBLIC_GIS',capabilities:{subjectLookup:true,neighborLens:true,apnLookup:true},
    role:'PARCEL_PRIMARY',strengths:['PARCEL_GEOMETRY','APN','AREA','OWNER','ASSESSMENT'],
    status:'ACTIVE',statusReason:'Public-display terms, layer 6 schema, real point/APN/neighborhood queries in Pulaski and Benton, and positive-geometry/APN inventory across 75 counties passed. Presence is not complete parcel coverage.',lastValidatedAt:'2026-10-13',sourceFreshness:'County CAMADate/PubDate vintages; no statewide current-date assumption.',
    validation:{authorityVerified:true,schemaValidated:true,geometryQueryValidated:true,apnQueryValidated:true,viewportQueryValidated:true,counties:AR_COUNTY_INVENTORY,sampledCountyFips:['05119','05007'],countyInventoryEvidencePath:'qa/public-parcel-intelligence/coverage/county-source-inventories.json',evidencePath:'qa/public-parcel-intelligence/coverage/runtime-source-validation.json'},
  },
  {
    sourceId:'us-ga-johns-creek-public-parcels',country:'US',state:'GA',stateFips:'13',county:'Fulton (Johns Creek subset)',countyFips:'13121',coverageScope:'PARTIAL_COUNTY',
    providerType:'ARCGIS',serviceUrl:'https://services1.arcgis.com/bqfNVPUK3HOnCFmA/arcgis/rest/services/Parcels/FeatureServer',layerId:0,geometrySupported:true,
    fieldMapping:{apn:'ParcelID',parcelId:'GlobalID',situsAddress:'Address',assessorAcres:'LandAcresDeed',ownerName:'Owner',assessedValue:'TotAssess',assessedYear:'TaxYear',zoning:'JCZoning'},
    authorityName:'City of Johns Creek, Georgia / Fulton County assessor',authorityUrl:'https://datahub.johnscreekga.gov/',
    licenseStatus:'CLEAR_FOR_USE',licenseUrl:'https://www.arcgis.com/home/item.html?id=774f52f47ad14a8389af0f851499e4d9',
    licenseReason:'Official City of Johns Creek parcel item explicitly licenses the dataset under CC-BY-4.0, including commercial reuse with attribution.',
    usageNotes:'CC-BY-4.0; credit City of Johns Creek and Fulton County. Coverage is the city subset, not all Fulton County. Assessed and appraised values are distinct; no private mailing/contact fields are mapped. Not a survey.',
    usagePermission:'PUBLIC_DISPLAY_ALLOWED',acquisitionMode:'LIVE_PUBLIC_GIS',capabilities:{subjectLookup:true,neighborLens:true,apnLookup:true},
    role:'SECONDARY_PARCEL',strengths:['PARCEL_GEOMETRY','APN','AREA','OWNER','ASSESSMENT','ZONING'],itemId:'774f52f47ad14a8389af0f851499e4d9',
    status:'ACTIVE',statusReason:'Official city authority, CC-BY terms, polygon schema and real point/APN/neighborhood queries passed. Only the Johns Creek subset is covered, not countywide.',lastValidatedAt:'2026-10-13',sourceFreshness:'Published editing timestamp and tax-roll year when supplied.',
    validation:{authorityVerified:true,schemaValidated:true,geometryQueryValidated:true,apnQueryValidated:true,viewportQueryValidated:true,counties:['13121'],sampledCountyFips:['13121'],evidencePath:'qa/public-parcel-intelligence/coverage/runtime-source-validation.json'},
  },
];
