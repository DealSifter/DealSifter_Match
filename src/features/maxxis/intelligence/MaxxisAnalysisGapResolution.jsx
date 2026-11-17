import { toKnownFiniteNumber } from '../../../../supabase/functions/_shared/maxxis/canonicalFactSemantics.ts';
import { FINANCIAL_INPUT_FIELDS } from '../../../../supabase/functions/_shared/maxxis/financialInputContract.ts';
import React, { useMemo, useState } from 'react';
import { localizeMaxxisValue } from '../presentation/maxxisPresentationI18n';
import { COMPLETION_FIELDS, completionLabel } from '../../../../supabase/functions/_shared/maxxis/reportCompletion.ts';
import { ASSISTED_PARAMETERS, assistedEstimateCopy, assistedParameterValue } from '../../../../supabase/functions/_shared/maxxis/unknownInputResolution.ts';

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

const currency = (value, language) => toKnownFiniteNumber(value) === null ? LABELS[language]?.missingRehab || LABELS.en.missingRehab : new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(toKnownFiniteNumber(value));
const currencyRate = (value, language) => toKnownFiniteNumber(value) === null ? LABELS[language]?.missingRehab || LABELS.en.missingRehab : new Intl.NumberFormat(language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(toKnownFiniteNumber(value));
const NUMERIC_ASSUMPTIONS = new Set([...Object.keys(FINANCIAL_INPUT_FIELDS), 'sellingCosts', 'sellingCostPercent', 'holdingCosts', 'holdingPeriodMonths', 'interestRate', 'loanAmount', 'monthlyPayment', 'operatingExpenses', 'noi', 'vacancyRate', 'insurance', 'management', 'maintenance', 'hoa', 'dispositionPrice', 'assignmentFee', 'closingCosts', 'downPayment', 'termMonths', 'amortizationMonths', 'balloonMonths', 'existingLoanBalance', 'monthlyPiPayment', 'arrears', 'cashToSeller', 'reinstatement']);
const humanize = (value) => String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase());

function ChoiceButton({ active, disabled, children, onClick }) {
  return <button type="button" className="maxxis-inline-link maxxis-gap-choice" aria-pressed={active} disabled={disabled} onClick={onClick}>{children}</button>;
}

