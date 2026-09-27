import React, { useMemo, useState } from 'react';
import { ARV_CONDITION_COMPATIBILITIES, ARV_TARGET_CONDITIONS, formatCompAddress, resolveExternalCompReviewLink } from './arvVisualCompReview';
import { MaxxisArvResultExperience } from './MaxxisArvResultExperience';
import { localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';

const COPY = {
  en: { aria: 'ARV visual comparable review', condition: 'Target condition', confirm: 'Confirm condition', change: 'Change / confirm', saving: 'Saving…', provenance: 'User provided', prompt: 'Confirm the target before reviewing comps.', reviewed: 'reviewed', error: 'Review error', rehab: 'Review rehab', support: (n) => `View ${n} supporting comps`, hideSupport: 'Hide supporting comps', continue: 'Continue without ARV', continued: 'Continuing without ARV. The current limitations remain explicit.', structural: 'Structural score', completeness: 'Data completeness', distance: 'Distance', sale: 'Recorded sale', saleDate: 'Sale date', review: 'Review comp', reviewedBadge: 'Reviewed', notReviewed: 'Not reviewed', observed: 'Observed condition', compatibility: 'Compatibility with target', notes: 'Notes (optional)', edit: 'Edit review', save: 'Save review', disclaimer: 'The ARV engine is deterministic. No MAO is calculated in this review.' },
  pt: { aria: 'Revisão visual de comparáveis para ARV', condition: 'Condição alvo', confirm: 'Confirmar condição', change: 'Alterar / confirmar', saving: 'Salvando…', provenance: 'Informado pelo usuário', prompt: 'Confirme a condição-alvo antes de revisar os comparáveis.', reviewed: 'revisados', error: 'Erro na revisão', rehab: 'Revisar rehab', support: (n) => `Ver ${n} comparáveis de apoio`, hideSupport: 'Ocultar comparáveis de apoio', continue: 'Continuar sem ARV', continued: 'Continuando sem ARV. As limitações atuais permanecem explícitas.', structural: 'Pontuação estrutural', completeness: 'Completude dos dados', distance: 'Distância', sale: 'Venda registrada', saleDate: 'Data da venda', review: 'Revisar comparável', reviewedBadge: 'Revisado', notReviewed: 'Não revisado', observed: 'Condição observada', compatibility: 'Compatibilidade com o alvo', notes: 'Notas (opcional)', edit: 'Alterar revisão', save: 'Salvar revisão', disclaimer: 'O mecanismo de ARV é determinístico. Nenhum MAO é calculado nesta revisão.' },
  es: { aria: 'Revisión visual de comparables para ARV', condition: 'Condición objetivo', confirm: 'Confirmar condición', change: 'Cambiar / confirmar', saving: 'Guardando…', provenance: 'Informado por el usuario', prompt: 'Confirma la condición objetivo antes de revisar comparables.', reviewed: 'revisados', error: 'Error de revisión', rehab: 'Revisar rehabilitación', support: (n) => `Ver ${n} comparables de apoyo`, hideSupport: 'Ocultar comparables de apoyo', continue: 'Continuar sin ARV', continued: 'Continuando sin ARV. Las limitaciones actuales siguen explícitas.', structural: 'Puntuación estructural', completeness: 'Integridad de datos', distance: 'Distancia', sale: 'Venta registrada', saleDate: 'Fecha de venta', review: 'Revisar comparable', reviewedBadge: 'Revisado', notReviewed: 'No revisado', observed: 'Condición observada', compatibility: 'Compatibilidad con el objetivo', notes: 'Notas (opcional)', edit: 'Editar revisión', save: 'Guardar revisión', disclaimer: 'El motor ARV es determinístico. No se calcula MAO en esta revisión.' },
};

function money(value, unavailable) { return Number.isFinite(Number(value)) && Number(value) > 0 ? `$${Number(value).toLocaleString('en-US')}` : unavailable; }
function date(value, language, unavailable) {
  const parsed = Date.parse(value);
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US';
  return Number.isFinite(parsed) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(parsed)) : unavailable;
}

