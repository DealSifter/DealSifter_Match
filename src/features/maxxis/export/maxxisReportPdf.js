import { renderMaxxisReportDocument } from './maxxisReportRenderer';

const PAGE_TITLES = Object.freeze({
  PROPERTY_OVERVIEW: 'Property Overview',
  EXECUTIVE_SUMMARY_PROPERTY_CONTEXT: 'Executive Summary / Property Context',
  INVESTMENT_FIT_RISK: 'Investment Fit & Risk Analysis',
  KEY_INSIGHTS_NEXT_STEPS: 'Key Insights & Next Steps',
  COMPARATIVE_MARKET_ANALYSIS: 'Comparative Market Analysis',
  VALUATION_INTELLIGENCE: 'Valuation Intelligence',
  KEY_INSIGHTS_VERIFICATION: 'Key Insights & Recommendations',
  MAXXIS_AI_ANALYSIS: 'Maxxis Deal AI Analysis',
});

const clean = (value, fallback = 'Unavailable') => {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value).replace(/[\u2013\u2014]/g, '-').replace(/[^\x20-\x7E]/g, '').trim() || fallback;
};
const list = (value) => Array.isArray(value) ? value : [];
const data = (schema, key) => schema?.sections?.[key]?.available ? schema.sections[key].data : null;
const money = (value) => Number.isFinite(Number(value)) && Number(value) !== 0
  ? `$${Number(value).toLocaleString('en-US')}` : 'Unavailable';

function addWrapped(doc, value, x, y, width, options = {}) {
  doc.setFont('helvetica', options.bold ? 'bold' : 'normal');
  doc.setFontSize(options.size || 9);
  doc.setTextColor(...(options.color || [38, 50, 69]));
  const lines = doc.splitTextToSize(clean(value), width);
  const limited = lines.slice(0, options.maxLines || 8);
  doc.text(limited, x, y);
  return y + limited.length * (options.leading || 12);
}

function drawHeader(doc, page, total, title) {
  const width = doc.internal.pageSize.getWidth();
  doc.setFillColor(13, 31, 38);
  doc.rect(0, 0, width, 68, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('DealSifter', 34, 34);
  doc.setTextColor(32, 202, 195);
  doc.text('Match', 132, 34);
  doc.setFontSize(8);
  doc.setTextColor(255, 183, 20);
  doc.text('MAXXIS DEAL AI', 34, 51);
  doc.setTextColor(225, 233, 236);
  doc.text(`${clean(title).toUpperCase()}  |  ${page}/${total}`, width - 34, 38, { align: 'right' });
}

function drawFooter(doc, page, total) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setDrawColor(205, 215, 220);
  doc.line(34, height - 42, width - 34, height - 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(91, 105, 120);
  doc.text('Evidence-based decision support; not an appraisal, financial advice, or a recommendation to buy or sell.', 34, height - 26);
  doc.text(`${page}/${total}`, width - 34, height - 26, { align: 'right' });
}

function drawCard(doc, title, rows, x, y, width, height) {
  doc.setFillColor(247, 250, 250);
  doc.setDrawColor(205, 218, 220);
  doc.roundedRect(x, y, width, height, 7, 7, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(12, 117, 119);
  doc.text(clean(title).toUpperCase(), x + 12, y + 19);
  let lineY = y + 38;
  rows.slice(0, 9).forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(80, 94, 110);
    doc.text(clean(label), x + 12, lineY);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 35, 50);
    const rendered = doc.splitTextToSize(clean(value), width - 94).slice(0, 2);
    doc.text(rendered, x + 82, lineY);
    lineY += Math.max(17, rendered.length * 9 + 5);
  });
}

function propertyRows(property) {
  return [
    ['Address', [property.address, property.city, property.state, property.zip].filter(Boolean).join(', ')],
    ['Type', property.type], ['Price', money(property.price)], ['Beds / Baths', `${clean(property.beds)} / ${clean(property.baths)}`],
    ['Living area', property.sqft], ['Lot', property.lot], ['Strategy', property.objective], ['Source', property.source],
  ];
}

