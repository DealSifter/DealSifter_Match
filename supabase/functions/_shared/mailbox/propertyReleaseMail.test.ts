// @vitest-environment node
import {describe,it,expect,vi} from 'vitest';
import {readReleaseMailReport,releaseSourceFingerprint,releaseMailProperty,hasReleasePropertyAccess,readAuthorizedReleaseSource} from './propertyReleaseMail';
import {deliverReportEmail,mailHash} from './reportMailDelivery';
import {seal} from './connectionSecurity';
const row={id:'property-a',owner_id:'publisher',address:'1200 Synthetic Avenue',price:95000,beds:null,baths:null,sqft:null,type:'LAND',description:'Published land description',updated_at:'2026-11-17T00:00:00Z'},images=['https://example.invalid/property-a.jpg'];
const canonical=(v:any):any=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
async function fixture(){
 const schema:any={reportType:'PROPERTY_RELEASE',sections:{propertySummary:{available:true,data:releaseMailProperty(row,images)}}};
 const input:any={reference:{userId:'actor',propertyId:row.id,reportId:row.id,reportType:'PROPERTY_RELEASE',reportVersion:'1',reportRequestId:null,scenarioId:null,scenarioVersion:null,language:'en',fingerprint:await mailHash(JSON.stringify(canonical({schema,request:null})))},releaseSchema:schema,releaseSourceFingerprint:await releaseSourceFingerprint(row,images),recipients:{to:'board@example.invalid'},pdfBase64:btoa('%PDF-1.7\nsynthetic release\n%%EOF'),photos:[{type:'image/jpeg',base64:btoa('\xff\xd8\xffsynthetic')}]};
 return {input,read:vi.fn(async()=>({row,images}))};
}
describe('Property Release Gmail authorization',()=>{
 it('reconstructs CRM data from authorized current source without storing a fake paid report',async()=>{
 const {input,read}=await fixture();input.releaseSchema.sections.madeUpAnalysis={data:'INVENTED'};
 const report=await readReleaseMailReport(input,'actor',read);expect(report.accessSource).toBe('PROPERTY_RELEASE_ACCESS');expect(report.emailSchema.sections.propertySummary.data.price).toBe(95000);expect(report.emailSchema.sections).not.toHaveProperty('madeUpAnalysis');
 });
 it('denies inaccessible properties and cross-user references before delivery',async()=>{
 const {input,read}=await fixture();await expect(readReleaseMailReport(input,'other',read)).rejects.toThrow('REPORT_ACCESS_DENIED');expect(read).not.toHaveBeenCalled();
 await expect(readReleaseMailReport(input,'actor',async()=>null)).rejects.toThrow('REPORT_ACCESS_DENIED');
 });
 it('rejects stale source, wrong property and unregistered property images',async()=>{
 const {input,read}=await fixture();await expect(readReleaseMailReport(input,'actor',async()=>({row:{...row,price:96000},images}))).rejects.toThrow('REPORT_CHANGED');
 input.releaseSchema.sections.propertySummary.data.id='other';await expect(readReleaseMailReport(input,'actor',read)).rejects.toThrow('REPORT_CHANGED');
 input.releaseSchema.sections.propertySummary.data.id=row.id;input.releaseSchema.sections.propertySummary.data.images=['https://example.invalid/other-property.jpg'];await expect(readReleaseMailReport(input,'actor',read)).rejects.toThrow('INVALID_PROPERTY_PHOTOS');
 });
 it('rejects client alterations to listing facts',async()=>{
 for(const key of ['price','address','beds','baths','sqft']){const {input,read}=await fixture();input.releaseSchema.sections.propertySummary.data[key]='altered';await expect(readReleaseMailReport(input,'actor',read)).rejects.toThrow('REPORT_CHANGED');}
 });
 it('attaches real envelope PDF and photo using Gmail; duplicate preparation does not resend',async()=>{
 const {input,read}=await fixture(),key='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',now=Date.parse('2026-11-17T12:00:00Z');
 const connection={user_id:'actor',provider:'google',mailbox_email:'fixture@gmail.com',granted_scopes:['https://www.googleapis.com/auth/gmail.send'],expires_at:new Date(now+3600000).toISOString(),token_encrypted:await seal('offline-token',key,'mailbox:actor:google')};
 const rows=new Map(),ports:any={readSenderProfile:async()=>({scope:'personal',email:'fixture@gmail.com'}),encryptionKey:key,readReport:()=>readReleaseMailReport(input,'actor',read),readMailbox:async()=>connection,inspectPdf:async()=>true,
 reserve:vi.fn(async(row:any)=>{if(rows.has(row.delivery_key))return {created:false,row:rows.get(row.delivery_key)};rows.set(row.delivery_key,row);return {created:true,row};}),finish:async(k:string,u:string,outcome:any)=>rows.set(k,outcome),transport:vi.fn(async()=>new Response(JSON.stringify({id:'fixture-message'})))};
 const user={id:'actor',email:'fixture@gmail.com',email_confirmed_at:'2026-11-17'};
 expect((await deliverReportEmail(user,input,ports,now)).state).toBe('ACCEPTED');
 const mime=Buffer.from(JSON.parse(ports.transport.mock.calls[0][1].body).raw,'base64url').toString();
 expect(mime).toContain('filename="report.pdf"');expect(mime).toContain('filename="property-1.jpg"');expect(mime).toContain('From: fixture@gmail.com');expect(ports.reserve.mock.calls[0][0]).toMatchObject({report_id:null,artifact_type:'PROPERTY_RELEASE',property_id:row.id});
 // Render metadata may change after reopening; source + recipients + language stay identical.
 input.releaseSchema.renderMetadata={generatedAt:'new time'};input.reference.fingerprint=await mailHash(JSON.stringify(canonical({schema:input.releaseSchema,request:null})));
 expect((await deliverReportEmail(user,input,ports,now)).duplicate).toBe(true);expect(ports.transport).toHaveBeenCalledOnce();
 });
 it('does not turn a forged paid report into an L1 authorization',async()=>{const {input,read}=await fixture();input.reference.reportType='DEAL_INTELLIGENCE';await expect(readReleaseMailReport(input,'actor',read)).rejects.toThrow('REPORT_ACCESS_DENIED');});
});

