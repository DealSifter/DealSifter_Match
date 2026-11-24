// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReportDeliveryModal } from './ReportDeliveryModal';
import { setLang } from '../../../i18n/translations';
import { resolveReportSenderScope } from '../../../services/reportSenderScope';
import { resolveSenderProfile } from '../../../../supabase/functions/_shared/mailbox/senderProfile';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), draft: vi.fn(), render: vi.fn(), download: vi.fn(), prepare: vi.fn(), loadRecipients: vi.fn(), saveRecipients: vi.fn(), send: vi.fn(), photos: vi.fn(), release: vi.fn() }));
vi.mock('../../../services/propertyReleaseMailService', () => ({resolvePropertyReleaseDelivery:mocks.release}));
vi.mock('./reportDelivery', () => ({ resolveReportDelivery: mocks.resolve, reportEmailDraft: mocks.draft }));
vi.mock('../presentation/reportNarrativePresentation', () => ({ prepareReportNarrativePresentation: mocks.prepare }));
vi.mock('../export/maxxisReportPdf', () => ({ renderMaxxisReportPdfCached: mocks.render, downloadMaxxisReportPdf: mocks.download }));
vi.mock('../../../services/reportRecipientPreferences', () => ({ loadReportRecipientPreferences: mocks.loadRecipients, saveReportRecipientPreferences: mocks.saveRecipients }));
vi.mock('../../../services/reportMailboxService', () => ({ sendPreparedReportEmail: mocks.send }));
vi.mock('../export/reportPreparedAssets.ts', () => ({ prepareReportAssets: mocks.photos }));
vi.mock('../export/reportMapAssets', () => ({ prepareReportMaps: vi.fn(async () => undefined) }));
vi.mock('./GmailConnectionPanel', () => ({ GmailConnectionPanel: ({ onConnectionChange }) => <button onClick={() => onConnectionChange({ status: 'CONNECTED', mailbox_email: 'synthetic@gmail.com' })}>Connect test mailbox</button> }));
const reference = { userId: 'a', propertyId: 'property-a', reportId: 'report-a', reportType: 'DEAL_INTELLIGENCE', language: 'en' };
beforeEach(() => {
  setLang('en-US');
  vi.resetAllMocks();
  mocks.resolve.mockResolvedValue({ schema: { reportType: 'DEAL_INTELLIGENCE', sections: { propertySummary: { data: { address: '1200 Fictional QA Avenue' } } } }, report: { createdAt: '2026-11-16' }, entitlements: { PDF: { allowed: true } } });
  mocks.draft.mockReturnValue('#draft-requested'); mocks.render.mockResolvedValue({ state: 'RENDERED', document: { pageCount: 4, binary: new TextEncoder().encode('%PDF-1.7\nfixture content\n%%EOF') } }); mocks.download.mockReturnValue(true);
  mocks.send.mockResolvedValue({ state: 'ACCEPTED' }); mocks.photos.mockResolvedValue([]);
  mocks.loadRecipients.mockResolvedValue({ userId: 'a', senderEmail: 'qa-a@example.invalid', recipients: null }); mocks.saveRecipients.mockResolvedValue({ to: 'qa@example.invalid', cc: '', bcc: '' });
});
afterEach(cleanup);
describe('R3.2 contextual delivery controls', () => {
  it('switches the open interface to Spanish without reloading or replacing edited recipients and message', async () => {
    mocks.loadRecipients.mockResolvedValue({ userId: 'a', senderEmail: 'synthetic@gmail.com', recipients: null });
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect test mailbox' }));
    fireEvent.change(screen.getByTestId('report-delivery-to'), { target: { value: 'recipient@example.invalid' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'My subject' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'My edited message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Download this PDF' }));
    await screen.findByText('PDF download requested.');
    act(() => setLang('es-ES'));
    await screen.findByRole('heading', { name: 'Entregar informe preparado · Enterprise' });
    expect(screen.getByLabelText('Asunto').value).toBe('My subject');
    expect(screen.getByLabelText('Mensaje').value).toBe('My edited message');
    expect(screen.getByTestId('report-delivery-to').value).toBe('recipient@example.invalid');
    expect(screen.getByText('Descarga del PDF solicitada.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preparar correo Gmail' })).toBeTruthy();
    expect(mocks.loadRecipients).toHaveBeenCalledTimes(1);
    expect(mocks.resolve).toHaveBeenCalledTimes(3);
    expect(mocks.render.mock.calls[0][0].language).toBe('en');
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('translates an already-open failure when the selected language changes', async () => {
    mocks.resolve.mockRejectedValue(new Error('UNAVAILABLE'));
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    await screen.findByRole('alert');
    act(() => setLang('es-ES'));
    await screen.findByText('El informe guardado no está disponible o ha cambiado. Ábralo de nuevo en Mis informes.');
    expect(mocks.resolve).toHaveBeenCalledTimes(1);
  });
  it.each(['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'])('recognizes the primary business Gmail for %s without editing onboarding', async reportType => {
    const profileScope = resolveReportSenderScope({ accountType: 'professional', professionalProfile: { cardPriorityB: 'primary' } });
    const payload = { resolved: { personal: { email: '' }, professional: { email: 'synthetic@gmail.com' } } };
    mocks.loadRecipients.mockImplementation(async (userId, scope) => ({ userId, senderEmail: resolveSenderProfile(payload, scope).email, recipients: null }));
    const openRegistration = vi.fn();
    render(<ReportDeliveryModal reference={{ ...reference, reportType }} userId="a" profileScope={profileScope} onOpenProfileRegistration={openRegistration} onClose={vi.fn()} />);
    await screen.findByRole('button', { name: 'Connect test mailbox' });
    expect(screen.getByText('synthetic@gmail.com')).toBeTruthy();
    expect(mocks.loadRecipients).toHaveBeenCalledWith('a', 'professional');
    expect(screen.queryByRole('link', { name: 'Edit email in active profile registration' })).toBeNull();
    expect(openRegistration).not.toHaveBeenCalled();
    expect(mocks.saveRecipients).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('sends the edited subject and body, keeps them on review, and locks the confirmed message', async () => {
    mocks.loadRecipients.mockResolvedValue({userId:'a',senderEmail:'synthetic@gmail.com',recipients:{to:'board@example.invalid',cc:'',bcc:''}});
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button',{name:'Connect test mailbox'}));
    fireEvent.click(screen.getByText('Message content'));
    fireEvent.change(screen.getByLabelText('Subject'),{target:{value:'Opportunity for my Trello board'}});
    fireEvent.change(screen.getByLabelText('Message'),{target:{value:'My notes\nPlease review the attached property report.'}});
    const prepare=screen.getByRole('button',{name:'Prepare Gmail email'});
    await waitFor(()=>expect(prepare.disabled).toBe(false));fireEvent.click(prepare);
    await screen.findByRole('button',{name:'Confirm Gmail send'});
    expect(screen.getByLabelText('Message').disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Edit recipients and message'}));
    expect(screen.getByLabelText('Message').value).toContain('My notes');
    fireEvent.change(screen.getByLabelText('Message'),{target:{value:'Final edited message'}});
    fireEvent.click(screen.getByRole('button',{name:'Prepare Gmail email'}));
    fireEvent.click(await screen.findByRole('button',{name:'Confirm Gmail send'}));
    await screen.findByText(/Gmail accepted/);
    expect(mocks.send.mock.calls[0][1].message).toEqual({subject:'Opportunity for my Trello board',body:'Final edited message'});
    expect(screen.getByLabelText('Message').disabled).toBe(true);
  });
  it.each([['PROPERTY_RELEASE','Basic'],['MAXXIS_ANALYSIS','PRO'],['DEAL_INTELLIGENCE','Enterprise']])('shows the public name for %s',async(reportType,name)=>{
    render(<ReportDeliveryModal reference={{...reference,reportType}} userId="a" onClose={vi.fn()} />);
    await screen.findByText('Message content');
    expect(screen.getByRole('heading').textContent).toBe(`Deliver prepared report · ${name}`);
    expect(screen.getByLabelText('Subject').value).toContain(`DealSifter · ${name}`);
    expect(screen.getByLabelText('Message').value).not.toMatch(/\bL[123]\b/);
  });
  it('T1/T2/T3/T7/T8/T10: confirmed Gmail send attaches the original PDF without download or mailto; duplicate click is ignored', async () => {
    mocks.loadRecipients.mockResolvedValue({ userId: 'a', senderEmail: 'synthetic@gmail.com', recipients: null });
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect test mailbox' }));
    const button = await screen.findByRole('button', { name: 'Prepare Gmail email' });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.change(screen.getByTestId('report-delivery-to'), { target: { value: 'qa@example.invalid' } });
    fireEvent.click(button); fireEvent.click(button);
    const confirm = await screen.findByRole('button', { name: 'Confirm Gmail send' });
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(confirm); fireEvent.click(confirm);
    await screen.findByText(/Gmail accepted the message/);
    expect(screen.getByRole('button',{name:'Sent through Gmail'}).disabled).toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0][1]).toMatchObject({ reference, confirmSend: true, pdfBase64: btoa('%PDF-1.7\nfixture content\n%%EOF') });
    expect(mocks.saveRecipients).toHaveBeenCalledExactlyOnceWith('a', { to: 'qa@example.invalid', cc: '', bcc: '' });
    expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled(); // No translation/AI acquisition for email delivery.
    expect(screen.queryByText('Choose the report type')).toBeNull();
  });
  it('recovers registered recipients first and shows the login email as the expected sender', async () => {
    mocks.loadRecipients.mockResolvedValue({ userId: 'a', senderEmail: 'qa-a@example.invalid', recipients: { to: 'board@boards.trello.example.invalid', cc: 'copy@example.invalid', bcc: '' } });
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('report-delivery-to').value).toBe('board@boards.trello.example.invalid'));
    expect(screen.getByTestId('report-delivery-cc').value).toBe('copy@example.invalid');
    expect(screen.getByText('qa-a@example.invalid')).toBeTruthy(); expect(mocks.draft).not.toHaveBeenCalled();
  });
  it('T4: cancelling does not render, download or destroy the saved report', async () => {
    const close = vi.fn(); render(<ReportDeliveryModal reference={reference} userId="a" onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close', exact: true }));
    expect(close).toHaveBeenCalledTimes(1); expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.render).not.toHaveBeenCalled();
  });
  it('T9/T10: explicit download uses original snapshot, language and grant once', async () => {
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Download this PDF' });
    await waitFor(() => expect(button.disabled).toBe(false)); fireEvent.click(button); fireEvent.click(button);
    await screen.findByText('PDF download requested.');
    expect(mocks.render).toHaveBeenCalledTimes(1); expect(mocks.render.mock.calls[0][0].schema.reportType).toBe('DEAL_INTELLIGENCE');
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith({ pageCount: 4, binary: new TextEncoder().encode('%PDF-1.7\nfixture content\n%%EOF') }, 'maxxis-deal_intelligence-report-a.pdf');
  });
  it('T11: revalidation failure prevents disclosure even after the modal opened', async () => {
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Download this PDF' }); await waitFor(() => expect(button.disabled).toBe(false));
    mocks.resolve.mockRejectedValue(new Error('REPORT_DELIVERY_STALE')); fireEvent.click(button);
    await screen.findByRole('alert'); expect(mocks.draft).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
  });
  it('blocks QA accounts instead of opening Outlook with an unrelated sender', async () => {
    const open = vi.spyOn(window, 'open');
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    await screen.findByText(/QA .invalid profile addresses/);
    expect(screen.getByRole('button', { name: 'Prepare Gmail email' }).disabled).toBe(true);
    expect(open).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.draft).not.toHaveBeenCalled();
    open.mockRestore();
  });
  it.each(['synthetic@hotmail.com', 'synthetic@outlook.com'])('explains provider support without labelling the real account %s as QA', async senderEmail => {
    mocks.loadRecipients.mockResolvedValue({ userId: 'a', senderEmail, recipients: null });
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    await screen.findByText(/Email delivery is available only for Google Gmail accounts/);
    expect(screen.queryByText(/QA .invalid profile addresses/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect test mailbox' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Prepare Gmail email' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Download this PDF' }).disabled).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('opens active-profile registration explicitly without changing email or sending a message', async () => {
    setLang('pt-BR');
    mocks.loadRecipients.mockResolvedValue({ userId: 'a', senderEmail: 'synthetic@hotmail.com', recipients: null });
    const onClose = vi.fn(), openRegistration = vi.fn();
    render(<ReportDeliveryModal reference={{ ...reference, language: 'pt' }} userId="a" onClose={onClose} onOpenProfileRegistration={openRegistration} />);
    const link = await screen.findByRole('link', { name: 'Editar email no cadastro do perfil ativo' });
    expect(link.getAttribute('href')).toBe('#onboarding');
    expect(openRegistration).not.toHaveBeenCalled();
    expect(screen.getByText(/Seu email de login permanece inalterado/)).toBeTruthy();
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openRegistration).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.saveRecipients).not.toHaveBeenCalled();
  });
  it('refuses silently missing photos before presenting a send confirmation', async () => {
    mocks.loadRecipients.mockResolvedValue({ userId: 'a', senderEmail: 'synthetic@gmail.com', recipients: { to: 'qa@example.invalid', cc: '', bcc: '' } });
    mocks.resolve.mockResolvedValue({ schema: { reportType: 'DEAL_INTELLIGENCE', sections: { propertySummary: { data: { images: ['https://images.example.invalid/photo.jpg'] } } } }, report: {}, entitlements: { PDF: {} } });
    render(<ReportDeliveryModal reference={reference} userId="a" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect test mailbox' }));
    const button = screen.getByRole('button', { name: 'Prepare Gmail email' });
    await waitFor(() => expect(button.disabled).toBe(false)); fireEvent.click(button);
    await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: 'Confirm Gmail send' })).toBeNull();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

 it('Property Release attaches PDF and photos after explicit confirmation without Outlook or local download', async () => {
  mocks.loadRecipients.mockResolvedValue({userId:'a',senderEmail:'synthetic@gmail.com',recipients:{to:'board@example.invalid',cc:'',bcc:''}});
  const ref={...reference,reportType:'PROPERTY_RELEASE'},prepared={schema:{reportType:'PROPERTY_RELEASE',sections:{propertySummary:{available:true,data:{id:'property-a',images:['https://example.invalid/a.jpg']}}}},report:{},sourceFingerprint:'source-fingerprint',entitlements:{PDF:{allowed:true}},includePublisher:false};
  mocks.release.mockResolvedValue(prepared);mocks.photos.mockResolvedValue(['data:image/jpeg;base64,'+btoa('\xff\xd8\xffsynthetic')]);
  render(<ReportDeliveryModal reference={ref} userId="a" propertyRelease={prepared} onClose={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button',{name:'Connect test mailbox'}));const button=screen.getByRole('button',{name:'Prepare Gmail email'});await waitFor(()=>expect(button.disabled).toBe(false));fireEvent.click(button);
  const confirm=await screen.findByRole('button',{name:'Confirm Gmail send'});expect(mocks.send).not.toHaveBeenCalled();fireEvent.click(confirm);
  await screen.findByText(/Gmail accepted the message/);expect(mocks.send.mock.calls[0][1]).toMatchObject({reference:ref,releaseSchema:prepared.schema,releaseSourceFingerprint:'source-fingerprint',confirmSend:true,photos:[{type:'image/jpeg',base64:btoa('\xff\xd8\xffsynthetic')}]});expect(mocks.download).not.toHaveBeenCalled();expect(mocks.draft).not.toHaveBeenCalled();expect(mocks.prepare).not.toHaveBeenCalled();
 });

it.each(['MAXXIS_ANALYSIS','DEAL_INTELLIGENCE'])('prepares and confirms the saved %s email without changing its level; accepted state is terminal',async reportType=>{
 mocks.loadRecipients.mockResolvedValue({userId:'a',senderEmail:'synthetic@gmail.com',recipients:{to:'board@example.invalid',cc:'',bcc:''}});
 mocks.resolve.mockResolvedValue({schema:{reportType,sections:{propertySummary:{available:true,data:{id:'property-a',images:[]}}}},report:{createdAt:'2026-11-17'},entitlements:{PDF:{allowed:true}}});
 const ref={...reference,reportType};render(<ReportDeliveryModal reference={ref} userId="a" onClose={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Connect test mailbox'}));const prepare=screen.getByRole('button',{name:'Prepare Gmail email'});await waitFor(()=>expect(prepare.disabled).toBe(false));fireEvent.click(prepare);const confirm=await screen.findByRole('button',{name:'Confirm Gmail send'});expect(mocks.send).not.toHaveBeenCalled();fireEvent.click(confirm);const completed=await screen.findByRole('button',{name:'Sent through Gmail'});expect(completed.disabled).toBe(true);expect(mocks.send.mock.calls[0][1].reference.reportType).toBe(reportType);expect(mocks.draft).not.toHaveBeenCalled();expect(mocks.render.mock.calls[0][0].schema.reportType).toBe(reportType);
});
