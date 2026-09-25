import officialDealSifterLogo from '../../../assets/maxxis/report-official-logo.png?inline';
import notoSansRegular from '../../../assets/maxxis/fonts/NotoSans-Regular.ttf?inline';
import notoSansBold from '../../../assets/maxxis/fonts/NotoSans-Bold.ttf?inline';
import { renderMaxxisReportDocument } from './maxxisReportRenderer';
import { explainMaxxisEvidenceState } from '../intelligence/maxxisUserFacingEvidence';

// The same page functions render real reports and the isolated commercial fixture.
// They only read the authorized report schema; no provider or AI work happens here.
const W = 595.28;
const H = 841.89;
const M = 30;
const CONTENT = W - M * 2;
const C = Object.freeze({
  navy: [15, 32, 49], graphite: [39, 45, 48], teal: [29, 184, 188],
  blue: [24, 114, 190], green: [13, 135, 111], gold: [237, 176, 28], red: [209, 68, 58],
  orange: [238, 135, 20], purple: [116, 94, 189],
  white: [255, 255, 255], ink: [27, 42, 60], muted: [91, 110, 129],
  line: [216, 228, 234], pale: [246, 250, 252], card: [251, 253, 254], warm: [255, 250, 237],
});
const COPY = Object.freeze({
  en: {
    locale: 'en',
    generated: 'Generated', page: 'Page', unavailable: 'Unavailable', notVerified: 'Not verified', published: 'Published',
    reportSubtitle: 'Intelligent property analysis', releaseSubtitle: 'Real Opportunities. Real Connections.', tagline: 'Real Data. Smarter Decisions.',
    property: 'PROPERTY RELEASE', pro: 'MAXXIS ANALYSIS REPORT', deal: 'MAXXIS DEAL INTELLIGENCE REPORT',
    PROPERTY_OVERVIEW: 'Property Overview', EXECUTIVE_SUMMARY_PROPERTY_CONTEXT: 'Executive Summary',
    INVESTMENT_FIT_RISK: 'Investment Fit & Risk Analysis', KEY_INSIGHTS_NEXT_STEPS: 'Key Insights & Next Steps',
    COMPARATIVE_MARKET_ANALYSIS: 'Comparative Market Analysis', VALUATION_INTELLIGENCE: 'Valuation Intelligence / ARV / KPIs',
    KEY_INSIGHTS_VERIFICATION: 'Key Insights & Verification', MAXXIS_AI_ANALYSIS: 'Maxxis AI Analysis',
    owner: 'Owner Information', facts: 'Property Details', land: 'Land Information', photos: 'Property Photos',
    location: 'Location', notes: 'Notes', status: 'Status', type: 'Type', strategy: 'Strategy',
    price: 'Price', beds: 'Beds', baths: 'Baths', sqft: 'Living area', lot: 'Lot size',
    source: 'Source', ownerName: 'Owner', ownerType: 'Owner type', contacts: 'Contacts',
    ownerOccupied: 'Owner occupied', ownershipRecord: 'Ownership record', latestSale: 'Latest sale',
    saleDate: 'Sale date', yearBuilt: 'Year built', county: 'County', assessedValue: 'Assessed value',
    propertyTax: 'Property tax', providerEstimate: 'Provider estimate (not ARV)',
    capRate: 'Cap rate', rehab: 'Rehab', noPhoto: 'No property photo available',
    noMap: 'Street map unavailable; location is shown from stored property data.',
    mapAttribution: '© OpenStreetMap contributors',
    context: 'Property context', opportunity: 'Opportunity Summary', conclusion: 'Maxxis executive insight',
    profile: 'Investor Profile', compatibility: 'Profile Compatibility', fit: 'Fit by Criterion',
    risks: 'Risk Analysis', evidence: 'Evidence Considerations', positives: 'Positive Signals',
    missing: "What's Missing", next: 'Recommended Next Steps', considerations: 'Key Considerations',
    comps: 'Recorded Sold Comparables', compLocation: 'Comparable Locations', observations: 'Analysis Observations',
    arv: 'Estimated ARV Range', inputs: 'Valuation Inputs', kpis: 'Investment Scenarios',
    limitations: 'Valuation Limitations', mainTopics: 'Main Topics', questions: 'Open Questions', investorFocus: 'Investor Focus Map',
    actions: 'Recommended Actions', analysis: 'Profile-adapted conclusion',
    disclaimer: 'Evidence-based decision support only. Not an appraisal or financial, legal, or investment advice.',
    noComps: 'No recorded sold comparables available for this report.',
    noArv: 'ARV unavailable under the current deterministic evidence gates.',
    noDetails: 'No additional verified details available.', portfolio: 'Portfolio', yes: 'Yes', no: 'No',
    coordinateMap: 'Schematic positions from stored coordinates; not a street map.',
    address: 'Address', salePrice: 'Sale price', date: 'Date', distance: 'Distance', bedsBaths: 'Beds / Baths', similarity: 'Similarity',
    used: 'USED', supporting: 'SUPPORTING', excluded: 'EXCLUDED', totalComps: 'Comparable records', usedComparables: 'Used in analysis', averageSalePrice: 'Average sale price', averageSimilarity: 'Average similarity',
    compsUsed: 'Comps used', confidence: 'Confidence', pricePerSqft: 'Price / sqft',
    costBasis: 'Cost basis', spread: 'Spread', roiScenario: 'ROI scenario', marketPricePerSqft: 'Comparable avg. / sqft', subjectVsMarket: 'Subject vs. market', averageDistance: 'Average distance',
    arvAvailable: 'ARV available', arvLimited: 'ARV limited by evidence', arvUnavailable: 'ARV unavailable',
    providerEstimateStatus: 'Supporting provider estimate — not DealSifter ARV',
    conflict: 'Needs verification: stored evidence conflicts with the narrative.', low: 'Low', middle: 'Mid', high: 'High',
  },
  pt: {
    locale: 'pt',
    generated: 'Gerado em', page: 'Página', unavailable: 'Indisponível', notVerified: 'Não verificado', published: 'Publicado',
    reportSubtitle: 'Análise inteligente do imóvel', releaseSubtitle: 'Oportunidades reais. Conexões reais.', tagline: 'Dados reais. Decisões mais inteligentes.',
    property: 'RELATÓRIO DO IMÓVEL', pro: 'RELATÓRIO DE ANÁLISE MAXXIS', deal: 'RELATÓRIO MAXXIS DE INTELIGÊNCIA DO NEGÓCIO',
    PROPERTY_OVERVIEW: 'Visão geral do imóvel', EXECUTIVE_SUMMARY_PROPERTY_CONTEXT: 'Resumo executivo',
    INVESTMENT_FIT_RISK: 'Adequação e análise de riscos', KEY_INSIGHTS_NEXT_STEPS: 'Insights e próximos passos',
    COMPARATIVE_MARKET_ANALYSIS: 'Análise comparativa de mercado', VALUATION_INTELLIGENCE: 'Avaliação / ARV / indicadores',
    KEY_INSIGHTS_VERIFICATION: 'Insights e verificações', MAXXIS_AI_ANALYSIS: 'Análise Maxxis AI',
    owner: 'Dados do proprietário', facts: 'Detalhes do imóvel', land: 'Dados do terreno', photos: 'Fotos do imóvel',
    location: 'Localização', notes: 'Notas', status: 'Status', type: 'Tipo', strategy: 'Estratégia',
    price: 'Preço', beds: 'Quartos', baths: 'Banheiros', sqft: 'Área útil', lot: 'Área do lote',
    source: 'Fonte', ownerName: 'Proprietário', ownerType: 'Tipo de proprietário', contacts: 'Contatos',
    ownerOccupied: 'Ocupado pelo proprietário', ownershipRecord: 'Registro de ownership', latestSale: 'Última venda',
    saleDate: 'Data da venda', yearBuilt: 'Ano de construção', county: 'Condado', assessedValue: 'Valor fiscal',
    propertyTax: 'Imposto predial', providerEstimate: 'Estimativa do provedor (não é ARV)',
    capRate: 'Cap rate', rehab: 'Reforma', noPhoto: 'Sem foto disponível do imóvel',
    noMap: 'Mapa de ruas indisponível; localização baseada nos dados cadastrados.',
    mapAttribution: '© Colaboradores do OpenStreetMap',
    context: 'Contexto do imóvel', opportunity: 'Resumo da oportunidade', conclusion: 'Insight executivo do Maxxis',
    profile: 'Perfil do investidor', compatibility: 'Compatibilidade do perfil', fit: 'Adequação por critério',
    risks: 'Análise de riscos', evidence: 'Considerações sobre evidências', positives: 'Sinais positivos',
    missing: 'O que falta', next: 'Próximos passos recomendados', considerations: 'Pontos de atenção',
    comps: 'Comparáveis vendidos registrados', compLocation: 'Localização dos comparáveis', observations: 'Observações da análise',
    arv: 'Faixa estimada de ARV', inputs: 'Dados da avaliação', kpis: 'Cenários de investimento',
    limitations: 'Limitações da avaliação', mainTopics: 'Tópicos principais', questions: 'Questões abertas', investorFocus: 'Mapa de foco do investidor',
    actions: 'Ações recomendadas', analysis: 'Conclusão adaptada ao perfil',
    disclaimer: 'Análise baseada em evidências. Não constitui avaliação imobiliária nem aconselhamento financeiro, jurídico ou de investimento.',
    noComps: 'Não há comparáveis vendidos registrados para este relatório.',
    noArv: 'ARV indisponível segundo os critérios determinísticos de evidência.',
    noDetails: 'Não há detalhes verificados adicionais.', portfolio: 'Portfólio', yes: 'Sim', no: 'Não',
    coordinateMap: 'Posições esquemáticas das coordenadas armazenadas; não é um mapa de ruas.',
    address: 'Endereço', salePrice: 'Preço de venda', date: 'Data', distance: 'Distância', bedsBaths: 'Quartos / Banhos', similarity: 'Similaridade',
    used: 'USADO', supporting: 'SUPORTE', excluded: 'EXCLUÍDO', totalComps: 'Registros comparáveis', usedComparables: 'Usados na análise', averageSalePrice: 'Preço médio de venda', averageSimilarity: 'Similaridade média',
    compsUsed: 'Comps usados', confidence: 'Confiança', pricePerSqft: 'Preço / sqft',
    costBasis: 'Custo base', spread: 'Margem', roiScenario: 'Cenário de ROI', marketPricePerSqft: 'Média comparáveis / sqft', subjectVsMarket: 'Imóvel vs. mercado', averageDistance: 'Distância média',
    arvAvailable: 'ARV disponível', arvLimited: 'ARV limitado pelas evidências', arvUnavailable: 'ARV indisponível',
    providerEstimateStatus: 'Estimativa de apoio do provedor — não é ARV DealSifter',
    conflict: 'Requer verificação: evidências estruturadas divergem do texto.', low: 'Baixo', middle: 'Médio', high: 'Alto',
  },
  es: {
    locale: 'es',
    generated: 'Generado', page: 'Página', unavailable: 'No disponible', notVerified: 'No verificado', published: 'Publicado',
    reportSubtitle: 'Análisis inteligente de la propiedad', releaseSubtitle: 'Oportunidades reales. Conexiones reales.', tagline: 'Datos reales. Decisiones más inteligentes.',
    property: 'INFORME DE LA PROPIEDAD', pro: 'INFORME DE ANÁLISIS MAXXIS', deal: 'INFORME MAXXIS DE INTELIGENCIA DEL NEGOCIO',
    PROPERTY_OVERVIEW: 'Resumen de la propiedad', EXECUTIVE_SUMMARY_PROPERTY_CONTEXT: 'Resumen ejecutivo',
    INVESTMENT_FIT_RISK: 'Afinidad y análisis de riesgos', KEY_INSIGHTS_NEXT_STEPS: 'Hallazgos y próximos pasos',
    COMPARATIVE_MARKET_ANALYSIS: 'Análisis comparativo de mercado', VALUATION_INTELLIGENCE: 'Valoración / ARV / indicadores',
    KEY_INSIGHTS_VERIFICATION: 'Hallazgos y verificación', MAXXIS_AI_ANALYSIS: 'Análisis de Maxxis AI',
    owner: 'Datos del propietario', facts: 'Detalles de la propiedad', land: 'Datos del terreno', photos: 'Fotos de la propiedad',
    location: 'Ubicación', notes: 'Notas', status: 'Estado', type: 'Tipo', strategy: 'Estrategia',
    price: 'Precio', beds: 'Habitaciones', baths: 'Baños', sqft: 'Superficie habitable', lot: 'Superficie del lote',
    source: 'Fuente', ownerName: 'Propietario', ownerType: 'Tipo de propietario', contacts: 'Contactos',
    ownerOccupied: 'Ocupada por propietario', ownershipRecord: 'Registro de titularidad', latestSale: 'Última venta',
    saleDate: 'Fecha de venta', yearBuilt: 'Año de construcción', county: 'Condado', assessedValue: 'Valor fiscal',
    propertyTax: 'Impuesto predial', providerEstimate: 'Estimación del proveedor (no es ARV)',
    capRate: 'Cap rate', rehab: 'Reforma', noPhoto: 'No hay foto disponible de la propiedad',
    noMap: 'Mapa de calles no disponible; ubicación según los datos registrados.',
    mapAttribution: '© Colaboradores de OpenStreetMap',
    context: 'Contexto de la propiedad', opportunity: 'Resumen de la oportunidad', conclusion: 'Análisis ejecutivo de Maxxis',
    profile: 'Perfil del inversor', compatibility: 'Compatibilidad del perfil', fit: 'Afinidad por criterio',
    risks: 'Análisis de riesgos', evidence: 'Consideraciones de evidencia', positives: 'Señales positivas',
    missing: 'Qué falta', next: 'Próximos pasos recomendados', considerations: 'Puntos de atención',
    comps: 'Comparables vendidos registrados', compLocation: 'Ubicación de comparables', observations: 'Observaciones del análisis',
    arv: 'Rango ARV estimado', inputs: 'Datos de la valoración', kpis: 'Escenarios de inversión',
    limitations: 'Limitaciones de la valoración', mainTopics: 'Temas principales', questions: 'Preguntas abiertas', investorFocus: 'Mapa de enfoque del inversor',
    actions: 'Acciones recomendadas', analysis: 'Conclusión adaptada al perfil',
    disclaimer: 'Análisis basado en evidencias. No es una tasación ni asesoramiento financiero, legal o de inversión.',
    noComps: 'No hay comparables vendidos registrados para este informe.',
    noArv: 'ARV no disponible según los criterios determinísticos de evidencia.',
    noDetails: 'No hay detalles verificados adicionales.', portfolio: 'Cartera', yes: 'Sí', no: 'No',
    coordinateMap: 'Posiciones esquemáticas de coordenadas guardadas; no es un mapa de calles.',
    address: 'Dirección', salePrice: 'Precio de venta', date: 'Fecha', distance: 'Distancia', bedsBaths: 'Hab. / Baños', similarity: 'Similitud',
    used: 'USADO', supporting: 'APOYO', excluded: 'EXCLUIDO', totalComps: 'Registros comparables', usedComparables: 'Usados en el análisis', averageSalePrice: 'Precio medio de venta', averageSimilarity: 'Similitud media',
    compsUsed: 'Comps usados', confidence: 'Confianza', pricePerSqft: 'Precio / sqft',
    costBasis: 'Costo base', spread: 'Diferencia', roiScenario: 'Escenario de ROI', marketPricePerSqft: 'Promedio comps / sqft', subjectVsMarket: 'Propiedad vs. mercado', averageDistance: 'Distancia media',
    arvAvailable: 'ARV disponible', arvLimited: 'ARV limitado por la evidencia', arvUnavailable: 'ARV no disponible',
    providerEstimateStatus: 'Estimación de apoyo del proveedor — no es ARV DealSifter',
    conflict: 'Requiere verificación: la evidencia estructurada difiere del texto.', low: 'Bajo', middle: 'Medio', high: 'Alto',
  },
});
const section = (schema, key) => schema?.sections?.[key]?.available ? schema.sections[key].data : null;
const array = (value) => Array.isArray(value) ? value : [];
const positiveObservations = (summary) => Array.isArray(summary?.observations)
  ? summary.observations : array(summary?.observations?.positives);
