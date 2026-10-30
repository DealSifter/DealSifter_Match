import type { ReportClaim, ReportLocale, ReportMapPoint, ReportRow, ReportSection, ReportValue, ReportViewModel } from './reportIntegrityTypes';
import { calculateLandUnitMetrics } from '../../../../supabase/functions/_shared/maxxis/landMetrics';
import { resolveAnalysisStrategy, propertyTypeFamily } from '../../../../supabase/functions/_shared/maxxis/canonicalFactSemantics';
import { marketRentReportCopy } from './marketRentReport';
import { getPreparedReportPhotos } from './reportPreparedAssets';
import { getCachedPresentationText } from '../../../services/chatTranslation';
import { projectSavedReportScenario } from './reportSavedScenarioProjection';
import { formatFinancialEvidenceSource } from '../../../../supabase/functions/_shared/maxxis/financialEvidenceLabels';
import type { FinancialResolvedInput } from '../../../../supabase/functions/_shared/maxxis/financialEvidence';
import { projectProviderListingReferences, rankReportComparables, projectSoldDelivery, soldDeliveryAnswer } from '../../../../supabase/functions/_shared/maxxis/reportMarketReferences';
import { marketRentStateAnswer } from '../../../../supabase/functions/_shared/maxxis/financialEvidenceAnswer';
import type { MarketRentResult } from '../../../../supabase/functions/_shared/property-data/marketRentService';
import { INVESTMENT_PRICE_RANGE_OPTIONS } from '../../../lib/investmentProfile';
import { ARV_ELIGIBILITY_POLICY, arvEvidenceTier } from '../../../../supabase/functions/_shared/property-data/arvEligibilityPolicy';
import { evidenceAbsenceReason, evidenceAbsenceCopy, type EvidenceAbsenceReason } from '../../../../supabase/functions/_shared/maxxis/evidenceAbsence';

