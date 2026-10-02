import React, { useMemo, useState } from 'react';
import { localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';

export const MAXXIS_TARGET_CONDITIONS = Object.freeze([
  'AS_IS', 'LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION',
  'HIGH_END', 'TURN_KEY', 'NEW_CONSTRUCTION',
]);

const LABELS = {
  en: {
    title: 'Advance the decision', intro: 'Resolve the highest-value assumption without delaying the available analysis.', why: 'Why it matters', unlocks: 'What this unlocks', value: 'Assumption value', yes: 'Yes', no: 'No', condition: 'Target condition', rehab: 'Rehabilitation budget', currentRehab: 'Current rehab', keep: 'Keep current value', reevaluate: 'Reevaluate', missingRehab: 'Not provided', own: 'Enter an amount', benchmark: 'Use 2026 state reference', without: 'Continue without rehab', amount: 'Rehab amount', reference: 'Preliminary reference · low confidence', benchmarkLabel: '2026 benchmark', perSqft: 'per sqft', within: 'The current value is within the reference range.', outside: 'The current value is outside the reference range.', addScope: 'Add renovation details', hideScope: 'Hide renovation details', scope: 'Renovation scope (optional)', save: 'Continue analysis', decline: 'Continue with limitations', saving: 'Saving…', edit: 'Edit', resolved: 'Information supplied', limitation: 'Continued with explicit limitations',
  },
  pt: {
    title: 'Avançar a decisão', intro: 'Resolva a premissa de maior impacto sem atrasar a análise já disponível.', why: 'Por que isso importa', unlocks: 'O que isso libera', value: 'Valor da premissa', yes: 'Sim', no: 'Não', condition: 'Condição alvo', rehab: 'Orçamento de reforma', currentRehab: 'Reforma atual', keep: 'Manter valor atual', reevaluate: 'Reavaliar', missingRehab: 'Não informado', own: 'Informar valor', benchmark: 'Usar referência estadual 2026', without: 'Continuar sem orçamento de reforma', amount: 'Valor da reforma', reference: 'Referência preliminar · baixa confiança', benchmarkLabel: 'Referência 2026', perSqft: 'por sqft', within: 'O valor informado está dentro da faixa de referência.', outside: 'O valor informado está fora da faixa de referência.', addScope: 'Adicionar detalhes do escopo', hideScope: 'Ocultar detalhes do escopo', scope: 'Escopo da reforma (opcional)', save: 'Continuar análise', decline: 'Continuar com limitações', saving: 'Salvando…', edit: 'Alterar', resolved: 'Informações fornecidas', limitation: 'Continuação com limitações explícitas',
  },
  es: {
    title: 'Avanzar la decisión', intro: 'Resuelve el supuesto de mayor impacto sin retrasar el análisis disponible.', why: 'Por qué importa', unlocks: 'Qué habilita', value: 'Valor del supuesto', yes: 'Sí', no: 'No', condition: 'Condición objetivo', rehab: 'Rehabilitación', currentRehab: 'Rehabilitación actual', keep: 'Mantener valor actual', reevaluate: 'Reevaluar', missingRehab: 'No informado', own: 'Ingresar un valor', benchmark: 'Usar referencia estatal 2026', without: 'Continuar sin rehabilitación', amount: 'Valor de rehabilitación', reference: 'Referencia preliminar · baja confianza', benchmarkLabel: 'Referencia 2026', perSqft: 'por sqft', within: 'El valor informado está dentro del rango de referencia.', outside: 'El valor informado está fuera del rango de referencia.', addScope: 'Agregar detalles del alcance', hideScope: 'Ocultar detalles del alcance', scope: 'Alcance de la reforma (opcional)', save: 'Continuar análisis', decline: 'Continuar con limitaciones', saving: 'Guardando…', edit: 'Editar', resolved: 'Información suministrada', limitation: 'Continuación con limitaciones explícitas',
  },
};

const currency = (value, language) => new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(Number(value || 0));
const currencyRate = (value, language) => new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number(value || 0));
const NUMERIC_ASSUMPTIONS = new Set(['sellingCosts', 'sellingCostPercent', 'holdingCosts', 'holdingPeriodMonths', 'interestRate', 'loanAmount', 'monthlyPayment', 'operatingExpenses', 'noi', 'vacancyRate', 'insurance', 'management', 'maintenance', 'hoa', 'dispositionPrice', 'assignmentFee', 'closingCosts', 'downPayment', 'termMonths', 'amortizationMonths', 'balloonMonths', 'existingLoanBalance', 'monthlyPiPayment', 'arrears', 'cashToSeller', 'reinstatement']);
const humanize = (value) => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());