function CompletionQuestions({ message, language, onResolve, onDecline, busy }) {
  const data = message.data, preflight = data.reportPreflight;
  const [manual, setManual] = useState(false);
  const [parameterMode, setParameterMode] = useState(false);
  const [reviewEstimate, setReviewEstimate] = useState(false);
  const unknown = !manual && (data.unknownChoice || preflight?.gaps?.some(g => preflight?.unknownResolution?.unknown?.[g.id]));
  const missingCostGaps = (preflight?.gaps || []).filter(g => ['holdingCosts', 'financingCosts', 'sellingCosts'].includes(g.id));
  const estimates = missingCostGaps.map(g => preflight?.unknownResolution?.candidates?.[g.id]).filter(Boolean);
  const parameters = [...new Set(missingCostGaps.flatMap(g => preflight?.unknownResolution?.unavailable?.[g.id]?.missing || []))]
    .filter(id => COMPLETION_FIELDS[id] && !preflight?.fields?.[id]?.confirmed).slice(0, 3);
  const questions = parameterMode ? parameters.map(id => ({ id })) : data.completionCandidates
    ? Object.keys(data.completionCandidates.values).filter(key => key !== 'opexMethod').map(id => ({ id }))
    : preflight?.questions || [];
  const [values, setValues] = useState(() => ({ ...Object.fromEntries(questions.filter(q => q.candidate).map(q => [q.id, q.candidate.value])), ...(data.completionCandidates?.values || {}),
    ...Object.fromEntries(questions.filter(q => q.id === 'opexPercent').map(q => [q.id, 30])) }));
  const isPt = language === 'pt', isEs = language === 'es';
  const partial = preflight?.status === 'PARTIAL_ALLOWED';
  const options = { financingMode: ['CASH', 'FINANCED'], financingScope: ['NO_FINANCING_CHARGES', 'CHARGES_APPLY'],
    holdingExpenseScope: ['ITEMIZED_EXCLUDES_REHAB_AND_FINANCING'], financingInterestMethod: ['INTEREST_ONLY'], financingCostScope: ASSISTED_PARAMETERS.financingCostScope.options };
  const optionLabel = value => Object.values(options).some(items => items.includes(value)) ? assistedParameterValue(value, language) : localizeMaxxisValue(value, language);
  const metrics = preflight?.scenario?.calculatedOutputs || {};
  const metricSummary = ['NOI','capRate','ROI','DSCR'].filter(key=>typeof metrics[key]==='number'&&Number.isFinite(metrics[key]))
    .map(key=>`${key}: ${new Intl.NumberFormat(isPt?'pt-BR':isEs?'es-US':'en-US',{maximumFractionDigits:2}).format(metrics[key])}${key==='capRate'||key==='ROI'?'%':key==='NOI'?' USD / year':''}`).join(' · ');
  const valid = questions.every(({ id }) => id === 'target_condition' ? MAXXIS_TARGET_CONDITIONS.includes(values[id])
    : id === 'opexMethod' ? ['ITEMIZED', 'AGGREGATE_EGI'].includes(values[id])
      : options[id] ? options[id].includes(values[id])
      : id === 'scenarioStrategy' ? Boolean(values[id])
        : values[id] !== '' && values[id] !== undefined && Number.isFinite(Number(values[id])) && Number(values[id]) >= 0
          && Number(values[id]) <= (COMPLETION_FIELDS[id]?.unit === 'PERCENT' ? 100 : 1e9));
  const submit = () => {
    if (!valid || busy) return;
    const inputs = { ...values }, condition = inputs.target_condition; delete inputs.target_condition;
    onResolve(message, { ...(condition ? { targetCondition: condition } : {}),
      ...(Object.keys(inputs).length ? { completionInputs: Object.fromEntries(Object.entries(inputs).map(([k, v]) =>
        [k, ['opexMethod', 'scenarioStrategy'].includes(k) || options[k] ? v : Number(v)])) } : {}) });
  };
  return <section className="maxxis-gap-inline" data-testid="maxxis-analysis-gap-resolution" aria-label={isPt ? 'Completar análise' : 'Complete analysis'}>
    <div className="maxxis-gap-resolution">
      <p>{data.completionCandidates
        ? (isPt ? 'Confira os valores entendidos. Só serão usados no cenário privado após sua confirmação.' : isEs ? 'Revisa los valores interpretados. Solo se usarán en el escenario privado tras confirmar.' : 'Review the understood values. They enter your private scenario only after confirmation.')
        : (isPt ? 'Consultei o cadastro, o contexto confirmado e o cache disponível. Preciso apenas dos dados abaixo para continuar.' : isEs ? 'Consulté el registro, el contexto confirmado y la caché disponible. Solo faltan los datos siguientes.' : 'I checked the property record, confirmed context and available cache. Only the inputs below remain.')} </p>
      {preflight?.scenario?.calculatedOutputs?.operatingReadiness === 'BLOCKED_CONFLICT' ? <><p role="alert">{isPt ? 'As despesas conhecidas ultrapassam o orçamento OPEX total. Revise a porcentagem ou escolha despesas específicas.' : 'Known expenses exceed the total OPEX budget. Revise the percentage or select itemized expenses.'}</p>
        <button type="button" className="maxxis-inline-link" disabled={busy} onClick={()=>onResolve(message,{completionInputs:{opexMethod:'ITEMIZED'}})}>{isPt?'Usar despesas específicas':'Use itemized expenses'}</button></> : null}
      {unknown ? <>
        <p>{isPt ? 'Você não precisa conhecer todos esses valores. Posso usar estimativas ilustrativas quando houver base confirmada ou continuar com um relatório parcial, indicando o que ainda não é calculável.' : isEs ? 'Puedes usar estimaciones ilustrativas con base confirmada o continuar con un informe parcial que indique lo que aún no se puede calcular.' : 'You do not need to know every value. I can use illustrative estimates with a confirmed basis, or continue with a partial report showing what cannot yet be calculated.'}</p>
        {missingCostGaps.filter(g => !preflight?.unknownResolution?.candidates?.[g.id]).map(g => <p key={g.id}><strong>{completionLabel(g.id, language)}</strong>: {isPt ? 'Para estimar, confirme: ' : isEs ? 'Para estimar, confirma: ' : 'To estimate, confirm: '}{(preflight?.unknownResolution?.unavailable?.[g.id]?.missing || []).map(id => completionLabel(id, language)).join(', ')}.</p>)}
        {estimates.length ? <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => setReviewEstimate(true)}>{isPt ? 'Estimar e continuar' : isEs ? 'Estimar y continuar' : 'Estimate and continue'}</button> : null}
        {reviewEstimate ? <>
          {estimates.map(estimate => <div key={estimate.field}><strong>{completionLabel(estimate.field, language)}: {currency(estimate.value, language)}</strong>
            <p>{isPt ? 'Premissa ilustrativa do sistema, ainda não adotada. Total para o período confirmado.' : isEs ? 'Supuesto ilustrativo del sistema, todavía no adoptado. Total del período confirmado.' : 'Illustrative system assumption, not yet adopted. Total for the confirmed period.'}</p>
            <p>{assistedEstimateCopy(estimate, language).formula}</p>
            <p>{Object.entries(estimate.basis).map(([key, item]) => `${completionLabel(key, language)}: ${typeof item.value === 'number' ? item.value : optionLabel(item.value)}`).join(' · ')}</p>
            <p>{assistedEstimateCopy(estimate, language).limitations}</p>
          </div>)}
          <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => onResolve(message, { acceptEstimateFields: estimates.map(e => e.field) })}>{isPt ? 'Confirmar estimativas apresentadas e continuar' : isEs ? 'Confirmar estimaciones y continuar' : 'Confirm displayed estimates and continue'}</button>
        </> : null}
        {preflight?.partialAvailable ? <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => onResolve(message, { completionPartialAccepted: true })}>{isPt ? 'Continuar com dados parciais' : isEs ? 'Continuar con datos parciales' : 'Continue with partial data'}</button> : null}
        <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => { setManual(true); setParameterMode(false); setValues({}); }}>{isPt ? 'Informar valores manualmente' : isEs ? 'Introducir valores manualmente' : 'Enter values manually'}</button>
        {parameters.length ? <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => { setParameterMode(true); setValues({}); }}>{isPt ? 'Informar parâmetros para estimar' : isEs ? 'Introducir parámetros para estimar' : 'Provide estimation parameters'}</button> : null}
      </> : null}
      {(!unknown || parameterMode) && questions.map(({ id }) => <label className="maxxis-gap-field" key={id}>{completionLabel(id, language)}
        {id === 'target_condition' || id === 'opexMethod' || id === 'scenarioStrategy' || options[id] ? <select value={values[id] || ''} disabled={busy} onChange={e => setValues(v => ({ ...v, [id]: e.target.value }))}>
          <option value="">—</option>
          {(options[id] || (id === 'target_condition' ? MAXXIS_TARGET_CONDITIONS : id === 'opexMethod' ? ['ITEMIZED', 'AGGREGATE_EGI'] : ['BUY_AND_HOLD', 'FLIP', 'SUB_TO', 'WHOLESALE', 'SELLER_FINANCING', 'LAND'])).map(value => <option key={value} value={value}>{value === 'AGGREGATE_EGI' ? (isPt ? 'OPEX total presumido (% da receita efetiva)' : 'Assumed total OPEX (% of effective income)') : value === 'ITEMIZED' ? (isPt ? 'Despesas específicas' : 'Itemized expenses') : optionLabel(value)}</option>)}
        </select> : <input type="number" min="0" step="0.01" max={COMPLETION_FIELDS[id]?.unit === 'PERCENT' ? 100 : 1e9} value={values[id] ?? ''} disabled={busy} onChange={e => setValues(v => ({ ...v, [id]: e.target.value }))} />}
        {COMPLETION_FIELDS[id] && !options[id] ? <small>{COMPLETION_FIELDS[id].unit === 'PERCENT' ? '%' : COMPLETION_FIELDS[id].unit === 'MONTHS' ? (isPt ? 'Meses' : isEs ? 'Meses' : 'Months') : 'US$'}{COMPLETION_FIELDS[id].cadence === 'MONTHLY' ? (isPt ? ' por mês' : ' per month') : COMPLETION_FIELDS[id].cadence === 'ANNUAL' ? (isPt ? ' por ano' : ' per year') : (isPt ? ' · total da operação' : ' · operation total')}{id === 'rent' ? (isPt ? ' · Premissa de aluguel; não comprova renda contratual.' : ' · Rental assumption; not proof of contract income.') : ''}</small> : null}
        {id === 'opexPercent' ? <small>{isPt ? '30% é apenas uma sugestão ilustrativa editável. Inclui as despesas conhecidas e exclui vacância e dívida. Só será usada ao confirmar.' : '30% is an editable illustration only. Includes known expenses; excludes vacancy and debt. Applied only when confirmed.'}</small> : null}
      </label>)}
      {partial ? <p>{isPt ? 'O cenário disponível será identificado como projeção. Há limitações de evidência ou métricas opcionais; deseja gerar com essas limitações?' : 'Available scenario results will be labeled projections. Evidence or optional metrics remain incomplete; generate with these limitations?'}</p> : null}
      {partial && metricSummary ? <p><strong>{isPt?'Projeções do cenário confirmado':'Confirmed scenario projections'}</strong><br/>{metricSummary}</p> : null}
      {data.error ? <p className="maxxis-gap-error" role="alert">{data.error}</p> : null}
      <div className="maxxis-gap-actions">
        {questions.length && (!unknown || parameterMode) ? <button type="button" className="maxxis-inline-link" disabled={busy || !valid} onClick={submit}>{busy ? (isPt ? 'Salvando…' : 'Saving…') : (isPt ? 'Confirmar os valores acima' : 'Confirm the values above')}</button> : null}
        {partial ? <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => onResolve(message, { completionPartialAccepted: true })}>{isPt ? 'Gerar com limitações explícitas' : 'Generate with explicit limitations'}</button> : null}
        {questions.length && !unknown ? <button type="button" className="maxxis-inline-link" disabled={busy} onClick={() => onDecline(message, questions.map(q => q.id))}>{isPt ? 'Não sei' : isEs ? 'No sé' : "I don't know"}</button> : null}
      </div>
    </div>
  </section>;
}

