import { estimateRehabBenchmark2026, NATIONAL_REHAB_BENCHMARK_2026 } from './rehabCostBenchmarks2026.ts';
import { calculateLandUnitMetrics, parseCanonicalLotArea } from './landMetrics.ts';
import { selectDevelopmentComparables } from '../property-data/soldCompEngine.ts';
import type { NormalizedValuationEvidence } from '../property-data/valuationTypes.ts';
import type { SoldPropertyRecord } from '../property-data/soldTypes.ts';

type Values = Record<string, unknown>;
export type LandDevelopmentEvidence = { valuation: NormalizedValuationEvidence; records: SoldPropertyRecord[]; freshness?: unknown };
const number = (value: unknown) => value === null || value === undefined || value === '' || typeof value === 'boolean'
  ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const round = (value: number) => Math.round(value * 100) / 100;
export const LAND_DEVELOPMENT_COST_FIELDS = Object.freeze(['closingCosts', 'siteWorkCost', 'utilityCost', 'permitCost',
  'surveyCost', 'titleCost', 'engineeringCost', 'architectureCost', 'softCosts', 'financingCost', 'holdingCost', 'sellingCost', 'contingency']);
export const DEVELOPMENT_INTENTS = Object.freeze(['NONE', 'SUBDIVIDE', 'NEW_CONSTRUCTION', 'SUBDIVIDE_AND_BUILD']);

export function constructionBenchmark2026(state: unknown) {
  const estimate = estimateRehabBenchmark2026({ state, condition: 'NEW_CONSTRUCTION', livingAreaSqft: 1 });
  return { year: 2026, rate: estimate?.rate || NATIONAL_REHAB_BENCHMARK_2026.NEW_CONSTRUCTION,
    state: estimate?.state || null, geography: estimate ? 'STATE' : 'NATIONAL', source: 'INTERNAL_REFERENCE_BENCHMARK',
    sourceCitationStatus: 'ORIGINAL_EXTERNAL_PROVENANCE_NOT_RETAINED', provenance: 'ESTIMATED', confidence: 'LOW', providerCalls: 0 };
}