const attentionObservations = (summary) => array(summary?.observations?.attention);
const value = (input, fallback) => input === null || input === undefined || input === ''
  || /^(?:UNKNOWN|UNAVAILABLE|NOT_LOADED|NOT_AVAILABLE)$/i.test(String(input).trim()) ? fallback : String(input);
const reportNarrative = (input, fallback = '', language = 'en') => {
  const raw = value(input, fallback).trim();
  return explainMaxxisEvidenceState(raw, language);
};
const DISPLAY_VALUE = Object.freeze({
  pt: Object.freeze({ Sell: 'Venda', Buy: 'Compra', 'Buy and Hold': 'Comprar e manter', true: 'Sim', false: 'Não',
    HIGH: 'Alta', MODERATE: 'Moderada', MEDIUM: 'Média', LOW: 'Baixa', MATCHED: 'Aderente', NOT_MATCHED: 'Não aderente', PARTIAL: 'Parcial',
    'Not verified': 'Não verificado', Published: 'Publicado', Individual: 'Pessoa física' }),
  es: Object.freeze({ Sell: 'Venta', Buy: 'Compra', 'Buy and Hold': 'Comprar y mantener', true: 'Sí', false: 'No',
    HIGH: 'Alta', MODERATE: 'Moderada', MEDIUM: 'Media', LOW: 'Baja', MATCHED: 'Compatible', NOT_MATCHED: 'No compatible', PARTIAL: 'Parcial',
    'Not verified': 'No verificado', Published: 'Publicado', Individual: 'Persona física' }),
});
const displayValue = (input, t) => {
  const raw = value(input, t.unavailable);
  return DISPLAY_VALUE[t.locale]?.[raw] || raw;
};
const localizedPropertyNotes = (property, t) => {
  if (t.locale === 'en') return property.notes || property.description || t.unavailable;
  const place = location(property) || t.unavailable;
  const type = displayValue(property.type, t);
  const facts = `${value(property.beds, '–')} ${t.beds.toLowerCase()}, ${value(property.baths, '–')} ${t.baths.toLowerCase()} e ${value(property.sqft, '–')} sqft`;
  return t.locale === 'pt'
    ? `Imóvel cadastrado em ${place}, do tipo ${type}, com ${facts}. Consulte as seções deste relatório para verificar os dados disponíveis e as limitações aplicáveis.`
    : `Propiedad registrada en ${place}, de tipo ${type}, con ${facts.replace(' e ', ' y ')}. Consulta las secciones de este informe para verificar los datos disponibles y las limitaciones aplicables.`;
};
const currency = (input, t) => Number.isFinite(Number(input)) && Number(input) > 0
  ? `$${Number(input).toLocaleString('en-US')}` : t.unavailable;
