import React, { useMemo, useState } from 'react';

export const MAXXIS_TARGET_CONDITIONS = Object.freeze([
  'AS_IS', 'LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION',
  'HIGH_END', 'TURN_KEY', 'NEW_CONSTRUCTION',
]);

const LABELS = {
  en: {
    title: 'Complete the analysis', condition: 'Target condition', rehab: 'Rehabilitation budget', currentRehab: 'Current rehab', keep: 'Keep current value', reevaluate: 'Reevaluate', missingRehab: 'Not provided', own: 'Enter an amount', benchmark: 'Use 2026 state reference', without: 'Continue without rehab', amount: 'Rehab amount', reference: 'Preliminary reference · low confidence', addScope: 'Add renovation details', hideScope: 'Hide renovation details', scope: 'Renovation scope (optional)', save: 'Continue analysis', decline: 'Continue with limitations', saving: 'Saving…', edit: 'Edit', resolved: 'Information supplied', limitation: 'Continued with explicit limitations',
  },
  pt: {
    title: 'Completar a análise', condition: 'Condição alvo', rehab: 'Orçamento de reforma', currentRehab: 'Rehab atual', keep: 'Manter valor atual', reevaluate: 'Reavaliar', missingRehab: 'Não informado', own: 'Informar valor', benchmark: 'Usar referência estadual 2026', without: 'Continuar sem rehab', amount: 'Valor da reforma', reference: 'Referência preliminar · baixa confiança', addScope: 'Adicionar detalhes do escopo', hideScope: 'Ocultar detalhes do escopo', scope: 'Escopo da reforma (opcional)', save: 'Continuar análise', decline: 'Continuar com limitações', saving: 'Salvando…', edit: 'Alterar', resolved: 'Informações fornecidas', limitation: 'Continuação com limitações explícitas',
  },
  es: {
    title: 'Completar el análisis', condition: 'Condición objetivo', rehab: 'Presupuesto de reforma', currentRehab: 'Rehabilitación actual', keep: 'Mantener valor actual', reevaluate: 'Reevaluar', missingRehab: 'No informado', own: 'Ingresar un valor', benchmark: 'Usar referencia estatal 2026', without: 'Continuar sin rehabilitación', amount: 'Valor de rehabilitación', reference: 'Referencia preliminar · baja confianza', addScope: 'Agregar detalles del alcance', hideScope: 'Ocultar detalles del alcance', scope: 'Alcance de la reforma (opcional)', save: 'Continuar análisis', decline: 'Continuar con limitaciones', saving: 'Guardando…', edit: 'Editar', resolved: 'Información suministrada', limitation: 'Continuación con limitaciones explícitas',
  },
};

const CONDITION_LABELS = {
  AS_IS: 'As-is', LIGHT_REHAB: 'Light rehab', STANDARD_RENOVATION: 'Standard renovation',
  FULL_RENOVATION: 'Full renovation', HIGH_END: 'High-end', TURN_KEY: 'Turn-key', NEW_CONSTRUCTION: 'New construction',
};

const currency = (value, language) => new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(Number(value || 0));

