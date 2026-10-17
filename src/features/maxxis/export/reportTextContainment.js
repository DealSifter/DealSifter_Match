import { reduceReportContent } from './reportContentPriority';
import { REPORT_BODY_TIERS, REPORT_TEXT_POLICIES } from './maxxisReportVisualPolicy';

const PAGE_SAFE_BOTTOM = 810;
const C = { ink: [23, 42, 58] };
export function createCardGeometry({
  x, y, width, height, paddingTop = 8, paddingRight = 10, paddingBottom = 10, paddingLeft = 10, titleHeight = 34,
} = {}) {
  return Object.freeze({
    x, y, width, height, paddingTop, paddingRight, paddingBottom, paddingLeft, titleHeight,
    contentX: x + paddingLeft,
    contentY: y + titleHeight + paddingTop,
    contentWidth: width - paddingLeft - paddingRight,
    contentHeight: height - titleHeight - paddingTop - paddingBottom,
  });
}
function reportLineHeight(doc, fontSize) {
  doc.setFontSize(fontSize);
  const metricHeight = typeof doc.getLineHeight === 'function' ? Number(doc.getLineHeight()) : 0;
  return Math.max(fontSize + 3, Number.isFinite(metricHeight) ? metricHeight : 0);
}
function reportLayoutAudit(doc) {
  if (!doc.__maxxisLayoutAudit) doc.__maxxisLayoutAudit = { lines: [], sections: [], continuations: [] };
  doc.__maxxisLayoutAudit.continuations ||= [];
  return doc.__maxxisLayoutAudit;
}
function normalizeReportBody(input) {
  if (typeof input !== 'string') throw new Error('REPORT_SAFE_TEXT_REQUIRED');
  return input.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
function breakLineToFit(doc, line, width) {
  if (doc.getTextWidth(line) <= width) return [line];
  const chunks = [];
  let current = '';
  for (const char of String(line)) {
    const candidate = current + char;
    if (current && doc.getTextWidth(candidate) > width) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [''];
}
function wrapContainedLines(doc, textValue, width) {
  const rawLines = normalizeReportBody(textValue).split('\n');
  const wrapped = rawLines.flatMap((line) => {
    const split = doc.splitTextToSize(line || ' ', width);
    return split.flatMap((entry) => breakLineToFit(doc, String(entry || ''), width));
  }).map((line) => String(line || '').trim()).filter(Boolean);
  return wrapped.length ? wrapped : [''];
}
function evaluateContainedText(doc, textValue, bounds, policy, { bold = false } = {}) {
  const fontSizes = [
    policy.defaultFontSize || REPORT_BODY_TIERS.default,
    policy.tier1FontSize || REPORT_BODY_TIERS.tier1,
    policy.tier2FontSize || REPORT_BODY_TIERS.tier2,
    policy.minimumFontSize || REPORT_BODY_TIERS.minimum,
  ];
  const measure = (content, fontSize) => {
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lineHeight = reportLineHeight(doc, fontSize);
    const lines = wrapContainedLines(doc, content, bounds.width);
    const maxLines = Number(policy.maximumLineCount || policy.maxLines || Infinity);
    const visibleLines = lines.slice(0, maxLines);
    return { lines, visibleLines, lineHeight, requiredHeight: visibleLines.length * lineHeight };
  };
  const original = normalizeReportBody(textValue);
  const defaultMeasurement = measure(original, fontSizes[0]);
  for (const fontSize of fontSizes) {
    const result = measure(original, fontSize);
    if (result.lines.length <= result.visibleLines.length && result.requiredHeight <= bounds.height) {
      return { ...result, selectedFontSize: fontSize, content: original, contentReduced: false, requiredHeightAtDefault: defaultMeasurement.requiredHeight };
    }
  }
  let reduced = reduceReportContent(original, policy);
  for (const fontSize of fontSizes) {
    const result = measure(reduced, fontSize);
    if (result.lines.length <= result.visibleLines.length && result.requiredHeight <= bounds.height) {
      return { ...result, selectedFontSize: fontSize, content: reduced, contentReduced: true, continuationText: original, requiredHeightAtDefault: defaultMeasurement.requiredHeight };
    }
  }
  // Direct completeness exception: preserve overflow in existing-renderer continuation pages.
  const label = policy.continuationLabel || '↪';
  const result = measure(label, fontSizes[0]);
  return { ...result, selectedFontSize: fontSizes[0], content: label, contentReduced: true,
    continuationText: original, requiredHeightAtDefault: defaultMeasurement.requiredHeight };

}
function assertContainedLine({ sectionId, page, cardBounds, contentBounds, lineRecord }) {
  const overflowX = Math.max(0, contentBounds.x - lineRecord.x, lineRecord.x + lineRecord.width - contentBounds.right);
  const overflowY = Math.max(0, contentBounds.y - lineRecord.y, lineRecord.bottomY - contentBounds.bottom);
  const cardOverflowX = Math.max(0, cardBounds.x - lineRecord.x, lineRecord.x + lineRecord.width - cardBounds.right);
  const cardOverflowY = Math.max(0, cardBounds.y - lineRecord.y, lineRecord.bottomY - cardBounds.bottom);
  if (overflowX > 0 || overflowY > 0 || cardOverflowX > 0 || cardOverflowY > 0 || lineRecord.bottomY > PAGE_SAFE_BOTTOM) {
    const failure = new Error('REPORT_SECTION_OVERFLOW');
    failure.code = 'REPORT_SECTION_OVERFLOW';
    failure.details = { page, sectionId, overflowX, overflowY, cardOverflowX, cardOverflowY, line: lineRecord.text };
    throw failure;
  }
  return { overflowX, overflowY };
}
export function renderContainedText({
  doc, text: textValue, bounds, policy = REPORT_TEXT_POLICIES.page6ProfileConclusion, locale = 'en', priority = 'normal',
  sectionId = policy.sectionId || 'containedText', cardBounds = bounds, color = C.ink, bold = false, align = 'left',
}) {
  const contentBounds = Object.freeze({ ...bounds, right: bounds.x + bounds.width, bottom: bounds.y + bounds.height });
  const normalizedCardBounds = Object.freeze({ ...cardBounds, right: cardBounds.x + cardBounds.width, bottom: cardBounds.y + cardBounds.height });
  const layout = evaluateContainedText(doc, textValue, contentBounds, policy, { bold });
  const audit = reportLayoutAudit(doc);
  if (layout.continuationText) audit.continuations.push({ sectionId, sourceText: layout.continuationText, reason: 'GEOMETRY_OVERFLOW' });
  doc.saveGraphicsState();
  doc.rect(contentBounds.x, contentBounds.y, contentBounds.width, contentBounds.height, null); doc.clip(); doc.discardPath();
  doc.setFont('NotoSans', bold ? 'bold' : 'normal');
  doc.setFontSize(layout.selectedFontSize);
  doc.setTextColor(...color);
  let clippedLines = 0;
  layout.visibleLines.forEach((line, lineIndex) => {
    const lineTop = contentBounds.y + lineIndex * layout.lineHeight;
    const baseline = lineTop + layout.selectedFontSize * .86;
    const width = doc.getTextWidth(line);
    const x = align === 'center' ? contentBounds.x + contentBounds.width / 2 : align === 'right' ? contentBounds.right : contentBounds.x;
    const auditX = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    const lineRecord = {
      page: typeof doc.getCurrentPageInfo === 'function' ? doc.getCurrentPageInfo().pageNumber : null,
      sectionId, cardBounds: normalizedCardBounds, contentBounds, fontSize: layout.selectedFontSize,
      lineHeight: layout.lineHeight, lineIndex, text: line, x: auditX, y: lineTop,
      width, height: layout.lineHeight, bottomY: lineTop + layout.lineHeight,
    };
    const overflows = assertContainedLine({ sectionId, page: lineRecord.page, cardBounds: normalizedCardBounds, contentBounds, lineRecord });
    const clipped = overflows.overflowX > 0 || overflows.overflowY > 0;
    if (clipped) clippedLines += 1;
    audit.lines.push({ ...lineRecord, overflowX: overflows.overflowX, overflowY: overflows.overflowY });
    doc.text(line, x, baseline, { align });
  });
  doc.restoreGraphicsState();
  const sectionResult = {
    sectionId, locale, priority, availableHeight: contentBounds.height, requiredHeightAtDefault: layout.requiredHeightAtDefault,
    selectedFontSize: layout.selectedFontSize, renderedLines: layout.visibleLines.length,
    maxLines: policy.maximumLineCount || policy.maxLines || null, contentReduced: layout.contentReduced,
    clippedLines, overflowPixels: 0,
  };
  audit.sections.push(sectionResult);
  return { ...sectionResult, bottomY: contentBounds.y + layout.visibleLines.length * layout.lineHeight };
}

