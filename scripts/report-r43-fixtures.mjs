import { r42Fixtures, R4_TIME } from './report-r42-fixtures.mjs';
export { R4_TIME };
export function r43Fixtures(photos=[]) {
  const fixtures=r42Fixtures(photos);
  const input=structuredClone(fixtures.find(f=>f.id==='partial').input);
  const p=input.property;
  input.dealIntelligence.comparableEvidence={used:[],supporting:[]};
  input.dealIntelligence.valuationIntelligence={status:'ARV_UNAVAILABLE',confidence:'LOW',range:null,
    providerListingReferences:[
      {address:p.address,price:p.price,priceSemantic:'PROVIDER_LISTING_PRICE',latitude:p.latitude,longitude:p.longitude,bedrooms:p.beds,bathrooms:p.baths,livingAreaSqft:p.sqft,listingStatus:'Active'},
      ...[1,2,3].map(n=>({address:`${1500+n} Fictional Avenue`,price:300000+n*5000,priceSemantic:'PROVIDER_LISTING_PRICE',latitude:p.latitude+.001*n,longitude:p.longitude+.001*n,bedrooms:3,bathrooms:2,livingAreaSqft:1600,listingStatus:'Active',lastSeenDate:'2026-10-25',providerCorrelation:.9-n*.01,distanceMiles:.1*n}))]};
  input.property.latestSalePrice=250000;input.property.latestSaleDate='2025-09-01';
  input.dealIntelligence.evidenceReasons.recordedSales='INTERNAL_ERROR';
  fixtures.push({id:'listing-only-subject',levels:['L3'],input});
  return fixtures;
}
