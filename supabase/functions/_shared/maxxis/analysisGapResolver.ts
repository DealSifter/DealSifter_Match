import { estimateRehabBenchmark2026 } from './rehabCostBenchmarks2026.ts';
import { classifyAnalysisApplicability, normalizeTargetCondition } from './analysisApplicability.ts';

export type AnalysisInputClassification = 'AVAILABLE' | 'PROVIDER_RESOLVABLE' | 'USER_RESOLVABLE'
  | 'CALCULABLE' | 'TRULY_UNAVAILABLE' | 'NOT_AUTHORIZED' | 'NOT_APPLICABLE';

type Assumptions = {
  targetCondition?: unknown;
  rehabBudget?: unknown;
  renovationScope?: unknown;
  rehabSource?: unknown;
  declinedInputs?: unknown;
};

const finite = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};
const text = (value: unknown) => String(value || '').trim();
const list = (value: unknown) => Array.isArray(value) ? value.map(text).filter(Boolean) : [];

function question(language: string, missing: string[]) {
  const target = missing.includes('target_condition');
  const rehab = missing.includes('rehab_budget');
  if (language === 'pt') {
    if (target && rehab) return 'Já tenho os dados principais do imóvel e a evidência de mercado. Para completar a análise, preciso confirmar a condição alvo e o orçamento de reforma. Quer informar agora?';
    if (target) return 'Para completar a análise de valuation, preciso confirmar a condição alvo do imóvel. Quer informar agora?';
    return 'Para completar os cenários de custo e margem, preciso confirmar o orçamento de reforma. Quer informar agora?';
  }
  if (language === 'es') {
    if (target && rehab) return 'Ya tengo los datos principales y la evidencia de mercado. Para completar el análisis, necesito confirmar la condición objetivo y el presupuesto de reforma. ¿Quieres informarlos ahora?';
    if (target) return 'Para completar el análisis de valoración, necesito confirmar la condición objetivo del inmueble. ¿Quieres informarla ahora?';
    return 'Para completar los escenarios de costo y margen, necesito confirmar el presupuesto de reforma. ¿Quieres informarlo ahora?';
  }
  if (target && rehab) return 'I have the main property and market evidence. To complete the analysis, I need the target condition and rehabilitation budget. Would you like to provide them now?';
  if (target) return 'To complete the valuation analysis, I need the property target condition. Would you like to provide it now?';
  return 'To complete the cost and margin scenarios, I need the rehabilitation budget. Would you like to provide it now?';
}

export function buildEvidenceCompletenessGate({ reportType, property, assumptions = {}, language = 'en' }: {
  reportType: string;
  property: Record<string, unknown> | null;
  assumptions?: Assumptions;
  language?: string;
}) {
  const enterprise = reportType === 'DEAL_INTELLIGENCE';
  const declined = new Set(list(assumptions.declinedInputs));
  const storedRehab = finite(property?.rehab);
  const userRehab = finite(assumptions.rehabBudget);
  const rehabAvailable = (storedRehab !== null && storedRehab > 0) || userRehab !== null;
  const targetCondition = normalizeTargetCondition(assumptions.targetCondition);
  const targetAvailable = Boolean(targetCondition);
  const applicability = classifyAnalysisApplicability(property, assumptions as Record<string, unknown>);
  const residentialScenarioApplicable = applicability.residentialArv === 'APPLICABLE';
  const missing: string[] = [];
  if (enterprise && residentialScenarioApplicable && !targetAvailable && !declined.has('target_condition')) {
    missing.push('target_condition');
  }
  // Rehab is an optional analytical assumption. Missing rehab limits cost/margin
  // scenarios, but must never block the deterministic analysis or report flow.
  const benchmarkOptions = (residentialScenarioApplicable
    ? ['LIGHT_REHAB', 'STANDARD_RENOVATION', 'FULL_RENOVATION', 'NEW_CONSTRUCTION'] : [])
    .map((condition) => estimateRehabBenchmark2026({
      state: property?.state,
      livingAreaSqft: property?.sqft ?? property?.livingAreaSqft,
      condition,
    })).filter(Boolean);
  const inputs = Object.freeze({
    property: 'AVAILABLE' as AnalysisInputClassification,
    rehabBudget: (applicability.rehab === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE'
      : rehabAvailable ? 'AVAILABLE' : declined.has('rehab_budget') ? 'TRULY_UNAVAILABLE' : 'USER_RESOLVABLE') as AnalysisInputClassification,
    targetCondition: (applicability.residentialArv === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE'
      : !enterprise ? 'NOT_AUTHORIZED' : targetAvailable ? 'AVAILABLE'
        : declined.has('target_condition') ? 'TRULY_UNAVAILABLE' : 'USER_RESOLVABLE') as AnalysisInputClassification,
    acquisitionPlusRehab: (applicability.rehab === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE'
      : rehabAvailable ? 'CALCULABLE' : 'TRULY_UNAVAILABLE') as AnalysisInputClassification,
  });
  return Object.freeze({
    type: 'evidence_completeness_gate',
    status: missing.length ? 'USER_INPUT_REQUIRED' : declined.size ? 'LIMITED' : 'READY',
    complete: missing.length === 0,
    missingUserInputs: Object.freeze(missing),
    question: missing.length ? question(language, missing) : '',
    inputs,
    assumptions: Object.freeze({
      targetCondition: targetAvailable ? targetCondition : null,
      rehabBudget: userRehab,
      renovationScope: text(assumptions.renovationScope) || null,
      rehabSource: text(assumptions.rehabSource) || null,
      declinedInputs: Object.freeze([...declined]),
      provenance: userRehab !== null || targetAvailable || text(assumptions.renovationScope) ? 'USER_PROVIDED' : null,
    }),
    benchmarkOptions: Object.freeze(benchmarkOptions),
    analysisApplicability: applicability,
  });
}
