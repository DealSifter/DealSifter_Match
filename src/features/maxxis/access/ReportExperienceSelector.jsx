import React, { useMemo, useState } from 'react';
import maxxisAnalysisAsset from '../../../assets/maxxis/avatar/avatar-idle.png';
import maxxisIntelligenceAsset from '../../../assets/maxxis/avatar/avatar-observing.png';
import {
  INTELLIGENCE_REPORT_TYPES,
  resolveIntelligenceReportAccess,
} from '../../../domain/intelligenceAccess';
import './ReportExperienceSelector.css';

const COPY = {
  en: {
    title: 'Choose your intelligence level',
    intro: 'Select a report level first. Export delivery remains available below.',
    info: 'Preview report',
    included: 'Included',
    unlock: 'One-time unlock',
    basic: ['BASIC PROPERTY RELEASE', 'Published property facts, photos, location and notes.', 'Use Basic Release'],
    analysis: ['MAXXIS AI ANALYSIS', 'Maxxis interpretation, profile alignment, risks, questions and next steps.', 'Analyze with Maxxis'],
    deal: ['DEAL INTELLIGENCE REPORT', 'Evidence, sold comps, valuation, ARV, confidence and investor scenarios.', 'Open Deal Intelligence'],
    pages: {
      PROPERTY_RELEASE: [['Property facts', 'Photos', 'Location', 'Notes']],
      MAXXIS_ANALYSIS: [['Property summary', 'Available data'], ['Investor profile alignment', 'Attention points'], ['Questions', 'Limitations', 'Next steps']],
      DEAL_INTELLIGENCE: [['Executive overview'], ['Property evidence'], ['Comparable sales'], ['Valuation and ARV'], ['Investor scenarios'], ['Confidence, limitations and actions']],
    },
  },
  pt: {
    title: 'Escolha o nível de inteligência',
    intro: 'Selecione primeiro o nível do relatório. As opções de envio continuam disponíveis abaixo.',
    info: 'Prévia do relatório',
    included: 'Incluído',
    unlock: 'Desbloqueio único',
    basic: ['BASIC PROPERTY RELEASE', 'Dados publicados do imóvel, fotos, localização e notas.', 'Usar Basic Release'],
    analysis: ['MAXXIS AI ANALYSIS', 'Interpretação Maxxis, aderência ao perfil, riscos, perguntas e próximos passos.', 'Analisar com Maxxis'],
    deal: ['DEAL INTELLIGENCE REPORT', 'Evidências, vendas comparáveis, valuation, ARV, confiança e cenários.', 'Abrir Deal Intelligence'],
    pages: {
      PROPERTY_RELEASE: [['Dados do imóvel', 'Fotos', 'Localização', 'Notas']],
      MAXXIS_ANALYSIS: [['Resumo do imóvel', 'Dados disponíveis'], ['Aderência ao perfil', 'Pontos de atenção'], ['Perguntas', 'Limitações', 'Próximos passos']],
      DEAL_INTELLIGENCE: [['Visão executiva'], ['Evidências do imóvel'], ['Vendas comparáveis'], ['Valuation e ARV'], ['Cenários do investidor'], ['Confiança, limitações e ações']],
    },
  },
  es: {
    title: 'Elige el nivel de inteligencia',
    intro: 'Selecciona primero el nivel del informe. Las opciones de envío siguen disponibles abajo.',
    info: 'Vista previa',
    included: 'Incluido',
    unlock: 'Desbloqueo único',
    basic: ['BASIC PROPERTY RELEASE', 'Datos publicados, fotos, ubicación y notas.', 'Usar Basic Release'],
    analysis: ['MAXXIS AI ANALYSIS', 'Interpretación Maxxis, afinidad, riesgos, preguntas y próximos pasos.', 'Analizar con Maxxis'],
    deal: ['DEAL INTELLIGENCE REPORT', 'Evidencia, ventas comparables, valoración, ARV, confianza y escenarios.', 'Abrir Deal Intelligence'],
    pages: {
      PROPERTY_RELEASE: [['Datos de la propiedad', 'Fotos', 'Ubicación', 'Notas']],
      MAXXIS_ANALYSIS: [['Resumen', 'Datos disponibles'], ['Afinidad del perfil', 'Atención'], ['Preguntas', 'Limitaciones', 'Próximos pasos']],
      DEAL_INTELLIGENCE: [['Visión ejecutiva'], ['Evidencia'], ['Ventas comparables'], ['Valoración y ARV'], ['Escenarios'], ['Confianza, límites y acciones']],
    },
  },
};

