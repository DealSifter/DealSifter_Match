import { calculateLandDevelopmentScenario } from '../../../../supabase/functions/_shared/maxxis/landDevelopmentScenario.ts';
import { calculateLandUnitMetrics } from '../../../../supabase/functions/_shared/maxxis/landMetrics.ts';
import { propertyTypeFamily, resolveAnalysisPropertyType } from '../../../../supabase/functions/_shared/maxxis/canonicalFactSemantics.ts';

// Projection only: all financial calculations and comp selection stay in the existing engine.
export function buildLandReportView(schema, language = 'en') {
  const property = schema.sections?.propertySummary?.data || {};
  if (propertyTypeFamily(resolveAnalysisPropertyType(property)) !== 'LAND') return null;
  const lang = String(language).split('-')[0];
  const t = (pt, en, es) => lang === 'pt' ? pt : lang === 'es' ? es : en;
  const assumptions = schema.presentation?.activeScenario?.assumptions || {};
  const metrics = calculateLandUnitMetrics(property.price, property);
  const previous = schema.presentation?.landDevelopment;
  const result = calculateLandDevelopmentScenario({ ...property, ...assumptions, ...metrics, purchasePrice: property.price });
  const land = previous?.landAcquisitionReference || null;
  const exit = result.proposedBuildingSqftPerUnit && assumptions.proposedPropertyType ? previous?.finishedHomeExitReference : null;
  const money = value => value == null ? t('Não informado', 'Not supplied', 'No informado') : new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
  const numeric = value => value == null ? t('Não informado', 'Not supplied', 'No informado') : new Intl.NumberFormat(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-US' : 'en-US', { maximumFractionDigits: 6 }).format(value);
  const distance = value => value == null ? '—' : Number(value).toFixed(2);
  const unknown = t('Desconhecido', 'Unknown', 'Desconocido');
  const user = t('Informado pelo usuário', 'User provided', 'Aportado por el usuario');
  const product = result.proposedUnitCount == null && !assumptions.proposedPropertyType ? t('Não informado', 'Not supplied', 'No informado')
    : `${result.proposedUnitCount ?? '—'} ${assumptions.proposedPropertyType || '—'}`;
  const zoning = `${assumptions.zoning || property.zoning || unknown}${assumptions.zoning ? ` — ${user}` : ''}`;
  const title = (pt, en, es, lines) => ({ title: t(pt, en, es), lines });
  const count = ref => ref?.valuationComps?.length ?? ref?.valuationCompCount ?? 0;
  const refLines = (ref, unit) => {
    const selected = ref?.valuationComps || [];
    if (!selected.length) return [];
    const distances = selected.map(comp => comp.distanceMiles).filter(value => value != null);
    const ages = selected.map(comp => comp.saleAgeDays).filter(value => value != null);
    const unitValues = selected.map(comp => comp.unitValue).filter(value => value != null && Number.isFinite(Number(value)));
    return [
      `${t('Referência ponderada', 'Weighted reference', 'Referencia ponderada')}: ${money(ref.weightedUnitValue)}/${unit}`,
      `${t('Faixa', 'Range', 'Rango')}: ${money(ref.range?.low)} — ${money(ref.range?.high)}`,
      ...(unitValues.length ? [`${t('Faixa', 'Range', 'Rango')}/${unit}: ${money(Math.min(...unitValues))} — ${money(Math.max(...unitValues))}`] : []),
      ...(unit === 'acre' ? [`${t('Por área do lote', 'Per parcel area', 'Por área del lote')}: ${money(ref.weightedLotPricePerSqft)}/sqft`] : []),
      ...(unit === 'acre' && unitValues.length ? [`${t('Faixa', 'Range', 'Rango')}/sqft: ${money(Math.min(...unitValues) / 43560)} — ${money(Math.max(...unitValues) / 43560)}`] : []),
      `${distances.length ? `${distance(Math.min(...distances))}–${distance(Math.max(...distances))} mi` : unknown} · ${ages.length ? `${Math.min(...ages)}–${Math.max(...ages)} ${t('dias', 'days', 'días')}` : t('Datas abaixo', 'Dates below', 'Fechas abajo')}`,
      ...selected.flatMap(comp => [comp.address || unknown,
        `${money(comp.salePrice)} · ${comp.saleDate ? new Date(comp.saleDate).toLocaleDateString(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-US' : 'en-US') : unknown} · ${distance(comp.distanceMiles)} mi`,
        `${numeric(unit === 'acre' ? comp.lotSizeSqft : comp.livingAreaSqft)} sqft · ${money(comp.unitValue)}/${unit}`]),
    ];
  };
  const acquisition = [
    `${count(land)} ${t('vendas qualificadas', 'qualified sales', 'ventas calificadas')}`,
    ...refLines(land, 'acre'),
    ...(count(land) === 0 ? [
      t('Não há vendas registradas de terrenos qualificadas suficientes no cache.', 'Insufficient qualifying recorded land sales in cache.', 'No hay suficientes ventas registradas de terrenos calificadas en caché.'),
      t('Seleção exige tipo terreno, recência, proximidade e similaridade de lote.', 'Selection requires land type, recency, proximity and parcel similarity.', 'Selección exige tipo terreno, antigüedad, proximidad y similitud de lote.'),
      `${t('Pedido atual', 'Current asking', 'Pedido actual')}: ${money(metrics.pricePerAcre)}/acre; ${money(metrics.pricePerLotSqft)}/sqft`,
      t('Evidência para liberar: 2+ vendas qualificadas de terrenos.', 'Unlock evidence: 2+ qualified land sales.', 'Evidencia necesaria: 2+ ventas calificadas de terrenos.'),
    ] : []),
  ];
  const exitLines = [
    `${t('Produto', 'Product', 'Producto')}: ${product}`,
    `${t('Área construída por unidade', 'Building area per unit', 'Área construida por unidad')}: ${numeric(result.proposedBuildingSqftPerUnit)}${result.proposedBuildingSqftPerUnit ? ' sqft' : ''}`,
    `${count(exit)} ${t('vendas qualificadas', 'qualified sales', 'ventas calificadas')}`,
    ...refLines(exit, 'sqft'),
    ...(count(exit) === 0 ? [result.proposedBuildingSqftPerUnit == null
      ? t('Seleção de saída pendente: falta área construída proposta por unidade.', 'Exit selection pending: proposed building area per unit is missing.', 'Selección de salida pendiente: falta superficie construida propuesta por unidad.')
      : t('Evidência pendente: 2+ vendas residenciais qualificadas compatíveis com o produto proposto.', 'Pending evidence: 2+ qualified residential sales compatible with the proposed product.', 'Evidencia pendiente: 2+ ventas residenciales calificadas compatibles con el producto propuesto.') ] : []),
    t('Referência de saída não é ARV nem orçamento de construção.', 'Exit reference is not ARV or a construction quote.', 'La referencia de salida no es ARV ni presupuesto de construcción.'),
  ];
  const freshness = previous?.evidenceFreshness || {};
  const freshLabel = state => ({ FRESH: t('Cache atual', 'Fresh cache', 'Caché actual'), STALE_USABLE: t('Cache antigo utilizável', 'Stale usable cache', 'Caché antiguo utilizable') })[state] || t('Indisponível no cache', 'Unavailable in cache', 'No disponible en caché');
  const coverageLabels = {
    landAcquisition: t('Aquisição', 'Acquisition', 'Adquisición'), construction: t('Construção', 'Construction', 'Construcción'),
    closingCosts: t('Custos de aquisição', 'Closing costs', 'Costos de adquisición'), siteWorkCost: t('Preparação do terreno', 'Site work', 'Preparación del terreno'), utilityCost: t('Infraestrutura', 'Utilities', 'Servicios'),
    permitCost: t('Licenças', 'Permits', 'Permisos'), surveyCost: t('Levantamento', 'Survey', 'Levantamiento'), titleCost: t('Titularidade', 'Title', 'Título'), engineeringCost: t('Engenharia', 'Engineering', 'Ingeniería'), architectureCost: t('Arquitetura', 'Architecture', 'Arquitectura'), softCosts: t('Outros custos indiretos', 'Other soft costs', 'Otros costos indirectos'),
    financingCost: t('Financiamento', 'Financing', 'Financiamiento'), holdingCost: t('Manutenção', 'Holding', 'Mantenimiento'), sellingCost: t('Venda', 'Selling', 'Venta'), contingency: t('Contingência', 'Contingency', 'Contingencia'),
  };
  const status = row => row.status === 'UNKNOWN' ? unknown : row.status === 'KNOWN' ? t('Conhecido', 'Known', 'Conocido') : row.status === 'BENCHMARK_ESTIMATED' ? t('Referência interna', 'Benchmark', 'Referencia interna') : user;
  const groups = [
    [t('TERRENO', 'LAND', 'TERRENO'), ['landAcquisition', 'closingCosts']],
    [t('CONSTRUÇÃO', 'BUILD', 'CONSTRUCCIÓN'), ['construction', 'siteWorkCost', 'utilityCost']],
    [t('CUSTOS INDIRETOS', 'SOFT COSTS', 'COSTOS INDIRECTOS'), ['permitCost', 'surveyCost', 'titleCost', 'engineeringCost', 'architectureCost', 'softCosts']],
    [t('FINANCIAMENTO / SAÍDA', 'FINANCE / EXIT', 'FINANCIAMIENTO / SALIDA'), ['financingCost', 'holdingCost', 'sellingCost', 'contingency']],
  ].map(([group, fields]) => ({ title: group, lines: fields.map(field => {
    const row = result.costCoverage.find(item => item.field === field);
    return `${coverageLabels[field]}: ${row.value == null ? status(row) : `${money(row.value)} — ${status(row)}`}`;
  }) }));
  const knownBasis = result.knownDevelopmentBasis?.central ?? (property.price == null ? null : property.price + result.knownOtherCosts);
  const areaPending = result.proposedBuildingSqftPerUnit == null;
  const constructionPlanned = assumptions.developmentIntent && assumptions.developmentIntent !== 'NONE';
  return {
    metrics, result, assumptions, knownBasis, countLand: count(land), countExit: count(exit),
    mapsEligible: [...(land?.valuationComps || []), ...(exit?.valuationComps || [])].filter(comp => comp.latitude != null && comp.longitude != null),
    subject: title('Terreno em análise', 'Land subject', 'Terreno analizado', [
      [property.address, property.city, property.state, property.zip].filter(Boolean).join(', '),
      `${t('Preço pedido', 'Asking price', 'Precio pedido')}: ${money(property.price)} · ${numeric(metrics.lotSizeAcres)} acres · ${numeric(metrics.lotSizeSqft)} sqft`,
      `${money(metrics.pricePerAcre)}/acre · ${money(metrics.pricePerLotSqft)}/sqft`,
    ]),
    acquisition: title('Aquisição — terrenos vendidos', 'Acquisition — sold land', 'Adquisición — terrenos vendidos', acquisition),
    exit: title('Saída — residenciais vendidos', 'Exit — residential sales', 'Salida — viviendas vendidas', exitLines),
    readiness: title('Prontidão das evidências / limitações', 'Evidence readiness / limitations', 'Evidencia disponible / limitaciones', [
      `${t('Vendas de terrenos', 'Land sales', 'Ventas de terrenos')}: ${count(land)} — ${count(land) < 2 ? t('Insuficientes', 'Insufficient', 'Insuficientes') : t('Selecionadas', 'Selected', 'Seleccionadas')}`,
      `${t('Vendas de saída', 'Exit sales', 'Ventas de salida')}: ${count(exit)} — ${areaPending ? t('Área proposta não informada', 'Proposed area not supplied', 'Área propuesta no informada') : t('Conforme evidência acima', 'Per evidence above', 'Según evidencia arriba')}`,
      `${t('Dimensão do terreno', 'Parcel dimension', 'Dimensión del terreno')}: ${metrics.conflict ? t('Resolvida com conflito de fontes preservado', 'Resolved; source conflict retained', 'Resuelta; conflicto de fuentes preservado') : metrics.resolvedSqft ? t('Conhecida', 'Known', 'Conocida') : unknown}`,
      `${t('Zoneamento', 'Zoning', 'Zonificación')}: ${zoning}`,
      `${t('Provedor / terrenos', 'Provider / land', 'Proveedor / terrenos')}: ${freshLabel(freshness.landAcquisition?.state)}`,
      `${t('Provedor / saída', 'Provider / exit', 'Proveedor / salida')}: ${freshLabel(freshness.finishedHomeExit?.state)}`,
      t('Conflito SFR externo preservado; análise LAND. AVM não fundamenta aquisição.', 'External SFR conflict retained; LAND analysis. AVM does not support acquisition.', 'Conflicto SFR externo preservado; análisis LAND. AVM no sustenta adquisición.'),
    ]),
    dimensionEvidence: title('Dimensão resolvida / rastreabilidade das fontes', 'Resolved dimension / source traceability', 'Dimensión resuelta / trazabilidad de fuentes', [
      `${t('Fonte selecionada', 'Selected source', 'Fuente seleccionada')}: ${metrics.source || unknown} — ${metrics.evidenceStatus === 'VERIFIED_RECORD' ? t('Registro verificado', 'Verified record', 'Registro verificado') : user}`,
      `${t('Parcela resolvida', 'Resolved parcel', 'Parcela resuelta')}: ${numeric(metrics.resolvedSqft)} sqft = ${numeric(metrics.resolvedAcres)} acres`,
      t('Conversão determinística: 1 acre = 43.560 sqft; unidade derivada identificada como calculada.', 'Deterministic conversion: 1 acre = 43,560 sqft; derived unit marked calculated.', 'Conversión determinista: 1 acre = 43.560 sqft; unidad derivada marcada calculada.'),
      ...(metrics.conflict ? [
        `${t('Evidência divergente preservada', 'Conflicting evidence retained', 'Evidencia en conflicto preservada')}: ${numeric(metrics.sourceAcres.value)} acres (${metrics.sourceAcres.source}); ${numeric(metrics.sourceSqft.value)} sqft (${metrics.sourceSqft.source}).`,
        t('Diferença acima da tolerância de 2%. A prioridade da fonte decide o par; nenhum dado cadastral foi sobrescrito.', 'Difference exceeds the 2% tolerance. Source precedence resolves the pair; no stored property data is overwritten.', 'Diferencia superior a la tolerancia del 2%. La prioridad de fuente resuelve el par; no se sobrescriben datos guardados.'),
      ] : [t('As fontes disponíveis não apresentam conflito material de conversão.', 'Available sources show no material conversion conflict.', 'Las fuentes disponibles no presentan conflicto material de conversión.')]),
    ]),
    kpis: [
      constructionPlanned ? title('Construção nova — média', 'New construction — average', 'Construcción nueva — promedio', [`${money(result.benchmark.rate.average)}/sqft`]) : title('Área do terreno', 'Parcel area', 'Área del terreno', [`${numeric(metrics.lotSizeAcres)} acres`]),
      constructionPlanned ? title('Faixa de referência', 'Reference range', 'Rango de referencia', [`${numeric(result.benchmark.rate.low)}–${numeric(result.benchmark.rate.high)} USD/sqft`]) : title('Pedido por acre', 'Asking per acre', 'Pedido por acre', [money(metrics.pricePerAcre)]),
      title('Preço do terreno', 'Land asking', 'Precio del terreno', [money(property.price)]),
      title('Produto proposto', 'Proposed product', 'Producto propuesto', [product]),
    ],
    benchmark: constructionPlanned ? title('Construção nova — referência interna 2026', 'New construction — internal 2026 benchmark', 'Construcción nueva — referencia interna 2026', [
      `${t('Estado', 'State', 'Estado')}: ${result.benchmark.state || t('Nacional', 'National', 'Nacional')}`,
      `${t('Baixo / médio / alto', 'Low / average / high', 'Bajo / promedio / alto')}:`,
      `${money(result.benchmark.rate.low)} / ${money(result.benchmark.rate.average)} / ${money(result.benchmark.rate.high)} ${t('por sqft', 'per sqft', 'por sqft')}`,
      t('Fonte: referência interna estimada — 2026. Não é orçamento de construtora.', 'Source: internal estimated benchmark — 2026. Not a contractor quote.', 'Fuente: referencia interna estimada — 2026. No es presupuesto de constructor.'),
    ]) : title('Aquisição do terreno', 'Land acquisition', 'Adquisición del terreno', [
      `${t('Preço pedido', 'Asking price', 'Precio pedido')}: ${money(property.price)}`,
      `${numeric(metrics.lotSizeSqft)} sqft · ${numeric(metrics.lotSizeAcres)} acres`,
      t('Não há intenção explícita de construção neste cenário. Reforma residencial e cap rate não são aplicáveis.', 'No explicit construction intent in this scenario. Residential rehab and cap rate are not applicable.', 'No hay intención explícita de construcción en este escenario. Reforma residencial y cap rate no son aplicables.'),
    ]),
    premises: title('Premissas de desenvolvimento', 'Development assumptions', 'Supuestos de desarrollo', [
      `${t('Imóvel atual', 'Current subject', 'Inmueble actual')}: ${t('Terreno', 'Land', 'Terreno')}`,
      `${t('Zoneamento', 'Zoning', 'Zonificación')}: ${zoning}`,
      `${t('Intenção', 'Intent', 'Intención')}: ${/SUBDIVIDE/.test(assumptions.developmentIntent || '') ? t('Subdivisão explícita', 'Explicit subdivision', 'Subdivisión explícita') : assumptions.developmentIntent === 'NEW_CONSTRUCTION' ? t('Nova construção', 'New construction', 'Construcción nueva') : t('Não informada', 'Not supplied', 'No informada')}`,
      `${t('Produto proposto', 'Proposed product', 'Producto propuesto')}: ${product}`,
      `${t('Área por unidade', 'Area per unit', 'Área por unidad')}: ${numeric(result.proposedBuildingSqftPerUnit)}${areaPending ? '' : ' sqft'}`,
    ]),
    costs: title('Cálculo de custo / base conhecida', 'Cost calculation / known basis', 'Cálculo de costo / base conocida', [
      `${t('Construção — baixo / central / alto', 'Construction — low / central / high', 'Construcción — bajo / central / alto')}: ${result.hardCost ? [result.hardCost.low, result.hardCost.central, result.hardCost.high].map(money).join(' / ') : t('Pendente: área construída proposta', 'Pending: proposed building area', 'Pendiente: superficie construida propuesta')}`,
      `${t('Base conhecida de desenvolvimento', 'Known development basis', 'Base conocida de desarrollo')}: ${money(knownBasis)}`,
      areaPending ? t('Exclui construção e custos desconhecidos.', 'Excludes construction and unknown costs.', 'Excluye construcción y costos desconocidos.') : t('Inclui construção estimada; exclui custos desconhecidos.', 'Includes estimated construction; excludes unknown costs.', 'Incluye construcción estimada; excluye costos desconocidos.'),
    ]),
    coverage: groups,
    feasibility: title('Viabilidade a confirmar', 'Feasibility to verify', 'Viabilidad a confirmar', [
      `${t('Zoneamento', 'Zoning', 'Zonificación')}: ${zoning} · ${t('Área mínima / acesso / infraestrutura', 'Minimum lot / access / utilities', 'Lote mínimo / acceso / servicios')}: ${unknown}`,
      t('Viabilidade legal e subdivisão não verificadas. Simulação financeira não constitui aprovação.', 'Legal and subdivision feasibility are unverified. Financial simulation is not approval.', 'Viabilidad legal y subdivisión no verificadas. La simulación financiera no es aprobación.'),
    ]),
    next: title('Próximo dado de maior impacto', 'Highest-impact next input', 'Próximo dato de mayor impacto', [areaPending ? t('Área construída proposta por unidade.', 'Proposed building area per unit.', 'Superficie construida propuesta por unidad.') : t('Custos desconhecidos e vendas compatíveis com o produto.', 'Unknown costs and product-compatible sales.', 'Costos desconocidos y ventas compatibles con el producto.')]),
    conclusion: t(`Terreno; produto ${product}; zoneamento ${assumptions.zoning || unknown}. Viabilidade e custos restantes não verificados.`, `Land; product ${product}; zoning ${assumptions.zoning || unknown}. Feasibility and remaining costs unverified.`, `Terreno; producto ${product}; zonificación ${assumptions.zoning || unknown}. Viabilidad y costos restantes no verificados.`),
    executive: [
      t(`Terreno: ${money(property.price)}; ${numeric(metrics.lotSizeAcres)} acres (${numeric(metrics.lotSizeSqft)} sqft).`, `Land: ${money(property.price)}; ${numeric(metrics.lotSizeAcres)} acres (${numeric(metrics.lotSizeSqft)} sqft).`, `Terreno: ${money(property.price)}; ${numeric(metrics.lotSizeAcres)} acres (${numeric(metrics.lotSizeSqft)} sqft).`),
      `${t('Produto', 'Product', 'Producto')}: ${product}; ${t('zoneamento', 'zoning', 'zonificación')}: ${zoning}.`,
      t(`Vendas qualificadas: ${count(land)} terrenos; ${count(exit)} residenciais.`, `Qualified sales: ${count(land)} land; ${count(exit)} residential.`, `Ventas calificadas: ${count(land)} terrenos; ${count(exit)} viviendas.`),
      t(`Base conhecida: ${money(knownBasis)}; custos desconhecidos excluídos.`, `Known basis: ${money(knownBasis)}; unknown costs excluded.`, `Base conocida: ${money(knownBasis)}; costos desconocidos excluidos.`),
    ],
  };
}
