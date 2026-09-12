import React, { useMemo, useState } from 'react';
import {
  ARV_CONDITION_COMPATIBILITIES,
  ARV_TARGET_CONDITIONS,
  formatCompAddress,
  resolveExternalCompReviewLink,
} from './arvVisualCompReview';

const LABELS = {
  AS_IS: 'As-is', LIGHT_REHAB: 'Light rehab', STANDARD_RENOVATION: 'Standard renovation',
  FULL_RENOVATION: 'Full renovation', HIGH_END: 'High-end', TURN_KEY: 'Turn-key',
  NEW_CONSTRUCTION: 'New construction', UNKNOWN: "Can't determine",
  MATCHES_TARGET: 'Similar', PARTIAL_MATCH: 'Partially similar', SUPERIOR_TO_TARGET: 'Superior',
  INFERIOR_TO_TARGET: 'Inferior', DIFFERENT_PRODUCT_CLASS: 'Different product class',
  NOT_COMPARABLE: 'Not comparable',
};

function money(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString('en-US')}` : 'Unavailable';
}

function date(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(parsed)) : 'Unavailable';
}

function ReviewCard({ candidate, targetCondition, targetConfirmed, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [observedCondition, setObservedCondition] = useState(candidate.review?.observedCondition || 'UNKNOWN');
  const [conditionCompatibility, setConditionCompatibility] = useState(candidate.review?.conditionCompatibility || 'UNKNOWN');
  const [notes, setNotes] = useState(candidate.review?.notes || '');
  const address = formatCompAddress(candidate.address);
  const links = useMemo(() => ['ZILLOW', 'REDFIN'].map((provider) => resolveExternalCompReviewLink({
    provider, address, directUrl: candidate.externalUrls?.[provider.toLowerCase()] || '',
  })).filter(Boolean), [address, candidate.externalUrls]);

  return (
    <article className="maxxis-arv-comp-card" data-testid={`arv-comp-${candidate.stableCompIdentifier}`}>
      <div className="maxxis-arv-comp-heading">
        <strong>{candidate.address?.line1 || address}</strong>
        <span className={`maxxis-arv-review-status ${candidate.review ? 'is-reviewed' : ''}`}>
          {candidate.review ? '✓ Reviewed' : 'Not reviewed'}
        </span>
      </div>
      <span>{[candidate.address?.city, candidate.address?.state, candidate.address?.zipCode].filter(Boolean).join(', ')}</span>
      <div className="maxxis-arv-comp-facts">
        <span>Structural Match: {candidate.structuralComparabilityScore}%</span>
        <span>Data Completeness: {candidate.dataCompletenessScore}%</span>
        <span>Distance: {candidate.distanceMiles ?? 'N/A'} mi</span>
        <span>Recorded Sale: {money(candidate.recordedSalePrice)}</span>
        <span>Sale Date: {date(candidate.recordedSaleDate)}</span>
      </div>
      <div className="maxxis-arv-external-links" aria-label="External visual review links">
        {links.map((link) => (
          <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer">
            {link.provider === 'ZILLOW' ? 'Zillow ↗' : 'Redfin ↗'}
          </a>
        ))}
      </div>
      {candidate.review && !editing ? (
        <div className="maxxis-arv-saved-review">
          <span>Observed: {LABELS[candidate.review.observedCondition]}</span>
          <span>Compatibility: {LABELS[candidate.review.conditionCompatibility]}</span>
          <span>Evidence: USER_PROVIDED</span>
          {candidate.review.notes ? <span>Notes: {candidate.review.notes}</span> : null}
          <button type="button" onClick={() => setEditing(true)}>Edit review</button>
        </div>
      ) : null}
      {!candidate.review && !editing ? (
        <button type="button" className="maxxis-arv-review-button" disabled={!targetConfirmed} onClick={() => setEditing(true)}>
          Review comp
        </button>
      ) : null}
      {editing ? (
        <div className="maxxis-arv-review-form">
          <label>Observed condition
            <select value={observedCondition} onChange={(event) => setObservedCondition(event.target.value)}>
              {ARV_TARGET_CONDITIONS.map((value) => <option key={value} value={value}>{LABELS[value]}</option>)}
            </select>
          </label>
          <label>Compatibility with target
            <select value={conditionCompatibility} onChange={(event) => setConditionCompatibility(event.target.value)}>
              {ARV_CONDITION_COMPATIBILITIES.map((value) => <option key={value} value={value}>{LABELS[value]}</option>)}
            </select>
          </label>
          <label>Notes (optional)
            <textarea value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button type="button" disabled={saving} onClick={() => onSave?.(candidate, {
            targetCondition, observedCondition, conditionCompatibility, notes,
          })}>{saving ? 'Saving…' : 'Save USER_PROVIDED review'}</button>
        </div>
      ) : null}
    </article>
  );
}

export function MaxxisArvVisualCompReview({ messageId, data, onSetTarget, onSaveReview, activeReviewKey = '' }) {
  const [targetDraft, setTargetDraft] = useState(data?.targetCondition || 'UNKNOWN');
  if (!data || !Array.isArray(data.candidates)) return null;
  const targetConfirmed = data.targetConditionEvidenceStatus === 'USER_PROVIDED';
  return (
    <section className="maxxis-arv-review" aria-label="ARV visual comparable review">
      <div className="maxxis-arv-target">
        <strong>Target condition</strong>
        <select value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)}>
          {ARV_TARGET_CONDITIONS.map((value) => <option key={value} value={value}>{LABELS[value]}</option>)}
        </select>
        <button type="button" disabled={activeReviewKey === 'target'} onClick={() => onSetTarget?.(messageId, targetDraft)}>
          {activeReviewKey === 'target' ? 'Saving…' : targetConfirmed ? 'Change / confirm' : 'Confirm'}
        </button>
        <span>{targetConfirmed ? 'Evidence: USER_PROVIDED' : 'Confirm the target before reviewing comps.'}</span>
      </div>
      <div className="maxxis-arv-summary" role="status">
        {data.summary?.reviewedCount || 0}/{data.summary?.totalStructuralCandidates || 0} reviewed · {data.summary?.status || 'NOT_STARTED'}
      </div>
      {data.reviewError ? <div className="maxxis-arv-review-error" role="alert">{data.reviewError}</div> : null}
      {data.candidates.map((candidate) => (
        <ReviewCard
          key={`${candidate.stableCompIdentifier}:${candidate.review?.reviewedAt || 'unreviewed'}`}
          candidate={candidate}
          targetCondition={data.targetCondition}
          targetConfirmed={targetConfirmed}
          saving={activeReviewKey === candidate.stableCompIdentifier}
          onSave={(item, review) => onSaveReview?.(messageId, item, review)}
        />
      ))}
      <small>No ARV or MAO is calculated in this review.</small>
    </section>
  );
}
