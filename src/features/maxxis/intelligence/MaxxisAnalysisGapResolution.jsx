import React, { useState } from 'react';

const CONDITIONS = [
  'AS_IS', 'LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION',
  'HIGH_END', 'TURN_KEY', 'NEW_CONSTRUCTION',
];

const LABELS = {
  en: { title: 'Complete the analysis', condition: 'Target condition', rehab: 'Rehabilitation budget', scope: 'Renovation scope (optional)', save: 'Continue analysis', decline: 'Continue with limitations', saving: 'Saving…' },
  pt: { title: 'Completar a análise', condition: 'Condição alvo', rehab: 'Orçamento de reforma', scope: 'Escopo da reforma (opcional)', save: 'Continuar análise', decline: 'Continuar com limitações', saving: 'Salvando…' },
  es: { title: 'Completar el análisis', condition: 'Condición objetivo', rehab: 'Presupuesto de reforma', scope: 'Alcance de la reforma (opcional)', save: 'Continuar análisis', decline: 'Continuar con limitaciones', saving: 'Guardando…' },
};

const CONDITION_LABELS = {
  AS_IS: 'As-is', LIGHT_REHAB: 'Light rehab', STANDARD_RENOVATION: 'Standard renovation',
  FULL_RENOVATION: 'Full renovation', HIGH_END: 'High-end', TURN_KEY: 'Turn-key',
  NEW_CONSTRUCTION: 'New construction',
};

export function MaxxisAnalysisGapResolution({ message, language = 'en', onResolve, onDecline, busy = false }) {
  const missing = Array.isArray(message?.data?.missingUserInputs) ? message.data.missingUserInputs : [];
  const [targetCondition, setTargetCondition] = useState('AS_IS');
  const [rehabBudget, setRehabBudget] = useState('');
  const [renovationScope, setRenovationScope] = useState('');
  const copy = LABELS[language] || LABELS.en;
  const needsTarget = missing.includes('target_condition');
  const needsRehab = missing.includes('rehab_budget');
  const valid = (!needsTarget || CONDITIONS.includes(targetCondition))
    && (!needsRehab || rehabBudget !== '' && Number.isFinite(Number(rehabBudget)) && Number(rehabBudget) >= 0);
  return (
    <section className="maxxis-arv-review" aria-label={copy.title} data-testid="maxxis-analysis-gap-resolution">
      <div className="maxxis-arv-target">
        <strong>{copy.title}</strong>
        {needsTarget ? <label>{copy.condition}
          <select value={targetCondition} onChange={(event) => setTargetCondition(event.target.value)}>
            {CONDITIONS.map((value) => <option key={value} value={value}>{CONDITION_LABELS[value]}</option>)}
          </select>
        </label> : null}
        {needsRehab ? <label>{copy.rehab}
          <input type="number" min="0" max="1000000000" step="0.01" value={rehabBudget}
            onChange={(event) => setRehabBudget(event.target.value)} />
        </label> : null}
        {(needsTarget || needsRehab) ? <label>{copy.scope}
          <textarea maxLength={1000} value={renovationScope} onChange={(event) => setRenovationScope(event.target.value)} />
        </label> : null}
        <button type="button" disabled={busy || !valid} onClick={() => onResolve?.(message, {
          ...(needsTarget ? { targetCondition } : {}),
          ...(needsRehab ? { rehabBudget: Number(rehabBudget) } : {}),
          ...(renovationScope.trim() ? { renovationScope: renovationScope.trim() } : {}),
        })}>{busy ? copy.saving : copy.save}</button>
        <button type="button" disabled={busy} onClick={() => onDecline?.(message, missing)}>{copy.decline}</button>
      </div>
    </section>
  );
}