it('L1 access follows ownership or the existing unlocked property relation, independent of paid analysis plans',()=>{
 expect(hasReleasePropertyAccess('publisher',row,[])).toBe(true);
 expect(hasReleasePropertyAccess('actor',row,[{owner_id:'publisher',portfolio:[{item_id:row.id,is_unlocked:true}]}])).toBe(true);
 expect(hasReleasePropertyAccess('actor',row,[{owner_id:'publisher',portfolio:[{item_id:'other',is_unlocked:true}]}])).toBe(false);
 expect(hasReleasePropertyAccess('actor',row,[{owner_id:'publisher',portfolio:[{item_id:row.id,is_unlocked:false}]}])).toBe(false);
 expect(hasReleasePropertyAccess('actor',row,[])).toBe(false);
});

describe('authorized property read surfaces',()=>{
 function client({own=null,visible=[{...row,images,latitude:1,longitude:2}],cards=[{owner_id:'publisher',portfolio:[{item_id:row.id,is_unlocked:true}]}],rpcError=null}={}){return {from:vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:own,error:null}),order:async()=>({data:images.map(image_url=>({image_url})),error:null})})})})),rpc:vi.fn(async name=>name==='ds_get_public_property_details'?{data:visible,error:rpcError}:{data:cards,error:null})};}
 it('uses the existing public-details RPC plus unlocked graph when direct table RLS hides the row',async()=>{const c=client();const source=await readAuthorizedReleaseSource(c,'actor',row.id);expect(source.row.owner_id).toBe('publisher');expect(source.images).toEqual(images);expect(c.rpc).toHaveBeenCalledWith('ds_get_public_property_details',{p_property_id:row.id});expect(c.rpc).toHaveBeenCalledWith('ds_get_unlocked_contact_cards',{p_user_id:'actor'});});
 it('denies public visibility without a legitimate property unlock',async()=>{expect(await readAuthorizedReleaseSource(client({cards:[]}),'actor',row.id)).toBeNull();});
 it('preserves the sanitized hidden address and does not fetch private table data with admin credentials',async()=>{const source=await readAuthorizedReleaseSource(client({visible:[{...row,address:null,latitude:null,longitude:null,images}]}),'actor',row.id);expect(source.row.address).toBeNull();expect(source.row.lat).toBeNull();});
 it('lets an owner use their own unpublished record through existing table RLS',async()=>{const c=client({own:{...row,owner_id:'actor'},visible:[]});const source=await readAuthorizedReleaseSource(c,'actor',row.id);expect(source.row.owner_id).toBe('actor');expect(c.rpc).not.toHaveBeenCalled();});
 it('reports source failure instead of pretending the PDF failed',async()=>{await expect(readAuthorizedReleaseSource(client({rpcError:{code:'network'}}),'actor',row.id)).rejects.toThrow('REPORT_DELIVERY_UNAVAILABLE');});
});