function drawPropertyOverview(doc, schema) {
  const property = data(schema, 'propertySummary') || {};
  drawCard(doc, 'Property context', propertyRows(property), 34, 92, 330, 250);
  doc.setFillColor(221, 243, 242); doc.setDrawColor(32, 202, 195);
  doc.roundedRect(380, 92, 181, 250, 8, 8, 'FD');
  doc.setTextColor(12, 117, 119); doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('LOCATION', 394, 116);
  doc.setDrawColor(55, 143, 147); doc.setLineWidth(1.2);
  doc.line(405, 155, 535, 268); doc.line(535, 155, 405, 268); doc.circle(470, 210, 16);
  doc.setFontSize(8); doc.setTextColor(38, 50, 69);
  doc.text(doc.splitTextToSize(clean([property.city, property.state, property.zip].filter(Boolean).join(', ')), 145), 470, 302, { align: 'center' });
  drawCard(doc, 'Published facts and notes', [
    ['Status', property.published ? 'Published' : 'Not published'], ['Portfolio', property.portfolio],
    ['Description', property.notes || property.description], ['Record ID', property.id],
  ], 34, 360, 527, 285);
}

function drawAnalysisFit(doc, schema) {
  const fit = data(schema, 'investmentProfile') || {};
  const risks = list(data(schema, 'riskAssessment'));
  const limitations = list(data(schema, 'limitations'));
  drawCard(doc, 'Investment profile alignment', [
    ['Match Score', fit.score === null || fit.score === undefined ? 'Unavailable' : `${fit.score}% (profile fit only)`],
    ['Target market', fit.targetMarket?.explanation || fit.targetMarket?.status],
    ['Property type', fit.propertyType?.explanation || fit.propertyType?.status],
    ['Strategy', fit.strategy?.explanation || fit.strategy?.status],
  ], 34, 92, 527, 205);
  drawCard(doc, 'Risk analysis', risks.length ? risks.map((risk) => [risk.severity || risk.category, risk.explanation || risk.reason]) : [['Status', 'No risk statements available from current evidence.']], 34, 315, 255, 330);
  drawCard(doc, 'Limitations', limitations.length ? limitations.map((item, index) => [`${index + 1}`, item]) : [['Status', 'No additional limitations recorded.']], 306, 315, 255, 330);
}

function drawInsights(doc, schema) {
  const summary = data(schema, 'executiveSummary') || {};
  const observations = list(summary.observations);
  const limitations = list(data(schema, 'limitations'));
  const steps = list(data(schema, 'verificationChecklist'));
  let y = addWrapped(doc, summary.summary || 'Analysis is limited to the facts currently available in DealSifter.', 34, 108, 527, { bold: true, size: 13, leading: 17, maxLines: 8 });
  y += 12;
  drawCard(doc, 'Key insights', observations.length ? observations.map((item, index) => [`${index + 1}`, item.explanation || item]) : [['Status', 'No additional evidence-backed insight available.']], 34, y, 255, 220);
  drawCard(doc, 'Next steps', steps.length ? steps.map((item, index) => [`${index + 1}`, item]) : [['Status', 'Review and verify the available property facts.']], 306, y, 255, 220);
  drawCard(doc, 'Known limitations', limitations.length ? limitations.map((item, index) => [`${index + 1}`, item]) : [['Status', 'No additional limitations recorded.']], 34, y + 238, 527, 185);
}

