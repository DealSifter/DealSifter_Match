import {MailboxError} from './connectionSecurity.ts';
import {mailHash} from './reportMailDelivery.ts';
type Data=Record<string,any>;
export const RELEASE_MAIL_COLUMNS='id,owner_id,type,address,city,state,zip,price,beds,baths,sqft,lot,objective,deal_tag,rehab,cap_rate,description,is_active,primary_profile,updated_at,lat,lng';
export function hasReleasePropertyAccess(userId:string,row:Data,cards:unknown):boolean {
 return row.owner_id===userId || (Array.isArray(cards) && cards.some((card:Data)=>card.owner_id===row.owner_id && Array.isArray(card.portfolio) && card.portfolio.some((item:Data)=>item.item_id===row.id && item.is_unlocked===true)));
}
export function releaseMailProperty(row:Data,images:string[]) {
 return {id:row.id,type:row.type,address:row.address,city:row.city,state:row.state,zip:row.zip,price:row.price,
 beds:row.beds,baths:row.baths,sqft:row.sqft,lot:row.lot,objective:row.objective,dealTag:row.deal_tag,rehab:row.rehab,
 capRate:row.cap_rate,description:row.description,published:row.is_active,lat:row.lat,lng:row.lng,images};
}
export async function releaseSourceFingerprint(row:Data,images:string[]) {
 return mailHash(JSON.stringify({property:releaseMailProperty(row,[...images].sort()),updatedAt:row.updated_at}));
}
// Use the same authorized read surfaces as the app. Direct table RLS intentionally hides
// other publishers' rows even after an unlock; an empty SELECT does not mean no property.
export async function readAuthorizedReleaseSource(client:Data,userId:string,propertyId:string):Promise<{row:Data;images:string[]}|null> {
 const own=await client.from('properties').select(RELEASE_MAIL_COLUMNS).eq('id',propertyId).maybeSingle();
 if(own.data?.owner_id===userId) {
  const photos=await client.from('property_images').select('image_url').eq('property_id',propertyId).order('image_url');
  if(photos.error)throw new MailboxError('REPORT_DELIVERY_UNAVAILABLE');
  return {row:own.data,images:(photos.data||[]).map((p:Data)=>p.image_url).filter(Boolean)};
 }
 const visible=await client.rpc('ds_get_public_property_details',{p_property_id:propertyId});
 if(visible.error)throw new MailboxError('REPORT_DELIVERY_UNAVAILABLE');
 const row=Array.isArray(visible.data)?visible.data.find((p:Data)=>p.id===propertyId):null;
 if(!row)return null;
 const contacts=await client.rpc('ds_get_unlocked_contact_cards',{p_user_id:userId});
 if(contacts.error)throw new MailboxError('REPORT_DELIVERY_UNAVAILABLE');
 const card=Array.isArray(contacts.data)?contacts.data.find((c:Data)=>Array.isArray(c.portfolio)&&c.portfolio.some((p:Data)=>p.item_id===propertyId&&p.is_unlocked===true)):null;
 if(!card?.owner_id)return null;
 return {row:{...row,owner_id:card.owner_id,lat:row.latitude,lng:row.longitude},images:Array.isArray(row.images)?row.images:[]};
}
// Source records and access are read with the caller JWT, never with administrative visibility.
export async function readReleaseMailReport(input:Data,userId:string,readSource:(id:string)=>Promise<{row:Data;images:string[]}|null>) {
 const ref=input.reference,schema=input.releaseSchema;
 if(ref?.reportType!=='PROPERTY_RELEASE'||ref.userId!==userId||ref.reportId!==ref.propertyId||!schema||schema.reportType!=='PROPERTY_RELEASE')throw new MailboxError('REPORT_ACCESS_DENIED');
 const source=await readSource(ref.propertyId);
 if(!source||source.row.id!==ref.propertyId)throw new MailboxError('REPORT_ACCESS_DENIED');
 if(input.releaseSourceFingerprint!==await releaseSourceFingerprint(source.row,source.images))throw new MailboxError('REPORT_CHANGED');
 const property=schema.sections?.propertySummary?.data;
 if(!property||property.id!==source.row.id)throw new MailboxError('REPORT_CHANGED');
 for(const key of ['address','price','beds','baths','sqft']) {
  if(['beds','baths','sqft'].includes(key)&&/^(land|vacant[ _-]?land|lot|terreno|solar)$/i.test(String(source.row.type||''))){if(property[key]!=null&&property[key]!=='')throw new MailboxError('REPORT_CHANGED');continue;}
  if(String(property[key]??'')!==String(source.row[key]??''))throw new MailboxError('REPORT_CHANGED');
 }
 if(!Array.isArray(property.images)||property.images.some((url:unknown)=>typeof url!=='string'||!source.images.includes(url)))throw new MailboxError('INVALID_PROPERTY_PHOTOS');
 // CRM text is reconstructed from current DB values, not from client-authored analysis or contacts.
 const emailSchema={reportType:'PROPERTY_RELEASE',sections:{propertySummary:{available:true,data:releaseMailProperty(source.row,source.images)}}};
 return {id:ref.propertyId,userId,propertyId:ref.propertyId,capability:'PROPERTY_RELEASE',accessSource:'PROPERTY_RELEASE_ACCESS',reportVersion:'1',
  reportPayload:{data:{maxxisReport:schema}},emailSchema};
}
