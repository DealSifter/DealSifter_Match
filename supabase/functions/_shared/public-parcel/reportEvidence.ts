import { readParcelEvidenceReceipt } from './evidenceReceipt.ts';
import { normalizeStreet } from '../property-data/address.ts';
import { validPoint } from './geometry.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateReportParcelRequest(input:unknown){
 const body=input as Record<string,unknown>;
 if(!body||Array.isArray(body)||body.operation!=='report-evidence'||Object.keys(body).some(key=>!['operation','propertyId','receipt'].includes(key))
  ||typeof body.propertyId!=='string'||!UUID.test(body.propertyId)||typeof body.receipt!=='string'||body.receipt.length>20100)throw new Error('INVALID_REPORT_EVIDENCE_QUERY');
 return {propertyId:body.propertyId,receipt:body.receipt};
}
/** Factual APN only, from existing signed evidence. No GIS/provider calls or writes. */
export async function resolveReportParcelEvidence(options:{input:unknown;userId:string;secret:string;enabled:boolean;now?:number;
 loadPublicProperty:(id:string)=>Promise<Record<string,unknown>|null>}){
 const request=validateReportParcelRequest(options.input);
 const empty=(reason:string)=>({state:'unavailable' as const,propertyId:request.propertyId,reason,fields:{}});
 if(!options.userId||!options.enabled)return empty('PUBLIC_PARCEL_DISABLED');
 const property=await options.loadPublicProperty(request.propertyId);
 if(!property||property.id!==request.propertyId||property.is_active===false||property.publish_to_showcase===false||property.deal_closed===true
  ||property.hide_street_address_on_card===true||property.hideStreetAddressOnCard===true||!property.address)return empty('SUBJECT_NOT_PUBLIC');
 const point={lat:property.latitude??property.lat,lng:property.longitude??property.lng};
 if(!validPoint(point))return empty('SUBJECT_LOCATION_UNAVAILABLE');
 const evidence=await readParcelEvidenceReceipt(request.receipt,{userId:options.userId,point,secret:options.secret,enabled:true,now:options.now});
 if(evidence.length!==1)return empty('NO_VERIFIED_PARCEL');
 const {parcel,source,freshness}=evidence[0];
 // A street-interpolated PIN can fall inside a neighbour's polygon.
 if(!parcel.situsAddress||normalizeStreet(parcel.situsAddress.split(',')[0])!==normalizeStreet(String(property.address).split(',')[0]))return empty('PARCEL_ADDRESS_MISMATCH');
 const apn=typeof parcel.apn==='string'?parcel.apn.trim():'';
 if(!apn)return empty('APN_NOT_RECORDED');
 return {state:'available' as const,propertyId:request.propertyId,reason:'VERIFIED_PUBLIC_PARCEL',
  fields:{assessorId:{value:apn,status:'VERIFIED_RECORD',source:`PUBLIC_PARCEL:${source.sourceId}`,retrievedAt:parcel.retrievedAt,
   effectiveDate:parcel.sourceUpdatedAt,confidence:null}},
  source:{id:source.sourceId,url:parcel.sourceUrl,label:source.authorityName,freshness},providerCalls:0};
}
