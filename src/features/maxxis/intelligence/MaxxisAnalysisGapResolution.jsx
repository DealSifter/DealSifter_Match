import React, { useState } from 'react';

const CONDITIONS = [
  'AS_IS', 'LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION',
  'HIGH_END', 'TURN_KEY', 'NEW_CONSTRUCTION',
];

const LABELS = {
  en: { title: 'Complete the analysis', condition: 'Target condition', rehab: 'Rehabilitation budget', own: 'Enter my budget', benchmark: 'Use 2026 state benchmark', reference: 'Preliminary reference only · low confidence', scope: 'Renovation scope (optional)', save: 'Continue analysis', decline: 'Continue with limitations', saving: 'Saving…' },
  pt: { title: 'Completar a análise', condition: 'Condição alvo', rehab: 'Orçamento de reforma', own: 'Informar meu orçamento', benchmark: 'Usar referência estadual 2026', reference: 'Referência preliminar · baixa confiança', scope: 'Escopo da reforma (opcional)', save: 'Continuar análise', decline: 'Continuar com limitações', saving: 'Salvando…' },
  es: { title: 'Completar el análisis', condition: 'Condición objetivo', rehab: 'Presupuesto de reforma', own: 'Ingresar mi presupuesto', benchmark: 'Usar referencia estatal 2026', reference: 'Referencia preliminar · baja confianza', scope: 'Alcance de la reforma (opcional)', save: 'Continuar análisis', decline: 'Continuar con limitaciones', saving: 'Guardando…' },
};

const CONDITION_LABELS = {
  AS_IS: 'As-is', LIGHT_REHAB: 'Light rehab', STANDARD_RENOVATION: 'Standard renovation',
  FULL_RENOVATION: 'Full renovation', HIGH_END: 'High-end', TURN_KEY: 'Turn-key',
  NEW_CONSTRUCTION: 'New construction',
};

export function MaxxisAnalysisGapResolution({ message, language = 'en', onResolve, onDecline, busy = false }) {
  const missing = Array.isArray(message?.data?.missingUserInputs) ? message.data.missingUserInputs : [];
  const storedTargetCondition = CONDITIONS.includes(message?.data?.assumptions?.targetCondition)
    ? message.data.assumptions.targetCondition : 'AS_IS';
  const [targetCondition, setTargetCondition] = useState(storedTargetCondition);
  const [rehabBudget, setRehabBudget] = useState('');
  const [rehabMode, setRehabMode] = useState('custom');
  const [renovationScope, setRenovationScope] = useState('');
  const copy = LABELS[language] || LABELS.en;
  const needsTarget = missing.includes('target_condition');
  const needsRehab = missing.includes('rehab_budget');
  const benchmarkOptions = Array.isArray(message?.data?.benchmarkOptions) ? message.data.benchmarkOptions : [];
  const benchmark = benchmarkOptions.find((item) => item?.scope === targetCondition) || null;
  const valid = (!needsTarget || CONDITIONS.includes(targetCondition))
    && (!needsRehab || (rehabMode === 'benchmark' ? Boolean(benchmark)
      : rehabBudget !== '' && Number.isFinite(Number(rehabBudget)) && Number(rehabBudget) >= 0));
  return (
    <section className="maxxis-arv-review" aria-label={copy.title} data-testid="maxxis-analysis-gap-resolution">
      <div className="maxxis-arv-target">
        <strong>{copy.title}</strong>
        {needsTarget ? <label>{copy.condition}
          <select value={targetCondition} onChange={(event) => setTargetCondition(event.target.value)}>
            {CONDITIONS.map((value) => <option key={value} value={value}>{CONDITION_LABELS[value]}</option>)}
          </select>
        </label> : null}
        {needsRehab ? <fieldset className="maxxis-gap-rehab-options"><legend>{copy.rehab}</legend>
          <label><input type="radio" name={`rehab-mode-${message.id}`} checked={rehabMode === 'custom'}
            onChange={() => setRehabMode('custom')} /> {copy.own}</label>
          {rehabMode === 'custom' ? <input type="number" min="0" max="1000000000" step="0.01" value={rehabBudget}
            onChange={(event) => setRehabBudget(event.target.value)} /> : null}
          <label><input type="radio" name={`rehab-mode-${message.id}`} checked={rehabMode === 'benchmark'}
            disabled={!benchmark} onChange={() => setRehabMode('benchmark')} /> {copy.benchmark}</label>
          {rehabMode === 'benchmark' && benchmark ? <small>{copy.reference}: ${benchmark.low.toLocaleString()}–${benchmark.high.toLocaleString()} (mid ${benchmark.mid.toLocaleString()})</small> : null}
        </fieldset> : null}
        {(needsTarget || needsRehab) ? <label>{copy.scope}
          <textarea maxLength={1000} value={renovationScope} onChange={(event) => setRenovationScope(event.target.value)} />
        </label> : null}
        <button type="button" disabled={busy || !valid} onClick={() => onResolve?.(message, {
          ...(needsTarget ? { targetCondition } : {}),
          ...(needsRehab ? { rehabBudget: rehabMode === 'benchmark' ? benchmark.mid : Number(rehabBudget),
            rehabSource: rehabMode === 'benchmark' ? 'USER_CURATED_REHAB_BENCHMARK_2026' : 'USER_PROVIDED' } : {}),
          ...(renovationScope.trim() ? { renovationScope: renovationScope.trim() } : {}),
        })}>{busy ? copy.saving : copy.save}</button>
        <button type="button" disabled={busy} onClick={() => onDecline?.(message, missing)}>{copy.decline}</button>
      </div>
    </section>
  );
}
