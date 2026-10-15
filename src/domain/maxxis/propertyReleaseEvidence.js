import { mergeVerifiedPropertyEvidenceIntoFacts } from '../../../supabase/functions/_shared/maxxis/propertyEvidenceProjection.ts';

/** L1 shares the exact factual projection used by chat/L2/L3. */
export function mergePropertyReleaseEvidence(property, response, parcelResponse = null) {
  const record=response?.state==='unlocked'?response.intelligence:null;
  const parcel=parcelResponse?.propertyId===property?.id?parcelResponse:null;
  const publicApn=parcel?.state==='available'&&parcel.fields?.assessorId?.status==='VERIFIED_RECORD'&&typeof parcel.fields.assessorId.value==='string'&&parcel.fields.assessorId.value.trim()?parcel.fields.assessorId:null;
  const fields={...record?.fields};
  const providerApn=fields.assessorId?.status==='VERIFIED_RECORD'?fields.assessorId?.value:null;
  const apnIdentity=value=>String(value).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const conflict=publicApn&&providerApn&&apnIdentity(publicApn.value)!==apnIdentity(providerApn);
  const projected={...(property||{}),...(parcel?{parcelReportState:conflict?'APN_CONFLICT':parcel.reason}:{})};
  if(publicApn&&!providerApn)fields.assessorId=publicApn;
  if(conflict){fields.assessorId={value:null,status:'UNAVAILABLE'};projected.assessorId=null;projected.assessorID=null;projected.apn=null;projected.parcelId=null;projected.parcelNumber=null;}
  if(!record&&!publicApn)return Object.freeze(projected);
  return mergeVerifiedPropertyEvidenceIntoFacts(projected,{...record,fields});
}
