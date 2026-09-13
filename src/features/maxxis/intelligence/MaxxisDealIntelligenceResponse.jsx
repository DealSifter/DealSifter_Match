import React from 'react';

function money(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Number(value).toLocaleString('en-US')}` : 'Unavailable';
}

export function MaxxisDealIntelligenceResponse({ context }) {
  if (!context || context.type !== 'deal_intelligence_context') return null;
  const response = context.response || {};
  const valuation = context.valuationContext || {};
  const range = valuation.range;
  return (
    <section className="maxxis-deal-intelligence" aria-label="Maxxis Deal Intelligence">
      <div className="maxxis-deal-intelligence-heading">
        <strong>Deal Intelligence</strong>
        <span>{context.evidenceSummary?.strength || 'LOW'} EVIDENCE</span>
      </div>
      <div className="maxxis-deal-intelligence-answer">
        <small>Initial assessment</small>
        <strong>{response.initialAssessment || 'The available evidence is insufficient for an initial assessment.'}</strong>
      </div>
      <div className="maxxis-deal-intelligence-metrics">
        <span>Profile fit <strong>{context.matchContext?.classification || 'Unavailable'}</strong></span>
        <span>ARV status <strong>{String(valuation.status || 'ARV_UNAVAILABLE').replaceAll('_', ' ')}</strong></span>
        <span>ARV range <strong>{range ? `${money(range.low)} – ${money(range.high)}` : 'Unavailable'}</strong></span>
        <span>Confidence <strong>{valuation.confidence || 'LOW'}</strong></span>
      </div>
      {valuation.warnings?.length ? (
        <div className="maxxis-arv-warning-list" aria-label="Valuation warnings">
          {valuation.warnings.map((warning) => <span key={warning}>⚠ {warning.replaceAll('_', ' ')}</span>)}
        </div>
      ) : null}
      {response.why?.length ? (
        <div className="maxxis-deal-intelligence-section">
          <strong>Why</strong>
          <ul>{response.why.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      {context.risks?.length ? (
        <div className="maxxis-deal-intelligence-section">
          <strong>Main risks</strong>
          <ul>{context.risks.map((risk) => (
            <li key={risk.code}><span className={`maxxis-risk-severity is-${String(risk.severity).toLowerCase()}`}>{risk.severity}</span> {risk.explanation}</li>
          ))}</ul>
        </div>
      ) : null}
      {context.opportunities?.length ? (
        <details className="maxxis-deal-intelligence-details">
          <summary>Evidence-based positive factors</summary>
          <ul>{context.opportunities.map((signal) => <li key={signal.code}>{signal.explanation}</li>)}</ul>
        </details>
      ) : null}
      {context.limitations?.length ? (
        <details className="maxxis-deal-intelligence-details">
          <summary>Limitations ({context.limitations.length})</summary>
          <ul>{context.limitations.map((item) => <li key={item}>{item.replaceAll('_', ' ')}</li>)}</ul>
        </details>
      ) : null}
      {response.nextSteps?.length ? (
        <div className="maxxis-deal-intelligence-next">
          <strong>Suggested next steps</strong>
          <ol>{response.nextSteps.map((item) => <li key={item}>{item}</li>)}</ol>
        </div>
      ) : null}
      <small>Decision support based on available evidence. It is not a purchase recommendation or return guarantee.</small>
    </section>
  );
}