function ChoiceButton({ active, disabled, children, onClick }) {
  return <button type="button" className="maxxis-gap-choice" aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function MaxxisAnalysisGapResolution({ message, language = 'en', onResolve, onDecline, busy = false }) {
  const data = message?.data || {};
  const missing = Array.isArray(data.missingUserInputs) ? data.missingUserInputs : [];
  const assumptions = data.assumptions || {};
  const storedTargetCondition = MAXXIS_TARGET_CONDITIONS.includes(assumptions.targetCondition) ? assumptions.targetCondition : 'AS_IS';
  const hasCurrentRehab = data.currentRehab !== null && data.currentRehab !== undefined && data.currentRehab !== '';
  const currentRehab = hasCurrentRehab && Number.isFinite(Number(data.currentRehab)) && Number(data.currentRehab) >= 0 ? Number(data.currentRehab) : null;
  const [targetCondition, setTargetCondition] = useState(storedTargetCondition);
  const [rehabBudget, setRehabBudget] = useState(Number.isFinite(Number(assumptions.rehabBudget)) ? String(assumptions.rehabBudget) : '');
  const initialRehabMode = currentRehab !== null ? 'maintain'
    : assumptions.rehabSource === 'USER_CURATED_REHAB_BENCHMARK_2026' ? 'benchmark'
      : assumptions.rehabSource === 'USER_PROVIDED' ? 'custom' : 'unset';
  const [rehabMode, setRehabMode] = useState(initialRehabMode);
  const [renovationScope, setRenovationScope] = useState(String(assumptions.renovationScope || ''));
  const [scopeOpen, setScopeOpen] = useState(Boolean(assumptions.renovationScope));
  const copy = LABELS[language] || LABELS.en;
  const needsTarget = missing.includes('target_condition');
  const needsRehab = missing.includes('rehab_budget');
  const benchmark = useMemo(() => {
    const options = Array.isArray(data.benchmarkOptions) ? data.benchmarkOptions : [];
    return options.find((item) => item?.scope === targetCondition) || null;
  }, [data.benchmarkOptions, targetCondition]);
  const hasCustomValue = rehabBudget !== '' && Number.isFinite(Number(rehabBudget)) && Number(rehabBudget) >= 0;
  const rehabSatisfied = !needsRehab || rehabMode === 'without' || rehabMode === 'maintain'
    || (rehabMode === 'benchmark' && Boolean(benchmark)) || (rehabMode === 'custom' && hasCustomValue);
  const valid = (!needsTarget || MAXXIS_TARGET_CONDITIONS.includes(targetCondition)) && rehabSatisfied;

  const resolve = () => {
    if (!valid || busy) return;
    if (rehabMode === 'without') {
      onDecline?.(message, needsRehab ? ['rehab_budget'] : missing);
      return;
    }
    onResolve?.(message, {
      ...(needsTarget ? { targetCondition } : {}),
      ...(rehabMode === 'benchmark' && benchmark ? { rehabBudget: benchmark.mid, rehabSource: 'USER_CURATED_REHAB_BENCHMARK_2026' } : {}),
      ...(rehabMode === 'custom' && hasCustomValue ? { rehabBudget: Number(rehabBudget), rehabSource: 'USER_PROVIDED' } : {}),
      ...(renovationScope.trim() ? { renovationScope: renovationScope.trim() } : {}),
    });
  };

  return (
    <section className="maxxis-arv-review" aria-label={copy.title} data-testid="maxxis-analysis-gap-resolution">
      <div className="maxxis-arv-target maxxis-gap-resolution">
        <strong>{copy.title}</strong>
        {needsTarget ? <label className="maxxis-gap-field">{copy.condition}
          <select aria-label={copy.condition} value={targetCondition} disabled={busy} onChange={(event) => setTargetCondition(event.target.value)}>
            {MAXXIS_TARGET_CONDITIONS.map((value) => <option key={value} value={value}>{CONDITION_LABELS[value]}</option>)}
          </select>
        </label> : null}
        {needsRehab ? <fieldset className="maxxis-gap-rehab-options"><legend>{copy.rehab}</legend>
          <div className="maxxis-gap-current"><span>{currentRehab !== null ? `${copy.currentRehab}: ${currency(currentRehab, language)}` : `${copy.rehab}: ${copy.missingRehab}`}</span></div>
          <div className="maxxis-gap-choices">
            {currentRehab !== null ? <ChoiceButton active={rehabMode === 'maintain'} disabled={busy} onClick={() => setRehabMode('maintain')}>{copy.keep}</ChoiceButton> : null}
            <ChoiceButton active={rehabMode === 'custom'} disabled={busy} onClick={() => setRehabMode('custom')}>{currentRehab !== null ? copy.reevaluate : copy.own}</ChoiceButton>
            <ChoiceButton active={rehabMode === 'benchmark'} disabled={busy || !benchmark} onClick={() => setRehabMode('benchmark')}>{copy.benchmark}</ChoiceButton>
            <ChoiceButton active={rehabMode === 'without'} disabled={busy} onClick={() => setRehabMode('without')}>{copy.without}</ChoiceButton>
          </div>
          {rehabMode === 'custom' ? <label className="maxxis-gap-field">{copy.amount}
            <input aria-label={copy.amount} type="number" inputMode="decimal" min="0" max="1000000000" step="0.01" value={rehabBudget} disabled={busy} onChange={(event) => setRehabBudget(event.target.value)} />
          </label> : null}
          {rehabMode === 'benchmark' && benchmark ? <small>{copy.reference}: {currency(benchmark.low, language)}–{currency(benchmark.high, language)} ({currency(benchmark.mid, language)})</small> : null}
        </fieldset> : null}
        {(needsTarget || needsRehab) ? <>
          <button type="button" className="maxxis-gap-scope-toggle" aria-expanded={scopeOpen} disabled={busy} onClick={() => setScopeOpen((value) => !value)}>{scopeOpen ? copy.hideScope : copy.addScope}</button>
          {scopeOpen ? <label className="maxxis-gap-field">{copy.scope}
            <textarea aria-label={copy.scope} maxLength={1000} value={renovationScope} disabled={busy} onChange={(event) => setRenovationScope(event.target.value)} />
          </label> : null}
        </> : null}
        {data.error ? <p className="maxxis-gap-error" role="alert">{data.error}</p> : null}
        <div className="maxxis-gap-actions">
          <button type="button" disabled={busy || !valid} onClick={resolve}>{busy ? copy.saving : copy.save}</button>
          <button type="button" disabled={busy} onClick={() => onDecline?.(message, missing)}>{copy.decline}</button>
        </div>
      </div>
    </section>
  );
}

export function MaxxisAnalysisGapResolved({ message, language = 'en', onEdit }) {
  const copy = LABELS[language] || LABELS.en;
  const resolution = message?.data?.resolution || {};
  const values = resolution.values || {};
  const declined = Array.isArray(resolution.declinedFields) ? resolution.declinedFields : [];
  return (
    <section className="maxxis-gap-resolved" data-testid="maxxis-analysis-gap-resolved">
      <div>
        <strong>{declined.length ? copy.limitation : copy.resolved}</strong>
        {values.targetCondition ? <span>{copy.condition}: {CONDITION_LABELS[values.targetCondition] || values.targetCondition}</span> : null}
        {Number.isFinite(Number(values.rehabBudget)) ? <span>{copy.rehab}: {currency(values.rehabBudget, language)}</span> : null}
        {declined.length ? <span>{declined.join(', ')}</span> : null}
      </div>
      <button type="button" onClick={() => onEdit?.(message)}>{copy.edit}</button>
    </section>
  );
}
