import type{ParcelSource}from'./types.ts';
import{REQUESTED_STATES_SOURCES}from'./requestedStatesSources.ts';
const vt=REQUESTED_STATES_SOURCES.find(s=>s.sourceId==='us-vt-burlington-vcgi-parcels')!;
const ct=REQUESTED_STATES_SOURCES.find(s=>s.sourceId==='us-ct-hartford-opm-parcels')!;
const specs=[
 {base:vt,sourceId:'us-vt-montpelier-vcgi-parcels',town:'MONTPELIER',county:'Washington — Montpelier only',fips:'50023',point:true},
 {base:vt,sourceId:'us-vt-rutland-city-vcgi-parcels',town:'RUTLAND CITY',county:'Rutland — Rutland City only',fips:'50021',point:true},
 {base:ct,sourceId:'us-ct-new-haven-opm-parcels',town:'New Haven',county:'South Central Connecticut Planning Region — New Haven only',fips:'09170',point:false},
];
/** Additive town-bound registrations. Existing sources, identity guards and
 * source gates are unchanged. Never extrapolate a town sample to its county. */
export const MUNICIPAL_EXPANSION_SOURCES:readonly ParcelSource[]=specs.map(({base,sourceId,town,county,fips,point})=>({
 ...base,sourceId,county,countyFips:fips,countyQuery:{field:base.state==='VT'?'TOWN':'Town_Name',codes:{[fips]:town}},
 capabilities:{subjectLookup:point,apnLookup:true,neighborLens:false},
 statusReason:point?'Exact identifier and point queries each returned one matching polygon without truncation; independent Census query confirmed county. Only the named town is enabled.':'Exact Parcel_ID constrained to New Haven returned one polygon; Census confirmed 09170. Point query was truncated/overlapping, so point capability remains OFF; exact APN only.',
 usageNotes:`Only ${town} within ${county}; not statewide/countywide coverage. Retain ${base.authorityName} / municipality attribution and no-survey disclaimer. No owners, mailing, inferred situs or repaired ZIP. Local parcel identifiers are always constrained by town. Neighborhood lookup remains OFF. ${point?'Point match must still pass existing containment/ambiguity checks.':'Overlapping point results must never select the first feature; APN-only lookup retains exact identifier and geometry guards.'}`,
 sourceFreshness:'Parcel dates/year from the sample are retained in qa/gis-expansion-round2/MUNICIPALITIES.json. Collection year and service edit dates do not imply a current assessor verification.',
 validation:{authorityVerified:true,schemaValidated:true,geometryQueryValidated:true,apnQueryValidated:true,viewportQueryValidated:false,counties:[fips],sampledCountyFips:[fips],evidencePath:'qa/gis-expansion-round2/MUNICIPALITIES.json + POINTS.json'},
}));
