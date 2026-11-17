import { buildReportEmailContent } from './reportEmailContent.ts';
import { MailboxError, requireVerifiedUser, unseal, type MailboxUser } from './connectionSecurity.ts';
type Data = Record<string, any>;
export const MAX_MAIL_ATTACHMENT_BYTES = 6 * 1024 * 1024;
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])) : v;
export async function mailHash(v: string | Uint8Array) {
  const bytes = typeof v === 'string' ? new TextEncoder().encode(v) : new Uint8Array(v);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
const jsonHash = (v: unknown) => mailHash(JSON.stringify(canonical(v)));
export function mailRecipients(input: Data) {
  let count=0;
  const result: Record<string,string[]>={};
  for(const field of ['to','cc','bcc']) {
    const raw=input[field] ?? '';
    if(typeof raw!=='string'||raw.length>1000||/[\r\n]/.test(raw))throw new MailboxError('INVALID_RECIPIENTS');
    const values=[...new Set(raw.split(/[;,]/).map(v=>v.trim()).filter(Boolean))];
    if(values.some(v=>!/^[-\w.!#$%&'*+/=?^`{|}~]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(v)))throw new MailboxError('INVALID_RECIPIENTS');
    result[field]=values;count+=values.length;
  }
  if(!result.to.length||count>10)throw new MailboxError('INVALID_RECIPIENTS');
  return result;
}
function decode(value: unknown) {
  if(typeof value!=='string'||value.length>MAX_MAIL_ATTACHMENT_BYTES*1.4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))throw new MailboxError('INVALID_ATTACHMENT');
  try { return Uint8Array.from(atob(value),c=>c.charCodeAt(0)); } catch { throw new MailboxError('INVALID_ATTACHMENT'); }
}
const base64=(bytes:Uint8Array)=>{
  let value=''; for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(value);
};
const utf8=(value:string)=>base64(new TextEncoder().encode(value));
const fold=(value:string)=>value.match(/.{1,76}/g)?.join('\r\n')||'';
const encodedHeader=(value:string)=>{
  const words:string[]=[];let part='';
  for(const character of value.replace(/[\r\n]/g,' ')) {
    if(new TextEncoder().encode(part+character).length>42){words.push(`=?UTF-8?B?${utf8(part)}?=`);part='';}
    part+=character;
  }
  if(part)words.push(`=?UTF-8?B?${utf8(part)}?=`);
  return words.join('\r\n ');
};
export function validateMailAttachments(input:Data, schema:Data) {
  const pdf=decode(input.pdfBase64);
  if(new TextDecoder().decode(pdf.subarray(0,5))!=='%PDF-' || pdf.length<20)throw new MailboxError('INVALID_REPORT_PDF');
  const result=[{name:'report.pdf',type:'application/pdf',bytes:pdf}];
  const photos=input.photos ?? [];
  const expected=Array.isArray(schema.sections?.propertySummary?.data?.images)?schema.sections.propertySummary.data.images.length:0;
  if(!Array.isArray(photos)||photos.length>Math.min(5,expected))throw new MailboxError('INVALID_PROPERTY_PHOTOS');
  for(let i=0;i<photos.length;i++) {
    const bytes=decode(photos[i]?.base64),type=photos[i]?.type;
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    const png=bytes[0]===137&&new TextDecoder().decode(bytes.subarray(1,4))==='PNG';
    if(!((type==='image/jpeg'&&jpeg)||(type==='image/png'&&png)))throw new MailboxError('INVALID_PROPERTY_PHOTOS');
    result.push({name:`property-${i+1}.${jpeg?'jpg':'png'}`,type,bytes});
  }
  if(result.reduce((n,a)=>n+a.bytes.length,0)>MAX_MAIL_ATTACHMENT_BYTES)throw new MailboxError('ATTACHMENTS_TOO_LARGE');
  return result;
}
export function gmailMime(from:string, recipients:Record<string,string[]>, content:{subject:string;body:string}, attachments:ReturnType<typeof validateMailAttachments>) {
  const boundary='dealsifter_'+crypto.randomUUID().replace(/-/g,'');
  const lines=[`From: ${from}`,`To: ${recipients.to.join(', ')}`,
    ...(recipients.cc.length?[`Cc: ${recipients.cc.join(', ')}`]:[]),...(recipients.bcc.length?[`Bcc: ${recipients.bcc.join(', ')}`]:[]),
    `Subject: ${encodedHeader(content.subject)}`,'MIME-Version: 1.0',`Content-Type: multipart/mixed; boundary="${boundary}"`,'',
    `--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',fold(utf8(content.body))];
  for(const a of attachments)lines.push(`--${boundary}`,`Content-Type: ${a.type}; name="${a.name}"`,
    `Content-Disposition: attachment; filename="${a.name}"`,'Content-Transfer-Encoding: base64','',fold(base64(a.bytes)));
  lines.push(`--${boundary}--`,'');
  return utf8(lines.join('\r\n')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export interface MailDeliveryPorts {
  readReport(reportId:string,userId:string):Promise<Data|null>;
  readMailbox(userId:string):Promise<Data|null>;
  reserve(row:Data,retryFailed:boolean):Promise<{created:boolean;row:Data}>;
  finish(key:string,userId:string,outcome:Data):Promise<void>;
  transport:typeof fetch;
  encryptionKey:string;
  inspectPdf(bytes:Uint8Array):Promise<boolean>;
}
export async function deliverReportEmail(userInput:MailboxUser,input:Data,ports:MailDeliveryPorts,now=Date.now()) {
  const user=requireVerifiedUser(userInput),ref=input.reference;
  if(!/^[^\s@]+@(gmail|googlemail)\.com$/i.test(user.email))throw new MailboxError('GMAIL_ACCOUNT_REQUIRED');
  if(!ref||ref.userId!==user.id||typeof ref.reportId!=='string')throw new MailboxError('REPORT_ACCESS_DENIED');
  const report=await ports.readReport(ref.reportId,user.id);
  const schema=report?.reportPayload?.data?.maxxisReport,request=report?.reportPayload?.data?.analysisRequest||null;
  if(!report||report.userId!==user.id||!schema||!(['SUBSCRIPTION_INCLUDED','ONE_TIME_UNLOCK'].includes(report.accessSource) || (report.capability==='PROPERTY_RELEASE' && ref.reportType==='PROPERTY_RELEASE' && report.accessSource==='PROPERTY_RELEASE_ACCESS')))throw new MailboxError('REPORT_ACCESS_DENIED');
  const current={reportId:report.id,propertyId:report.propertyId,reportType:report.capability,
    reportVersion:report.reportVersion||'1',reportRequestId:request?.id||null,
    scenarioId:schema.presentation?.activeScenario?.id||null,
    scenarioVersion:request?.scenarioVersion??schema.presentation?.activeScenario?.version??null,
    language:request?.language||schema.resolvedUserLocale||ref.language,
    fingerprint:await jsonHash({schema,request})};
  if(schema.reportType!==report.capability||schema.sections?.propertySummary?.data?.id!==report.propertyId||
    (request?.propertyId&&request.propertyId!==report.propertyId)||(request?.reportType&&request.reportType!==report.capability)||
    Object.keys(current).some(key=>current[key as keyof typeof current]!==ref[key]))throw new MailboxError('REPORT_CHANGED');
  const recipients=mailRecipients(input.recipients||{}),attachments=validateMailAttachments(input,schema);
  if(!await ports.inspectPdf(attachments[0].bytes))throw new MailboxError('INVALID_REPORT_PDF');
  const mailbox=await ports.readMailbox(user.id);
  if(!mailbox||mailbox.user_id!==user.id||mailbox.provider!=='google'||mailbox.mailbox_email!==user.email.toLowerCase()||
    !Number.isFinite(Date.parse(mailbox.expires_at))||Date.parse(mailbox.expires_at)<=now||!mailbox.granted_scopes?.includes('https://www.googleapis.com/auth/gmail.send'))throw new MailboxError('GMAIL_RECONNECT_REQUIRED');
  const token=await unseal(mailbox.token_encrypted,ports.encryptionKey,`mailbox:${user.id}:google`);
  const content=buildReportEmailContent(report.emailSchema || schema,ref);
  const recipientHash=await jsonHash(recipients);
  // Stable across double clicks, reload, regenerated PDF bytes and a new browser tab.
  // Re-sending an identical report to identical recipients requires a future explicit resend flow.
  const key=await jsonHash({userId:user.id,reportId:ref.reportId,...(ref.reportType==='PROPERTY_RELEASE'?{reportType:ref.reportType}:{}),fingerprint:ref.reportType==='PROPERTY_RELEASE'?input.releaseSourceFingerprint:ref.fingerprint,...(ref.reportType==='PROPERTY_RELEASE'?{language:ref.language}:{}),recipientHash,photos:attachments.length-1});
  const artifactHashes=await Promise.all(attachments.map(async a=>({name:a.name,sha256:await mailHash(a.bytes),bytes:a.bytes.length})));
  const reserved=await ports.reserve({delivery_key:key,user_id:user.id,report_id:report.capability==='PROPERTY_RELEASE'?null:ref.reportId,
    artifact_type:report.capability==='PROPERTY_RELEASE'?'PROPERTY_RELEASE':'SAVED_REPORT',
    property_id:ref.propertyId,report_fingerprint:ref.fingerprint,recipient_hash:recipientHash,
    attachment_hashes:artifactHashes,state:'SENDING',created_at:new Date(now).toISOString()},input.retryFailed===true);
  if(!reserved.created)return {state:reserved.row.state,duplicate:true,deliveryId:key};
  let outcome:Data;
  try {
    const response=await ports.transport('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{
      method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({raw:gmailMime(mailbox.mailbox_email,recipients,content,attachments)}),signal:AbortSignal.timeout(20000)});
    if(response.ok) {
      const result=await response.json();
      outcome=typeof result.id==='string'?{state:'ACCEPTED',provider_message_id:result.id}:{state:'INDETERMINATE'};
    }else outcome={state:response.status>=400&&response.status<500?'FAILED':'INDETERMINATE',http_status:response.status};
  }catch {outcome={state:'INDETERMINATE'};} // No retry after an ambiguous network result.
  try {await ports.finish(key,user.id,outcome);}catch {return {state:'INDETERMINATE',deliveryId:key};}
  return {state:outcome.state,deliveryId:key};
}
