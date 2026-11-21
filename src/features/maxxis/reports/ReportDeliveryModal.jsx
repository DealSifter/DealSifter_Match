import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { resolveReportDelivery } from './reportDelivery';
import { loadReportRecipientPreferences, saveReportRecipientPreferences } from '../../../services/reportRecipientPreferences';
import { sendPreparedReportEmail } from '../../../services/reportMailboxService';
import { prepareReportNarrativePresentation } from '../presentation/reportNarrativePresentation';
import { prepareReportAssets } from '../export/reportPreparedAssets.ts';
import { prepareReportMaps } from '../export/reportMapAssets';
import { renderMaxxisReportPdfCached, downloadMaxxisReportPdf } from '../export/maxxisReportPdf';
import { buildReportEmailContent, reportDisplayName, resolveReportEmailMessage } from '../../../../supabase/functions/_shared/mailbox/reportEmailContent.ts';
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
export function ReportDeliveryModal({ reference, userId, onClose, propertyRelease = null, onOpenProfileRegistration = null, profileScope = 'personal' }) {
  const resolveDelivery = useCallback((ref, actor) => propertyRelease ? resolvePropertyReleaseDelivery(propertyRelease, ref, actor) : resolveReportDelivery(ref, actor), [propertyRelease]);
  const text = useCallback((en, pt, es = en) => reference.language === 'pt' ? pt : reference.language === 'es' ? es : en, [reference.language]);
  const [prepared, setPrepared] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [recipients, setRecipients] = useState({ to: '', cc: '', bcc: '' });
  const [account, setAccount] = useState(null), [recipientLoading, setRecipientLoading] = useState(true);
  const [mailbox, setMailbox] = useState(null), [includePhotos, setIncludePhotos] = useState(true);
  const [envelope, setEnvelope] = useState(null), [outcome, setOutcome] = useState(null), [downloaded, setDownloaded] = useState(false);
  const [message, setMessage] = useState(null);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    loadReportRecipientPreferences(userId, profileScope).then(value => {
      if (!alive.current) return;
      setAccount(value); if (value.recipients) setRecipients(value.recipients);
    }).catch(() => { if (alive.current) setError(text('Saved recipients could not be recovered. Close and retry.', 'Não foi possível recuperar os destinatários salvos. Feche e tente novamente.')); })
      .finally(() => { if (alive.current) setRecipientLoading(false); });
    resolveDelivery(reference, userId).then(value => { if (alive.current) setPrepared(value); })
      .catch(() => { if (alive.current) setError(text('The saved report is unavailable or has changed. Reopen it in My Reports.', 'O relatório salvo está indisponível ou mudou. Reabra em Meus Relatórios.')); });
    return () => { alive.current = false; };
  }, [reference, userId, profileScope, text, resolveDelivery]);
  const property = prepared?.schema?.sections?.propertySummary?.data;
  const gmailAccount = /@(gmail|googlemail)\.com$/i.test(account?.senderEmail || '');
  const qaAccount = /\.invalid$/i.test((account?.senderEmail || '').trim());
  const connected = mailbox?.status === 'CONNECTED' && mailbox.mailbox_email?.toLowerCase() === account?.senderEmail?.toLowerCase();
  const photoCount = Math.min(5, property?.images?.length || 0);
  const level = reportDisplayName(reference.reportType);
  const content = prepared ? message || buildReportEmailContent(prepared.schema, reference) : null;
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
          resolveReportEmailMessage(buildReportEmailContent(value.schema, reference), content);
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
          const nextEnvelope = { reference, profileScope, message: resolveReportEmailMessage(buildReportEmailContent(value.schema, reference), content), ...(propertyRelease ? { releaseSchema: value.schema, releaseSourceFingerprint: value.sourceFingerprint } : {}), recipients: { ...recipients }, pdfBase64: base64(rendered.document.binary),
            photos: photos.map(data => ({ type: data.slice(5, data.indexOf(';')).replace('image/jpg', 'image/jpeg'), base64: data.slice(data.indexOf(',') + 1) })) };
          validateMailAttachments(nextEnvelope, value.schema);
          await saveReportRecipientPreferences(userId, recipients);
          if (!alive.current) return;
          setEnvelope(nextEnvelope);
        }
      }
    } catch (failure) {
      const messages = {
        INVALID_EMAIL_MESSAGE: text('Enter a subject (up to 240 characters, one line) and message (up to 60,000 characters).', 'Informe um assunto (até 240 caracteres, uma linha) e uma mensagem (até 60.000 caracteres).'),
        INVALID_RECIPIENTS: text('Enter valid recipients (up to 10), without line breaks.', 'Informe destinatários válidos (até 10), sem quebras de linha.'),
        PROPERTY_PHOTOS_UNAVAILABLE: text('Some photos could not be prepared. Retry or deselect photos to send only the PDF.', 'Algumas fotos não puderam ser preparadas. Tente novamente ou desmarque as fotos para enviar somente o PDF.'),
        GMAIL_RECONNECT_REQUIRED: text('Connect the Gmail registered in your active profile before sending.', 'Conecte o Gmail cadastrado no perfil ativo antes de enviar.'),
        MAILBOX_EMAIL_MISMATCH: text('The profile email changed or differs from the authorized Gmail. Reopen delivery and reconnect the Gmail registered in the profile.', 'O email do perfil mudou ou difere do Gmail autorizado. Reabra o envio e conecte o Gmail cadastrado no perfil.'),
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
      {gmailAccount ? <GmailConnectionPanel key={`${userId}:${profileScope}`} userId={userId} profileScope={profileScope} language={reference.language} onConnectionChange={setMailbox} />
        : account ? <div className="report-delivery-alert">{qaAccount
          ? text('QA .invalid profile addresses have no mailbox. Save a real Gmail in the active profile and authorize that mailbox to send. You can still download this PDF.', 'Emails de perfil QA .invalid não têm caixa postal. Cadastre um Gmail real no perfil ativo e autorize essa caixa para enviar. Você ainda pode baixar este PDF.')
          : <>
            {text('Email delivery is available only for Google Gmail accounts. To use it, update the primary email in your active profile registration to a Gmail address, save the registration and authorize that mailbox. You can still download this PDF.', 'O envio por email está disponível somente para contas Google (Gmail). Para utilizar, altere o email principal do perfil ativo para um Gmail, salve o cadastro e autorize essa caixa. Você pode baixar este PDF normalmente.', 'El envío por correo está disponible solo para cuentas Google (Gmail). Para utilizarlo, cambie el correo principal del perfil activo por un Gmail, guarde el registro y autorice ese buzón. Puede descargar este PDF.')}
            {onOpenProfileRegistration ? <p style={{ margin: '8px 0' }}><a href="#onboarding" onClick={event => { event.preventDefault(); onClose(); onOpenProfileRegistration(); }}>{text('Edit email in active profile registration', 'Editar email no cadastro do perfil ativo', 'Editar correo en el registro del perfil activo')}</a></p> : null}
            <p className="report-delivery-caption" style={{ margin: '8px 0 0' }}>{text('Your sign-in email stays unchanged. Authorize the Gmail registered in this profile to confirm mailbox ownership and enable sending.', 'Seu email de login permanece inalterado. Autorize o Gmail cadastrado neste perfil para confirmar a titularidade da caixa e permitir o envio.', 'Su correo de acceso permanece sin cambios. Autorice el Gmail registrado en este perfil para confirmar la titularidad del buzón y permitir el envío.')}</p>
          </>}</div> : null}
      {account?.senderEmail ? <p className="report-delivery-caption">{text('Active profile sender', 'Remetente do perfil ativo', 'Remitente del perfil activo')}: <strong>{account.senderEmail}</strong></p> : null}
      <div className="report-delivery-recipients">{['to', 'cc', 'bcc'].map(field => <label key={field}><span>{field === 'to' ? text('To', 'Para') : field === 'cc' ? 'Cc' : text('Bcc', 'Cco')}</span>
        <input data-testid={`report-delivery-${field}`} type="text" inputMode="email" autoComplete="off" value={recipients[field]} disabled={busy || recipientLoading || Boolean(envelope) || Boolean(outcome)}
          onChange={event => setRecipients(current => ({ ...current, [field]: event.target.value }))} /></label>)}</div>
      {!envelope && photoCount > 0 ? <label className="report-delivery-choice"><input type="checkbox" checked={includePhotos} disabled={busy} onChange={event => setIncludePhotos(event.target.checked)} />{text(`Attach property photos (up to ${photoCount})`, `Anexar fotos do imóvel (até ${photoCount})`)}</label> : null}
      {prepared && !photoCount ? <p className="report-delivery-caption">{text('This report version contains no property photos to attach.', 'Esta versão do relatório não contém fotos do imóvel para anexar.')}</p> : null}
      <p className="report-delivery-caption">{text('The PDF is attached automatically. The message includes property details, notes and photo links for your CRM. Review before confirming.', 'O PDF será anexado automaticamente. A mensagem inclui dados do imóvel, notas e links das fotos para seu CRM. Revise antes de confirmar.')}</p>
      {content ? <details open={Boolean(envelope)}><summary>{text('Message content', 'Conteúdo da mensagem', 'Contenido del mensaje')}</summary>
        <label>{text('Subject', 'Assunto', 'Asunto')}<input type="text" value={content.subject} maxLength={240} disabled={busy || Boolean(envelope) || Boolean(outcome)}
          onChange={event => setMessage({ ...content, subject: event.target.value })} /></label>
        <label>{text('Message', 'Mensagem', 'Mensaje')}<textarea className="report-delivery-body" value={content.body} maxLength={60000} rows={9} disabled={busy || Boolean(envelope) || Boolean(outcome)}
          onChange={event => setMessage({ ...content, body: event.target.value })} /></label>
        <p className="report-delivery-caption">{text('Edits apply only to this email. The attached PDF stays unchanged.', 'As edições valem somente para este email. O PDF anexado permanece inalterado.', 'Los cambios se aplican solo a este correo. El PDF adjunto no cambia.')}</p>
      </details> : null}
      {envelope ? <div className="report-delivery-caption" role="status">{text('Attachments ready', 'Anexos preparados')}: PDF{envelope.photos.length ? ` + ${envelope.photos.length} ${text('photos', 'fotos')}` : ''}</div> : null}
      {outcome ? <div role="status" className="report-delivery-alert">{outcome.state === 'ACCEPTED'
        ? text('Gmail accepted the message with attachments. Recipient delivery is not confirmed.', 'O Gmail aceitou a mensagem com os anexos. A entrega ao destinatário não está confirmada.')
        : outcome.state === 'FAILED' ? text('Gmail rejected the send. No automatic retry was made.', 'O Gmail rejeitou o envio. Não houve repetição automática.')
          : text('Send result is unconfirmed or still processing. Do not send again; a retry could duplicate the message.', 'O resultado do envio não foi confirmado ou ainda está em processamento. Não envie novamente; uma repetição poderia duplicar a mensagem.')}</div> : null}
      {downloaded ? <span role="status" className="report-delivery-caption">{text('PDF download requested.', 'Download do PDF solicitado.')}</span> : null}
      {error ? <div role="alert" className="report-delivery-alert">{error}</div> : null}
      <div className="report-delivery-actions"><button type="button" disabled={!prepared || busy} onClick={() => act('download')}>{text('Download this PDF', 'Baixar este PDF')}</button>
        {envelope && !outcome ? <button type="button" disabled={busy} onClick={() => setEnvelope(null)}>{text('Edit recipients and message', 'Editar destinatários e mensagem', 'Editar destinatarios y mensaje')}</button> : null}
        <button className="report-delivery-primary" type="button" disabled={!prepared || busy || recipientLoading || !connected || Boolean(outcome && outcome.state !== 'FAILED')} onClick={() => act(outcome?.state === 'FAILED' ? 'retry' : envelope ? 'send' : 'prepare')}>{outcome?.state === 'ACCEPTED' ? text('Sent through Gmail', 'Enviado pelo Gmail') : outcome && outcome.state !== 'FAILED' ? text('Send pending verification', 'Envio pendente de verificação') : busy ? text('Preparing…', 'Preparando…') : outcome?.state === 'FAILED' ? text('Confirm retry', 'Confirmar nova tentativa') : envelope ? text('Confirm Gmail send', 'Confirmar envio pelo Gmail') : text('Prepare Gmail email', 'Preparar email Gmail')}</button>
        <button type="button" onClick={onClose}>{text('Close', 'Fechar')}</button></div>
    </div>
  </Modal>;
}