export function calculateLandDevelopmentScenario(input: Values, evidence?: LandDevelopmentEvidence | null, asOf?: string) {
  const price = number(input.purchasePrice);
  const lot = number(input.lotSizeAcres) ? parseCanonicalLotArea(`${input.lotSizeAcres} acres`) : parseCanonicalLotArea(input.lotSizeSqft);
  const landMetrics = calculateLandUnitMetrics(price, lot);
  const units = number(input.proposedUnitCount);
  const area = number(input.proposedBuildingSqftPerUnit);
  if (units !== null && (units < 1 || !Number.isInteger(units))) throw new Error('SCENARIO_PROPOSED_UNIT_COUNT_INVALID');
  const totalBuildingSqft = units && area ? units * area : null;
  const benchmark = constructionBenchmark2026(input.state);
  const bid = number(input.contractorBid ?? input.constructionHardCost);
  const rate = number(input.constructionCostPerSqft);
  const contractor = bid && bid > 0 ? bid : null;
  const explicitRate = rate && rate > 0 ? rate : null;
  const hardCostSource = contractor !== null || explicitRate !== null ? 'USER_PROVIDED' : 'INTERNAL_REFERENCE_BENCHMARK';
  const hardCost = contractor !== null ? { low: contractor, central: contractor, high: contractor }
    : totalBuildingSqft === null ? null : { low: round(totalBuildingSqft * (explicitRate ?? benchmark.rate.low)),
      central: round(totalBuildingSqft * (explicitRate ?? benchmark.rate.average)), high: round(totalBuildingSqft * (explicitRate ?? benchmark.rate.high)) };
  const costCoverage = [{ field: 'landAcquisition', value: price, status: price === null ? 'UNKNOWN' : 'KNOWN' },
    { field: 'construction', value: hardCost?.central ?? null, status: !hardCost ? 'UNKNOWN' : hardCostSource === 'USER_PROVIDED' ? 'USER_ASSUMED' : 'BENCHMARK_ESTIMATED' },
    ...LAND_DEVELOPMENT_COST_FIELDS.map(field => {
      const value = number(input[field]); return { field, value, status: value === null ? 'UNKNOWN' : 'USER_ASSUMED' };
    })];
  const knownOtherCosts = round(costCoverage.slice(2).reduce((sum, row) => sum + (row.value ?? 0), 0));
  const developmentBasis = price !== null && hardCost ? { low: round(price + hardCost.low + knownOtherCosts),
    central: round(price + hardCost.central + knownOtherCosts), high: round(price + hardCost.high + knownOtherCosts) } : null;
  const references = evidence ? selectDevelopmentComparables(evidence.valuation, evidence.records, { ...input, lotSizeSqft: lot.lotSizeSqft }, asOf) : null;
  const freshness = evidence?.freshness as Record<string, { state?: string; retrievedAt?: string }> | undefined;
  if (references) for (const family of ['landAcquisition', 'finishedHomeExit'] as const) {
    if (freshness?.[family]?.state === 'STALE_USABLE') {
      references[family].confidence = 'LOW';
      references[family].confidenceReasons.push('STALE_CACHED_EVIDENCE');
    }
  }
  const exit = input.proposedPropertyType && totalBuildingSqft ? references?.finishedHomeExit : null;
  const exitPerUnit = exit?.status === 'AVAILABLE' && exit.range && exit.centralEstimate !== null
    ? { low: exit.range.low, central: exit.centralEstimate, high: exit.range.high } : null;
  const aggregateExit = exitPerUnit && units && input.unitsEquivalent !== false ? { low: round(exitPerUnit.low * units),
    central: round(exitPerUnit.central * units), high: round(exitPerUnit.high * units) } : null;
  const preliminaryGrossSpread = aggregateExit && developmentBasis ? { low: round(aggregateExit.low - developmentBasis.high),
    central: round(aggregateExit.central - developmentBasis.central), high: round(aggregateExit.high - developmentBasis.low) } : null;
  const unknownCostFields = costCoverage.filter(row => row.status === 'UNKNOWN').map(row => row.field);
  const completeCosts = unknownCostFields.length === 0;
  const estimatedProjectProfit = completeCosts ? preliminaryGrossSpread : null;
  const ROI = estimatedProjectProfit && developmentBasis && developmentBasis.central > 0 ? round(estimatedProjectProfit.central / developmentBasis.central * 100) : null;
  const nextInput = !units ? 'proposedUnitCount' : !area ? 'proposedBuildingSqftPerUnit' : !input.proposedPropertyType ? 'proposedPropertyType'
    : !exitPerUnit ? 'finishedHomeSoldEvidence' : !completeCosts ? unknownCostFields[0] : 'zoningSubdivisionVerification';
  return Object.freeze({ model: 'LAND_DEVELOPMENT_V2', developmentIntent: input.developmentIntent, landMetrics,
    proposedUnitCount: units, proposedBuildingSqftPerUnit: area, totalBuildingSqft, benchmark, hardCost, hardCostSource,
    constructionCostProvenance: hardCost ? 'CALCULATED' : 'UNKNOWN', knownOtherCosts, knownDevelopmentBasis: developmentBasis,
    landAcquisitionReference: references?.landAcquisition || null, finishedHomeExitReference: exit || null,
    projectedExitPerUnit: exitPerUnit, aggregateProjectedExit: aggregateExit, preliminaryGrossSpread,
    costCoverage, unknownCostFields, estimatedProjectProfit, ROI, nextInput, providerCalls: 0,
    evidenceFreshness: freshness || null,
    zoningSubdivisionGate: { status: input.zoningSubdivisionVerified === true ? 'USER_PROVIDED_NOT_LEGALLY_VERIFIED' : 'UNVERIFIED',
      required: ['zoning', 'allowedUse', 'minimumLotRequirements', 'roadAccess', 'utilities'], financialSimulationIsNotLegalApproval: true },
    confidence: { landComps: references?.landAcquisition.confidence || 'UNAVAILABLE', construction: hardCostSource === 'USER_PROVIDED' ? 'USER_ASSUMED' : 'LOW',
      exitComps: exit?.confidence || 'UNAVAILABLE', costCoverage: completeCosts ? 'ASSUMPTIONS_COMPLETE' : 'INCOMPLETE' },
    provenance: { proposedSize: 'USER_PROVIDED', landUnitMetrics: 'CALCULATED', constructionBenchmark: 'INTERNAL_REFERENCE_BENCHMARK', exit: 'CALCULATED_FROM_VERIFIED_RECORDED_SALES' },
    currentLivingAreaSqft: 'NOT_APPLICABLE', rehab: 'NOT_APPLICABLE', residentialCapRate: 'NOT_APPLICABLE', existingHouseArv: 'NOT_APPLICABLE' });
}

