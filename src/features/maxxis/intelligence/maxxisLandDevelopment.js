import { isVacantLandProperty } from '../../../../supabase/functions/_shared/maxxis/analysisApplicability.ts';
import { parseCanonicalLotArea } from '../../../../supabase/functions/_shared/maxxis/landMetrics.ts';
import { parseLandDevelopmentAssumptions, formatLandDevelopmentAnswer, LAND_DEVELOPMENT_COST_FIELDS } from '../../../../supabase/functions/_shared/maxxis/landDevelopmentScenario.ts';
import { resolveDealScenario, compareScenarioOutputs } from '../../../../supabase/functions/_shared/maxxis/scenarioEngine.ts';

// Reports rebuild evidence from the property-scoped cache. Do not persist duplicate
// provider records inside the assumptions payload (the API has a 16 KB limit).
export function landScenarioForPersistence(scenario) {
  if (scenario?.calculatedOutputs?.model !== 'LAND_DEVELOPMENT_V2') return scenario;
  const calculatedOutputs = { ...scenario.calculatedOutputs };
  for (const field of ['landAcquisitionReference', 'finishedHomeExitReference']) {
    if (!calculatedOutputs[field]) continue;
    const { valuationComps, exclusions, selectedComparables, supportingCandidates, ...summary } = calculatedOutputs[field];
    void valuationComps; void exclusions; void selectedComparables; void supportingCandidates;
    calculatedOutputs[field] = summary;
  }
  return { ...scenario, calculatedOutputs };
}

export function resolveLocalLandDevelopment({ property, propertyId = property?.id, messages = [], message, language = 'en' }) {
  if (!propertyId || !isVacantLandProperty(property) || /\b(relat[oó]rio|report|informe|pdf)\b/i.test(message)) return null;
  const scoped = messages.filter(item => String(item.data?.propertyId || item.data?.scenario?.propertyId || item.data?.sourceData?.propertyId || '') === String(propertyId));
  const latest = [...scoped].reverse().find(item => item.data?.scenario?.calculatedOutputs?.model === 'LAND_DEVELOPMENT_V2')?.data?.scenario;
  const parsed = parseLandDevelopmentAssumptions(message);
  const comparing = latest && /\b(compare|comparar|compara)\b/i.test(message);
  let pendingCost = null;
  if (latest && LAND_DEVELOPMENT_COST_FIELDS.includes(latest.calculatedOutputs.nextInput) && /^\s*(?:US\$|\$)?\s*\d[\d.,]*\s*(?:k|mil)?\s*$/i.test(message)) {
    const amount = message.replace(/[^\d.,]/g, '');
    pendingCost = { [latest.calculatedOutputs.nextInput]: Number(amount.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) * (/k|mil/i.test(message) ? 1000 : 1) };
  }
  if (!parsed.developmentIntent && !(latest && (Object.keys(parsed).length || pendingCost || comparing))) return null;
  const snapshot = [...scoped].reverse().map(item => item.data?.intelligenceSnapshot || item.data?.sourceData?.intelligenceSnapshot).find(Boolean) || {};
  const lot = parseCanonicalLotArea(property.lotSizeSqft ?? property.lot);
  const resolution = resolveDealScenario({ message, propertyId, canonicalStrategy: 'LAND',
    canonicalFacts: { ...property, purchasePrice: property.price, ...lot },
    storedAssumptions: { ...(latest?.assumptions || {}), ...(pendingCost || {}) },
    history: comparing ? scoped.filter(item => item.role === 'user') : [],
    developmentEvidence: snapshot.developmentEvidence });
  if (!resolution.scenario || resolution.scenario.calculatedOutputs.model !== 'LAND_DEVELOPMENT_V2') return null;
  const t = (pt, en, es) => language.startsWith('pt') ? pt : language.startsWith('es') ? es : en;
  const compareText = comparing ? t('Comparação descritiva: nenhuma alternativa é considerada melhor sem um objetivo definido.',
    'Descriptive comparison: no option is considered better without a defined objective.', 'Comparación descriptiva: ninguna opción es mejor sin un objetivo definido.') : '';
  const previous = comparing && latest ? latest.calculatedOutputs : null;
  const content = [previous ? formatLandDevelopmentAnswer(previous, language) : '', compareText,
    formatLandDevelopmentAnswer(resolution.scenario.calculatedOutputs, language),
    resolution.scenario.status === 'COMPLETE' ? `[[action:scenario-save|${t('Salvar premissas para o relatório', 'Save assumptions for report', 'Guardar supuestos para informe')}]]` : ''].filter(Boolean).join('\n\n');
  return { content, type: 'deal_scenario', data: { propertyId, scenario: resolution.scenario,
    intelligenceSnapshot: snapshot, comparison: previous ? compareScenarioOutputs(previous, resolution.scenario.calculatedOutputs) : resolution.comparison,
    providerCalls: 0, arithmeticSource: 'DETERMINISTIC_SCENARIO_ENGINE' } };
}