function ReviewCard({ candidate, targetCondition, targetConfirmed, onSave, saving, language, copy }) {
  const [editing, setEditing] = useState(false);
  const [observedCondition, setObservedCondition] = useState(candidate.review?.observedCondition || 'UNKNOWN');
  const [conditionCompatibility, setConditionCompatibility] = useState(candidate.review?.conditionCompatibility || 'UNKNOWN');
  const [notes, setNotes] = useState(candidate.review?.notes || '');
  const address = formatCompAddress(candidate.address);
  const links = useMemo(() => ['ZILLOW', 'REDFIN'].map((provider) => resolveExternalCompReviewLink({ provider, address, directUrl: candidate.externalUrls?.[provider.toLowerCase()] || '' })).filter(Boolean), [address, candidate.externalUrls]);
  const unavailable = language === 'pt' ? 'Indisponível' : language === 'es' ? 'No disponible' : 'Unavailable';
  return (
    <article className="maxxis-arv-comp-card" data-testid={`arv-comp-${candidate.stableCompIdentifier}`}>
      <div className="maxxis-arv-comp-heading"><strong>{candidate.address?.line1 || address}</strong><span className={`maxxis-arv-review-status ${candidate.review ? 'is-reviewed' : ''}`}>{candidate.review ? `✓ ${copy.reviewedBadge}` : copy.notReviewed}</span></div>
      <span>{[candidate.address?.city, candidate.address?.state, candidate.address?.zipCode].filter(Boolean).join(', ')}</span>
      <div className="maxxis-arv-comp-facts">
        <span>{copy.structural}: {candidate.structuralComparabilityScore}%</span><span>{copy.completeness}: {candidate.dataCompletenessScore}%</span><span>{copy.distance}: {candidate.distanceMiles ?? unavailable} mi</span><span>{copy.sale}: {money(candidate.recordedSalePrice, unavailable)}</span><span>{copy.saleDate}: {date(candidate.recordedSaleDate, language, unavailable)}</span>
      </div>
      <div className="maxxis-arv-external-links">{links.map((link) => <a key={link.provider} href={link.url} target="_blank" rel="noopener noreferrer">{link.provider === 'ZILLOW' ? 'Zillow ↗' : 'Redfin ↗'}</a>)}</div>
      {candidate.review && !editing ? <div className="maxxis-arv-saved-review"><span>{copy.observed}: {localizeMaxxisValue(candidate.review.observedCondition, language)}</span><span>{copy.compatibility}: {localizeMaxxisValue(candidate.review.conditionCompatibility, language)}</span><span className="maxxis-provenance-badge">{copy.provenance}</span>{candidate.review.notes ? <span>{copy.notes}: {candidate.review.notes}</span> : null}<button type="button" onClick={() => setEditing(true)}>{copy.edit}</button></div> : null}
      {!candidate.review && !editing ? <button type="button" className="maxxis-arv-review-button" disabled={!targetConfirmed} onClick={() => setEditing(true)}>{copy.review}</button> : null}
      {editing ? <div className="maxxis-arv-review-form">
        <label>{copy.observed}<select value={observedCondition} onChange={(event) => setObservedCondition(event.target.value)}>{ARV_TARGET_CONDITIONS.map((value) => <option key={value} value={value}>{localizeMaxxisValue(value, language)}</option>)}</select></label>
        <label>{copy.compatibility}<select value={conditionCompatibility} onChange={(event) => setConditionCompatibility(event.target.value)}>{ARV_CONDITION_COMPATIBILITIES.map((value) => <option key={value} value={value}>{localizeMaxxisValue(value, language)}</option>)}</select></label>
        <label>{copy.notes}<textarea value={notes} maxLength={1000} onChange={(event) => setNotes(event.target.value)} /></label>
        <button type="button" disabled={saving} onClick={() => onSave?.(candidate, { targetCondition, observedCondition, conditionCompatibility, notes })}>{saving ? copy.saving : copy.save}</button>
      </div> : null}
    </article>
  );
}

export function MaxxisArvVisualCompReview({ messageId, data, onSetTarget, onSaveReview, onRequestGap, activeReviewKey = '', language = 'en' }) {
  const [targetDraft, setTargetDraft] = useState(data?.targetCondition || 'UNKNOWN');
  const [showSupporting, setShowSupporting] = useState(false);
  const [continued, setContinued] = useState(false);
  if (!data || !Array.isArray(data.candidates)) return null;
  const copy = COPY[language] || COPY.en;
  const targetConfirmed = data.targetConditionEvidenceStatus === 'USER_PROVIDED';
  if (continued) return <section className="maxxis-arv-continued" role="status">✓ {copy.continued}</section>;
  return (
    <section className="maxxis-arv-review" aria-label={copy.aria}>
      <MaxxisArvResultExperience evaluation={data.arvEvaluation} language={language} />
      <div className="maxxis-arv-summary" role="status">{data.summary?.reviewedCount || 0}/{data.summary?.totalStructuralCandidates || 0} {copy.reviewed} · {localizeMaxxisValue(data.summary?.status || 'NOT_STARTED', language)}</div>
      <div className="maxxis-arv-actions" aria-label={copy.aria}>
        <button type="button" onClick={() => onRequestGap?.(messageId, 'target_condition')}>{copy.confirm}</button>
        <button type="button" onClick={() => onRequestGap?.(messageId, 'rehab_budget')}>{copy.rehab}</button>
        <button type="button" onClick={() => setShowSupporting((value) => !value)}>{showSupporting ? copy.hideSupport : copy.support(data.candidates.length)}</button>
        <button type="button" onClick={() => setContinued(true)}>{copy.continue}</button>
      </div>
      {showSupporting ? <div className="maxxis-arv-supporting-list">
        <div className="maxxis-arv-target"><strong>{copy.condition}</strong><select value={targetDraft} onChange={(event) => setTargetDraft(event.target.value)}>{ARV_TARGET_CONDITIONS.map((value) => <option key={value} value={value}>{localizeMaxxisValue(value, language)}</option>)}</select><button type="button" disabled={activeReviewKey === 'target'} onClick={() => onSetTarget?.(messageId, targetDraft)}>{activeReviewKey === 'target' ? copy.saving : targetConfirmed ? copy.change : copy.confirm}</button><span className="maxxis-provenance-badge">{targetConfirmed ? copy.provenance : copy.prompt}</span></div>
        {data.candidates.map((candidate) => <ReviewCard key={`${candidate.stableCompIdentifier}:${candidate.review?.reviewedAt || 'unreviewed'}`} candidate={candidate} targetCondition={data.targetCondition} targetConfirmed={targetConfirmed} saving={activeReviewKey === candidate.stableCompIdentifier} onSave={(item, review) => onSaveReview?.(messageId, item, review)} language={language} copy={copy} />)}
      </div> : null}
      {data.reviewError ? <div className="maxxis-arv-review-error" role="alert">{data.reviewError}</div> : null}
      <small>{copy.disclaimer}</small>
    </section>
  );
}