export function parseLandDevelopmentAssumptions(message: unknown): Values {
  const text = String(message || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const output: Values = {};
  const digit = '(\\d[\\d.,]*)';
  const numeric = (raw: string) => {
    const stripped = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw) ? raw.replace(/[.,]/g, '') : raw.replace(',', '.');
    return Number(stripped);
  };
  const words: Record<string, number> = { duas: 2, dois: 2, two: 2, dos: 2, tres: 3, three: 3, quatro: 4, four: 4, cuatro: 4 };
  const unit = text.match(/(\d+|duas|dois|two|dos|tres|three|quatro|four|cuatro)\s*(?:casas?|houses?|homes?|unidades?|units?|lotes?|lots?|lotes)/);
  if (unit) { const count = words[unit[1]] || Number(unit[1]);
    if (/lote|lot/.test(unit[0])) { output.proposedLotCount = count; if (/constru|build/.test(text)) output.proposedUnitCount = count; }
    else output.proposedUnitCount = count;
  }
  const houses = text.match(/(\d+|duas|dois|two|dos|tres|three|quatro|four|cuatro)\s*(?:casas?|houses?|homes?|unidades?|units?)/);
  if (houses) output.proposedUnitCount = words[houses[1]] || Number(houses[1]);
  const sizes = [...text.matchAll(new RegExp(`${digit}\\s*(?:sqft|sq ft|square feet|pes quadrados|pies cuadrados)`, 'g'))];
  const size = /compare|comparar|compara/.test(text) ? sizes.at(-1) : sizes[0];
  if (size) output.proposedBuildingSqftPerUnit = numeric(size[1]);
  if (/subdiv|desmembr/.test(text)) output.developmentIntent = /constru|build|new homes/.test(text) ? 'SUBDIVIDE_AND_BUILD' : 'SUBDIVIDE';
  else if (/constru|build|new homes/.test(text)) output.developmentIntent = 'NEW_CONSTRUCTION';
  if (/casas?|houses?|homes?|sfr|single family/.test(text) && /constru|build|subdiv|sqft|^sfr$|single family/.test(text)) output.proposedPropertyType = 'SFR';
  if (/townhouse/.test(text)) output.proposedPropertyType = 'Townhouse';
  if (/condo/.test(text)) output.proposedPropertyType = 'Condo';
  for (const [field, pattern] of Object.entries({ proposedBedsPerUnit: 'quartos?|bedrooms?|beds?|habitaciones?', proposedBathsPerUnit: 'banheiros?|bathrooms?|baths?|banos?' })) {
    const match = text.match(new RegExp(`${digit}\\s*(?:${pattern})`)); if (match) output[field] = numeric(match[1]);
  }
  const costFields: Record<string, string> = { constructionCostPerSqft: '(?:custo|cost|costo)(?: de construcao| per sqft| por sqft)?',
    contractorBid: '(?:orcamento da construtora|contractor bid|presupuesto del constructor)', siteWorkCost: '(?:site work|terraplenagem|preparacao do terreno)',
    utilityCost: '(?:utilities|infraestrutura|servicios)', permitCost: '(?:permits|licencas|permisos)', softCosts: '(?:soft costs|custos indiretos)',
    closingCosts: '(?:closing costs|custos de aquisicao|costos de adquisicion)', surveyCost: '(?:survey|levantamento do terreno|levantamiento del terreno)',
    titleCost: '(?:title costs|titularidade|titulo)', engineeringCost: '(?:engineering|engenharia|ingenieria)', architectureCost: '(?:architecture|arquitetura|arquitectura)',
    financingCost: '(?:financing cost|custo financeiro)', holdingCost: '(?:holding cost|custo de manutencao)', sellingCost: '(?:selling cost|custo de venda)', contingency: '(?:contingency|contingencia)' };
  for (const [field, pattern] of Object.entries(costFields)) {
    const match = text.match(new RegExp(`${pattern}\\s*(?:de|of|=|:)?\\s*(?:us\\$|\\$)?\\s*${digit}\\s*(k|mil)?`));
    if (match) output[field] = numeric(match[1]) * (match[2] ? 1000 : 1);
  }
  const rate = text.match(new RegExp(`(?:us\\$|\\$)\\s*${digit}\\s*(?:/|por|per)\\s*sqft`));
  if (rate) output.constructionCostPerSqft = numeric(rate[1]);
  return output;
}

