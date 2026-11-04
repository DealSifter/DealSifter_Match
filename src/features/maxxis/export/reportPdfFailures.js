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
    ? pt ? 'O conteúdo excede a página do relatório básico. Revise a descrição do imóvel.' : es ? 'El contenido supera la página del informe básico. Revisa la descripción de la propiedad.' : 'The content exceeds the basic report page. Review the property description.'
    : code === 'REPORT_TRACE_UNAVAILABLE'
      ? pt ? 'Abra o app em HTTPS ou em um navegador atualizado para gerar o relatório.' : es ? 'Abre la app en HTTPS o en un navegador actualizado para generar el informe.' : 'Open the app over HTTPS or in an updated browser to generate the report.'
      : code === 'REPORT_PROPERTY_IDENTITY_MISMATCH'
      ? pt ? 'Os dados recebidos pertencem a outro imóvel. Reabra o imóvel e tente novamente.' : es ? 'Los datos recibidos pertenecen a otra propiedad. Vuelve a abrirla e inténtalo de nuevo.' : 'The received data belongs to another property. Reopen the property and try again.'
      : pt ? 'Não foi possível concluir o relatório. Recarregue a página e tente novamente.' : es ? 'No se pudo completar el informe. Recarga la página e inténtalo de nuevo.' : 'The report could not be completed. Reload the page and try again.';
  return `${message} [${code}]`;
}
