import officialDealSifterLogo from '../../../assets/maxxis/report-official-logo.png?inline';
import notoSansRegular from '../../../assets/maxxis/fonts/NotoSans-Regular.ttf?inline';
import notoSansBold from '../../../assets/maxxis/fonts/NotoSans-Bold.ttf?inline';
import { renderMaxxisReportDocument } from './maxxisReportRenderer';

// The same page functions render real reports and the isolated commercial fixture.
// They only read the authorized report schema; no provider or AI work happens here.
const W = 595.28;
const H = 841.89;
const M = 30;
const CONTENT = W - M * 2;
const C = Object.freeze({
  navy: [15, 32, 49], graphite: [39, 45, 48], teal: [29, 184, 188],
  blue: [24, 114, 190], green: [13, 135, 111], gold: [237, 176, 28],
  white: [255, 255, 255], ink: [27, 42, 60], muted: [91, 110, 129],
  line: [216, 228, 234], pale: [246, 250, 252], warm: [255, 250, 237],
});
const COPY = Object.freeze({
  en: {
    generated: 'Generated', page: 'Page', unavailable: 'Unavailable', notVerified: 'Not verified', published: 'Published',
    property: 'PROPERTY RELEASE', pro: 'MAXXIS ANALYSIS REPORT', deal: 'MAXXIS DEAL INTELLIGENCE REPORT',
    PROPERTY_OVERVIEW: 'Property Overview', EXECUTIVE_SUMMARY_PROPERTY_CONTEXT: 'Executive Summary',
    INVESTMENT_FIT_RISK: 'Investment Fit & Risk Analysis', KEY_INSIGHTS_NEXT_STEPS: 'Key Insights & Next Steps',
    COMPARATIVE_MARKET_ANALYSIS: 'Comparative Market Analysis', VALUATION_INTELLIGENCE: 'Valuation Intelligence / ARV / KPIs',
    KEY_INSIGHTS_VERIFICATION: 'Key Insights & Verification', MAXXIS_AI_ANALYSIS: 'Maxxis AI Analysis',
    owner: 'Owner Information', facts: 'Property Details', land: 'Land Information', photos: 'Property Photos',
    location: 'Location', notes: 'Notes', status: 'Status', type: 'Type', strategy: 'Strategy',
    price: 'Price', beds: 'Beds', baths: 'Baths', sqft: 'Living area', lot: 'Lot size',
    source: 'Source', ownerName: 'Owner', ownerType: 'Owner type', contacts: 'Contacts',
    capRate: 'Cap rate', rehab: 'Rehab', noPhoto: 'No property photo available',
    noMap: 'Street map unavailable; location is shown from stored property data.',
    context: 'Property context', opportunity: 'Opportunity Summary', conclusion: 'Maxxis executive insight',
    profile: 'Investor Profile', compatibility: 'Profile Compatibility', fit: 'Fit by Criterion',
    risks: 'Risk Analysis', evidence: 'Evidence Considerations', positives: 'Positive Signals',
    missing: "What's Missing", next: 'Recommended Next Steps', considerations: 'Key Considerations',
    comps: 'Recorded Sold Comparables', compLocation: 'Comparable Locations', observations: 'Analysis Observations',
    arv: 'Estimated ARV Range', inputs: 'Valuation Inputs', kpis: 'Investment Scenarios',
    limitations: 'Valuation Limitations', mainTopics: 'Main Topics', questions: 'Open Questions',
    actions: 'Recommended Actions', analysis: 'Profile-adapted conclusion',
    disclaimer: 'Evidence-based decision support only. Not an appraisal or financial, legal, or investment advice.',
    noComps: 'No recorded sold comparables available for this report.',
    noArv: 'ARV unavailable under the current deterministic evidence gates.',
    noDetails: 'No additional verified details available.', portfolio: 'Portfolio', yes: 'Yes', no: 'No',
    coordinateMap: 'Schematic positions from stored coordinates; not a street map.',
    address: 'Address', salePrice: 'Sale price', date: 'Date', distance: 'Distance',
    used: 'USED', supporting: 'SUPPORTING', excluded: 'EXCLUDED',
    compsUsed: 'Comps used', confidence: 'Confidence', pricePerSqft: 'Price / sqft',
    costBasis: 'Cost basis', spread: 'Spread', roiScenario: 'ROI scenario',
    conflict: 'Needs verification: stored evidence conflicts with the narrative.',
  },
  pt: {
    generated: 'Gerado em', page: 'Página', unavailable: 'Indisponível', notVerified: 'Não verificado', published: 'Publicado',
    property: 'PROPERTY RELEASE', pro: 'MAXXIS ANALYSIS REPORT', deal: 'MAXXIS DEAL INTELLIGENCE REPORT',
    PROPERTY_OVERVIEW: 'Visão geral do imóvel', EXECUTIVE_SUMMARY_PROPERTY_CONTEXT: 'Resumo executivo',
    INVESTMENT_FIT_RISK: 'Adequação e análise de riscos', KEY_INSIGHTS_NEXT_STEPS: 'Insights e próximos passos',
    COMPARATIVE_MARKET_ANALYSIS: 'Análise comparativa de mercado', VALUATION_INTELLIGENCE: 'Avaliação / ARV / indicadores',
    KEY_INSIGHTS_VERIFICATION: 'Insights e verificações', MAXXIS_AI_ANALYSIS: 'Análise Maxxis AI',
    owner: 'Dados do proprietário', facts: 'Detalhes do imóvel', land: 'Dados do terreno', photos: 'Fotos do imóvel',
    location: 'Localização', notes: 'Notas', status: 'Status', type: 'Tipo', strategy: 'Estratégia',
    price: 'Preço', beds: 'Quartos', baths: 'Banheiros', sqft: 'Área útil', lot: 'Área do lote',
    source: 'Fonte', ownerName: 'Proprietário', ownerType: 'Tipo de proprietário', contacts: 'Contatos',
    capRate: 'Cap rate', rehab: 'Reforma', noPhoto: 'Sem foto disponível do imóvel',
    noMap: 'Mapa de ruas indisponível; localização baseada nos dados cadastrados.',
    context: 'Contexto do imóvel', opportunity: 'Resumo da oportunidade', conclusion: 'Insight executivo do Maxxis',
    profile: 'Perfil do investidor', compatibility: 'Compatibilidade do perfil', fit: 'Adequação por critério',
    risks: 'Análise de riscos', evidence: 'Considerações sobre evidências', positives: 'Sinais positivos',
    missing: 'O que falta', next: 'Próximos passos recomendados', considerations: 'Pontos de atenção',
    comps: 'Comparáveis vendidos registrados', compLocation: 'Localização dos comparáveis', observations: 'Observações da análise',
    arv: 'Faixa estimada de ARV', inputs: 'Dados da avaliação', kpis: 'Cenários de investimento',
    limitations: 'Limitações da avaliação', mainTopics: 'Tópicos principais', questions: 'Questões abertas',
    actions: 'Ações recomendadas', analysis: 'Conclusão adaptada ao perfil',
    disclaimer: 'Análise baseada em evidências. Não constitui avaliação imobiliária nem aconselhamento financeiro, jurídico ou de investimento.',
    noComps: 'Não há comparáveis vendidos registrados para este relatório.',
    noArv: 'ARV indisponível segundo os critérios determinísticos de evidência.',
    noDetails: 'Não há detalhes verificados adicionais.', portfolio: 'Portfólio', yes: 'Sim', no: 'Não',
    coordinateMap: 'Posições esquemáticas das coordenadas armazenadas; não é um mapa de ruas.',
    address: 'Endereço', salePrice: 'Preço de venda', date: 'Data', distance: 'Distância',
    used: 'USADO', supporting: 'SUPORTE', excluded: 'EXCLUÍDO',
    compsUsed: 'Comps usados', confidence: 'Confiança', pricePerSqft: 'Preço / sqft',
    costBasis: 'Custo base', spread: 'Margem', roiScenario: 'Cenário de ROI',
    conflict: 'Requer verificação: evidências estruturadas divergem do texto.',
  },
  es: {
    generated: 'Generado', page: 'Página', unavailable: 'No disponible', notVerified: 'No verificado', published: 'Publicado',
    property: 'PROPERTY RELEASE', pro: 'MAXXIS ANALYSIS REPORT', deal: 'MAXXIS DEAL INTELLIGENCE REPORT',
    PROPERTY_OVERVIEW: 'Resumen de la propiedad', EXECUTIVE_SUMMARY_PROPERTY_CONTEXT: 'Resumen ejecutivo',
    INVESTMENT_FIT_RISK: 'Afinidad y análisis de riesgos', KEY_INSIGHTS_NEXT_STEPS: 'Hallazgos y próximos pasos',
    COMPARATIVE_MARKET_ANALYSIS: 'Análisis comparativo de mercado', VALUATION_INTELLIGENCE: 'Valoración / ARV / indicadores',
    KEY_INSIGHTS_VERIFICATION: 'Hallazgos y verificación', MAXXIS_AI_ANALYSIS: 'Análisis de Maxxis AI',
    owner: 'Datos del propietario', facts: 'Detalles de la propiedad', land: 'Datos del terreno', photos: 'Fotos de la propiedad',
    location: 'Ubicación', notes: 'Notas', status: 'Estado', type: 'Tipo', strategy: 'Estrategia',
    price: 'Precio', beds: 'Habitaciones', baths: 'Baños', sqft: 'Superficie habitable', lot: 'Superficie del lote',
    source: 'Fuente', ownerName: 'Propietario', ownerType: 'Tipo de propietario', contacts: 'Contactos',
    capRate: 'Cap rate', rehab: 'Reforma', noPhoto: 'No hay foto disponible de la propiedad',
    noMap: 'Mapa de calles no disponible; ubicación según los datos registrados.',
    context: 'Contexto de la propiedad', opportunity: 'Resumen de la oportunidad', conclusion: 'Análisis ejecutivo de Maxxis',
    profile: 'Perfil del inversor', compatibility: 'Compatibilidad del perfil', fit: 'Afinidad por criterio',
    risks: 'Análisis de riesgos', evidence: 'Consideraciones de evidencia', positives: 'Señales positivas',
    missing: 'Qué falta', next: 'Próximos pasos recomendados', considerations: 'Puntos de atención',
    comps: 'Comparables vendidos registrados', compLocation: 'Ubicación de comparables', observations: 'Observaciones del análisis',
    arv: 'Rango ARV estimado', inputs: 'Datos de la valoración', kpis: 'Escenarios de inversión',
    limitations: 'Limitaciones de la valoración', mainTopics: 'Temas principales', questions: 'Preguntas abiertas',
    actions: 'Acciones recomendadas', analysis: 'Conclusión adaptada al perfil',
    disclaimer: 'Análisis basado en evidencias. No es una tasación ni asesoramiento financiero, legal o de inversión.',
    noComps: 'No hay comparables vendidos registrados para este informe.',
    noArv: 'ARV no disponible según los criterios determinísticos de evidencia.',
    noDetails: 'No hay detalles verificados adicionales.', portfolio: 'Cartera', yes: 'Sí', no: 'No',
    coordinateMap: 'Posiciones esquemáticas de coordenadas guardadas; no es un mapa de calles.',
    address: 'Dirección', salePrice: 'Precio de venta', date: 'Fecha', distance: 'Distancia',
    used: 'USADO', supporting: 'APOYO', excluded: 'EXCLUIDO',
    compsUsed: 'Comps usados', confidence: 'Confianza', pricePerSqft: 'Precio / sqft',
    costBasis: 'Costo base', spread: 'Diferencia', roiScenario: 'Escenario de ROI',
    conflict: 'Requiere verificación: la evidencia estructurada difiere del texto.',
  },
});
const section = (schema, key) => schema?.sections?.[key]?.available ? schema.sections[key].data : null;
const array = (value) => Array.isArray(value) ? value : [];
const positiveObservations = (summary) => Array.isArray(summary?.observations)
  ? summary.observations : array(summary?.observations?.positives);
