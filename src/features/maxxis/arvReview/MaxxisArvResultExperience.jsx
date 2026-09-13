import React from 'react';
import { createArvExplanationContext } from './arvResultExperience';

function money(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Number(value).toLocaleString('en-US')}` : 'Unavailable';
}
function date(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(parsed)) : 'Unavailable';
}

function evidenceStatus(value) {
  return String(value || 'UNAVAILABLE').replaceAll('_', ' ');
}

function CompEvidence({ comp, included }) {
  return (
    <article className={`maxxis-arv-evidence-row ${included ? 'is-used' : 'is-excluded'}`}>
      <div className="maxxis-arv-evidence-title">
        <strong>{comp.address || 'Comparable property'}</strong>
        <span>{included ? 'USED' : 'NOT INCLUDED'}</span>
      </div>
      <div className="maxxis-arv-evidence-grid">
        <span>Sale: <strong>{money(comp.recordedSalePrice)}</strong></span>
        <span>Sale date: <strong>{date(comp.recordedSaleDate)}</strong></span>
        <span>Distance: <strong>{Number.isFinite(Number(comp.distanceMiles)) ? `${comp.distanceMiles} mi` : 'Unavailable'}</strong></span>
        <span>Structural: <strong>{comp.structuralComparabilityScore ?? 'Unavailable'}%</strong></span>
        <span>Completeness: <strong>{comp.dataCompletenessScore ?? 'Unavailable'}%</strong></span>
        <span>Condition: <strong>{evidenceStatus(comp.conditionCompatibility)}</strong></span>
        <span>Weight: <strong>{included ? comp.valuationWeight : 0}</strong></span>
      </div>
      <p><strong>{included ? 'Reason included:' : 'Reason:'}</strong> {comp.reason}</p>
      <small>Recorded sale: {evidenceStatus(comp.provenance.recordedSale)} · Condition: {evidenceStatus(comp.provenance.conditionReview)}</small>
    </article>
  );
}

export function MaxxisArvResultExperience({ evaluation }) {
  const context = createArvExplanationContext(evaluation);
  if (!context) return null;
  const available = context.status !== 'ARV_UNAVAILABLE';
  return (
    <section className={`maxxis-arv-result is-${context.status.toLowerCase()}`} aria-label="Maxxis ARV evaluation">
      <div className="maxxis-arv-result-heading">
        <strong>ARV Intelligence</strong>
        <span>{context.statusLabel}</span>
      </div>
      <p className="maxxis-arv-result-statement">{context.statement}</p>
      <div className="maxxis-arv-primary-result">
        <div>
          <small>{available ? 'Estimated ARV range' : 'ARV evaluation'}</small>
          <strong className="maxxis-arv-range">
            {available ? `${money(context.range.low)} – ${money(context.range.high)}` : 'Not available yet'}
          </strong>
        </div>
        {available ? <div><small>Central reference</small><strong>{money(context.centralReference)}</strong></div> : null}
      </div>
      <div className="maxxis-arv-result-metrics">
        <span>Confidence <strong>{context.confidence}</strong></span>
        <span>Comps <strong>{context.eligibleCompCount} used</strong></span>
      </div>
      <div className="maxxis-arv-explanation-block">
        <strong>Why this result</strong>
        <ul>{context.why.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
      {context.warnings.length ? (
        <div className="maxxis-arv-warning-list" aria-label="ARV warnings">
          {context.warnings.map((warning) => <span key={warning.code}>⚠ {warning.code.replaceAll('_', ' ')}</span>)}
        </div>
      ) : null}
      {context.limitations.length ? (
        <div className="maxxis-arv-explanation-block">
          <strong>Limitations</strong>
          <ul>{context.limitations.map((item) => <li key={item.code}>{item.message}</li>)}</ul>
        </div>
      ) : null}
      <div className="maxxis-arv-next-action"><strong>Next action</strong><span>{context.nextAction}</span></div>
      <details className="maxxis-arv-evidence-details">
        <summary>View evidence ({context.usedComps.length} used, {context.notIncludedComps.length} not included)</summary>
        <div className="maxxis-arv-evidence-drawer">
          <section>
            <h4>Valuation comps used</h4>
            {context.usedComps.length
              ? context.usedComps.map((comp) => <CompEvidence key={comp.compIdentifier || comp.address} comp={comp} included />)
              : <p>No comparable passed the deterministic valuation policy.</p>}
          </section>
          <section>
            <h4>Not included in ARV calculation</h4>
            {context.notIncludedComps.length
              ? context.notIncludedComps.map((comp) => <CompEvidence key={comp.compIdentifier || comp.address} comp={comp} included={false} />)
              : <p>No excluded comparable evidence.</p>}
          </section>
          <section className="maxxis-arv-methodology">
            <h4>Methodology and provenance</h4>
            <span>Policy: {context.methodology.policyVersion || 'Unavailable'}</span>
            <span>Method: {context.methodology.methodologyVersion || 'Unavailable'}</span>
            <span>Range method: {evidenceStatus(context.methodology.rangeMethod)}</span>
            <span>ARV: {evidenceStatus(context.provenance.arv)}</span>
            <span>Condition: {evidenceStatus(context.provenance.conditionReview)}</span>
            <span>Recorded sale: {evidenceStatus(context.provenance.recordedSale)}</span>
          </section>
          {context.providerEstimate ? (
            <section className="maxxis-arv-provider-estimate" aria-label="External Provider Estimate">
              <h4>External Provider Estimate</h4>
              <strong>{money(context.providerEstimate.value)}</strong>
              <span>Source: {context.providerEstimate.source}</span>
              <span>Type: {context.providerEstimate.type}</span>
              <span>Evidence: {context.providerEstimate.evidenceStatus}</span>
              <small>Displayed separately. It is not blended with the DealSifter ARV evaluation.</small>
            </section>
          ) : null}
        </div>
      </details>
      <small>Calculated evidence, not a guaranteed market or sale value.</small>
    </section>
  );
}