const location = (property) => [property.city, [property.state, property.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
const accentFor = (type) => type === 'DEAL_INTELLIGENCE' ? C.gold : type === 'MAXXIS_ANALYSIS' ? C.green : C.teal;
const themeFor = (type) => type === 'DEAL_INTELLIGENCE' ? C.graphite : C.navy;
const productFor = (type, t) => type === 'DEAL_INTELLIGENCE' ? t.deal : type === 'MAXXIS_ANALYSIS' ? t.pro : t.property;
const planFor = (type) => type === 'DEAL_INTELLIGENCE' ? 'ENTERPRISE' : type === 'MAXXIS_ANALYSIS' ? 'PRO' : 'FREE';

function text(doc, input, x, y, { size = 9, bold = false, color = C.ink, width = null, maxLines = 3, align = 'left' } = {}) {
  doc.setFont('NotoSans', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const wrapped = width ? doc.splitTextToSize(value(input, ''), width) : [value(input, '')];
  const lines = wrapped.slice(0, maxLines);
  if (wrapped.length > maxLines && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].trimEnd()}…`;
  doc.text(lines, x, y, { align });
  return y + lines.length * (size + 3);
}
function softColor(color, whiteRatio = .9) {
  return color.map((channel, index) => Math.round(channel * (1 - whiteRatio) + C.white[index] * whiteRatio));
}
function darkColor(color, blackRatio = .2) {
  return color.map((channel) => Math.round(channel * (1 - blackRatio)));
}
function blendColor(from, to, ratio) {
  return from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio));
}
function panel(doc, x, y, w, h, { fill = C.white, stroke = C.line, radius = 8, accent = null } = {}) {
  doc.setFillColor(...fill); doc.setDrawColor(...stroke);
  doc.roundedRect(x, y, w, h, radius, radius, 'FD');
  if (accent) {
    doc.setFillColor(...accent);
    doc.roundedRect(x + 1.5, y + 8, 3.5, Math.max(8, h - 16), 1.75, 1.75, 'F');
  }
}
function iconKind(title) {
  const normalized = String(title || '').toLowerCase();
  if (/maxxis ai|intelligence|inteligência|inteligencia/.test(normalized)) return 'target';
  if (/investment fit|adequação e análise|afinidad y análisis/.test(normalized)) return 'chart';
  if (/owner|propriet|perfil|profile/.test(normalized)) return 'person';
  if (/location|localiza|ubicaci|map|terreno|land|comparative|comparativ/.test(normalized)) return 'pin';
  if (/photo|foto/.test(normalized)) return 'camera';
  if (/risk|risco|riesgo|missing|falta|limita|warning|atenção|atenci/.test(normalized)) return 'warning';
  if (/positive|positivo|evidence|evidência|evidencia/.test(normalized)) return 'check';
  if (/valuation|avalia|valoraci|arv|kpi|compatib|fit|adequação|afinidad|spread|roi|topic|tópico|tema/.test(normalized)) return 'chart';
  if (/bed|quarto|habitaci/.test(normalized)) return 'bed';
  if (/bath|banhe|baño/.test(normalized)) return 'bath';
  if (/area|sqft|superfície|superficie/.test(normalized)) return 'maximize';
  if (/price|preço|precio|sale|venda|venta/.test(normalized)) return 'trend';
  if (/next|próxim|proxim|action|ações|acciones|steps|etapas|pasos/.test(normalized)) return 'list';
  if (/property|imóvel|propiedad|detail|detalhe|característica|release|overview|resumen/.test(normalized)) return 'house';
  return 'document';
}
function drawIcon(doc, kind, cx, cy, accent, size = 12) {
  const r = size / 2;
  doc.setFillColor(...accent); doc.circle(cx, cy, r, 'F');
  doc.setDrawColor(...C.white); doc.setTextColor(...C.white); doc.setLineWidth(Math.max(.7, size / 13));
  if (kind === 'person') {
    doc.circle(cx, cy - r * .25, r * .22, 'S'); doc.ellipse(cx, cy + r * .4, r * .44, r * .3, 'S');
  } else if (kind === 'pin') {
    doc.circle(cx, cy - r * .13, r * .24, 'S'); doc.line(cx - r * .4, cy - r * .05, cx, cy + r * .58); doc.line(cx + r * .4, cy - r * .05, cx, cy + r * .58);
  } else if (kind === 'camera') {
    doc.roundedRect(cx - r * .54, cy - r * .32, r * 1.08, r * .72, 1, 1, 'S'); doc.circle(cx, cy + r * .03, r * .22, 'S'); doc.line(cx - r * .35, cy - r * .32, cx - r * .2, cy - r * .5); doc.line(cx - r * .2, cy - r * .5, cx + r * .05, cy - r * .5);
  } else if (kind === 'warning') {
    doc.triangle(cx, cy - r * .55, cx - r * .58, cy + r * .45, cx + r * .58, cy + r * .45, 'S'); doc.line(cx, cy - r * .2, cx, cy + r * .15); doc.circle(cx, cy + r * .3, .45, 'F');
  } else if (kind === 'check') {
    doc.circle(cx, cy, r * .54, 'S'); doc.line(cx - r * .3, cy, cx - r * .05, cy + r * .25); doc.line(cx - r * .05, cy + r * .25, cx + r * .35, cy - r * .27);
  } else if (kind === 'chart') {
    doc.rect(cx - r * .5, cy + r * .06, r * .2, r * .42, 'S'); doc.rect(cx - r * .1, cy - r * .17, r * .2, r * .65, 'S'); doc.rect(cx + r * .3, cy - r * .45, r * .2, r * .93, 'S');
  } else if (kind === 'bed') {
    doc.line(cx - r * .54, cy + r * .38, cx - r * .54, cy - r * .42); doc.line(cx + r * .54, cy + r * .38, cx + r * .54, cy - r * .04); doc.rect(cx - r * .38, cy - r * .34, r * .36, r * .28, 'S'); doc.rect(cx - r * .54, cy - r * .04, r * 1.08, r * .42, 'S');
  } else if (kind === 'bath') {
    doc.line(cx - r * .52, cy + r * .04, cx + r * .52, cy + r * .04); doc.roundedRect(cx - r * .5, cy + r * .04, r, r * .42, r * .18, r * .18, 'S'); doc.line(cx - r * .34, cy + r * .43, cx - r * .34, cy + r * .56); doc.line(cx + r * .34, cy + r * .43, cx + r * .34, cy + r * .56); doc.line(cx - r * .4, cy - r * .12, cx - r * .4, cy - r * .45); doc.line(cx - r * .4, cy - r * .45, cx - r * .08, cy - r * .45);
  } else if (kind === 'maximize') {
    doc.line(cx - r * .5, cy - r * .12, cx - r * .5, cy - r * .5); doc.line(cx - r * .5, cy - r * .5, cx - r * .12, cy - r * .5); doc.line(cx + r * .5, cy + r * .12, cx + r * .5, cy + r * .5); doc.line(cx + r * .5, cy + r * .5, cx + r * .12, cy + r * .5);
  } else if (kind === 'trend') {
    doc.line(cx - r * .5, cy + r * .36, cx - r * .08, cy - r * .06); doc.line(cx - r * .08, cy - r * .06, cx + r * .14, cy + r * .16); doc.line(cx + r * .14, cy + r * .16, cx + r * .52, cy - r * .35); doc.line(cx + r * .24, cy - r * .35, cx + r * .52, cy - r * .35); doc.line(cx + r * .52, cy - r * .35, cx + r * .52, cy - r * .08);
  } else if (kind === 'target') {
    doc.circle(cx, cy, r * .54, 'S'); doc.circle(cx, cy, r * .25, 'S'); doc.circle(cx, cy, .75, 'F'); doc.line(cx + r * .18, cy - r * .18, cx + r * .55, cy - r * .55);
  } else if (kind === 'list') {
    [-.34, 0, .34].forEach((offset) => { doc.circle(cx - r * .35, cy + r * offset, .55, 'F'); doc.line(cx - r * .16, cy + r * offset, cx + r * .48, cy + r * offset); });
  } else if (kind === 'house') {
    doc.line(cx - r * .5, cy, cx, cy - r * .48); doc.line(cx, cy - r * .48, cx + r * .5, cy); doc.rect(cx - r * .34, cy, r * .68, r * .48, 'S');
  } else {
    doc.rect(cx - r * .36, cy - r * .48, r * .72, r * .96, 'S'); [-.2, .04, .28].forEach((offset) => doc.line(cx - r * .2, cy + r * offset, cx + r * .2, cy + r * offset));
  }
  doc.setLineWidth(.2);
}
function heading(doc, title, x, y, w, accent) {
  doc.setFillColor(...softColor(C.graphite, .5));
  doc.roundedRect(x - 3, y - 23, w + 6, 27, 6, 6, 'F');
  doc.setFillColor(...softColor(accent, .88));
  doc.roundedRect(x - 3, y - 19, w + 6, 27, 6, 6, 'F');
  drawIcon(doc, iconKind(title), x + 10, y - 6, accent, 20);
  text(doc, title, x + 26, y - 1, { size: 11.4, bold: true, color: C.ink, width: w - 29, maxLines: 1 });
}
function rows(doc, items, x, y, w, { lineHeight = 24, labelWidth = 95, limit = 8, t } = {}) {
  let yy = y;
  items.slice(0, limit).forEach(([label, entry], i) => {
    text(doc, label, x, yy, { size: 8, color: C.muted, width: labelWidth - 5, maxLines: 1 });
    text(doc, displayValue(entry, t), x + labelWidth, yy, { size: 8.5, bold: true, width: w - labelWidth, maxLines: 2 });
    const lines = doc.splitTextToSize(displayValue(entry, t), w - labelWidth).length;
    const step = Math.max(lineHeight, Math.min(2, lines) * 12 + 5);
    if (i < Math.min(limit, items.length) - 1) {
      doc.setDrawColor(...C.line); doc.line(x, yy + step - 10, x + w, yy + step - 10);
    }
    yy += step;
  });
}
function listPanel(doc, title, items, x, y, w, h, t, accent, { positive = false } = {}) {
  const relevanceColor = positive ? C.green
    : /missing|falta|questions|questões|preguntas|limita|considera|attention|atenção|atención/i.test(title) ? C.orange
      : /next|próxim|action|ações|acciones/i.test(title) ? C.blue : accent;
  panel(doc, x, y, w, h, { fill: C.white, accent: relevanceColor });
  heading(doc, title, x + 13, y + 26, w - 26, accent);
  let yy = y + 48;
  const entries = items.length ? items : [t.noDetails];
  for (const item of entries.slice(0, 6)) {
    if (yy > y + h - 28) break;
    drawIcon(doc, positive ? 'check' : iconKind(title), x + 20, yy - 3, relevanceColor, 12);
    yy = text(doc, reportNarrative(typeof item === 'string' ? item : item?.explanation || item?.reason || item?.label || item?.status, t.noDetails, t.locale),
      x + 31, yy, { size: 8.5, width: w - 45, maxLines: 3 }) + 7;
  }
}
function pageHeader(doc, schema, pageCode, t) {
  const theme = themeFor(schema.reportType); const accent = accentFor(schema.reportType);
  doc.setFillColor(...theme); doc.rect(0, 0, W, 86, 'F');
  // Never infer a second dimension for the brand. Derive it from the source
  // bitmap on every render so the logo cannot be compressed by layout changes.
  const logoProperties = doc.getImageProperties(officialDealSifterLogo);
  const logoWidth = 198;
  const logoHeight = logoWidth * (logoProperties.height / logoProperties.width);
  doc.addImage(officialDealSifterLogo, 'PNG', M, 10, logoWidth, logoHeight, 'official-dealsifter-logo');
  text(doc, t.tagline, M + 55, 66, { size: 7.5, color: accent });
  const planWidth = 62; const planX = W - M - planWidth;
  text(doc, productFor(schema.reportType, t), planX - 9, 30, { size: 7.8, bold: true, color: C.white, width: 238, maxLines: 1, align: 'right' });
  text(doc, schema.reportType === 'PROPERTY_RELEASE' ? t.releaseSubtitle : t.reportSubtitle, planX - 9, 48, { size: 6.8, color: C.white, width: 232, maxLines: 1, align: 'right' });
  panel(doc, planX, 22, planWidth, 29, { fill: accent, stroke: accent, radius: 5 });
  text(doc, schema.reportType === 'PROPERTY_RELEASE' ? 'FREE' : planFor(schema.reportType), planX + planWidth / 2, 40, { size: 8.2, bold: true, color: schema.reportType === 'DEAL_INTELLIGENCE' ? C.ink : C.white, align: 'center' });
  heading(doc, t[pageCode] || pageCode, M, 108, CONTENT, accent);
  return { accent, theme };
}
function pageFooter(doc, page, total, generatedAt, language, t) {
  doc.setDrawColor(...C.line); doc.line(M, 803, W - M, 803);
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US';
  const stamp = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(generatedAt));
  text(doc, `${t.generated}: ${stamp} UTC`, M, 822, { size: 7.4, color: C.muted });
  text(doc, `${t.page} ${page} / ${total}`, W - M, 822, { size: 7.4, color: C.muted, align: 'right' });
}
function photo(doc, x, y, w, h, imageData, t, { cover = false, radius = 6 } = {}) {
  if (imageData) {
    try {
      const properties = doc.getImageProperties(imageData);
      const ratio = cover ? Math.max(w / properties.width, h / properties.height) : Math.min(w / properties.width, h / properties.height);
      const iw = properties.width * ratio; const ih = properties.height * ratio;
      doc.saveGraphicsState();
      // jsPDF only retains a geometry operation as a clipping path when its
      // style is explicitly null. Without it, the bitmap keeps square corners
      // and can bleed outside the intended image bounds.
      doc.roundedRect(x, y, w, h, radius, radius, null); doc.clip(); doc.discardPath();
      doc.addImage(imageData, properties.fileType || 'JPEG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      doc.restoreGraphicsState();
      return;
    } catch { /* Preserve factual report if media cannot be embedded. */ }
  }
  panel(doc, x, y, w, h, { fill: [238, 246, 248], radius });
  text(doc, t.noPhoto, x + w / 2, y + h / 2, { size: 9, color: C.muted, align: 'center' });
}
function metricCard(doc, x, y, w, label, entry, kind, accent, { height = 27 } = {}) {
  panel(doc, x, y, w, height, { fill: C.white, stroke: softColor(accent, .72), radius: 5 });
  drawIcon(doc, kind, x + 10, y + height / 2, accent, 12);
  text(doc, label, x + 19, y + 10, { size: 5.4, color: C.muted, width: w - 23, maxLines: 1 });
  text(doc, entry, x + 19, y + 21, { size: 7.9, bold: true, width: w - 23, maxLines: 1 });
}
function propertyHero(doc, property, t, accent, imageData) {
  const y = 121; const h = 185;
  panel(doc, M, y, CONTENT, h);
  doc.setFillColor(...accent); doc.roundedRect(M + 12, y + 12, 66, 20, 4, 4, 'F');
  text(doc, property.published ? t.published : t.notVerified, M + 45, y + 26, { size: 8, bold: true, color: C.white, align: 'center' });
  text(doc, value(property.address || property.title, t.unavailable), M + 13, y + 54, { size: 14.5, bold: true, width: 215, maxLines: 2 });
  text(doc, location(property) || t.unavailable, M + 13, y + 78, { size: 8.8, color: C.muted, width: 215, maxLines: 2 });
  text(doc, currency(property.price, t), M + 13, y + 108, { size: 20, bold: true, color: accent });
  photo(doc, M + 265, y + 9, CONTENT - 274, h - 18, imageData, t, { cover: true, radius: 7 });
  const metricY = y + 122; const metricGap = 5; const metricW = (223 - metricGap) / 2;
  const metrics = [
    [t.beds, value(property.beds, '–'), 'bed'],
    [t.baths, value(property.baths, '–'), 'bath'],
    [t.sqft, value(property.sqft, '–'), 'maximize'],
    [t.capRate, property.capRate == null ? t.unavailable : `${property.capRate}%`, 'trend'],
  ];
  metrics.forEach(([label, entry, kind], index) => {
    const column = index % 2; const row = Math.floor(index / 2);
    metricCard(doc, M + 12 + column * (metricW + metricGap), metricY + row * 32, metricW, label, entry, kind, accent);
  });
  return y + h;
}
function propertyReleaseHero(doc, property, t, accent, imageData) {
  return propertyHero(doc, property, t, accent, imageData);
}
function propertyFactGrid(doc, property, evidence, t, accent, y) {
  const gap = 6; const w = (CONTENT - gap * 2) / 3; const h = 139;
  const owner = property.owner || {};
  const evidenceFacts = Object.fromEntries([
    ...array(evidence?.verifiedRecords), ...array(evidence?.userProvided),
  ].filter((item) => item?.field).map((item) => [item.field, item.value]));
  const fact = (name, fallback = null) => evidenceFacts[name] ?? fallback;
  const contacts = array(owner.allowedContacts).map((contact) => contact?.value).filter(Boolean).join(' · ');
  const latestSale = [
    fact('latestSalePrice', property.latestSalePrice) ? currency(fact('latestSalePrice', property.latestSalePrice), t) : null,
    fact('latestSaleDate', property.latestSaleDate),
  ].filter(Boolean).join(' · ');
  const facts = [
    [t.owner, [[t.ownerName, owner.name], [t.ownerType, owner.type], [t.status, owner.status], [t.contacts, contacts], [t.ownerOccupied, fact('ownerOccupied', property.ownerOccupied)], [t.latestSale, latestSale]]],
    [t.facts, [[t.type, property.type], [t.strategy, property.objective], [t.yearBuilt, fact('yearBuilt', property.yearBuilt)], [t.beds, fact('bedrooms', property.beds)], [t.baths, fact('bathrooms', property.baths)], [t.sqft, fact('livingAreaSqft', property.sqft)]]],
    [t.land, [[t.location, [property.city, property.state].filter(Boolean).join(', ')], [t.county, fact('county', property.county)], [t.lot, fact('lotSizeSqft', property.lot)], [t.assessedValue, fact('assessedValue', property.assessedValue) ? currency(fact('assessedValue', property.assessedValue), t) : null], [t.propertyTax, fact('annualPropertyTax', property.annualPropertyTax) ? currency(fact('annualPropertyTax', property.annualPropertyTax), t) : null], [t.source, property.source]]],
  ];
  facts.forEach(([title, entries], i) => {
    const x = M + i * (w + gap); panel(doc, x, y, w, h);
    heading(doc, title, x + 10, y + 22, w - 20, accent);
    rows(doc, entries, x + 10, y + 42, w - 20, { lineHeight: 16, labelWidth: 64, limit: 6, t });
  });
  return y + h;
}
function propertyBottom(doc, property, t, accent, y, images, conflicts = [], mapImage = null, notes = {}) {
  heading(doc, t.photos, M, y + 20, CONTENT, accent);
  const shown = images.length ? images.slice(0, 5) : [null];
  // Keep the approved five-slot thumbnail scale even when fewer photos exist.
  // The image itself is clipped to the rounded shape; there is no gallery card
  // or inner frame creating visible padding around it.
  const photoGap = 5; const photoWidth = (CONTENT - photoGap * 4) / 5;
  shown.forEach((image, index) => photo(doc, M + index * (photoWidth + photoGap), y + 31, photoWidth, 50, image, t, { cover: true, radius: 6 }));
  y += 90;
  const gap = 6; const locationWidth = Math.round((CONTENT - gap) * 0.6); const notesWidth = CONTENT - gap - locationWidth;
  const bottomHeight = 243;
  panel(doc, M, y, locationWidth, bottomHeight); heading(doc, t.location, M + 10, y + 23, locationWidth - 20, accent);
  text(doc, location(property) || t.unavailable, M + 11, y + 44, { size: 9, bold: true, width: locationWidth - 22, maxLines: 1 });
  if (mapImage) {
    try {
      photo(doc, M + 7, y + 54, locationWidth - 14, 172, mapImage, t, { cover: true, radius: 6 });
      text(doc, t.mapAttribution, M + 8, y + 237, { size: 5.8, color: C.muted, width: locationWidth - 16, maxLines: 1 });
    } catch { /* Keep the coordinate fallback if the generated map cannot be embedded. */ }
  } else {
    if (property.latitude != null && property.longitude != null) text(doc, `${property.latitude}, ${property.longitude}`, M + 13, y + 73, { size: 8, color: C.muted });
    text(doc, t.noMap, M + 13, y + 101, { size: 8, color: C.muted, width: locationWidth - 25, maxLines: 3 });
  }
  const notesX = M + locationWidth + gap;
  panel(doc, notesX, y, notesWidth, bottomHeight, { accent: notes.title && notes.title !== t.notes ? accent : null }); heading(doc, notes.title || t.notes, notesX + 10, y + 23, notesWidth - 20, accent);
  text(doc, notes.text || localizedPropertyNotes(property, t), notesX + 11, y + 45, { size: 8.7, width: notesWidth - 22, maxLines: conflicts.length ? 15 : 18 });
  if (conflicts.length) text(doc, t.conflict, notesX + 11, y + 222, { size: 7.2, bold: true, color: C.gold, width: notesWidth - 22, maxLines: 2 });
}
function propertyReleaseBottom(doc, property, t, accent, images, mapImage) {
  return propertyBottom(doc, property, t, accent, 464, images, [], mapImage);
}
function renderPropertyOverview(doc, schema, t, accent, images, mapImage) {
  const property = section(schema, 'propertySummary') || {};
  const evidence = section(schema, 'propertyEvidence') || {};
  const translatedContext = schema?.structuredAnalysis?.language === t.locale
    ? schema.structuredAnalysis.propertyContextInterpretation : '';
  if (schema.reportType === 'PROPERTY_RELEASE') {
    propertyReleaseHero(doc, property, t, accent, images[0]);
    propertyFactGrid(doc, property, evidence, t, accent, 315);
    propertyReleaseBottom(doc, property, t, accent, images, mapImage);
    return;
  }
  propertyHero(doc, property, t, accent, images[0]);
  propertyFactGrid(doc, property, evidence, t, accent, 315);
  propertyBottom(doc, property, t, accent, 464, images, array(evidence.conflicts), mapImage, { text: translatedContext });
}
function renderExecutive(doc, schema, t, accent, images, mapImage) {
  const property = section(schema, 'propertySummary') || {};
  const summary = section(schema, 'executiveSummary') || {};
  propertyHero(doc, property, t, accent, images[0]);
  propertyFactGrid(doc, property, {}, t, accent, 315);
  const summaryText = [summary.summary, ...positiveObservations(summary).map((item) => `• ${item}`)].filter(Boolean).join('\n');
  propertyBottom(doc, property, t, accent, 464, images, [], mapImage, { title: t.opportunity, text: summaryText });
}
function profileRows(profile, t) {
  const profileCriterion = (criterion) => t.locale === 'en'
    ? criterion?.explanation || criterion?.status
    : displayValue(String(criterion?.status || '').toUpperCase(), t);
  return [
    [t.compatibility, profile.score == null ? t.unavailable : `${profile.score}%`],
    [t.location, profileCriterion(profile.targetMarket)],
    [t.type, profileCriterion(profile.propertyType)],
    [t.strategy, profileCriterion(profile.strategy)],
  ];
}
function meter(doc, x, y, width, percentValue, color) {
  const score = Math.max(0, Math.min(100, Number(percentValue) || 0));
  doc.setFillColor(...C.line); doc.roundedRect(x, y, width, 8, 4, 4, 'F');
  if (score > 0) {
    const activeWidth = Math.max(8, width * score / 100);
    const segments = Math.max(4, Math.ceil(activeWidth / 6));
    const segmentWidth = activeWidth / segments;
    const start = softColor(color, .28); const end = darkColor(color, .12);
    for (let index = 0; index < segments; index += 1) {
      doc.setFillColor(...blendColor(start, end, index / Math.max(1, segments - 1)));
      doc.rect(x + index * segmentWidth, y, segmentWidth + .35, 8, 'F');
    }
  }
}
function renderFit(doc, schema, t, accent) {
  const profile = section(schema, 'investmentProfile') || {};
  const risks = array(section(schema, 'riskAssessment'));
  const limitations = array(section(schema, 'limitations'));
  const property = section(schema, 'propertySummary') || {};
  const suppliedPerspective = schema?.presentation?.investorPerspective;
  const fallbackFocus = [
    profile.targetMarket?.explanation || t.location,
    profile.priceRange?.explanation || t.price,
    profile.propertyType?.explanation || t.type,
    profile.strategy?.explanation || t.strategy,
  ].filter(Boolean);
  const perspective = {
    persona: suppliedPerspective?.persona || profile.strategy?.explanation || profile.strategy?.status || t.strategy,
    priorities: array(suppliedPerspective?.priorities).length ? array(suppliedPerspective.priorities) : fallbackFocus,
  };
  panel(doc, M, 127, CONTENT, 41, { fill: C.white, stroke: softColor(accent, .68) });
  text(doc, [property.address, location(property)].filter(Boolean).join(' · ') || t.unavailable, M + 13, 153, { size: 10, bold: true, width: CONTENT - 26 });
  const w = (CONTENT - 12) / 2;
  panel(doc, M, 181, w, 200); heading(doc, t.profile, M + 12, 207, w - 24, accent);
  rows(doc, profileRows(profile, t), M + 12, 235, w - 24, { lineHeight: 35, labelWidth: 89, t });
  panel(doc, M + w + 12, 181, w, 200); heading(doc, t.compatibility, M + w + 24, 207, w - 24, accent);
  if (Number.isFinite(Number(profile.score))) {
    const score = Math.max(0, Math.min(100, Number(profile.score)));
    const scoreX = M + w + 12 + w / 2; const scoreY = 286; const scoreRadius = 48;
    doc.setFillColor(...C.white); doc.circle(scoreX, scoreY, 61, 'F');
    doc.setDrawColor(...C.line); doc.setLineWidth(14); doc.circle(scoreX, scoreY, scoreRadius, 'S');
    doc.setLineWidth(14);
    // Gauge is visualization of the existing score, not a new score calculation.
    const points = Array.from({ length: Math.max(2, Math.ceil(score / 3)) }, (_, i) => {
      const a = (-Math.PI / 2) + ((i / Math.max(1, Math.ceil(score / 3) - 1)) * (score / 100) * Math.PI * 2);
      return [scoreX + scoreRadius * Math.cos(a), scoreY + scoreRadius * Math.sin(a)];
    });
    const ringStart = softColor(accent, .2); const ringEnd = darkColor(accent, .18);
    points.slice(1).forEach((p, i) => {
      doc.setDrawColor(...blendColor(ringStart, ringEnd, i / Math.max(1, points.length - 2)));
      doc.line(...points[i], ...p);
    });
    doc.setLineWidth(0.2);
    text(doc, `${score}%`, scoreX, scoreY + 8, { size: 25, bold: true, align: 'center' });
  } else text(doc, t.unavailable, M + w + 12 + w / 2, 292, { size: 11, align: 'center' });
  panel(doc, M, 393, w, 174); heading(doc, t.fit, M + 12, 419, w - 24, accent);
  const criteria = array(profile.criteria).length ? array(profile.criteria) : [
    { label: t.location, ...profile.targetMarket }, { label: t.price, ...profile.priceRange },
    { label: t.type, ...profile.propertyType }, { label: t.strategy, ...profile.strategy },
  ];
  criteria.slice(0, 5).forEach((criterion, index) => {
    const yy = 447 + index * 27;
    const criterionScore = criterion.score == null
      ? criterion.status === 'matched' ? 100 : criterion.status === 'not_matched' ? 0 : 35
      : criterion.score;
    const fitColor = criterionScore >= 75 ? C.green : criterionScore >= 50 ? accent : criterionScore >= 30 ? C.gold : C.red;
    text(doc, displayValue(criterion.label || criterion.key, t), M + 12, yy, { size: 7.7, bold: true, width: 85, maxLines: 1 });
    meter(doc, M + 101, yy - 7, w - 142, criterionScore, fitColor);
    text(doc, `${Math.round(criterionScore)}%`, M + w - 12, yy, { size: 7.4, bold: true, color: fitColor, align: 'right' });
  });
  panel(doc, M + w + 12, 393, w, 174); heading(doc, t.risks, M + w + 24, 419, w - 24, accent);
  risks.slice(0, 5).forEach((risk, index) => {
    const yy = 447 + index * 27; const severity = String(risk?.severity || 'MEDIUM').toUpperCase();
    const riskScore = severity === 'HIGH' ? 90 : severity === 'LOW' ? 32 : 62;
    const riskColor = severity === 'HIGH' ? C.red : severity === 'LOW' ? C.green : C.gold;
    text(doc, displayValue(risk?.category || risk?.code, t), M + w + 24, yy, { size: 7.3, bold: true, width: 85, maxLines: 1 });
    meter(doc, M + w + 113, yy - 7, w - 154, riskScore, riskColor);
    text(doc, displayValue(severity, t), M + CONTENT - 12, yy, { size: 7.2, bold: true, color: riskColor, align: 'right' });
  });
  const evidence = schema?.presentation?.evidenceCounts || {};
  const evidenceItems = Object.entries(evidence).slice(0, 6);
  const evidenceY = 577; const evidenceHeight = 72;
  panel(doc, M, evidenceY, CONTENT, evidenceHeight, { accent }); heading(doc, t.evidence, M + 12, evidenceY + 26, CONTENT - 24, accent);
  if (evidenceItems.length) {
    const gap = 5; const ew = (CONTENT - 24 - gap * (evidenceItems.length - 1)) / evidenceItems.length;
    evidenceItems.forEach(([label, count], index) => {
      const x = M + 12 + index * (ew + gap);
      const evidenceColor = /verified/i.test(label) ? C.green : /conflict/i.test(label) ? C.red
        : /unknown/i.test(label) ? C.orange : /estimated/i.test(label) ? C.purple : /user/i.test(label) ? C.blue : accent;
      const tileY = evidenceY + 39; const tileHeight = 24;
      panel(doc, x, tileY, ew, tileHeight, { fill: C.white, stroke: softColor(evidenceColor, .72), radius: 6 });
      drawIcon(doc, index < 2 ? 'check' : index === evidenceItems.length - 1 ? 'warning' : 'document', x + 10, tileY + 12, evidenceColor, 11);
      text(doc, count, x + 21, tileY + 11, { size: 9.5, bold: true, color: evidenceColor });
      text(doc, label.replace(/([A-Z])/g, ' $1'), x + 21, tileY + 20, { size: 4.9, color: C.muted, width: ew - 24, maxLines: 1 });
    });
  } else text(doc, limitations.slice(0, 3).map((item) => reportNarrative(item, '', t.locale)).join(' • ') || t.noDetails, M + 12, evidenceY + 48, { size: 8, width: CONTENT - 24, maxLines: 3 });
  const focusY = 659; const priorities = array(perspective.priorities).slice(0, 4);
  panel(doc, M, focusY, CONTENT, 89, { accent }); heading(doc, t.investorFocus, M + 12, focusY + 26, CONTENT - 24, accent);
  text(doc, displayValue(perspective.persona, t), W - M - 13, focusY + 25, { size: 7.2, bold: true, color: C.ink, align: 'right', width: 170, maxLines: 1 });
  priorities.forEach((priority, index) => {
    const yy = focusY + 45 + index * 10.5; const barX = M + 190; const barWidth = CONTENT - 215;
    const priorityColor = [accent, C.blue, C.green, C.purple][index % 4];
    text(doc, priority, M + 13, yy + 4, { size: 6.8, bold: true, width: 145, maxLines: 1 });
    meter(doc, barX, yy - 2, barWidth, 100 - index * 14, priorityColor);
  });
}
function renderInsights(doc, schema, t, accent, { verification = false } = {}) {
  const structured = schema?.structuredAnalysis || {};
  const summary = section(schema, 'executiveSummary') || {};
  const limitations = array(section(schema, 'limitations'));
  const steps = array(section(schema, 'verificationChecklist'));
  const attention = attentionObservations(summary);
  const structuredMissing = array(structured.missingEvidence);
  const structuredConcerns = array(structured.concerns);
  const structuredSteps = [...array(structured.recommendedVerificationSteps), ...array(structured.recommendedActions)];
  const missing = structuredMissing.length ? structuredMissing : (attention.length ? attention : limitations);
  const valuationWarnings = array(section(schema, 'valuationEvidence')?.warnings);
  const evidenceConflicts = array(section(schema, 'propertyEvidence')?.conflicts).map((item) => `${t.conflict} ${value(item?.field, '')}`.trim());
  const considerations = structuredConcerns.length ? structuredConcerns
    : attention.length ? limitations : [...valuationWarnings, ...evidenceConflicts].filter((item) => !missing.includes(item));
  const w = (CONTENT - 12) / 2;
  listPanel(doc, t.positives, array(structured.positiveSignals).length ? array(structured.positiveSignals) : positiveObservations(summary), M, 128, w, 258, t, accent, { positive: true });
  listPanel(doc, t.missing, missing, M + w + 12, 128, w, 258, t, accent);
  listPanel(doc, verification ? t.considerations : t.next, verification ? considerations : (structuredSteps.length ? structuredSteps : steps), M, 398, w, 257, t, accent);
  listPanel(doc, verification ? t.next : t.considerations, verification ? (structuredSteps.length ? structuredSteps : steps) : considerations, M + w + 12, 398, w, 257, t, accent);
  panel(doc, M, 667, CONTENT, 85, { fill: C.white, accent });
  heading(doc, t.conclusion, M + 12, 691, CONTENT - 24, accent);
  text(doc, structured.profileAdaptedConclusion || summary.summary || t.noDetails, M + 12, 714, { size: 9, width: CONTENT - 24, maxLines: 3 });
}
function renderComparables(doc, schema, t, accent, comparableMap) {
  const structured = schema?.structuredAnalysis || {};
  const property = section(schema, 'propertySummary') || {};
  const comps = section(schema, 'comparableEvidence') || {};
  const all = [...array(comps.used).map((v) => ({ ...v, status: 'USED' })), ...array(comps.supporting).map((v) => ({ ...v, status: 'SUPPORTING' })), ...array(comps.excluded).map((v) => ({ ...v, status: 'EXCLUDED' }))];
  panel(doc, M, 127, CONTENT, 78, { fill: C.white, stroke: softColor(accent, .64) });
  drawIcon(doc, 'house', M + 37, 166, accent, 42);
  text(doc, value(property.address || property.title, t.unavailable), M + 70, 151, { size: 12, bold: true, width: 220, maxLines: 1 });
  text(doc, location(property) || t.unavailable, M + 70, 169, { size: 8.2, color: C.muted, width: 220, maxLines: 1 });
  text(doc, currency(property.price, t), M + 70, 191, { size: 13, bold: true, color: accent });
  const subjectFacts = [`${value(property.beds, '–')} ${t.beds}`, `${value(property.baths, '–')} ${t.baths}`, `${value(property.sqft, '–')} sqft`];
  text(doc, subjectFacts.join('   ·   '), W - M - 12, 164, { size: 8.1, bold: true, color: C.ink, align: 'right' });
  text(doc, property.capRate == null ? '' : `${property.capRate}% ${t.capRate}`, W - M - 12, 184, { size: 8, color: C.muted, align: 'right' });
  panel(doc, M, 216, CONTENT, 184); heading(doc, t.compLocation, M + 12, 242, CONTENT - 24, accent);
  const points = [property, ...all].filter((v) => Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude)) && v.latitude != null && v.longitude != null);
  if (comparableMap) {
    photo(doc, M + 10, 251, CONTENT - 20, 135, comparableMap, t, { cover: true, radius: 6 });
    text(doc, t.mapAttribution, M + 14, 394, { size: 6, color: C.muted });
  } else if (points.length > 1) {
    const lat = points.map((p) => Number(p.latitude)); const lon = points.map((p) => Number(p.longitude));
    const minLat = Math.min(...lat); const minLon = Math.min(...lon); const spanLat = Math.max(0.001, Math.max(...lat) - minLat); const spanLon = Math.max(0.001, Math.max(...lon) - minLon);
    points.slice(0, 9).forEach((p, i) => {
      const xx = M + 38 + ((Number(p.longitude) - minLon) / spanLon) * (CONTENT - 75);
      const yy = 370 - ((Number(p.latitude) - minLat) / spanLat) * 105;
      doc.setFillColor(...(i ? accent : C.ink)); doc.circle(xx, yy, 9, 'F');
      text(doc, i ? String(i) : 'S', xx, yy + 3, { size: 9, bold: true, color: C.white, align: 'center' });
    });
    text(doc, t.coordinateMap, M + 12, 392, { size: 7.5, color: C.muted });
  } else text(doc, t.noMap, M + 16, 305, { size: 9, color: C.muted, width: CONTENT - 32 });
  panel(doc, M, 411, CONTENT, 244); heading(doc, t.comps, M + 12, 437, CONTENT - 24, accent);
  const columns = [M + 12, M + 183, M + 266, M + 329, M + 375, M + 426, M + 478];
  [t.address, t.salePrice, t.date, t.bedsBaths, t.sqft, t.similarity, t.status].forEach((label, i) => text(doc, label, columns[i], 460, { size: 7.1, bold: true, color: C.muted }));
  doc.setDrawColor(...C.line); doc.line(M + 12, 470, W - M - 12, 470);
  if (!all.length) text(doc, t.noComps, M + 12, 498, { size: 9, width: CONTENT - 24 });
  all.slice(0, 8).forEach((comp, i) => {
    const yy = 488 + i * 21;
    if (i % 2 === 0) {
      doc.setFillColor(...softColor(accent, .965));
      doc.roundedRect(M + 9, yy - 13, CONTENT - 18, 19, 3, 3, 'F');
    }
    text(doc, comp.address || t.unavailable, columns[0], yy, { size: 7.1, width: 160, maxLines: 1 });
    text(doc, currency(comp.salePrice, t), columns[1], yy, { size: 7.1 });
    text(doc, value(comp.saleDate, t.unavailable).slice(0, 10), columns[2], yy, { size: 7.1 });
    text(doc, `${value(comp.beds, '–')} / ${value(comp.baths, '–')}`, columns[3], yy, { size: 7.1 });
    text(doc, value(comp.sqft, '–'), columns[4], yy, { size: 7.1 });
    text(doc, comp.similarity == null ? '–' : `${Math.round(Number(comp.similarity))}%`, columns[5], yy, { size: 7.1 });
    const statusColor = comp.status === 'USED' ? C.green : comp.status === 'SUPPORTING' ? accent : C.muted;
    doc.setFillColor(...softColor(statusColor, .82)); doc.roundedRect(columns[6] - 4, yy - 11, 50, 15, 5, 5, 'F');
    text(doc, t[comp.status.toLowerCase()], columns[6] + 21, yy, { size: 6.2, bold: true, color: statusColor, width: 46, maxLines: 1, align: 'center' });
    doc.setDrawColor(...C.line); doc.line(M + 12, yy + 8, W - M - 12, yy + 8);
  });
  if (all.length > 0 && all.length <= 5) {
    const prices = all.map((comp) => Number(comp.salePrice)).filter((entry) => Number.isFinite(entry) && entry > 0);
    const similarities = all.map((comp) => Number(comp.similarity)).filter(Number.isFinite);
    const statY = Math.min(591, 500 + all.length * 21);
    const statGap = 6; const statW = (CONTENT - 24 - statGap * 3) / 4;
    const stats = [
      [t.totalComps, String(all.length), 'document'],
      [t.usedComparables, String(array(comps.used).length), 'check'],
      [t.averageSalePrice, prices.length ? currency(prices.reduce((sum, entry) => sum + entry, 0) / prices.length, t) : t.unavailable, 'trend'],
      [t.averageSimilarity, similarities.length ? `${Math.round(similarities.reduce((sum, entry) => sum + entry, 0) / similarities.length)}%` : '—', 'chart'],
    ];
    stats.forEach(([label, entry, kind], index) => {
      const x = M + 12 + index * (statW + statGap);
      panel(doc, x, statY, statW, 53, { fill: C.white, stroke: softColor(accent, .75), radius: 7 });
      drawIcon(doc, kind, x + 15, statY + 16, accent, 16);
      text(doc, label, x + 29, statY + 18, { size: 6.1, color: C.muted, width: statW - 35, maxLines: 2 });
      text(doc, entry, x + statW / 2, statY + 43, { size: 10.5, bold: true, color: accent, width: statW - 10, maxLines: 1, align: 'center' });
    });
  }
  const compNarrative = [structured.comparativeAnalysis?.interpretation,
    ...array(structured.comparativeAnalysis?.limitations)].filter(Boolean);
  listPanel(doc, t.observations, compNarrative.length ? compNarrative : all.map((comp) => comp.inclusionReason || comp.exclusionReason).filter(Boolean), M, 667, CONTENT, 88, t, accent);
}
function renderValuation(doc, schema, t, accent) {
  const structured = schema?.structuredAnalysis || {};
  const valuation = section(schema, 'valuationEvidence') || {};
  const property = section(schema, 'propertySummary') || {};
  const metrics = schema?.presentation?.existingMetrics || {};
  const compStats = schema?.presentation?.comparableStatistics || {};
  const scenarios = schema?.presentation?.kpiScenarios;
  panel(doc, M, 127, CONTENT, 175, { fill: C.white, stroke: C.gold });
  heading(doc, t.arv, M + 14, 155, CONTENT - 28, accent);
  const arv = valuation.status !== 'ARV_UNAVAILABLE' && valuation.range
    ? `${currency(valuation.range.low, t)} – ${currency(valuation.range.high, t)}` : t.unavailable;
  text(doc, arv, M + 14, 204, { size: 21, bold: true, color: C.ink });
  const valuationStatus = valuation.status === 'ARV_AVAILABLE' ? t.arvAvailable
    : valuation.status === 'ARV_LIMITED' ? t.arvLimited : t.arvUnavailable;
  text(doc, valuationStatus, M + 14, 230, { size: 9, bold: true, color: C.muted });
  text(doc, valuation.status === 'ARV_UNAVAILABLE' ? t.noArv : value(valuation.methodology, t.noDetails), M + 14, 253, { size: 8.5, width: valuation.range ? 285 : CONTENT - 28, maxLines: 2 });
  if (valuation.providerEstimate?.value) {
    text(doc, t.providerEstimate, M + 358, 185, { size: 8, bold: true, color: C.muted, width: 150, maxLines: 2 });
    text(doc, currency(valuation.providerEstimate.value, t), M + 358, 220, { size: 15, bold: true, color: C.ink, width: 150, maxLines: 1 });
    text(doc, t.providerEstimateStatus, M + 358, 241, { size: 7, color: C.muted, width: 150, maxLines: 2 });
  }
  if (valuation.status !== 'ARV_UNAVAILABLE' && valuation.range) {
    const low = Number(valuation.range.low); const high = Number(valuation.range.high);
    const middle = Number.isFinite(Number(valuation.centralReference)) ? Number(valuation.centralReference) : (low + high) / 2;
    const values = [low, middle, high];
    const labels = [t.low, t.middle, t.high];
    const maximum = Math.max(...values, 1); const originX = M + 360; const baseY = 267;
    values.forEach((entry, index) => {
      const barHeight = Math.max(24, (entry / maximum) * 72); const x = originX + index * 45;
      const barColors = [softColor(accent, .42), accent, darkColor(accent, .24)];
      doc.setFillColor(...barColors[index]); doc.roundedRect(x, baseY - barHeight, 26, barHeight, 4, 4, 'F');
      text(doc, labels[index], x + 13, baseY + 12, { size: 6.5, bold: true, color: C.muted, align: 'center' });
    });
  }
  const w = (CONTENT - 12) / 2;
  panel(doc, M, 315, w, 170); heading(doc, t.inputs, M + 12, 341, w - 24, accent);
  rows(doc, [[t.price, currency(property.price, t)], [t.rehab, property.rehab ? currency(property.rehab, t) : null], [t.compsUsed, valuation.compsUsed], [t.confidence, valuation.confidence], [t.marketPricePerSqft, compStats.marketPricePerSqft == null ? null : currency(compStats.marketPricePerSqft, t)], [t.averageDistance, compStats.averageDistanceMiles == null ? null : `${compStats.averageDistanceMiles} mi`]], M + 12, 365, w - 24, { lineHeight: 22, labelWidth: 105, limit: 6, t });
  panel(doc, M + w + 12, 315, w, 170); heading(doc, t.kpis, M + w + 24, 341, w - 24, accent);
  rows(doc, [
    [t.costBasis, metrics.acquisitionPlusRehab?.value == null ? null : currency(metrics.acquisitionPlusRehab.value, t)],
    [t.capRate, metrics.capRate?.value == null ? null : `${metrics.capRate.value}%`],
    [t.spread, scenarios?.available && Number.isFinite(Number(scenarios.potentialSpread?.find((v) => v.scenario === 'EXPECTED')?.value)) && scenarios.potentialSpread?.find((v) => v.scenario === 'EXPECTED')?.value != null
      ? `${Number(scenarios.potentialSpread.find((v) => v.scenario === 'EXPECTED').value) < 0 ? '-' : ''}$${Math.abs(Number(scenarios.potentialSpread.find((v) => v.scenario === 'EXPECTED').value)).toLocaleString('en-US')}` : null],
    [t.roiScenario, scenarios?.available && scenarios.projectedRoi?.find((v) => v.scenario === 'EXPECTED')?.value != null
      ? `${scenarios.projectedRoi.find((v) => v.scenario === 'EXPECTED').value}%` : null],
  ], M + w + 24, 365, w - 24, { lineHeight: 28, labelWidth: 105, t });
  const cardsY = 497; const cardsGap = 7; const cardW = (CONTENT - cardsGap * 3) / 4;
  const cards = [
    [t.pricePerSqft, metrics.pricePerSqft?.value == null ? t.unavailable : currency(metrics.pricePerSqft.value, t), t.price],
    [t.spread, scenarios?.available && scenarios.potentialSpread?.find((entry) => entry.scenario === 'EXPECTED')?.value != null
      ? `${Number(scenarios.potentialSpread.find((entry) => entry.scenario === 'EXPECTED').value) < 0 ? '-' : ''}$${Math.abs(Number(scenarios.potentialSpread.find((entry) => entry.scenario === 'EXPECTED').value)).toLocaleString('en-US')}` : t.unavailable, t.costBasis],
    [t.capRate, metrics.capRate?.value == null ? t.unavailable : `${metrics.capRate.value}%`, t.confidence],
    [t.subjectVsMarket, compStats.subjectVsMarketPercent == null ? t.unavailable : `${compStats.subjectVsMarketPercent > 0 ? '+' : ''}${compStats.subjectVsMarketPercent}%`, t.marketPricePerSqft],
  ];
  cards.forEach(([label, entry, caption], index) => {
    const x = M + index * (cardW + cardsGap); panel(doc, x, cardsY, cardW, 100, { fill: C.white, stroke: index === 1 ? C.gold : C.line });
    drawIcon(doc, index === 1 ? 'chart' : index === 2 ? 'check' : 'document', x + 20, cardsY + 23, accent, 18);
    text(doc, label, x + 35, cardsY + 28, { size: 8.5, bold: true, width: cardW - 45, maxLines: 1 });
    text(doc, entry, x + cardW / 2, cardsY + 63, { size: 12, bold: true, color: accent, align: 'center' });
    text(doc, caption, x + cardW / 2, cardsY + 84, { size: 7, color: C.muted, align: 'center' });
  });
  const valuationNarrative = array(structured.valuationAnalysis?.limitations);
  listPanel(doc, t.limitations, valuationNarrative.length ? valuationNarrative : (array(valuation.warnings).length ? array(valuation.warnings) : array(section(schema, 'limitations'))), M, 609, CONTENT, 129, t, accent);
}
function renderConclusion(doc, schema, t, accent) {
  const structured = schema?.structuredAnalysis || {};
  const summary = section(schema, 'executiveSummary') || {};
  const risks = array(section(schema, 'riskAssessment'));
  const steps = array(section(schema, 'verificationChecklist'));
  listPanel(doc, t.opportunity, [structured.opportunityAssessment || summary.summary].filter(Boolean), M, 128, CONTENT, 112, t, accent);
  const w = (CONTENT - 12) / 2;
  listPanel(doc, t.analysis, [structured.profileAdaptedConclusion, ...array(structured.positiveSignals)].filter(Boolean), M, 252, w, 203, t, accent, { positive: true });
  listPanel(doc, t.mainTopics, array(structured.strategySpecificInsights).length ? array(structured.strategySpecificInsights) : risks, M + w + 12, 252, w, 203, t, accent);
  listPanel(doc, t.questions, array(structured.missingEvidence).length ? array(structured.missingEvidence) : array(section(schema, 'limitations')), M, 467, w, 174, t, accent);
  listPanel(doc, t.actions, array(structured.recommendedActions).length ? array(structured.recommendedActions) : steps, M + w + 12, 467, w, 174, t, accent);
  panel(doc, M, 653, CONTENT, 99, { fill: C.white, stroke: C.gold, accent: C.orange });
  heading(doc, t.considerations, M + 12, 677, CONTENT - 24, accent);
  text(doc, t.disclaimer, M + 12, 702, { size: 8.5, width: CONTENT - 24, maxLines: 4 });
}
function renderPage(doc, schema, pageCode, t, accent, images, mapImage, comparableMap) {
  if (pageCode === 'PROPERTY_OVERVIEW') return renderPropertyOverview(doc, schema, t, accent, images, mapImage);
  if (pageCode === 'EXECUTIVE_SUMMARY_PROPERTY_CONTEXT') return renderExecutive(doc, schema, t, accent, images, mapImage);
  if (pageCode === 'INVESTMENT_FIT_RISK') return renderFit(doc, schema, t, accent);
  if (pageCode === 'KEY_INSIGHTS_NEXT_STEPS') return renderInsights(doc, schema, t, accent);
  if (pageCode === 'COMPARATIVE_MARKET_ANALYSIS') return renderComparables(doc, schema, t, accent, comparableMap);
  if (pageCode === 'VALUATION_INTELLIGENCE') return renderValuation(doc, schema, t, accent);
  if (pageCode === 'KEY_INSIGHTS_VERIFICATION') return renderInsights(doc, schema, t, accent, { verification: true });
  if (pageCode === 'MAXXIS_AI_ANALYSIS') return renderConclusion(doc, schema, t, accent);
}

async function resolveImageSource(source) {
  if (typeof source === 'string' && source.startsWith('data:image/')) return source;
  if (!source || typeof Image === 'undefined') return null;
  try {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.src = source;
    let timer;
    try {
      await Promise.race([
        image.decode(),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PHOTO_TIMEOUT')), 2500); }),
      ]);
    } finally { clearTimeout(timer); }
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch { return null; }
}
async function resolvePropertyImages(schema) {
  const sources = array(section(schema, 'propertySummary')?.images).slice(0, 5);
  return (await Promise.all(sources.map(resolveImageSource))).filter(Boolean);
}

const MAP_TILE_SIZE = 256;
const MAP_ZOOM = 14;

function mapWorldPoint(latitude, longitude, zoom = MAP_ZOOM) {
  const scale = MAP_TILE_SIZE * (2 ** zoom);
  const boundedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sinLatitude = Math.sin((boundedLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - (Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI))) * scale,
  };
}

async function loadMapTile(url) {
  if (typeof Image === 'undefined') return null;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  let timer;
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('MAP_TILE_LOAD_FAILED'));
      timer = setTimeout(() => reject(new Error('MAP_TILE_TIMEOUT')), 3500);
      image.src = url;
    });
    return image;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveStreetMap(schema) {
  const property = section(schema, 'propertySummary') || {};
  const latitude = Number(property.latitude);
  const longitude = Number(property.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
    || typeof document === 'undefined') return null;
  try {
    const width = 700;
    const height = 400;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.fillStyle = '#eef4f6';
    context.fillRect(0, 0, width, height);
    const center = mapWorldPoint(latitude, longitude);
    const left = center.x - (width / 2);
    const top = center.y - (height / 2);
    const firstTileX = Math.floor(left / MAP_TILE_SIZE);
    const lastTileX = Math.floor((left + width) / MAP_TILE_SIZE);
    const firstTileY = Math.floor(top / MAP_TILE_SIZE);
    const lastTileY = Math.floor((top + height) / MAP_TILE_SIZE);
    const tileCount = 2 ** MAP_ZOOM;
    const tiles = [];
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
        if (tileY < 0 || tileY >= tileCount) continue;
        const sourceX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push(loadMapTile(`https://tile.openstreetmap.org/${MAP_ZOOM}/${sourceX}/${tileY}.png`)
          .then((image) => ({ image, x: (tileX * MAP_TILE_SIZE) - left, y: (tileY * MAP_TILE_SIZE) - top })));
      }
    }
    const loaded = await Promise.all(tiles);
    if (!loaded.some((tile) => tile.image)) return null;
    loaded.forEach((tile) => {
      if (tile.image) context.drawImage(tile.image, tile.x, tile.y, MAP_TILE_SIZE, MAP_TILE_SIZE);
    });
    const pinX = width / 2;
    const pinY = height / 2;
    context.save();
    context.shadowColor = 'rgba(15, 32, 49, .35)';
    context.shadowBlur = 7;
    context.shadowOffsetY = 3;
    context.fillStyle = '#1db8bc';
    context.strokeStyle = '#ffffff';
    context.lineWidth = 5;
    context.beginPath();
    context.arc(pinX, pinY - 9, 16, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(pinX - 10, pinY + 2);
    context.lineTo(pinX, pinY + 22);
    context.lineTo(pinX + 10, pinY + 2);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function resolveComparableMap(schema) {
  const property = section(schema, 'propertySummary') || {};
  const comparables = section(schema, 'comparableEvidence') || {};
  const all = [
    { ...property, marker: 'S', markerTone: '#15384f' },
    ...array(comparables.used).map((item, index) => ({ ...item, marker: String(index + 1), markerTone: '#0d876f' })),
    ...array(comparables.supporting).map((item, index) => ({ ...item, marker: String(array(comparables.used).length + index + 1), markerTone: '#e6a416' })),
    ...array(comparables.excluded).map((item, index) => ({ ...item, marker: String(array(comparables.used).length + array(comparables.supporting).length + index + 1), markerTone: '#7b8995' })),
  ].filter((item) => item.latitude != null && item.longitude != null
    && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
  if (all.length < 2 || typeof document === 'undefined') return null;
  try {
    const width = 900; const height = 330; const padding = 65;
    let zoom = 16; let world = [];
    for (; zoom >= 10; zoom -= 1) {
      world = all.map((item) => ({ ...mapWorldPoint(Number(item.latitude), Number(item.longitude), zoom), item }));
      const spanX = Math.max(...world.map((point) => point.x)) - Math.min(...world.map((point) => point.x));
      const spanY = Math.max(...world.map((point) => point.y)) - Math.min(...world.map((point) => point.y));
      if (spanX <= width - padding * 2 && spanY <= height - padding * 2) break;
    }
    const minX = Math.min(...world.map((point) => point.x)); const maxX = Math.max(...world.map((point) => point.x));
    const minY = Math.min(...world.map((point) => point.y)); const maxY = Math.max(...world.map((point) => point.y));
    const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    const left = center.x - width / 2; const top = center.y - height / 2;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) return null;
    context.fillStyle = '#eef4f6'; context.fillRect(0, 0, width, height);
    const firstTileX = Math.floor(left / MAP_TILE_SIZE); const lastTileX = Math.floor((left + width) / MAP_TILE_SIZE);
    const firstTileY = Math.floor(top / MAP_TILE_SIZE); const lastTileY = Math.floor((top + height) / MAP_TILE_SIZE);
    const tileCount = 2 ** zoom; const tiles = [];
    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
        if (tileY < 0 || tileY >= tileCount) continue;
        const sourceX = ((tileX % tileCount) + tileCount) % tileCount;
        tiles.push(loadMapTile(`https://tile.openstreetmap.org/${zoom}/${sourceX}/${tileY}.png`)
          .then((image) => ({ image, x: tileX * MAP_TILE_SIZE - left, y: tileY * MAP_TILE_SIZE - top })));
      }
    }
    const loaded = await Promise.all(tiles); if (!loaded.some((tile) => tile.image)) return null;
    loaded.forEach((tile) => { if (tile.image) context.drawImage(tile.image, tile.x, tile.y, MAP_TILE_SIZE, MAP_TILE_SIZE); });
    world.forEach(({ x, y, item }) => {
      const px = x - left; const py = y - top;
      context.save(); context.shadowColor = 'rgba(15,32,49,.35)'; context.shadowBlur = 6; context.shadowOffsetY = 2;
      context.fillStyle = item.markerTone; context.strokeStyle = '#fff'; context.lineWidth = 4;
      context.beginPath(); context.arc(px, py, item.marker === 'S' ? 18 : 15, 0, Math.PI * 2); context.fill(); context.stroke();
      context.restore(); context.fillStyle = '#fff'; context.font = '700 16px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(item.marker, px, py + 1);
    });
    return canvas.toDataURL('image/png');
  } catch { return null; }
}

