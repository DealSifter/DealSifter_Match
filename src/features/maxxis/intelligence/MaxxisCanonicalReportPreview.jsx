import React, { useCallback, useEffect, useRef, useState } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import { renderMaxxisReportPdfCached } from '../export/maxxisReportPdf';
import './MaxxisCanonicalReportPreview.css';

const COPY = Object.freeze({
  en: Object.freeze({ open: 'Open investor report experience', hint: 'CLICK TO VIEW', page: 'Page', loading: 'Preparing the exact PDF preview…', failed: 'The report preview could not be prepared.' }),
  pt: Object.freeze({ open: 'Abrir experiência do relatório do investidor', hint: 'CLIQUE PARA VER', page: 'Página', loading: 'Preparando o preview exato do PDF…', failed: 'Não foi possível preparar o preview do relatório.' }),
  es: Object.freeze({ open: 'Abrir experiencia del informe del inversor', hint: 'CLIC PARA VER', page: 'Página', loading: 'Preparando la vista previa exacta del PDF…', failed: 'No se pudo preparar la vista previa del informe.' }),
});

const levelFor = (reportType) => reportType === 'DEAL_INTELLIGENCE' ? 3 : reportType === 'MAXXIS_ANALYSIS' ? 2 : 1;

function CanonicalPdfPage({ pdfDocument, pageNumber, pageLabel, onRendered, onError }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    let active = true;
    let renderTask = null;
    (async () => {
      const pdfPage = await pdfDocument.getPage(pageNumber);
      if (!active || !canvasRef.current) return;
      const density = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
      const viewport = pdfPage.getViewport({ scale: density });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      renderTask = pdfPage.render({ canvasContext: context, viewport });
      await renderTask.promise;
      if (active) onRendered(pageNumber);
    })().catch((error) => {
      if (active && error?.name !== 'RenderingCancelledException') onError();
    });
    return () => {
      active = false;
      renderTask?.cancel?.();
    };
  }, [onError, onRendered, pageNumber, pdfDocument]);

  return <canvas ref={canvasRef} aria-label={`${pageLabel} ${pageNumber} / ${pdfDocument.numPages}`} />;
}

export function MaxxisCanonicalReportPreview({ schema, language = 'en', exportEntitlements = {}, generatedAt = null }) {
  const [pdfDocument, setPdfDocument] = useState(null);
  const [activated, setActivated] = useState(false);
  const [renderedPages, setRenderedPages] = useState(0);
  const [status, setStatus] = useState('idle');
  const pdfEntitlement = exportEntitlements.PDF;
  const pdfEntitlementRef = useRef(pdfEntitlement);
  pdfEntitlementRef.current = pdfEntitlement;
  const pdfEntitlementKey = [
    pdfEntitlement?.allowed,
    pdfEntitlement?.state,
    pdfEntitlement?.reason,
    pdfEntitlement?.channel,
    pdfEntitlement?.reportType,
    pdfEntitlement?.accessLevel,
    pdfEntitlement?.accessSource,
  ].map((entry) => String(entry ?? '')).join(':');
  const t = COPY[language] || COPY.en;
  const level = levelFor(schema?.reportType);

  useEffect(() => {
    const entitlement = pdfEntitlementRef.current;
    if (!activated || !schema || schema.type !== 'maxxis_report_schema' || !entitlement) return undefined;
    let active = true;
    let loadingTask = null;
    let loadedDocument = null;
    setStatus('loading');
    setRenderedPages(0);
    setPdfDocument(null);
    (async () => {
      const rendered = await renderMaxxisReportPdfCached({
        schema,
        exportEntitlement: entitlement,
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
      setStatus('rendering');
    })().catch(() => {
      if (active) setStatus('failed');
    });
    return () => {
      active = false;
      loadingTask?.destroy?.();
      loadedDocument?.destroy?.();
    };
  }, [activated, schema, pdfEntitlementKey, generatedAt, language]);

  const handlePageRendered = useCallback(() => setRenderedPages((current) => current + 1), []);
  const handlePageError = useCallback(() => setStatus('failed'), []);

  useEffect(() => {
    if (pdfDocument && renderedPages >= pdfDocument.numPages) setStatus('ready');
  }, [pdfDocument, renderedPages]);

  if (!schema || schema.type !== 'maxxis_report_schema') return null;
  const total = pdfDocument?.numPages || schema.pages?.length || 1;

  return (
    <details className={`maxxis-report-preview maxxis-canonical-preview is-${schema.reportType.toLowerCase()}`} onToggle={(event) => { if (event.currentTarget.open) setActivated(true); }}>
      <summary>
        <span>{t.open}</span>
        <span className="maxxis-canonical-hint"><i aria-hidden="true" />{t.hint}</span>
        <b>LEVEL {level}</b>
      </summary>
      <div className="maxxis-canonical-stage" aria-live="polite">
        {status === 'loading' || status === 'rendering' || status === 'idle' ? <span className="maxxis-canonical-status">{t.loading}</span> : null}
        {status === 'failed' ? <span className="maxxis-canonical-status is-error">{t.failed}</span> : null}
        {pdfDocument ? (
          <div className={`maxxis-canonical-pages${status === 'ready' ? ' is-ready' : ''}`} aria-label={`${total} ${t.page.toLowerCase()}`}>
            {Array.from({ length: total }, (_, index) => (
              <CanonicalPdfPage
                key={index + 1}
                pdfDocument={pdfDocument}
                pageNumber={index + 1}
                pageLabel={t.page}
                onRendered={handlePageRendered}
                onError={handlePageError}
              />
            ))}
          </div>
        ) : null}
        {status === 'ready' ? <span className="maxxis-canonical-complete" aria-hidden="true">{renderedPages}/{total}</span> : null}
      </div>
    </details>
  );
}
