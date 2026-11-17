const CODES = new Set([
  'REPORT_PDF_RENDER_FAILED', 'REPORT_PDF_WORKER_UNAVAILABLE', 'REPORT_PDF_WORKER_FAILED',
  'REPORT_PDF_WORKER_MESSAGE_FAILED', 'REPORT_PDF_WORKER_TIMEOUT', 'REPORT_REFERENCE_BASIC_OVERFLOW',
  'REPORT_PAGE_LIMIT_EXCEEDED', 'REPORT_REFERENCE_BLOCK_EXCEEDS_PAGE', 'REPORT_TEXT_OUTSIDE_BOUNDS',
  'REPORT_DISPLAY_OUTSIDE_BOUNDS', 'PROPERTY_RELEASE_RENDER_FAILED', 'PROPERTY_RELEASE_DOWNLOAD_FAILED',
  'REPORT_PROPERTY_IDENTITY_MISMATCH',
  'REPORT_TRACE_UNAVAILABLE',
]);

/** Never expose arbitrary exception text, contacts, or listing values. */
export function reportPdfFailureCode(error) {
  const code = String(typeof error === 'string' ? error : error?.message || '').split(':')[0];
  return CODES.has(code) ? code : 'REPORT_PDF_RENDER_FAILED';
}

export function canRenderBasicWithoutWorker(reportType, error) {
  return reportType === 'PROPERTY_RELEASE' && ['REPORT_PDF_WORKER_UNAVAILABLE', 'REPORT_PDF_WORKER_FAILED'].includes(reportPdfFailureCode(error));
}

export function propertyReleaseFailureMessage(error, language = 'en') {
  const code = reportPdfFailureCode(error), pt = /^pt/i.test(language), es = /^es/i.test(language);
  const overflow = ['REPORT_REFERENCE_BASIC_OVERFLOW', 'REPORT_PAGE_LIMIT_EXCEEDED', 'REPORT_REFERENCE_BLOCK_EXCEEDS_PAGE'].includes(code);
  const message = overflow
    ? pt ? 'Não foi possível distribuir todo o conteúdo na página do relatório básico.' : es ? 'No se pudo distribuir todo el contenido en la página del informe básico.' : 'The basic report could not fit all of its content on one page.'
    : code === 'REPORT_TRACE_UNAVAILABLE'
      ? pt ? 'Abra o app em HTTPS ou em um navegador atualizado para gerar o relatório.' : es ? 'Abre la app en HTTPS o en un navegador actualizado para generar el informe.' : 'Open the app over HTTPS or in an updated browser to generate the report.'
      : code === 'REPORT_PROPERTY_IDENTITY_MISMATCH'
      ? pt ? 'Os dados recebidos pertencem a outro imóvel. Reabra o imóvel e tente novamente.' : es ? 'Los datos recibidos pertenecen a otra propiedad. Vuelve a abrirla e inténtalo de nuevo.' : 'The received data belongs to another property. Reopen the property and try again.'
      : pt ? 'Não foi possível concluir o relatório. Recarregue a página e tente novamente.' : es ? 'No se pudo completar el informe. Recarga la página e inténtalo de nuevo.' : 'The report could not be completed. Reload the page and try again.';
  return `${message} [${code}]`;
}

/** Delivery preparation can fail before the renderer is reached. Never mislabel an access/save error as a PDF failure. */
export function propertyReleaseDeliveryFailureMessage(error, language = 'en') {
  const pt=/^pt/i.test(language),es=/^es/i.test(language);
  const code=String(error?.message||'');
  if(code==='REPORT_DELIVERY_UNAUTHORIZED') return pt?'Não foi possível confirmar o acesso a este imóvel. Reabra o Portfólio pelo contato desbloqueado.':es?'No se pudo confirmar el acceso. Vuelva a abrir la propiedad desde el contacto desbloqueado.':'Property access could not be confirmed. Reopen its portfolio from the unlocked contact.';
  if(['REPORT_RECIPIENT_SAVE_FAILED','REPORT_RECIPIENT_PREFERENCES_UNAVAILABLE'].includes(code)) return pt?'Não foi possível salvar os destinatários. Confira os endereços e tente novamente.':es?'No se pudieron guardar los destinatarios. Revise las direcciones e inténtelo de nuevo.':'Recipients could not be saved. Check the addresses and try again.';
  if(code==='REPORT_DELIVERY_STALE'||code==='REPORT_DELIVERY_CONTEXT_MISMATCH') return pt?'Os dados do imóvel mudaram. Reabra o imóvel para preparar o envio atualizado.':es?'Los datos cambiaron. Vuelva a abrir la propiedad para preparar el envío actualizado.':'Property data changed. Reopen the property to prepare an updated delivery.';
  return pt?'Não foi possível preparar o envio. Feche este painel e tente novamente. Nenhum email foi enviado.':es?'No se pudo preparar el envío. Cierre este panel e inténtelo de nuevo. No se envió ningún email.':'Email preparation failed. Close this panel and try again. No email was sent.';
}