export async function renderMaxxisReportPdf({ schema, exportEntitlement, generatedAt, language = 'en', mapImageData = null } = {}) {
  const prepared = renderMaxxisReportDocument({ schema, exportEntitlement, generatedAt, language });
  if (prepared.state !== 'PREPARED') return prepared;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });
  doc.addFileToVFS('NotoSans-Regular.ttf', notoSansRegular.split(',')[1]);
  doc.addFileToVFS('NotoSans-Bold.ttf', notoSansBold.split(',')[1]);
  doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
  doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
  const pages = prepared.document.pages;
  const lang = prepared.document.language;
  const t = COPY[lang];
  const [images, mapImage, comparableMap] = await Promise.all([
    resolvePropertyImages(schema), mapImageData || resolveStreetMap(schema), resolveComparableMap(schema),
  ]);
  pages.forEach((page, index) => {
    if (index) doc.addPage('a4', 'portrait');
    const { accent } = pageHeader(doc, schema, page.code, t);
    renderPage(doc, schema, page.code, t, accent, images, mapImage, comparableMap);
    pageFooter(doc, index + 1, pages.length, prepared.document.cover.generatedAt, lang, t);
  });
  const binary = new Uint8Array(doc.output('arraybuffer'));
  return Object.freeze({ state: 'RENDERED', document: Object.freeze({
    ...prepared.document, binary, pageCount: doc.getNumberOfPages(), mimeType: 'application/pdf',
  }) });
}

export function downloadMaxxisReportPdf(document, fileName = 'maxxis-report.pdf') {
  if (!document?.binary?.length || typeof window === 'undefined') return false;
  const blob = new Blob([document.binary], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = url; anchor.download = fileName; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 15000);
  return true;
}
