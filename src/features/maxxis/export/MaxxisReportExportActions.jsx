import React, { useState } from 'react';
import { Download, Mail, Share2 } from 'lucide-react';
import { downloadMaxxisReportPdf, renderMaxxisReportPdf } from './maxxisReportPdf';
import { buildReportMailtoUrl } from './reportDeliveryUtils';
import './MaxxisReportExportActions.css';

const COPY = Object.freeze({
  en: Object.freeze({
    label: 'Report actions', pdf: 'Export PDF', email: 'Send Email', share: 'Share', generating: 'Generating report…',
    ready: 'PDF downloaded.', emailReady: 'PDF downloaded. Your email app is opening — attach the downloaded file.',
    shared: 'Report shared.', copied: 'Sharing is unavailable here. The PDF was downloaded and a summary was copied.',
    failed: 'Could not prepare the report. Please try again.', subject: 'DealSifter investor report',
    body: 'Your DealSifter report is ready. Attach the PDF that was downloaded with this message.',
  }),
  pt: Object.freeze({
    label: 'Ações do relatório', pdf: 'Gerar PDF', email: 'Enviar por email', share: 'Compartilhar', generating: 'Gerando relatório…',
    ready: 'PDF baixado.', emailReady: 'PDF baixado. Seu aplicativo de email será aberto — anexe o arquivo baixado.',
    shared: 'Relatório compartilhado.', copied: 'O compartilhamento não está disponível aqui. O PDF foi baixado e um resumo foi copiado.',
    failed: 'Não foi possível preparar o relatório. Tente novamente.', subject: 'Relatório de investimento DealSifter',
    body: 'Seu relatório DealSifter está pronto. Anexe a este email o PDF que acabou de ser baixado.',
  }),
  es: Object.freeze({
    label: 'Acciones del informe', pdf: 'Generar PDF', email: 'Enviar por email', share: 'Compartir', generating: 'Generando informe…',
    ready: 'PDF descargado.', emailReady: 'PDF descargado. Se abrirá su aplicación de correo — adjunte el archivo descargado.',
    shared: 'Informe compartido.', copied: 'Compartir no está disponible aquí. Se descargó el PDF y se copió un resumen.',
    failed: 'No se pudo preparar el informe. Inténtelo de nuevo.', subject: 'Informe de inversión DealSifter',
    body: 'Su informe DealSifter está listo. Adjunte a este correo el PDF que acaba de descargar.',
  }),
});

const reportFileName = (schema) => `maxxis-${String(schema?.reportType || 'report').toLowerCase().replaceAll('_', '-')}.pdf`;

function openEmailDraft(url) {
  const anchor = window.document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function MaxxisReportExportActions({ schema, exportEntitlements = {}, language = 'en', onPrepared = null }) {
  const [busyChannel, setBusyChannel] = useState(null);
  const [status, setStatus] = useState('');
  const copy = COPY[language] || COPY.en;

  const renderDocument = async () => {
    const result = await renderMaxxisReportPdf({ schema, exportEntitlement: exportEntitlements.PDF, language });
    if (result.state !== 'RENDERED') throw new Error('REPORT_PDF_RENDER_FAILED');
    return result.document;
  };

  const runAction = async (channel) => {
    if (busyChannel || !exportEntitlements[channel]?.allowed) return;
    setBusyChannel(channel);
    setStatus(copy.generating);
    try {
      const document = await renderDocument();
      const fileName = reportFileName(schema);
      if (channel === 'PDF') {
        downloadMaxxisReportPdf(document, fileName);
        setStatus(copy.ready);
      } else if (channel === 'EMAIL') {
        downloadMaxxisReportPdf(document, fileName);
        openEmailDraft(buildReportMailtoUrl(copy));
        setStatus(copy.emailReady);
      } else {
        const file = typeof File === 'function' ? new File([document.binary], fileName, { type: 'application/pdf' }) : null;
        if (file && navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          try {
            await navigator.share({ title: copy.subject, text: copy.body, files: [file] });
            setStatus(copy.shared);
          } catch (error) {
            if (error?.name === 'AbortError') throw error;
            downloadMaxxisReportPdf(document, fileName);
            try { await navigator.clipboard?.writeText(`${copy.subject}\n${copy.body}`); } catch { /* Download remains the reliable fallback. */ }
            setStatus(copy.copied);
          }
        } else {
          downloadMaxxisReportPdf(document, fileName);
          try { await navigator.clipboard?.writeText(`${copy.subject}\n${copy.body}`); } catch { /* Download remains the reliable fallback. */ }
          setStatus(copy.copied);
        }
      }
      onPrepared?.({ channel, reportType: schema.reportType, state: 'DELIVERED_LOCALLY' });
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus(copy.failed);
    } finally {
      setBusyChannel(null);
    }
  };

  const actions = [
    ['PDF', copy.pdf, Download],
    ['EMAIL', copy.email, Mail],
    ['SHARE', copy.share, Share2],
  ];
  return <section className="maxxis-report-export-actions" aria-label={copy.label}>
    <strong>{copy.label}</strong>
    <div>{actions.map(([code, label, ActionIcon]) => <button
      key={code}
      type="button"
      disabled={Boolean(busyChannel) || !exportEntitlements[code]?.allowed || !exportEntitlements.PDF?.allowed}
      onClick={() => runAction(code)}
    >{React.createElement(ActionIcon, { 'aria-hidden': true, size: 16 })}<span>{busyChannel === code ? copy.generating : label}</span></button>)}</div>
    {status ? <small role="status">{status}</small> : null}
  </section>;
}