const LEVELS = [
  { reportType: INTELLIGENCE_REPORT_TYPES.PROPERTY_RELEASE, copy: 'basic', asset: null },
  { reportType: INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS, copy: 'analysis', asset: maxxisAnalysisAsset },
  { reportType: INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE, copy: 'deal', asset: maxxisIntelligenceAsset },
];

export function ReportExperienceSelector({
  plan = 'free',
  entitlements = [],
  language = 'en',
  onSelect = null,
}) {
  const t = COPY[String(language).slice(0, 2)] || COPY.en;
  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState('');
  const [pageByType, setPageByType] = useState({});
  const options = useMemo(() => LEVELS.map((level) => ({
    ...level,
    access: resolveIntelligenceReportAccess({ plan, entitlements, reportType: level.reportType }),
  })), [entitlements, plan]);

  const movePreview = (reportType, delta) => {
    const pages = t.pages[reportType] || [];
    setPageByType((current) => {
      const next = ((current[reportType] || 0) + delta + pages.length) % pages.length;
      return { ...current, [reportType]: next };
    });
  };

  return (
    <section className="report-experience-selector" data-testid="report-experience-selector">
      <header><strong>{t.title}</strong><span>{t.intro}</span></header>
      <div className="report-level-grid">
        {options.map((option) => {
          const [title, description, action] = t[option.copy];
          const selectedNow = selected === option.reportType;
          const previewOpen = preview === option.reportType;
          const pages = t.pages[option.reportType];
          const pageIndex = Math.min(pageByType[option.reportType] || 0, pages.length - 1);
          return (
            <article
              key={option.reportType}
              className={selectedNow ? 'is-selected' : ''}
              data-report-type={option.reportType}
              data-access-state={option.access.state}
              onClick={() => setSelected(option.reportType)}
            >
              <div className="report-level-heading">
                {option.asset
                  ? <img src={option.asset} alt="" aria-hidden="true" />
                  : <span className="basic-release-mark" aria-hidden="true">DS</span>}
                <h4>{title}</h4>
                <button
                  type="button"
                  className="report-info-button"
                  aria-label={`${t.info}: ${title}`}
                  aria-expanded={previewOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreview(previewOpen ? '' : option.reportType);
                    setSelected(option.reportType);
                  }}
                >ⓘ</button>
              </div>
              {previewOpen ? (
                <div className="report-preview-carousel" onClick={(event) => event.stopPropagation()}>
                  <div className="report-preview-sheet">
                    <small>{pageIndex + 1}/{pages.length}</small>
                    {pages[pageIndex].map((line) => <span key={line}>{line}</span>)}
                  </div>
                  {pages.length > 1 ? <div className="report-preview-controls">
                    <button type="button" aria-label="Previous preview page" onClick={() => movePreview(option.reportType, -1)}>‹</button>
                    <button type="button" aria-label="Next preview page" onClick={() => movePreview(option.reportType, 1)}>›</button>
                  </div> : null}
                </div>
              ) : null}
              <p>{description}</p>
              <strong className="report-access-copy">
                {option.access.allowed ? t.included : `${t.unlock} · ${option.access.nuggetCost} Nuggets`}
              </strong>
              {selectedNow ? (
                <button
                  type="button"
                  className="report-level-action"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect?.(option.access);
                  }}
                >{action}</button>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
