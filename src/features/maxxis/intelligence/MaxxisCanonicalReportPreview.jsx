import React, { useEffect, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { renderMaxxisReportPdf } from '../export/maxxisReportPdf';
import './MaxxisCanonicalReportPreview.css';

const COPY = Object.freeze({
  en: Object.freeze({ open: 'Open investor report experience', hint: 'CLICK TO VIEW', page: 'Page', loading: 'Preparing the exact PDF preview…', failed: 'The report preview could not be prepared.' }),
  pt: Object.freeze({ open: 'Abrir experiência do relatório do investidor', hint: 'CLIQUE PARA VER', page: 'Página', loading: 'Preparando o preview exato do PDF…', failed: 'Não foi possível preparar o preview do relatório.' }),
  es: Object.freeze({ open: 'Abrir experiencia del informe del inversor', hint: 'CLIC PARA VER', page: 'Página', loading: 'Preparando la vista previa exacta del PDF…', failed: 'No se pudo preparar la vista previa del informe.' }),
});

const levelFor = (reportType) => reportType === 'DEAL_INTELLIGENCE' ? 3 : reportType === 'MAXXIS_ANALYSIS' ? 2 : 1;

export function MaxxisCanonicalReportPreview({ schema, language = 'en', exportEntitlements = {}, generatedAt = null }) {
  const canvasRef = useRef(null);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('idle');
  const t = COPY[language] || COPY.en;
  const level = levelFor(schema?.reportType);

  useEffect(() => {
    if (!schema || schema.type !== 'maxxis_report_schema' || !exportEntitlements.PDF) return undefined;
    let active = true;
    let loadingTask = null;
    let loadedDocument = null;
    setStatus('loading');
    setPage(1);
    setPdfDocument(null);
    (async () => {
      const rendered = await renderMaxxisReportPdf({
        schema,
        exportEntitlement: exportEntitlements.PDF,
        generatedAt: generatedAt || undefined,
        language,
      });
      if (rendered.state !== 'RENDERED') throw new Error('REPORT_PREVIEW_RENDER_FAILED');
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      loadingTask = pdfjs.getDocument({ data: rendered.document.binary.slice() });
      loadedDocument = await loadingTask.promise;
      if (!active) return;
      setPdfDocument(loadedDocument);
      setStatus('ready');
    })().catch(() => {
      if (active) setStatus('failed');
    });
    return () => {
      active = false;
      loadingTask?.destroy?.();
      loadedDocument?.destroy?.();
    };
  }, [schema, exportEntitlements.PDF, generatedAt, language]);

  useEffect(() => {
    if (!pdfDocument || !canvasRef.current) return undefined;
    let active = true;
    let renderTask = null;
    (async () => {
      const pdfPage = await pdfDocument.getPage(page);
      if (!active || !canvasRef.current) return;
      const density = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
      const viewport = pdfPage.getViewport({ scale: density });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('aria-label', `${t.page} ${page} / ${pdfDocument.numPages}`);
      renderTask = pdfPage.render({ canvasContext: context, viewport });
      await renderTask.promise;
    })().catch((error) => {
      if (active && error?.name !== 'RenderingCancelledException') setStatus('failed');
    });
    return () => {
      active = false;
      renderTask?.cancel?.();
    };
  }, [pdfDocument, page, t.page]);

  if (!schema || schema.type !== 'maxxis_report_schema') return null;
  const total = pdfDocument?.numPages || schema.pages?.length || 1;
  const move = (offset) => setPage((current) => ((current - 1 + offset + total) % total) + 1);

  return (
    <details className={`maxxis-report-preview maxxis-canonical-preview is-${schema.reportType.toLowerCase()}`}>
      <summary>
        <span>{t.open}</span>
        <span className="maxxis-canonical-hint"><i aria-hidden="true" />{t.hint}</span>
        <b>LEVEL {level}</b>
      </summary>
      <div className="maxxis-canonical-stage" aria-live="polite">
        {status === 'loading' || status === 'idle' ? <span className="maxxis-canonical-status">{t.loading}</span> : null}
        {status === 'failed' ? <span className="maxxis-canonical-status is-error">{t.failed}</span> : null}
        {status === 'ready' && total > 1 ? (
          <div className="maxxis-canonical-navigation">
            <button type="button" className="maxxis-canonical-arrow is-previous" aria-label={`${t.page} ${page === 1 ? total : page - 1}`} onClick={() => move(-1)}>‹</button>
            <button type="button" className="maxxis-canonical-arrow is-next" aria-label={`${t.page} ${page === total ? 1 : page + 1}`} onClick={() => move(1)}>›</button>
          </div>
        ) : null}
        <canvas ref={canvasRef} hidden={status !== 'ready'} />
        {status === 'ready' ? <b className="maxxis-canonical-page">{t.page} {page} / {total}</b> : null}
      </div>
    </details>
  );
}
