type Language = 'en' | 'pt' | 'es';
type LookupIntent = Readonly<{ fields: readonly string[]; strategyGuidance: boolean }>;

const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, any> : {};
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];
const present = (value: unknown) => value !== null && value !== undefined && value !== '';
const normalized = (value: unknown) => ` ${String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;

const FIELD_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = Object.freeze([
  ['assessorId', /\b(?:apn|assessor id|parcel (?:id|number)|numero da parcela)\b/],
  ['county', /\b(?:county|condado)\b/],
  ['annualPropertyTax', /\b(?:property tax|annual tax|imposto predial|imposto anual|impuesto predial)\b/],
  ['assessedValue', /\b(?:assessment|assessed value|valor avaliado|valor fiscal|tasacion)\b/],
  ['lastSale', /\b(?:last sale|latest sale|ultima venda|ultima venta)\b/],
  ['yearBuilt', /\b(?:year built|ano de construcao|ano construccion)\b/],
  ['lotSizeSqft', /\b(?:lot size|tamanho do lote|area do lote|tamano del lote)\b/],
  ['livingAreaSqft', /\b(?:living area|area util|square footage|sqft interno)\b/],
  ['zoning', /\b(?:zoning|zoneamento|zonificacion)\b/],
  ['subdivision', /\b(?:subdivision|loteamento)\b/],
  ['ownership', /\b(?:ownership|owner name|nome do proprietario|quem e o proprietario|titularidade|nombre del propietario)\b/],
  ['ownerOccupied', /\b(?:owner occup|owner ocupa|ocupad[oa] pelo proprietario|proprietario ocupa)\b/],
  ['hoaFee', /\b(?:hoa|condominio|asociacion)\b/],
  ['userNotes', /\b(?:notes|nota do card|notas do imovel|observacoes do card)\b/],
  ['providerEstimate', /\b(?:provider estimate|estimativa do provedor|avm do provedor|estimacion del proveedor)\b/],
  ['recentSalesMarketEstimate', /\b(?:recent sales market estimate|estimativa de mercado por vendas recentes|vendas recentes|ventas recientes)\b/],
]);

export function detectPropertyFactLookup(message: unknown): LookupIntent | null {
  const text = normalized(message);
  const fields = FIELD_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([field]) => field);
  const strategyGuidance = /\b(?:3|tres|three)\b/.test(text)
    && /\b(?:pontos|points|dados|data|aspectos|items|itens|importantes|important)\b/.test(text)
    && /\b(?:seller financing|financiamento do vendedor|terreno|land|sub to|wholesale|flip|buy hold|buy and hold)\b/.test(text);
  return fields.length || strategyGuidance ? Object.freeze({ fields: Object.freeze(fields), strategyGuidance }) : null;
}

function canonicalFact(snapshot: Record<string, any>, field: string) {
  const canonical = record(record(snapshot.propertyFacts).canonicalPropertyFacts);
  const locations: Record<string, [string, string]> = {
    assessorId: ['parcel', 'assessorId'], county: ['parcel', 'county'], annualPropertyTax: ['tax', 'annualPropertyTax'],
    assessedValue: ['tax', 'assessedValue'], yearBuilt: ['physical', 'yearBuilt'], lotSizeSqft: ['physical', 'lotSizeSqft'],
    livingAreaSqft: ['physical', 'livingAreaSqft'], zoning: ['parcel', 'zoning'], subdivision: ['parcel', 'subdivision'],
    ownerOccupied: ['ownership', 'ownerOccupied'], hoaFee: ['physical', 'hoaFee'], userNotes: ['notes', 'userNotes'],
    providerEstimate: ['valuationReferences', 'providerEstimate'], recentSalesMarketEstimate: ['valuationReferences', 'recentSalesMarketEstimate'],
  };
  if (field === 'lastSale') return { price: record(canonical.sales).lastSalePrice, date: record(canonical.sales).lastSaleDate };
  if (field === 'ownership') return { ownerName: record(canonical.ownership).ownerName,
    ownerType: record(canonical.ownership).ownerType, recordPresent: record(canonical.ownership).ownershipRecordPresent };
  const [group, name] = locations[field] || [];
  return group ? record(canonical[group])[name] : {};
}

const LABELS: Record<Language, Record<string, string>> = {
  en: { assessorId: 'APN / Assessor ID', county: 'County', annualPropertyTax: 'Annual property tax', assessedValue: 'Assessed value',
    lastSale: 'Latest recorded sale', yearBuilt: 'Year built', lotSizeSqft: 'Lot size', livingAreaSqft: 'Living area', zoning: 'Zoning',
    subdivision: 'Subdivision', ownership: 'Ownership', ownerOccupied: 'Owner occupied', hoaFee: 'HOA fee', userNotes: 'Notes',
    providerEstimate: 'Provider estimate', recentSalesMarketEstimate: 'Recent-Sales Market Estimate' },
  pt: { assessorId: 'APN / Assessor ID', county: 'Condado', annualPropertyTax: 'Imposto predial anual', assessedValue: 'Valor fiscal',
    lastSale: 'Última venda registrada', yearBuilt: 'Ano de construção', lotSizeSqft: 'Tamanho do lote', livingAreaSqft: 'Área útil', zoning: 'Zoneamento',
    subdivision: 'Loteamento', ownership: 'Titularidade', ownerOccupied: 'Ocupado pelo proprietário', hoaFee: 'Taxa de HOA', userNotes: 'Notes',
    providerEstimate: 'Estimativa do provedor', recentSalesMarketEstimate: 'Estimativa de Mercado por Vendas Recentes' },
  es: { assessorId: 'APN / Assessor ID', county: 'Condado', annualPropertyTax: 'Impuesto predial anual', assessedValue: 'Valor fiscal',
    lastSale: 'Última venta registrada', yearBuilt: 'Año de construcción', lotSizeSqft: 'Tamaño del lote', livingAreaSqft: 'Área habitable', zoning: 'Zonificación',
    subdivision: 'Subdivisión', ownership: 'Titularidad', ownerOccupied: 'Ocupada por el propietario', hoaFee: 'Cuota HOA', userNotes: 'Notas',
    providerEstimate: 'Estimación del proveedor', recentSalesMarketEstimate: 'Estimación de Mercado por Ventas Recientes' },
};

function locale(language: Language) { return language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-US' : 'en-US'; }
function money(value: unknown, language: Language) { return new Intl.NumberFormat(locale(language), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value)); }
function date(value: unknown, language: Language) { const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat(locale(language), { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsed); }
function unavailable(language: Language, field: string) {
  if (field === 'assessorId') return language === 'pt' ? 'Não disponível no registro externo atual.'
    : language === 'es' ? 'No disponible en el registro externo actual.'
      : 'Not available in the current external record.';
  return language === 'pt' ? `${LABELS.pt[field] || field}: não disponível no registro atual do imóvel.`
    : language === 'es' ? `${LABELS.es[field] || field}: no disponible en el registro actual de la propiedad.`
      : `${LABELS.en[field] || field}: not available from the current property record.`;
}

function formatFact(field: string, fact: any, language: Language) {
  if (field === 'lastSale') {
    const price = record(fact.price).value; const soldAt = record(fact.date).value;
    return present(price) || present(soldAt) ? `${LABELS[language].lastSale}: ${present(price) ? money(price, language) : '—'}${present(soldAt) ? ` · ${date(soldAt, language)}` : ''}.`
      : unavailable(language, field);
  }
  if (field === 'ownership') {
    const name = record(fact.ownerName).value; const type = record(fact.ownerType).value; const exists = record(fact.recordPresent).value;
    if (!present(name) && !present(type) && !present(exists)) return unavailable(language, field);
    return `${LABELS[language].ownership}: ${[name, type].filter(present).join(' · ') || (exists ? (language === 'pt' ? 'registro de titularidade disponível' : 'ownership record available') : '—')}.`;
  }
  const value = record(fact).value;
  if (!present(value)) return unavailable(language, field);
  let displayed = String(value);
  if (['annualPropertyTax', 'assessedValue', 'hoaFee'].includes(field)) displayed = money(value, language);
  if (['lotSizeSqft', 'livingAreaSqft'].includes(field)) displayed = `${Number(value).toLocaleString(locale(language))} sqft`;
  if (field === 'ownerOccupied') displayed = value === true ? (language === 'pt' ? 'Sim' : language === 'es' ? 'Sí' : 'Yes')
    : value === false ? (language === 'pt' ? 'Não' : language === 'es' ? 'No' : 'No') : displayed;
  if (field === 'providerEstimate') { const estimate = record(value); displayed = present(estimate.value) ? money(estimate.value, language) : String(value); }
  if (field === 'recentSalesMarketEstimate') { const estimate = record(value); displayed = present(estimate.centralEstimate) ? money(estimate.centralEstimate, language) : String(estimate.status || value); }
  const source = record(fact).status === 'VERIFIED_RECORD'
    ? (language === 'pt' ? ' Fonte: registro externo verificado.' : language === 'es' ? ' Fuente: registro externo verificado.' : ' Source: verified external record.') : '';
  return `${LABELS[language][field] || field}: ${displayed}.${source}`;
}

const GAP_LABELS: Record<Language, Record<string, string>> = {
  en: { down_payment: 'define the down payment', interest_rate: 'define interest and payment terms', term_months: 'define term, amortization and balloon',
    amortization_months: 'define amortization', balloon_months: 'define any balloon payment', allowed_use: 'verify the permitted use',
    land_sale_evidence: 'obtain recent comparable land sales', zoning: 'verify allowed use and zoning', road_access: 'verify legal/physical access', utilities: 'verify utility availability', survey: 'verify survey and parcel boundaries',
    ownership: 'verify ownership and title', topography: 'verify topography and development constraints', lot_size: 'confirm parcel area' },
  pt: { down_payment: 'definir a entrada', interest_rate: 'definir juros e forma de pagamento', term_months: 'definir prazo, amortização e balloon',
    amortization_months: 'definir a amortização', balloon_months: 'definir eventual pagamento balloon', allowed_use: 'verificar o uso permitido',
    land_sale_evidence: 'obter vendas recentes de terrenos comparáveis', zoning: 'verificar uso permitido e zoneamento', road_access: 'verificar acesso legal e físico', utilities: 'verificar disponibilidade de serviços públicos', survey: 'verificar levantamento e limites da parcela',
    ownership: 'verificar titularidade e título', topography: 'verificar topografia e restrições de desenvolvimento', lot_size: 'confirmar a área da parcela' },
  es: { down_payment: 'definir la entrada', interest_rate: 'definir interés y forma de pago', term_months: 'definir plazo, amortización y balloon',
    amortization_months: 'definir la amortización', balloon_months: 'definir eventual pago balloon', allowed_use: 'verificar el uso permitido',
    land_sale_evidence: 'obtener ventas recientes de terrenos comparables', zoning: 'verificar uso permitido y zonificación', road_access: 'verificar acceso legal y físico', utilities: 'verificar servicios públicos', survey: 'verificar levantamiento y límites de parcela',
    ownership: 'verificar titularidad y título', topography: 'verificar topografía y restricciones de desarrollo', lot_size: 'confirmar el área de la parcela' },
};

function guidance(snapshot: Record<string, any>, language: Language) {
  const decision = record(snapshot.dealDecisionContext); const strategy = String(decision.strategy || record(snapshot.propertyFacts).resolvedAnalysisStrategy || '');
  const gapGroup: Record<string, string> = {
    allowed_use: 'land_use', zoning: 'land_use', down_payment: 'down_payment', interest_rate: 'interest_payment',
    monthly_pi_payment: 'interest_payment', term_months: 'term_structure', amortization_months: 'term_structure',
    balloon_months: 'term_structure', road_access: 'access', utilities: 'utilities', land_sale_evidence: 'land_sales',
  };
  const seen = new Set<string>();
  const gaps = list(decision.decisionGaps).filter((gap) => {
    const field = String(gap?.field || ''); const group = gapGroup[field] || field;
    if (!group || seen.has(group)) return false;
    seen.add(group); return true;
  }).slice(0, 3);
  const title = language === 'pt' ? `Prioridades para ${strategy}:` : language === 'es' ? `Prioridades para ${strategy}:` : `Priorities for ${strategy}:`;
  const items = gaps.length ? gaps.map((gap, index) => `${index + 1}. ${GAP_LABELS[language][gap.field] || String(gap.field || '').replaceAll('_', ' ')}.`)
    : [language === 'pt' ? '1. Revisar e confirmar as premissas estruturadas antes da decisão.' : '1. Review and confirm the structured assumptions before deciding.'];
  return [title, ...items].join('\n');
}

export function buildPropertyFactLookupAnswer(message: unknown, languageInput: unknown, snapshotInput: unknown) {
  const intent = detectPropertyFactLookup(message); if (!intent) return null;
  const language: Language = ['pt', 'es'].includes(String(languageInput)) ? languageInput as Language : 'en';
  const snapshot = record(snapshotInput); const lines = intent.fields.map((field) => formatFact(field, canonicalFact(snapshot, field), language));
  if (intent.strategyGuidance) lines.push(guidance(snapshot, language));
  return Object.freeze({ intent, text: lines.join('\n\n') });
}