export function MaxxisAnalysisGapResolution({ message, language = 'en', onResolve, onDecline, busy = false }) {
  if (message?.data?.reportPreflight || message?.data?.completionCandidates) return <CompletionQuestions key={`${message.id}:${message.data.expectedRevision || 0}`} {...{ message, language, onResolve, onDecline, busy }} />;
  return <ExistingAnalysisGapResolution {...{ message, language, onResolve, onDecline, busy }} />;
}

function ExistingAnalysisGapResolution({ message, language = 'en', onResolve, onDecline, busy = false }) {
  const data = message?.data || {};
  const missing = Array.isArray(data.missingUserInputs) ? data.missingUserInputs : [];
  const assumptions = data.assumptions || {};
  const storedTargetCondition = MAXXIS_TARGET_CONDITIONS.includes(assumptions.targetCondition) ? assumptions.targetCondition : '';
  const hasCurrentRehab = data.currentRehab !== null && data.currentRehab !== undefined && data.currentRehab !== '';
  const currentRehab = hasCurrentRehab && toKnownFiniteNumber(data.currentRehab) !== null && Number(data.currentRehab) >= 0 ? Number(data.currentRehab) : null;
  const [targetCondition, setTargetCondition] = useState(storedTargetCondition);
  const [rehabBudget, setRehabBudget] = useState(toKnownFiniteNumber(assumptions.rehabBudget) !== null ? String(assumptions.rehabBudget) : '');
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
  const hasCustomValue = rehabBudget !== '' && toKnownFiniteNumber(rehabBudget) !== null && Number(rehabBudget) >= 0;
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
        {needsDecisionInput ? <label className="maxxis-gap-field">{data.decisionInputLabel || humanize(decisionInputField)}{Object.hasOwn(FINANCIAL_INPUT_FIELDS, decisionInputField) ? ` (${FINANCIAL_INPUT_FIELDS[decisionInputField].unit === 'PERCENT' ? '%' : 'USD'} / ${FINANCIAL_INPUT_FIELDS[decisionInputField].cadence === 'MONTHLY' ? (language === 'pt' ? 'mês' : 'month') : (language === 'pt' ? 'ano' : 'year')})` : ''}
          {decisionInputField === 'assignability' ? <select aria-label={data.decisionInputLabel || copy.value} value={decisionInputValue} disabled={busy} onChange={(event) => setDecisionInputValue(event.target.value)}>
            <option value="">—</option><option value="true">{copy.yes}</option><option value="false">{copy.no}</option>
          </select> : <input aria-label={data.decisionInputLabel || copy.value} type={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? 'number' : 'text'} inputMode={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? 'decimal' : undefined} min={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? '0' : undefined} maxLength={NUMERIC_ASSUMPTIONS.has(decisionInputField) ? undefined : 1000} value={decisionInputValue} disabled={busy} onChange={(event) => setDecisionInputValue(event.target.value)} />}
        </label> : null}
        {needsTarget ? <label className="maxxis-gap-field">{copy.condition}
          <select aria-label={copy.condition} value={targetCondition} disabled={busy} onChange={(event) => setTargetCondition(event.target.value)}>
            <option value="" disabled>{language === 'pt' ? 'Selecione e confirme a condição' : language === 'es' ? 'Selecciona y confirma la condición' : 'Select and confirm the condition'}</option>
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
        {toKnownFiniteNumber(values.rehabBudget) !== null ? <span>✓ {copy.rehab}: {currency(values.rehabBudget, language)}</span> : null}
        {declined.length ? <span>✓ {declined.map((field) => field === 'rehab_budget' ? copy.missingRehab : localizeMaxxisValue(field, language)).join(', ')}</span> : null}
      </div>
      <button type="button" className="maxxis-inline-link" onClick={() => onEdit?.(message)}>{copy.edit}</button>
    </section>
  );
}
