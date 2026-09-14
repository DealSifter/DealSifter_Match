import { INTELLIGENCE_REPORT_TYPES } from '../../../domain/intelligenceAccess';

const REPORT_TYPES = new Set(Object.values(INTELLIGENCE_REPORT_TYPES));
const PROPERTY_FIELDS = Object.freeze([
  'address', 'city', 'state', 'zip', 'type', 'price', 'beds', 'baths',
  'sqft', 'lot', 'rehab', 'capRate', 'objective', 'dealTag', 'description',
]);

function cleanText(value, max = 180) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '' && value !== 0;
}

export function buildPropertyAnalysisHandoff({
  property,
  reportType,
  accessDecision,
  userPlan,
} = {}) {
  const propertyId = cleanText(property?.id, 50);
  const normalizedReportType = cleanText(reportType, 40).toUpperCase();
  if (!propertyId || !REPORT_TYPES.has(normalizedReportType)) return null;

  const availableFields = PROPERTY_FIELDS.filter((field) => hasValue(property?.[field]));
  const missingFields = PROPERTY_FIELDS.filter((field) => !hasValue(property?.[field]));
  return Object.freeze({
    mode: 'PROPERTY_ANALYSIS_MODE',
    property_id: propertyId,
    address: cleanText(property?.address || property?.name || 'Selected property'),
    report_type: normalizedReportType,
    entitlement: Object.freeze({
      state: cleanText(accessDecision?.state || (accessDecision?.allowed ? 'INCLUDED' : 'DENIED'), 40),
      allowed: Boolean(accessDecision?.allowed),
      access_source: cleanText(accessDecision?.accessSource, 40) || null,
    }),
    user_plan: cleanText(userPlan || 'free', 30).toUpperCase(),
    available_property_data: Object.freeze({
      fields: Object.freeze(availableFields),
      missing_fields: Object.freeze(missingFields),
    }),
    available_intelligence_context: Object.freeze({
      selected_property: true,
      property_release: true,
      maxxis_analysis: normalizedReportType === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS
        || normalizedReportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE,
      deal_intelligence: normalizedReportType === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE,
    }),
  });
}

export function composePropertyAnalysisAcknowledgement(context, language = 'en') {
  if (!context || context.mode !== 'PROPERTY_ANALYSIS_MODE') return '';
  const address = cleanText(context.address) || 'selected property';
  const report = context.report_type === INTELLIGENCE_REPORT_TYPES.DEAL_INTELLIGENCE
    ? 'Deal Intelligence'
    : context.report_type === INTELLIGENCE_REPORT_TYPES.MAXXIS_ANALYSIS
      ? 'Maxxis AI Analysis'
      : 'Basic Property Release';
  const available = Array.isArray(context.available_property_data?.fields)
    ? context.available_property_data.fields.slice(0, 8)
    : [];
  const fields = available.length ? available.join(', ') : 'property identification';
  if (String(language).startsWith('pt')) {
    return `Vou analisar ${address} no modo ${report}, usando os dados disponíveis desta propriedade e seu perfil. Dados disponíveis: ${fields}.`;
  }
  if (String(language).startsWith('es')) {
    return `Analizaré ${address} en modo ${report}, usando los datos disponibles de esta propiedad y tu perfil. Datos disponibles: ${fields}.`;
  }
  return `I will analyze ${address} in ${report} mode using the available property data and your profile. Available data: ${fields}.`;
}
