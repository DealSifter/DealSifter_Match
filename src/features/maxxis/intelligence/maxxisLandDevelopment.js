import { isVacantLandProperty } from '../../../../supabase/functions/_shared/maxxis/analysisApplicability.ts';
import { resolveLotDimensions } from '../../../../supabase/functions/_shared/maxxis/landMetrics.ts';
import { parseLandDevelopmentAssumptions, formatLandDevelopmentAnswer, LAND_DEVELOPMENT_COST_FIELDS } from '../../../../supabase/functions/_shared/maxxis/landDevelopmentScenario.ts';
import { resolveDealScenario, compareScenarioOutputs } from '../../../../supabase/functions/_shared/maxxis/scenarioEngine.ts';
import { buildDealDecisionContext } from '../../../../supabase/functions/_shared/maxxis/dealDecisionContext.ts';
import { buildAnalyticalPropertyInputs } from '../../../../supabase/functions/_shared/maxxis/analyticalPropertyContext.ts';

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

export function resolveLocalLandDevelopment({ property, propertyId = property?.id, messages = [], message, language = 'en', storedAssumptions = {}, reviewSnapshot, effectiveFacts = {} }) {
  // An explicitly unhydrated live review defers to the authorized backend read.
  if (reviewSnapshot === null) return null;
  if (!propertyId || !isVacantLandProperty(property) || /\b(relat[oó]rio|report|informe|pdf)\b/i.test(message)) return null;
  const scoped = messages.filter(item => String(item.data?.propertyId || item.data?.scenario?.propertyId || item.data?.sourceData?.propertyId || '') === String(propertyId));
  const latest = [...scoped].reverse().find(item => item.data?.scenario?.strategy === 'LAND')?.data?.scenario;
  const parsed = parseLandDevelopmentAssumptions(message);
  const comparing = latest && /\b(compare|comparar|compara)\b/i.test(message);
  let pendingCost = null;
  if (latest && LAND_DEVELOPMENT_COST_FIELDS.includes(latest.calculatedOutputs.nextInput) && /^\s*(?:US\$|\$)?\s*\d[\d.,]*\s*(?:k|mil)?\s*$/i.test(message)) {
    const amount = message.replace(/[^\d.,]/g, '');
    pendingCost = { [latest.calculatedOutputs.nextInput]: Number(amount.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) * (/k|mil/i.test(message) ? 1000 : 1) };
  }
  const developmentQuestion = /custo.*constr|construction cost|cost.*build|costo.*constru/i.test(message);
  if (!latest && !storedAssumptions.developmentIntent && !parsed.developmentIntent && !parsed.zoning && !parsed.proposedUnitCount && !parsed.proposedPropertyType) return null;
  if (!Object.keys(parsed).length && !pendingCost && !comparing && !(developmentQuestion && (latest || storedAssumptions.developmentIntent))) return null;
  const snapshot = [...scoped].reverse().map(item => item.data?.intelligenceSnapshot || item.data?.sourceData?.intelligenceSnapshot).find(Boolean) || {};
  const analyticalInputs = buildAnalyticalPropertyInputs({property,reviewSnapshot,effectiveFacts,
    projections:snapshot.propertyFacts?.canonicalPropertyFacts?.analyticalEvidence?.fields || snapshot.canonicalEvidenceProjection?.fields || {}});
  const lot = resolveLotDimensions({...property,analyticalPropertyInputs:analyticalInputs});
  const resolution = resolveDealScenario({ message, propertyId, canonicalStrategy: 'LAND',
    analyticalInputs,
    canonicalFacts: { ...property, purchasePrice: property.price, ...lot },
    storedAssumptions: { ...(latest?.assumptions || {}), ...storedAssumptions, ...(pendingCost || {}) },
    history: comparing ? scoped.filter(item => item.role === 'user') : [],
    developmentEvidence: snapshot.developmentEvidence });
  if (!resolution.scenario) return null;
  const t = (pt, en, es) => language.startsWith('pt') ? pt : language.startsWith('es') ? es : en;
  const compareText = comparing ? t('Comparação descritiva: nenhuma alternativa é considerada melhor sem um objetivo definido.',
    'Descriptive comparison: no option is considered better without a defined objective.', 'Comparación descriptiva: ninguna opción es mejor sin un objetivo definido.') : '';
  const previous = comparing && latest ? latest.calculatedOutputs : null;
  const content = [previous ? formatLandDevelopmentAnswer(previous, language) : '', compareText,
    resolution.scenario.calculatedOutputs.model === 'LAND_DEVELOPMENT_V2' ? formatLandDevelopmentAnswer(resolution.scenario.calculatedOutputs, language) : '',
    resolution.scenario.status === 'COMPLETE' ? `[[action:scenario-save|${t('Salvar premissas para o relatório', 'Save assumptions for report', 'Guardar supuestos para informe')}]]` : ''].filter(Boolean).join('\n\n');
  const zoning = resolution.scenario.assumptions.zoning;
  const canonicalZoning = property.canonicalPropertyFacts?.parcel?.zoning?.value || property.zoning;
  const zoningConflict = zoning && canonicalZoning && String(zoning).toUpperCase() !== String(canonicalZoning).toUpperCase()
    ? { code: 'USER_ZONING_ASSUMPTION_CONFLICT', canonicalValue: canonicalZoning, userValue: zoning, status: 'UNRESOLVED' } : null;
  const assumptionSnapshot = { ...snapshot, propertyId, propertyFacts: { ...snapshot.propertyFacts, ...property },
    dealAssumptions: { ...snapshot.dealAssumptions, ...storedAssumptions, ...resolution.scenario.assumptions } };
  assumptionSnapshot.dealDecisionContext = buildDealDecisionContext(assumptionSnapshot,analyticalInputs);
  const zoningText = zoning&&property.publisherDeclaredZoning===zoning?t(`Zoneamento ${zoning}: informado pelo publicador; parâmetros municipais ainda não verificados.`,`Zoning ${zoning}: declared by the publisher; municipal parameters not yet verified.`,`Zonificación ${zoning}: informada por el publicador; parámetros municipales aún no verificados.`):zoning ? t(`Zoneamento ${zoning}: premissa informada pelo usuário, não verificação legal.${zoningConflict ? ` Diverge do registro: ${canonicalZoning}.` : ''}`,
    `Zoning ${zoning}: user-provided assumption, not legal verification.${zoningConflict ? ` Conflicts with record: ${canonicalZoning}.` : ''}`,
    `Zonificación ${zoning}: supuesto aportado por el usuario, no verificación legal.${zoningConflict ? ` Difiere del registro: ${canonicalZoning}.` : ''}`) : '';
  return { content: [zoningText, content].filter(Boolean).join('\n\n'), type: 'deal_scenario', data: { propertyId, scenario: resolution.scenario,
    inputsToPersist: { ...parsed, ...(pendingCost || {}) }, zoningConflict,
    intelligenceSnapshot: assumptionSnapshot, comparison: previous ? compareScenarioOutputs(previous, resolution.scenario.calculatedOutputs) : resolution.comparison,
    providerCalls: 0, arithmeticSource: 'DETERMINISTIC_SCENARIO_ENGINE' } };
}