export function formatLandDevelopmentAnswer(result: ReturnType<typeof calculateLandDevelopmentScenario>, languageInput: unknown, options: { includeCoverage?: boolean } = {}) {
  const lang = String(languageInput || 'en').startsWith('pt') ? 'pt' : String(languageInput).startsWith('es') ? 'es' : 'en';
  const t = (pt: string, en: string, es: string) => lang === 'pt' ? pt : lang === 'es' ? es : en;
  const money = (value: number) => new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  const band = (value: { low: number; central: number; high: number } | null) => value ? `${money(value.low)}–${money(value.high)} (${t('centro', 'central', 'centro')}: ${money(value.central)})` : t('Ainda sem evidência suficiente', 'Not enough evidence yet', 'Aún sin evidencia suficiente');
  const r = result.benchmark.rate;
  const lines = [t('Simulação de desenvolvimento do terreno', 'Land development simulation', 'Simulación de desarrollo del terreno'),
    `${t('Benchmark interno 2026 de construção nova', 'Internal 2026 new-construction benchmark', 'Referencia interna 2026 de construcción nueva')} (${result.benchmark.state || t('nacional', 'national', 'nacional')}): ${money(r.low)}–${money(r.high)}/sqft; ${t('média', 'average', 'promedio')} ${money(r.average)}/sqft.`,
    t('Referência estimada, não orçamento de construtora nem preço de mercado ao vivo.', 'Estimated reference, not a contractor bid or live market price.', 'Referencia estimada, no presupuesto de constructor ni precio de mercado en vivo.'),
    `${t('Preço do terreno por acre', 'Land asking price per acre', 'Precio del terreno por acre')}: ${result.landMetrics.pricePerAcre !== null ? money(result.landMetrics.pricePerAcre) : t('Área ou preço pendente', 'Area or price pending', 'Área o precio pendiente')}.`,
  ];
  if (result.hardCost) lines.push(`${result.proposedUnitCount ?? '?'} × ${result.proposedBuildingSqftPerUnit ?? '?'} sqft = ${result.totalBuildingSqft ?? '?'} sqft.`,
    `${t('Hard cost de construção', 'Construction hard cost', 'Costo directo de construcción')}: ${band(result.hardCost)}.`,
    `${t('Base conhecida de desenvolvimento', 'Known development basis', 'Base conocida de desarrollo')}: ${band(result.knownDevelopmentBasis)}.`);
  const land = result.landAcquisitionReference;
  if (land?.status === 'AVAILABLE') lines.push(`${t('Comparáveis vendidos de terrenos', 'Sold land comparables', 'Comparables vendidos de terrenos')}: ${land.valuationCompCount}; ${money(land.weightedUnitValue!)}/acre; ${money(land.weightedLotPricePerSqft!)}/sqft.`,
    `${t('Referência de aquisição do terreno', 'Land acquisition reference', 'Referencia de adquisición del terreno')}: ${band({ ...land.range!, central: land.centralEstimate! })}.`);
  else lines.push(t('Referência de aquisição: ainda não há duas vendas comparáveis qualificadas de terrenos.', 'Acquisition reference: fewer than two qualified comparable land sales.', 'Referencia de adquisición: faltan dos ventas comparables calificadas de terrenos.'));
  const exit = result.finishedHomeExitReference;
  if (result.projectedExitPerUnit) lines.push(`${t('Referência de saída por vendas recentes', 'Projected exit reference from recent sales', 'Referencia de salida por ventas recientes')}: ${band(result.projectedExitPerUnit)} / ${t('unidade', 'unit', 'unidad')}; ${exit?.valuationCompCount} ${t('vendas', 'sales', 'ventas')}, ${money(exit!.weightedUnitValue!)}/sqft.`,
    `${t('Saída agregada', 'Aggregate exit', 'Salida agregada')}: ${band(result.aggregateProjectedExit)}.`);
  else lines.push(t('Para estimar a saída com maior sustentação ainda preciso de vendas residenciais comparáveis.', 'Comparable residential closed sales are still needed for a supported exit reference.', 'Aún necesito ventas residenciales comparables para sustentar la referencia de salida.'));
  lines.push(t('Valor de saída do produto planejado não é ARV, avaliação formal ou custo de construção. Casas mais antigas, quando utilizadas, não recebem ajuste de condição não verificado.',
    'Proposed-product exit value is not ARV, an appraisal or construction cost. Older homes, when used, receive no unverified condition adjustment.',
    'El valor de salida no es ARV, tasación ni costo de construcción. Las casas antiguas no reciben ajustes de condición no verificados.'));
  if ([land, exit].some(reference => reference?.confidenceReasons.includes('CONTROLLED_365_DAY_EXPANSION'))) lines.push(t('Foi necessário ampliar a janela de vendas de 180 para 365 dias; confiança reduzida.', 'The sales window was expanded from 180 to 365 days; confidence is reduced.', 'La ventana de ventas se amplió de 180 a 365 días; confianza reducida.'));
  if ([land, exit].some(reference => reference?.confidenceReasons.includes('STALE_CACHED_EVIDENCE'))) lines.push(t('Evidência de cache desatualizada, mantida como referência com confiança reduzida. Nenhuma atualização foi presumida.', 'Stale cache evidence is retained as a lower-confidence reference. No refresh is assumed.', 'Evidencia de caché desactualizada, conservada con confianza reducida. No se supone actualización.'));
  if (result.preliminaryGrossSpread) lines.push(`${t('Margem bruta preliminar', 'Preliminary gross spread', 'Margen bruto preliminar')}: ${band(result.preliminaryGrossSpread)}.`);
  if (result.estimatedProjectProfit) lines.push(`${t('Lucro estimado sob premissas completas', 'Estimated profit under complete assumptions', 'Beneficio estimado bajo supuestos completos')}: ${band(result.estimatedProjectProfit)}; ROI ${result.ROI}%`);
  else lines.push(t('Não é lucro líquido: há custos ainda desconhecidos.', 'This is not net profit: costs remain unknown.', 'No es beneficio neto: aún hay costos desconocidos.'));
  lines.push(t('Esta simulação assume que a subdivisão e o uso pretendido sejam permitidos. Confirme zoneamento, área mínima dos lotes, acesso e infraestrutura de serviços.',
    'This simulation assumes subdivision and intended use are allowed. Verify zoning, minimum lot requirements, access and utilities.',
    'La simulación supone que subdivisión y uso están permitidos. Confirma zonificación, área mínima, acceso y servicios.'));
  const questions: Record<string, string> = { proposedUnitCount: t('Quantas unidades você pretende construir?', 'How many units do you plan to build?', '¿Cuántas unidades planeas construir?'),
    proposedBuildingSqftPerUnit: t('Você imagina cada casa com quantos sqft? Ex.: 1.500 ou 2.000 sqft.', 'How many sqft per house? For example, 1,500 or 2,000 sqft.', '¿Cuántos sqft por casa? Por ejemplo, 1.500 o 2.000 sqft.'),
    proposedPropertyType: t('Qual o tipo do produto final: casa SFR, townhouse ou condo?', 'What is the finished product: SFR, townhouse or condo?', '¿Qué producto final: SFR, townhouse o condo?'),
    finishedHomeSoldEvidence: t('Quer revisar as vendas comparáveis disponíveis para o produto planejado?', 'Review available closed sales for the proposed product?', '¿Revisamos ventas disponibles para el producto propuesto?') };
  const costNames: Record<string, string> = { closingCosts: t('custos de aquisição', 'acquisition costs', 'costos de adquisición'), siteWorkCost: t('preparação do terreno', 'site work', 'preparación del terreno'), utilityCost: t('infraestrutura de serviços', 'utilities', 'servicios'), permitCost: t('licenças', 'permits', 'permisos'),
    surveyCost: t('levantamento do terreno', 'survey', 'levantamiento del terreno'), titleCost: t('titularidade', 'title', 'título'), engineeringCost: t('engenharia', 'engineering', 'ingeniería'), architectureCost: t('arquitetura', 'architecture', 'arquitectura'),
    softCosts: t('custos indiretos', 'soft costs', 'costos indirectos'), financingCost: t('financiamento', 'financing', 'financiamiento'), holdingCost: t('manutenção durante o projeto', 'holding costs', 'mantenimiento del proyecto'), sellingCost: t('venda', 'selling costs', 'venta'), contingency: t('contingência', 'contingency', 'contingencia') };
  if (options.includeCoverage) lines.push(`${t('Cobertura de custos adicionais', 'Additional cost coverage', 'Cobertura de costos adicionales')}:\n` + result.costCoverage.slice(2).map(row =>
    `${costNames[row.field]}: ${row.value === null ? t('Desconhecido', 'Unknown', 'Desconocido') : `${money(row.value)} (${t('premissa do usuário', 'user assumption', 'supuesto del usuario')})`}`).join('\n'));
  lines.push(questions[result.nextInput] || t(`Qual a estimativa para ${costNames[result.nextInput] || result.nextInput}? Não vou considerar um custo desconhecido como zero.`,
    `What is your estimate for ${costNames[result.nextInput] || result.nextInput}? Unknown costs are not zero.`,
    `¿Cuál es tu estimación para ${costNames[result.nextInput] || result.nextInput}? Un costo desconocido no es cero.`));
  return lines.join('\n\n');
}
