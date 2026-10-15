import {normalizeStreet} from '../property-data/address.ts';

/** Saved identity only. An incomplete form never authorizes external acquisition. */
export function hasStablePropertyIdentity(property:Record<string,unknown>){
 return typeof property.id==='string'&&property.id.length===36
  && ['address','city','state','zip'].every(field=>typeof property[field]==='string'&&String(property[field]).trim().length>0)
  && /^\d{5}(?:-\d{4})?$/.test(String(property.zip).trim());
}

/** Geometry alone cannot override a known, different street address. */
export function parcelMatchesPropertyAddress(property:Record<string,unknown>,situsAddress:unknown){
 if(typeof situsAddress!=='string'||!situsAddress.trim())return true;
 const street=normalizeStreet(String(property.address||'').split(',')[0]);
 return Boolean(street)&&street===normalizeStreet(situsAddress.split(',')[0]);
}