type Input = Record<string, unknown>;
const obj = (v: unknown): Input => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Input : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const scalar = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const number = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && v.trim() !== '') && Number.isFinite(Number(v)) ? Number(v) : null;
const positive = (v: unknown): number | null => { const n = number(v); return n !== null && n > 0 ? n : null; };
const lex = (locale: ReportLocale) => (pt: string, en: string, es: string): string => locale === 'pt' ? pt : locale === 'es' ? es : en;
const localeFor = (value: unknown): ReportLocale => /^pt/i.test(scalar(value)) ? 'pt' : /^es/i.test(scalar(value)) ? 'es' : 'en';
const localeCode = (locale: ReportLocale): string => locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-US' : 'en-US';
const finitePoint = (latitude: unknown, longitude: unknown): boolean => number(latitude) !== null && number(longitude) !== null && Math.abs(Number(latitude)) <= 85.05112878 && Math.abs(Number(longitude)) <= 180;
export function formatReportDate(value: unknown, locale: ReportLocale): string {
  if (!scalar(value)) return '—';
  const date = new Date(scalar(value));
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(localeCode(locale), { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** This scanner is the final guard, not the projection/label architecture. */
export function validateRenderedReportText(text: string): { valid: boolean; errors: string[] } {
  const patterns = [/\[object Object\]/, /\b(?:undefined|NaN|Infinity)\b/, /\{\s*"(?:translation|translatedText|[a-zA-Z]+)"\s*:/,
    /\b(?:MISSING[ _][A-Z_ ]+|PROVIDER_ESTIMATE|MATERIAL_CONFLICT|OUTLIER_DETECTED|READY_MIXED|REVIEW_REQUIRED|ARV_UNAVAILABLE|NOT_APPLICABLE)\b/,
    /\b(?:annualPropertyTax|propertyTaxYear|assessorID|effectiveSource|evidenceHash|sourceType|sourceFamily|canonicalPropertyFacts|analyticalUsability)\b/,
    /\b[A-Z]{2,}_[A-Z][A-Z_]+\b/, /Informações preservadas|Preserved information|Información preservada/];
  const errors = patterns.flatMap((pattern, index) => pattern.test(text) ? [`PROHIBITED_OUTPUT_${index}`] : []);
  return { valid: !errors.length, errors };
}

/** Only intentionally supported narrative response envelopes are accepted. */
export function reportNarrativeString(value: unknown): string {
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^[{[]/.test(text)) {
      try { return reportNarrativeString(JSON.parse(text)); } catch { return ''; }
    }
    return validateRenderedReportText(text).valid ? text : '';
  }
  const record = obj(value);
  return Object.keys(record).length === 1 && typeof record.translation === 'string'
    && !/^[{[]/.test(record.translation.trim()) ? reportNarrativeString(record.translation) : '';
}

const FIELD_PATHS: Record<string, [string, string]> = {
  address: ['identity', 'address'], city: ['identity', 'city'], state: ['identity', 'state'], zip: ['identity', 'zip'],
  beds: ['physical', 'beds'], baths: ['physical', 'baths'], sqft: ['physical', 'livingAreaSqft'],
  lotSizeSqft: ['physical', 'lotSizeSqft'], lotSizeAcres: ['physical', 'lotSizeAcres'], yearBuilt: ['physical', 'yearBuilt'],
  price: ['financial', 'askingPrice'], rehab: ['financial', 'rehab'], capRate: ['financial', 'capRate'], noi: ['financial', 'noi'],
  annualPropertyTax: ['tax', 'annualPropertyTax'], propertyTaxYear: ['tax', 'propertyTaxYear'], assessedValue: ['tax', 'assessedValue'], assessmentYear: ['tax', 'assessmentYear'],
  assessorId: ['parcel', 'assessorId'], zoning: ['parcel', 'zoning'], county: ['parcel', 'county'], legalDescription: ['parcel', 'legalDescription'], subdivision: ['parcel', 'subdivision'],
  latestSalePrice: ['sales', 'lastSalePrice'], latestSaleDate: ['sales', 'lastSaleDate'], ownerOccupied: ['ownership', 'ownerOccupied'], ownershipRecordPresent: ['ownership', 'ownershipRecordPresent'],
};
const FIELD_NAMES: Record<string, [string, string, string]> = {
  price: ['Preço pedido', 'Asking price', 'Precio solicitado'], beds: ['Quartos', 'Bedrooms', 'Habitaciones'], baths: ['Banheiros', 'Bathrooms', 'Baños'],
  sqft: ['Área construída', 'Living area', 'Área construida'], lotSizeSqft: ['Área do terreno', 'Parcel area', 'Área del terreno'], lotSizeAcres: ['Área do terreno em acres', 'Parcel area in acres', 'Área del terreno en acres'],
  yearBuilt: ['Ano de construção', 'Year built', 'Año de construcción'], rehab: ['Reforma informada', 'Reported rehabilitation budget', 'Reforma declarada'], capRate: ['Cap Rate', 'Cap rate', 'Tasa de capitalización'],
  annualPropertyTax: ['Imposto predial anual', 'Annual property tax', 'Impuesto predial anual'], propertyTaxYear: ['Ano do imposto', 'Tax year', 'Año del impuesto'],
  assessedValue: ['Valor fiscal', 'Assessed value', 'Valor fiscal'], assessmentYear: ['Ano da avaliação fiscal', 'Assessment year', 'Año de valoración fiscal'],
  assessorId: ['APN / cadastro fiscal', 'APN / tax parcel ID', 'APN / identificador fiscal'], zoning: ['Zoneamento declarado ou registrado', 'Declared or recorded zoning', 'Zonificación declarada o registrada'],
  county: ['Condado', 'County', 'Condado'], subdivision: ['Loteamento', 'Subdivision', 'Urbanización'], legalDescription: ['Descrição legal', 'Legal description', 'Descripción legal'],
  noi: ['Receita operacional líquida', 'Net operating income', 'Ingreso operativo neto'],
  latestSalePrice: ['Última venda registrada', 'Latest recorded sale', 'Última venta registrada'], latestSaleDate: ['Data da venda registrada', 'Recorded sale date', 'Fecha de venta registrada'],
  ownerOccupied: ['Ocupado pelo proprietário', 'Owner occupied', 'Ocupado por el propietario'], ownershipRecordPresent: ['Registro de titularidade disponível', 'Ownership record available', 'Registro de titularidad disponible'],
  currentContractRent: ['Aluguel contratual atual', 'Current contract rent', 'Alquiler contractual actual'],
  investorRentAssumption: ['Premissa privada de aluguel', 'Private rent assumption', 'Supuesto privado de alquiler'],
  propertyTax: ['Imposto predial anual', 'Annual property tax', 'Impuesto predial anual'], hoa: ['Condomínio / associação', 'HOA / association fee', 'Asociación / comunidad'],
  insurance: ['Seguro', 'Insurance', 'Seguro'], maintenance: ['Manutenção', 'Maintenance', 'Mantenimiento'], vacancy: ['Vacância', 'Vacancy', 'Vacancia'],
  propertyManagement: ['Administração do imóvel', 'Property management', 'Administración del inmueble'], utilities: ['Serviços e utilidades', 'Utilities', 'Servicios'], otherOperatingExpenses: ['Outras despesas operacionais', 'Other operating expenses', 'Otros gastos operativos'],
};
export function reportFieldLabel(field: string, locale: ReportLocale): string | null {
  const aliases: Record<string, string> = { askingPrice: 'price', bedrooms: 'beds', bathrooms: 'baths', livingAreaSqft: 'sqft', lot: 'lotSizeSqft', propertyTax: 'annualPropertyTax', apn: 'assessorId' };
  const labels = FIELD_NAMES[aliases[field] || field];
  return labels ? lex(locale)(...labels) : null;
}
const money = (n: number, locale: ReportLocale, decimals = 0): string => new Intl.NumberFormat(localeCode(locale), { style: 'currency', currency: 'USD', maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n);
const numeric = (n: number, locale: ReportLocale, digits = 2): string => new Intl.NumberFormat(localeCode(locale), { maximumFractionDigits: digits }).format(n);
const EMPTY_STATES = new Set(['UNKNOWN', 'UNAVAILABLE', 'NOT_APPLICABLE', 'NOT_EVALUATED', 'EXPIRED_UNUSABLE', 'IDENTITY_MISMATCH']);

function provenanceLabel(fact: Input, locale: ReportLocale): string {
  const t = lex(locale);
  const token = [scalar(fact.source), scalar(fact.sourceType), scalar(fact.sourceFamily), scalar(fact.sourceAuthority), scalar(fact.status), scalar(fact.evidenceClass)].join(' ');
  if (/RENTCAST/i.test(token)) return `${t('Registro do provedor', 'Provider record', 'Registro del proveedor')} · RentCast · ${t('fonte única, sem confirmação independente', 'single source, without independent confirmation', 'fuente única, sin confirmación independiente')}`;
  if (/ESTIMAT/i.test(token)) return t('Estimativa, não verificação', 'Estimate, not verification', 'Estimación, no verificación');
  if (/CALCULAT/i.test(token)) return t('Cálculo determinístico', 'Deterministic calculation', 'Cálculo determinista');
  if (/GIS|ASSESSOR|PUBLIC|VERIFIED_RECORD/i.test(token)) return `${t('Registro público', 'Public record', 'Registro público')} · ${t('fonte única, sem confirmação independente', 'single source, without independent confirmation', 'fuente única, sin confirmación independiente')}`;
  return t('Informado pelo publicador; não verificado de forma independente', 'Publisher provided; not independently verified', 'Aportado por el publicador; sin verificación independiente');
}
function explicitZeroProof(fact: Input): boolean {
  const decision = obj(fact.decision), proof = obj(fact.provenance);
  return fact.explicitZero === true || fact.explicitlyProvided === true || fact.userConfirmed === true || proof.explicitZero === true
    || /PUBLISHER_DECLARATION|EXPLICIT_USER_INPUT/.test(scalar(fact.source))
    || !!(decision.action && decision.action !== 'REVIEW_LATER' && decision.evidenceHash && decision.evidenceHash === fact.evidenceHash);
}

export function buildStrictReportViewModel({ schema, language = 'en' }: { schema: unknown; language?: string }): ReportViewModel {
  const input = obj(schema), sections = obj(input.sections), section = (key: string): Input => obj(sections[key]).available === true ? obj(obj(sections[key]).data) : {};
  const property = section('propertySummary'), valuation = section('valuationEvidence'), presentation = obj(input.presentation);
  const canonical = obj(property.canonicalPropertyFacts), evidence = section('propertyEvidence');
  const locale = localeFor(input.resolvedUserLocale || language), t = lex(locale);
  const reportType = input.reportType === 'PROPERTY_RELEASE' ? 'PROPERTY_RELEASE' : input.reportType === 'MAXXIS_ANALYSIS' ? 'MAXXIS_ANALYSIS' : 'DEAL_INTELLIGENCE';
  const level = reportType === 'PROPERTY_RELEASE' ? 1 : reportType === 'MAXXIS_ANALYSIS' ? 2 : 3;
  const diagnostics: string[] = [], values: Record<string, ReportValue> = {}, packet: ReportViewModel['evidencePacket'] = [];
  const unavailable = t('Não disponível', 'Unavailable', 'No disponible');
  const upstreamReasons = obj(presentation.evidenceReasons);
  const indicatorReasons: Record<string, EvidenceAbsenceReason | null> = {};
  for (const family of ['propertyRecord', 'valuation', 'recordedSales']) {
    indicatorReasons[family] = Object.hasOwn(upstreamReasons, family) && upstreamReasons[family] === null
      ? null : evidenceAbsenceReason(upstreamReasons[family], 'PROVIDER_ERROR');
  }
  const factFor = (key: string): Input => {
    const path = FIELD_PATHS[key];
    const canonicalFact = path ? obj(obj(canonical[path[0]])[path[1]]) : {};
    if (Object.keys(canonicalFact).length) return canonicalFact;
    const lookup = [...list(evidence.verifiedRecords), ...list(evidence.userProvided)].map(obj)
      .find(item => item.field === key || key === 'beds' && item.field === 'bedrooms' || key === 'baths' && item.field === 'bathrooms' || key === 'sqft' && item.field === 'livingAreaSqft');
    const raw = property[key] ?? (key === 'lotSizeSqft' ? property.lot : undefined);
    const provenance = obj(property.fieldProvenance)[key];
    const derivedDimension = key === 'lotSizeAcres' && property.acresStatus === 'CALCULATED'
      || key === 'lotSizeSqft' && property.sqftStatus === 'CALCULATED';
    return { ...obj(provenance), ...(lookup || {}), value: lookup?.value ?? raw,
      source: derivedDimension && !lookup ? 'CALCULATED_UNIT_CONVERSION' : lookup?.source || (typeof provenance === 'string' ? provenance : obj(provenance).source) || 'PROPERTY_APP_VALUE' };
  };
  const conflictNames = [...list(canonical.conflicts), ...list(evidence.conflicts)].map(obj)
    .filter(item => !['RESOLVED', 'ACCEPTED'].includes(scalar(item.resolution))).map(item => scalar(item.field));
  // Living-area disagreement is not a parcel-area disagreement.
  const areaConflict = conflictNames.some(field => /^(?:lot|lotArea|lotSizeSqft|lotSizeAcres|landArea)$/i.test(field)) || obj(property.resolvedLotDimensions).conflict === true;
  const typeToken = scalar(property.resolvedAnalysisPropertyType || property.type);
  const land = propertyTypeFamily(typeToken) === 'LAND';
  const strategy = land ? 'LAND' : resolveAnalysisStrategy(typeToken, property.objective || property.resolvedAnalysisStrategy);
  const rental = strategy === 'BUY_AND_HOLD';
  const typeLabel = land ? t('Terreno', 'Land', 'Terreno') : /^(SFR|SINGLE.FAMILY)/i.test(typeToken) ? t('Casa unifamiliar', 'Single-family home', 'Vivienda unifamiliar') : /^[A-Za-z -]{1,35}$/.test(typeToken) ? typeToken : t('Tipo a confirmar', 'Type to confirm', 'Tipo por confirmar');
  const strategyLabels: Record<string, [string, string, string]> = { LAND: ['Terreno', 'Land', 'Terreno'], GENERIC_SELL: ['Venda', 'Sell', 'Venta'], FLIP: ['Reformar e vender', 'Fix and flip', 'Reformar y vender'], BUY_AND_HOLD: ['Comprar e alugar', 'Buy and hold', 'Comprar y alquilar'], WHOLESALE: ['Cessão de contrato', 'Wholesale', 'Cesión de contrato'], SUB_TO: ['Aquisição sujeita ao financiamento', 'Subject-to acquisition', 'Compra sujeta a financiación'], SELLER_FINANCING: ['Financiamento pelo vendedor', 'Seller financing', 'Financiación del vendedor'] };
  const strategyLabel = t(...(strategyLabels[strategy] || strategyLabels.GENERIC_SELL));
  const register = (id: string, text: string, numbers: number[] = [], sourceRefs: string[] = []): string => {
    if (!packet.some(item => item.id === id)) packet.push({ id, text, numericValues: numbers,
      sourceRefs: sourceRefs.length ? sourceRefs : [`property:${scalar(property.id)}:${id}`] });
    return id;
  };
  const factValue = (key: string, kind: 'money' | 'number' | 'text' | 'percent' | 'sqft' | 'acres' = 'number', positiveOnly = false): ReportValue => {
    const fact = factFor(key), raw = fact.value, n = number(raw), semantic = scalar(fact.semanticState || fact.status);
    const ref = `fact:${key}`, source = provenanceLabel(fact, locale);
    const conflict = semantic === 'CONFLICT' || semantic === 'CONFLICTED' || !!fact.conflict || conflictNames.includes(key)
      || areaConflict && ['lotSizeSqft', 'lotSizeAcres'].includes(key);
    let state: ReportValue['state'] = conflict ? 'CONFLICTED' : EMPTY_STATES.has(semantic) || raw == null || raw === '' ? 'UNAVAILABLE' : 'VALUE';
    if (semantic === 'NOT_APPLICABLE') state = 'NOT_APPLICABLE';
    let text = unavailable;
    if (state === 'VALUE' && kind === 'text') { text = typeof raw === 'boolean' ? raw ? t('Sim', 'Yes', 'Sí') : t('Não', 'No', 'No') : reportNarrativeString(raw); if (!text) state = 'UNAVAILABLE'; }
    if (state === 'VALUE' && kind !== 'text') {
      if (n === null || positiveOnly && n <= 0 || n < 0 && key !== 'noi') state = 'UNAVAILABLE';
      else if (n === 0 && !explicitZeroProof(fact)) { state = 'UNAVAILABLE'; diagnostics.push(`UNTRUSTED_LEGACY_ZERO:${key}`); }
      else { if (n === 0) state = 'EXPLICIT_ZERO';
        text = kind === 'money' ? money(n, locale) : kind === 'percent' ? `${numeric(n, locale)}%` : /Year|yearBuilt/.test(key) ? String(n) : `${numeric(n, locale, kind === 'acres' ? 4 : 2)}${kind === 'sqft' ? ' sqft' : kind === 'acres' ? ' ac' : ''}`; }
    }
    if (state === 'CONFLICTED') {
      const candidate = kind === 'text' ? reportNarrativeString(raw) : n === null ? '' : kind === 'money' ? money(n, locale) : `${numeric(n, locale, kind === 'acres' ? 4 : 2)}${kind === 'sqft' ? ' sqft' : kind === 'acres' ? ' ac' : ''}`;
      text = candidate || t('A confirmar', 'To confirm', 'Por confirmar');
    }
    if (state === 'UNAVAILABLE' || state === 'NOT_APPLICABLE') text = unavailable;
    const absent = ['UNAVAILABLE', 'NOT_APPLICABLE', 'CONFLICTED'].includes(state);
    const reason = state === 'NOT_APPLICABLE' ? 'NOT_REQUESTED' : state === 'CONFLICTED' || ['price', 'rehab', 'noi'].includes(key)
      ? 'USER_INPUT_REQUIRED' : evidenceAbsenceReason(fact.absenceReason || fact.reason, indicatorReasons.propertyRecord || 'NO_COVERAGE');
    const value = { state, text, numericValue: ['VALUE', 'EXPLICIT_ZERO'].includes(state) && kind !== 'text' ? n : null,
      source: absent ? evidenceAbsenceCopy(reason, locale) : source, ...(absent ? { absenceReason: reason } : {}), evidenceRefs: [ref] } satisfies ReportValue;
    values[key] = value;
    register(ref, `${reportFieldLabel(key, locale) || key}: ${text} · ${value.source}`, value.numericValue === null ? [] : [value.numericValue],
      [scalar(fact.evidenceId || fact.candidateId || fact.sourceId), `property:${scalar(property.id)}:${FIELD_PATHS[key]?.join('.') || key}`, scalar(fact.source)].filter(Boolean));
    return value;
  };
  const rowFor = (key: string): ReportRow | null => {
    const value = values[key], label = reportFieldLabel(key, locale);
    return value && label && !['UNAVAILABLE', 'NOT_APPLICABLE'].includes(value.state)
      ? { label, value: value.text, state: value.state, source: value.source, evidenceRefs: value.evidenceRefs } : null;
  };
  factValue('price', 'money', true);
  for (const key of ['beds', 'baths', 'yearBuilt', 'propertyTaxYear', 'assessmentYear']) factValue(key);
  factValue('sqft', 'sqft', true); factValue('lotSizeSqft', 'sqft', true); factValue('lotSizeAcres', 'acres', true);
  for (const key of ['rehab', 'annualPropertyTax', 'assessedValue', 'noi', 'latestSalePrice']) factValue(key, 'money');
  for (const key of ['assessorId', 'zoning', 'county', 'legalDescription', 'subdivision', 'latestSaleDate', 'ownerOccupied', 'ownershipRecordPresent']) factValue(key, 'text');
  if (values.latestSaleDate.state === 'VALUE') { const date = new Date(values.latestSaleDate.text); if (!Number.isNaN(date.getTime())) values.latestSaleDate.text = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'pt-BR', { timeZone: 'UTC', year: 'numeric', month: locale === 'en' ? 'short' : '2-digit', day: locale === 'en' ? 'numeric' : '2-digit' }).format(date); }
  const cap = factFor('capRate');
  // Stored rate must carry explicit origin; a historical zero cannot establish NOI.
  const rateProof = explicitZeroProof(cap) || /USER_PROVIDED|DECLARED|CONFIRMED/.test(`${scalar(cap.status)} ${scalar(cap.source)}`) && number(cap.value) !== 0;
  const capValue = rateProof ? factValue('capRate', 'percent') : { state: 'UNAVAILABLE' as const, text: unavailable, numericValue: null, source: '', evidenceRefs: ['status:cap-rate'] };
  values.capRate = capValue; register('status:cap-rate', t('Cap Rate indisponível sem taxa declarada com proveniência ou NOI válido e base de valor explícita.', 'Cap rate is unavailable without a rate with explicit provenance or valid NOI and an explicit value basis.', 'La tasa de capitalización no está disponible sin procedencia explícita o NOI válido y base de valor explícita.'));
  const calculatedRate = obj(obj(presentation.existingMetrics).capRate), rate = number(calculatedRate.value);
  if (!land && calculatedRate.sourceType === 'CALCULATED' && rate !== null && Math.abs(rate) <= 100
    && values.noi.numericValue !== null && values.price.numericValue !== null && values.price.numericValue > 0
    && calculatedRate.formulaId === 'NOI_DIVIDED_BY_VALUE' && positive(calculatedRate.valueBasis) === values.price.numericValue
    && Math.abs(rate - values.noi.numericValue / values.price.numericValue * 100) <= .01) {
    const source = t('Cálculo existente: NOI documentado dividido pela base de valor explícita', 'Existing calculation: documented NOI divided by an explicit value basis', 'Cálculo existente: NOI documentado dividido por una base de valor explícita');
    const ref = register('calculation:cap-rate', `${numeric(rate, locale)}% · ${source}`, [rate]);
    values.capRate = { state: rate === 0 ? 'EXPLICIT_ZERO' : 'VALUE', text: `${numeric(rate, locale)}%`, numericValue: rate, source, evidenceRefs: [ref] };
  }
  if (land && !areaConflict) {
    const metrics = calculateLandUnitMetrics(values.price.numericValue, property);
    for (const key of ['pricePerAcre', 'pricePerLotSqft'] as const) {
      const n = positive(metrics[key]); if (n === null) continue;
      const source = t('Cálculo determinístico com área e preço informados', 'Deterministic calculation using supplied area and price', 'Cálculo determinista con área y precio aportados');
      const ref = register(`calculation:${key}`, source, [n]); values[key] = { state: 'VALUE', text: money(n, locale, 2), numericValue: n, source, evidenceRefs: [ref] };
    }
  }
  const identityAddress = reportNarrativeString(property.address) || reportNarrativeString(property.title) || t('Imóvel sem endereço informado', 'Property address not supplied', 'Dirección no informada');
  const location = [property.city, property.state, property.zip].map(reportNarrativeString).filter(Boolean).join(', ');
  register('property:identity', `${identityAddress} · ${location} · ${typeLabel} · ${strategyLabel}`);
  const resultSections: ReportSection[] = [];
  const push = (section: Omit<ReportSection, 'continuationPolicy'>): void => {
    if (!section.text && !section.items?.length && !section.rows?.length && !section.table?.rows.length && !section.hero) return;
    resultSections.push({ ...section, continuationPolicy: 'SAME_SECTION' });
  };
  const claim = (text: string, refs: string[]): ReportClaim => ({ text, evidenceRefs: refs });
  const known = (key: string): boolean => !!values[key] && ['VALUE', 'EXPLICIT_ZERO', 'PROVISIONAL'].includes(values[key].state);
  const blockers: { id: string; impact: string; action: string; refs: string[]; priority: number }[] = [];
  const addBlocker = (id: string, impact: string, action: string, refs: string[], priority: number): void => {
    register(`blocker:${id}`, impact); register(`action:${id}`, action);
    blockers.push({ id, impact, action, refs: [...refs, `blocker:${id}`], priority });
  };
  const physicalConflicts = ['beds', 'baths', 'sqft'].filter(key => values[key]?.state === 'CONFLICTED');
  if (physicalConflicts.length) addBlocker('physical-facts',
    t(`Divergências não resolvidas: ${physicalConflicts.map(key => reportFieldLabel(key, locale)).join(', ')}. Os valores sinalizados não sustentam cálculos.`, `Unresolved physical disagreements: ${physicalConflicts.map(key => reportFieldLabel(key, locale)).join(', ')}. Flagged values cannot support calculations.`, `Discrepancias físicas sin resolver: ${physicalConflicts.map(key => reportFieldLabel(key, locale)).join(', ')}. Los valores señalados no sustentan cálculos.`),
    t('Compare o cadastro com o registro público e salve a escolha com o publicador.', 'Compare the listing with the public record and save the publisher review decision.', 'Compare el registro con los datos públicos y guarde la decisión del publicador.'), physicalConflicts.map(key => `fact:${key}`), 99);
  if (areaConflict) addBlocker('parcel-area', t('As áreas do lote divergem. A área utilizável e o preço por acre não podem ser afirmados até a revisão.', 'Parcel areas disagree. Usable area and price per acre cannot be established until review.', 'Las áreas del lote difieren. No se puede afirmar el área utilizable ni el precio por acre hasta revisar.'), t('Compare a área declarada com o registro parcelário e salve sua escolha na revisão de dados para liberar os indicadores de terreno.', 'Compare the declared area with the parcel record and save the review decision to unlock land metrics.', 'Compare el área declarada con el registro parcelario y guarde la decisión para habilitar los indicadores de terreno.'), ['fact:lotSizeSqft', 'fact:lotSizeAcres'], 100);
  if (property.propertyTypeConflict === true) addBlocker('property-type', t('O tipo informado diverge do registro externo; referências de outro tipo não sustentam esta avaliação.', 'The declared type differs from the external record; another property type cannot support this valuation.', 'El tipo declarado difiere del registro externo; otro tipo no sustenta esta valoración.'), t('Revise a classificação do imóvel com a fonte do cadastro antes de usar a estimativa externa.', 'Review the property classification against the record source before using the external estimate.', 'Revise la clasificación del inmueble con la fuente del registro antes de usar la estimación externa.'), ['property:identity'], 95);
  const rentalView = obj(presentation.marketRent), rentAmount = !land ? positive(rentalView.monthlyRentEstimate) : null;
  const comps = section('comparableEvidence'), selectedSold = rankReportComparables(list(comps.used).map(obj).filter(item => item.role === 'PRIMARY' && positive(item.salePrice) !== null && scalar(item.saleDate) && !Number.isNaN(new Date(scalar(item.saleDate)).getTime()))).slice(0, 5);
  const reportedSales = rankReportComparables([...list(comps.used), ...list(comps.supporting), ...list(comps.excluded)].map(obj).filter(item => positive(item.salePrice) !== null && scalar(item.saleDate)));
  const soldReasons: Record<string, string> = {
    CONDITION_REVIEW_PENDING: t('Condição do comparável ainda não revisada em relação à condição-alvo.', 'Comparable condition has not been reviewed against the target condition.', 'Condición del comparable no revisada frente a la condición objetivo.'),
    SECONDARY_PROXIMITY_WITHOUT_MICRO_MARKET_EVIDENCE: t('Distância secundária sem comprovação de equivalência do micromercado.', 'Secondary proximity without micro-market equivalence evidence.', 'Distancia secundaria sin evidencia de equivalencia de micromercado.'),
    FAILED_HARD_GATE: t('Não atende aos requisitos obrigatórios do motor.', 'Fails mandatory engine requirements.', 'No cumple los requisitos obligatorios del motor.'),
    INSUFFICIENT_STRUCTURAL_SCORE: t('Similaridade estrutural abaixo do mínimo do motor.', 'Structural similarity below the engine minimum.', 'Similitud estructural inferior al mínimo del motor.'),
    INSUFFICIENT_COMPLETENESS: t('Completude abaixo do mínimo do motor.', 'Completeness below the engine minimum.', 'Completitud inferior al mínimo del motor.'),
    TRANSACTION_NOT_ARMS_LENGTH: t('Transação identificada como não independente.', 'Transaction identified as non-arm’s-length.', 'Transacción identificada como no independiente.'),
    CONDITION_UNKNOWN: t('Condição comparável desconhecida.', 'Comparable condition unknown.', 'Condición comparable desconocida.'),
    DIFFERENT_PRODUCT_CLASS: t('Classe de produto diferente.', 'Different product class.', 'Clase de producto diferente.'),
    NOT_COMPARABLE: t('Revisão classificou como não comparável.', 'Review classified as not comparable.', 'Revisión clasificada como no comparable.'),
    MAXIMUM_CORE_COMP_COUNT: t('Limite de comparáveis principais atingido.', 'Maximum core comparable count reached.', 'Límite de comparables principales alcanzado.'),
  };
  const soldReason = (item: Input) => [...new Set([scalar(item.exclusionReason), ...list(item.promotionBlockers).map(scalar)].filter(Boolean))]
    .map(code => soldReasons[code] || t('Critério adicional do motor pendente de validação; não adotado no ARV.', 'Additional engine criterion requires validation; not adopted in ARV.', 'Criterio adicional del motor pendiente de validación; no adoptado en ARV.')).join(' ')
    || (item.role === 'PRIMARY' ? t('Elegível conforme motor e revisão de condição.', 'Eligible under engine and condition review.', 'Elegible según motor y revisión de condición.') : t('Referência de apoio; elegibilidade de condição não comprovada.', 'Supporting reference; condition eligibility unproven.', 'Referencia de apoyo; elegibilidad de condición no comprobada.'));
  const soldSummary = reportedSales.length ? t(`${reportedSales.length} vendas registradas na seleção; ${list(comps.used).length} elegíveis para ARV; ${list(comps.supporting).length} de apoio; ${list(comps.excluded).length} excluídas.`, `${reportedSales.length} recorded sales in the selection; ${list(comps.used).length} ARV eligible; ${list(comps.supporting).length} supporting; ${list(comps.excluded).length} excluded.`, `${reportedSales.length} ventas registradas en la selección; ${list(comps.used).length} elegibles para ARV; ${list(comps.supporting).length} de apoyo; ${list(comps.excluded).length} excluidas.`) : '';
  if (level === 3 && reportedSales.length) {
    for (const [index, item] of reportedSales.slice(0, 8).entries()) {
      const percent = (value: unknown) => number(value) === null ? unavailable : `${numeric(Number(value), locale, 1)}%`;
      const reason = soldReason(item), address = reportNarrativeString(item.address) || unavailable;
      const text = [
        `${t('Identificador do provedor', 'Provider identifier', 'Identificador del proveedor')}: ${reportNarrativeString(item.compIdentifier) || unavailable}`,
        `${t('Tipo', 'Type', 'Tipo')}: ${item.propertyType === 'Single Family' ? t('Residência unifamiliar', 'Single family', 'Vivienda unifamiliar') : reportNarrativeString(item.propertyType) || unavailable} · ${number(item.sqft) === null ? unavailable : numeric(Number(item.sqft), locale)} sqft · ${number(item.beds) ?? '—'} / ${number(item.baths) ?? '—'} ${t('quartos / banheiros', 'beds / baths', 'habitaciones / baños')}`,
        `SOLD: ${money(Number(item.salePrice), locale)} · ${formatReportDate(item.saleDate, locale)} · ${number(item.distanceMiles) === null ? '—' : `${numeric(Number(item.distanceMiles), locale, 2)} mi`}`,
        `${t('Similaridade estrutural', 'Structural similarity', 'Similitud estructural')}: ${percent(item.similarity)} · ${t('Completude', 'Completeness', 'Completitud')}: ${percent(item.dataCompletenessScore)}`,
        `${t('Natureza da transação', 'Transaction nature', 'Naturaleza de la transacción')}: ${item.transactionQuality === 'ARMS_LENGTH' ? t('Independente', 'Arm’s length', 'Independiente') : item.transactionQuality === 'NON_ARMS_LENGTH' ? t('Não independente', 'Non-arm’s length', 'No independiente') : t('Não informada pelo registro; preço isolado não comprova transação atípica.', 'Not reported in the record; price alone does not prove an atypical transaction.', 'No informada por el registro; el precio no prueba una transacción atípica.')}`,
        `${t('Condição comparável', 'Comparable condition', 'Condición comparable')}: ${!scalar(item.conditionEvidenceSource) ? t('Não revisada; não há comprovação em relação à condição-alvo.', 'Not reviewed; compatibility with target condition is unproven.', 'No revisada; compatibilidad con condición objetivo no comprobada.') : t('Revisão registrada; elegibilidade descrita na decisão abaixo.', 'Review recorded; eligibility is described below.', 'Revisión registrada; elegibilidad descrita a continuación.')}`,
        `${t('Decisão do motor', 'Engine decision', 'Decisión del motor')}: ${reason}`,
      ].join('\n');
      const ref = register(`sold-diagnostic:${index + 1}`, text);
      push({ id: `sold-diagnostic-${index + 1}`, title: `${t('Diagnóstico SOLD', 'SOLD diagnostic', 'Diagnóstico SOLD')} ${index + 1} · ${address}`, kind: 'narrative', text, priority: 12, evidenceRefs: [ref] });
    }
  }
  const usableArv = !land && ['ARV_AVAILABLE', 'ARV_LIMITED'].includes(scalar(valuation.status)) && positive(obj(valuation.range).low) !== null
    && positive(obj(valuation.range).high) !== null && Number(obj(valuation.range).high) >= Number(obj(valuation.range).low) && selectedSold.length >= ARV_ELIGIBILITY_POLICY.minimumPreliminarySales;
  const preliminaryArv = usableArv && arvEvidenceTier(selectedSold.length) === 'PRELIMINARY';
  const providerEstimate = property.propertyTypeConflict !== true && scalar(obj(valuation.providerEstimate).status) !== 'QUARANTINED_FOR_TYPE_CONFLICT' ? positive(obj(valuation.providerEstimate).value) : null;
  const marketKnown = usableArv || rentAmount !== null && rental || selectedSold.length > 0 || providerEstimate !== null;
  if (!marketKnown) addBlocker('market-support', t('As evidências de mercado atuais não sustentam uma conclusão de valor. O preço pedido não é uma avaliação.', 'Current market evidence does not support a valuation conclusion. Asking price is not a valuation.', 'La evidencia de mercado actual no sustenta una conclusión de valor. El precio solicitado no es una valoración.'), land
    ? t('Obtenha vendas registradas de terrenos comparáveis, com área, data e localização, para avaliar o preço por acre.', 'Obtain recorded comparable land sales with area, date and location to evaluate price per acre.', 'Obtenga ventas registradas de terrenos comparables con área, fecha y ubicación para evaluar el precio por acre.')
    : t('Confirme vendas fechadas comparáveis ao tipo, área e condição deste imóvel para testar o preço pedido.', 'Confirm closed sales comparable to this property’s type, size and condition to test the asking price.', 'Confirme ventas cerradas comparables en tipo, área y condición para contrastar el precio solicitado.'), ['property:identity'], 90);
  if (land && !known('zoning')) addBlocker('land-use', t('O uso permitido não está documentado; isso limita a análise de aproveitamento do terreno.', 'Permitted use is not documented, limiting land feasibility analysis.', 'El uso permitido no está documentado, lo que limita la viabilidad del terreno.'), t('Confirme o código de zoneamento e os usos permitidos junto à jurisdição competente antes de projetar construção.', 'Confirm the zoning code and permitted uses with the relevant jurisdiction before planning construction.', 'Confirme el código de zonificación y los usos permitidos con la jurisdicción competente antes de proyectar construcción.'), ['fact:zoning'], 80);
  if (!land && ['FLIP', 'GENERIC_SELL', 'WHOLESALE'].includes(strategy) && !scalar(property.condition)) addBlocker('condition', t('A condição física não está documentada; não é possível concluir a necessidade de reforma ou a comparabilidade de condição.', 'Physical condition is not documented; rehabilitation needs and condition comparability remain unconfirmed.', 'La condición física no está documentada; la reforma necesaria y la comparabilidad de condición no están confirmadas.'), t('Confirme a condição atual com inspeção ou documentação para qualificar a reforma e a comparação com vendas.', 'Confirm current condition with inspection or documentation to qualify rehabilitation and comparable sales.', 'Confirme la condición actual con inspección o documentación para calificar la reforma y las ventas comparables.'), ['property:identity'], strategy === 'FLIP' ? 92 : 75);
  if (!known('price')) addBlocker('asking-price', t('O preço de aquisição não foi estabelecido; a análise de preço fica limitada.', 'Acquisition price is not established, limiting price analysis.', 'El precio de adquisición no está establecido, lo que limita el análisis de precio.'), t('Confirme o preço pedido ou de aquisição antes de comparar custo e valor.', 'Confirm asking or acquisition price before comparing cost and value.', 'Confirme el precio solicitado o de adquisición antes de comparar costo y valor.'), ['fact:price'], 85);
  const financial = obj(presentation.financialEvidence), financialInputs = obj(financial.inputs);
  const resolvedTax = obj(financialInputs.propertyTax);
  if (level > 1 && Object.keys(resolvedTax).length && resolvedTax.sourceClass !== 'INVESTOR_ASSUMPTION') {
    const amount = number(resolvedTax.value), conflicted = resolvedTax.analyticalUsability === 'CONFLICTED';
    const usable = !conflicted && amount !== null && amount >= 0 && resolvedTax.cadence === 'ANNUAL' && resolvedTax.unit === 'USD'
      && ['ACTUAL', 'USER_PROVIDED_ACTUAL', 'PUBLIC_RECORD'].includes(scalar(resolvedTax.sourceClass)) && !!resolvedTax.source;
    const source = usable ? formatFinancialEvidenceSource(resolvedTax as unknown as FinancialResolvedInput, locale) : '';
    const text = usable ? money(amount!, locale) : conflicted ? t('Fontes em conflito; imposto não adotado.', 'Conflicting sources; tax not adopted.', 'Fuentes en conflicto; impuesto no adoptado.') : unavailable;
    const ref = register('financial:shared-tax', `${text} · ${source}`, usable ? [amount!] : []);
    values.annualPropertyTax = { state: conflicted ? 'CONFLICTED' : usable ? amount === 0 ? 'EXPLICIT_ZERO' : 'VALUE' : 'UNAVAILABLE', text, numericValue: usable ? amount : null, source, evidenceRefs: [ref] };
    const year = number(obj(resolvedTax.source).periodYear);
    values.propertyTaxYear = { state: usable && year !== null ? 'VALUE' : 'UNAVAILABLE', text: usable && year !== null ? String(year) : unavailable, numericValue: usable ? year : null, source, evidenceRefs: [ref] };
  }
  if (rental) {
    const financialRows: ReportRow[] = [];
    for (const key of ['currentContractRent', 'investorRentAssumption', 'propertyTax', 'hoa', 'insurance', 'vacancy', 'maintenance', 'propertyManagement', 'utilities', 'otherOperatingExpenses']) {
      const item = obj(financialInputs[key]), source = obj(item.source), amount = number(item.value);
      if (amount === null || EMPTY_STATES.has(scalar(item.analyticalUsability)) || item.analyticalUsability === 'CONFLICTED') continue;
      const assumption = item.assumption === true || item.sourceClass === 'INVESTOR_ASSUMPTION';
      const actualRent = key === 'currentContractRent' && ['ACTUAL', 'USER_PROVIDED_ACTUAL', 'PUBLIC_RECORD'].includes(scalar(item.sourceClass));
      if (key === 'currentContractRent' && !actualRent || amount === 0 && source.userConfirmed !== true && !explicitZeroProof(source)) continue;
      const frequency = item.cadence === 'MONTHLY' ? t('por mês', 'per month', 'por mes') : item.cadence === 'ANNUAL' ? t('por ano', 'per year', 'por año') : t('periodicidade não confirmada', 'frequency unconfirmed', 'periodicidad no confirmada');
      const sourceLabel = assumption ? t('Premissa privada do investidor', 'Private investor assumption', 'Supuesto privado del inversor') : provenanceLabel({ ...source, source: source.sourceType }, locale);
      const text = item.unit === 'PERCENT' ? `${numeric(amount, locale)}%` : `${money(amount, locale)} · ${frequency}`;
      const id = register(`financial:${key}`, `${reportFieldLabel(key, locale)}: ${text} · ${sourceLabel}`, [amount]);
      values[`financial:${key}`] = { state: amount === 0 ? 'EXPLICIT_ZERO' : assumption ? 'PROVISIONAL' : 'VALUE', text, numericValue: amount, source: sourceLabel, evidenceRefs: [id] };
      financialRows.push({ label: reportFieldLabel(key, locale) || unavailable, value: text, source: sourceLabel, evidenceRefs: [id] });
    }
    if (financialRows.length) push({ id: 'operating-evidence', title: t('Renda e despesas: evidências e premissas', 'Income and expenses: evidence and assumptions', 'Ingresos y gastos: evidencia y supuestos'), kind: 'facts', priority: 65, rows: financialRows, evidenceRefs: financialRows.flatMap(row => row.evidenceRefs) });
    const actual = obj(financialInputs.currentContractRent);
    if (number(actual.value) === null || !['ACTUAL', 'USER_PROVIDED_ACTUAL', 'PUBLIC_RECORD'].includes(scalar(actual.sourceClass))) addBlocker('current-rent', t('O aluguel contratual atual não foi confirmado. Aluguel de mercado não comprova renda efetiva nem libera o NOI atual.', 'Current contract rent is not confirmed. Market rent does not establish actual income or current NOI.', 'El alquiler contractual actual no está confirmado. El alquiler de mercado no prueba ingresos efectivos ni habilita el NOI actual.'), t('Confirme o contrato e a renda efetivamente recebida para distinguir o resultado atual do cenário de mercado.', 'Confirm the lease and income actually received to distinguish current performance from a market scenario.', 'Confirme el contrato y los ingresos recibidos para distinguir el resultado actual del escenario de mercado.'), ['property:identity'], 96);
    const unresolvedExpense = ['insurance', 'propertyTax', 'hoa', 'maintenance'].find(key => number(obj(financialInputs[key]).value) === null);
    if (unresolvedExpense) { const label = reportFieldLabel(unresolvedExpense, locale) || unavailable;
      addBlocker(`expense-${unresolvedExpense}`, t(`${label}: aplicabilidade e valor não confirmados; os custos operacionais permanecem incompletos.`, `${label}: applicability and amount are unconfirmed; operating costs remain incomplete.`, `${label}: aplicabilidad e importe no confirmados; los gastos operativos siguen incompletos.`), t(`Confirme se ${label.toLowerCase()} se aplica e documente o valor ou uma premissa explícita; não será presumido zero.`, `Confirm whether ${label.toLowerCase()} applies and document its amount or an explicit assumption; zero will not be presumed.`, `Confirme si ${label.toLowerCase()} se aplica y documente el importe o un supuesto explícito; no se presumirá cero.`), ['property:identity'], 70); }
  }
  blockers.sort((a, b) => b.priority - a.priority);
  const opportunities: ReportClaim[] = [];
  if (usableArv && level === 3) {
    const low = Number(obj(valuation.range).low), high = Number(obj(valuation.range).high), center = positive(valuation.centralReference), ref = register('market:arv', t(`Faixa de ARV: ${money(low, locale)} a ${money(high, locale)}.`, `ARV range: ${money(low, locale)} to ${money(high, locale)}.`, `Rango de ARV: ${money(low, locale)} a ${money(high, locale)}.`), [low, high, selectedSold.length]);
    const mapPoints: ReportMapPoint[] = [];
    if (finitePoint(property.latitude, property.longitude)) mapPoints.push({ id: 'subject', marker: 'S', latitude: Number(property.latitude), longitude: Number(property.longitude) });
    const tableRows = selectedSold.map((item, index) => {
      const id = register(`sold:${index + 1}`, reportNarrativeString(item.address) || unavailable, [Number(item.salePrice)], [scalar(item.compIdentifier), `property:${scalar(property.id)}:selected-sold:${index + 1}`].filter(Boolean));
      if (finitePoint(item.latitude, item.longitude)) mapPoints.push({ id, marker: String(index + 1), latitude: Number(item.latitude), longitude: Number(item.longitude) });
      return [String(index + 1), reportNarrativeString(item.address) || unavailable, money(Number(item.salePrice), locale), formatReportDate(item.saleDate, locale), number(item.distanceMiles) === null ? '—' : `${numeric(Number(item.distanceMiles), locale)} mi`];
    });
    push({ id: 'arv-market', title: preliminaryArv ? t('Faixa preliminar de ARV · baixa confiança', 'Preliminary ARV range · low confidence', 'Rango preliminar de ARV · confianza baja') : t('ARV: vendas e condição comparável', 'ARV: sales and comparable condition', 'ARV: ventas y condición comparable'), kind: 'comparables', priority: 92,
      hero: { label: t('Faixa de valor após reforma', 'After-repair value range', 'Rango de valor tras reforma'), value: `${money(low, locale)} — ${money(high, locale)}`, qualification: t('Resultado do motor determinístico; não é avaliação oficial. Condição e ajustes permanecem essenciais.', 'Existing deterministic engine result; not an appraisal. Condition and adjustments remain essential.', 'Resultado del motor determinista; no es tasación. La condición y los ajustes siguen siendo esenciales.') },
      rows: [{ label: t('Confiança do ARV', 'ARV confidence', 'Confianza del ARV'), value: preliminaryArv ? t('Baixa · apenas duas vendas elegíveis', 'Low · only two eligible sales', 'Baja · solo dos ventas elegibles') : /HIGH/.test(scalar(valuation.confidence)) ? t('Alta', 'High', 'Alta') : /MODERATE/.test(scalar(valuation.confidence)) ? t('Moderada', 'Moderate', 'Moderada') : t('Limitada', 'Limited', 'Limitada'), evidenceRefs: [ref] }],
      ...(!preliminaryArv && center !== null && center >= low && center <= high ? { range: { low: money(low, locale), high: money(high, locale), estimate: money(center, locale), position: high > low ? (center - low) / (high - low) : .5 } } : {}),
      map: { points: mapPoints, caption: t('S: imóvel analisado. Marcadores e linhas usam as mesmas vendas registradas. Posições relativas derivadas das coordenadas; não é mapa cadastral.', 'S: subject property. Markers and rows use the same recorded sales. Coordinate-derived relative view; not a cadastral map.', 'S: inmueble analizado. Marcadores y filas usan las mismas ventas registradas. Vista relativa por coordenadas; no es mapa catastral.') },
      table: { columns: ['#', t('Endereço', 'Address', 'Dirección'), t('Venda', 'Sale', 'Venta'), t('Data', 'Date', 'Fecha'), t('Distância', 'Distance', 'Distancia')], rows: tableRows, evidenceRefs: selectedSold.map((_, i) => [`sold:${i + 1}`]) }, evidenceRefs: [ref, ...selectedSold.map((_, i) => `sold:${i + 1}`)] });
    opportunities.push(claim(t(`${selectedSold.length} vendas elegíveis sustentam a faixa de ARV de ${money(low, locale)} a ${money(high, locale)} para comparar o cenário de reforma; isso não comprova margem ou retorno.`, `${selectedSold.length} eligible sales support an ARV range of ${money(low, locale)} to ${money(high, locale)} for the rehabilitation scenario; this does not establish margin or return.`, `${selectedSold.length} ventas elegibles sustentan el rango de ARV de ${money(low, locale)} a ${money(high, locale)} para comparar la reforma; no prueba margen ni rentabilidad.`), [ref]));
  }
  if (!usableArv && !land && level === 3) {
    const recorded = rankReportComparables([...list(comps.used), ...list(comps.supporting)].map(obj).filter(item => positive(item.salePrice) !== null && scalar(item.saleDate) && !Number.isNaN(new Date(scalar(item.saleDate)).getTime()))).slice(0, 5);
    if (recorded.length) {
      const points: ReportMapPoint[] = finitePoint(property.latitude, property.longitude) ? [{ id: 'subject', marker: 'S', latitude: Number(property.latitude), longitude: Number(property.longitude) }] : [];
      const refs: string[][] = [];
      const rows = recorded.map((item, index) => {
        const ref = register(`recorded-sale:${index}`, reportNarrativeString(item.address) || unavailable, [Number(item.salePrice)], [scalar(item.compIdentifier)].filter(Boolean)); refs.push([ref]);
        if (finitePoint(item.latitude, item.longitude)) points.push({ id: ref, marker: String(index + 1), latitude: Number(item.latitude), longitude: Number(item.longitude) });
        return [String(index + 1), reportNarrativeString(item.address) || unavailable, money(Number(item.salePrice), locale), formatReportDate(item.saleDate, locale), number(item.distanceMiles) === null ? '—' : `${numeric(Number(item.distanceMiles), locale)} mi`];
      });
      push({ id: 'sold-reference', title: t('Vendas registradas: evidência de apoio', 'Recorded sales: supporting evidence', 'Ventas registradas: evidencia de apoyo'), kind: 'comparables', priority: 85,
        text: t('Referências de venda disponíveis; não constituem uma faixa de ARV validada. Condição e critérios de comparação ainda precisam de verificação.', 'Available sale references; these do not establish a validated ARV range. Condition and comparison criteria still require verification.', 'Referencias de venta disponibles; no establecen un rango ARV validado. Condición y criterios de comparación requieren verificación.'),
        map: { points, caption: t('S: imóvel analisado. Mesmas referências no mapa e na tabela.', 'S: subject property. Same references on the map and in the table.', 'S: inmueble analizado. Mismas referencias en mapa y tabla.') },
        table: { columns: ['#', t('Endereço', 'Address', 'Dirección'), t('Venda', 'Sale', 'Venta'), t('Data', 'Date', 'Fecha'), t('Distância', 'Distance', 'Distancia')], rows, evidenceRefs: refs }, evidenceRefs: refs.flat() });
    }
  }
  if (level === 3 && !land) {
    const listings = projectProviderListingReferences(valuation.providerListingReferences).slice(0, 5);
    if (listings.length) {
      const points: ReportMapPoint[] = finitePoint(property.latitude, property.longitude) ? [{ id: 'subject', marker: 'S', latitude: Number(property.latitude), longitude: Number(property.longitude) }] : [];
      const refs: string[][] = [];
      const rows = listings.map((item, index) => {
        const id = register(`provider-listing:${index + 1}`, reportNarrativeString(item.address) || unavailable, [item.price], ['RentCast:provider-listing-reference']); refs.push([id]);
        if (finitePoint(item.latitude, item.longitude)) points.push({ id, marker: String(index + 1), latitude: item.latitude!, longitude: item.longitude! });
        return [String(index + 1), reportNarrativeString(item.address) || unavailable, money(item.price, locale), formatReportDate(item.lastSeenDate, locale), item.distanceMiles === null ? '—' : `${numeric(item.distanceMiles, locale, 2)} mi`];
      });
      const qualification = t('Preços de anúncios do provedor. Não comprovam vendas fechadas e não foram adotados no cálculo do ARV.', 'Provider listing prices. They do not establish closed sales and are not adopted in ARV calculations.', 'Precios de anuncios del proveedor. No prueban ventas cerradas y no se adoptan en el cálculo del ARV.');
      push({ id: 'provider-listing-references', title: t('Referências de anúncios do provedor', 'Provider listing references', 'Referencias de anuncios del proveedor'), kind: 'comparables', priority: 59,
        table: { columns: ['#', t('Endereço', 'Address', 'Dirección'), t('Preço anunciado', 'Listing price', 'Precio anunciado'), t('Última observação', 'Last seen', 'Última observación'), t('Distância', 'Distance', 'Distancia')], rows, evidenceRefs: refs },
        map: { points, caption: qualification }, evidenceRefs: refs.flat() });
    }
  }
  if (rentAmount !== null && level >= 2) {
    const rentCopy = marketRentReportCopy(locale), unit = rentalView.scope === 'UNIT' ? ` · ${rentCopy.perUnit}` : '';
    const ref = register('market:rent', `${rentCopy.title}: ${money(rentAmount, locale)} ${rentCopy.monthly}${unit}`, [rentAmount], [`RentCast:rent-avm:${scalar(rentalView.requestFingerprint) || scalar(property.id)}`, scalar(rentalView.retrievedAt)].filter(Boolean));
    const rentSection: ReportSection = { id: 'market-rent', title: rentCopy.title, kind: 'market', priority: rental ? 95 : 60,
      hero: { label: `${rentCopy.title}${unit}`, value: money(rentAmount, locale), qualification: `${rentCopy.monthly} · ${rentCopy.qualification}` }, evidenceRefs: [ref], continuationPolicy: 'SAME_SECTION' };
    if (level === 3) {
      const rows: ReportRow[] = [], low = positive(rentalView.rangeLow), high = positive(rentalView.rangeHigh);
      if (low !== null && high !== null && low <= rentAmount && high >= rentAmount) { rentSection.range = { low: money(low, locale), high: money(high, locale), estimate: money(rentAmount, locale), position: high > low ? (rentAmount - low) / (high - low) : .5 }; register('market:rent-range', `${money(low, locale)} — ${money(high, locale)}`, [low, high]); }
      for (const [key, label, decimals] of [['rentPerSqft', rentCopy.perSqft, 2], ['rentPerBedroom', rentCopy.perBed, 0]] as const) { const n = positive(obj(rentalView[key]).value); if (n !== null) { const id = register(`calculation:${key}`, rentCopy.calculated, [n]); rows.push({ label, value: money(n, locale, decimals), source: rentCopy.calculated, evidenceRefs: [id] }); } }
      const subject = obj(rentalView.subject);
      for (const [key, field] of [['bedrooms', 'beds'], ['bathrooms', 'baths'], ['livingAreaSqft', 'sqft']] as const) { const n = positive(subject[key]); if (n !== null) rows.push({ label: `${rentCopy.subject} · ${reportFieldLabel(field, locale)}`, value: `${numeric(n, locale)}${field === 'sqft' ? ' sqft' : ''}`, source: 'RentCast', evidenceRefs: [ref] }); }
      const comps = list(rentalView.reportRentalComparables).map(obj).filter(item => positive(item.monthlyRent) !== null).slice(0, 5);
      const mapPoints: ReportMapPoint[] = [];
      if (finitePoint(subject.latitude, subject.longitude)) mapPoints.push({ id: 'subject', marker: 'S', latitude: Number(subject.latitude), longitude: Number(subject.longitude) });
      if (comps.length) {
        rentSection.table = { columns: ['#', t('Endereço', 'Address', 'Dirección'), rentCopy.monthly, rentCopy.distance, rentCopy.correlation], rows: comps.map((comp, index) => {
          const id = `rent-comp:${index + 1}`; register(id, reportNarrativeString(comp.address) || unavailable, [Number(comp.monthlyRent)], [scalar(comp.id), `RentCast:rent-avm:${scalar(rentalView.requestFingerprint) || scalar(property.id)}:comparable:${index + 1}`].filter(Boolean));
          if (finitePoint(comp.latitude, comp.longitude)) mapPoints.push({ id, marker: String(index + 1), latitude: Number(comp.latitude), longitude: Number(comp.longitude) });
          return [String(index + 1), reportNarrativeString(comp.address) || unavailable, money(Number(comp.monthlyRent), locale), number(comp.distanceMiles) !== null ? `${numeric(Number(comp.distanceMiles), locale)} mi` : '—', number(comp.providerCorrelation) !== null ? `${numeric(Number(comp.providerCorrelation) * 100, locale, 1)}%` : '—'];
        }), evidenceRefs: comps.map((_, i) => [`rent-comp:${i + 1}`]) };
        rentSection.map = { points: mapPoints, caption: t('S: imóvel analisado; 1–5: os mesmos imóveis da tabela. Visão relativa por coordenadas, não mapa cadastral.', 'S: subject; 1–5: the same rentals shown in the table. Coordinate-derived relative view, not a cadastral map.', 'S: inmueble analizado; 1–5: los mismos alquileres de la tabla. Vista relativa por coordenadas, no mapa catastral.') + (mapPoints.length < comps.length + 1 ? ` ${rentCopy.missing}` : '') };
      } else rentSection.text = rentCopy.noComps;
      const retrievedAt = scalar(rentalView.retrievedAt), date = new Date(retrievedAt);
      rows.push({ label: t('Fonte e atualidade', 'Source and freshness', 'Fuente y actualidad'), value: `RentCast${Number.isNaN(date.getTime()) ? '' : ` · ${rentCopy.retrieved}: ${new Intl.DateTimeFormat(localeCode(locale), { timeZone: 'UTC' }).format(date)}`}${rentalView.freshness === 'STALE_USABLE' ? ` · ${rentCopy.stale}` : ''}`, evidenceRefs: [ref] });
      rentSection.rows = rows;
    }
    resultSections.push(rentSection);
    opportunities.push(claim(t(`O RentCast estima ${money(rentAmount, locale)} por mês${unit} para um cenário de locação; a estimativa não substitui o contrato ou a renda recebida.`, `RentCast estimates ${money(rentAmount, locale)} per month${unit} for a rental scenario; the estimate does not replace the lease or income received.`, `RentCast estima ${money(rentAmount, locale)} por mes${unit} para un escenario de alquiler; la estimación no sustituye el contrato ni los ingresos recibidos.`), [ref]));
  }
  if (providerEstimate !== null && level > 1) { const id = register('market:provider-value', money(providerEstimate, locale), [providerEstimate]);
    push({ id: 'provider-reference', title: t('Referência automatizada de valor', 'Automated value reference', 'Referencia automatizada de valor'), kind: 'market', priority: 55,
      hero: { label: t('Estimativa do provedor', 'Provider estimate', 'Estimación del proveedor'), value: money(providerEstimate, locale), qualification: t('Estimativa automatizada: não é ARV, avaliação oficial ou valor de venda confirmado.', 'Automated estimate: not ARV, appraisal or confirmed sale value.', 'Estimación automatizada: no es ARV, tasación ni valor de venta confirmado.') }, evidenceRefs: [id] }); }
  // Previously calculated scenarios remain auditable, without feeding a new return engine.
  const activeScenario = obj(presentation.activeScenario), output = obj(presentation.landDevelopment);
  if (!land && level > 1) {
    const sourcePath = activeScenario.confirmed === true ? 'activeScenario' : 'sellerFinancingScenario';
    const saved = projectSavedReportScenario({ scenario: presentation[sourcePath], locale, propertyId: scalar(property.id), sourcePath });
    resultSections.push(...saved.sections);
    Object.assign(values, saved.values);
    diagnostics.push(...saved.diagnostics);
    for (const item of saved.evidencePacket) register(item.id, item.text, item.numericValues, [item.id]);
  }
  if (land && level > 1 && output.model === 'LAND_DEVELOPMENT_V2' && (activeScenario.confirmed === true || activeScenario.provenance === 'USER_PROVIDED')) {
    const assumptions = obj(activeScenario.assumptions), premiseRows: ReportRow[] = [];
    const addScenarioRow = (rows: ReportRow[], key: string, label: string, value: unknown, format: 'money' | 'sqft' | 'number' | 'text', source: string): void => {
      const n = number(value), safe = format === 'text' ? reportNarrativeString(value) : n !== null && n > 0 ? format === 'money' ? money(n, locale) : `${numeric(n, locale)}${format === 'sqft' ? ' sqft' : ''}` : '';
      if (!safe) return;
      const ref = register(`scenario:${key}`, `${label}: ${safe} · ${source}`, n === null ? [] : [n]);
      rows.push({ label, value: safe, source, evidenceRefs: [ref] });
    };
    const premiseSource = t('Premissa explícita do publicador; não é aprovação legal ou orçamento', 'Explicit publisher assumption; not legal approval or a quote', 'Supuesto explícito del publicador; no es aprobación legal ni presupuesto');
    addScenarioRow(premiseRows, 'units', t('Unidades propostas', 'Proposed units', 'Unidades propuestas'), output.proposedUnitCount, 'number', premiseSource);
    addScenarioRow(premiseRows, 'area', t('Área proposta por unidade', 'Proposed area per unit', 'Área propuesta por unidad'), output.proposedBuildingSqftPerUnit, 'sqft', premiseSource);
    addScenarioRow(premiseRows, 'type', t('Produto proposto', 'Proposed product', 'Producto propuesto'), output.proposedPropertyType, 'text', premiseSource);
    addScenarioRow(premiseRows, 'zoning', t('Zoneamento declarado', 'Declared zoning', 'Zonificación declarada'), assumptions.zoning, 'text', premiseSource);
    push({ id: 'landPremises', title: t('Premissas de desenvolvimento', 'Development assumptions', 'Supuestos de desarrollo'), kind: 'facts', priority: 70, rows: premiseRows, evidenceRefs: premiseRows.flatMap(row => row.evidenceRefs) });
    const benchmark = obj(output.benchmark), rates = obj(benchmark.rate), benchmarkRows: ReportRow[] = [];
    const benchmarkSource = t('Referência interna estimada de construção de 2026; não é orçamento de construtora', 'Internal estimated 2026 construction benchmark; not a contractor quote', 'Referencia interna estimada de construcción de 2026; no es presupuesto de constructor');
    if (scalar(output.developmentIntent) && output.developmentIntent !== 'NONE') {
      for (const [key, labels] of Object.entries({ low: ['Referência baixa por sqft', 'Low benchmark per sqft', 'Referencia baja por sqft'], average: ['Referência média por sqft', 'Average benchmark per sqft', 'Referencia media por sqft'], high: ['Referência alta por sqft', 'High benchmark per sqft', 'Referencia alta por sqft'] })) addScenarioRow(benchmarkRows, `benchmark-${key}`, t(labels[0], labels[1], labels[2]), rates[key], 'money', benchmarkSource);
      push({ id: 'landBenchmark', title: t('Referência de construção estimada', 'Estimated construction benchmark', 'Referencia estimada de construcción'), kind: 'facts', priority: 60, rows: benchmarkRows,
        ...(positive(rates.low) !== null && positive(rates.average) !== null && positive(rates.high) !== null && Number(rates.low) <= Number(rates.average) && Number(rates.average) <= Number(rates.high)
          ? { range: { low: money(Number(rates.low), locale), high: money(Number(rates.high), locale), estimate: money(Number(rates.average), locale), position: Number(rates.high) > Number(rates.low) ? (Number(rates.average) - Number(rates.low)) / (Number(rates.high) - Number(rates.low)) : .5 } } : {}), evidenceRefs: benchmarkRows.flatMap(row => row.evidenceRefs) });
    }
    const costs = list(output.costCoverage).map(obj), costLabels: Record<string, [string, string, string]> = {
      landAcquisition: ['Aquisição do terreno', 'Land acquisition', 'Adquisición del terreno'], construction: ['Construção', 'Construction', 'Construcción'], closingCosts: ['Custos de fechamento', 'Closing costs', 'Costos de cierre'],
      siteWorkCost: ['Preparação do terreno', 'Site work', 'Preparación del terreno'], utilityCost: ['Infraestrutura de serviços', 'Utility infrastructure', 'Infraestructura de servicios'], permitCost: ['Licenças', 'Permits', 'Permisos'],
      surveyCost: ['Levantamento topográfico', 'Survey', 'Levantamiento'], titleCost: ['Título', 'Title', 'Título'], engineeringCost: ['Engenharia', 'Engineering', 'Ingeniería'], architectureCost: ['Arquitetura', 'Architecture', 'Arquitectura'],
      softCosts: ['Custos indiretos', 'Soft costs', 'Costos indirectos'], financingCost: ['Financiamento', 'Financing', 'Financiación'], holdingCost: ['Manutenção durante o projeto', 'Project holding costs', 'Costos de tenencia del proyecto'], sellingCost: ['Custos de venda', 'Selling costs', 'Costos de venta'], contingency: ['Contingência', 'Contingency', 'Contingencia'],
    };
    const costRows: ReportRow[] = [];
    for (const cost of costs) { const key = scalar(cost.field), label = costLabels[key]; if (!label) { diagnostics.push(`UNMAPPED_SCENARIO_COST:${key}`); continue; }
      addScenarioRow(costRows, `cost-${key}`, t(...label), cost.value, 'money', cost.status === 'BENCHMARK_ESTIMATED' ? benchmarkSource : premiseSource); }
    const basis = positive(obj(output.knownDevelopmentBasis).central) || positive(output.preliminaryKnownDevelopmentBasis);
    if (basis !== null) addScenarioRow(costRows, 'known-basis', t('Base parcial de custos conhecidos', 'Partial known cost basis', 'Base parcial de costos conocidos'), basis, 'money', t('Cálculo existente com custos conhecidos; custos ausentes não são zero e isto não é lucro ou custo total confirmado', 'Existing calculation using known costs; missing costs are not zero and this is not profit or a confirmed total cost', 'Cálculo existente con costos conocidos; los costos ausentes no son cero y no es beneficio ni costo total confirmado'));
    push({ id: 'landKnownBasis', title: t('Custos conhecidos e premissas do projeto', 'Known project costs and assumptions', 'Costos conocidos y supuestos del proyecto'), kind: 'facts', priority: 55, rows: costRows, evidenceRefs: costRows.flatMap(row => row.evidenceRefs) });
    for (const [key, id, labels] of [['landAcquisitionReference', 'landAcquisition', ['Terrenos vendidos: aquisição', 'Sold land: acquisition', 'Terrenos vendidos: adquisición']], ['finishedHomeExitReference', 'landExit', ['Residenciais vendidos: saída proposta', 'Residential sales: proposed exit', 'Viviendas vendidas: salida propuesta']]] as const) {
      const reference = obj(output[key]), eligible = list(reference.valuationComps).map(obj).filter(comp => positive(comp.salePrice) !== null && reportNarrativeString(comp.address)).slice(0, 5);
      if (level < 3 || reference.status !== 'AVAILABLE' || eligible.length < 2 || key === 'finishedHomeExitReference' && !positive(output.proposedBuildingSqftPerUnit)) continue;
      const points: ReportMapPoint[] = [];
      if (finitePoint(property.latitude, property.longitude)) points.push({ id: 'subject', marker: 'S', latitude: Number(property.latitude), longitude: Number(property.longitude) });
      const rows = eligible.map((comp, index) => { const ref = register(`${id}:${index + 1}`, reportNarrativeString(comp.address), [Number(comp.salePrice)]);
        if (finitePoint(comp.latitude, comp.longitude)) points.push({ id: ref, marker: String(index + 1), latitude: Number(comp.latitude), longitude: Number(comp.longitude) });
        return [String(index + 1), reportNarrativeString(comp.address), money(Number(comp.salePrice), locale), reportNarrativeString(comp.saleDate) || unavailable, number(comp.distanceMiles) === null ? '—' : `${numeric(Number(comp.distanceMiles), locale)} mi`]; });
      push({ id, title: t(labels[0], labels[1], labels[2]), kind: 'comparables', priority: 85, table: { columns: ['#', t('Endereço', 'Address', 'Dirección'), t('Venda', 'Sale', 'Venta'), t('Data', 'Date', 'Fecha'), t('Distância', 'Distance', 'Distancia')], rows, evidenceRefs: eligible.map((_, index) => [`${id}:${index + 1}`]) }, map: { points, caption: t('Mesmas vendas na tabela e no diagrama; referências de terreno e de produto acabado são famílias distintas.', 'The table and diagram use the same sales; land and finished-product references are separate families.', 'La tabla y el diagrama usan las mismas ventas; terreno y producto terminado son familias distintas.') }, evidenceRefs: eligible.map((_, index) => `${id}:${index + 1}`) });
    }
    const nextLabels: Record<string, [string, string, string]> = { proposedUnitCount: ['Defina a quantidade de unidades proposta para dimensionar o projeto.', 'Specify the proposed unit count to size the project.', 'Defina las unidades propuestas para dimensionar el proyecto.'], proposedBuildingSqftPerUnit: ['Informe a área construída proposta por unidade para qualificar o custo de construção e as vendas de saída.', 'Supply proposed building area per unit to qualify construction cost and exit sales.', 'Informe el área construida propuesta por unidad para calificar el costo y las ventas de salida.'], proposedPropertyType: ['Defina o tipo do produto proposto para selecionar vendas de saída compatíveis.', 'Specify the proposed product type to select compatible exit sales.', 'Defina el tipo de producto propuesto para seleccionar ventas de salida compatibles.'], finishedHomeSoldEvidence: ['Confirme vendas registradas do produto proposto para sustentar a saída do desenvolvimento.', 'Confirm recorded sales of the proposed product to support the development exit.', 'Confirme ventas registradas del producto propuesto para sustentar la salida del desarrollo.'] };
    const next = nextLabels[scalar(output.nextInput)];
    if (next) addBlocker('land-development-input', t('O desenvolvimento permanece um cenário incompleto, não uma conclusão de viabilidade.', 'Development remains an incomplete scenario, not a feasibility conclusion.', 'El desarrollo sigue siendo un escenario incompleto, no una conclusión de viabilidad.'), t(...next), ['property:identity'], 75);
    blockers.sort((a, b) => b.priority - a.priority);
  }
  const propertyRows = (keys: string[]): ReportRow[] => keys.map(rowFor).filter((row): row is ReportRow => !!row);
  const physicalRows = propertyRows(land ? [] : ['beds', 'baths', 'sqft', 'yearBuilt', 'rehab', 'capRate']);
  if (!land && !known('capRate') && (physicalRows.length > 0 || rental)) physicalRows.push({ label: reportFieldLabel('capRate', locale)!, value: unavailable, source: t('Sem taxa com origem explícita ou NOI e base de valor suficientes.', 'No rate with explicit origin or sufficient NOI and value basis.', 'Sin tasa con origen explícito o NOI y base de valor suficientes.'), evidenceRefs: ['status:cap-rate'], state: 'UNAVAILABLE' });
  const parcelRows = propertyRows(['lotSizeSqft', 'lotSizeAcres', 'assessorId', 'zoning', 'county', 'subdivision', 'legalDescription']);
  for (const key of ['pricePerAcre', 'pricePerLotSqft']) if (values[key]) parcelRows.push({ label: key === 'pricePerAcre' ? t('Preço por acre', 'Price per acre', 'Precio por acre') : t('Preço por sqft de terreno', 'Price per parcel sqft', 'Precio por sqft de terreno'), value: values[key].text, source: values[key].source, evidenceRefs: values[key].evidenceRefs });
  const taxRows = propertyRows(['annualPropertyTax', 'propertyTaxYear', 'assessedValue', 'assessmentYear']);
  const owner = obj(property.owner), ownerRows: ReportRow[] = [];
  const ownerName = reportNarrativeString(owner.name);
  if (ownerName) ownerRows.push({ label: t('Publicador', 'Publisher', 'Publicador'), value: ownerName, evidenceRefs: ['property:identity'] });
  ownerRows.push(...propertyRows(['ownerOccupied', 'ownershipRecordPresent', 'latestSalePrice', 'latestSaleDate']));
  for (const item of list(owner.allowedContacts).map(obj)) { const contact = reportNarrativeString(item.value); if (contact) ownerRows.push({ label: /mail/i.test(scalar(item.type)) ? 'Email' : t('Contato autorizado', 'Authorized contact', 'Contacto autorizado'), value: contact, evidenceRefs: ['property:identity'] }); }
  const facts = (level === 1 ? [ { title: t('Publicador e contatos autorizados', 'Publisher and authorized contacts', 'Publicador y contactos autorizados'), rows: ownerRows }, { title: t('Dados do imóvel', 'Property facts', 'Datos del inmueble'), rows: physicalRows }, { title: t('Terreno e dados fiscais', 'Land and tax records', 'Terreno y datos fiscales'), rows: [...parcelRows, ...taxRows] } ] : [ { title: t('Dados do imóvel', 'Property facts', 'Datos del inmueble'), rows: physicalRows }, { title: t('Terreno e registro parcelário', 'Land and parcel record', 'Terreno y registro parcelario'), rows: parcelRows }, { title: t('Registros fiscais, não valor de mercado', 'Tax records, not market value', 'Registros fiscales, no valor de mercado'), rows: taxRows }, { title: t('Publicador e contatos autorizados', 'Publisher and authorized contacts', 'Publicador y contactos autorizados'), rows: ownerRows } ]).filter(group => group.rows.length);
  if (level > 1) for (const [index, group] of facts.entries()) push({ id: group.rows === taxRows ? 'property-tax' : group.rows === ownerRows ? 'property-contacts' : `property-facts-${index}`, title: group.title, kind: 'facts', priority: land ? 88 - index : 50 - index, rows: group.rows, evidenceRefs: group.rows.flatMap(row => row.evidenceRefs) });
  const metrics = propertyRows(land ? [] : ['beds', 'baths', 'sqft']);
  const disputed = Object.values(values).filter(value => value.state === 'CONFLICTED');
  if (disputed.length) {
    const text = t('Dado impreciso, pendente de confirmação com o publicador e/ou registros públicos do imóvel. O valor sinalizado não foi adotado nos cálculos.', 'Uncertain data awaiting confirmation with the publisher and/or public property records. Flagged values are not adopted in calculations.', 'Dato impreciso pendiente de confirmación con el publicador y/o registros públicos del inmueble. Los valores señalados no se adoptan en los cálculos.');
    const ref = register('notice:disputed-facts', text);
    push({ id: 'data-discrepancies', title: t('Considerações sobre os dados', 'Data considerations', 'Consideraciones sobre los datos'), kind: 'narrative', text, priority: 25,
      evidenceRefs: [ref, ...disputed.flatMap(value => value.evidenceRefs)] });
  }
  // Cache identity uses the original string; only the returned display string is
  // authorized. An unsafe source token must not hide an already-safe translation.
  const localNote = (source: unknown, localized: unknown): string => reportNarrativeString(localized) || reportNarrativeString(getCachedPresentationText(typeof source === 'string' ? source : '', locale)) || reportNarrativeString(source);
  const notes = [localNote(property.propertyUserNotes ?? property.notes, property.localizedPropertyUserNotes), localNote(property.description, property.localizedDescription),
    owner.notesPropertyId === property.id ? localNote(owner.notes, owner.localizedNotes) : ''].filter((v, i, arr) => v && arr.indexOf(v) === i);
  for (const [index, text] of notes.entries()) register(`notes:${index}`, text);
  const photos = getPreparedReportPhotos(input);
  const knownCount = Object.values(values).filter(value => ['VALUE', 'EXPLICIT_ZERO'].includes(value.state)).length;
  const publicCount = Object.values(values).filter(value => value.state === 'VALUE' && /RentCast|Registro público|Public record/i.test(value.source)).length;
  const conflictCount = Object.values(values).filter(value => value.state === 'CONFLICTED').length;
  const estimateCount = Number(rentAmount !== null) + Number(providerEstimate !== null);
  const coverage = [{ label: t('Dados utilizáveis', 'Usable facts', 'Datos utilizables'), value: numeric(knownCount, locale), evidenceRefs: ['property:identity'] }, { label: t('Registros públicos / do provedor', 'Public / provider records', 'Registros públicos / del proveedor'), value: numeric(publicCount, locale), evidenceRefs: ['property:identity'] }, { label: t('Estimativas', 'Estimates', 'Estimaciones'), value: numeric(estimateCount, locale), evidenceRefs: ['property:identity'] }];
  if (conflictCount) coverage.push({ label: t('Dados em conflito', 'Conflicted facts', 'Datos en conflicto'), value: numeric(conflictCount, locale), evidenceRefs: ['property:identity'] });
  const status = conflictCount || property.propertyTypeConflict === true ? t('Análise limitada por divergências', 'Analysis limited by conflicts', 'Análisis limitado por discrepancias') : publicCount >= 5 && marketKnown ? t('Evidência moderada disponível', 'Moderate evidence available', 'Evidencia moderada disponible') : t('Cobertura de evidências limitada', 'Limited evidence coverage', 'Cobertura de evidencia limitada');
  const priceText = known('price') ? values.price.text : t('preço não confirmado', 'price unconfirmed', 'precio no confirmado');
  const thesisText = t(`${identityAddress}: ${typeLabel.toLowerCase()} para ${strategyLabel.toLowerCase()}, com pedido de ${priceText}. ${marketKnown ? 'Há referências de mercado qualificadas, descritas abaixo, mas elas não estabelecem retorno.' : 'É possível descrever o imóvel, mas as evidências atuais não sustentam conclusões de valor ou retorno.'}`, `${identityAddress}: ${typeLabel.toLowerCase()} for ${strategyLabel.toLowerCase()}, asking ${priceText}. ${marketKnown ? 'Qualified market references are detailed below, but do not establish returns.' : 'The property can be described, but current evidence does not support valuation or return conclusions.'}`, `${identityAddress}: ${typeLabel.toLowerCase()} para ${strategyLabel.toLowerCase()}, con precio de ${priceText}. ${marketKnown ? 'Hay referencias de mercado detalladas abajo, pero no establecen rentabilidad.' : 'Se puede describir el inmueble, pero la evidencia actual no sustenta conclusiones de valor o rentabilidad.'}`);
  register('executive:thesis', thesisText);
  if (level > 1) {
    const suppliedRisks = obj(sections.riskAssessment).available === true ? list(obj(sections.riskAssessment).data) : [];
    const riskItems = suppliedRisks.map((risk, index) => {
      const text = reportNarrativeString(typeof risk === 'string' ? risk : obj(risk).explanation);
      return text ? claim(text, [register(`risk:supplied:${index}`, text)]) : null;
    }).filter((item): item is ReportClaim => item !== null);
    if (riskItems.length) push({ id: 'risk-considerations', title: t('Considerações de risco', 'Risk considerations', 'Consideraciones de riesgo'), kind: 'list', priority: 77, items: riskItems, evidenceRefs: riskItems.flatMap(item => item.evidenceRefs) });
    if (opportunities.length) push({ id: 'positive-signals', title: t('Sinais sustentados por evidências', 'Evidence-supported signals', 'Señales sustentadas por evidencia'), kind: 'list', priority: 80, items: opportunities, evidenceRefs: opportunities.flatMap(item => item.evidenceRefs) });
    if (blockers.length) push({ id: 'decision-blockers', title: t('Incertezas que limitam a decisão', 'Uncertainties limiting the decision', 'Incertidumbres que limitan la decisión'), kind: 'list', priority: 78, items: blockers.slice(0, 5).map(item => claim(item.impact, item.refs)), evidenceRefs: blockers.slice(0, 5).flatMap(item => item.refs) });
    const actions = blockers.slice(0, 3).map(item => {
      const unlocks: Record<string, string> = {
        'physical-facts': t('Indicadores por área e seleção de comparáveis coerentes com o dado escolhido.', 'Area metrics and comparable selection consistent with the chosen fact.', 'Indicadores por área y selección de comparables coherentes con el dato elegido.'),
        'parcel-area': t('Indicadores de área do lote e preço por acre.', 'Parcel area and price-per-acre metrics.', 'Indicadores de área de parcela y precio por acre.'),
        'condition': t('Comparação com a condição-alvo e avaliação do escopo da reforma.', 'Target-condition comparison and rehabilitation scope review.', 'Comparación de condición objetivo y alcance de reforma.'),
        'market-support': t('Verificação da elegibilidade dos SOLDs para ARV; não garante que haverá uma faixa calculável.', 'Verification of SOLD eligibility for ARV; a calculable range is not guaranteed.', 'Verificación de elegibilidad SOLD para ARV; no garantiza un rango calculable.'),
      };
      const shortActions: Record<string, [string, string]> = {
        'physical-facts': [t('Revisar quartos, banheiros e área com o publicador.', 'Review beds, baths and area with the publisher.', 'Revisar habitaciones, baños y área con el publicador.'), t('Cadastro e registro externo divergem.', 'Listing and external record disagree.', 'Registro y fuente externa discrepan.')],
        'parcel-area': [t('Revisar a área do lote.', 'Review parcel area.', 'Revisar área de parcela.'), t('Há medidas de terreno divergentes.', 'Parcel measurements disagree.', 'Hay medidas de terreno discrepantes.')],
        'market-support': [t('Validar os SOLDs e sua condição comparável.', 'Validate SOLDs and comparable condition.', 'Validar SOLD y condición comparable.'), t('Vendas identificadas ainda não sustentam ARV.', 'Identified sales do not yet support ARV.', 'Ventas identificadas aún no sustentan ARV.')],
        'condition': [t('Confirmar condição atual e escopo da reforma.', 'Confirm current condition and rehabilitation scope.', 'Confirmar condición actual y alcance de reforma.'), t('Orçamento não comprova condição física.', 'Budget does not establish physical condition.', 'Presupuesto no demuestra condición física.')],
      };
      const [action, reason] = shortActions[item.id] || [item.action, item.impact];
      const text = `${action}\n${t('Motivo', 'Reason', 'Motivo')}: ${reason}${unlocks[item.id] ? `\n${t('Desbloqueia', 'Unlocks', 'Habilita')}: ${unlocks[item.id]}` : ''}`;
      const ref = register(`action-detail:${item.id}`, text);
      return claim(text, [ref, ...item.refs.filter(ref => !ref.startsWith('blocker:'))]);
    });
    if (!actions.length && obj(sections.verificationChecklist).available === true) {
      for (const [index, value] of list(obj(sections.verificationChecklist).data).entries()) {
        const text = reportNarrativeString(value);
        if (text) actions.push(claim(text, [register(`action:supplied:${index}`, text)]));
      }
    }
    if (actions.length) push({ id: 'next-actions', title: t('Próximas verificações prioritárias', 'Prioritized next checks', 'Próximas verificaciones prioritarias'), kind: 'list', priority: 40, items: actions, evidenceRefs: actions.flatMap(item => item.evidenceRefs) });
    const profile = section('investmentProfile'), basis = obj(profile.sourceProfile);
    const profileVerified = profile.profileSource === 'AUTHENTICATED_CURRENT_PROFILE' && Object.keys(basis).length > 0;
    const profileScore = profileVerified ? number(profile.score) : null;
    if (!profileVerified) {
      const text = t('Perfil de investimento não configurado ou indisponível.', 'Investment Profile not configured or unavailable.', 'Perfil de inversión no configurado o no disponible.');
      const ref = register('profile:unavailable', text);
      push({ id: 'investor-profile', title: t('Perfil do investidor', 'Investor profile', 'Perfil del inversor'), kind: 'narrative', text, priority: 36, evidenceRefs: [ref] });
    }
    if (profileVerified) {
      const profileRows: ReportRow[] = [];
      for (const [key, label] of [['targetMarkets', t('Mercados alvo', 'Target markets', 'Mercados objetivo')], ['priceRange', t('Faixa de preço', 'Price range', 'Rango de precio')], ['propertyTypes', t('Tipos de imóvel', 'Property types', 'Tipos de inmueble')], ['strategies', t('Estratégias', 'Strategies', 'Estrategias')]]) {
        let value = Array.isArray(basis[key]) ? list(basis[key]).map(reportNarrativeString).filter(Boolean).join(', ') : reportNarrativeString(basis[key]);
        if (key === 'priceRange' && value) value = value === 'lt_100k' ? t('Abaixo de US$ 100 mil', 'Below $100K', 'Menos de US$ 100 mil') : INVESTMENT_PRICE_RANGE_OPTIONS.find(option => option.value === value)?.label || unavailable;
        if (value) { const ref = register(`profile:basis:${key}`, value); profileRows.push({ label, value, evidenceRefs: [ref] }); }
      }
      if (profileRows.length) push({ id: 'investor-profile', title: t('Perfil atual do investidor', 'Current investor profile', 'Perfil actual del inversor'), kind: 'facts', rows: profileRows, priority: 36, text: t('Fonte: perfil do usuário autenticado, obtido na preparação desta análise.', 'Source: authenticated user profile read while preparing this analysis.', 'Fuente: perfil del usuario autenticado leído al preparar este análisis.'), evidenceRefs: profileRows.flatMap(row => row.evidenceRefs) });
    }
    if (profileScore !== null && profileScore >= 0 && profileScore <= 100) { const ref = register('profile:compatibility', numeric(profileScore, locale), [profileScore]);
      push({ id: 'profile-fit', title: t('Compatibilidade com o perfil', 'Profile compatibility', 'Compatibilidad con el perfil'), kind: 'facts', priority: 35, rows: [{ label: t('Match Score', 'Match Score', 'Match Score'), value: `${numeric(profileScore, locale)}%`, source: t('Compatibilidade com o perfil; não é qualidade do negócio, probabilidade de sucesso ou confiança da análise.', 'Profile compatibility; not deal quality, probability of success or analysis confidence.', 'Compatibilidad con el perfil; no es calidad del negocio, probabilidad de éxito ni confianza del análisis.'), evidenceRefs: [ref] }], evidenceRefs: [ref] }); }
  }
  if (level > 1) {
    const profile = section('investmentProfile'), fit = resultSections.find(s => s.id === 'profile-fit');
    if (fit && number(profile.score) !== null) fit.gauge = { value: Number(profile.score), label: 'Match Score' };
    const labels: Record<string, string> = {
      market: t('Mercado alvo', 'Target market', 'Mercado objetivo'), price: t('Faixa de preço', 'Price range', 'Rango de precio'),
      property_type: t('Tipo de imóvel', 'Property type', 'Tipo de inmueble'), strategy: t('Estratégia', 'Strategy', 'Estrategia'),
    };
    const rows: ReportRow[] = [], comparison: NonNullable<ReportSection['comparison']> = [];
    for (const item of (fit ? list(profile.criteria) : []).map(obj)) {
      const label = labels[scalar(item.key)]; if (!label) continue;
      const score = number(item.score);
      if (score === null) continue;
      const explanation = locale === 'en' ? reportNarrativeString(item.explanation) : item.status === 'matched' ? t('Critério atendido pelo motor de compatibilidade.', 'Criterion matched by the compatibility engine.', 'Criterio cumplido por el motor de compatibilidad.') : item.status === 'not_matched' ? t('Critério não atendido pelo motor de compatibilidade.', 'Criterion not matched by the compatibility engine.', 'Criterio no cumplido por el motor de compatibilidad.') : t('Critério não avaliado.', 'Criterion not evaluated.', 'Criterio no evaluado.');
      const value = score !== null && score >= 0 && score <= 100 ? `${numeric(score, locale)}%` : unavailable;
      const ref = register(`profile:criterion:${scalar(item.key)}`, `${label}: ${value}${explanation ? ` · ${explanation}` : ''}`, score === null ? [] : [score]);
      rows.push({ label, value, ...(explanation ? { source: explanation } : {}), evidenceRefs: [ref] });
      if (score !== null && score >= 0 && score <= 100) comparison.push({ label, value: score, text: value });
    }
    if (rows.length) push({ id: 'profile-criteria', title: t('Fit por critério', 'Fit by criterion', 'Compatibilidad por criterio'), kind: 'facts', priority: 34,
      rows, comparison, evidenceRefs: rows.flatMap(row => row.evidenceRefs) });
  }
  if (level >= 2 && !land && rentAmount === null) {
    const rentState = obj(presentation.marketRentState), state = scalar(rentState.state);
    const reviewLabels: Record<string, string> = { propertyType: reportFieldLabel('type', locale) || t('Tipo de imóvel', 'Property type', 'Tipo de inmueble'), beds: reportFieldLabel('beds', locale)!, baths: reportFieldLabel('baths', locale)!, buildingArea: reportFieldLabel('sqft', locale)! };
    const failureReason: Record<string, string> = {
      RENT_CACHE_READ_FAILED: t('Falha na leitura do cache de aluguel; não é divergência física do imóvel.', 'Rent cache read failed; this is not a physical-property disagreement.', 'Falló la lectura de caché de alquiler; no es discrepancia física.'),
      RENT_ENTITLEMENT_CHECK_FAILED: t('Não foi possível verificar a autorização de consulta do aluguel.', 'Rent query authorization could not be checked.', 'No se pudo verificar la autorización de consulta.'),
      RENT_EXECUTION_FAILED: t('Falha na preparação ou execução da consulta; o erro anterior não registrou a etapa exata. Não há resultado de aluguel validado.', 'Rent preparation or execution failed; the previous error did not retain the exact stage. No validated rent result is available.', 'Falló la preparación o ejecución; el error anterior no retuvo la etapa exacta. Sin resultado validado.'),
    };
    const legacyText = state === 'RENT_AVM_REVIEW_REQUIRED'
      ? t(`Aluguel pendente de revisão: ${reviewLabels[scalar(rentState.reviewField)] || 'atributo físico não identificado'}. Confirme esse campo com o publicador.`, `Rent pending review: ${reviewLabels[scalar(rentState.reviewField)] || 'unidentified physical attribute'}. Confirm this field with the publisher.`, `Alquiler pendiente de revisión: ${reviewLabels[scalar(rentState.reviewField)] || 'atributo físico no identificado'}. Confirme este campo con el publicador.`)
      : failureReason[scalar(rentState.reason)] || (state === 'SUBJECT_UNAVAILABLE' ? t('A preparação anterior não conseguiu carregar o estado autorizado do imóvel. A causa técnica não foi retida; isso não comprova ausência de aluguel no provedor.', 'The previous preparation could not load the authorized property state. The technical cause was not retained; this does not establish an absence of provider rent data.', 'La preparación anterior no cargó el estado autorizado. No se conservó la causa técnica; no prueba ausencia de datos de alquiler.')
      : state && state !== 'NOT_QUERIED'
        ? marketRentStateAnswer({ state: state as MarketRentResult['state'], propertyId: '', providerCalls: 0 }, locale)
        : t('Aluguel ainda não consultado neste relatório. Gere uma análise atualizada para consultar o provedor e reutilizar o resultado.', 'Rent has not yet been queried in this report. Generate an updated analysis to query the provider and reuse the result.', 'Alquiler aún no consultado en este informe. Genere un análisis actualizado para consultar el proveedor y reutilizar el resultado.'));
    const text = marketRentStateAnswer({ ...rentState, state: (state || 'NOT_QUERIED') as MarketRentResult['state'], propertyId: scalar(property.id), providerCalls: number(rentState.providerCalls) ?? undefined } as MarketRentResult, locale) || legacyText;
    const ref = register('market:rent-pending', text);
    push({ id: 'rent-pending', title: marketRentReportCopy(locale).title, kind: 'narrative', text, priority: 60, evidenceRefs: [ref] });
  }
  if (level === 3) {
    const gap = (id: string, title: string, text: string, action: string) => {
      const ref = register(`gap:${id}`, text), next = register(`gap-action:${id}`, action);
      push({ id, title, kind: 'facts', priority: 30, status: 'blocked',
        rows: [{ label: t('Limitação e impacto', 'Limitation and impact', 'Limitación e impacto'), value: text, evidenceRefs: [ref] },
          { label: t('Próxima verificação', 'Next verification', 'Próxima verificación'), value: action, evidenceRefs: [next] }], evidenceRefs: [ref, next] });
    };
    if (!usableArv && !land && !rental) gap('value-readiness', 'ARV',
      soldSummary ? `${soldSummary} ${[...new Set(reportedSales.filter(item => item.role !== 'PRIMARY').map(soldReason))].join(' ')}` : t('Nenhuma venda registrada utilizável foi projetada neste relatório; a condição-alvo também precisa de confirmação.', 'No usable recorded sale was projected into this report; target condition also requires confirmation.', 'No se proyectó ninguna venta registrada utilizable; la condición objetivo también requiere confirmación.'),
      t('Validar vendas fechadas e condição antes de concluir valor de revenda.', 'Validate closed sales and condition before concluding resale value.', 'Validar ventas cerradas y condición antes de concluir valor de reventa.'));
    if (!usableArv && !land && !rental) gap('price-positioning', t('Posicionamento do preço e vendas recentes', 'Price positioning and recent sales', 'Posicionamiento del precio y ventas recientes'),
      t(`${values.price.text} é o pedido informado. Sem vendas fechadas qualificadas, não é possível afirmar desconto, sobrepreço ou liquidez.`, `${values.price.text} is the reported asking price. Without qualified closed sales, discount, overpricing or liquidity cannot be established.`, `${values.price.text} es el precio solicitado. Sin ventas cerradas calificadas no se puede afirmar descuento, sobreprecio ni liquidez.`),
      t('Comparar data, localização, área, tipo e condição de cada venda; anúncios não comprovam preço fechado.', 'Compare sale date, location, size, type and condition; listings do not establish closed-sale prices.', 'Comparar fecha, ubicación, área, tipo y condición; anuncios no prueban precios de cierre.'));
    if (rental && rentAmount === null) gap('rent-readiness', marketRentReportCopy(locale).title,
      t('Não há estimativa utilizável neste relatório; isso não demonstra ausência de dados no mercado.', 'This report has no usable estimate; this does not establish that market data is absent.', 'Este informe no tiene estimación utilizable; no demuestra ausencia de datos en el mercado.'),
      t('Consultar aluguel de mercado pelo fluxo autorizado e confirmar o contrato separadamente.', 'Check market rent through the authorized workflow and confirm the lease separately.', 'Consultar alquiler de mercado por el flujo autorizado y confirmar el contrato por separado.'));
    if (!land) gap('condition-readiness', t('Condição e reforma', 'Condition and rehabilitation', 'Condición y reforma'),
      known('rehab') ? t(`Reforma informada: ${values.rehab.text}. O valor não comprova escopo ou condição.`, `Reported rehabilitation: ${values.rehab.text}. The amount does not establish scope or condition.`, `Reforma informada: ${values.rehab.text}. El importe no demuestra alcance ni condición.`)
        : t('Escopo e custo de reforma não confirmados; não se presume custo zero.', 'Rehabilitation scope and cost are unconfirmed; zero cost is not presumed.', 'Alcance y costo de reforma no confirmados; no se presume costo cero.'),
      t('Conferir inspeção, escopo e orçamento para testar a estratégia.', 'Review inspection, scope and quote to test the strategy.', 'Revisar inspección, alcance y presupuesto para evaluar la estrategia.'));
    if (!land && !rental && known('price')) {
      const keys = ['price', 'rehab'].filter(known);
      push({ id: 'strategy-cost-basis', title: t('Base informada da estratégia', 'Reported strategy basis', 'Base informada de la estrategia'), kind: 'facts', priority: 30,
        comparison: keys.map(key => ({ label: reportFieldLabel(key, locale)!, value: values[key].numericValue!, text: values[key].text })),
        rows: keys.map(rowFor).filter((row): row is ReportRow => !!row),
        text: t('Valores informados, não um cálculo de lucro. Fechamento, prazo, financiamento e custos de venda precisam de confirmação antes de estimar margem.', 'Reported amounts, not a profit calculation. Closing, timeline, financing and selling costs require confirmation before estimating margin.', 'Importes informados, no un cálculo de beneficio. Cierre, plazo, financiación y costos de venta requieren confirmación antes de estimar margen.'),
        evidenceRefs: keys.flatMap(key => values[key].evidenceRefs) });
    }
    if (land) {
      const area = list(canonical.conflicts).map(obj).find(c => c.field === 'lotSizeSqft');
      if (area && positive(area.appValue) !== null && positive(area.providerValue) !== null) {
        const ref = register('area:comparison', t('Áreas divergentes; nenhuma selecionada automaticamente.', 'Conflicting areas; neither selected automatically.', 'Áreas discrepantes; ninguna seleccionada automáticamente.'), [Number(area.appValue), Number(area.providerValue)]);
        push({ id: 'parcel-area-comparison', title: t('Divergência de área do lote', 'Parcel area disagreement', 'Discrepancia del área del lote'), kind: 'facts', priority: 80, status: 'blocked',
          comparison: [{ label: t('Cadastro informado', 'Declared record', 'Registro declarado'), value: Number(area.appValue), text: `${numeric(Number(area.appValue), locale)} sqft` },
            { label: t('Registro externo', 'External record', 'Registro externo'), value: Number(area.providerValue), text: `${numeric(Number(area.providerValue), locale)} sqft` }],
          text: t('Comparação das áreas registradas, sem arbitragem automática. Preço por acre permanece bloqueado até resolver a divergência.', 'Recorded area comparison without automatic arbitration. Price per acre remains blocked until the disagreement is resolved.', 'Comparación de áreas sin arbitraje automático. El precio por acre sigue bloqueado hasta resolver la discrepancia.'), evidenceRefs: [ref] });
      }
      gap('land-market-readiness', t('Mercado de terrenos e preço por acre', 'Land market and price per acre', 'Mercado de terrenos y precio por acre'),
        areaConflict ? t('Áreas divergentes bloqueiam a comparação de preço por acre.', 'Conflicting areas block price-per-acre comparison.', 'Áreas discrepantes bloquean la comparación de precio por acre.')
          : t('Vendas de terrenos comparáveis precisam sustentar o posicionamento do preço.', 'Comparable land sales must support price positioning.', 'Ventas de terrenos comparables deben sustentar el posicionamiento del precio.'),
        t('Validar área parcelária e vendas de terrenos com uso e infraestrutura comparáveis.', 'Validate parcel area and land sales with comparable use and infrastructure.', 'Validar área parcelaria y ventas con uso e infraestructura comparables.'));
      if (!resultSections.some(s => s.id === 'landPremises')) gap('land-development-readiness', t('Desenvolvimento e construção', 'Development and construction', 'Desarrollo y construcción'),
        t('Sem programa construtivo confirmado, não há base para estimar custo total ou viabilidade.', 'Without a confirmed building program, total cost and feasibility cannot be established.', 'Sin programa constructivo confirmado, no se puede establecer costo total ni viabilidad.'),
        t('Confirmar uso permitido, unidades, área, infraestrutura e orçamento local.', 'Confirm permitted use, units, area, infrastructure and local costs.', 'Confirmar uso permitido, unidades, área, infraestructura y costos locales.'));
      if (!resultSections.some(s => s.id === 'landBenchmark')) gap('land-benchmark-readiness', t('Referência de construção e orçamento', 'Construction benchmark and budget', 'Referencia de construcción y presupuesto'),
        t('Sem tipologia e área propostas, uma referência por sqft não define custo de construção. Terreno, infraestrutura e custos indiretos também precisam de base própria.', 'Without proposed type and area, a per-sqft benchmark does not establish construction cost. Land, infrastructure and soft costs also need their own basis.', 'Sin tipología y área propuestas, una referencia por sqft no establece costo de construcción. Terreno, infraestructura y costos indirectos necesitan su propia base.'),
        t('Definir o programa e obter orçamento local, incluindo preparação do terreno, licenças e contingência.', 'Define the program and obtain local costs including site work, permits and contingency.', 'Definir el programa y obtener costos locales con preparación del terreno, permisos y contingencia.'));
    }
    if (rental) gap('financial-readiness', t('Prontidão financeira', 'Financial readiness', 'Preparación financiera'),
      t('NOI e retorno exigem renda qualificada e custos operacionais completos. Estimativa de aluguel não é renda atual.', 'NOI and returns require qualified income and complete operating costs. Estimated rent is not current income.', 'NOI y rentabilidad requieren ingresos calificados y gastos completos. Alquiler estimado no es ingreso actual.'),
      blockers.find(b => b.id === 'current-rent' || b.id.startsWith('expense-'))?.action || t('Conferir a base de renda e despesas antes do cálculo.', 'Review income and expense basis before calculation.', 'Revisar ingresos y gastos antes del cálculo.'));
    const readiness = scalar(obj(obj(obj(presentation.financialReadiness).metrics).NOI).readinessLevel);
    const readinessSection = resultSections.find(s => s.id === 'financial-readiness');
    if (readinessSection && readiness.startsWith('READY_')) readinessSection.status = 'available';
    const fit = resultSections.find(s => s.id === 'profile-fit');
    if (!opportunities.length) {
      const text = t('Os dados atuais não comprovam desconto, margem ou retorno. Preço e atributos informados são pontos de partida, não sinais confirmados de oportunidade.', 'Current data does not establish discount, margin or return. Reported price and attributes are starting points, not confirmed opportunity signals.', 'Los datos actuales no prueban descuento, margen ni rentabilidad. Precio y atributos son puntos de partida, no señales confirmadas de oportunidad.');
      const ref = register('opportunity:insufficient', text);
      push({ id: 'opportunity-readiness', title: t('Cobertura dos sinais', 'Signal coverage', 'Cobertura de señales'), kind: 'narrative', text, priority: 30, evidenceRefs: [ref] });
    }
    const score = number(section('investmentProfile').score);
    if (fit && score !== null) fit.gauge = { value: score, label: 'Match Score' };
    if (!fit) gap('profile-readiness', t('Compatibilidade com o perfil', 'Profile compatibility', 'Compatibilidad con el perfil'),
      t('Perfil ou pontuação não disponível; compatibilidade não pode ser inferida.', 'Profile or score unavailable; compatibility cannot be inferred.', 'Perfil o puntuación no disponible; no se puede inferir compatibilidad.'),
      t('Confirmar os critérios do investidor para avaliar compatibilidade.', 'Confirm investor criteria to evaluate compatibility.', 'Confirmar criterios del inversor para evaluar compatibilidad.'));
  }
  if (level === 3 && !land) {
    const delivery = presentation.soldDelivery ? obj(presentation.soldDelivery) : projectSoldDelivery();
    const deliveryText = soldDeliveryAnswer(delivery as ReturnType<typeof projectSoldDelivery>, locale);
    const deliveryRef = register('market:sold-delivery', deliveryText);
    push({ id: 'sold-delivery', title: t('Busca SOLD e elegibilidade para ARV', 'SOLD search and ARV eligibility', 'Búsqueda SOLD y elegibilidad ARV'), kind: 'narrative', text: deliveryText, priority: 88, evidenceRefs: [deliveryRef] });
    const sold = resultSections.find(s => s.id === 'arv-market' || s.id === 'sold-reference');
    const advertised = resultSections.find(s => s.id === 'provider-listing-references');
    const primary = sold?.table?.rows || [], forSale = advertised?.table?.rows || [];
    if (primary.length || forSale.length) {
      const rows: string[][] = [], refs: string[][] = [], points: ReportMapPoint[] = [];
      if (finitePoint(property.latitude, property.longitude)) points.push({ id: 'subject', marker: 'S', latitude: Number(property.latitude), longitude: Number(property.longitude) });
      const seen = new Set<string>(), allSold = rankReportComparables([...list(comps.used), ...list(comps.supporting)].map(obj));
      const add = (row: string[], evidenceRefs: string[], point: ReportMapPoint | undefined, status: string, tone: string, similarity: unknown) => {
        if (seen.has(row[1])) return; seen.add(row[1]);
        const n = rows.length + 1, score = number(similarity);
        rows.push([String(n), ...row.slice(1), status, score === null ? '—' : `${numeric(score <= 1 ? score * 100 : score, locale, 1)}%`]); refs.push(evidenceRefs);
        if (point) points.push({ ...point, marker: String(n), markerTone: tone });
      };
      primary.forEach((row, i) => {
        const record = allSold.find(item => reportNarrativeString(item.address) === row[1]);
        add(row, sold!.table!.evidenceRefs[i], sold!.map?.points.find(point => point.marker === row[0]), 'SOLD', 'sold', record?.similarity ?? record?.providerCorrelation);
      });
      const complementary = allSold.filter(item => !seen.has(reportNarrativeString(item.address)) && positive(item.salePrice) !== null && scalar(item.saleDate) && !Number.isNaN(new Date(scalar(item.saleDate)).getTime())).slice(0, 3);
      complementary.forEach((item, i) => {
        const address = reportNarrativeString(item.address) || unavailable, ref = register(`sold-complementary:${i + 1}`, address, [Number(item.salePrice)], [scalar(item.compIdentifier)].filter(Boolean));
        const point = finitePoint(item.latitude, item.longitude) ? { id: ref, marker: '', latitude: Number(item.latitude), longitude: Number(item.longitude) } : undefined;
        add(['', address, money(Number(item.salePrice), locale), formatReportDate(item.saleDate, locale), number(item.distanceMiles) === null ? '—' : `${numeric(Number(item.distanceMiles), locale, 2)} mi`], [ref], point,
          `SOLD · ${t('Complementar', 'Complementary', 'Complementario')}`, 'complementary', item.similarity ?? item.providerCorrelation);
      });
      const advertisedData = projectProviderListingReferences(valuation.providerListingReferences);
      forSale.forEach((row, i) => add(row, advertised!.table!.evidenceRefs[i], advertised!.map?.points.find(point => point.marker === row[0]), 'FOR SALE', 'for-sale', advertisedData[i]?.providerCorrelation));
      const caption = t('Amarelo: SOLD. Vermelho: FOR SALE. Roxo: complementares. Até 5 principais por grupo e 3 SOLDs complementares, ordenados por similaridade disponível. Anúncios não comprovam vendas nem entram no ARV.', 'Yellow: SOLD. Red: FOR SALE. Purple: complementary. Up to 5 main references per group and 3 complementary SOLDs, ordered by available similarity. Listings do not prove sales or enter ARV.', 'Amarillo: SOLD. Rojo: FOR SALE. Morado: complementarios. Hasta 5 principales por grupo y 3 SOLD complementarios, según similitud disponible. Anuncios no prueban ventas ni entran en ARV.');
      push({ id: 'sales-comparables', title: t('Comparáveis de venda: SOLD e FOR SALE', 'Sales comparables: SOLD and FOR SALE', 'Comparables de venta: SOLD y FOR SALE'), kind: 'comparables', priority: 90,
        table: { columns: ['#', t('Endereço', 'Address', 'Dirección'), t('Preço', 'Price', 'Precio'), t('Data', 'Date', 'Fecha'), t('Distância', 'Distance', 'Distancia'), 'Status', t('Similaridade', 'Similarity', 'Similitud')], rows, evidenceRefs: refs },
        map: { points, caption: `${caption} ${t('FOR SALE identifica preço de anúncio, inclusive histórico/inativo; não significa oferta ativa hoje.', 'FOR SALE identifies a listing price, including historical/inactive listings; it does not mean the offer is active today.', 'FOR SALE identifica un precio anunciado, incluso histórico/inactivo; no significa una oferta activa hoy.')}` }, evidenceRefs: refs.flat() });
      for (const original of [sold, advertised]) if (original?.table) {
        delete original.table; delete original.map;
        if (!original.text && !original.hero && !original.rows?.length) resultSections.splice(resultSections.indexOf(original), 1);
      }
    }
  }
  if (notes.length && level > 1) push({ id: 'publisher-notes', title: t('Notas e descrição do publicador', 'Publisher notes and description', 'Notas y descripción del publicador'), kind: 'notes', items: notes.map((text, index) => claim(text, [`notes:${index}`])), priority: 10, evidenceRefs: notes.map((_, index) => `notes:${index}`) });
  for (const [key, value] of Object.entries(values)) {
    if (['UNAVAILABLE', 'NOT_APPLICABLE', 'CONFLICTED'].includes(value.state) && !value.absenceReason) {
      value.absenceReason = value.state === 'NOT_APPLICABLE' ? 'NOT_REQUESTED'
        : ['noi', 'capRate', 'roi', 'cashFlow', 'arv'].includes(key) ? 'USER_INPUT_REQUIRED' : 'PROVIDER_ERROR';
      if (!value.source) value.source = evidenceAbsenceCopy(value.absenceReason, locale);
    }
    indicatorReasons[key] = value.absenceReason || null;
  }
  const rentState = obj(presentation.marketRentState);
  indicatorReasons.marketRent = level === 1 || land ? 'NOT_REQUESTED' : rentAmount !== null ? null
    : evidenceAbsenceReason(rentState.absenceReason || rentState.reason || rentState.state, 'PROVIDER_ERROR');
  indicatorReasons.arv = level < 3 || land ? 'NOT_REQUESTED' : usableArv ? null
    : indicatorReasons.recordedSales || (selectedSold.length < ARV_ELIGIBILITY_POLICY.minimumPreliminarySales ? 'NO_COVERAGE' : 'USER_INPUT_REQUIRED');
  const savedRows = resultSections.find(section => section.id === 'saved-scenario-results')?.rows || [];
  indicatorReasons.roi = level === 1 ? 'NOT_REQUESTED'
    : savedRows.some(row => /\bROI\b/i.test(row.label) && row.value !== unavailable && row.value !== '—') ? null : 'USER_INPUT_REQUIRED';
  indicatorReasons.landInformation = ['assessorId', 'zoning', 'county', 'legalDescription', 'lotSizeSqft'].some(known)
    ? null : indicatorReasons.propertyRecord || 'NO_COVERAGE';
  const hasComparableMap = resultSections.some(section => section.map && section.map.points.filter(point => point.id !== 'subject').length > 0);
  indicatorReasons.comparablesMap = level < 3 ? 'NOT_REQUESTED' : hasComparableMap ? null
    : selectedSold.length ? 'USER_INPUT_REQUIRED' : indicatorReasons.recordedSales || 'NO_COVERAGE';
  for (const section of resultSections) {
    if (section.status !== 'blocked' && section.id !== 'rent-pending') continue;
    const reason = /rent/.test(section.id) ? indicatorReasons.marketRent
      : /value-readiness|price-positioning|land-market/.test(section.id) ? indicatorReasons.arv || indicatorReasons.recordedSales
      : 'USER_INPUT_REQUIRED';
    section.absenceReason = reason || 'USER_INPUT_REQUIRED';
    // Existing financial/input explanations remain specific. External acquisition
    // blockers must be shown instead of suggesting that all gaps are user inputs.
    if (/value-readiness|price-positioning|land-market/.test(section.id) && section.absenceReason !== 'USER_INPUT_REQUIRED') {
      const copy = evidenceAbsenceCopy(section.absenceReason, locale), ref = register(`absence:${section.id}`, copy);
      if (section.rows?.[0]) { section.rows[0].source = copy; section.rows[0].evidenceRefs.push(ref); }
      section.evidenceRefs.push(ref);
    }
  }
  const familyLabels: Record<string, string> = {
    propertyRecord: t('Dados cadastrais do imóvel', 'Property records', 'Datos catastrales del inmueble'),
    valuation: t('Estimativa de valor', 'Value estimate', 'Estimación de valor'),
    recordedSales: t('Vendas registradas', 'Recorded sales', 'Ventas registradas'),
  };
  const absenceItems = Object.entries(upstreamReasons).filter(([key, reason]) => familyLabels[key] && reason !== null)
    .filter(([key]) => level > 1 || key === 'propertyRecord').map(([key]) => {
      const text = `${familyLabels[key]}: ${evidenceAbsenceCopy(indicatorReasons[key] || 'PROVIDER_ERROR', locale)}`;
      return claim(text, [register(`availability:${key}`, text)]);
    });
  if (absenceItems.length) push({ id: 'evidence-availability', title: t('Disponibilidade das informações', 'Information availability', 'Disponibilidad de la información'),
    kind: 'list', priority: 65, items: absenceItems, evidenceRefs: absenceItems.flatMap(item => item.evidenceRefs) });
  resultSections.sort((a, b) => b.priority - a.priority);
  const model: ReportViewModel = { type: 'strict_report_view_model', version: 'REPORT_PROJECTION_V3', reportType, locale,
    header: { product: level === 1 ? t('RELATÓRIO DO IMÓVEL', 'PROPERTY RELEASE', 'INFORME DE LA PROPIEDAD') : level === 2 ? t('RELATÓRIO DE ANÁLISE MAXXIS', 'MAXXIS ANALYSIS REPORT', 'INFORME DE ANÁLISIS MAXXIS') : t('INTELIGÊNCIA DO NEGÓCIO MAXXIS', 'MAXXIS DEAL INTELLIGENCE REPORT', 'INTELIGENCIA DEL NEGOCIO MAXXIS'), subtitle: t('Dados reais. Decisões mais inteligentes.', 'Real Data. Smarter Decisions.', 'Datos reales. Decisiones más inteligentes.'), plan: `L${level}`, tagline: 'DealSifter Match' },
    property: { title: reportNarrativeString(property.title) || identityAddress, address: identityAddress, location, price: values.price.text, type: typeLabel, strategy: strategyLabel, metrics, facts, notes, photos,
      locationPoint: finitePoint(property.latitude, property.longitude) ? { id: 'subject', marker: 'S', latitude: Number(property.latitude), longitude: Number(property.longitude) } : null },
    executive: level === 1 ? null : { thesis: claim(thesisText, ['executive:thesis', 'property:identity', ...values.price.evidenceRefs]), status, coverage,
      opportunity: opportunities[0] || null, risk: blockers[0] ? claim(blockers[0].impact, blockers[0].refs) : null, blocker: blockers[0] ? claim(blockers[0].action, [`action:${blockers[0].id}`]) : null },
    sections: resultSections, values, indicatorReasons, diagnostics, evidencePacket: packet,
    disclaimer: t('Este relatório apoia decisões com as evidências disponíveis. Não é avaliação imobiliária, aconselhamento financeiro ou recomendação de compra ou venda. Registros GIS não substituem levantamento topográfico; zoneamento declarado não comprova aprovação legal.', 'This report supports decisions using available evidence. It is not an appraisal, financial advice, or a recommendation to buy or sell. GIS records do not replace a survey; declared zoning does not establish legal approval.', 'Este informe apoya decisiones con la evidencia disponible. No es tasación, asesoramiento financiero ni recomendación de compra o venta. Los registros GIS no sustituyen un levantamiento; la zonificación declarada no prueba aprobación legal.') };
  if (input.type !== 'maxxis_report_schema' || !['PROPERTY_RELEASE', 'MAXXIS_ANALYSIS', 'DEAL_INTELLIGENCE'].includes(scalar(input.reportType))) diagnostics.push('INVALID_REPORT_INPUT');
  const candidate = presentation.executiveNarrative;
  if (candidate && model.executive) {
    if (validateExecutiveNarrative(candidate, model).valid) { const thesis = obj(obj(candidate).executiveThesis); model.executive.thesis = { text: scalar(thesis.text), evidenceRefs: list(thesis.evidenceRefs).map(scalar) }; }
    else diagnostics.push('EXECUTIVE_NARRATIVE_REJECTED_DETERMINISTIC_FALLBACK');
  }
  return model;
}

/** Accept synthesis only if every claim is grounded in a permitted, exact packet claim. */
export function validateExecutiveNarrative(candidate: unknown, model: ReportViewModel): { valid: boolean; errors: string[] } {
  const record = obj(candidate), errors: string[] = [];
  const allowed = new Map(model.evidencePacket.map(item => [item.id, item]));
  const items = [record.executiveThesis, ...list(record.positiveSignals), ...list(record.risks), ...list(record.decisionBlockers), ...list(record.nextActions)].filter(Boolean).map(obj);
  if (!items.length) errors.push('EMPTY_NARRATIVE');
  for (const item of items) {
    const text = scalar(item.text), refs = list(item.evidenceRefs).map(scalar);
    if (!text || !refs.length || refs.some(ref => !allowed.has(ref))) errors.push('UNSUPPORTED_EVIDENCE_REF');
    // A reference alone cannot authorize an invented assertion or calculation.
    if (!refs.some(ref => allowed.get(ref)?.text === text)) errors.push('UNSUPPORTED_CLAIM');
    if (!validateRenderedReportText(text).valid) errors.push('UNSAFE_NARRATIVE');
  }
  return { valid: !errors.length, errors: [...new Set(errors)] };
}

export function validateReportViewModel(model: ReportViewModel): { valid: boolean; errors: string[] } {
  const errors: string[] = [], refs = new Set(model.evidencePacket.map(item => item.id));
  if (model.type !== 'strict_report_view_model' || model.version !== 'REPORT_PROJECTION_V3' || model.diagnostics.includes('INVALID_REPORT_INPUT')) errors.push('INVALID_REPORT_INPUT');
  const assertClaim = (claim: ReportClaim): void => { if (!claim.text || !claim.evidenceRefs.length || claim.evidenceRefs.some(ref => !refs.has(ref))) errors.push('CLAIM_WITHOUT_EVIDENCE'); };
  const visible: string[] = [model.header.product, model.header.subtitle, model.property.title, model.property.location, model.property.price, model.property.type, model.property.strategy, model.disclaimer];
  const addRows = (rows: ReportRow[]): void => { for (const row of rows) { visible.push(row.label, row.value, row.source || ''); if (!row.label || !row.evidenceRefs.length || row.evidenceRefs.some(ref => !refs.has(ref))) errors.push('INVALID_ROW'); } };
  for (const value of Object.values(model.values)) { if (value.numericValue === 0 && value.state !== 'EXPLICIT_ZERO') errors.push('ILLEGAL_ZERO'); if (value.state === 'EXPLICIT_ZERO' && !value.source) errors.push('ZERO_WITHOUT_PROVENANCE'); }
  for (const group of model.property.facts) { visible.push(group.title); addRows(group.rows); }
  addRows(model.property.metrics); visible.push(...model.property.notes);
  if (model.executive) { assertClaim(model.executive.thesis); visible.push(model.executive.thesis.text, model.executive.status); addRows(model.executive.coverage); }
  const sectionIds = new Set<string>();
  for (const section of model.sections) {
    if (sectionIds.has(section.id)) errors.push('DUPLICATE_SECTION'); sectionIds.add(section.id);
    visible.push(section.title, section.text || '');
    if (!section.text && !section.items?.length && !section.rows?.length && !section.hero && !section.table?.rows.length) errors.push('EMPTY_SECTION');
    if (section.rows) addRows(section.rows);
    if (section.hero) visible.push(section.hero.label, section.hero.value, section.hero.qualification);
    if (section.range) visible.push(section.range.low, section.range.high, section.range.estimate);
    if (section.gauge) { visible.push(section.gauge.label); if (!Number.isFinite(section.gauge.value) || section.gauge.value < 0 || section.gauge.value > 100) errors.push('INVALID_GAUGE'); }
    if (section.comparison) for (const item of section.comparison) { visible.push(item.label, item.text); if (!Number.isFinite(item.value) || item.value < 0) errors.push('INVALID_COMPARISON'); }
    if (section.map) { visible.push(section.map.caption); if (section.map.points.some(point => !finitePoint(point.latitude, point.longitude))) errors.push('INVALID_MAP_POINT'); }
    for (const item of section.items || []) { assertClaim(item); visible.push(item.text); }
    if (section.table) { visible.push(...section.table.columns, ...section.table.rows.flat()); if (section.table.rows.length !== section.table.evidenceRefs.length) errors.push('TABLE_EVIDENCE_MISMATCH'); }
    if (section.id === 'next-actions' && new Set(section.items?.map(item => item.text)).size !== section.items?.length) errors.push('DUPLICATE_ACTION');
  }
  errors.push(...validateRenderedReportText(visible.join('\n')).errors);
  return { valid: !errors.length, errors: [...new Set(errors)] };
}
