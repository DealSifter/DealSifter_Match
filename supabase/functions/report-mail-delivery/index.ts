import { createClient } from 'npm:@supabase/supabase-js@2';
import {readReleaseMailReport,readAuthorizedReleaseSource} from '../_shared/mailbox/propertyReleaseMail.ts';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';
import { deliverReportEmail } from '../_shared/mailbox/reportMailDelivery.ts';
import { MailboxError } from '../_shared/mailbox/connectionSecurity.ts';
import { buildCorsHeaders,parseAllowedOrigins } from '../_shared/maxxis/corsPolicy.ts';
import { readSenderProfile } from '../_shared/mailbox/senderProfile.ts';
const url=Deno.env.get('SUPABASE_URL')||'';
const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
const origins=parseAllowedOrigins(Deno.env.get('MAILBOX_ALLOWED_ORIGINS')||'');
Deno.serve(async request=>{
  const origin=request.headers.get('origin')||'';
  const headers={...buildCorsHeaders(origin,origins),'Content-Type':'application/json','Cache-Control':'no-store'};
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(!origins.includes(origin))return json({code:'ORIGIN_NOT_ALLOWED'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return json({code:'METHOD_NOT_ALLOWED'},405);
  const bearer=request.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return json({code:'AUTHENTICATION_REQUIRED'},401);
  const {data:auth,error:authError}=await admin.auth.getUser(bearer.slice(7));
  if(authError||!auth.user)return json({code:'AUTHENTICATION_REQUIRED'},401);
  if(Number(request.headers.get('content-length')||0)>9*1024*1024)return json({code:'ATTACHMENTS_TOO_LARGE'},413);
  try {
    const raw=await request.text();
    if(raw.length>9*1024*1024)return json({code:'ATTACHMENTS_TOO_LARGE'},413);
    const input=JSON.parse(raw);
    if(input.confirmSend!==true)return json({code:'EXPLICIT_SEND_CONFIRMATION_REQUIRED'},400);
    const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:bearer}},auth:{persistSession:false,autoRefreshToken:false}});
    const result=await deliverReportEmail(auth.user,input,{
      encryptionKey:Deno.env.get('MAIL_TOKEN_ENCRYPTION_KEY')||'',transport:fetch,
      readSenderProfile:(userId,scope)=>readSenderProfile(caller,userId,scope),
      async readReport(id,userId){
        if(input.reference?.reportType==='PROPERTY_RELEASE') return readReleaseMailReport(input,userId,propertyId=>readAuthorizedReleaseSource(caller,userId,propertyId));
        const {data:row,error}=await caller.from('maxxis_reports').select('id,user_id,property_id,capability,access_source,report_version,report_payload')
          .eq('id',id).eq('user_id',userId).is('deleted_at',null).maybeSingle();
        if(error||!row)return null;
        const {data:allowed,error:denied}=await caller.rpc('ds_has_maxxis_analysis_context_access',{p_property_id:row.property_id});
        if(denied||allowed!==true)return null;
        return {id:row.id,userId:row.user_id,propertyId:row.property_id,capability:row.capability,accessSource:row.access_source,
          reportVersion:row.report_version,reportPayload:row.report_payload};
      },
      async readMailbox(userId){const {data,error}=await admin.from('report_mailbox_connections').select('*').eq('user_id',userId).eq('provider','google').maybeSingle();
        if(error)throw new MailboxError('MAILBOX_UNAVAILABLE');return data;},
      async reserve(row,retryFailed){
        const {data,error}=await admin.from('report_mail_deliveries').insert(row).select('state').single();
        if(!error)return {created:true,row:data};
        if(error.code!=='23505')throw new MailboxError('DELIVERY_UNAVAILABLE');
        const {data:existing,error:missing}=await admin.from('report_mail_deliveries').select('state').eq('delivery_key',row.delivery_key).eq('user_id',row.user_id).single();
        if(missing)throw new MailboxError('DELIVERY_UNAVAILABLE');
        if(retryFailed&&existing.state==='FAILED') {
          const {data:retry,error:retryError}=await admin.from('report_mail_deliveries')
            .update({state:'SENDING',http_status:null,attachment_hashes:row.attachment_hashes,report_fingerprint:row.report_fingerprint,retry_requested_at:new Date().toISOString(),updated_at:new Date().toISOString()})
            .eq('delivery_key',row.delivery_key).eq('user_id',row.user_id).eq('state','FAILED').select('state').maybeSingle();
          if(retryError)throw new MailboxError('DELIVERY_UNAVAILABLE');
          if(retry)return {created:true,row:retry};
          return {created:false,row:{state:'SENDING'}};
        }
        return {created:false,row:existing};
      },
      async finish(key,userId,outcome){const {data,error}=await admin.from('report_mail_deliveries').update({...outcome,updated_at:new Date().toISOString()})
        .eq('delivery_key',key).eq('user_id',userId).select('delivery_key').single();if(error||!data)throw new MailboxError('DELIVERY_AUDIT_UNAVAILABLE');},
      async inspectPdf(bytes){try{const pdf=await PDFDocument.load(bytes);return !pdf.isEncrypted&&pdf.getPageCount()>0;}catch{return false;}},
    });
    return json(result);
  }catch(error){return json({code:error instanceof MailboxError?error.code:'DELIVERY_UNAVAILABLE'},400);}
});
