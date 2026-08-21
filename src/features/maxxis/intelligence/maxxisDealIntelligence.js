const SNAPSHOT_INTENT_RE = /\b(snapshot|summary|summarize|overview|status|situation|what\s+do\s+we\s+know|how\s+is\s+this\s+deal|como\s+(esta|est[aá])|resumo|situacao|situa[cç][aã]o|estado\s+do\s+deal|panorama|resumen|situaci[oó]n)\b/i;
const GAP_INTENT_RE = /\b(missing|gap|gaps|what'?s\s+missing|faltando|falta|ausente|pendente|pendencias|pend[eê]ncias|incompleto|incompleta|que\s+falta|faltante)\b/i;
const WHY_INTENT_RE = /\b(why|explain|explanation|por\s+que|porque|explique|explica|por\s+qu[eé]|porqu[eé])\b/i;
const METRICS_INTENT_RE = /\b(metric|metrics|price\s*\/?\s*sqft|cap\s*rate|aquisi|aquisition|acquisition|m[eé]trica|metricas|m[eé]tricas)\b/i;
const PROVIDER_INTENT_RE = /\b(provider|providers|service|services|professional|professionals|prestador|prestadores|servi[cç]o|servi[cç]os|profissional|profissionais)\b/i;
const REVIEW_INTENT_RE = /\b(next|review|workflow|checklist|what\s+should\s+i\s+review|pr[oó]ximo|revisar|fluxo|proxima|pr[oó]xima)\b/i;
const COMPARE_INTENT_RE = /\b(compare|comparison|trade[-\s]?off|tradeoffs|comparar|comparacao|compara[cç][aã]o|comparaci[oó]n)\b/i;

const COPY = {
  en: {
    snapshotTitle: 'Deal snapshot',
    gapsTitle: 'What is missing',
    tradeoffsTitle: 'Contextual trade-offs',
    noStructuredDeal: 'I do not have structured deal data loaded for this response yet. Open or ask for a specific property first, then I can explain the registered facts.',
    basedOn: 'Based only on the registered DealSifter data:',
    property: 'Property',
    price: 'Price',
    metrics: 'Metrics',
    signals: 'Maxxis noticed',
    gaps: 'Gaps to review',
    services: 'Services',
    workflow: 'Workflow',
    nextReview: 'Next review',
    loadedProviders: 'Loaded providers',
    noProviders: 'No provider match was loaded in this response.',
    unavailable: 'Unavailable',
    notLoaded: 'Not loaded in this response',
    noGaps: 'I did not find explicit missing fields, attention points, provider gaps, conversation gaps, or workflow gaps in the loaded structured data.',
    whyPrefix: 'This signal is shown because',
    sourcePrefix: 'Source',
    followUps: {
      why_current_signal: 'Why?',
      deal_gaps: "What's missing?",
      compare_these: 'Compare these',
      show_providers: 'Show providers',
      explain_metrics: 'Explain metrics',
      review_next: 'What should I review next?',
      deal_snapshot: 'Deal snapshot',
    },
    gapCategories: {
      DATA: 'Data',
      DUE_DILIGENCE: 'Due diligence',
      PROVIDER: 'Provider',
      CONVERSATION: 'Conversation',
      WORKFLOW: 'Workflow',
    },
  },
  pt: {
    snapshotTitle: 'Snapshot do deal',
    gapsTitle: 'O que esta faltando',
    tradeoffsTitle: 'Trade-offs contextuais',
    noStructuredDeal: 'Ainda nao tenho dados estruturados do deal carregados nesta resposta. Abra ou peça uma propriedade especifica primeiro, e eu explico os fatos cadastrados.',
    basedOn: 'Com base apenas nos dados cadastrados no DealSifter:',
    property: 'Propriedade',
    price: 'Preco',
    metrics: 'Metricas',
    signals: 'Maxxis notou',
    gaps: 'Gaps para revisar',
    services: 'Servicos',
    workflow: 'Workflow',
    nextReview: 'Proxima revisao',
    loadedProviders: 'Providers carregados',
    noProviders: 'Nenhum match de provider foi carregado nesta resposta.',
    unavailable: 'Indisponivel',
    notLoaded: 'Nao carregado nesta resposta',
    noGaps: 'Nao encontrei campos ausentes, pontos de atencao, gaps de provider, conversa ou workflow nos dados estruturados carregados.',
    whyPrefix: 'Este sinal aparece porque',
    sourcePrefix: 'Fonte',
    followUps: {
      why_current_signal: 'Por que?',
      deal_gaps: 'O que falta?',
      compare_these: 'Comparar estes',
      show_providers: 'Mostrar providers',
      explain_metrics: 'Explicar metricas',
      review_next: 'O que revisar agora?',
      deal_snapshot: 'Snapshot do deal',
    },
    gapCategories: {
      DATA: 'Dados',
      DUE_DILIGENCE: 'Due diligence',
      PROVIDER: 'Provider',
      CONVERSATION: 'Conversa',
      WORKFLOW: 'Workflow',
    },
  },
  es: {
    snapshotTitle: 'Snapshot del deal',
    gapsTitle: 'Que falta',
    tradeoffsTitle: 'Trade-offs contextuales',
    noStructuredDeal: 'Aun no tengo datos estructurados del deal cargados en esta respuesta. Abre o pide una propiedad especifica primero, y explico los hechos registrados.',
    basedOn: 'Basado solo en los datos registrados en DealSifter:',
    property: 'Propiedad',
    price: 'Precio',
    metrics: 'Metricas',
    signals: 'Maxxis noto',
    gaps: 'Gaps para revisar',
    services: 'Servicios',
    workflow: 'Workflow',
    nextReview: 'Proxima revision',
    loadedProviders: 'Providers cargados',
    noProviders: 'Ningun match de provider fue cargado en esta respuesta.',
    unavailable: 'No disponible',
    notLoaded: 'No cargado en esta respuesta',
    noGaps: 'No encontre campos faltantes, puntos de atencion, gaps de provider, conversacion o workflow en los datos estructurados cargados.',
    whyPrefix: 'Esta senal aparece porque',
    sourcePrefix: 'Fuente',
    followUps: {
      why_current_signal: 'Por que?',
      deal_gaps: 'Que falta?',
      compare_these: 'Comparar estos',
      show_providers: 'Mostrar providers',
      explain_metrics: 'Explicar metricas',
      review_next: 'Que revisar ahora?',
      deal_snapshot: 'Snapshot del deal',
    },
    gapCategories: {
      DATA: 'Datos',
      DUE_DILIGENCE: 'Due diligence',
      PROVIDER: 'Provider',
      CONVERSATION: 'Conversacion',
      WORKFLOW: 'Workflow',
    },
  },
};

const TRACK_BY_INTENT = {
  deal_snapshot: 'deal_snapshot_requested',
  deal_gaps: 'deal_gaps_requested',
  explain_current_insight: 'insight_explained',
  compare_these: 'comparison_followup',
  explain_metrics: 'insight_explained',
};

function copyFor(language) {
  return COPY[language] || COPY.en;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function titleize(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function money(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function metricValue(metric, kind) {
  if (!metric?.calculable || typeof metric.value !== 'number' || !Number.isFinite(metric.value)) return '';
  if (kind === 'percent') return `${metric.value}%`;
  if (kind === 'currency') return money(metric.value);
  if (kind === 'unitCurrency') return `${money(metric.value)}/sqft`;
  return String(metric.value);
}

function normalizeMetrics(raw) {
  if (!raw) return null;
  if (raw.metrics) return raw;
  if (raw.pricePerSqft || raw.acquisitionPlusRehab || raw.capRate) {
    return { metrics: raw, missingInputs: asArray(raw.missingInputs) };
  }
  return null;
}

function normalizeAdvisor(raw) {
  if (!raw) return null;
  return {
    positiveSignals: asArray(raw.positiveSignals || raw.positive),
    attentionPoints: asArray(raw.attentionPoints || raw.attention),
    missingInformation: asArray(raw.missingInformation || raw.missing),
    limitations: asArray(raw.limitations),
  };
}

export function normalizeMaxxisDealIntelligenceSource(messageOrPayload = {}) {
  const type = String(messageOrPayload?.type || '');
  const data = messageOrPayload?.data || messageOrPayload || {};
  if (type === 'property_details' || data.property) {
    return {
      sourceType: type || 'property_details',
      property: data.property || null,
      missingFields: asArray(data.missingFields),
      metrics: normalizeMetrics(data.metrics),
      advisor: normalizeAdvisor(data.analysis || data.advisor),
      serviceNeeds: asArray(data.serviceNeeds),
      serviceMatches: Array.isArray(data.serviceMatches) ? data.serviceMatches : null,
      nextBestAction: data.nextBestAction || null,
      workflow: data.workflow || null,
      conversationSummary: data.conversationSummary || null,
      comparison: null,
      raw: data,
    };
  }
  if (type === 'deal_copilot_overview' || data.propertySummary) {
    return {
      sourceType: type || 'deal_copilot_overview',
      property: data.propertySummary || null,
      missingFields: asArray(data.missingFields),
      metrics: normalizeMetrics(data.metricsSummary),
      advisor: normalizeAdvisor(data.advisorSummary),
      serviceNeeds: asArray(data.serviceSummary?.needs),
      serviceMatches: data.serviceSummary?.providers ? [{ services: asArray(data.serviceSummary.providers) }] : null,
      nextBestAction: data.nextBestAction || null,
      workflow: data.workflow || null,
      conversationSummary: data.conversationSummary || null,
      comparison: null,
      raw: data,
    };
  }
  if (type === 'property_comparison' || Array.isArray(data.properties)) {
    return {
      sourceType: type || 'property_comparison',
      property: null,
      missingFields: [],
      metrics: null,
      advisor: null,
      serviceNeeds: [],
      serviceMatches: null,
      nextBestAction: null,
      workflow: null,
      conversationSummary: null,
      comparison: data,
      raw: data,
    };
  }
  return null;
}

function hasStructuredDeal(source) {
  return Boolean(source?.property || source?.comparison);
}

function propertyLine(property, t) {
  if (!property) return '';
  const location = [property.city, property.state, property.zip].filter(Boolean).join(', ');
  const type = property.type || property.propertyType || property.objective || '';
  return `${t.property}: ${[type, location].filter(Boolean).join(' - ') || t.unavailable}`;
}

function priceLine(property, t) {
  if (!property) return '';
  const price = money(property.price);
  const sqft = property.sqft ? `${property.sqft} sqft` : '';
  const beds = property.bedrooms ?? property.beds;
  const baths = property.bathrooms ?? property.baths;
  const rooms = [beds !== null && beds !== undefined ? `${beds} bd` : '', baths !== null && baths !== undefined ? `${baths} ba` : ''].filter(Boolean).join(' / ');
  return `${t.price}: ${[price || t.unavailable, sqft, rooms].filter(Boolean).join(' - ')}`;
}

function metricsLine(metrics, t) {
  const metricSet = metrics?.metrics;
  if (!metricSet) return '';
  const parts = [
    metricValue(metricSet.pricePerSqft, 'unitCurrency') ? `price/sqft ${metricValue(metricSet.pricePerSqft, 'unitCurrency')}` : '',
    metricValue(metricSet.acquisitionPlusRehab, 'currency') ? `acq+rehab ${metricValue(metricSet.acquisitionPlusRehab, 'currency')}` : '',
    metricValue(metricSet.capRate, 'percent') ? `cap rate ${metricValue(metricSet.capRate, 'percent')}` : '',
  ].filter(Boolean);
  return parts.length ? `${t.metrics}: ${parts.join('; ')}` : '';
}

function firstServiceLine(source, t) {
  const needs = asArray(source?.serviceNeeds).map((need) => need.serviceType || need.title || need.type).filter(Boolean);
  if (!needs.length) return '';
  return `${t.services}: ${needs.slice(0, 3).join(', ')}`;
}

function workflowLine(workflow, t) {
  const items = asArray(workflow?.items);
  if (!items.length) return '';
  const completed = workflow.completed ?? items.filter((item) => item.status === 'completed').length;
  const total = workflow.total ?? items.length;
  return `${t.workflow}: ${completed}/${total}`;
}

function nextBestActionLine(result, t) {
  const action = result?.nextBestAction || result;
  if (!action?.code) return '';
  return `${t.nextReview}: ${titleize(action.code)}${action.priority ? ` (${action.priority})` : ''}`;
}

export function buildMaxxisInsights(sourceInput = {}) {
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  const insights = [];
  const metricSet = source?.metrics?.metrics || null;
  const add = (insight) => insights.push({
    code: String(insight.code || '').slice(0, 80),
    type: String(insight.type || 'DATA'),
    priority: String(insight.priority || 'medium'),
    titleKey: String(insight.titleKey || insight.code || '').slice(0, 120),
    evidence: String(insight.evidence || '').slice(0, 260),
    source: String(insight.source || '').slice(0, 120),
    actionable: Boolean(insight.actionable),
  });
  if (metricValue(metricSet?.pricePerSqft, 'unitCurrency')) add({ code: 'metric_price_per_sqft', type: 'METRIC', priority: 'medium', titleKey: 'price_per_sqft', evidence: metricValue(metricSet.pricePerSqft, 'unitCurrency'), source: 'Deal Metrics' });
  if (metricValue(metricSet?.acquisitionPlusRehab, 'currency')) add({ code: 'metric_acquisition_plus_rehab', type: 'METRIC', priority: 'medium', titleKey: 'acquisition_plus_rehab', evidence: metricValue(metricSet.acquisitionPlusRehab, 'currency'), source: 'Deal Metrics' });
  if (metricValue(metricSet?.capRate, 'percent')) add({ code: 'metric_cap_rate_reported', type: 'METRIC', priority: 'low', titleKey: 'reported_cap_rate', evidence: `${metricValue(metricSet.capRate, 'percent')} (${metricSet.capRate.source || 'stored'})`, source: 'Deal Metrics' });
  asArray(source?.advisor?.attentionPoints).slice(0, 3).forEach((code) => add({ code: `advisor_attention_${code}`, type: 'DUE_DILIGENCE', priority: 'high', titleKey: code, evidence: titleize(code), source: 'Deal Advisor', actionable: true }));
  asArray(source?.serviceNeeds).slice(0, 3).forEach((need) => add({ code: `service_need_${need.serviceType || need.type || need.reasonCode || 'review'}`, type: 'PROVIDER', priority: need.priority || 'medium', titleKey: need.serviceType || need.type || 'service_need', evidence: [need.serviceType || need.type, need.reasonCode].filter(Boolean).join(' - '), source: 'Service Needs', actionable: true }));
  const pendingWorkflow = asArray(source?.workflow?.items).filter((item) => item.status !== 'completed');
  if (pendingWorkflow.length) add({ code: 'workflow_pending_items', type: 'WORKFLOW', priority: 'medium', titleKey: 'pending_workflow_items', evidence: pendingWorkflow.slice(0, 3).map((item) => item.label || titleize(item.code)).join(', '), source: 'Deal Workflow', actionable: true });
  const action = source?.nextBestAction?.nextBestAction || source?.nextBestAction;
  if (action?.code) add({ code: `next_best_action_${action.code}`, type: 'WORKFLOW', priority: action.priority || 'medium', titleKey: action.code, evidence: [titleize(action.code), action.reasonCode || action.reason].filter(Boolean).join(' - '), source: 'Next Best Action', actionable: Boolean(action.actionable) });
  return insights.slice(0, 8);
}

export function buildMaxxisDealGaps(sourceInput = {}) {
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  const gaps = [];
  const add = (gap) => {
    const code = String(gap.code || '').slice(0, 90);
    if (!code || gaps.some((item) => item.code === code)) return;
    gaps.push({
      code,
      category: String(gap.category || 'DATA'),
      priority: String(gap.priority || 'medium'),
      evidence: String(gap.evidence || '').slice(0, 260),
      source: String(gap.source || '').slice(0, 120),
      resolvableByExistingCapability: Boolean(gap.resolvableByExistingCapability),
    });
  };
  asArray(source?.missingFields).forEach((field) => add({ code: `missing_field_${field}`, category: 'DATA', priority: 'high', evidence: titleize(field), source: 'Property Details', resolvableByExistingCapability: false }));
  asArray(source?.advisor?.missingInformation).forEach((field) => add({ code: `advisor_missing_${field}`, category: 'DATA', priority: 'high', evidence: titleize(field), source: 'Deal Advisor', resolvableByExistingCapability: false }));
  asArray(source?.advisor?.attentionPoints).forEach((code) => add({ code: `advisor_attention_${code}`, category: 'DUE_DILIGENCE', priority: 'high', evidence: titleize(code), source: 'Deal Advisor', resolvableByExistingCapability: true }));
  if (asArray(source?.serviceNeeds).length && source?.serviceMatches === null) add({ code: 'provider_matches_not_loaded', category: 'PROVIDER', priority: 'medium', evidence: 'Service needs exist, provider matches were not loaded in this response.', source: 'Service Needs', resolvableByExistingCapability: true });
  asArray(source?.serviceMatches).forEach((match) => {
    const services = asArray(match?.services);
    if (!services.length) add({ code: `provider_missing_${match.serviceType || 'service'}`, category: 'PROVIDER', priority: 'medium', evidence: match.serviceType || 'Service need has no loaded provider match.', source: 'Service Matches', resolvableByExistingCapability: true });
    services.forEach((service) => {
      if (service?.contactAccess?.status === 'locked') add({ code: `provider_contact_locked_${service.id || service.serviceId || service.title || 'service'}`, category: 'PROVIDER', priority: 'low', evidence: `${service.title || service.serviceType || 'Provider'} contact is locked.`, source: 'Provider Contact Access', resolvableByExistingCapability: true });
    });
  });
  if (!source?.conversationSummary && source?.sourceType === 'deal_copilot_overview') add({ code: 'conversation_not_loaded', category: 'CONVERSATION', priority: 'low', evidence: 'No linked provider conversation summary was loaded.', source: 'Deal Copilot Overview', resolvableByExistingCapability: true });
  asArray(source?.workflow?.items).filter((item) => item.status !== 'completed').forEach((item) => add({ code: `workflow_pending_${item.code || item.label}`, category: 'WORKFLOW', priority: 'medium', evidence: item.label || titleize(item.code), source: 'Deal Workflow', resolvableByExistingCapability: true }));
  return gaps.slice(0, 10);
}

export function buildDealSnapshot(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  if (!hasStructuredDeal(source)) return { content: t.noStructuredDeal, insights: [], gaps: [] };
  const insights = buildMaxxisInsights(source);
  const gaps = buildMaxxisDealGaps(source);
  const signalTexts = insights.slice(0, 3).map((insight) => `${titleize(insight.titleKey)} (${insight.source})`);
  const gapTexts = gaps.slice(0, 3).map((gap) => `${t.gapCategories[gap.category] || gap.category}: ${gap.evidence}`);
  const lines = [
    `${t.snapshotTitle}`,
    t.basedOn,
    propertyLine(source.property, t),
    priceLine(source.property, t),
    metricsLine(source.metrics, t),
    firstServiceLine(source, t),
    workflowLine(source.workflow, t),
    nextBestActionLine(source.nextBestAction, t),
    signalTexts.length ? `${t.signals}: ${signalTexts.join('; ')}` : '',
    gapTexts.length ? `${t.gaps}: ${gapTexts.join('; ')}` : '',
  ].filter(Boolean);
  return { content: lines.join('\n'), insights, gaps };
}

export function buildDealGapsResponse(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  if (!hasStructuredDeal(source)) return { content: t.noStructuredDeal, gaps: [] };
  const gaps = buildMaxxisDealGaps(source);
  const lines = [`${t.gapsTitle}`, t.basedOn];
  if (!gaps.length) lines.push(t.noGaps);
  gaps.slice(0, 6).forEach((gap) => {
    const category = t.gapCategories[gap.category] || gap.category;
    lines.push(`- ${category}: ${gap.evidence} (${t.sourcePrefix}: ${gap.source})`);
  });
  return { content: lines.join('\n'), gaps };
}

export function buildInsightExplanation(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  const insight = buildMaxxisInsights(source)[0];
  if (!insight) {
    const gap = buildMaxxisDealGaps(source)[0];
    if (!gap) return { content: t.noStructuredDeal, insight: null };
    return {
      content: `${t.whyPrefix}: ${gap.evidence}\n${t.sourcePrefix}: ${gap.source}`,
      insight: gap,
    };
  }
  return {
    content: `${t.whyPrefix}: ${insight.evidence}\n${t.sourcePrefix}: ${insight.source}`,
    insight,
  };
}

export function buildMetricsExplanation(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  if (!hasStructuredDeal(source)) return { content: t.noStructuredDeal };
  const line = metricsLine(source.metrics, t);
  return {
    content: [t.metrics, t.basedOn, line || t.unavailable].join('\n'),
  };
}

export function buildProviderContextResponse(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  if (!hasStructuredDeal(source)) return { content: t.noStructuredDeal };
  const needs = asArray(source?.serviceNeeds).map((need) => [need.serviceType || need.type || need.title, need.priority, need.reasonCode].filter(Boolean).join(' - ')).filter(Boolean);
  const providers = asArray(source?.serviceMatches)
    .flatMap((match) => asArray(match?.services))
    .map((service) => [service.title || service.serviceType, service.fit?.classification, service.contactAccess?.status].filter(Boolean).join(' - '))
    .filter(Boolean);
  const lines = [t.services, t.basedOn];
  if (needs.length) lines.push(...needs.slice(0, 4).map((item) => `- ${item}`));
  lines.push(`${t.loadedProviders}: ${providers.length ? providers.slice(0, 4).join('; ') : t.noProviders}`);
  return { content: lines.join('\n') };
}

export function buildReviewNextResponse(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  if (!hasStructuredDeal(source)) return { content: t.noStructuredDeal };
  const lines = [t.nextReview, t.basedOn];
  const next = nextBestActionLine(source.nextBestAction, t);
  const workflow = workflowLine(source.workflow, t);
  const gaps = buildMaxxisDealGaps(source).slice(0, 3);
  if (next) lines.push(next);
  if (workflow) lines.push(workflow);
  if (gaps.length) lines.push(`${t.gaps}: ${gaps.map((gap) => gap.evidence).join('; ')}`);
  if (lines.length === 2) lines.push(t.unavailable);
  return { content: lines.join('\n') };
}

export function buildComparisonTradeoffs(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  const data = source?.comparison || source?.raw || {};
  const properties = asArray(data.properties).slice(0, 3);
  if (properties.length < 2 || !data.comparison) return { content: t.noStructuredDeal, tradeoffs: [] };
  const labels = new Map(properties.map((item, index) => [String(item.id || '').toLowerCase(), String.fromCharCode(65 + index)]));
  const tradeoffs = [
    ['Lowest price', data.comparison.price?.lowestPropertyIds],
    ['Lowest price/sqft', data.comparison.pricePerSqft?.lowestPropertyIds],
    ['Lowest acquisition + rehab', data.comparison.acquisitionPlusRehab?.lowestPropertyIds],
    ['Highest reported cap rate', data.comparison.capRate?.highestPropertyIds],
    ['Largest sqft', data.comparison.sqft?.highestPropertyIds],
  ].map(([label, ids]) => {
    const mapped = asArray(ids).map((id) => labels.get(String(id).toLowerCase())).filter(Boolean);
    return mapped.length ? `${label}: ${mapped.join(', ')}` : '';
  }).filter(Boolean);
  return {
    content: [`${t.tradeoffsTitle}`, t.basedOn, ...tradeoffs.map((item) => `- ${item}`)].join('\n'),
    tradeoffs,
  };
}

export function detectMaxxisDealIntent(message = '', forcedIntent = '') {
  const clean = String(message || '');
  if (forcedIntent) return forcedIntent;
  if (GAP_INTENT_RE.test(clean)) return 'deal_gaps';
  if (WHY_INTENT_RE.test(clean)) return 'explain_current_insight';
  if (COMPARE_INTENT_RE.test(clean)) return 'compare_these';
  if (METRICS_INTENT_RE.test(clean)) return 'explain_metrics';
  if (PROVIDER_INTENT_RE.test(clean)) return 'show_providers';
  if (REVIEW_INTENT_RE.test(clean)) return 'review_next';
  if (SNAPSHOT_INTENT_RE.test(clean)) return 'deal_snapshot';
  return '';
}

export function buildMaxxisFollowUps(sourceInput = {}, language = 'en') {
  const t = copyFor(language);
  const source = normalizeMaxxisDealIntelligenceSource(sourceInput) || sourceInput;
  if (!hasStructuredDeal(source)) return [];
  const items = [];
  const add = (code, intent, requiredContext) => {
    if (!t.followUps[code] || items.some((item) => item.code === code)) return;
    items.push({ code, label: t.followUps[code], intent, requiredContext });
  };
  const insights = buildMaxxisInsights(source);
  const gaps = buildMaxxisDealGaps(source);
  if (insights.length || gaps.length) add('why_current_signal', 'explain_current_insight', 'structured_deal_intelligence');
  if (gaps.length) add('deal_gaps', 'deal_gaps', 'property_details_or_copilot');
  if (source?.comparison) add('compare_these', 'compare_these', 'property_comparison');
  if (asArray(source?.serviceNeeds).length || asArray(source?.serviceMatches).length) add('show_providers', 'show_providers', 'service_needs_or_matches');
  if (source?.metrics?.metrics) add('explain_metrics', 'explain_metrics', 'deal_metrics');
  if (source?.nextBestAction || asArray(source?.workflow?.items).length) add('review_next', 'review_next', 'workflow_or_next_best_action');
  if (!items.some((item) => item.code === 'deal_snapshot')) add('deal_snapshot', 'deal_snapshot', 'property_details_or_copilot');
  return items.slice(0, 5);
}

export function findLatestMaxxisDealIntelligenceSource(messages = [], sourceMessageId = '') {
  const list = asArray(messages);
  if (sourceMessageId) {
    const found = list.find((message) => message.id === sourceMessageId);
    const normalized = normalizeMaxxisDealIntelligenceSource(found);
    if (normalized && hasStructuredDeal(normalized)) return { message: found, source: normalized };
  }
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];
    if (message?.role !== 'assistant') continue;
    const normalized = normalizeMaxxisDealIntelligenceSource(message);
    if (normalized && hasStructuredDeal(normalized)) return { message, source: normalized };
    const sourceData = message?.data?.sourceData ? normalizeMaxxisDealIntelligenceSource({ type: message.data.sourceType, data: message.data.sourceData }) : null;
    if (sourceData && hasStructuredDeal(sourceData)) return { message, source: sourceData };
  }
  return null;
}

export function buildLocalDealIntelligenceReply({ message = '', language = 'en', messages = [], sourceMessageId = '', forcedIntent = '' } = {}) {
  const intent = detectMaxxisDealIntent(message, forcedIntent);
  if (!intent) return null;
  const latest = findLatestMaxxisDealIntelligenceSource(messages, sourceMessageId);
  if (!latest) return null;
  const source = latest.source;
  let response = null;
  let type = 'deal_snapshot';
  if (intent === 'deal_gaps') {
    response = buildDealGapsResponse(source, language);
    type = 'deal_gaps';
  } else if (intent === 'explain_current_insight' || intent === 'explain_metrics') {
    response = intent === 'explain_metrics'
      ? buildMetricsExplanation(source, language)
      : buildInsightExplanation(source, language);
    type = 'maxxis_insight_explanation';
  } else if (intent === 'compare_these' && source.comparison) {
    response = buildComparisonTradeoffs(source, language);
    type = 'property_tradeoffs';
  } else if (intent === 'show_providers') {
    response = buildProviderContextResponse(source, language);
    type = 'maxxis_provider_context';
  } else if (intent === 'review_next') {
    response = buildReviewNextResponse(source, language);
    type = 'maxxis_review_next';
  } else {
    response = buildDealSnapshot(source, language);
  }
  return {
    type,
    content: response.content,
    data: {
      sourceType: source.sourceType,
      sourceData: source.raw,
      insights: buildMaxxisInsights(source),
      gaps: buildMaxxisDealGaps(source),
      intent,
    },
    followUps: buildMaxxisFollowUps(source, language),
    eventName: TRACK_BY_INTENT[intent] || null,
  };
}

export function enhanceMaxxisAssistantResponse({ message = '', result = {}, language = 'en', forcedIntent = '' } = {}) {
  const source = normalizeMaxxisDealIntelligenceSource({ type: result?.type, data: result?.data });
  const intent = detectMaxxisDealIntent(message, forcedIntent);
  const followUps = source ? buildMaxxisFollowUps(source, language) : [];
  if (!source || !hasStructuredDeal(source)) return { followUps: [], eventName: TRACK_BY_INTENT[intent] || null };
  if (intent === 'deal_gaps') {
    const response = buildDealGapsResponse(source, language);
    return {
      type: 'deal_gaps',
      content: response.content,
      data: { sourceType: result.type, sourceData: result.data, gaps: response.gaps, insights: buildMaxxisInsights(source), intent },
      followUps,
      eventName: TRACK_BY_INTENT[intent],
    };
  }
  if (intent === 'compare_these' && source.comparison) {
    const response = buildComparisonTradeoffs(source, language);
    return {
      type: 'property_tradeoffs',
      content: response.content,
      data: { sourceType: result.type, sourceData: result.data, tradeoffs: response.tradeoffs, intent },
      followUps,
      eventName: TRACK_BY_INTENT[intent],
    };
  }
  if (intent === 'deal_snapshot') {
    const response = buildDealSnapshot(source, language);
    return {
      type: 'deal_snapshot',
      content: response.content,
      data: { sourceType: result.type, sourceData: result.data, insights: response.insights, gaps: response.gaps, intent: intent || 'deal_snapshot' },
      followUps,
      eventName: TRACK_BY_INTENT[intent || 'deal_snapshot'],
    };
  }
  return { followUps: intent ? followUps : [], eventName: TRACK_BY_INTENT[intent] || null };
}

export function promptForMaxxisFollowUp(followUp = {}, language = 'en') {
  const t = copyFor(language);
  const code = String(followUp.code || '');
  return t.followUps[code] || String(followUp.label || code || '').trim();
}