function ChoiceButton({ active, disabled, children, onClick }) {
  return <button type="button" className="maxxis-inline-link maxxis-gap-choice" aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
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
  const decisionInputField = String(data.decisionInputField || '');
  const [decisionInputValue, setDecisionInputValue] = useState('');
  const copy = LABELS[language] || LABELS.en;
  const residentialNotApplicable = data.analysisApplicability?.residentialArv === 'NOT_APPLICABLE';
  const needsTarget = !residentialNotApplicable && missing.includes('target_condition');
  const needsRehab = !residentialNotApplicable && missing.includes('rehab_budget');
  const needsDecisionInput = Boolean(decisionInputField);
  const benchmark = useMemo(() => {
    const options = Array.isArray(data.benchmarkOptions) ? data.benchmarkOptions : [];
    return options.find((item) => item?.scope === targetCondition) || null;
  }, [data.benchmarkOptions, targetCondition]);
  const hasCustomValue = rehabBudget !== '' && Number.isFinite(Number(rehabBudget)) && Number(rehabBudget) >= 0;
  const rehabSatisfied = !needsRehab || rehabMode === 'unset' || rehabMode === 'without' || rehabMode === 'maintain'
    || (rehabMode === 'benchmark' && Boolean(benchmark)) || (rehabMode === 'custom' && hasCustomValue);
  const parsedDecisionNumber = Number(decisionInputValue);
  const decisionInputValid = !needsDecisionInput || (decisionInputField === 'assignability'
    ? ['true', 'false'].includes(decisionInputValue)
    : NUMERIC_ASSUMPTIONS.has(decisionInputField)
      ? decisionInputValue !== '' && Number.isFinite(parsedDecisionNumber) && parsedDecisionNumber >= 0
      : decisionInputValue.trim().length > 0);
  const valid = (!needsTarget || MAXXIS_TARGET_CONDITIONS.includes(targetCondition)) && rehabSatisfied && decisionInputValid;
  const rehabSanity = currentRehab !== null && benchmark?.livingAreaSqft
    ? {
        perSqft: currentRehab / Number(benchmark.livingAreaSqft),
        within: currentRehab >= Number(benchmark.low) && currentRehab <= Number(benchmark.high),
      }
    : null;

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
      ...(needsDecisionInput && decisionInputField === 'renovationScope'
        ? { renovationScope: decisionInputValue.trim() } : {}),
      ...(needsDecisionInput && decisionInputField !== 'renovationScope'
        ? { dealAssumptions: { [decisionInputField]: decisionInputField === 'assignability'
          ? decisionInputValue === 'true' : NUMERIC_ASSUMPTIONS.has(decisionInputField)
            ? parsedDecisionNumber : decisionInputValue.trim() } } : {}),
    });
  };

  return (
    <section className="maxxis-gap-inline" aria-label={copy.title} data-testid="maxxis-analysis-gap-resolution">
      <div className="maxxis-gap-resolution">
        <p>{copy.intro}</p>
        {data.decisionReason ? <p><strong>{copy.why}:</strong> {data.decisionReason}</p> : null}
        {data.decisionUnlocks ? <p><strong>{copy.unlocks}:</strong> {data.decisionUnlocks}</p> : null}
        {needsDecisionInput ? <label className="maxxis-gap-field">{data.decisionInputLabel || humanize(decisionInputField)}
          {decisionInputField === 'assignability' ? <select aria-label={data.decisionInputLabel || copy.value} value={decisionInputValue} disabled={busy} onChange={(event) => setDecisionInputValue(event.target.value)}>
            <option value="">—</option><option value="true">{copy.yes}</option><option value="false">{copy.no}</option>
          </select> : <input aria-label={data.decisionInputLabel || copy.value} type={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? 'number' : 'text'} inputMode={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? 'decimal' : undefined} min={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? '0' : undefined} maxLength={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? undefined : 1000} value={decisionInputValue} disabled={busy} onChange={(event) => setDecisionInputValue(event.target.value)} />}
        </label> : null}
        {needsTarget ? <label className="maxxis-gap-field">{copy.condition}
          <select aria-label={copy.condition} value={targetCondition} disabled={busy} onChange={(event) => setTargetCondition(event.target.value)}>
            {MAXXIS_TARGET_CONDITIONS.map((value) => <option key={value} value={value}>{localizeMaxxisValue(value, language)}</option>)}
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
          {rehabSanity ? <div className="maxxis-gap-sanity">
            <span>{copy.currentRehab}: <strong>{currency(currentRehab, language)}</strong> · {currencyRate(rehabSanity.perSqft, language)} {copy.perSqft}</span>
            <span>{copy.benchmarkLabel}: {currency(benchmark.low, language)}–{currency(benchmark.high, language)}</span>
            <strong>{rehabSanity.within ? copy.within : copy.outside}</strong>
          </div> : null}
        </fieldset> : null}
        {(needsTarget || needsRehab) ? <>
          <button type="button" className="maxxis-inline-link maxxis-gap-scope-toggle" aria-expanded={scopeOpen} disabled={busy} onClick={() => setScopeOpen((value) => !value)}>{scopeOpen ? copy.hideScope : copy.addScope}</button>
          {scopeOpen ? <label className="maxxis-gap-field">{copy.scope}
            <textarea aria-label={copy.scope} maxLength={1000} value={renovationScope} disabled={busy} onChange={(event) => setRenovationScope(event.target.value)} />
          </label> : null}
        </> : null}
        {data.error ? <p className="maxxis-gap-error" role="alert">{data.error}</p> : null}
        <div className="maxxis-gap-actions">
          <button type="button" className="maxxis-inline-link" disabled={busy || !valid} onClick={resolve}>{busy ? copy.saving : copy.save}</button>
          {!needsDecisionInput ? <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => onDecline?.(message, missing)}>{copy.decline}</button> : null}
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
        {values.targetCondition ? <span>✓ {copy.condition}: {localizeMaxxisValue(values.targetCondition, language)}</span> : null}
        {Number.isFinite(Number(values.rehabBudget)) ? <span>✓ {copy.rehab}: {currency(values.rehabBudget, language)}</span> : null}
        {declined.length ? <span>✓ {declined.map((field) => field === 'rehab_budget' ? copy.missingRehab : localizeMaxxisValue(field, language)).join(', ')}</span> : null}
      </div>
      <button type="button" className="maxxis-inline-link" onClick={() => onEdit?.(message)}>{copy.edit}</button>
    </section>
  );
}
