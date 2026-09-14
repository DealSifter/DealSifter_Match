import React from 'react';
import { MaxxisDealIntelligenceReportPreview } from './MaxxisDealIntelligenceReportPreview';

const COPY = {
  en: { title: 'Maxxis Analysis', summary: 'Summary', highlights: 'Property highlights', verified: 'Verified',
    provided: 'User provided', unknown: 'Unknown', alignment: 'Profile alignment', observations: 'Why',
    important: 'What is important', risks: 'Risk awareness', limitations: 'Limitations', next: 'Next steps',
    unavailable: 'Unavailable', profileFit: 'Profile fit', disclaimer: 'Decision support based only on available information.' },
  pt: { title: 'Análise Maxxis', summary: 'Resumo', highlights: 'Destaques do imóvel', verified: 'Verificado',
    provided: 'Informado pelo usuário', unknown: 'Desconhecido', alignment: 'Aderência ao perfil', observations: 'Por quê',
    important: 'O que importa', risks: 'Atenção a riscos', limitations: 'Limitações', next: 'Próximos passos',
    unavailable: 'Indisponível', profileFit: 'Aderência ao perfil', disclaimer: 'Suporte à decisão baseado somente nas informações disponíveis.' },
  es: { title: 'Análisis Maxxis', summary: 'Resumen', highlights: 'Datos destacados', verified: 'Verificado',
    provided: 'Informado por el usuario', unknown: 'Desconocido', alignment: 'Alineación con el perfil', observations: 'Por qué',
    important: 'Qué importa', risks: 'Atención a riesgos', limitations: 'Limitaciones', next: 'Próximos pasos',
    unavailable: 'No disponible', profileFit: 'Alineación del perfil', disclaimer: 'Apoyo a la decisión basado solo en la información disponible.' },
};

function FieldGroup({ title, items, unavailable }) {
  if (!items?.length) return null;
  return (
    <div className="maxxis-analysis-field-group">
      <strong>{title}</strong>
      <dl>{items.map((item) => (
        <div key={item.field}>
          <dt>{item.label}</dt>
          <dd>{item.value === null ? unavailable : String(item.value)}</dd>
        </div>
      ))}</dl>
    </div>
  );
}

function ListSection({ title, items, ordered = false }) {
  if (!items?.length) return null;
  const List = ordered ? 'ol' : 'ul';
  return <div className="maxxis-analysis-section"><strong>{title}</strong><List>{items.map((item) => <li key={item}>{item}</li>)}</List></div>;
}

export function MaxxisAnalysisReportExperience({ report, reportSchema = null, language = 'en' }) {
  if (!report || report.type !== 'maxxis_analysis_report') return null;
  const t = COPY[language] || COPY.en;
  const alignment = report.profileAlignment || {};
  const alignmentItems = [alignment.targetMarket, alignment.propertyType, alignment.strategy].filter(Boolean);
  return (
    <section className="maxxis-analysis-report" aria-label={t.title}>
      <div className="maxxis-deal-intelligence-heading">
        <strong>{t.title}</strong>
        <span>LEVEL 2</span>
      </div>
      <div className="maxxis-deal-intelligence-answer">
        <small>{t.summary}</small>
        <strong>{report.executiveSummary}</strong>
      </div>
      <div className="maxxis-analysis-fit">
        <span>{t.profileFit}</span>
        <strong>{alignment.score === null ? t.unavailable : `${alignment.score}%`}</strong>
        <small>PROFILE FIT ONLY</small>
      </div>
      <div className="maxxis-analysis-section">
        <strong>{t.highlights}</strong>
        <div className="maxxis-analysis-field-grid">
          <FieldGroup title={t.verified} items={report.propertyHighlights?.verified} unavailable={t.unavailable} />
          <FieldGroup title={t.provided} items={report.propertyHighlights?.userProvided} unavailable={t.unavailable} />
          <FieldGroup title={t.unknown} items={report.propertyHighlights?.unknown} unavailable={t.unavailable} />
        </div>
      </div>
      {alignmentItems.length ? (
        <div className="maxxis-analysis-section">
          <strong>{t.alignment}</strong>
          <ul>{alignmentItems.map((item) => <li key={item.label}><strong>{item.label}:</strong> {item.explanation || item.status.replaceAll('_', ' ')}</li>)}</ul>
        </div>
      ) : null}
      <ListSection title={t.observations} items={report.keyObservations?.positives} />
      <ListSection title={t.important} items={report.keyObservations?.attention} />
      {report.riskAwareness?.length ? (
        <div className="maxxis-analysis-section">
          <strong>{t.risks}</strong>
          <ul>{report.riskAwareness.map((risk) => <li key={risk.code}><span className={`maxxis-risk-severity is-${risk.severity.toLowerCase()}`}>{risk.severity}</span> {risk.explanation}</li>)}</ul>
        </div>
      ) : null}
      <ListSection title={t.limitations} items={report.limitations} />
      <ListSection title={t.next} items={report.nextSteps} ordered />
      <MaxxisDealIntelligenceReportPreview schema={reportSchema} language={language} />
      <small>{t.disclaimer}</small>
    </section>
  );
}