const attentionObservations = (summary) => array(summary?.observations?.attention);
const value = (input, fallback) => input === null || input === undefined || input === '' ? fallback : String(input);
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
function panel(doc, x, y, w, h, { fill = C.white, stroke = C.line, radius = 8 } = {}) {
  doc.setFillColor(...fill); doc.setDrawColor(...stroke);
  doc.roundedRect(x, y, w, h, radius, radius, 'FD');
}
function iconKind(title) {
  const normalized = String(title || '').toLowerCase();
  if (/owner|propriet|perfil|profile/.test(normalized)) return 'person';
  if (/location|localiza|ubicaci|map|terreno|land/.test(normalized)) return 'pin';
  if (/photo|foto/.test(normalized)) return 'camera';
  if (/risk|risco|riesgo|missing|falta|limita|warning|atenção|atenci/.test(normalized)) return 'warning';
  if (/positive|positivo|evidence|evidência|evidencia/.test(normalized)) return 'check';
  if (/valuation|avalia|valoraci|arv|kpi|compatib|fit|adequação|afinidad|spread|roi/.test(normalized)) return 'chart';
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
  drawIcon(doc, iconKind(title), x + 8, y - 5, accent, 17);
  text(doc, title, x + 22, y, { size: 12, bold: true, width: w - 22, maxLines: 1 });
}
function rows(doc, items, x, y, w, { lineHeight = 24, labelWidth = 95, limit = 8, t } = {}) {
  let yy = y;
  items.slice(0, limit).forEach(([label, entry], i) => {
    text(doc, label, x, yy, { size: 8, color: C.muted, width: labelWidth - 5, maxLines: 1 });
    text(doc, value(entry, t.unavailable), x + labelWidth, yy, { size: 8.5, bold: true, width: w - labelWidth, maxLines: 2 });
    const lines = doc.splitTextToSize(value(entry, t.unavailable), w - labelWidth).length;
    const step = Math.max(lineHeight, Math.min(2, lines) * 12 + 5);
    if (i < Math.min(limit, items.length) - 1) {
      doc.setDrawColor(...C.line); doc.line(x, yy + step - 10, x + w, yy + step - 10);
    }
    yy += step;
  });
}
function listPanel(doc, title, items, x, y, w, h, t, accent, { positive = false } = {}) {
  panel(doc, x, y, w, h, { fill: positive ? [244, 252, 250] : C.white });
  heading(doc, title, x + 13, y + 26, w - 26, accent);
  let yy = y + 48;
  const entries = items.length ? items : [t.noDetails];
  for (const item of entries.slice(0, 6)) {
    if (yy > y + h - 28) break;
    doc.setFillColor(...accent); doc.circle(x + 19, yy - 2, 2.5, 'F');
    yy = text(doc, typeof item === 'string' ? item : item?.explanation || item?.reason || item?.label || item?.status || t.noDetails,
      x + 30, yy, { size: 8.5, width: w - 44, maxLines: 3 }) + 7;
  }
}
function pageHeader(doc, schema, pageCode, t) {
  const theme = themeFor(schema.reportType); const accent = accentFor(schema.reportType);
  doc.setFillColor(...theme); doc.rect(0, 0, W, 78, 'F');
  // Proportional resize of the official transparent source PNG; no redraw or recoloring.
  doc.addImage(officialDealSifterLogo, 'PNG', M, 15, 177, 52.6, 'official-dealsifter-logo');
  text(doc, productFor(schema.reportType, t), W - 84, 30, { size: 10.5, bold: true, color: C.white, align: 'right' });
  panel(doc, W - 101, 42, 70, 23, { fill: accent, stroke: accent, radius: 5 });
  text(doc, planFor(schema.reportType), W - 66, 57, { size: 9, bold: true, color: schema.reportType === 'DEAL_INTELLIGENCE' ? C.ink : C.white, align: 'center' });
  heading(doc, schema.reportType === 'PROPERTY_RELEASE' ? 'Property Release' : t[pageCode] || pageCode, M, 108, CONTENT, accent);
  return { accent, theme };
}
function pageFooter(doc, page, total, generatedAt, language, t) {
  doc.setDrawColor(...C.line); doc.line(M, 803, W - M, 803);
  const locale = language === 'pt' ? 'pt-BR' : language === 'es' ? 'es-ES' : 'en-US';
  const stamp = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(generatedAt));
  text(doc, `${t.generated}: ${stamp} UTC`, M, 822, { size: 7.4, color: C.muted });
  text(doc, `${t.page} ${page} / ${total}`, W - M, 822, { size: 7.4, color: C.muted, align: 'right' });
}
function photo(doc, x, y, w, h, imageData, t) {
  panel(doc, x, y, w, h, { fill: [238, 246, 248] });
  if (imageData) {
    try {
      const properties = doc.getImageProperties(imageData);
      const ratio = Math.min(w / properties.width, h / properties.height);
      const iw = properties.width * ratio; const ih = properties.height * ratio;
      doc.addImage(imageData, properties.fileType || 'JPEG', x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
      return;
    } catch { /* Preserve factual report if media cannot be embedded. */ }
  }
  text(doc, t.noPhoto, x + w / 2, y + h / 2, { size: 9, color: C.muted, align: 'center' });
}
function propertyHero(doc, property, t, accent, imageData, { compact = false } = {}) {
  const y = 127; const h = compact ? 158 : 196;
  panel(doc, M, y, CONTENT, h);
  doc.setFillColor(...accent); doc.roundedRect(M + 12, y + 12, 66, 20, 4, 4, 'F');
  text(doc, property.published ? t.published : t.notVerified, M + 45, y + 26, { size: 8, bold: true, color: C.white, align: 'center' });
  text(doc, value(property.address || property.title, t.unavailable), M + 13, y + 54, { size: compact ? 14 : 16, bold: true, width: 270, maxLines: 2 });
  text(doc, location(property) || t.unavailable, M + 13, y + 77, { size: 10, color: C.muted, width: 260, maxLines: 2 });
  text(doc, currency(property.price, t), M + 13, y + 112, { size: compact ? 20 : 24, bold: true, color: accent });
  const facts = [`${value(property.beds, '–')} ${t.beds}`, `${value(property.baths, '–')} ${t.baths}`, `${value(property.sqft, '–')} sqft`];
  text(doc, facts.join('   ·   '), M + 13, y + 140, { size: 8.8, bold: true, width: 260, maxLines: 2 });
  if (!compact) text(doc, [property.type, property.objective].filter(Boolean).join('   ·   ') || t.unavailable, M + 13, y + 169, { size: 8.5, color: C.muted, width: 260 });
  photo(doc, M + 300, y + 10, CONTENT - 312, h - 20, imageData, t);
  return y + h;
}
function propertyFactGrid(doc, property, t, accent, y) {
  const gap = 9; const w = (CONTENT - gap * 2) / 3; const h = 153;
  const owner = property.owner || {};
  const facts = [
    [t.owner, [[t.ownerName, owner.name], [t.ownerType, owner.type], [t.status, owner.status], [t.contacts, array(owner.allowedContacts).map((c) => c.value).filter(Boolean).join(', ')]]],
    [t.facts, [[t.type, property.type], [t.strategy, property.objective], [t.beds, property.beds], [t.baths, property.baths], [t.sqft, property.sqft], [t.rehab, property.rehab ? currency(property.rehab, t) : null]]],
    [t.land, [[t.location, [property.city, property.state].filter(Boolean).join(', ')], [t.lot, property.lot], [t.capRate, property.capRate ? `${property.capRate}%` : null], [t.source, property.source], [t.portfolio, property.portfolio == null ? null : property.portfolio ? t.yes : t.no]]],
  ];
  facts.forEach(([title, entries], i) => {
    const x = M + i * (w + gap); panel(doc, x, y, w, h);
    heading(doc, title, x + 10, y + 23, w - 20, accent);
    rows(doc, entries, x + 10, y + 45, w - 20, { lineHeight: 18, labelWidth: 64, limit: 6, t });
  });
  return y + h;
}
function propertyBottom(doc, property, t, accent, y, images, conflicts = []) {
  panel(doc, M, y, CONTENT, 96); heading(doc, t.photos, M + 12, y + 25, CONTENT - 24, accent);
  const shown = images.length ? images.slice(0, 4) : [null];
  const photoGap = 7; const photoWidth = (CONTENT - 24 - photoGap * 3) / 4;
  shown.forEach((image, index) => photo(doc, M + 12 + index * (photoWidth + photoGap), y + 38, photoWidth, 48, image, t));
  y += 108;
  const w = (CONTENT - 10) / 2;
  panel(doc, M, y, w, 145); heading(doc, t.location, M + 12, y + 25, w - 24, accent);
  text(doc, location(property) || t.unavailable, M + 13, y + 52, { size: 10, bold: true, width: w - 25 });
  if (property.latitude != null && property.longitude != null) text(doc, `${property.latitude}, ${property.longitude}`, M + 13, y + 73, { size: 8, color: C.muted });
  text(doc, t.noMap, M + 13, y + 101, { size: 8, color: C.muted, width: w - 25, maxLines: 3 });
  panel(doc, M + w + 10, y, w, 145); heading(doc, t.notes, M + w + 22, y + 25, w - 24, accent);
  text(doc, property.notes || property.description || t.unavailable, M + w + 22, y + 48, { size: 8.5, width: w - 25, maxLines: conflicts.length ? 5 : 8 });
  if (conflicts.length) text(doc, t.conflict, M + w + 22, y + 127, { size: 7.5, bold: true, color: C.gold, width: w - 25, maxLines: 2 });
}
function renderPropertyOverview(doc, schema, t, accent, images) {
  const property = section(schema, 'propertySummary') || {};
  propertyHero(doc, property, t, accent, images[0]);
  propertyFactGrid(doc, property, t, accent, 335);
  propertyBottom(doc, property, t, accent, 499, images, array(section(schema, 'propertyEvidence')?.conflicts));
}
function renderExecutive(doc, schema, t, accent, images) {
  const property = section(schema, 'propertySummary') || {};
  const summary = section(schema, 'executiveSummary') || {};
  propertyHero(doc, property, t, accent, images[0], { compact: true });
  const y = 297; const gap = 10; const w = (CONTENT - gap * 2) / 3;
  [[t.type, property.type], [t.strategy, property.objective], [t.location, location(property)]].forEach(([label, entry], i) => {
    const x = M + i * (w + gap); panel(doc, x, y, w, 83);
    heading(doc, label, x + 11, y + 24, w - 22, accent);
    text(doc, value(entry, t.unavailable), x + 11, y + 50, { size: 10, bold: true, width: w - 22, maxLines: 2 });
  });
  listPanel(doc, t.opportunity, [summary.summary].filter(Boolean), M, 394, CONTENT, 145, t, accent);
  listPanel(doc, t.conclusion, positiveObservations(summary), M, 551, CONTENT, 182, t, accent, { positive: true });
}
function profileRows(profile, t) {
  return [
    [t.compatibility, profile.score == null ? t.unavailable : `${profile.score}%`],
    [t.location, profile.targetMarket?.explanation || profile.targetMarket?.status],
    [t.type, profile.propertyType?.explanation || profile.propertyType?.status],
    [t.strategy, profile.strategy?.explanation || profile.strategy?.status],
  ];
}
function renderFit(doc, schema, t, accent) {
  const profile = section(schema, 'investmentProfile') || {};
  const risks = array(section(schema, 'riskAssessment'));
  const limitations = array(section(schema, 'limitations'));
  const property = section(schema, 'propertySummary') || {};
  panel(doc, M, 127, CONTENT, 41, { fill: C.pale });
  text(doc, [property.address, location(property)].filter(Boolean).join(' · ') || t.unavailable, M + 13, 153, { size: 10, bold: true, width: CONTENT - 26 });
  const w = (CONTENT - 12) / 2;
  panel(doc, M, 181, w, 218); heading(doc, t.profile, M + 12, 207, w - 24, accent);
  rows(doc, profileRows(profile, t), M + 12, 235, w - 24, { lineHeight: 35, labelWidth: 89, t });
  panel(doc, M + w + 12, 181, w, 218); heading(doc, t.compatibility, M + w + 24, 207, w - 24, accent);
  if (Number.isFinite(Number(profile.score))) {
    const score = Math.max(0, Math.min(100, Number(profile.score)));
    doc.setDrawColor(...C.line); doc.setLineWidth(15); doc.circle(M + w + 12 + w / 2, 296, 52, 'S');
    doc.setDrawColor(...accent); doc.setLineWidth(15);
    // Gauge is visualization of the existing score, not a new score calculation.
    const points = Array.from({ length: Math.max(2, Math.ceil(score / 3)) }, (_, i) => {
      const a = (-Math.PI / 2) + ((i / Math.max(1, Math.ceil(score / 3) - 1)) * (score / 100) * Math.PI * 2);
      return [M + w + 12 + w / 2 + 52 * Math.cos(a), 296 + 52 * Math.sin(a)];
    });
    points.slice(1).forEach((p, i) => doc.line(...points[i], ...p));
    doc.setLineWidth(0.2);
    text(doc, `${score}%`, M + w + 12 + w / 2, 304, { size: 26, bold: true, align: 'center' });
  } else text(doc, t.unavailable, M + w + 12 + w / 2, 302, { size: 11, align: 'center' });
  listPanel(doc, t.fit, profileRows(profile, t).slice(1).map(([label, entry]) => `${label}: ${value(entry, t.unavailable)}`), M, 412, w, 167, t, accent);
  listPanel(doc, t.risks, risks, M + w + 12, 412, w, 167, t, accent);
  listPanel(doc, t.evidence, limitations, M, 591, CONTENT, 157, t, accent);
}
function renderInsights(doc, schema, t, accent, { verification = false } = {}) {
  const summary = section(schema, 'executiveSummary') || {};
  const limitations = array(section(schema, 'limitations'));
  const steps = array(section(schema, 'verificationChecklist'));
  const attention = attentionObservations(summary);
  const missing = attention.length ? attention : limitations;
  const valuationWarnings = array(section(schema, 'valuationEvidence')?.warnings);
  const evidenceConflicts = array(section(schema, 'propertyEvidence')?.conflicts).map((item) => `${t.conflict} ${value(item?.field, '')}`.trim());
  const considerations = attention.length ? limitations : [...valuationWarnings, ...evidenceConflicts].filter((item) => !missing.includes(item));
  const w = (CONTENT - 12) / 2;
  listPanel(doc, t.positives, positiveObservations(summary), M, 128, w, 258, t, accent, { positive: true });
  listPanel(doc, t.missing, missing, M + w + 12, 128, w, 258, t, accent);
  listPanel(doc, verification ? t.considerations : t.next, verification ? considerations : steps, M, 398, w, 257, t, accent);
  listPanel(doc, verification ? t.next : t.considerations, verification ? steps : considerations, M + w + 12, 398, w, 257, t, accent);
  panel(doc, M, 667, CONTENT, 85, { fill: C.pale });
  heading(doc, t.conclusion, M + 12, 691, CONTENT - 24, accent);
  text(doc, summary.summary || t.noDetails, M + 12, 714, { size: 9, width: CONTENT - 24, maxLines: 3 });
}
function renderComparables(doc, schema, t, accent) {
  const property = section(schema, 'propertySummary') || {};
  const comps = section(schema, 'comparableEvidence') || {};
  const all = [...array(comps.used).map((v) => ({ ...v, status: 'USED' })), ...array(comps.supporting).map((v) => ({ ...v, status: 'SUPPORTING' })), ...array(comps.excluded).map((v) => ({ ...v, status: 'EXCLUDED' }))];
  panel(doc, M, 127, CONTENT, 210); heading(doc, t.compLocation, M + 12, 153, CONTENT - 24, accent);
  const points = [property, ...all].filter((v) => Number.isFinite(Number(v.latitude)) && Number.isFinite(Number(v.longitude)) && v.latitude != null && v.longitude != null);
  if (points.length > 1) {
    const lat = points.map((p) => Number(p.latitude)); const lon = points.map((p) => Number(p.longitude));
    const minLat = Math.min(...lat); const minLon = Math.min(...lon); const spanLat = Math.max(0.001, Math.max(...lat) - minLat); const spanLon = Math.max(0.001, Math.max(...lon) - minLon);
    points.slice(0, 9).forEach((p, i) => {
      const xx = M + 38 + ((Number(p.longitude) - minLon) / spanLon) * (CONTENT - 75);
      const yy = 301 - ((Number(p.latitude) - minLat) / spanLat) * 122;
      doc.setFillColor(...(i ? accent : C.ink)); doc.circle(xx, yy, 9, 'F');
      text(doc, i ? String(i) : 'S', xx, yy + 3, { size: 9, bold: true, color: C.white, align: 'center' });
    });
    text(doc, t.coordinateMap, M + 12, 326, { size: 7.5, color: C.muted });
  } else text(doc, t.noMap, M + 16, 237, { size: 9, color: C.muted, width: CONTENT - 32 });
  panel(doc, M, 350, CONTENT, 310); heading(doc, t.comps, M + 12, 376, CONTENT - 24, accent);
  const columns = [M + 12, M + 215, M + 307, M + 377, M + 461];
  [t.address, t.salePrice, t.date, t.distance, t.status].forEach((label, i) => text(doc, label, columns[i], 399, { size: 8, bold: true, color: C.muted }));
  doc.setDrawColor(...C.line); doc.line(M + 12, 409, W - M - 12, 409);
  if (!all.length) text(doc, t.noComps, M + 12, 438, { size: 9, width: CONTENT - 24 });
  all.slice(0, 8).forEach((comp, i) => {
    const yy = 430 + i * 26;
    text(doc, comp.address || t.unavailable, columns[0], yy, { size: 7.7, width: 190, maxLines: 1 });
    text(doc, currency(comp.salePrice, t), columns[1], yy, { size: 7.7 });
    text(doc, value(comp.saleDate, t.unavailable).slice(0, 10), columns[2], yy, { size: 7.7 });
    text(doc, comp.distanceMiles == null ? t.unavailable : `${comp.distanceMiles} mi`, columns[3], yy, { size: 7.7 });
    text(doc, t[comp.status.toLowerCase()], columns[4], yy, { size: 7.4, bold: true, color: accent });
    doc.setDrawColor(...C.line); doc.line(M + 12, yy + 8, W - M - 12, yy + 8);
  });
  listPanel(doc, t.observations, all.map((comp) => comp.inclusionReason || comp.exclusionReason).filter(Boolean), M, 672, CONTENT, 83, t, accent);
}
function renderValuation(doc, schema, t, accent) {
  const valuation = section(schema, 'valuationEvidence') || {};
  const property = section(schema, 'propertySummary') || {};
  const metrics = schema?.presentation?.existingMetrics || {};
  const scenarios = schema?.presentation?.kpiScenarios;
  panel(doc, M, 127, CONTENT, 175, { fill: C.warm, stroke: C.gold });
  heading(doc, t.arv, M + 14, 155, CONTENT - 28, accent);
  const arv = valuation.status !== 'ARV_UNAVAILABLE' && valuation.range
    ? `${currency(valuation.range.low, t)} – ${currency(valuation.range.high, t)}` : t.unavailable;
  text(doc, arv, M + 14, 204, { size: 21, bold: true, color: C.ink });
  text(doc, valuation.status || 'ARV_UNAVAILABLE', M + 14, 230, { size: 9, bold: true, color: C.muted });
  text(doc, valuation.status === 'ARV_UNAVAILABLE' ? t.noArv : value(valuation.methodology, t.noDetails), M + 14, 253, { size: 8.5, width: valuation.range ? 285 : CONTENT - 28, maxLines: 2 });
  if (valuation.status !== 'ARV_UNAVAILABLE' && valuation.range) {
    const low = Number(valuation.range.low); const high = Number(valuation.range.high);
    const middle = Number.isFinite(Number(valuation.centralReference)) ? Number(valuation.centralReference) : (low + high) / 2;
    const values = [low, middle, high];
    const labels = ['LOW', 'MID', 'HIGH'];
    const maximum = Math.max(...values, 1); const originX = M + 360; const baseY = 267;
    values.forEach((entry, index) => {
      const barHeight = Math.max(24, (entry / maximum) * 72); const x = originX + index * 45;
      doc.setFillColor(...(index === 1 ? accent : C.line)); doc.roundedRect(x, baseY - barHeight, 26, barHeight, 4, 4, 'F');
      text(doc, labels[index], x + 13, baseY + 12, { size: 6.5, bold: true, color: C.muted, align: 'center' });
    });
  }
  const w = (CONTENT - 12) / 2;
  panel(doc, M, 315, w, 170); heading(doc, t.inputs, M + 12, 341, w - 24, accent);
  rows(doc, [[t.price, currency(property.price, t)], [t.rehab, property.rehab ? currency(property.rehab, t) : null], [t.compsUsed, valuation.compsUsed], [t.confidence, valuation.confidence], [t.pricePerSqft, metrics.pricePerSqft?.value == null ? null : currency(metrics.pricePerSqft.value, t)]], M + 12, 365, w - 24, { lineHeight: 26, labelWidth: 93, t });
  panel(doc, M + w + 12, 315, w, 170); heading(doc, t.kpis, M + w + 24, 341, w - 24, accent);
  rows(doc, [
    [t.costBasis, metrics.acquisitionPlusRehab?.value == null ? null : currency(metrics.acquisitionPlusRehab.value, t)],
    [t.capRate, metrics.capRate?.value == null ? null : `${metrics.capRate.value}%`],
    [t.spread, scenarios?.available && Number.isFinite(Number(scenarios.potentialSpread?.find((v) => v.scenario === 'EXPECTED')?.value)) && scenarios.potentialSpread?.find((v) => v.scenario === 'EXPECTED')?.value != null
      ? `${Number(scenarios.potentialSpread.find((v) => v.scenario === 'EXPECTED').value) < 0 ? '-' : ''}$${Math.abs(Number(scenarios.potentialSpread.find((v) => v.scenario === 'EXPECTED').value)).toLocaleString('en-US')}` : null],
    [t.roiScenario, scenarios?.available && scenarios.projectedRoi?.find((v) => v.scenario === 'EXPECTED')?.value != null
      ? `${scenarios.projectedRoi.find((v) => v.scenario === 'EXPECTED').value}%` : null],
  ], M + w + 24, 365, w - 24, { lineHeight: 28, labelWidth: 105, t });
  const cardsY = 497; const cardsGap = 9; const cardW = (CONTENT - cardsGap * 2) / 3;
  const cards = [
    [t.pricePerSqft, metrics.pricePerSqft?.value == null ? t.unavailable : currency(metrics.pricePerSqft.value, t), t.price],
    [t.spread, scenarios?.available && scenarios.potentialSpread?.find((entry) => entry.scenario === 'EXPECTED')?.value != null
      ? `${Number(scenarios.potentialSpread.find((entry) => entry.scenario === 'EXPECTED').value) < 0 ? '-' : ''}$${Math.abs(Number(scenarios.potentialSpread.find((entry) => entry.scenario === 'EXPECTED').value)).toLocaleString('en-US')}` : t.unavailable, t.costBasis],
    [t.capRate, metrics.capRate?.value == null ? t.unavailable : `${metrics.capRate.value}%`, t.confidence],
  ];
  cards.forEach(([label, entry, caption], index) => {
    const x = M + index * (cardW + cardsGap); panel(doc, x, cardsY, cardW, 100, { fill: index === 1 ? C.warm : C.pale, stroke: index === 1 ? C.gold : C.line });
    drawIcon(doc, index === 1 ? 'chart' : index === 2 ? 'check' : 'document', x + 20, cardsY + 23, accent, 18);
    text(doc, label, x + 35, cardsY + 28, { size: 8.5, bold: true, width: cardW - 45, maxLines: 1 });
    text(doc, entry, x + cardW / 2, cardsY + 63, { size: 14, bold: true, color: accent, align: 'center' });
    text(doc, caption, x + cardW / 2, cardsY + 84, { size: 7, color: C.muted, align: 'center' });
  });
  listPanel(doc, t.limitations, array(valuation.warnings).length ? array(valuation.warnings) : array(section(schema, 'limitations')), M, 609, CONTENT, 129, t, accent);
}
function renderConclusion(doc, schema, t, accent) {
  const summary = section(schema, 'executiveSummary') || {};
  const risks = array(section(schema, 'riskAssessment'));
  const steps = array(section(schema, 'verificationChecklist'));
  listPanel(doc, t.opportunity, [summary.summary].filter(Boolean), M, 128, CONTENT, 134, t, accent);
  const w = (CONTENT - 12) / 2;
  listPanel(doc, t.analysis, positiveObservations(summary), M, 274, w, 191, t, accent, { positive: true });
  listPanel(doc, t.mainTopics, risks, M + w + 12, 274, w, 191, t, accent);
  listPanel(doc, t.questions, array(section(schema, 'limitations')), M, 477, w, 164, t, accent);
  listPanel(doc, t.actions, steps, M + w + 12, 477, w, 164, t, accent);
  panel(doc, M, 653, CONTENT, 99, { fill: C.warm, stroke: C.gold });
  heading(doc, t.considerations, M + 12, 677, CONTENT - 24, accent);
  text(doc, t.disclaimer, M + 12, 702, { size: 8.5, width: CONTENT - 24, maxLines: 4 });
}
function renderPage(doc, schema, pageCode, t, accent, images) {
  if (pageCode === 'PROPERTY_OVERVIEW') return renderPropertyOverview(doc, schema, t, accent, images);
  if (pageCode === 'EXECUTIVE_SUMMARY_PROPERTY_CONTEXT') return renderExecutive(doc, schema, t, accent, images);
  if (pageCode === 'INVESTMENT_FIT_RISK') return renderFit(doc, schema, t, accent);
  if (pageCode === 'KEY_INSIGHTS_NEXT_STEPS') return renderInsights(doc, schema, t, accent);
  if (pageCode === 'COMPARATIVE_MARKET_ANALYSIS') return renderComparables(doc, schema, t, accent);
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
  const sources = array(section(schema, 'propertySummary')?.images).slice(0, 4);
  return (await Promise.all(sources.map(resolveImageSource))).filter(Boolean);
}

export async function renderMaxxisReportPdf({ schema, exportEntitlement, generatedAt, language = 'en' } = {}) {
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
  const images = await resolvePropertyImages(schema);
  pages.forEach((page, index) => {
    if (index) doc.addPage('a4', 'portrait');
    const { accent } = pageHeader(doc, schema, page.code, t);
    renderPage(doc, schema, page.code, t, accent, images);
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
