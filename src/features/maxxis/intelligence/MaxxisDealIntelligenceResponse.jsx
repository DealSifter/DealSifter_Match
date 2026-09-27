import React from 'react';
import { localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';

const COPY = {
  en: { aria: 'Maxxis Deal Intelligence', title: 'Deal Intelligence', evidence: 'evidence', initial: 'Initial assessment', insufficient: 'The available evidence is insufficient for an initial assessment.', fit: 'Profile fit', arvStatus: 'ARV status', arvRange: 'ARV range', confidence: 'Confidence', warnings: 'Valuation warnings', why: 'Why', risks: 'Main risks', positive: 'Evidence-based positive factors', limitations: 'Limitations', next: 'Suggested next steps', unavailable: 'Unavailable', disclaimer: 'Decision support based on available evidence. It is not a purchase recommendation or return guarantee.' },
  pt: { aria: 'Inteligência Maxxis do Deal', title: 'Inteligência do Deal', evidence: 'evidência', initial: 'Avaliação inicial', insufficient: 'As evidências disponíveis são insuficientes para uma avaliação inicial.', fit: 'Aderência ao perfil', arvStatus: 'Status do ARV', arvRange: 'Faixa de ARV', confidence: 'Confiança', warnings: 'Alertas da avaliação', why: 'Por quê', risks: 'Principais riscos', positive: 'Fatores positivos baseados em evidências', limitations: 'Limitações', next: 'Próximos passos sugeridos', unavailable: 'Indisponível', disclaimer: 'Suporte à decisão baseado nas evidências disponíveis. Não é recomendação de compra nem garantia de retorno.' },
  es: { aria: 'Inteligencia Maxxis del Deal', title: 'Inteligencia del Deal', evidence: 'evidencia', initial: 'Evaluación inicial', insufficient: 'La evidencia disponible es insuficiente para una evaluación inicial.', fit: 'Afinidad con el perfil', arvStatus: 'Estado del ARV', arvRange: 'Rango de ARV', confidence: 'Confianza', warnings: 'Alertas de valoración', why: 'Por qué', risks: 'Riesgos principales', positive: 'Factores positivos basados en evidencia', limitations: 'Limitaciones', next: 'Próximos pasos sugeridos', unavailable: 'No disponible', disclaimer: 'Apoyo a decisiones basado en la evidencia disponible. No es recomendación de compra ni garantía de retorno.' },
};

function money(value, unavailable = 'Unavailable') {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Number(value).toLocaleString('en-US')}` : unavailable;
}

export function MaxxisDealIntelligenceResponse({ context, language = 'en' }) {
  if (!context || context.type !== 'deal_intelligence_context') return null;
  const t = COPY[language] || COPY.en;
  const response = context.response || {};
  const valuation = context.valuationContext || {};
  const range = valuation.range;
  return (
    <section className="maxxis-deal-intelligence" aria-label={t.aria}>
      <div className="maxxis-deal-intelligence-heading">
        <strong>{t.title}</strong>
        <span>{localizeMaxxisValue(context.evidenceSummary?.strength || 'LOW', language)} · {t.evidence}</span>
      </div>
      <div className="maxxis-deal-intelligence-answer">
        <small>{t.initial}</small>
        <strong>{response.initialAssessment || t.insufficient}</strong>
      </div>
      <div className="maxxis-deal-intelligence-metrics">
        <span>{t.fit} <strong>{localizeMaxxisValue(context.matchContext?.classification, language, t.unavailable)}</strong></span>
        <span>{t.arvStatus} <strong>{localizeMaxxisValue(valuation.status || 'ARV_UNAVAILABLE', language)}</strong></span>
        <span>{t.arvRange} <strong>{range ? `${money(range.low, t.unavailable)} – ${money(range.high, t.unavailable)}` : t.unavailable}</strong></span>
        <span>{t.confidence} <strong>{localizeMaxxisValue(valuation.confidence || 'LOW', language)}</strong></span>
      </div>
      {valuation.warnings?.length ? (
        <div className="maxxis-arv-warning-list" aria-label={t.warnings}>
          {valuation.warnings.map((warning) => <span key={warning}>⚠ {localizeMaxxisValue(warning, language)}</span>)}
        </div>
      ) : null}
      {response.why?.length ? (
        <div className="maxxis-deal-intelligence-section">
          <strong>{t.why}</strong>
          <ul>{response.why.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      {context.risks?.length ? (
        <div className="maxxis-deal-intelligence-section">
          <strong>{t.risks}</strong>
          <ul>{context.risks.map((risk) => (
            <li key={risk.code}><span className={`maxxis-risk-severity is-${String(risk.severity).toLowerCase()}`}>{localizeMaxxisValue(risk.severity, language)}</span> {risk.explanation}</li>
          ))}</ul>
        </div>
      ) : null}
      {context.opportunities?.length ? (
        <details className="maxxis-deal-intelligence-details">
          <summary>{t.positive}</summary>
          <ul>{context.opportunities.map((signal) => <li key={signal.code}>{signal.explanation}</li>)}</ul>
        </details>
      ) : null}
      {context.limitations?.length ? (
        <details className="maxxis-deal-intelligence-details">
          <summary>{t.limitations} ({context.limitations.length})</summary>
          <ul>{context.limitations.map((item) => <li key={item}>{localizeMaxxisValue(item, language)}</li>)}</ul>
        </details>
      ) : null}
      {response.nextSteps?.length ? (
        <div className="maxxis-deal-intelligence-next">
          <strong>{t.next}</strong>
          <ol>{response.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol>
        </div>
      ) : null}
      <small>{t.disclaimer}</small>
    </section>
  );
}
