import React from 'react';

const COPY = {
  en: { structure: 'Professional report structure', page: 'PAGE', prepared: 'PDF, email, and share rendering are prepared but not active.', quality: 'Investment Quality: NOT EVALUATED' },
  pt: { structure: 'Estrutura do relatório profissional', page: 'PÁGINA', prepared: 'A renderização em PDF, e-mail e compartilhamento está preparada, mas inativa.', quality: 'Qualidade do investimento: NÃO AVALIADA' },
  es: { structure: 'Estructura del informe profesional', page: 'PÁGINA', prepared: 'La renderización en PDF, correo y compartir está preparada, pero inactiva.', quality: 'Calidad de inversión: NO EVALUADA' },
};

const LABELS = {
  en: {
    EXECUTIVE_INVESTMENT_BRIEF: 'Executive Investment Brief', PROPERTY_EVIDENCE_SUMMARY: 'Property + Evidence Summary',
    COMPARABLE_ANALYSIS: 'Comparable Analysis', VALUATION_INTELLIGENCE: 'Valuation Intelligence',
    INVESTOR_REVIEW: 'Investor Review', RISKS_AND_VERIFICATION: 'Risks and Verification',
  },
  pt: {
    EXECUTIVE_INVESTMENT_BRIEF: 'Resumo Executivo do Investimento', PROPERTY_EVIDENCE_SUMMARY: 'Resumo da Propriedade e Evidências',
    COMPARABLE_ANALYSIS: 'Análise de Comparáveis', VALUATION_INTELLIGENCE: 'Inteligência de Avaliação',
    INVESTOR_REVIEW: 'Revisão do Investidor', RISKS_AND_VERIFICATION: 'Riscos e Verificação',
  },
  es: {
    EXECUTIVE_INVESTMENT_BRIEF: 'Resumen Ejecutivo de Inversión', PROPERTY_EVIDENCE_SUMMARY: 'Resumen de Propiedad y Evidencia',
    COMPARABLE_ANALYSIS: 'Análisis de Comparables', VALUATION_INTELLIGENCE: 'Inteligencia de Valoración',
    INVESTOR_REVIEW: 'Revisión del Inversor', RISKS_AND_VERIFICATION: 'Riesgos y Verificación',
  },
};

function pageSummary(code, sections, copy) {
  const value = (key) => sections?.[key]?.available ? sections[key].data : null;
  const property = value('propertySummary');
  const executive = value('executiveSummary');
  const evidence = value('propertyEvidence');
  const comps = value('comparableEvidence');
  const valuation = value('valuationEvidence');
  const fit = value('investmentProfile');
  const risks = value('riskAssessment');
  const checklist = value('verificationChecklist');
  if (code === 'EXECUTIVE_INVESTMENT_BRIEF') return [property?.title || property?.address || 'Property', executive?.summary || executive, `Strategy: ${fit?.strategy?.status || 'UNKNOWN'}`, valuation?.confidence ? `Confidence: ${valuation.confidence}` : null];
  if (code === 'PROPERTY_EVIDENCE_SUMMARY') return [`Evidence strength: ${evidence?.strength || 'UNKNOWN'}`, `Verified fields: ${evidence?.verifiedRecords?.length || 0}`, `Conflicts: ${evidence?.conflicts?.length || 0}`];
  if (code === 'COMPARABLE_ANALYSIS') return [`Used: ${comps?.used?.length || 0}`, `Supporting: ${comps?.supporting?.length || 0}`, `Excluded: ${comps?.excluded?.length || 0}`];
  if (code === 'VALUATION_INTELLIGENCE') return [`Status: ${valuation?.status || 'ARV_UNAVAILABLE'}`, `Confidence: ${valuation?.confidence || 'LOW'}`, `Methodology: ${valuation?.methodology || 'UNKNOWN'}`];
  if (code === 'INVESTOR_REVIEW') return [fit?.score === null || fit?.score === undefined ? 'Profile Fit: UNKNOWN' : `Profile Fit: ${fit.score}%`, copy.quality, fit?.requiredMessage];
  if (code === 'RISKS_AND_VERIFICATION') return [`Risks: ${risks?.length || 0}`, `Verification steps: ${checklist?.length || 0}`];
  return [];
}

export function MaxxisDealIntelligenceReportPreview({ schema, language = 'en' }) {
  if (!schema || schema.type !== 'maxxis_report_schema' || schema.reportType !== 'DEAL_INTELLIGENCE') return null;
  const copy = COPY[language] || COPY.en;
  const labels = LABELS[language] || LABELS.en;
  return (
    <details className="maxxis-report-preview">
      <summary>{copy.structure}</summary>
      <div className="maxxis-report-page-list">
        {schema.pages.map((page) => (
          <article key={page.page} data-report-page={page.page} data-report-section={page.code}>
            <small>{copy.page} {page.page}</small>
            <strong>{labels[page.code] || page.code}</strong>
            {pageSummary(page.code, schema.sections, copy).filter(Boolean).map((line) => <span key={line}>{line}</span>)}
          </article>
        ))}
      </div>
      <small>{copy.prepared}</small>
    </details>
  );
}
