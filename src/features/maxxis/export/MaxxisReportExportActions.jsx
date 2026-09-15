import React, { useMemo, useState } from 'react';
import { buildMaxxisReportExportPreview } from './maxxisReportExportPreview';
import { downloadMaxxisReportPdf, renderMaxxisReportPdf } from './maxxisReportPdf';
import './MaxxisReportExportActions.css';

const COPY = Object.freeze({
  en: Object.freeze({ pdf: 'Export PDF', email: 'Send Email', share: 'Share', preview: 'Report delivery preview', pages: 'pages', includes: 'Included Intelligence', access: 'Access Level', confirm: 'Confirm preparation', cancel: 'Cancel', prepared: 'Architecture prepared — no file, email, or link is generated in this phase.' }),
  pt: Object.freeze({ pdf: 'Exportar PDF', email: 'Enviar por email', share: 'Compartilhar', preview: 'Prévia de entrega do relatório', pages: 'páginas', includes: 'Inteligência incluída', access: 'Nível de acesso', confirm: 'Confirmar preparação', cancel: 'Cancelar', prepared: 'Arquitetura preparada — nenhum arquivo, email ou link é gerado nesta fase.' }),
  es: Object.freeze({ pdf: 'Exportar PDF', email: 'Enviar email', share: 'Compartir', preview: 'Vista previa de entrega del informe', pages: 'páginas', includes: 'Inteligencia incluida', access: 'Nivel de acceso', confirm: 'Confirmar preparación', cancel: 'Cancelar', prepared: 'Arquitectura preparada — no se genera ningún archivo, email o enlace en esta fase.' }),
});

export function MaxxisReportExportActions({ schema, exportEntitlements = {}, language = 'en', onPrepared = null }) {
  const [channel, setChannel] = useState(null);
  const [exportState, setExportState] = useState('IDLE');
  const copy = COPY[language] || COPY.en;
  const entitlement = channel ? exportEntitlements[channel] : null;
  const preview = useMemo(() => channel ? buildMaxxisReportExportPreview({ schema, exportEntitlement: entitlement, channel }) : null, [channel, entitlement, schema]);
  const actions = [['PDF', copy.pdf], ['EMAIL', copy.email], ['SHARE', copy.share]];
  const confirmPreparation = async () => {
    if (channel !== 'PDF') { onPrepared?.(preview); return; }
    setExportState('RENDERING');
    try {
      const result = await renderMaxxisReportPdf({ schema, exportEntitlement: entitlement, language });
      if (result.state !== 'RENDERED') throw new Error('REPORT_PDF_RENDER_FAILED');
      downloadMaxxisReportPdf(result.document, `maxxis-${schema.reportType.toLowerCase().replaceAll('_', '-')}.pdf`);
      setExportState('DONE');
      onPrepared?.({ ...preview, renderedDocument: result.document });
    } catch {
      setExportState('FAILED');
    }
  };
  return <section className="maxxis-report-export-actions" aria-label={copy.preview}>
    <div>{actions.map(([code, label]) => <button key={code} type="button" disabled={!exportEntitlements[code]?.allowed} onClick={() => setChannel(code)}>{label}</button>)}</div>
    {preview?.allowed ? <div className="maxxis-report-export-preview" role="dialog" aria-label={copy.preview}>
      <header><strong>{preview.reportType.replaceAll('_', ' ')}</strong><span>{preview.pages} {copy.pages}</span></header>
      <span>{copy.access}: <strong>{preview.accessLevel}</strong></span><strong>{copy.includes}</strong>
      <ul>{preview.includedIntelligence.map((item) => <li key={item}>✓ {item}</li>)}</ul>
      <small>{channel === 'PDF' ? 'The PDF will be generated from this validated report.' : copy.prepared}</small>{exportState === 'FAILED' ? <small role="alert">PDF generation failed.</small> : null}<footer><button type="button" onClick={() => setChannel(null)}>{copy.cancel}</button><button type="button" disabled={exportState === 'RENDERING'} onClick={confirmPreparation}>{exportState === 'RENDERING' ? 'Generating…' : copy.confirm}</button></footer>
    </div> : null}
  </section>;
}
