// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverReportEmail, gmailMime, mailHash, mailRecipients, validateMailAttachments, type MailDeliveryPorts } from './reportMailDelivery';
import { seal } from './connectionSecurity';
import { buildReportEmailContent } from './reportEmailContent';
const user={id:'qa-user',email:'dealsifter-qa-0000000000000000@gmail.com',email_confirmed_at:'2026-11-16T00:00:00Z'};
const key='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const now=Date.parse('2026-11-16T12:00:00Z');
const schema={reportType:'DEAL_INTELLIGENCE',resolvedUserLocale:'pt',sections:{propertySummary:{available:true,data:{
  id:'property-a',address:'1200 Fictional QA Avenue',city:'Example City',price:231000,beds:4,baths:2,sqft:1700,
  images:['https://images.example.invalid/a.jpg'],description:'Descrição: imóvel fictício.',notes:'Nota confirmada.'}}}};
const report={id:'report-a',userId:user.id,propertyId:'property-a',capability:'DEAL_INTELLIGENCE',
  accessSource:'SUBSCRIPTION_INCLUDED',reportVersion:'1',reportPayload:{data:{maxxisReport:schema}}};
const pdf=btoa('%PDF-1.7\nfixture content only\n%%EOF');
let ports:MailDeliveryPorts, input:any, ledger:Map<string,any>;
beforeEach(async()=>{
  ledger=new Map();
  ports={encryptionKey:key,transport:vi.fn(async()=>new Response(JSON.stringify({id:'provider-fixture-id'}))),
    readReport:vi.fn(async()=>report),
    readMailbox:vi.fn(async()=>({user_id:user.id,provider:'google',mailbox_email:user.email,granted_scopes:['https://www.googleapis.com/auth/gmail.send'],
      expires_at:new Date(now+3600000).toISOString(),token_encrypted:await seal('private-token',key,`mailbox:${user.id}:google`)})),
    reserve:vi.fn(async(row)=>{const existing=ledger.get(row.delivery_key);if(existing)return {created:false,row:existing};ledger.set(row.delivery_key,row);return {created:true,row};}),
    finish:vi.fn(async(id,_userId,outcome)=>{ledger.set(id,{...ledger.get(id),...outcome});}),
    inspectPdf:vi.fn(async()=>true)};
  input={reference:{reportId:'report-a',userId:user.id,propertyId:'property-a',reportType:'DEAL_INTELLIGENCE',
    reportVersion:'1',reportRequestId:null,scenarioId:null,scenarioVersion:null,language:'pt',
    fingerprint:await mailHash(JSON.stringify({request:null,schema:canonical(schema)}))},
    recipients:{to:'board@boards.trello.example.invalid',cc:'',bcc:''},pdfBase64:pdf,photos:[]};
});
function canonical(v:any):any {return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
describe('report email delivery, offline',()=>{
  it('uses the logged-in authorized Gmail, attaches PDF and never opens an external client',async()=>{
    const result=await deliverReportEmail(user,input,ports,now);
    expect(result.state).toBe('ACCEPTED');
    expect(ports.transport).toHaveBeenCalledTimes(1);
    const [url,options]=vi.mocked(ports.transport).mock.calls[0];
    expect(String(url)).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    const raw=JSON.parse(String(options?.body)).raw;
    const mime=Buffer.from(raw,'base64url').toString('utf8');
    expect(mime).toContain(`From: ${user.email}`);
    expect(mime).toContain('Content-Disposition: attachment; filename="report.pdf"');
    expect(mime).toContain(pdf);
    expect(mime).not.toContain('hotmail.com');
  });
  it('preserves Unicode, complete property facts and photo URLs in the CRM body',()=>{
    const content=buildReportEmailContent(schema,input.reference);
    expect(content.subject).toContain('1200 Fictional QA Avenue');
    for(const value of ['Preço anunciado (USD): 231000','Quartos: 4','Banheiros: 2','Área habitável (sqft): 1700','Descrição: imóvel fictício.',
      'Nota confirmada.','https://images.example.invalid/a.jpg','report-a'])expect(content.body).toContain(value);
    expect(content.body).not.toContain('Anexe manualmente');
  });
  it('uses canonical property facts rather than stale listing values and labels conflicts',()=>{
    const updated=structuredClone(schema) as any;
    updated.sections.propertySummary.data.canonicalPropertyFacts={physical:{beds:{value:5,semanticState:'KNOWN'},
      baths:{value:3,semanticState:'CONFLICT',conflict:true}}};
    const body=buildReportEmailContent(updated,input.reference).body;
    expect(body).toContain('Quartos: 5');expect(body).not.toContain('Quartos: 4');
    expect(body).toContain('Banheiros: Dados divergentes');
  });
  it('blocks cross-user requests before reading a report or calling Gmail',async()=>{
    await expect(deliverReportEmail({...user,id:'other'},input,ports,now)).rejects.toThrow('REPORT_ACCESS_DENIED');
    expect(ports.readReport).not.toHaveBeenCalled();expect(ports.transport).not.toHaveBeenCalled();
  });
  it('blocks the .invalid account instead of using the desktop Outlook sender',async()=>{
    await expect(deliverReportEmail({...user,email:'qa@example.invalid'},input,ports,now)).rejects.toThrow('GMAIL_ACCOUNT_REQUIRED');
    expect(ports.transport).not.toHaveBeenCalled();
  });
  it.each(['fingerprint','reportType','propertyId','scenarioVersion'])('rejects changed %s',async field=>{
    input.reference[field]='changed';
    await expect(deliverReportEmail(user,input,ports,now)).rejects.toThrow('REPORT_CHANGED');
    expect(ports.transport).not.toHaveBeenCalled();
  });
  it('requires a currently accessible saved report',async()=>{
    vi.mocked(ports.readReport).mockResolvedValue(null);
    await expect(deliverReportEmail(user,input,ports,now)).rejects.toThrow('REPORT_ACCESS_DENIED');
  });
  it.each(['expired','different','missing','invalid-date'])('rejects %s mailbox',async kind=>{
    const mailbox=await ports.readMailbox(user.id);
    if(kind==='expired')mailbox!.expires_at=new Date(now-1).toISOString();
    if(kind==='different')mailbox!.mailbox_email='other@gmail.com';
    if(kind==='invalid-date')mailbox!.expires_at='invalid';
    vi.mocked(ports.readMailbox).mockResolvedValue(kind==='missing'?null:mailbox);
    await expect(deliverReportEmail(user,input,ports,now)).rejects.toThrow('GMAIL_RECONNECT_REQUIRED');
    expect(ports.transport).not.toHaveBeenCalled();
  });
  it('rejects invalid PDF content before reserving a delivery',async()=>{
    vi.mocked(ports.inspectPdf).mockResolvedValue(false);
    await expect(deliverReportEmail(user,input,ports,now)).rejects.toThrow('INVALID_REPORT_PDF');
    expect(ports.reserve).not.toHaveBeenCalled();
  });
  it('does not send twice on concurrent clicks, reload or regenerated PDF bytes',async()=>{
    const results=await Promise.all([deliverReportEmail(user,input,ports,now),deliverReportEmail(user,input,ports,now)]);
    expect(results.some(r=>r.duplicate)).toBe(true);expect(ports.transport).toHaveBeenCalledTimes(1);
    await deliverReportEmail(user,{...input,pdfBase64:btoa('%PDF-1.7\nnew metadata same saved report\n%%EOF')},ports,now);
    expect(ports.transport).toHaveBeenCalledTimes(1);
  });
  it('marks a network timeout indeterminate without retry',async()=>{
    vi.mocked(ports.transport).mockRejectedValue(new Error('timeout'));
    const result=await deliverReportEmail(user,input,ports,now);
    expect(result.state).toBe('INDETERMINATE');
    await deliverReportEmail(user,input,ports,now);
    expect(ports.transport).toHaveBeenCalledTimes(1);
  });
  it('reports definite rejection without retry',async()=>{
    vi.mocked(ports.transport).mockResolvedValue(new Response('not printed',{status:401}));
    expect((await deliverReportEmail(user,input,ports,now)).state).toBe('FAILED');
    expect(ports.transport).toHaveBeenCalledTimes(1);
  });
  it('permits a new attempt only after explicit confirmation of a definite rejection',async()=>{
    vi.mocked(ports.transport).mockResolvedValueOnce(new Response('',{status:401}));
    await deliverReportEmail(user,input,ports,now);
    vi.mocked(ports.reserve).mockImplementation(async(row,retryFailed)=>{
      const previous=ledger.get(row.delivery_key);
      if(previous?.state==='FAILED'&&retryFailed){ledger.set(row.delivery_key,row);return {created:true,row};}
      return {created:false,row:previous};
    });
    expect((await deliverReportEmail(user,input,ports,now)).state).toBe('FAILED');
    expect(ports.transport).toHaveBeenCalledTimes(1);
    expect((await deliverReportEmail(user,{...input,retryFailed:true},ports,now)).state).toBe('ACCEPTED');
    expect(ports.transport).toHaveBeenCalledTimes(2);
  });
  it('does not retry an indeterminate result even when retry is requested',async()=>{
    vi.mocked(ports.transport).mockRejectedValue(new Error('timeout'));
    await deliverReportEmail(user,input,ports,now);
    expect((await deliverReportEmail(user,{...input,retryFailed:true},ports,now)).state).toBe('INDETERMINATE');
    expect(ports.transport).toHaveBeenCalledTimes(1);
  });
  it('does not claim success when provider acceptance could not be audited',async()=>{
    vi.mocked(ports.finish).mockRejectedValue(new Error('database down'));
    expect((await deliverReportEmail(user,input,ports,now)).state).toBe('INDETERMINATE');
  });
  it('stores hashes, not email content, recipients or tokens',async()=>{
    await deliverReportEmail(user,input,ports,now);
    const serialized=JSON.stringify(vi.mocked(ports.reserve).mock.calls[0]);
    for(const value of [user.email,input.recipients.to,'private-token',pdf,'Descrição'])expect(serialized).not.toContain(value);
  });
  it('blocks header injection and invalid image masquerading',()=>{
    expect(()=>mailRecipients({to:'qa@example.invalid\r\nBcc: attacker@example.invalid'})).toThrow('INVALID_RECIPIENTS');
    expect(()=>validateMailAttachments({...input,photos:[{type:'image/jpeg',base64:btoa('not an image')}]},schema)).toThrow('INVALID_PROPERTY_PHOTOS');
  });
  it('constructs MIME with a separate photo attachment and UTF-8 body',()=>{
    const attachments=validateMailAttachments({...input,photos:[{type:'image/jpeg',base64:btoa(String.fromCharCode(255,216,255,0))}]},schema);
    const raw=gmailMime(user.email,mailRecipients(input.recipients),buildReportEmailContent(schema,input.reference),attachments);
    const mime=Buffer.from(raw,'base64url').toString('utf8');
    expect(mime).toContain('filename="property-1.jpg"');expect(mime).toContain('charset=UTF-8');
    expect(mime).not.toContain('Cc: \r\n');
  });
});
