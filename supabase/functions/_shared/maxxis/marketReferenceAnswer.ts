import { calculateLandDevelopmentScenario, constructionBenchmark2026, type LandDevelopmentEvidence } from './landDevelopmentScenario.ts';
import { propertyTypeFamily, resolveAnalysisPropertyType, toKnownFiniteNumber } from './canonicalFactSemantics.ts';
import { calculateLandUnitMetrics, resolveLotDimensions } from './landMetrics.ts';
import { calculateAreaMetrics } from './areaMetrics.ts';
import { formatAreaPriceMetric } from './areaAnalyticalAnswer.ts';
import type { AnalyticalPropertyInputs } from './analyticalPropertyFacts.ts';

type Values = Record<string, any>;
export function buildMarketReferenceAnswer(snapshot: Values, intent: string, language = 'en', analyticalInputs?: AnalyticalPropertyInputs) {
  const t = (pt: string, en: string, es: string) => language.startsWith('pt') ? pt : language.startsWith('es') ? es : en;
  const facts = snapshot.propertyFacts || snapshot.property || {};
  const propertyId = String(snapshot.propertyId || facts.id || '');
  const land = propertyTypeFamily(resolveAnalysisPropertyType(facts)) === 'LAND';
  const assumptions = { ...(snapshot.dealAssumptions?.activeScenario?.assumptions || {}), ...(snapshot.dealAssumptions || {}) };
  const evidence = snapshot.developmentEvidence;
  const usable = !evidence?.freshness?.landAcquisition?.state || ['FRESH', 'STALE_USABLE'].includes(evidence.freshness.landAcquisition.state);
  const landOutput = land ? calculateLandDevelopmentScenario({ ...facts, ...assumptions,
    purchasePrice: facts.price ?? facts.askingPrice, ...resolveLotDimensions(facts) }, usable ? evidence as LandDevelopmentEvidence : null, snapshot.generatedAt) : null;
  const market = snapshot.providerMarketContext || {};
  const reference = land ? landOutput?.landAcquisitionReference : snapshot.recentSalesMarketEstimate || market.recentSalesMarketEstimate;
  const money = (value: unknown) => {
    const known = toKnownFiniteNumber(value);
    return known === null ? t('Indisponível', 'Unavailable', 'No disponible') : new Intl.NumberFormat(language.startsWith('pt') ? 'pt-BR' : language.startsWith('es') ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(known);
  };
  const count = reference?.valuationCompCount ?? reference?.valuationComps?.length ?? 0;
  const available = reference?.status === 'AVAILABLE' && toKnownFiniteNumber(reference.centralEstimate) !== null;
  const lines = [intent === 'EXPLAIN_MARKET_ESTIMATE'
    ? t('Como a referência de mercado foi obtida:', 'How the market reference was obtained:', 'Cómo se obtuvo la referencia de mercado:')
    : t('Referência do terreno por vendas recentes:', 'Land recent-sales reference:', 'Referencia del terreno por ventas recientes:')];
  if (available) lines.push(t(`Faixa suportada: ${money(reference.range?.low)} – ${money(reference.range?.high)}; referência central ${money(reference.centralEstimate)}.`,
    `Supported range: ${money(reference.range?.low)} – ${money(reference.range?.high)}; central reference ${money(reference.centralEstimate)}.`,
    `Rango respaldado: ${money(reference.range?.low)} – ${money(reference.range?.high)}; referencia central ${money(reference.centralEstimate)}.`));
  else lines.push(land ? t('Não há vendas registradas de terrenos qualificadas suficientes para sustentar uma faixa.', 'There are not enough qualifying recorded land sales to support a range.', 'No hay suficientes ventas registradas de terrenos calificadas para respaldar un rango.')
    : t('Não há vendas qualificadas suficientes para sustentar uma faixa por vendas recentes.', 'There are not enough qualifying sales to support a recent-sales range.', 'No hay suficientes ventas calificadas para respaldar un rango por ventas recientes.'));
  const unit = reference?.unitMetric === 'PRICE_PER_ACRE' ? '$/acre' : reference?.unitMetric === 'PRICE_PER_SQFT' ? '$/sqft' : land ? '$/acre' : '$/sqft';
  const confidence = ({ LOW: t('baixa', 'low', 'baja'), MODERATE: t('moderada', 'moderate', 'moderada'), HIGH: t('alta', 'high', 'alta'),
    UNAVAILABLE: t('indisponível', 'unavailable', 'no disponible') } as Record<string, string>)[String(reference?.confidence || 'UNAVAILABLE')] || t('indisponível', 'unavailable', 'no disponible');
  lines.push(t(`Motor determinístico de vendas registradas; comparáveis utilizados: ${count}; métrica: ${unit}; confiança: ${confidence}.`,
    `Deterministic recorded-sales engine; comparables used: ${count}; metric: ${unit}; confidence: ${confidence}.`,
    `Motor determinista de ventas registradas; comparables utilizados: ${count}; métrica: ${unit}; confianza: ${confidence}.`));
  lines.push(t('O AVM do provedor é uma estimativa automatizada de apoio, não a origem desta faixa e não um ARV validado.',
    'Provider AVM is a supporting automated estimate, not the source of this range or a validated ARV.',
    'El AVM del proveedor es una estimación automatizada de apoyo, no el origen de este rango ni un ARV validado.'));
  const freshness = land ? snapshot.developmentEvidence?.freshness?.landAcquisition : snapshot.evidenceFreshness || market.evidenceFreshness;
  const freshnessLabel = ({ FRESH: t('atual', 'fresh', 'actual'), STALE_USABLE: t('cache antigo utilizável', 'stale usable cache', 'caché antiguo utilizable'),
    EXPIRED: t('expirado', 'expired', 'caducado') } as Record<string, string>)[String(freshness?.state)] || t('desconhecido', 'unknown', 'desconocido');
  lines.push(t(`Proveniência: vendas registradas; atualização: ${freshness?.retrievedAt || reference?.asOf || snapshot.generatedAt || 'indisponível'}; estado: ${freshnessLabel}.`,
    `Provenance: recorded sales; updated: ${freshness?.retrievedAt || reference?.asOf || snapshot.generatedAt || 'unavailable'}; state: ${freshnessLabel}.`,
    `Procedencia: ventas registradas; actualización: ${freshness?.retrievedAt || reference?.asOf || snapshot.generatedAt || 'no disponible'}; estado: ${freshnessLabel}.`));
  if (land) {
    const metrics = calculateLandUnitMetrics(facts.price ?? facts.askingPrice, facts);
    if (analyticalInputs) lines.push(formatAreaPriceMetric(calculateAreaMetrics(analyticalInputs).pricePerAcre,'pricePerAcre',language));
    else lines.push(t(`Preço pedido: ${money(facts.price ?? facts.askingPrice)}; área: ${metrics.lotSizeAcres ?? '—'} acres; pedido por acre: ${money(metrics.pricePerAcre)}.`,
      `Asking price: ${money(facts.price ?? facts.askingPrice)}; area: ${metrics.lotSizeAcres ?? '—'} acres; asking per acre: ${money(metrics.pricePerAcre)}.`,
      `Precio pedido: ${money(facts.price ?? facts.askingPrice)}; área: ${metrics.lotSizeAcres ?? '—'} acres; pedido por acre: ${money(metrics.pricePerAcre)}.`));
    const benchmark = constructionBenchmark2026(facts.state);
    lines.push(t(`Construção nova — benchmark interno ${benchmark.state || 'nacional'}: ${money(benchmark.rate.low)} – ${money(benchmark.rate.high)}/sqft. Total depende da área proposta.`,
      `New construction — internal ${benchmark.state || 'national'} benchmark: ${money(benchmark.rate.low)} – ${money(benchmark.rate.high)}/sqft. Total depends on proposed building area.`,
      `Construcción nueva — benchmark interno ${benchmark.state || 'nacional'}: ${money(benchmark.rate.low)} – ${money(benchmark.rate.high)}/sqft. El total depende del área propuesta.`));
    if (assumptions.zoning) lines.push(t(`Zoneamento ${assumptions.zoning}: premissa informada pelo usuário; viabilidade legal ainda não confirmada.`, `Zoning ${assumptions.zoning}: user-provided assumption; legal feasibility is not confirmed.`, `Zonificación ${assumptions.zoning}: supuesto aportado por el usuario; viabilidad legal no confirmada.`));
    if (assumptions.proposedUnitCount) lines.push(t(`Produto proposto: ${assumptions.proposedUnitCount} ${assumptions.proposedPropertyType || '—'}; imóvel atual: terreno.`, `Proposed product: ${assumptions.proposedUnitCount} ${assumptions.proposedPropertyType || '—'}; current subject: land.`, `Producto propuesto: ${assumptions.proposedUnitCount} ${assumptions.proposedPropertyType || '—'}; inmueble actual: terreno.`));
    lines.push(t('Esta referência não é laudo, appraisal ou ARV. Valor futuro da construção é uma referência de saída separada.', 'This reference is not an appraisal or ARV. Future finished-building value is a separate exit reference.', 'Esta referencia no es una tasación ni ARV. El valor futuro construido es una referencia de salida separada.'));
  }
  const actionType = land ? 'VIEW_LAND_SOLD_COMPS' : 'VIEW_VALUATION_COMPS';
  const stateVersion = String(snapshot.generatedAt || 'v1');
  const action = { id: `${actionType}:${propertyId}:${stateVersion}`, type: actionType, code: actionType,
    propertyId, stateVersion, label: t('Ver comparáveis', 'View comparables', 'Ver comparables'),
    displayBehavior: 'EXPAND_EVIDENCE', executionBehavior: 'EXPAND_EVIDENCE', payload: { reference: reference || null } };
  const analyticalLandMetrics=land&&analyticalInputs?calculateLandUnitMetrics(facts.price,{...facts,analyticalPropertyInputs:analyticalInputs}):null;
  return { answer: lines.join('\n\n'), type: 'market_reference' as const, data: { propertyId, intelligenceSnapshot: snapshot, reference: reference || null, landMetrics: analyticalLandMetrics || landOutput?.landMetrics || null, stateVersion, providerCalls: 0 }, actions: [action] };
}
