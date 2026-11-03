import type {ParcelSource} from './types.ts';

// Deliberately bounded pilots. These are not declarations of statewide coverage.
// No neighborhood capability; existing identity, containment and runtime gates stay intact.
const proof=(counties:readonly string[],apn:boolean)=>({authorityVerified:true,schemaValidated:true,geometryQueryValidated:true,apnQueryValidated:apn,viewportQueryValidated:false,counties,sampledCountyFips:counties,evidencePath:'qa/gis-requested-states/SAMPLES.json + REMAINING.json'});
export const REQUESTED_STATES_SOURCES:readonly ParcelSource[]=[
 {
  sourceId:'us-vt-burlington-vcgi-parcels',country:'US',state:'VT',stateFips:'50',county:'Chittenden — Burlington only',countyFips:'50007',
  providerType:'ARCGIS',serviceUrl:'https://services1.arcgis.com/BkFxaEFNwHqX3tAw/arcgis/rest/services/FS_VCGI_VTPARCELS_WM_NOCACHE_v2/FeatureServer',layerId:1,geometrySupported:true,
  fieldMapping:{apn:'SPAN',parcelId:'SPAN'},countyQuery:{field:'TOWN',codes:{'50007':'BURLINGTON'}},
  authorityName:'Vermont Center for Geographic Information',authorityUrl:'https://vcgi.vermont.gov/data-and-programs/parcel-program',
  status:'ACTIVE',licenseStatus:'CLEAR_FOR_USE',usagePermission:'PUBLIC_DISPLAY_ALLOWED',licenseUrl:'https://vcgi.vermont.gov/resources/frequently-asked-questions/parcel-program-faqs',
  licenseReason:'Official Parcel Program offers parcel data and services for web/desktop applications. Specific official item 684874ccc2544544b66ec6fd3c15b171 publishes the State disclaimer; retain attribution, no warranty and no survey claim.',
  statusReason:'Exact SPAN plus Burlington returned one active-layer polygon without truncation. APN-only local candidate; no inactive layer or unvalidated municipality is enabled.',
  role:'SECONDARY_PARCEL',strengths:['PARCEL_GEOMETRY','APN'],coverageScope:'PARTIAL_COUNTY',acquisitionMode:'LIVE_PUBLIC_GIS',
  capabilities:{subjectLookup:false,apnLookup:true,neighborLens:false},preferredQueryFormat:'json',defaultLookupGeometry:true,
  lastValidatedAt:'2026-10-23',sourceFreshness:'Sample GIS YEAR 2025; SOURCEDATE 20250922. Service edit date is not a parcel refresh or Grand List verification.',
  usageNotes:'Only Burlington in Chittenden. SPAN is the official statewide parcel identifier, not inferred from geometry. Null SPAN remains unavailable. No owner, mailing, Grand List private data or fabricated situs/area. Attribution: VCGI / municipality; not a survey.',validation:proof(['50007'],true),
 },
 {
  sourceId:'us-ct-hartford-opm-parcels',country:'US',state:'CT',stateFips:'09',county:'Capitol Planning Region — Hartford only',countyFips:'09110',
  providerType:'ARCGIS',serviceUrl:'https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/ArcGIS/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer',layerId:0,geometrySupported:true,
  fieldMapping:{apn:'Parcel_ID',parcelId:'Link',assessorAcres:'Land_Acres'},countyQuery:{field:'Town_Name',codes:{'09110':'Hartford'}},
  authorityName:'Connecticut OPM GIS Office',authorityUrl:'https://portal.ct.gov/datapolicy/home/gis-office/parcel-and-cama',
  status:'ACTIVE',licenseStatus:'CLEAR_FOR_USE',usagePermission:'PUBLIC_DISPLAY_ALLOWED',licenseUrl:'https://services3.arcgis.com/3FL1kr7L4LvwA2Kb/ArcGIS/rest/services/Connecticut_CAMA_and_Parcel_Layer/FeatureServer',
  licenseReason:'Official OPM service explicitly classifies dataset as Authoritative, Public and Public Use. Retain State/municipality attribution, variable accuracy/completeness and no legal boundary warranty.',
  statusReason:'Hartford point and exact Parcel_ID constrained by Town_Name each returned one polygon without truncation. Only current county-equivalent 09110; legacy FIPS prefix in feature is not reinterpreted as a current region.',
  role:'SECONDARY_PARCEL',strengths:['PARCEL_GEOMETRY','APN','AREA'],coverageScope:'PARTIAL_COUNTY',acquisitionMode:'LIVE_PUBLIC_GIS',
  capabilities:{subjectLookup:true,apnLookup:true,neighborLens:false},preferredQueryFormat:'json',defaultLookupGeometry:true,
  lastValidatedAt:'2026-10-23',sourceFreshness:'Sample Parcel_Collection_Year 2026; town collection date is not a live assessor confirmation.',
  usageNotes:'Hartford only, not all Capitol or CT. Parcel_ID is the official service identifier; no reconstruction of local IDs. Malformed ZIP 6106.0 and missing Location in sample are deliberately NOT mapped or repaired. No ownership, mailing or automatic postal conflict evidence. Legacy county 09003 is not silently aliased. Attribution: CT OPM / municipality; not a survey.',validation:proof(['09110'],true),
 },
 {
  sourceId:'us-nd-burleigh-ndgishub-parcels',country:'US',state:'ND',stateFips:'38',county:'Burleigh',countyFips:'38015',
  providerType:'ARCGIS',serviceUrl:'https://services1.arcgis.com/GOcSXpzwBHyk2nog/arcgis/rest/services/NDGISHUB_Parcels/FeatureServer',layerId:0,geometrySupported:true,
  fieldMapping:{parcelId:'UniqueGISID',gisAcres:'CalculatedAcres'},countyQuery:{field:'CountyFIPS',codes:{'38015':'38015'}},
  authorityName:'North Dakota GIS Hub',authorityUrl:'https://www.gis.nd.gov/',status:'SCHEMA_VALIDATED',licenseStatus:'CLEAR_FOR_USE',usagePermission:'PUBLIC_DISPLAY_ALLOWED',
  licenseUrl:'https://www.arcgis.com/home/item.html?id=ac6da1176038457db16e8debe3f1abaf',
  licenseReason:'Official State Parcel Program publicly disseminates parcel data; item terms provide no warranty, variable currency and no legal boundary/survey claim. Retain State/county attribution.',
  statusReason:'One Burleigh point polygon obtained. GISID/UniqueGISID are NOT promoted to tax APN. FeatureType was null; parcel-class and taxroll linkage review remains pending, so source is not ACTIVE.',
  role:'SECONDARY_PARCEL',strengths:['PARCEL_GEOMETRY','AREA'],coverageScope:'PARTIAL_COUNTY',acquisitionMode:'LIVE_PUBLIC_GIS',
  capabilities:{subjectLookup:true,apnLookup:false,neighborLens:false},preferredQueryFormat:'json',defaultLookupGeometry:true,
  lastValidatedAt:'2026-10-23',sourceFreshness:'Sample SourceDate and LastUpdateDate null; layer edit timestamp does not make parcel current.',
  usageNotes:'No APN, situs or owner inferred. CalculatedAcres stays GIS area, never assessor acreage. No statewide coverage claimed. Attribution: ND GIS Hub / county; not a survey.',validation:proof(['38015'],false),
 },
];
