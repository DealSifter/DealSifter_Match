import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { resolveReportDelivery } from './reportDelivery';
import { loadReportRecipientPreferences, saveReportRecipientPreferences } from '../../../services/reportRecipientPreferences';
import { sendPreparedReportEmail } from '../../../services/reportMailboxService';
import { prepareReportNarrativePresentation } from '../presentation/reportNarrativePresentation';
import { prepareReportAssets } from '../export/reportPreparedAssets.ts';
import { prepareReportMaps } from '../export/reportMapAssets';
import { renderMaxxisReportPdfCached, downloadMaxxisReportPdf } from '../export/maxxisReportPdf';
import { buildReportEmailContent } from '../../../../supabase/functions/_shared/mailbox/reportEmailContent.ts';
import { mailRecipients, validateMailAttachments } from '../../../../supabase/functions/_shared/mailbox/reportMailDelivery.ts';
import { GmailConnectionPanel } from './GmailConnectionPanel';
import {resolvePropertyReleaseDelivery} from '../../../services/propertyReleaseMailService';
import './ReportDeliveryModal.css';
function base64(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let value = '';
  for (let i = 0; i < data.length; i += 8192) value += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(value);
}
export function ReportDeliveryModal({ reference, userId, onClose, propertyRelease = null }) {
  const resolveDelivery = useCallback((ref, actor) => propertyRelease ? resolvePropertyReleaseDelivery(propertyRelease, ref, actor) : resolveReportDelivery(ref, actor), [propertyRelease]);
  const text = useCallback((en, pt, es = en) => reference.language === 'pt' ? pt : reference.language === 'es' ? es : en, [reference.language]);
  const [prepared, setPrepared] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [recipients, setRecipients] = useState({ to: '', cc: '', bcc: '' });
  const [account, setAccount] = useState(null), [recipientLoading, setRecipientLoading] = useState(true);
  const [mailbox, setMailbox] = useState(null), [includePhotos, setIncludePhotos] = useState(true);
  const [envelope, setEnvelope] = useState(null), [outcome, setOutcome] = useState(null), [downloaded, setDownloaded] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    loadReportRecipientPreferences(userId).then(value => {
      if (!alive.current) return;
      setAccount(value); if (value.recipients) setRecipients(value.recipients);
    }).catch(() => { if (alive.current) setError(text('Saved recipients could not be recovered. Close and retry.', 'Não foi possível recuperar os destinatários salvos. Feche e tente novamente.')); })
      .finally(() => { if (alive.current) setRecipientLoading(false); });
    resolveDelivery(reference, userId).then(value => { if (alive.current) setPrepared(value); })
      .catch(() => { if (alive.current) setError(text('The saved report is unavailable or has changed. Reopen it in My Reports.', 'O relatório salvo está indisponível ou mudou. Reabra em Meus Relatórios.')); });
    return () => { alive.current = false; };
  }, [reference, userId, text, resolveDelivery]);
  const property = prepared?.schema?.sections?.propertySummary?.data;
  const gmailAccount = /@(gmail|googlemail)\.com$/i.test(account?.senderEmail || '');
  const connected = mailbox?.status === 'CONNECTED' && mailbox.mailbox_email?.toLowerCase() === account?.senderEmail?.toLowerCase();
  const photoCount = Math.min(5, property?.images?.length || 0);
  const level = reference.reportType === 'PROPERTY_RELEASE' ? 'L1' : reference.reportType === 'DEAL_INTELLIGENCE' ? 'L3' : 'L2';
  const content = prepared ? buildReportEmailContent(prepared.schema, reference) : null;
  const act = async action => {
    if (lock.current || !prepared) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const value = await resolveDelivery(reference, userId);
      if (!alive.current) return;
      if (action === 'send' || action === 'retry') {
        if (!envelope || !connected || (outcome && !(action === 'retry' && outcome.state === 'FAILED'))) throw new Error('GMAIL_RECONNECT_REQUIRED');
        const result = await sendPreparedReportEmail(userId, { ...envelope, confirmSend: true, ...(action === 'retry' ? { retryFailed: true } : {}) });
        if (alive.current) setOutcome(result);
      } else {
        if (action === 'prepare') {
          if (!connected || account?.userId !== userId) throw new Error('GMAIL_RECONNECT_REQUIRED');
          mailRecipients(recipients);
        }
        let photos = [];
        if (action === 'download') await prepareReportNarrativePresentation(value.schema, reference.language);
        else {
          // Delivery reuses saved/cached text. No translation/AI acquisition is started for email.
          const [readyPhotos] = await Promise.all([prepareReportAssets(value.schema), prepareReportMaps(value.schema, reference.language)]);
          if (includePhotos) photos = readyPhotos;
        }
        if (action === 'prepare' && includePhotos && photos.length !== photoCount) throw new Error('PROPERTY_PHOTOS_UNAVAILABLE');
        const rendered = await renderMaxxisReportPdfCached({ schema: value.schema, exportEntitlement: value.entitlements.PDF,
          generatedAt: value.report.createdAt, language: reference.language, ...(propertyRelease ? {includePublisher: propertyRelease.includePublisher} : {}) });
        await resolveDelivery(reference, userId);
        if (!alive.current) return;
        if (rendered.state !== 'RENDERED') throw new Error('REPORT_DELIVERY_PDF_FAILED');
        if (action === 'download') {
          if (!downloadMaxxisReportPdf(rendered.document, `maxxis-${reference.reportType.toLowerCase()}-${reference.reportId}.pdf`)) throw new Error('REPORT_DELIVERY_PDF_FAILED');
          setDownloaded(true);
        } else {
          const nextEnvelope = { reference, ...(propertyRelease ? { releaseSchema: value.schema, releaseSourceFingerprint: value.sourceFingerprint } : {}), recipients: { ...recipients }, pdfBase64: base64(rendered.document.binary),
            photos: photos.map(data => ({ type: data.slice(5, data.indexOf(';')).replace('image/jpg', 'image/jpeg'), base64: data.slice(data.indexOf(',') + 1) })) };
          validateMailAttachments(nextEnvelope, value.schema);
          await saveReportRecipientPreferences(userId, recipients);
          if (!alive.current) return;
          setEnvelope(nextEnvelope);
        }
      }
    } catch (failure) {
      const messages = {
        INVALID_RECIPIENTS: text('Enter valid recipients (up to 10), without line breaks.', 'Informe destinatários válidos (até 10), sem quebras de linha.'),
        PROPERTY_PHOTOS_UNAVAILABLE: text('Some photos could not be prepared. Retry or deselect photos to send only the PDF.', 'Algumas fotos não puderam ser preparadas. Tente novamente ou desmarque as fotos para enviar somente o PDF.'),
        GMAIL_RECONNECT_REQUIRED: text('Connect the Gmail matching your confirmed account before sending.', 'Conecte o Gmail igual ao email confirmado da sua conta antes de enviar.'),
        ATTACHMENTS_TOO_LARGE: text('Attachments exceed the email limit. Deselect photos and prepare again.', 'Os anexos excedem o limite de email. Desmarque as fotos e prepare novamente.'),
      };
      if (alive.current) setError(messages[failure.message] || text('The action could not be confirmed. Check the report and connection before retrying. No new analysis was started.', 'Não foi possível confirmar a ação. Confira o relatório e a conexão antes de repetir. Nenhuma nova análise foi iniciada.'));
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  };
  return <Modal onClose={onClose} maxWidth={680} overlayStyle={{ pointerEvents: 'auto' }} ariaLabel={text('Deliver prepared report', 'Entregar relatório preparado')} contentStyle={{ padding: 22 }}>
    <div className="report-delivery" data-testid="maxxis-report-delivery">
      <h2 className="report-delivery-heading">{text('Deliver prepared report', 'Entregar relatório preparado')} · {level}</h2>
      <div className="report-delivery-summary"><span className="report-delivery-property">{property?.address || property?.title || reference.propertyId}</span>
        <span className="report-delivery-caption" role="status">{prepared ? propertyRelease ? text('Property Release · current authorized property', 'Relatório básico · imóvel autorizado atual') : text('Saved report · same level and confirmed scenario', 'Relatório salvo · mesmo nível e cenário confirmado') : text('Checking report…', 'Conferindo relatório…')}</span></div>
      {recipientLoading ? <span role="status" className="report-delivery-caption">{text('Recovering saved recipients…', 'Recuperando destinatários salvos…')}</span> : null}
      {gmailAccount ? <GmailConnectionPanel key={userId} userId={userId} language={reference.language} onConnectionChange={setMailbox} />
        : account ? <div className="report-delivery-alert">{text('QA .invalid accounts have no mailbox and cannot send email. Sign in with your confirmed Gmail account. You can still download this PDF.', 'Contas QA .invalid não têm caixa e não podem enviar email. Entre com sua conta Gmail confirmada. Você ainda pode baixar este PDF.')}</div> : null}
      {account?.senderEmail ? <p className="report-delivery-caption">{text('Account sender', 'Remetente da conta')}: <strong>{account.senderEmail}</strong></p> : null}
      <div className="report-delivery-recipients">{['to', 'cc', 'bcc'].map(field => <label key={field}><span>{field === 'to' ? text('To', 'Para') : field === 'cc' ? 'Cc' : text('Bcc', 'Cco')}</span>
        <input data-testid={`report-delivery-${field}`} type="text" inputMode="email" autoComplete="off" value={recipients[field]} disabled={busy || recipientLoading || Boolean(envelope) || Boolean(outcome)}
          onChange={event => setRecipients(current => ({ ...current, [field]: event.target.value }))} /></label>)}</div>
      {!envelope && photoCount > 0 ? <label className="report-delivery-choice"><input type="checkbox" checked={includePhotos} disabled={busy} onChange={event => setIncludePhotos(event.target.checked)} />{text(`Attach property photos (up to ${photoCount})`, `Anexar fotos do imóvel (até ${photoCount})`)}</label> : null}
      {prepared && !photoCount ? <p className="report-delivery-caption">{text('This report version contains no property photos to attach.', 'Esta versão do relatório não contém fotos do imóvel para anexar.')}</p> : null}
      <p className="report-delivery-caption">{text('The PDF is attached automatically. The message includes property details, notes and photo links for your CRM. Review before confirming.', 'O PDF será anexado automaticamente. A mensagem inclui dados do imóvel, notas e links das fotos para seu CRM. Revise antes de confirmar.')}</p>
      {content ? <details open={Boolean(envelope)}><summary>{text('Message content', 'Conteúdo da mensagem')}</summary><p className="report-delivery-caption"><strong>{content.subject}</strong></p><div className="report-delivery-body">{content.body}</div></details> : null}
      {envelope ? <div className="report-delivery-caption" role="status">{text('Attachments ready', 'Anexos preparados')}: PDF{envelope.photos.length ? ` + ${envelope.photos.length} ${text('photos', 'fotos')}` : ''}</div> : null}
      {outcome ? <div role="status" className="report-delivery-alert">{outcome.state === 'ACCEPTED'
        ? text('Gmail accepted the message with attachments. Recipient delivery is not confirmed.', 'O Gmail aceitou a mensagem com os anexos. A entrega ao destinatário não está confirmada.')
        : outcome.state === 'FAILED' ? text('Gmail rejected the send. No automatic retry was made.', 'O Gmail rejeitou o envio. Não houve repetição automática.')
          : text('Send result is unconfirmed or still processing. Do not send again; a retry could duplicate the message.', 'O resultado do envio não foi confirmado ou ainda está em processamento. Não envie novamente; uma repetição poderia duplicar a mensagem.')}</div> : null}
      {downloaded ? <span role="status" className="report-delivery-caption">{text('PDF download requested.', 'Download do PDF solicitado.')}</span> : null}
      {error ? <div role="alert" className="report-delivery-alert">{error}</div> : null}
      <div className="report-delivery-actions"><button type="button" disabled={!prepared || busy} onClick={() => act('download')}>{text('Download this PDF', 'Baixar este PDF')}</button>
        {envelope && !outcome ? <button type="button" disabled={busy} onClick={() => setEnvelope(null)}>{text('Review recipients', 'Revisar destinatários')}</button> : null}
        <button className="report-delivery-primary" type="button" disabled={!prepared || busy || recipientLoading || !connected || Boolean(outcome && outcome.state !== 'FAILED')} onClick={() => act(outcome?.state === 'FAILED' ? 'retry' : envelope ? 'send' : 'prepare')}>{outcome?.state === 'ACCEPTED' ? text('Sent through Gmail', 'Enviado pelo Gmail') : outcome && outcome.state !== 'FAILED' ? text('Send pending verification', 'Envio pendente de verificação') : busy ? text('Preparing…', 'Preparando…') : outcome?.state === 'FAILED' ? text('Confirm retry', 'Confirmar nova tentativa') : envelope ? text('Confirm Gmail send', 'Confirmar envio pelo Gmail') : text('Prepare Gmail email', 'Preparar email Gmail')}</button>
        <button type="button" onClick={onClose}>{text('Close', 'Fechar')}</button></div>
    </div>
  </Modal>;
}