function drawMaxxisConclusion(doc, schema) {
  const summary = data(schema, 'executiveSummary') || {};
  const risks = list(data(schema, 'riskAssessment'));
  const steps = list(data(schema, 'verificationChecklist'));
  let y = addWrapped(doc, summary.summary || 'No additional Maxxis interpretation is available from the authorized evidence.', 34, 108, 527, { bold: true, size: 13, leading: 17, maxLines: 9 });
  y += 14;
  drawCard(doc, 'Material topics', risks.length ? risks.map((risk, index) => [`${index + 1}. ${risk.severity || risk.category}`, risk.reason || risk.explanation]) : [['Status', 'No additional risk statements available.']], 34, y, 255, 250);
  drawCard(doc, 'Verification actions', steps.length ? steps.map((step, index) => [`${index + 1}`, step]) : [['Status', 'Review the authorized evidence before any decision.']], 306, y, 255, 250);
  drawCard(doc, 'Conclusion boundaries', [['Evidence', 'Only stored facts, cached evidence, and deterministic outputs are represented.'], ['ARV', clean(data(schema, 'valuationEvidence')?.status, 'ARV_UNAVAILABLE')], ['Decision', 'No buy, sell, or return recommendation is produced.']], 34, y + 268, 527, 170);
}

function drawComparables(doc, schema) {
  const comps = data(schema, 'comparableEvidence') || {};
  const rows = [...list(comps.used), ...list(comps.supporting), ...list(comps.excluded)];
  drawCard(doc, 'Recorded sold comparable evidence', rows.length ? rows.slice(0, 8).map((comp, index) => [
    `${index + 1}. ${comp.role || 'UNKNOWN'}`, `${clean(comp.address)} | ${money(comp.salePrice)} | ${clean(comp.saleDate)} | ${clean(comp.distanceMiles)} mi`,
  ]) : [['Status', 'No verified sold comparables are available.']], 34, 92, 527, 500);
  addWrapped(doc, 'Property-record evidence only. No external comparable images are embedded in this report.', 34, 620, 527, { size: 8 });
}

function drawValuation(doc, schema) {
  const valuation = data(schema, 'valuationEvidence') || {};
  const range = valuation.range ? `${money(valuation.range.low)} - ${money(valuation.range.high)}` : 'Unavailable';
  drawCard(doc, 'Valuation evidence', [['ARV status', valuation.status || 'ARV_UNAVAILABLE'], ['ARV range', range], ['Central reference', money(valuation.centralReference)], ['Confidence', valuation.confidence], ['Comps used', valuation.compsUsed], ['Methodology', valuation.methodology]], 34, 92, 527, 270);
  drawCard(doc, 'Warnings and scenario limitations', list(valuation.warnings).length ? list(valuation.warnings).map((item, index) => [`${index + 1}`, item]) : [['Status', 'No valuation warnings recorded.']], 34, 380, 527, 240);
}

function drawDealFit(doc, schema) { drawAnalysisFit(doc, schema); }

function drawPage(doc, schema, code) {
  if (code === 'PROPERTY_OVERVIEW' || code === 'EXECUTIVE_SUMMARY_PROPERTY_CONTEXT') return drawPropertyOverview(doc, schema);
  if (code === 'INVESTMENT_FIT_RISK') return drawAnalysisFit(doc, schema);
  if (code === 'KEY_INSIGHTS_NEXT_STEPS' || code === 'KEY_INSIGHTS_VERIFICATION') return drawInsights(doc, schema);
  if (code === 'MAXXIS_AI_ANALYSIS') return drawMaxxisConclusion(doc, schema);
  if (code === 'COMPARATIVE_MARKET_ANALYSIS') return drawComparables(doc, schema);
  if (code === 'VALUATION_INTELLIGENCE') return drawValuation(doc, schema);
  return drawDealFit(doc, schema);
}

export async function renderMaxxisReportPdf({ schema, exportEntitlement, generatedAt, language = 'en' } = {}) {
  const prepared = renderMaxxisReportDocument({ schema, exportEntitlement, generatedAt, language });
  if (prepared.state !== 'PREPARED') return prepared;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const pages = prepared.document.pages;
  pages.forEach((page, index) => {
    if (index) doc.addPage('a4', 'portrait');
    drawHeader(doc, index + 1, pages.length, PAGE_TITLES[page.code] || page.code);
    drawPage(doc, schema, page.code);
    drawFooter(doc, index + 1, pages.length);
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
  URL.revokeObjectURL(url);
  return true;
}
